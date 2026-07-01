-- Host-only recovery from a stalled phase. Every phase transition otherwise
-- waits for ALL living players to submit, so one player closing their tab or
-- losing signal freezes everyone forever. This lets the host resolve the current
-- phase with whatever has been submitted so far.
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
  v_is_outsider boolean;
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
    -- Same tally as the resolve_votes trigger, run against whatever votes exist.
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
      -- no votes or a tie: no elimination this round
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

    select is_outsider into v_is_outsider from game_players where game_id = p_game_id and user_id = v_top_voted;
    update game_players set is_eliminated = true where game_id = p_game_id and user_id = v_top_voted;

    if v_is_outsider or v_round_number >= v_max_rounds then
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
