-- DayResultScreen derived "who died last night" by diffing the cumulative
-- eliminated list against a sessionStorage snapshot — lost storage (iOS Safari
-- backgrounding, reopened link) showed "No one died" over real deaths.
-- Record the victim authoritatively on the games row instead (participants can
-- already read it; who died is public information each morning).
alter table games add column if not exists last_night_victim uuid references users(id) on delete set null;

create or replace function public.resolve_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_target uuid; v_winner text; v_killed boolean := false;
begin
  select current_round into v_round from games
    where id=p_game_id and status='night' for update;
  if v_round is null then return; end if;  -- already resolved or not night

  select target_id into v_target from (
    select target_id, count(*) cnt from night_actions
    where game_id=p_game_id and round_number=v_round and action_type='kill'
    group by target_id order by count(*) desc, random() limit 1) t;

  -- kill unless the target was protected (set-membership; supports any number of protectors)
  if v_target is not null and not exists (
    select 1 from night_actions
    where game_id=p_game_id and round_number=v_round
      and action_type='protect' and target_id=v_target
  ) then
    update game_players set is_eliminated=true
      where game_id=p_game_id and user_id=v_target;
    v_killed := true;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update games set status='game_over', winner=v_winner, ended_at=now(),
        last_night_victim = case when v_killed then v_target end
      where id=p_game_id;
  else
    update games set status='day_result',
        last_night_victim = case when v_killed then v_target end
      where id=p_game_id;
  end if;
end; $$;
revoke execute on function public.resolve_night(uuid) from public, anon, authenticated;
