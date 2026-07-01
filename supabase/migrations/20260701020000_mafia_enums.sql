-- Mafia mode: enums + columns.
-- Enum ADD VALUE must be committed before it can be referenced by the functions in
-- 20260701020200_mafia_functions.sql, so this file is applied (and committed) on its own first.

-- New role enum (extensible: add labels later with ALTER TYPE ... ADD VALUE).
do $$ begin
  if not exists (select 1 from pg_type where typname='player_role' and typnamespace='public'::regnamespace) then
    create type public.player_role as enum ('faithful','mafia','sheriff','angel');
  end if;
  if not exists (select 1 from pg_type where typname='night_action_type' and typnamespace='public'::regnamespace) then
    create type public.night_action_type as enum ('kill','inspect','protect');
  end if;
end $$;

-- Add mafia phases to the existing game_status enum.
alter type game_status add value if not exists 'night';
alter type game_status add value if not exists 'day_result';
alter type game_status add value if not exists 'day_vote';

-- Mode + settings + winner on games; role on game_players.
alter table games add column if not exists game_mode text not null default 'chameleon'
  check (game_mode in ('chameleon','mafia'));
alter table games add column if not exists sheriff_enabled boolean not null default true;
alter table games add column if not exists angel_enabled boolean not null default true;
alter table games add column if not exists reveal_role_on_death boolean not null default false; -- future; behavior = hidden
alter table games add column if not exists winner text check (winner in ('town','mafia'));

alter table game_players add column if not exists role player_role; -- null in chameleon
