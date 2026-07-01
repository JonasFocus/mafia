-- Checked in from the live DB (applied out-of-band on 2026-07-01).
-- join_game now lets an existing player re-enter after the game has started.
create or replace function public.join_game(p_room_code text)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path = public
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

  if exists (select 1 from game_players gp where gp.game_id = v_game.id and gp.user_id = v_uid) then
    return query select v_game.id, v_game.room_code, v_game.game_mode;
    return;
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'This game has already started' using errcode = 'P0001';
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

revoke execute on function public.join_game(text) from public;
grant execute on function public.join_game(text) to authenticated;
