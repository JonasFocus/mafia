-- votes RLS is own-ballot-only (ballots stay secret), so the "X of Y voted"
-- counter could never see other voters — every client showed 0 or 1 all game.
-- Expose WHO has voted (never for whom) via a participant-gated definer RPC.
create or replace function public.round_voter_ids(p_round_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.voter_id
  from votes v
  where v.round_id = p_round_id
    and exists (
      select 1
      from rounds r
      join game_players gp on gp.game_id = r.game_id
      where r.id = p_round_id and gp.user_id = auth.uid()
    );
$$;
revoke execute on function public.round_voter_ids(uuid) from public, anon;
grant execute on function public.round_voter_ids(uuid) to authenticated;

-- Realtime can't deliver other players' votes (own-ballot RLS), and the client's
-- unscoped hints/votes listeners are being removed. Touch the games row on each
-- hint/vote insert instead: participants' filtered games subscription fires and
-- the hooks refetch round progress.
create or replace function public._touch_game_from_round_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update games set updated_at = clock_timestamp()
  where id = (select game_id from rounds where id = new.round_id);
  return new;
end;
$$;
revoke execute on function public._touch_game_from_round_child() from public, anon, authenticated;

drop trigger if exists votes_touch_game on votes;
create trigger votes_touch_game
after insert on votes
for each row execute function public._touch_game_from_round_child();

drop trigger if exists hints_touch_game on hints_given;
create trigger hints_touch_game
after insert on hints_given
for each row execute function public._touch_game_from_round_child();
