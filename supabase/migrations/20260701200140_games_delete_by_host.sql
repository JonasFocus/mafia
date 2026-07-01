-- games had no DELETE policy, so LobbyScreen's "delete room" silently removed
-- 0 rows. Host may delete their own game; child rows cascade.
create policy "games delete by host" on games
  for delete to authenticated using (host_id = (select auth.uid()));
