-- Production-readiness phase labels must commit before the following schema and
-- function migrations reference them. The local engine runner applies every
-- migration in its own transaction for this reason.
alter type public.game_status add value if not exists 'chameleon_tie_break';
alter type public.game_status add value if not exists 'chameleon_guess';
