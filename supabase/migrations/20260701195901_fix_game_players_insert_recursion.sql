-- The lobby check in "game_players insert self in lobby" referenced games,
-- whose SELECT policy references game_players — Postgres reports infinite
-- recursion (42P17) and every client insert (game creation) fails.
-- Use a SECURITY DEFINER helper so the status lookup bypasses RLS.
create or replace function public._game_status(p_game_id uuid)
returns game_status
language sql
stable
security definer
set search_path = public
as $$
  select status from games where id = p_game_id;
$$;
revoke execute on function public._game_status(uuid) from public, anon;
grant execute on function public._game_status(uuid) to authenticated;

drop policy "game_players insert self in lobby" on game_players;
create policy "game_players insert self in lobby" on game_players
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public._game_status(game_id) = 'lobby'
  );
