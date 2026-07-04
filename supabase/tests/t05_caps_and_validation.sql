-- Capacity caps, start validation, and wrong-mode guards.
do $$
declare
  g record; extra uuid; i int; v_err boolean; code text;
begin
  -- Mafia room: 25 join fine, the 26th is refused.
  select * into g from test.new_game('mafia', 25, 8, true, true);
  perform test.ok((select count(*) from game_players where game_id = g.game_id) = 25, '25 players joined');
  extra := test.mk_user('p26');
  perform test.act(extra);
  v_err := false;
  begin
    perform public.join_game((select room_code from games where id = g.game_id));
  exception when others then
    v_err := true;
    perform test.ok(sqlerrm like '%full%', '26th gets room-full: ' || sqlerrm);
  end;
  perform test.ok(v_err, '26th player refused');

  -- Start the 25-player game with 8 mafia: role math holds.
  perform test.act(g.uids[1]);
  perform public.start_mafia_game(g.game_id);
  perform test.ok(array_length(test.living(g.game_id, 'mafia'), 1) = 8, '8 mafia dealt');
  perform test.ok(array_length(test.living(g.game_id, 'sheriff'), 1) = 1, 'one sheriff in a big game');
  perform test.ok(array_length(test.living(g.game_id, 'angel'), 1) = 1, 'one angel in a big game');
  perform test.ok(array_length(test.living(g.game_id, 'faithful'), 1) = 15, '15 faithful in a big game');

  -- Re-entry: an existing player can re-join a running game (reload path).
  perform test.act(g.uids[5]);
  perform public.join_game((select room_code from games where id = g.game_id));
  perform test.ok((select count(*) from game_players where game_id = g.game_id) = 25, 're-entry does not duplicate');

  -- A new player cannot join a running game.
  perform test.act(extra);
  v_err := false;
  begin
    perform public.join_game((select room_code from games where id = g.game_id));
  exception when others then
    v_err := true;
    perform test.ok(sqlerrm like '%already started%', 'late joiner refused: ' || sqlerrm);
  end;
  perform test.ok(v_err, 'no joining mid-game');
  raise notice 't05a caps 25 OK';
end $$;

do $$
declare g record; extra uuid; v_err boolean;
begin
  -- Chameleon room still caps at 8.
  select * into g from test.new_game('chameleon', 8, 1, true, true);
  extra := test.mk_user('c9');
  perform test.act(extra);
  v_err := false;
  begin
    perform public.join_game((select room_code from games where id = g.game_id));
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'chameleon 9th player refused');

  -- Wrong-mode starts are refused both ways.
  perform test.act(g.uids[1]);
  v_err := false;
  begin
    perform public.start_mafia_game(g.game_id);
  exception when others then
    v_err := true;
    perform test.ok(sqlerrm like '%not a mafia game%', 'mafia start on chameleon refused');
  end;
  perform test.ok(v_err, 'start_mafia_game rejects chameleon lobby');
  perform test.ok(test.status(g.game_id) = 'lobby', 'chameleon lobby untouched');

  -- Chameleon start still works (regression) and rejects the other mode.
  perform public.start_game(g.game_id);
  perform test.ok(test.status(g.game_id) = 'hint_phase', 'chameleon start works');
  raise notice 't05b chameleon cap + mode guards OK';
end $$;

do $$
declare g record; v_err boolean;
begin
  select * into g from test.new_game('mafia', 5, 2, true, true);
  perform test.act(g.uids[1]);
  v_err := false;
  begin
    perform public.start_game(g.game_id);
  exception when others then
    v_err := true;
    perform test.ok(sqlerrm like '%not a chameleon game%', 'chameleon start on mafia refused');
  end;
  perform test.ok(v_err, 'start_game rejects mafia lobby');

  -- 5 players with 2 mafia + sheriff + angel needs exactly 5 -> allowed, 1 faithful.
  perform public.start_mafia_game(g.game_id);
  perform test.ok(array_length(test.living(g.game_id, 'faithful'), 1) = 1, 'tightest legal role config deals 1 faithful');
  raise notice 't05c tight config OK';
end $$;

do $$
declare g record; v_err boolean;
begin
  -- Too few players.
  select * into g from test.new_game('mafia', 4, 1, false, false);
  perform test.act(g.uids[1]);
  v_err := false;
  begin perform public.start_mafia_game(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'under 5 players refused');

  -- Too many mafia for the table.
  select * into g from test.new_game('mafia', 5, 3, false, false);
  perform test.act(g.uids[1]);
  v_err := false;
  begin perform public.start_mafia_game(g.game_id);
  exception when others then
    v_err := true;
    perform test.ok(sqlerrm like '%too many mafia%', 'mafia majority refused');
  end;
  perform test.ok(v_err, '3 mafia in a 5-seat game refused');

  -- Roles need more players than present: 5 seats, 3 mafia impossible already;
  -- try 6 seats, 3 mafia + sheriff + angel -> need 6, allowed; 5 seats need 6 -> refused.
  select * into g from test.new_game('mafia', 5, 2, true, true);
  update games set mafia_count = 3 where id = g.game_id; -- as postgres, bypass client rules
  perform test.act(g.uids[1]);
  v_err := false;
  begin perform public.start_mafia_game(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'role demand beyond table size refused');

  -- Non-host cannot start; nobody can start twice.
  select * into g from test.new_game('mafia', 5, 1, false, false);
  perform test.act(g.uids[2]);
  v_err := false;
  begin perform public.start_mafia_game(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'non-host start refused');
  perform test.act(g.uids[1]);
  perform public.start_mafia_game(g.game_id);
  v_err := false;
  begin perform public.start_mafia_game(g.game_id);
  exception when others then v_err := true; end;
  perform test.ok(v_err, 'double start refused');

  -- mafia_count constraint: 9 is out of range.
  v_err := false;
  begin
    update games set mafia_count = 9 where id = g.game_id;
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'mafia_count > 8 violates the check constraint');

  raise notice 't05d validations OK';
end $$;
