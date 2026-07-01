-- Checked in from the live DB (applied out-of-band on 2026-07-01).
-- count_game_players: lets a not-yet-joined client check room capacity, since
-- game_players/games RLS hides rows from non-participants.
create or replace function public.count_game_players(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int from game_players where game_id = p_game_id;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['games', 'game_players', 'rounds', 'hints_given', 'votes', 'night_actions', 'day_votes']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
