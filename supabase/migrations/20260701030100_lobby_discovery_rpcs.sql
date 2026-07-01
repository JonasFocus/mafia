-- Lobby discovery + safe join-by-code.
--
-- The base `games` SELECT policy ("games readable by participants") only exposes
-- a row to the host or an existing player, so a first-time joiner's client-side
-- lookup by room_code returns null ("Room not found") and the share-a-code -> join
-- flow is dead on any RLS-enabled instance. It also blocks a public lobby list.
--
-- These SECURITY DEFINER RPCs are the ONLY sanctioned read path for lobby
-- discovery and join, so we never loosen the policy that also guards mid-game
-- word/role secrecy.

-- Public list for the home-screen "active games" list. Exposes only
-- non-sensitive columns and hides abandoned lobbies (no TTL/cleanup exists yet).
create or replace function public.list_open_games()
returns table (
  room_code text,
  host_name text,
  player_count int,
  game_mode text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    g.room_code,
    u.display_name as host_name,
    (select count(*)::int from game_players gp where gp.game_id = g.id) as player_count,
    g.game_mode,
    g.created_at
  from games g
  join users u on u.id = g.host_id
  where g.status = 'lobby'
    and g.created_at > now() - interval '2 hours'
  order by g.created_at desc
  limit 50;
$$;

grant execute on function public.list_open_games() to anon, authenticated;

-- Atomic join-by-code. Validates existence, lobby status, and capacity, then
-- inserts the caller's player row using their own auth.uid(). Idempotent if the
-- caller is already in the game. Returns enough to route into /game/[roomCode].
create or replace function public.join_game(p_room_code text)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_game games%rowtype;
  v_count int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You need a session to join' using errcode = '28000';
  end if;

  select * into v_game from games g where g.room_code = upper(p_room_code) limit 1;

  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'This game has already started' using errcode = 'P0001';
  end if;

  -- Idempotent: already a member, just return the game.
  if exists (select 1 from game_players gp where gp.game_id = v_game.id and gp.user_id = v_uid) then
    return query select v_game.id, v_game.room_code, v_game.game_mode;
    return;
  end if;

  select count(*)::int into v_count from game_players gp where gp.game_id = v_game.id;
  if v_count >= 8 then
    raise exception 'This room is full' using errcode = 'P0001';
  end if;

  insert into game_players (game_id, user_id, join_order)
  values (v_game.id, v_uid, v_count);

  return query select v_game.id, v_game.room_code, v_game.game_mode;
end;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default; lock join_game to signed-in
-- users only (the body also rejects a null auth.uid(), so anon calls just error).
revoke execute on function public.join_game(text) from public;
grant execute on function public.join_game(text) to authenticated;
