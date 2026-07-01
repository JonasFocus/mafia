-- Realtime delivers postgres_changes only for rows the subscriber's SELECT RLS
-- allows. game_players is own-row-only, so nobody ever received another
-- player's INSERT/DELETE — new joiners never appeared in the lobby without a
-- manual reload. Instead of loosening RLS, touch the games row (readable by
-- all participants) whenever membership changes; both hooks already refetch
-- players on any games event.
-- NOTE: now() here is replaced with clock_timestamp() in
-- 20260701200637_touch_game_clock_timestamp (now() is frozen per-transaction).
alter table games add column if not exists updated_at timestamptz not null default now();

create or replace function public._touch_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update games set updated_at = now() where id = coalesce(new.game_id, old.game_id);
  return coalesce(new, old);
end;
$$;
revoke execute on function public._touch_game() from public, anon, authenticated;

drop trigger if exists game_players_touch_game on game_players;
create trigger game_players_touch_game
after insert or delete on game_players
for each row execute function public._touch_game();
