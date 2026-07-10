-- Angel saves, tied day votes, and the mafia parity win.
do $$
declare
  g record; host uuid; mafia uuid; sheriff uuid; angel uuid; faithful uuid[]; alive uuid[];
begin
  -- 6 players: 1 mafia + sheriff + angel + 3 faithful.
  select * into g from test.new_game('mafia', 6, 1, true, true);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := (test.living(g.game_id, 'mafia'))[1];
  sheriff := (test.living(g.game_id, 'sheriff'))[1];
  angel := (test.living(g.game_id, 'angel'))[1];
  faithful := test.living(g.game_id, 'faithful');
  perform test.act(host); perform test.begin_night(g.game_id);

  -- Night 1: angel protects exactly the kill target -> nobody dies.
  perform test.kill(g.game_id, mafia, faithful[1]);
  perform test.inspect(g.game_id, sheriff, faithful[2]);
  perform test.protect(g.game_id, angel, faithful[1]);
  perform test.ok(test.status(g.game_id) = 'day_result', 'saved night still resolves');
  perform test.ok((select last_night_victim from games where id = g.game_id) is null, 'no victim when angel saves');
  perform test.ok(not (select is_eliminated from game_players where game_id = g.game_id and user_id = faithful[1]), 'target survives the save');
  perform test.ok((select count(*) from game_players where game_id = g.game_id and is_eliminated) = 0, 'nobody eliminated');

  -- Day 1: 6 alive, 3v3 tie -> no lynch.
  perform test.act(host); perform test.begin_day_vote(g.game_id);
  perform test.vote(g.game_id, mafia, faithful[1]);
  perform test.vote(g.game_id, faithful[2], faithful[1]);
  perform test.vote(g.game_id, faithful[3], faithful[1]);
  perform test.vote(g.game_id, sheriff, mafia);
  perform test.vote(g.game_id, angel, mafia);
  perform test.vote(g.game_id, faithful[1], mafia);
  perform test.ok(test.status(g.game_id) = 'lynch_result', 'tie still lands on lynch_result');
  perform test.ok((select last_lynch_victim from games where id = g.game_id) is null, 'tie records no lynch victim');
  perform test.ok((select count(*) from game_players where game_id = g.game_id and is_eliminated) = 0, 'tie eliminates nobody');

  -- Vote-change before resolution: re-cast overwrites (exercised implicitly by upsert path in t06 too).
  perform test.act(host); perform test.begin_night(g.game_id);
  perform test.ok(test.round(g.game_id) = 2, 'round 2 after tie day');

  raise notice 't02a saves+ties OK';
end $$;

-- Parity: 5 players, 2 mafia, no sheriff/angel. One night kill reaches 2v2 -> mafia win.
do $$
declare g record; host uuid; mafia uuid[]; town uuid[];
begin
  select * into g from test.new_game('mafia', 5, 2, false, false);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  perform test.ok(array_length(test.living(g.game_id, 'faithful'), 1) = 3, 'no sheriff/angel dealt when disabled');
  mafia := test.living(g.game_id, 'mafia');
  town := test.living_not(g.game_id, 'mafia');
  perform test.act(host); perform test.begin_night(g.game_id);

  perform test.kill(g.game_id, mafia[1], town[1]);
  perform test.ok(test.status(g.game_id) = 'night', 'waits for second mafia');
  perform test.kill(g.game_id, mafia[2], town[1]);

  perform test.ok(test.status(g.game_id) = 'game_over', 'parity ends the game at night resolution');
  perform test.ok((select winner from games where id = g.game_id) = 'mafia', 'mafia wins at parity');
  perform test.ok((select last_night_victim from games where id = g.game_id) = town[1], 'final victim recorded');
  raise notice 't02b parity OK';
end $$;

-- Split mafia kill votes: plurality target dies (2 of 3 mafia agree).
do $$
declare g record; host uuid; mafia uuid[]; town uuid[];
begin
  select * into g from test.new_game('mafia', 9, 3, false, false);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  town := test.living_not(g.game_id, 'mafia');
  perform test.act(host); perform test.begin_night(g.game_id);
  perform test.kill(g.game_id, mafia[1], town[1]);
  perform test.kill(g.game_id, mafia[2], town[2]);
  perform test.kill(g.game_id, mafia[3], town[1]);
  perform test.ok(test.status(g.game_id) = 'day_result', 'split-vote night resolves');
  perform test.ok((select last_night_victim from games where id = g.game_id) = town[1], 'plurality kill target dies');
  raise notice 't02c mafia plurality OK';
end $$;
