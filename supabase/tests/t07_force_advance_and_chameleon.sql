-- Host escape hatch (force_advance_phase) + chameleon regression smoke.
do $$
declare
  g record; host uuid; mafia uuid[]; sheriff uuid; faithful uuid[]; v_err boolean;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  sheriff := (test.living(g.game_id, 'sheriff'))[1];
  faithful := test.living(g.game_id, 'faithful');
  perform test.act(host); perform public.begin_night(g.game_id);

  -- Only one mafia submits, sheriff/angel go missing -> host force-advances.
  perform test.kill(g.game_id, mafia[1], faithful[1]);

  -- Non-host cannot force-advance.
  perform test.act(g.uids[2] );
  v_err := false;
  begin perform public.force_advance_phase(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err or test.status(g.game_id) = 'night', 'non-host cannot force-advance');
  perform test.ok(test.status(g.game_id) = 'night', 'night still waiting');

  perform test.act(host);
  perform public.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'day_result', 'forced night resolution');
  perform test.ok((select last_night_victim from games where id = g.game_id) = faithful[1], 'partial-submission kill applied');

  -- Partial day vote, then force-advance -> lynch_result with plurality.
  perform public.begin_day_vote(g.game_id);
  perform test.vote(g.game_id, sheriff, mafia[1]);
  perform test.vote(g.game_id, faithful[2], mafia[1]);
  perform test.act(host);
  perform public.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'forced day resolution lands on lynch_result');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) = mafia[1], 'partial-vote plurality lynched');

  -- Force-advance has no arm for lynch_result (host uses Begin night) -> error, state unchanged.
  v_err := false;
  begin perform public.force_advance_phase(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'force-advance refuses lynch_result');
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'state unchanged after refusal');

  -- Empty night (nobody submitted anything): force-advance -> no death.
  perform test.act(host); perform public.begin_night(g.game_id);
  perform test.ok(test.round(g.game_id) = 2, 'round 2 via begin_night');
  perform public.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'day_result', 'empty night resolves');
  perform test.ok((select last_night_victim from games where id = g.game_id) is null, 'empty night kills nobody');

  -- Empty day vote: force-advance -> no lynch.
  perform public.begin_day_vote(g.game_id);
  perform public.force_advance_phase(g.game_id);
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'empty day resolves');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) is null, 'empty day lynches nobody');

  raise notice 't07a force-advance OK';
end $$;

-- Chameleon smoke: the shared tables/policies still work after the new
-- migrations (hint gating via _game_status, vote flow, resolve_votes trigger).
do $$
declare
  g record; host uuid; u uuid; r uuid; outsider uuid; n int;
begin
  select * into g from test.new_game('chameleon', 4, 1, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_game(g.game_id);
  perform test.ok(test.status(g.game_id) = 'hint_phase', 'chameleon starts');
  select id into r from rounds where game_id = g.game_id and round_number = 1;

  -- All four players hint (as authenticated, through RLS).
  foreach u in array g.uids loop
    perform test.act(u);
    set local role authenticated;
    insert into hints_given (round_id, player_id) values (r, u);
    reset role;
  end loop;
  perform test.ok(test.status(g.game_id) = 'voting', 'hints complete -> voting');

  -- Everyone votes for the outsider -> outsider caught -> game over.
  select user_id into outsider from game_players where game_id = g.game_id and is_outsider;
  foreach u in array g.uids loop
    perform test.act(u);
    set local role authenticated;
    insert into votes (round_id, voter_id, voted_for_id) values (r, u, outsider);
    reset role;
  end loop;
  perform test.ok(test.status(g.game_id) = 'game_over', 'outsider lynched ends chameleon game');
  raise notice 't07b chameleon regression OK';
end $$;
