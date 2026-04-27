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

do $$
begin
  if to_regclass('public.roster_players') is not null then
    execute $policy$
      drop policy if exists "Authenticated write roster_players" on public.roster_players
    $policy$;
    execute $policy$
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
      )
    $policy$;
  end if;
end;
$$;

drop policy if exists "Authenticated read app_admins" on public.app_admins;
create policy "Authenticated read app_admins"
on public.app_admins
for select
to authenticated
using (email = lower((select auth.jwt() ->> 'email')));
