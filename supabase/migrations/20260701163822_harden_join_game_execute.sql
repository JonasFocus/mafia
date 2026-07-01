-- Checked in from the live DB (applied out-of-band on 2026-07-01).
revoke execute on function public.join_game(text) from public;
grant execute on function public.join_game(text) to authenticated;
