-- Production-readiness schema: transactional lobby ownership, reconnect state,
-- participant-safe snapshots, Chameleon tie/guess state, and bounded retention.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Mafia does not use a word category. Chameleon always does.
alter table public.games alter column category_id drop not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'games_category_required_for_chameleon'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_category_required_for_chameleon
      check (category_id is not null or game_mode = 'mafia');
  end if;
end $$;

alter table public.games
  add column if not exists dealer_id uuid references public.users(id) on delete set null,
  add column if not exists phase_started_at timestamptz not null default clock_timestamp(),
  add column if not exists expires_at timestamptz not null default (clock_timestamp() + interval '6 hours'),
  add column if not exists chameleon_vote_stage integer not null default 1,
  add column if not exists chameleon_tied_player_ids uuid[] not null default '{}',
  add column if not exists chameleon_caught_id uuid references public.users(id) on delete set null;

alter table public.games drop constraint if exists games_winner_check;
alter table public.games
  add constraint games_winner_check
  check (winner in ('town', 'mafia', 'players', 'chameleon'));

update public.games set dealer_id = host_id where dealer_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'games_chameleon_vote_stage_check'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_chameleon_vote_stage_check
      check (chameleon_vote_stage between 1 and 2);
  end if;
end $$;

alter table public.game_players
  add column if not exists last_seen_at timestamptz not null default clock_timestamp();

-- Repair legacy duplicate/gapped ordering deterministically before enforcing the
-- invariant. New joins use max(join_order)+1 while holding the game-row lock.
with ordered as (
  select id,
         row_number() over (
           partition by game_id order by join_order, joined_at, id
         ) - 1 as next_join_order
  from public.game_players
)
update public.game_players gp
set join_order = ordered.next_join_order
from ordered
where ordered.id = gp.id
  and gp.join_order is distinct from ordered.next_join_order;

create unique index if not exists game_players_game_id_join_order_key
  on public.game_players (game_id, join_order);
create index if not exists game_players_game_id_last_seen_idx
  on public.game_players (game_id, last_seen_at desc);
create index if not exists games_status_expires_at_idx
  on public.games (status, expires_at);

-- Chameleon ballots are editable until resolution and get a separate second
-- stage for the canonical tie-break vote.
alter table public.votes
  add column if not exists vote_stage integer not null default 1;
alter table public.votes
  drop constraint if exists votes_round_id_voter_id_key;
create unique index if not exists votes_round_stage_voter_key
  on public.votes (round_id, vote_stage, voter_id);
create index if not exists votes_round_stage_target_idx
  on public.votes (round_id, vote_stage, voted_for_id);

-- Secret material is never selectable through the Data API. It is exposed only
-- through get_game_snapshot after participant/role/phase checks.
create table if not exists public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  word_id uuid references public.words(id) on delete restrict,
  guess_candidate_ids uuid[] not null default '{}',
  guess_attempt_ids uuid[] not null default '{}',
  guesses_remaining integer not null default 1 check (guesses_remaining between 0 and 2),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.game_secrets enable row level security;
revoke all on public.game_secrets from public, anon, authenticated;

insert into public.game_secrets (game_id, word_id, guess_candidate_ids)
select g.id, g.word_id,
       case when g.word_id is null then '{}'::uuid[] else array[g.word_id] end
from public.games g
where g.word_id is not null
on conflict (game_id) do nothing;

create table if not exists public.game_phase_acknowledgements (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  round_number integer not null,
  phase public.game_status not null,
  acknowledged_at timestamptz not null default clock_timestamp(),
  primary key (game_id, user_id, round_number, phase)
);
alter table public.game_phase_acknowledgements enable row level security;
revoke all on public.game_phase_acknowledgements from public, anon, authenticated;
grant select on public.game_phase_acknowledgements to authenticated;
create index if not exists game_phase_ack_game_phase_idx
  on public.game_phase_acknowledgements (game_id, round_number, phase);

drop policy if exists "phase acknowledgements readable by participants"
  on public.game_phase_acknowledgements;
