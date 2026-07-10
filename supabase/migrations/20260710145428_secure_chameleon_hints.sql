-- Keep clue completion on the same server-authoritative boundary as votes and
-- night actions. The client supplies only the game id; the function derives
-- the current round and participant identity while holding the game lock.
create or replace function public.submit_chameleon_hint(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_round_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;

  select * into v_game
  from public.games g
  where g.id = p_game_id
  for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_game.game_mode <> 'chameleon'
     or v_game.status <> 'hint_phase'::public.game_status then
    perform private.game_error('WRONG_PHASE');
  end if;
  if not private.is_alive_player(p_game_id, v_uid) then
    perform private.game_error('PLAYER_ELIMINATED', '42501');
  end if;

  select r.id into v_round_id
  from public.rounds r
  where r.game_id = p_game_id
    and r.round_number = v_game.current_round;
  if v_round_id is null then
    perform private.game_error('ROUND_NOT_FOUND', 'P0002');
  end if;

  insert into public.hints_given (round_id, player_id, given_at)
  values (v_round_id, v_uid, clock_timestamp())
  on conflict (round_id, player_id) do nothing;

  update public.game_players
  set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;
  update public.games
  set updated_at = clock_timestamp()
  where games.id = p_game_id;
end;
$$;

revoke execute on function public.submit_chameleon_hint(uuid)
  from public, anon;
grant execute on function public.submit_chameleon_hint(uuid)
  to authenticated;

revoke insert, update, delete on public.hints_given
  from anon, authenticated;
drop policy if exists "hints insert by living player in hint phase"
  on public.hints_given;
