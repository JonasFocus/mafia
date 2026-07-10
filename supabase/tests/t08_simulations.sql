-- Property-based whole-game simulations. Deterministic strategies, random role
-- deals (start_mafia_game shuffles), invariants asserted at every transition.
create or replace function test.simulate(
  p_n int, p_mafia int, p_sheriff boolean, p_angel boolean,
  p_strategy text,   -- 'lynch_mafia' | 'lynch_town'
  p_expected text)   -- expected winner
returns void language plpgsql as $$
declare
  g record; host uuid; target uuid; day_target uuid; u uuid;
  dead_before int; dead_after int; saved boolean; round_before int;
  living_mafia int; living_town int; iter int := 0;
begin
  select * into g from test.new_game('mafia', p_n, p_mafia, p_sheriff, p_angel);
  host := g.uids[1];
  perform test.act(host); perform public.start_mafia_game(g.game_id);
  perform test.act(host); perform test.begin_night(g.game_id);

  while test.status(g.game_id) <> 'game_over' loop
    iter := iter + 1;
    perform test.ok(iter <= 60, 'simulation terminates');
    round_before := test.round(g.game_id);

    -- NIGHT: angel tries to save the victim on even rounds.
    dead_before := (select count(*) from game_players where game_id = g.game_id and is_eliminated);
    target := test.play_night(g.game_id, (round_before % 2) = 0);
    saved := exists (
      select 1 from night_actions
      where game_id = g.game_id and round_number = round_before
        and action_type = 'protect' and target_id = target);
    perform test.ok(test.status(g.game_id) in ('day_result', 'game_over'), 'night resolves to day_result/game_over');
    dead_after := (select count(*) from game_players where game_id = g.game_id and is_eliminated);
    perform test.ok(dead_after - dead_before = (case when saved then 0 else 1 end),
      format('night %s kills exactly %s', round_before, case when saved then 0 else 1 end));
    perform test.ok(
      (select last_night_victim from games where id = g.game_id) is not distinct from (case when saved then null else target end),
      'last_night_victim matches the outcome');
    perform test.ok(test.round(g.game_id) = round_before, 'round stable through night resolution');
    exit when test.status(g.game_id) = 'game_over';

    -- DAY: unanimous vote by strategy.
    perform test.act(host); perform test.begin_day_vote(g.game_id);
    day_target := case when p_strategy = 'lynch_mafia'
                       then (test.living(g.game_id, 'mafia'))[1]
                       else (test.living_not(g.game_id, 'mafia'))[1] end;
    dead_before := (select count(*) from game_players where game_id = g.game_id and is_eliminated);
    foreach u in array test.living(g.game_id) loop
      perform test.vote(g.game_id, u, day_target);
    end loop;
    perform test.ok(test.status(g.game_id) in ('lynch_result', 'game_over'), 'day resolves to lynch_result/game_over');
    dead_after := (select count(*) from game_players where game_id = g.game_id and is_eliminated);
    perform test.ok(dead_after - dead_before = 1, 'unanimous day lynches exactly one');
    perform test.ok((select last_lynch_victim from games where id = g.game_id) = day_target, 'lynch victim recorded');
    perform test.ok(test.round(g.game_id) = round_before, 'round stable through day resolution');
    exit when test.status(g.game_id) = 'game_over';

    -- NEXT NIGHT: round bumps exactly once.
    perform test.act(host); perform test.begin_night(g.game_id);
    perform test.ok(test.status(g.game_id) = 'night', 'host advances to the next night');
    perform test.ok(test.round(g.game_id) = round_before + 1, 'round bumps exactly once per cycle');
  end loop;

  -- Final-board consistency: the recorded winner matches the win condition.
  living_mafia := coalesce(array_length(test.living(g.game_id, 'mafia'), 1), 0);
  living_town := coalesce(array_length(test.living_not(g.game_id, 'mafia'), 1), 0);
  perform test.ok((select winner from games where id = g.game_id) = p_expected,
    format('winner is %s (n=%s mafia=%s strat=%s)', p_expected, p_n, p_mafia, p_strategy));
  if p_expected = 'town' then
    perform test.ok(living_mafia = 0, 'town win means zero living mafia');
  else
    perform test.ok(living_mafia >= living_town, 'mafia win means parity reached');
  end if;
  perform test.ok((select ended_at from games where id = g.game_id) is not null, 'ended_at stamped');
end $$;

do $$
begin
  -- Big 25-player games, both outcomes, with and without special roles.
  perform test.simulate(25, 8, true,  true,  'lynch_mafia', 'town');
  perform test.simulate(25, 8, true,  true,  'lynch_town',  'mafia');
  perform test.simulate(25, 1, false, false, 'lynch_town',  'mafia');  -- long grind: many rounds
  raise notice 't08a big sims OK';
end $$;

-- mafia_count above 8 is refused at the constraint even for a 25-seat table.
do $$
declare v_err boolean := false;
begin
  begin
    perform test.simulate(25, 12, false, false, 'lynch_town', 'mafia');
  exception when others then
    v_err := sqlerrm like '%INVALID_MAFIA_COUNT%';
  end;
  perform test.ok(v_err, '12-mafia config refused by the 1..8 constraint');
  raise notice 't08a2 mafia cap constraint OK';
end $$;

do $$
begin
  perform test.simulate(25, 8, false, false, 'lynch_town',  'mafia');
  perform test.simulate(10, 3, true,  true,  'lynch_mafia', 'town');
  perform test.simulate(10, 4, true,  true,  'lynch_town',  'mafia');
  perform test.simulate(6,  1, true,  true,  'lynch_mafia', 'town');
  perform test.simulate(5,  2, false, false, 'lynch_mafia', 'mafia'); -- parity on night 1 beats the day vote
  perform test.simulate(5,  1, true,  true,  'lynch_mafia', 'town');
  raise notice 't08b mixed sims OK';
end $$;

-- Repeat a mid-size config several times: the deal is random each run, so this
-- shakes out role-position-dependent bugs.
do $$
begin
  for i in 1..10 loop
    perform test.simulate(9, 3, true, true, 'lynch_mafia', 'town');
    perform test.simulate(9, 3, true, true, 'lynch_town', 'mafia');
  end loop;
  raise notice 't08c repeated random deals OK (20 games)';
end $$;
