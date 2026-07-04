-- RLS visibility: what each seat can actually read, as role `authenticated`.
do $$
declare
  g record; host uuid; mafia uuid[]; sheriff uuid; angel uuid; faithful uuid[];
  n int; v_err boolean;
begin
  select * into g from test.new_game('mafia', 7, 2, true, true);
  host := g.uids[1];

  -- Lobby settings update by host IS allowed (and only by the host).
  perform test.act(host);
  set local role authenticated;
  update games set mafia_count = 2 where id = g.game_id;
  reset role;
  perform test.ok((select mafia_count from games where id = g.game_id) = 2, 'host updates settings in lobby');
  perform test.act(g.uids[2]);
  set local role authenticated;
  update games set mafia_count = 1 where id = g.game_id;
  reset role;
  perform test.ok((select mafia_count from games where id = g.game_id) = 2, 'non-host cannot update settings');

  perform test.act(host); perform public.start_mafia_game(g.game_id);
  mafia := test.living(g.game_id, 'mafia');
  sheriff := (test.living(g.game_id, 'sheriff'))[1];
  angel := (test.living(g.game_id, 'angel'))[1];
  faithful := test.living(g.game_id, 'faithful');
  perform test.act(host); perform public.begin_night(g.game_id);

  perform test.kill(g.game_id, mafia[1], faithful[1]);
  perform test.inspect(g.game_id, sheriff, mafia[1]);

  -- Mafia 2 sees the partner's kill row (coordination) but not the sheriff's inspect.
  perform test.act(mafia[2]);
  set local role authenticated;
  select count(*) into n from night_actions where game_id = g.game_id;
  reset role;
  perform test.ok(n = 1, 'mafia sees exactly the kill row, not the inspect');

  -- A faithful player sees no night actions at all.
  perform test.act(faithful[2]);
  set local role authenticated;
  select count(*) into n from night_actions where game_id = g.game_id;
  reset role;
  perform test.ok(n = 0, 'faithful sees no night actions');

  -- Sheriff sees own inspect row including the result.
  perform test.act(sheriff);
  set local role authenticated;
  select count(*) into n from night_actions
    where game_id = g.game_id and actor_id = sheriff and result = 'mafia';
  reset role;
  perform test.ok(n = 1, 'sheriff reads own inspect result');

  -- game_players_public: faithful viewer sees own role only; mafia viewer sees both mafia.
  perform test.act(faithful[1]);
  set local role authenticated;
  select count(*) into n from game_players_public where game_id = g.game_id and role is not null;
  reset role;
  perform test.ok(n = 1, 'faithful sees exactly one role (their own)');

  perform test.act(mafia[1]);
  set local role authenticated;
  select count(*) into n from game_players_public where game_id = g.game_id and role = 'mafia';
  reset role;
  perform test.ok(n = 2, 'mafia sees both mafia roles');

  -- Roster is fully visible to participants (definer view), 7 rows.
  perform test.act(faithful[1]);
  set local role authenticated;
  select count(*) into n from game_players_public where game_id = g.game_id;
  reset role;
  perform test.ok(n = 7, 'participant sees the whole roster');

  -- A non-participant sees nothing: not the roster, not the game row.
  perform test.act(test.mk_user('outsider'));
  set local role authenticated;
  select count(*) into n from game_players_public where game_id = g.game_id;
  perform test.ok(n = 0, 'non-participant sees empty roster');
  select count(*) into n from games where id = g.game_id;
  perform test.ok(n = 0, 'non-participant cannot read the game row');
  reset role;

  -- Direct writes to engine-owned tables are refused for clients.
  perform test.act(mafia[1]);
  set local role authenticated;
  v_err := false;
  begin
    insert into night_actions (game_id, round_number, actor_id, action_type, target_id)
    values (g.game_id, 1, mafia[1], 'kill', faithful[2]);
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'direct night_actions insert refused');
  v_err := false;
  begin
    update game_players set is_eliminated = false where game_id = g.game_id;
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'direct game_players update refused');
  v_err := false;
  begin
    update games set status = 'game_over' where id = g.game_id;
  exception when others then v_err := true;
  end;
  perform test.ok(v_err, 'direct games.status update refused');
  reset role;

  -- Finish the night, then check day-vote ballot privacy.
  perform test.kill(g.game_id, mafia[2], faithful[1]);
  perform test.protect(g.game_id, angel, angel);
  perform test.ok(test.status(g.game_id) = 'day_result', 'night resolved');
  perform test.act(host); perform public.begin_day_vote(g.game_id);
  perform test.vote(g.game_id, mafia[1], sheriff);
  perform test.vote(g.game_id, sheriff, mafia[1]);

  perform test.act(sheriff);
  set local role authenticated;
  select count(*) into n from day_votes where game_id = g.game_id;
  reset role;
  perform test.ok(n = 1, 'voter sees only their own ballot');

  -- Game over: all roles become visible to everyone in the game.
  update games set status = 'game_over', winner = 'town' where id = g.game_id;  -- direct, as postgres
  perform test.act(faithful[2]);
  set local role authenticated;
  select count(*) into n from game_players_public where game_id = g.game_id and role is not null;
  reset role;
  perform test.ok(n = 7, 'all roles revealed at game_over');

  raise notice 't04 RLS visibility OK';
end $$;
