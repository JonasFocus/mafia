-- Only the designated host heartbeat invalidates the shared game snapshot.
-- Guests still refresh their own membership timestamp without causing N-player
-- realtime fan-out, while every participant receives authoritative host
-- freshness often enough to expose takeover controls at the 120-second mark.
create or replace function public.heartbeat_game(p_game_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_host_id uuid;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;

  select coalesce(g.dealer_id, g.host_id)
  into v_host_id
  from public.games g
  where g.id = p_game_id;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;

  update public.game_players
  set last_seen_at = v_now
  where game_id = p_game_id and user_id = v_uid;
  if not found then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;

  if v_uid = v_host_id then
    update public.games
    set updated_at = v_now
    where games.id = p_game_id;
  end if;

  return v_now;
end;
$$;

revoke execute on function public.heartbeat_game(uuid)
  from public, anon;
grant execute on function public.heartbeat_game(uuid)
  to authenticated;
