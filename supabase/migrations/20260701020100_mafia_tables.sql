-- Mafia mode: dedicated tables, indexes, RLS, extended view, realtime.
-- Isolation: mafia mode uses only night_actions/day_votes; it never touches
-- chameleon's rounds/hints_given/votes tables or their triggers.

create table if not exists night_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_number int not null,
  actor_id uuid not null references users(id),
  action_type night_action_type not null,
  target_id uuid not null references users(id),
  result text,
  created_at timestamptz not null default now(),
  unique (game_id, round_number, actor_id, action_type)
);
create index if not exists night_actions_game_round_idx on night_actions (game_id, round_number);

create table if not exists day_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_number int not null,
  voter_id uuid not null references users(id),
  target_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (game_id, round_number, voter_id)
);
create index if not exists day_votes_game_round_idx on day_votes (game_id, round_number);

alter table night_actions enable row level security;
alter table day_votes enable row level security;

-- night_actions: NO insert policy (writes only via submit_night_action definer fn).
-- SELECT: actor reads own rows; any mafia in the game may additionally read all 'kill'
-- rows (coordination). inspect/protect rows (and the sheriff's `result`) are only
-- readable by their actor, because they are not action_type='kill'.
drop policy if exists "night_actions select own or mafia kills" on night_actions;
create policy "night_actions select own or mafia kills" on night_actions
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (
      action_type = 'kill'
      and exists (
        select 1 from game_players gp
        where gp.game_id = night_actions.game_id
          and gp.user_id = (select auth.uid())
          and gp.role = 'mafia'
      )
    )
  );

-- day_votes: NO insert policy (writes only via cast_day_vote). SELECT own ballot only.
drop policy if exists "day_votes select own ballot" on day_votes;
create policy "day_votes select own ballot" on day_votes
  for select to authenticated using (voter_id = (select auth.uid()));

-- Extended game_players_public: adds a redacted `role` column alongside the existing
-- `is_outsider` redaction. This is a SECURITY DEFINER view (security_invoker off, the
-- existing default) so the mafia-see-mafia branch can read rows that base-table RLS
-- (own-row-only) would otherwise hide. The view's own WHERE clause re-enforces
-- participant-only access. The `security_definer_view` advisor ERROR is accepted.
--
-- role visible iff: (self) OR (game_over) OR (viewer is a living-or-dead mafia AND row.role='mafia').
-- Dead players' roles stay hidden until game_over (reveal off).
create or replace view game_players_public as
select
  gp.id,
  gp.game_id,
  gp.user_id,
  gp.is_eliminated,
  gp.join_order,
  gp.joined_at,
  case
    when gp.user_id = (select auth.uid()) then gp.is_outsider
    when g.status = 'game_over'::game_status then gp.is_outsider
    else null::boolean
  end as is_outsider,
  case
    when gp.user_id = (select auth.uid()) then gp.role
    when g.status = 'game_over'::game_status then gp.role
    when gp.role = 'mafia' and exists (
      select 1 from game_players v
      where v.game_id = gp.game_id
        and v.user_id = (select auth.uid())
        and v.role = 'mafia'
    ) then gp.role
    else null::player_role
  end as role
from game_players gp
join games g on g.id = gp.game_id
where exists (
  select 1 from game_players self
  where self.game_id = gp.game_id and self.user_id = (select auth.uid())
);

grant select on game_players_public to authenticated;

-- Realtime (postgres_changes delivers only rows passing the subscriber's SELECT RLS).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='night_actions') then
    alter publication supabase_realtime add table night_actions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='day_votes') then
    alter publication supabase_realtime add table day_votes;
  end if;
end $$;
