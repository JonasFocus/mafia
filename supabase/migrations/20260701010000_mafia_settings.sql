alter table games add column mafia_count int not null default 1 check (mafia_count between 1 and 3);
alter table games add column show_categories boolean not null default false;

create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_category_id uuid;
  v_word_id uuid;
  v_player_count int;
  v_mafia_count int;
  v_max_mafia int;
  v_hint_order uuid[];
begin
  select host_id, category_id, mafia_count into v_host_id, v_category_id, v_mafia_count from games where id = p_game_id;

  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_host_id != auth.uid() then
    raise exception 'only the host can start the game';
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

  select array_agg(user_id order by join_order) into v_hint_order from game_players where game_id = p_game_id;

  insert into rounds (game_id, round_number, hint_order) values (p_game_id, 1, v_hint_order);

  update games set word_id = v_word_id, status = 'hint_phase', current_round = 1 where id = p_game_id;
end;
$$;

create or replace function public.resolve_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_round_number int;
  v_max_rounds int;
  v_active_count int;
  v_vote_count int;
  v_top_voted uuid;
  v_top_count int;
  v_tie_count int;
  v_remaining_mafia int;
  v_hint_order uuid[];
begin
  select r.game_id, r.round_number into v_game_id, v_round_number from rounds r where r.id = new.round_id;
  select g.max_rounds into v_max_rounds from games g where g.id = v_game_id;

  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_vote_count from votes where round_id = new.round_id;

  if v_vote_count < v_active_count then
    return new;
  end if;

  if not exists (select 1 from games where id = v_game_id and status = 'voting') then
    return new;
  end if;

  select voted_for_id, cnt into v_top_voted, v_top_count
  from (
    select voted_for_id, count(*) cnt
    from votes where round_id = new.round_id
    group by voted_for_id
    order by count(*) desc
    limit 1
  ) t;

  select count(*) into v_tie_count
  from (
    select voted_for_id from votes where round_id = new.round_id
    group by voted_for_id having count(*) = v_top_count
  ) t2;

  update games set status = 'round_result' where id = v_game_id;

  if v_tie_count > 1 then
    if v_round_number >= v_max_rounds then
      update games set status = 'game_over' where id = v_game_id;
    else
      select array_agg(user_id order by join_order) into v_hint_order
      from game_players where game_id = v_game_id and is_eliminated = false;
      insert into rounds (game_id, round_number, hint_order) values (v_game_id, v_round_number + 1, v_hint_order);
      update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
    end if;
    return new;
  end if;

  update game_players set is_eliminated = true where game_id = v_game_id and user_id = v_top_voted;

  select count(*) into v_remaining_mafia
  from game_players where game_id = v_game_id and is_outsider = true and is_eliminated = false;

  if v_remaining_mafia = 0 then
    update games set status = 'game_over' where id = v_game_id;
  elsif v_round_number >= v_max_rounds then
    update games set status = 'game_over' where id = v_game_id;
  else
    select array_agg(user_id order by join_order) into v_hint_order
    from game_players where game_id = v_game_id and is_eliminated = false;
    insert into rounds (game_id, round_number, hint_order) values (v_game_id, v_round_number + 1, v_hint_order);
    update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
  end if;

  return new;
end;
$$;
