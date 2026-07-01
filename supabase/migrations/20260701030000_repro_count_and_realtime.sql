-- Reproducibility backfill.
--
-- count_game_players() and the realtime publication membership were created by
-- hand in the live project and were absent from migrations, so a fresh `db reset`
-- broke joining (joinGame calls this RPC) and in-game realtime. This restores both
-- idempotently: no-op against the live project, correct on a clean reset.

create or replace function public.count_game_players(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int from game_players where game_id = p_game_id;
$$;

-- Add the game tables to the realtime publication only when not already members.
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
