#!/bin/bash
# True concurrency: two separate connections fire the final two submissions at
# the same time. The FOR UPDATE serialization must produce exactly one
# resolution — no stall (stuck in day_vote/night) and no double-kill.
set -e
PG=${PGBIN:-/usr/lib/postgresql/16/bin}
: "${PGHOST:?set by run.sh}"; export PGPORT=${PGPORT:-55432} PGUSER=${PGUSER:-postgres}

for i in $(seq 1 8); do
  # Set up a 5-player game (1 mafia, no extras), play the night, cast 2 of 4
  # living day votes; the last two ballots race below.
  eval "$($PG/psql -d mafia -Atq -c "
    do \$\$
    declare g record; host uuid; mafia uuid; town uuid[]; living uuid[];
    begin
      select * into g from test.new_game('mafia', 5, 1, false, false);
      host := g.uids[1];
      perform test.act(host); perform public.start_mafia_game(g.game_id);
      mafia := (test.living(g.game_id, 'mafia'))[1];
      town := test.living_not(g.game_id, 'mafia');
      perform test.act(host); perform public.begin_night(g.game_id);
      perform test.kill(g.game_id, mafia, town[1]);
      perform test.act(host); perform public.begin_day_vote(g.game_id);
      living := test.living(g.game_id);
      -- first two living vote for the mafia; the last two are cast concurrently below
      perform test.vote(g.game_id, living[1], mafia);
      perform test.vote(g.game_id, living[2], mafia);
      create temp table if not exists race (gid uuid, a uuid, b uuid, tgt uuid);
      truncate race;
      insert into race values (g.game_id, living[3], living[4], mafia);
    end \$\$;
    select format('GID=%s VA=%s VB=%s TARGET=%s', gid, a, b, tgt) from race;")"

  # Fire the last two ballots from two independent connections simultaneously.
  $PG/psql -d mafia -Atq -c "select test.act('$VA'); select public.cast_day_vote('$GID','$TARGET');" &
  P1=$!
  $PG/psql -d mafia -Atq -c "select test.act('$VB'); select public.cast_day_vote('$GID','$TARGET');" &
  P2=$!
  wait $P1 $P2

  $PG/psql -d mafia -v ON_ERROR_STOP=1 -Atq -c "
    do \$\$ begin
      perform test.ok((select status from games where id='$GID') in ('lynch_result','game_over'),
        'race iteration resolved (no stall), got ' || (select status from games where id='$GID'));
      perform test.ok((select count(*) from game_players where game_id='$GID' and is_eliminated) = 2,
        'exactly night victim + lynch victim eliminated');
      perform test.ok((select last_lynch_victim from games where id='$GID') = '$TARGET',
        'lynch victim recorded once');
    end \$\$;"
  echo "race iteration $i OK"
done

# Same race on the night side: the last two mafia kills land simultaneously.
for i in $(seq 1 8); do
  eval "$($PG/psql -d mafia -Atq -c "
    do \$\$
    declare g record; host uuid; mafia uuid[]; town uuid[];
    begin
      select * into g from test.new_game('mafia', 6, 2, false, false);
      host := g.uids[1];
      perform test.act(host); perform public.start_mafia_game(g.game_id);
      mafia := test.living(g.game_id, 'mafia');
      town := test.living_not(g.game_id, 'mafia');
      perform test.act(host); perform public.begin_night(g.game_id);
      create temp table if not exists race2 (gid uuid, a uuid, b uuid, tgt uuid);
      truncate race2;
      insert into race2 values (g.game_id, mafia[1], mafia[2], town[1]);
    end \$\$;
    select format('GID=%s VA=%s VB=%s TARGET=%s', gid, a, b, tgt) from race2;")"

  $PG/psql -d mafia -Atq -c "select test.act('$VA'); select public.submit_night_action('$GID','kill','$TARGET');" &
  P1=$!
  $PG/psql -d mafia -Atq -c "select test.act('$VB'); select public.submit_night_action('$GID','kill','$TARGET');" &
  P2=$!
  wait $P1 $P2

  $PG/psql -d mafia -v ON_ERROR_STOP=1 -Atq -c "
    do \$\$ begin
      perform test.ok((select status from games where id='$GID') = 'day_result',
        'night race resolved, got ' || (select status from games where id='$GID'));
      perform test.ok((select count(*) from game_players where game_id='$GID' and is_eliminated) = 1,
        'exactly one night victim');
      perform test.ok((select last_night_victim from games where id='$GID') = '$TARGET',
        'victim recorded');
    end \$\$;"
  echo "night race iteration $i OK"
done
echo "CONCURRENCY TESTS PASSED"
