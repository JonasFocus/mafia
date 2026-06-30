-- RLS: this is the actual security boundary for role/word secrecy. Never trust client-side hiding alone.
alter table users enable row level security;
alter table categories enable row level security;
alter table words enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table rounds enable row level security;
alter table hints_given enable row level security;
alter table votes enable row level security;

create policy "users readable by authenticated" on users
  for select to authenticated using (true);
create policy "users insert own row" on users
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "users update own row" on users
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "categories readable" on categories
  for select to authenticated using (true);

-- words.text: only readable by a player in that game who is NOT the outsider, post role_reveal
create policy "words readable by non-outsider players post-reveal" on words
  for select to authenticated using (
    exists (
      select 1
      from games g
      join game_players gp on gp.game_id = g.id
      where g.word_id = words.id
        and gp.user_id = (select auth.uid())
        and gp.is_outsider = false
        and g.status != 'lobby'
    )
  );

create policy "games readable by participants" on games
  for select to authenticated using (
    host_id = (select auth.uid())
    or exists (
      select 1 from game_players gp
      where gp.game_id = games.id and gp.user_id = (select auth.uid())
    )
  );
create policy "games insert by host" on games
  for insert to authenticated with check (host_id = (select auth.uid()));
create policy "games update by host" on games
  for update to authenticated using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

-- game_players: RLS is row-level, not column-level, so the base table only exposes a player's own row.
-- Other players' rows (name, elimination status, but NEVER is_outsider) are read via game_players_public.
create policy "game_players base table readable by own row only" on game_players
  for select to authenticated using (user_id = (select auth.uid()));
create policy "game_players insert self" on game_players
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "game_players update by host or self" on game_players
  for update to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from games g where g.id = game_players.game_id and g.host_id = (select auth.uid()))
  ) with check (
    user_id = (select auth.uid())
    or exists (select 1 from games g where g.id = game_players.game_id and g.host_id = (select auth.uid()))
  );

create view game_players_public with (security_invoker = true) as
select
  id,
  game_id,
  user_id,
  is_eliminated,
  join_order,
  joined_at,
  case when user_id = (select auth.uid()) then is_outsider else null end as is_outsider
from game_players;

grant select on game_players_public to authenticated;

create policy "rounds readable by participants" on rounds
  for select to authenticated using (
    exists (select 1 from game_players gp where gp.game_id = rounds.game_id and gp.user_id = (select auth.uid()))
  );
create policy "rounds insert by host" on rounds
  for insert to authenticated with check (
    exists (select 1 from games g where g.id = rounds.game_id and g.host_id = (select auth.uid()))
  );

create policy "hints readable by participants" on hints_given
  for select to authenticated using (
    exists (
      select 1 from rounds r join game_players gp on gp.game_id = r.game_id
      where r.id = hints_given.round_id and gp.user_id = (select auth.uid())
    )
  );
create policy "hints insert self" on hints_given
  for insert to authenticated with check (player_id = (select auth.uid()));

-- votes: a voter can read/insert only their own ballot. No one can read who voted for whom.
-- Aggregate tallies are computed server-side and broadcast, not queried directly by clients.
create policy "votes readable by own ballot" on votes
  for select to authenticated using (voter_id = (select auth.uid()));
create policy "votes insert self" on votes
  for insert to authenticated with check (voter_id = (select auth.uid()));
