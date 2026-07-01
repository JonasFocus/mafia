-- Let a player remove their own lobby membership (the "Leave game" action).
-- No DELETE policy existed, so RLS blocked a non-host from ever leaving.
create policy "game_players delete own row" on game_players
  for delete to authenticated using (user_id = (select auth.uid()));
