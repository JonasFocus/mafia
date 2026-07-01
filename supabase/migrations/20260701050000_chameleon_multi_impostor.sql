-- Make the chameleon "Mafia count" setting real: assign games.mafia_count
-- impostors instead of always exactly one. The vote-resolution logic and the
-- results screen already treat "impostors win if any survive", and the word RLS
-- hides the word from every outsider, so multiple impostors is fully supported.
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
  v_outsider_ids uuid[];
  v_hint_order uuid[];
begin
  select host_id, category_id, mafia_count
    into v_host_id, v_category_id, v_mafia_count
  from games where id = p_game_id;

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

  select id into v_word_id from words where category_id = v_category_id order by random() limit 1;
  if v_word_id is null then
    raise exception 'category has no words';
  end if;

  -- at least one impostor, and always leave at least one non-impostor
  v_mafia_count := greatest(1, least(coalesce(v_mafia_count, 1), v_player_count - 1));

  select array_agg(user_id) into v_outsider_ids
  from (
    select user_id from game_players where game_id = p_game_id order by random() limit v_mafia_count
  ) t;

  update game_players set is_outsider = (user_id = any(v_outsider_ids)) where game_id = p_game_id;

  select array_agg(user_id order by join_order) into v_hint_order
  from game_players where game_id = p_game_id;

  insert into rounds (game_id, round_number, hint_order) values (p_game_id, 1, v_hint_order);

  update games set word_id = v_word_id, status = 'hint_phase', current_round = 1 where id = p_game_id;
end;
$$;

revoke execute on function public.start_game(uuid) from public, anon;
grant execute on function public.start_game(uuid) to authenticated;
