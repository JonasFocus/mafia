import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("local migrations include the live Supabase migration history", () => {
  const ddl = read("supabase/migrations/20260704100000_big_games_and_hardening_ddl.sql");
  const functions = read("supabase/migrations/20260704100100_big_games_and_hardening_functions.sql");
  const lifecycle = read("supabase/migrations/20260705053631_lock_lifecycle_state.sql");

  assert.match(ddl, /alter type game_status add value if not exists 'lynch_result'/);
  assert.match(ddl, /games_mafia_count_check[\s\S]*mafia_count between 1 and 8/);
  assert.match(ddl, /game_players delete own row in lobby/);

  assert.match(functions, /status='lynch_result'/);
  assert.match(functions, /current_round = current_round \+ \(case when status='lynch_result' then 1 else 0 end\)/);
  assert.match(functions, /inspection already locked in tonight/);

  assert.match(lifecycle, /from games where id = p_game_id for update/);
  assert.match(lifecycle, /v_status <> 'lobby'/);
  assert.match(lifecycle, /where g\.room_code = upper\(p_room_code\)[\s\S]*for update/);
  assert.match(lifecycle, /v_remaining_mafia = 0/);
});

test("generated types and Drizzle schema model live Mafia state", () => {
  const types = read("src/lib/supabase/database.types.ts");
  const schema = read("src/lib/db/schema.ts");

  assert.match(types, /last_lynch_victim: string \| null/);
  assert.match(types, /\| "lynch_result"/);
  assert.match(types, /PostgrestVersion: "14\.5"/);

  assert.match(schema, /"lynch_result"/);
  assert.match(schema, /lastLynchVictim/);
  assert.match(schema, /export const nightActions/);
  assert.match(schema, /export const dayVotes/);
});

test("Mafia UI supports the live room cap and lynch result phase", () => {
  const lobby = read("src/components/game/LobbyScreen.tsx");
  const home = read("src/app/page.tsx");
  const settings = read("src/components/game/mafia/MafiaSettings.tsx");
  const game = read("src/components/game/mafia/MafiaGame.tsx");

  assert.match(lobby, /const maxPlayers = isMafia \? 25 : 8/);
  assert.match(home, /g\.player_count}\/{isMafia \? 25 : 8}/);
  assert.match(settings, /Array\.from\(\{ length: 8 \}/);
  assert.match(game, /game\.status === "lynch_result"/);
  assert.match(game, /LynchResultScreen/);
});
