-- Production-readiness contracts: lifecycle RPCs, snapshot secrecy, canonical
-- Chameleon recovery, and majority-based Mafia resolution.

do $$
declare
  g record; host uuid; joiner uuid; code text; old_updated timestamptz;
  old_expiry timestamptz; v_err boolean; listed record;
begin
  select * into g from test.new_game('mafia', 5, 1, false, false);
  host := g.uids[1]; joiner := g.uids[2];
  select room_code, updated_at, expires_at into code, old_updated, old_expiry
  from games where id = g.game_id;
  perform test.ok(code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$',
    'room code uses only the unambiguous alphabet');

  select * into listed from public.list_open_games() where room_code = code;
  perform test.ok(listed.host_name = 'p1', 'open room includes host name');
  perform test.ok(listed.player_count = 5 and listed.capacity = 25,
    'open room includes count and mode capacity');

  perform test.act(joiner);
  perform public.heartbeat_game(g.game_id);
  perform test.ok((select updated_at from games where id = g.game_id) = old_updated,
    'heartbeat does not touch games.updated_at');
  perform test.ok((select expires_at from games where id = g.game_id) = old_expiry,
    'heartbeat does not touch games.expires_at');
  perform test.act(host);
  perform public.heartbeat_game(g.game_id);
  perform test.ok((select updated_at from games where id = g.game_id) > old_updated,
    'host heartbeat invalidates the shared snapshot');

  perform test.act(joiner);
  v_err := false;
  begin perform public.claim_room_host(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'active dealer cannot be reclaimed');
  update game_players set last_seen_at = clock_timestamp() - interval '121 seconds'
  where game_id = g.game_id and user_id = host;
  perform public.claim_room_host(g.game_id);
  perform test.ok((select dealer_id from games where id = g.game_id) = joiner,
    'stale lobby dealer transfers');

  perform public.start_mafia_game(g.game_id);
  update game_players set last_seen_at = clock_timestamp() - interval '121 seconds'
  where game_id = g.game_id and user_id = joiner;
  perform test.act(host);
  v_err := false;
  begin perform public.claim_room_host(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'active-game host reclaim is blocked');
  v_err := false;
  begin perform public.close_game(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'running game cannot be closed');
  raise notice 't11a lifecycle RPCs OK';
end $$;

do $$
declare
  g record; u uuid; outsider uuid; insider uuid; snap jsonb; option_count integer;
  category_word_count integer; secret uuid; wrong_word uuid; v_err boolean;
begin
  select * into g from test.new_game('chameleon', 3, 1, true, true);
  perform test.act(g.uids[1]); perform public.start_game(g.game_id);
  select gp.user_id into outsider from game_players gp
  where gp.game_id = g.game_id and gp.is_outsider;
  select gp.user_id into insider from game_players gp
  where gp.game_id = g.game_id and not gp.is_outsider order by gp.join_order limit 1;
  perform test.ok((select word_id from games where id = g.game_id) is null,
    'selected word is absent from participant-readable games');
  perform test.ok((select guesses_remaining from game_secrets where game_id = g.game_id) = 2,
    'three-player Chameleon gets two guesses');

  perform test.act(outsider);
  set local role authenticated;
  select public.get_game_snapshot((select room_code from games where id = g.game_id)) into snap;
  v_err := false;
  begin perform count(*) from words;
  exception when others then v_err := true; end;
  reset role;
  perform test.ok(v_err, 'words table is not directly selectable');
  perform test.ok(snap->>'word_text' is null, 'Chameleon snapshot hides selected word');
  option_count := jsonb_array_length(snap->'guess_word_options');
  select count(*) into category_word_count from words w
  where w.category_id = (select category_id from games where id = g.game_id);
  perform test.ok(option_count = category_word_count,
    'snapshot includes the full public category word list');

  perform test.act(insider);
  select public.get_game_snapshot((select room_code from games where id = g.game_id)) into snap;
  perform test.ok(snap->>'word_text' is not null, 'non-Chameleon sees selected word');
  perform test.ok(not (snap->'game' ? 'word_id'), 'safe game payload has no word_id');

  foreach u in array g.uids loop
    perform test.act(u);
    perform public.mark_phase_ready(g.game_id);
  end loop;
  perform test.ok(test.status(g.game_id) = 'hint_phase',
    'all acknowledgements advance role reveal');

  -- Exercise both canonical guesses without relying on vote randomness.
  update games set status = 'chameleon_guess', chameleon_caught_id = outsider,
    phase_started_at = clock_timestamp() where id = g.game_id;
  select word_id into secret from game_secrets where game_id = g.game_id;
  select candidate_id into wrong_word
  from game_secrets s, unnest(s.guess_candidate_ids) candidate_id
  where s.game_id = g.game_id and candidate_id <> secret limit 1;
  perform test.act(outsider);
  perform public.submit_chameleon_guess(g.game_id, wrong_word);
  perform test.ok(test.status(g.game_id) = 'chameleon_guess',
    'first wrong three-player guess keeps phase open');
  perform test.ok((select guesses_remaining from game_secrets where game_id = g.game_id) = 1,
    'one guess remains');
  perform public.submit_chameleon_guess(g.game_id, secret);
  perform test.ok((select winner from games where id = g.game_id) = 'chameleon',
    'second correct guess wins for Chameleon');
  raise notice 't11b snapshot + three-player guesses OK';
