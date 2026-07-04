#!/bin/bash
# Engine test suite for the Postgres game logic. Spins up a throwaway local
# Postgres 16 cluster, applies a minimal Supabase shim (auth.uid() reads the
# request.jwt.claim.sub GUC), applies ALL migrations in order, then runs every
# t*.sql scenario plus the t09 concurrency races.
#
#   PGBIN=/usr/lib/postgresql/16/bin ./supabase/tests/run.sh
#
# Needs the postgres server binaries; must run as (or be able to su to) a
# non-root user for initdb. Everything lives under a temp dir and is destroyed
# on exit.
set -euo pipefail
cd "$(dirname "$0")"

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
export PGPORT=${PGPORT:-55432} PGUSER=postgres
WORK=$(mktemp -d)
export PGHOST=$WORK

RUNAS=""
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$WORK"
  RUNAS="su postgres -c"
fi

cleanup() {
  if [ -n "$RUNAS" ]; then $RUNAS "$PGBIN/pg_ctl -D $WORK/data stop -m immediate" || true
  else "$PGBIN/pg_ctl" -D "$WORK/data" stop -m immediate || true; fi
  rm -rf "$WORK"
}
trap cleanup exit

if [ -n "$RUNAS" ]; then
  $RUNAS "$PGBIN/initdb -D $WORK/data -U postgres --auth=trust -E UTF8" >/dev/null
  $RUNAS "$PGBIN/pg_ctl -D $WORK/data -o '-p $PGPORT -k $WORK -c listen_addresses='' ' -l $WORK/log start"
else
  "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
  "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PGPORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start
fi

PSQL="$PGBIN/psql -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "create database mafia"
$PSQL -d mafia -f 00_supabase_shim.sql

for f in ../migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  $PSQL -d mafia --single-transaction -f "$f"
done

for f in t0[0-8]*.sql; do
  echo "=== $f"
  $PSQL -d mafia -f "$f"
done

echo "=== t09_concurrency.sh"
PGBIN=$PGBIN ./t09_concurrency.sh

echo "ALL ENGINE TESTS PASSED"
