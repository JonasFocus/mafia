-- Hardening regression tests (2026-07-06 audit fixes).

-- Mafia cannot kill fellow mafia server-side.
do $$
declare
  g record; mafia uuid[]; v_err boolean;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  perform test.act(g.uids[1]); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  perform test.act(g.uids[1]); perform public.begin_night(g.game_id);

  v_err := false;
  begin
    perform test.kill(g.game_id, mafia[1], mafia[2]);
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'mafia cannot kill mafia');

  raise notice 't10a mafia fratricide blocked OK';
end $$;

-- Host phase transitions fail on wrong phase.
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
  perform test.ok(v_err, 'begin_day_vote refuses role_reveal');

  v_err := false;
  begin perform public.begin_night(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'begin_night refuses double-call from night');

  raise notice 't10b host phase guards OK';
end $$;

-- Chameleon: stale round inserts rejected; winner recorded on town win.
do $$
declare
  g record; host uuid; u uuid; r1 uuid; r2 uuid; outsider uuid; v_err boolean;
begin
  select * into g from test.new_game('chameleon', 4, 1, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_game(g.game_id);
  select id into r1 from rounds where game_id = g.game_id and round_number = 1;

  foreach u in array g.uids loop
    perform test.act(u);
    set local role authenticated;
    insert into hints_given (round_id, player_id) values (r1, u);
    reset role;
  end loop;
  perform test.ok(test.status(g.game_id) = 'voting', 'round 1 hints -> voting');

  -- Tie with no votes -> round 2 hint phase.
  perform test.act(host);
  perform public.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'hint_phase', 'forced tie advances to round 2');
  perform test.ok(test.round(g.game_id) = 2, 'current_round is 2');
  select id into r2 from rounds where game_id = g.game_id and round_number = 2;

  -- Stale vote on round 1 during round 2 voting (after hints complete).
  foreach u in array g.uids loop
    perform test.act(u);
    set local role authenticated;
    insert into hints_given (round_id, player_id) values (r2, u);
    reset role;
  end loop;
  perform test.ok(test.status(g.game_id) = 'voting', 'round 2 hints -> voting');

  v_err := false;
  begin
    perform test.act(g.uids[2]);
    set local role authenticated;
    insert into votes (round_id, voter_id, voted_for_id) values (r1, g.uids[2], g.uids[3]);
    reset role;
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'stale round vote rejected by RLS');

  -- Finish round 2: unanimous vote on outsider -> town wins with recorded winner.
  select user_id into outsider from game_players where game_id = g.game_id and is_outsider;
  foreach u in array g.uids loop
    perform test.act(u);
    set local role authenticated;
    insert into votes (round_id, voter_id, voted_for_id) values (r2, u, outsider);
    reset role;
  end loop;
  perform test.ok(test.status(g.game_id) = 'game_over', 'outsider lynched ends game');
  perform test.ok((select winner from games where id = g.game_id) = 'town', 'chameleon records town winner');

  raise notice 't10c chameleon round scoping + winner OK';
end $$;
