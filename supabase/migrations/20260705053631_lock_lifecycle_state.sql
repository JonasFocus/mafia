-- Finish lifecycle hardening for untrusted browser clients.
-- The game row is the serialization point for lobby joins and phase starts.

create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_category_id uuid;
  v_status game_status;
  v_mode text;
  v_word_id uuid;
  v_player_count int;
  v_mafia_count int;
  v_max_mafia int;
  v_hint_order uuid[];
begin
  select host_id, category_id, status, game_mode, mafia_count
    into v_host_id, v_category_id, v_status, v_mode, v_mafia_count
  from games where id = p_game_id for update;

  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_host_id != auth.uid() then
    raise exception 'only the host can start the game';
  end if;
  if v_status <> 'lobby' then
    raise exception 'game already started';
  end if;
  if v_mode <> 'chameleon' then
    raise exception 'not a chameleon game';
  end if;

  select count(*) into v_player_count from game_players where game_id = p_game_id;
  if v_player_count < 4 then
    raise exception 'need at least 4 players';
  end if;
  if v_player_count > 8 then
    raise exception 'max 8 players';
  end if;

  v_max_mafia := (v_player_count - 1) / 2;
  if v_mafia_count > v_max_mafia then
    raise exception 'too many mafia for % players (max %)', v_player_count, v_max_mafia;
  end if;

  select id into v_word_id from words where category_id = v_category_id order by random() limit 1;
  if v_word_id is null then
    raise exception 'category has no words';
  end if;

  update game_players set is_outsider = false where game_id = p_game_id;
  update game_players set is_outsider = true where id in (
    select id from game_players where game_id = p_game_id order by random() limit v_mafia_count
  );

  select array_agg(user_id order by join_order) into v_hint_order
  from game_players where game_id = p_game_id;

  insert into rounds (game_id, round_number, hint_order) values (p_game_id, 1, v_hint_order);

  update games set word_id = v_word_id, status = 'hint_phase', current_round = 1 where id = p_game_id;
end;
$$;

revoke execute on function public.start_game(uuid) from public, anon;
grant execute on function public.start_game(uuid) to authenticated;

create or replace function public.join_game(p_room_code text)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_count int;
  v_cap int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You need a session to join' using errcode = '28000';
  end if;

  select * into v_game
  from games g
  where g.room_code = upper(p_room_code)
  for update;
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

  v_cap := case when v_game.game_mode = 'mafia' then 25 else 8 end;
  select count(*)::int into v_count from game_players gp where gp.game_id = v_game.id;
  if v_count >= v_cap then
    raise exception 'This room is full' using errcode = 'P0001';
  end if;

  insert into game_players (game_id, user_id, join_order)
  values (v_game.id, v_uid, v_count);

  return query select v_game.id, v_game.room_code, v_game.game_mode;
end;
$$;

revoke execute on function public.join_game(text) from public;
grant execute on function public.join_game(text) to authenticated;

create or replace function public.force_advance_phase(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_status game_status;
  v_round_id uuid;
  v_round_number int;
  v_max_rounds int;
  v_top_voted uuid;
  v_top_count int;
  v_tie_count int;
  v_remaining_mafia int;
  v_hint_order uuid[];
begin
  select host_id, status into v_host, v_status from games where id = p_game_id for update;
  if v_host is null then raise exception 'game not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can advance the phase'; end if;

  if v_status = 'night' then
    perform public.resolve_night(p_game_id);
  elsif v_status = 'day_vote' then
    perform public.resolve_day(p_game_id);
  elsif v_status = 'hint_phase' then
    update games set status = 'voting' where id = p_game_id and status = 'hint_phase';
  elsif v_status = 'voting' then
    select id, round_number into v_round_id, v_round_number
      from rounds where game_id = p_game_id order by round_number desc limit 1;
    select max_rounds into v_max_rounds from games where id = p_game_id;

    select voted_for_id, cnt into v_top_voted, v_top_count
      from (select voted_for_id, count(*) cnt from votes where round_id = v_round_id
            group by voted_for_id order by count(*) desc limit 1) t;

    select count(*) into v_tie_count
      from (select voted_for_id from votes where round_id = v_round_id
            group by voted_for_id having count(*) = v_top_count) t2;

    update games set status = 'round_result' where id = p_game_id;

    if v_top_voted is null or v_tie_count > 1 then
      if v_round_number >= v_max_rounds then
        update games set status = 'game_over' where id = p_game_id;
      else
        select array_agg(user_id order by join_order) into v_hint_order
          from game_players where game_id = p_game_id and is_eliminated = false;
        insert into rounds (game_id, round_number, hint_order)
          values (p_game_id, v_round_number + 1, v_hint_order);
        update games set current_round = v_round_number + 1, status = 'hint_phase' where id = p_game_id;
      end if;
      return;
    end if;

    update game_players set is_eliminated = true where game_id = p_game_id and user_id = v_top_voted;

    select count(*) into v_remaining_mafia
    from game_players where game_id = p_game_id and is_outsider = true and is_eliminated = false;

    if v_remaining_mafia = 0 or v_round_number >= v_max_rounds then
      update games set status = 'game_over' where id = p_game_id;
    else
      select array_agg(user_id order by join_order) into v_hint_order
        from game_players where game_id = p_game_id and is_eliminated = false;
      insert into rounds (game_id, round_number, hint_order)
        values (p_game_id, v_round_number + 1, v_hint_order);
      update games set current_round = v_round_number + 1, status = 'hint_phase' where id = p_game_id;
    end if;
  else
    raise exception 'cannot advance from this phase';
  end if;
end;
$$;

revoke execute on function public.force_advance_phase(uuid) from public, anon;
grant execute on function public.force_advance_phase(uuid) to authenticated;
