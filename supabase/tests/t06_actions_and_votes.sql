-- Action validation: dead actors, dead targets, role misuse, vote changes.
do $$
declare
  g record; host uuid; mafia uuid[]; sheriff uuid; angel uuid; faithful uuid[];
  victim uuid; v_err boolean; outsider uuid;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  sheriff := (test.living(g.game_id, 'sheriff'))[1];
  angel := (test.living(g.game_id, 'angel'))[1];
  faithful := test.living(g.game_id, 'faithful');

  -- Acting before night is refused.
  v_err := false;
  begin perform test.kill(g.game_id, mafia[1], faithful[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'no kills during role_reveal');

  perform test.act(host); perform public.begin_night(g.game_id);

  -- Role misuse.
  v_err := false;
  begin perform test.kill(g.game_id, faithful[1], mafia[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'faithful cannot kill');
  v_err := false;
  begin perform test.inspect(g.game_id, mafia[1], faithful[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'mafia cannot inspect');
  v_err := false;
  begin perform test.protect(g.game_id, sheriff, sheriff);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'sheriff cannot protect');

  -- Outsiders (not in the game) cannot act.
  outsider := test.mk_user('lurker');
  v_err := false;
  begin perform test.kill(g.game_id, outsider, faithful[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'non-player cannot act');

  -- Kill faithful[1] tonight.
  perform test.kill(g.game_id, mafia[1], faithful[1]);
  perform test.kill(g.game_id, mafia[2], faithful[1]);
  perform test.inspect(g.game_id, sheriff, faithful[2]);
  perform test.protect(g.game_id, angel, angel);
  perform test.ok(test.status(g.game_id) = 'day_result', 'night resolved');
  victim := faithful[1];

  perform test.act(host); perform public.begin_day_vote(g.game_id);

  -- Dead players cannot vote; nobody can vote for the dead.
  v_err := false;
  begin perform test.vote(g.game_id, victim, mafia[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'dead player cannot vote');
  v_err := false;
  begin perform test.vote(g.game_id, mafia[1], victim);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'cannot vote for a dead player');

  -- Changing your vote before resolution works; the final tally uses the latest.
  perform test.vote(g.game_id, mafia[1], sheriff);
  perform test.vote(g.game_id, mafia[1], faithful[2]);
  perform test.ok(
    (select target_id from day_votes where game_id = g.game_id and voter_id = mafia[1] and round_number = 1) = faithful[2],
    'vote change overwrites the ballot');
  perform test.ok(
    (select count(*) from day_votes where game_id = g.game_id and voter_id = mafia[1]) = 1,
    'one ballot per voter');

  -- Everyone else piles onto mafia[2]: 5 votes mafia[2], 1 vote faithful[2] -> lynch mafia[2].
  perform test.vote(g.game_id, mafia[2], faithful[2]);
  perform test.vote(g.game_id, sheriff, mafia[2]);
  perform test.vote(g.game_id, angel, mafia[2]);
  perform test.vote(g.game_id, faithful[2], mafia[2]);
  perform test.ok(test.status(g.game_id) = 'day_vote', 'still waiting on the last living voter');
  perform test.vote(g.game_id, faithful[3], mafia[2]);
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'resolved when last living player voted');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) = mafia[2], 'majority target lynched');

  -- Voting after resolution is refused.
  v_err := false;
  begin perform test.vote(g.game_id, sheriff, mafia[1]);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'no votes during lynch_result');

  -- Self-vote is allowed by design.
  perform test.act(host); perform public.begin_night(g.game_id);
  perform test.ok(test.round(g.game_id) = 2, 'round 2');
  perform test.kill(g.game_id, mafia[1], faithful[2]);
  perform test.inspect(g.game_id, sheriff, mafia[1]);
  perform test.protect(g.game_id, angel, faithful[2]);  -- save
  perform test.ok((select last_night_victim from games where id = g.game_id) is null, 'angel save on night 2');
  perform test.act(host); perform public.begin_day_vote(g.game_id);
  perform test.vote(g.game_id, mafia[1], mafia[1]);
  perform test.ok(
    (select target_id from day_votes where game_id = g.game_id and voter_id = mafia[1] and round_number = 2) = mafia[1],
    'self-vote accepted');

  raise notice 't06 action/vote validation OK';
end $$;
