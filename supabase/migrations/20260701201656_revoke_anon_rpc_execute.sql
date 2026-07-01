-- Advisor cleanup: join_game and count_game_players were executable by anon.
-- Both are meaningless without a session (join_game raises on null auth.uid());
-- revoke anyway to shrink the anonymous surface. list_open_games stays
-- anon-executable on purpose (pre-auth lobby discovery).
revoke execute on function public.join_game(text) from anon;
revoke execute on function public.count_game_players(uuid) from anon;
