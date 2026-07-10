-- Hardening regression tests.
do $$
declare
  g record; mafia uuid[]; v_err boolean;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  perform test.act(g.uids[1]); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  perform test.act(g.uids[1]); perform test.begin_night(g.game_id);
  v_err := false;
  begin perform test.kill(g.game_id, mafia[1], mafia[2]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'Mafia cannot kill Mafia');
  raise notice 't10a Mafia fratricide blocked OK';
end $$;

do $$
declare
  g record; host uuid; v_err boolean;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  v_err := false;
  begin perform public.begin_day_vote(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'day wrapper cannot bypass role reveal');
  v_err := false;
  begin perform public.begin_night(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'night wrapper cannot bypass readiness');
  perform test.begin_night(g.game_id);
  v_err := false;
  begin perform public.begin_night(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'night wrapper refuses night phase before recovery');
  raise notice 't10b strict phase wrappers OK';
end $$;

do $$
declare
  g record; host uuid; u uuid; r uuid; outsider uuid; innocent uuid; v_err boolean;
begin
  select * into g from test.new_game('chameleon', 4, 1, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_game(g.game_id);
  perform test.force_advance_phase(g.game_id);
  select id into r from rounds where game_id = g.game_id and round_number = 1;
  foreach u in array g.uids loop
    perform test.act(u);
    perform public.submit_chameleon_hint(g.game_id);
  end loop;

  v_err := false;
  begin
    perform test.act(g.uids[2]);
    set local role authenticated;
    insert into votes (round_id, voter_id, voted_for_id)
    values (r, g.uids[2], g.uids[3]);
    reset role;
  exception when others then
    v_err := true;
    reset role;
  end;
  perform test.ok(v_err, 'direct ballot insert is blocked');

  select user_id into outsider from game_players
  where game_id = g.game_id and is_outsider;
  select user_id into innocent from game_players
  where game_id = g.game_id and not is_outsider order by join_order limit 1;
  foreach u in array g.uids loop
    perform test.act(u);
    perform public.cast_chameleon_vote(g.game_id, innocent);
  end loop;
  perform test.ok(test.status(g.game_id) = 'game_over', 'wrong vote ends Chameleon');
  perform test.ok((select winner from games where id = g.game_id) = 'chameleon',
    'Chameleon wins a wrong vote');
  perform test.ok((select chameleon_caught_id from games where id = g.game_id) is null,
    'wrongly accused player is not recorded as Chameleon');
  raise notice 't10c Chameleon boundary OK';
end $$;
