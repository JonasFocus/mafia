-- now() is frozen per-transaction, so a join+touch in the same transaction as
-- game creation produced no visible change. clock_timestamp() always advances,
-- guaranteeing the games UPDATE (and its realtime event) actually fires.
create or replace function public._touch_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update games set updated_at = clock_timestamp() where id = coalesce(new.game_id, old.game_id);
  return coalesce(new, old);
end;
$$;
