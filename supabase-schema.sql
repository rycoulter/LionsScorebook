create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.app_state (
  id text primary key,
  roster jsonb not null default '[]'::jsonb,
  lineup jsonb not null default '[]'::jsonb,
  roster_version integer,
  active_game_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.games (
  id text primary key,
  opponent text not null default 'Opponent',
  game_date date,
  game_time text not null default '',
  status text not null default 'scheduled',
  lions_side text not null default 'away',
  is_final boolean not null default false,
  game_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.league_standings (
  id text primary key,
  season integer not null,
  division text not null,
  rank integer,
  team_name text not null,
  team_code text not null default '',
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  record text not null default '--',
  points integer not null default 0,
  win_pct text not null default '--',
  games_back text not null default '-',
  runs_for integer not null default 0,
  runs_against integer not null default 0,
  last_ten text not null default '--',
  streak text not null default '--',
  source_url text not null default '',
  source_label text not null default '',
  synced_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (season, division, team_name)
);

create index if not exists games_status_idx on public.games (status);
create index if not exists games_game_date_idx on public.games (game_date);
create index if not exists games_updated_at_idx on public.games (updated_at desc);
create index if not exists league_standings_division_season_idx on public.league_standings (division, season, rank);
create index if not exists league_standings_updated_at_idx on public.league_standings (updated_at desc);

drop trigger if exists set_app_state_updated_at on public.app_state;
create trigger set_app_state_updated_at
before update on public.app_state
for each row execute function public.set_updated_at();

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists set_league_standings_updated_at on public.league_standings;
create trigger set_league_standings_updated_at
before update on public.league_standings
for each row execute function public.set_updated_at();

insert into public.app_state (id)
values ('primary')
on conflict (id) do nothing;

alter table public.app_state enable row level security;
alter table public.games enable row level security;
alter table public.app_admins enable row level security;
alter table public.league_standings enable row level security;

drop policy if exists "Public read app_state" on public.app_state;
create policy "Public read app_state"
on public.app_state
for select
to anon, authenticated
using (true);

drop policy if exists "Public read games" on public.games;
create policy "Public read games"
on public.games
for select
to anon, authenticated
using (true);

drop policy if exists "Public read league_standings" on public.league_standings;
create policy "Public read league_standings"
on public.league_standings
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated write app_state" on public.app_state;
create policy "Authenticated write app_state"
on public.app_state
for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Authenticated write games" on public.games;
create policy "Authenticated write games"
on public.games
for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Authenticated read app_admins" on public.app_admins;
create policy "Authenticated read app_admins"
on public.app_admins
for select
to authenticated
using (email = lower((select auth.jwt() ->> 'email')));

drop policy if exists "Authenticated write league_standings" on public.league_standings;
create policy "Authenticated write league_standings"
on public.league_standings
for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1
    from public.app_admins admins
    where admins.email = lower((select auth.jwt() ->> 'email'))
  )
);
