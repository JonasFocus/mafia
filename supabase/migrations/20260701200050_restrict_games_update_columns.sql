-- The host-only UPDATE policy was row-scoped but not column-scoped: a host could
-- set status='game_over'/winner directly (force-revealing all roles via
-- game_players_public) or swap word_id mid-game, bypassing the RPC state machine.
-- Clients only legitimately update lobby settings (updateGameSettings), so scope
-- the UPDATE privilege to those columns. Engine transitions happen in SECURITY
-- DEFINER functions and are unaffected.
revoke update on games from authenticated, anon;
grant update (category_id, mafia_count, show_categories, sheriff_enabled, angel_enabled, reveal_role_on_death, max_rounds)
  on games to authenticated;
