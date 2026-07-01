-- Checked in from the live DB (applied out-of-band on 2026-07-01).
create policy "game_players delete own row" on game_players
  for delete to authenticated using (user_id = (select auth.uid()));