end $$;

do $$
declare
  g record; u uuid; r uuid; outsider uuid; innocent uuid; caller uuid; v_err boolean;
begin
  select * into g from test.new_game('chameleon', 4, 1, true, true);
  perform test.act(g.uids[1]); perform public.start_game(g.game_id);
  perform test.force_advance_phase(g.game_id);
  select id into r from rounds where game_id = g.game_id and round_number = 1;
  foreach u in array g.uids loop
    perform test.act(u);
    perform public.submit_chameleon_hint(g.game_id);
  end loop;
  select user_id into outsider from game_players
  where game_id = g.game_id and is_outsider;
  select user_id into innocent from game_players
  where game_id = g.game_id and not is_outsider order by join_order limit 1;

  perform test.act(g.uids[1]); perform public.cast_chameleon_vote(g.game_id, outsider);
  perform test.act(g.uids[2]); perform public.cast_chameleon_vote(g.game_id, outsider);
  perform test.act(g.uids[3]); perform public.cast_chameleon_vote(g.game_id, innocent);
  perform test.act(g.uids[4]); perform public.cast_chameleon_vote(g.game_id, innocent);
  perform test.ok(test.status(g.game_id) = 'chameleon_tie_break',
    'tied vote enters dealer decision');

  perform test.act(g.uids[2]);
  v_err := false;
  begin perform public.cast_chameleon_vote(g.game_id, outsider);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'normal voting RPC is closed during tie decision');

  caller := g.uids[2];
  if caller = (select dealer_id from games where id = g.game_id) then caller := g.uids[3]; end if;
  perform test.act(caller);
  v_err := false;
  begin perform public.break_chameleon_tie(g.game_id, outsider);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'non-dealer cannot decide before timeout');
  perform test.expire_phase(g.game_id);
  perform public.advance_game_phase(g.game_id);
  perform test.ok((select dealer_id from games where id = g.game_id) = caller,
    'tie timeout transfers dealer to recovering participant');
  perform public.break_chameleon_tie(g.game_id, outsider);
  perform test.ok(test.status(g.game_id) = 'chameleon_guess',
    'new dealer catches tied Chameleon');
  raise notice 't11c Chameleon tie recovery OK';
end $$;

do $$
declare
  g record; mafia uuid[]; faithful uuid[]; voter uuid;
begin
  select * into g from test.new_game('mafia', 7, 2, false, false);
  perform test.act(g.uids[1]); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia'); faithful := test.living(g.game_id, 'faithful');
  perform test.begin_night(g.game_id);
  perform test.kill(g.game_id, mafia[1], faithful[1]);
  perform test.force_advance_phase(g.game_id);
  perform test.ok((select last_night_victim from games where id = g.game_id) is null,
    'strict Mafia majority required to kill');

  perform test.begin_day_vote(g.game_id);
  foreach voter in array g.uids[1:3] loop
    perform test.vote(g.game_id, voter, mafia[1]);
  end loop;
  perform test.force_advance_phase(g.game_id);
  perform test.ok((select last_lynch_victim from games where id = g.game_id) is null,
    'day vote needs majority participation');
  perform test.ok(test.status(g.game_id) = 'lynch_result',
    'insufficient day participation still recovers');
  raise notice 't11d majority semantics OK';
end $$;

do $$
declare
  viewer uuid; snapshot jsonb;
begin
  viewer := test.mk_user('missing-room-viewer');
  perform test.act(viewer);
  select public.get_game_snapshot('ZZZZ') into snapshot;
  perform test.ok(snapshot = jsonb_build_object('error_code', 'ROOM_NOT_FOUND'),
    'missing rooms return a successful terminal snapshot tombstone');
  raise notice 't11e terminal snapshot tombstone OK';
end $$;
