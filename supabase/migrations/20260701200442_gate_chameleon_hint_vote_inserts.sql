-- The hints_given/votes INSERT policies only checked self-identity, so an
-- eliminated player could keep hinting (forcing premature phase advances) or
-- voting (skewing the lynch tally). Mafia mode already gates this in its
-- SECURITY DEFINER RPCs; backport the same rigor here via policy checks.
-- game_players SELECT RLS is own-row-only, so aliveness of the vote target
-- needs a SECURITY DEFINER helper.
create or replace function public._is_alive_player(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = p_user_id and is_eliminated = false
  );
$$;
revoke execute on function public._is_alive_player(uuid, uuid) from public, anon;
grant execute on function public._is_alive_player(uuid, uuid) to authenticated;

drop policy "hints insert self" on hints_given;
create policy "hints insert by living player in hint phase" on hints_given
  for insert to authenticated with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from rounds r
      where r.id = round_id
        and public._game_status(r.game_id) = 'hint_phase'
        and public._is_alive_player(r.game_id, player_id)
    )
  );

drop policy "votes insert self" on votes;
create policy "votes insert by living player in voting phase" on votes
  for insert to authenticated with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from rounds r
      where r.id = round_id
        and public._game_status(r.game_id) = 'voting'
        and public._is_alive_player(r.game_id, voter_id)
        and public._is_alive_player(r.game_id, voted_for_id)
    )
  );
