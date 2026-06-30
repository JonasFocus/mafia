-- Initial schema: users, games, players, rounds, hints, votes
create type game_status as enum ('lobby','role_reveal','hint_phase','voting','round_result','game_over');

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_custom boolean not null default false,
  created_by uuid references users(id)
);

create table words (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  text text not null
);

create table games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid not null references users(id),
  category_id uuid not null references categories(id),
  word_id uuid references words(id),
  status game_status not null default 'lobby',
  current_round int not null default 0,
  max_rounds int not null default 3,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id),
  is_outsider boolean not null default false,
  is_eliminated boolean not null default false,
  join_order int not null,
  joined_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_number int not null,
  hint_order uuid[] not null
);

create table hints_given (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references users(id),
  given_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  voter_id uuid not null references users(id),
  voted_for_id uuid not null references users(id),
  cast_at timestamptz not null default now(),
  unique (round_id, voter_id)
);
