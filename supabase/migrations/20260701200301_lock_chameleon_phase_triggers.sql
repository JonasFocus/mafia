-- Race fix: check_hints_complete/resolve_votes counted rows without locking the
-- games row. Two near-simultaneous "last" submitters each ran in their own
-- READ COMMITTED transaction, neither saw the other's uncommitted insert, both
-- counted one short, and the phase never advanced — with the unique constraints
-- blocking any retry, the round stalled forever. Lock the games row first
-- (mirroring resolve_night/resolve_day) so submitters serialize and the last
-- one sees a consistent count.
-- (resolve_votes body below is the live multi-impostor version, previously
-- applied out-of-band; now checked in with the lock added.)

create or replace function public.check_hints_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_active_count int;
  v_hint_count int;
begin
  select game_id into v_game_id from rounds where id = new.round_id;

  -- serialize concurrent hint submitters for this game
  perform 1 from games where id = v_game_id for update;

  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_hint_count from hints_given where round_id = new.round_id;

  if v_hint_count >= v_active_count then
    update games set status = 'voting' where id = v_game_id and status = 'hint_phase';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_hints_complete() from public, anon, authenticated;

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

  -- lock the games row before counting: serializes concurrent voters and makes
  -- the count/status check consistent (same pattern as resolve_night/resolve_day)
  select g.max_rounds into v_max_rounds from games g where g.id = v_game_id for update;

  if not exists (select 1 from games where id = v_game_id and status = 'voting') then
    return new; -- already resolved, idempotency guard
  end if;

  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_vote_count from votes where round_id = new.round_id;

  if v_vote_count < v_active_count then
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
    -- tie: no elimination this round
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
    update games set status = 'game_over' where id = v_game_id; -- all mafia caught: civilians win
  elsif v_round_number >= v_max_rounds then
    update games set status = 'game_over' where id = v_game_id; -- round limit hit: mafia wins
  else
    select array_agg(user_id order by join_order) into v_hint_order
    from game_players where game_id = v_game_id and is_eliminated = false;
    insert into rounds (game_id, round_number, hint_order) values (v_game_id, v_round_number + 1, v_hint_order);
    update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.resolve_votes() from public, anon, authenticated;
