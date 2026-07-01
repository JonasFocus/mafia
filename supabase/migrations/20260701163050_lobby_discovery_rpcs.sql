-- Checked in from the live DB (applied out-of-band on 2026-07-01).
-- list_open_games: public lobby discovery. join_game: SECURITY DEFINER join that
-- works before the joiner can pass games/game_players RLS (room lookup + capacity
-- check + insert in one place). Superseded by 20260701191437_join_game_reentry.
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

grant execute on function public.join_game(text) to authenticated;