create policy "phase acknowledgements readable by participants"
  on public.game_phase_acknowledgements
  for select to authenticated
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = game_phase_acknowledgements.game_id
        and gp.user_id = (select auth.uid())
    )
  );

-- Throttles lazy cleanup to at most once per hour even though lobby discovery is
-- polled frequently.
create table if not exists private.maintenance_state (
  task_name text primary key,
  last_run_at timestamptz not null
);
insert into private.maintenance_state (task_name, last_run_at)
values ('game_retention', '-infinity'::timestamptz)
on conflict (task_name) do nothing;

-- Browser clients now write lifecycle state only through row-locked RPCs.
revoke insert, update, delete on public.games from anon, authenticated;
grant select on public.games to authenticated;

revoke insert, update, delete on public.game_players from anon, authenticated;
grant select on public.game_players to authenticated;

revoke insert, update, delete on public.rounds from anon, authenticated;
grant select on public.rounds to authenticated;

revoke insert, update, delete on public.votes from anon, authenticated;
grant select on public.votes to authenticated;

revoke insert, update, delete on public.night_actions from anon, authenticated;
grant select on public.night_actions to authenticated;

revoke insert, update, delete on public.day_votes from anon, authenticated;
grant select on public.day_votes to authenticated;

-- Hints remain a direct self-insert because their trigger locks the game row and
-- the current-round RLS policy validates the full transition boundary.
revoke update, delete on public.hints_given from anon, authenticated;
grant select, insert on public.hints_given to authenticated;

drop policy if exists "games insert by host" on public.games;
drop policy if exists "games update by host" on public.games;
drop policy if exists "games update by host in lobby" on public.games;
drop policy if exists "games delete by host" on public.games;
drop policy if exists "game_players insert self" on public.game_players;
drop policy if exists "game_players insert self in lobby" on public.game_players;
drop policy if exists "game_players delete own row" on public.game_players;
drop policy if exists "game_players delete own row in lobby" on public.game_players;
drop policy if exists "rounds insert by host" on public.rounds;
drop policy if exists "votes insert self" on public.votes;
drop policy if exists "votes insert by living player in voting phase" on public.votes;

-- Profiles are self-readable/self-writable. Participant names come from the
-- roster view/snapshot below instead of a global guest directory.
drop policy if exists "users readable by authenticated" on public.users;
drop policy if exists "users readable by self" on public.users;
create policy "users readable by self" on public.users
  for select to authenticated
  using (id = (select auth.uid()));

-- Add participant-safe display data to the existing redacted roster contract.
drop view if exists public.game_players_public;
create view public.game_players_public as
select
  gp.id,
  gp.game_id,
  gp.user_id,
  gp.is_eliminated,
  gp.join_order,
  gp.joined_at,
  case
    when gp.user_id = (select auth.uid()) then gp.is_outsider
    when g.status = 'game_over'::public.game_status then gp.is_outsider
    else null::boolean
  end as is_outsider,
  case
    when gp.user_id = (select auth.uid()) then gp.role
    when g.status = 'game_over'::public.game_status then gp.role
    when gp.role = 'mafia'::public.player_role and exists (
      select 1 from public.game_players viewer
      where viewer.game_id = gp.game_id
        and viewer.user_id = (select auth.uid())
        and viewer.role = 'mafia'::public.player_role
    ) then gp.role
    else null::public.player_role
  end as role,
  u.display_name,
  gp.last_seen_at
from public.game_players gp
join public.games g on g.id = gp.game_id
join public.users u on u.id = gp.user_id
where exists (
  select 1 from public.game_players viewer
  where viewer.game_id = gp.game_id
    and viewer.user_id = (select auth.uid())
);
revoke all on public.game_players_public from public, anon, authenticated;

-- Progress tables drive filtered Realtime catch-up through games.updated_at.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_phase_acknowledgements'
  ) then
    alter publication supabase_realtime
      add table public.game_phase_acknowledgements;
  end if;
end $$;
