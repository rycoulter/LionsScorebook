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
  roster_version text,
  active_game_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_state
alter column roster_version type text using roster_version::text;

create table if not exists public.roster_players (
  id text primary key,
  team_id text not null default 'lions',
  roster_version text not null default '',
  name text not null,
  jersey_number text not null default '',
  positions jsonb not null default '[]'::jsonb,
  primary_position text not null default 'UTL',
  bats text not null default 'R',
  throws text not null default 'R',
  height text not null default '',
  weight text not null default '',
  active boolean not null default true,
  grades jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.roster_players
add column if not exists team_id text not null default 'lions',
add column if not exists roster_version text not null default '',
add column if not exists name text not null default 'Unknown Player',
add column if not exists jersey_number text not null default '',
add column if not exists positions jsonb not null default '[]'::jsonb,
add column if not exists primary_position text not null default 'UTL',
add column if not exists bats text not null default 'R',
add column if not exists throws text not null default 'R',
add column if not exists height text not null default '',
add column if not exists weight text not null default '',
add column if not exists active boolean not null default true,
add column if not exists grades jsonb not null default '{}'::jsonb,
add column if not exists sort_order integer not null default 0,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.roster_players
alter column team_id set default 'lions',
alter column roster_version set default '',
alter column name set default 'Unknown Player',
alter column jersey_number set default '',
alter column positions set default '[]'::jsonb,
alter column primary_position set default 'UTL',
alter column bats set default 'R',
alter column throws set default 'R',
alter column height set default '',
alter column weight set default '',
alter column active set default true,
alter column grades set default '{}'::jsonb,
alter column sort_order set default 0,
alter column metadata set default '{}'::jsonb,
alter column updated_at set default timezone('utc', now());

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

create table if not exists public.game_highlights (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  youtube_url text not null,
  youtube_video_id text not null default '',
  title text not null,
  description text not null default '',
  inning text not null default '',
  play_type text not null default '',
  player_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.news_articles (
  id text primary key,
  title text not null,
  summary text not null default '',
  body_html text not null default '',
  category text not null default 'Team News',
  game_id text not null default '',
  article_date date,
  image_data_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.game_highlights
add column if not exists game_id text not null default '',
add column if not exists youtube_url text not null default '',
add column if not exists youtube_video_id text not null default '',
add column if not exists title text not null default '',
add column if not exists description text not null default '',
add column if not exists inning text not null default '',
add column if not exists play_type text not null default '',
add column if not exists player_ids jsonb not null default '[]'::jsonb,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists created_at timestamptz not null default timezone('utc', now()),
add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.game_highlights
alter column game_id drop default,
alter column youtube_url drop default,
alter column title drop default,
alter column youtube_video_id set default '',
alter column description set default '',
alter column inning set default '',
alter column play_type set default '',
alter column player_ids set default '[]'::jsonb,
alter column metadata set default '{}'::jsonb,
alter column created_at set default timezone('utc', now()),
alter column updated_at set default timezone('utc', now());

alter table public.news_articles
add column if not exists title text not null default '',
add column if not exists summary text not null default '',
add column if not exists body_html text not null default '',
add column if not exists category text not null default 'Team News',
add column if not exists game_id text not null default '',
add column if not exists article_date date,
add column if not exists image_data_url text not null default '',
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists created_at timestamptz not null default timezone('utc', now()),
add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.news_articles
alter column summary set default '',
alter column body_html set default '',
alter column category set default 'Team News',
alter column game_id set default '',
alter column image_data_url set default '',
alter column metadata set default '{}'::jsonb,
alter column created_at set default timezone('utc', now()),
alter column updated_at set default timezone('utc', now());

create index if not exists games_status_idx on public.games (status);
create index if not exists games_game_date_idx on public.games (game_date);
create index if not exists games_updated_at_idx on public.games (updated_at desc);
create index if not exists roster_players_team_idx on public.roster_players (team_id, active, sort_order);
create index if not exists roster_players_updated_at_idx on public.roster_players (updated_at desc);
create index if not exists league_standings_division_season_idx on public.league_standings (division, season, rank);
create index if not exists league_standings_updated_at_idx on public.league_standings (updated_at desc);
create index if not exists game_highlights_game_idx on public.game_highlights (game_id, created_at desc);
create index if not exists game_highlights_updated_at_idx on public.game_highlights (updated_at desc);
create index if not exists news_articles_category_date_idx on public.news_articles (category, article_date desc, created_at desc);
create index if not exists news_articles_updated_at_idx on public.news_articles (updated_at desc);

drop trigger if exists set_app_state_updated_at on public.app_state;
create trigger set_app_state_updated_at
before update on public.app_state
for each row execute function public.set_updated_at();

drop trigger if exists set_roster_players_updated_at on public.roster_players;
create trigger set_roster_players_updated_at
before update on public.roster_players
for each row execute function public.set_updated_at();

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists set_league_standings_updated_at on public.league_standings;
create trigger set_league_standings_updated_at
before update on public.league_standings
for each row execute function public.set_updated_at();

drop trigger if exists set_game_highlights_updated_at on public.game_highlights;
create trigger set_game_highlights_updated_at
before update on public.game_highlights
for each row execute function public.set_updated_at();

drop trigger if exists set_news_articles_updated_at on public.news_articles;
create trigger set_news_articles_updated_at
before update on public.news_articles
for each row execute function public.set_updated_at();

insert into public.app_state (id)
values ('primary')
on conflict (id) do nothing;

insert into public.roster_players (
  id,
  team_id,
  roster_version,
  name,
  jersey_number,
  positions,
  primary_position,
  bats,
  throws,
  height,
  weight,
  active,
  grades,
  sort_order,
  metadata
)
select
  player.value ->> 'id' as id,
  'lions' as team_id,
  coalesce(app_state.roster_version, '') as roster_version,
  coalesce(nullif(player.value ->> 'name', ''), 'Unknown Player') as name,
  coalesce(player.value ->> 'number', '') as jersey_number,
  case
    when jsonb_typeof(player.value -> 'positions') = 'array' then player.value -> 'positions'
    else '[]'::jsonb
  end as positions,
  coalesce(player.value ->> 'primaryPosition', 'UTL') as primary_position,
  coalesce(player.value ->> 'bats', 'R') as bats,
  coalesce(player.value ->> 'throws', coalesce(player.value ->> 'bats', 'R')) as throws,
  coalesce(player.value ->> 'height', '') as height,
  coalesce(player.value ->> 'weight', '') as weight,
  coalesce((player.value ->> 'active')::boolean, true) as active,
  coalesce(player.value -> 'grades', '{}'::jsonb) as grades,
  player.ordinality::integer - 1 as sort_order,
  jsonb_build_object('migrated_from', 'app_state.roster') as metadata
from public.app_state app_state
cross join lateral jsonb_array_elements(app_state.roster) with ordinality as player(value, ordinality)
where app_state.id = 'primary'
  and jsonb_typeof(app_state.roster) = 'array'
  and coalesce(player.value ->> 'id', '') <> ''
on conflict (id) do update
set
  team_id = excluded.team_id,
  roster_version = excluded.roster_version,
  name = excluded.name,
  jersey_number = excluded.jersey_number,
  positions = excluded.positions,
  primary_position = excluded.primary_position,
  bats = excluded.bats,
  throws = excluded.throws,
  height = excluded.height,
  weight = excluded.weight,
  active = excluded.active,
  grades = excluded.grades,
  sort_order = excluded.sort_order,
  metadata = public.roster_players.metadata || excluded.metadata;

insert into public.news_articles (
  id,
  title,
  summary,
  body_html,
  category,
  game_id,
  article_date,
  image_data_url,
  created_at,
  updated_at,
  metadata
)
select
  article.value ->> 'id' as id,
  coalesce(nullif(article.value ->> 'title', ''), 'Untitled Article') as title,
  coalesce(article.value ->> 'summary', '') as summary,
  coalesce(article.value ->> 'bodyHtml', article.value ->> 'body_html', article.value ->> 'body', '') as body_html,
  coalesce(nullif(article.value ->> 'category', ''), 'Team News') as category,
  coalesce(article.value ->> 'gameId', article.value ->> 'game_id', '') as game_id,
  case
    when coalesce(article.value ->> 'date', article.value ->> 'gameDate', article.value ->> 'game_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then coalesce(article.value ->> 'date', article.value ->> 'gameDate', article.value ->> 'game_date')::date
    else null
  end as article_date,
  coalesce(article.value ->> 'imageDataUrl', article.value ->> 'image_data_url', article.value ->> 'image', '') as image_data_url,
  case
    when coalesce(article.value ->> 'createdAt', article.value ->> 'created_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
      then coalesce(article.value ->> 'createdAt', article.value ->> 'created_at')::timestamptz
    else timezone('utc', now())
  end as created_at,
  case
    when coalesce(article.value ->> 'updatedAt', article.value ->> 'updated_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
      then coalesce(article.value ->> 'updatedAt', article.value ->> 'updated_at')::timestamptz
    else timezone('utc', now())
  end as updated_at,
  jsonb_build_object('migrated_from', 'app_state.metadata.news_articles') as metadata
from public.app_state app_state
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(app_state.metadata -> 'news_articles') = 'array' then app_state.metadata -> 'news_articles'
    else '[]'::jsonb
  end
) with ordinality as article(value, ordinality)
where app_state.id = 'primary'
  and jsonb_typeof(app_state.metadata -> 'news_articles') = 'array'
  and coalesce(article.value ->> 'id', '') <> ''
on conflict (id) do update
set
  title = excluded.title,
  summary = excluded.summary,
  body_html = excluded.body_html,
  category = excluded.category,
  game_id = excluded.game_id,
  article_date = excluded.article_date,
  image_data_url = excluded.image_data_url,
  metadata = public.news_articles.metadata || excluded.metadata;

alter table public.app_state enable row level security;
alter table public.roster_players enable row level security;
alter table public.games enable row level security;
alter table public.app_admins enable row level security;
alter table public.league_standings enable row level security;
alter table public.game_highlights enable row level security;
alter table public.news_articles enable row level security;

drop policy if exists "Public read app_state" on public.app_state;
create policy "Public read app_state"
on public.app_state
for select
to anon, authenticated
using (true);

drop policy if exists "Public read roster_players" on public.roster_players;
create policy "Public read roster_players"
on public.roster_players
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

drop policy if exists "Public read game_highlights" on public.game_highlights;
create policy "Public read game_highlights"
on public.game_highlights
for select
to anon, authenticated
using (true);

drop policy if exists "Public read news_articles" on public.news_articles;
create policy "Public read news_articles"
on public.news_articles
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

drop policy if exists "Authenticated write roster_players" on public.roster_players;
create policy "Authenticated write roster_players"
on public.roster_players
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

drop policy if exists "Authenticated write game_highlights" on public.game_highlights;
create policy "Authenticated write game_highlights"
on public.game_highlights
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

drop policy if exists "Authenticated write news_articles" on public.news_articles;
create policy "Authenticated write news_articles"
on public.news_articles
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
