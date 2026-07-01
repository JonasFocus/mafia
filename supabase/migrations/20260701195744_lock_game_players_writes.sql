-- game_players holds engine-owned state (role, is_outsider, is_eliminated).
-- The old "update by host or self" policy let any player rewrite their own role
-- or un-eliminate themselves from devtools, and let the host rewrite anyone's row.
-- All legitimate writes to these columns happen inside SECURITY DEFINER functions
-- (start_game, start_mafia_game, resolve_night, resolve_day, resolve_votes),
-- which bypass RLS and grants entirely — so clients need no UPDATE path at all.
drop policy "game_players update by host or self" on game_players;

-- Belt and braces: column-level privileges so even a future permissive policy
-- can't expose the sensitive columns. Clients may only insert the join tuple.
revoke insert, update on game_players from authenticated, anon;
grant insert (game_id, user_id, join_order) on game_players to authenticated;

-- Self-insert is only valid while the game is in the lobby (host creating their
-- own row; joiners go through the join_game definer RPC which bypasses this).
-- NOTE: the games subquery here recurses (games RLS references game_players);
-- fixed in 20260701195901_fix_game_players_insert_recursion.
drop policy "game_players insert self" on game_players;
create policy "game_players insert self in lobby" on game_players
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from games g where g.id = game_id and g.status = 'lobby')
  );
