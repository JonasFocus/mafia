import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env.local")) return "";

  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return "";
}

const databaseUrl = loadDatabaseUrl();

test("live database functions enforce lifecycle contracts", { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql`
      select proname, pg_get_functiondef(p.oid) as definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and proname in ('start_game', 'join_game', 'force_advance_phase')
    `;
    const definitions = new Map(rows.map((row) => [row.proname, row.definition]));

    assert.match(definitions.get("start_game") ?? "", /for update/);
    assert.match(definitions.get("start_game") ?? "", /v_status <> 'lobby'/);
    assert.match(definitions.get("join_game") ?? "", /for update/);
    assert.match(definitions.get("join_game") ?? "", /case when v_game\.game_mode = 'mafia' then 25 else 8 end/);
    assert.match(definitions.get("force_advance_phase") ?? "", /v_remaining_mafia = 0/);
  } finally {
    await sql.end();
  }
});
