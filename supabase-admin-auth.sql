create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.app_admins enable row level security;

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
