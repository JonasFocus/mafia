-- Full 7-player game: 2 mafia + sheriff + angel. Exercises every phase,
-- the lynch_result announcement, round bumping, and a town win.
do $$
declare
  g record; host uuid; mafia uuid[]; sheriff uuid; angel uuid; faithful uuid[];
  victim uuid; lynch1 uuid; v uuid; alive uuid[];
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];

  -- everyone joined through join_game; roster is 7 in the lobby
  perform test.ok((select count(*) from game_players where game_id = g.game_id) = 7, 'seven joined');
  perform test.ok(test.status(g.game_id) = 'lobby', 'starts in lobby');

  perform test.act(host);
  perform public.start_mafia_game(g.game_id);
  perform test.ok(test.status(g.game_id) = 'role_reveal', 'role_reveal after start');
  perform test.ok(test.round(g.game_id) = 1, 'round 1 after start');
  perform test.ok(array_length(test.living(g.game_id, 'mafia'), 1) = 2, 'two mafia dealt');
  perform test.ok(array_length(test.living(g.game_id, 'sheriff'), 1) = 1, 'one sheriff dealt');
  perform test.ok(array_length(test.living(g.game_id, 'angel'), 1) = 1, 'one angel dealt');
  perform test.ok(array_length(test.living(g.game_id, 'faithful'), 1) = 3, 'three faithful dealt');

  mafia := test.living(g.game_id, 'mafia');
  sheriff := (test.living(g.game_id, 'sheriff'))[1];
  angel := (test.living(g.game_id, 'angel'))[1];
  faithful := test.living(g.game_id, 'faithful');

  perform test.act(host);
  perform public.begin_night(g.game_id);
  perform test.ok(test.status(g.game_id) = 'night', 'night 1 begins');
  perform test.ok(test.round(g.game_id) = 1, 'round still 1 entering night 1');

  -- Night 1: both mafia kill faithful[1]; sheriff inspects mafia[1]; angel protects self.
  perform test.kill(g.game_id, mafia[1], faithful[1]);
  perform test.kill(g.game_id, mafia[2], faithful[1]);
  perform test.ok(test.status(g.game_id) = 'night', 'night waits for sheriff+angel');
  perform test.inspect(g.game_id, sheriff, mafia[1]);
  perform test.ok(
    (select result from night_actions where game_id = g.game_id and actor_id = sheriff and round_number = 1) = 'mafia',
    'sheriff learns mafia alignment');
  perform test.ok(test.status(g.game_id) = 'night', 'night waits for angel');
  perform test.protect(g.game_id, angel, angel);

  perform test.ok(test.status(g.game_id) = 'day_result', 'night resolves once all actors acted');
  perform test.ok((select last_night_victim from games where id = g.game_id) = faithful[1], 'victim recorded');
  perform test.ok((select is_eliminated from game_players where game_id = g.game_id and user_id = faithful[1]), 'victim eliminated');

  perform test.act(host);
  perform public.begin_day_vote(g.game_id);
  perform test.ok(test.status(g.game_id) = 'day_vote', 'day vote begins');

  -- Day 1: 6 alive. Everyone but mafia[1] votes mafia[1]; mafia[1] votes sheriff.
  perform test.vote(g.game_id, mafia[1], sheriff);
  perform test.vote(g.game_id, mafia[2], mafia[1]);
  perform test.vote(g.game_id, sheriff, mafia[1]);
  perform test.vote(g.game_id, angel, mafia[1]);
  perform test.vote(g.game_id, faithful[2], mafia[1]);
  perform test.ok(test.status(g.game_id) = 'day_vote', 'vote waits for the last ballot');
  perform test.vote(g.game_id, faithful[3], mafia[1]);

  perform test.ok(test.status(g.game_id) = 'lynch_result', 'lynch_result after all ballots');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) = mafia[1], 'lynch victim recorded');
  perform test.ok((select is_eliminated from game_players where game_id = g.game_id and user_id = mafia[1]), 'lynched player eliminated');
  perform test.ok(test.round(g.game_id) = 1, 'round does NOT bump at lynch_result');

  perform test.act(host);
  perform public.begin_night(g.game_id);
  perform test.ok(test.status(g.game_id) = 'night', 'night 2 begins');
  perform test.ok(test.round(g.game_id) = 2, 'round bumps entering night 2');

  -- Night 2: mafia[2] kills faithful[2]; sheriff inspects faithful[3] (not_mafia); angel self-protects.
  perform test.kill(g.game_id, mafia[2], faithful[2]);
  perform test.inspect(g.game_id, sheriff, faithful[3]);
  perform test.ok(
    (select result from night_actions where game_id = g.game_id and actor_id = sheriff and round_number = 2) = 'not_mafia',
    'sheriff sees not_mafia for faithful');
  perform test.protect(g.game_id, angel, angel);
  perform test.ok(test.status(g.game_id) = 'day_result', 'night 2 resolves');
  perform test.ok((select last_night_victim from games where id = g.game_id) = faithful[2], 'night 2 victim recorded');

  -- Day 2: 4 alive (mafia[2], sheriff, angel, faithful[3]). Town lynches the last mafia -> town wins.
  perform test.act(host);
  perform public.begin_day_vote(g.game_id);
  perform test.vote(g.game_id, mafia[2], faithful[3]);
  perform test.vote(g.game_id, sheriff, mafia[2]);
  perform test.vote(g.game_id, angel, mafia[2]);
  perform test.vote(g.game_id, faithful[3], mafia[2]);

  perform test.ok(test.status(g.game_id) = 'game_over', 'game over when last mafia lynched');
  perform test.ok((select winner from games where id = g.game_id) = 'town', 'town wins');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) = mafia[2], 'final lynch recorded');
  perform test.ok((select ended_at from games where id = g.game_id) is not null, 'ended_at stamped');

  raise notice 't01 full flow OK';
end $$;
