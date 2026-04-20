# Supabase Setup

This project is set up for a local-first scoring flow with Supabase as the shared backend.

The current app still saves live scoring locally on the device first. This first backend pass adds:

- a browser-safe Supabase client config
- a shared storage adapter scaffold for `app_state` and `games`
- SQL for the initial shared tables and RLS policies

## 1. Run the schema

In the Supabase dashboard:

1. Open the project
2. Go to `SQL Editor`
3. Create a new query
4. Paste in [`supabase-schema.sql`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase-schema.sql)
5. Run it

This creates:

- `public.app_state`
- `public.games`
- `public.app_admins`
- `public.league_standings`

`app_state` and `games` allow public read access.

Writes are restricted to authenticated users whose email appears in `public.app_admins`.

If you already ran the earlier first-pass schema before the admin-auth update, run [`supabase-admin-auth.sql`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase-admin-auth.sql) as a follow-up migration.

## 2. Create the first admin user

For the next phase, create at least one admin user in Supabase Auth:

1. Go to `Authentication`
2. Create a user with email/password
3. Keep that account for admin actions later

Then add that email to `public.app_admins`.

Example:

```sql
insert into public.app_admins (email)
values ('your-admin-email@example.com')
on conflict (email) do nothing;
```

Use the same lowercase email address the admin account signs in with.

The app now uses Supabase email/password sign-in for admin mode, and shared backend writes depend on that authenticated session plus the `public.app_admins` allowlist.

## 3. Set up automatic league standings refresh

The app now expects AA standings to be cached in `public.league_standings`.

The preferred refresh path is GitHub Actions, because the Pittsburgh NABA site can time out when called from Supabase Edge Functions.

Files:

- [scripts/refresh-league-standings.mjs](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\scripts\refresh-league-standings.mjs)
- [.github/workflows/refresh-league-standings.yml](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\.github\workflows\refresh-league-standings.yml)
- [`supabase/functions/refresh-league-standings/index.ts`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase\functions\refresh-league-standings\index.ts)

Recommended setup:

1. In GitHub, open the production repository settings.
2. Add repository secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Push this workflow file to the repository’s default branch.
4. In GitHub, open `Actions` and run `Refresh League Standings` once with `workflow_dispatch`.
5. Confirm rows land in `public.league_standings`.

The workflow is also scheduled to run automatically once per day at `10:15 UTC`.

### Optional fallback

The Supabase Edge Function scaffold is still in the repo, but GitHub Actions is the preferred refresher because it is less likely to hit the Pittsburgh NABA network timeout from the server runtime.

## 4. What this pass does not change yet

This pass does **not** switch the live scoring workflow over to Supabase yet.

That is intentional. We want to keep:

- offline iPad scoring stable
- the current PWA behavior stable
- local save behavior intact while we build sync deliberately

## 5. Recommended next implementation steps

1. Add Supabase-backed read bootstrap for roster and games
2. Push non-live data first:
   - roster
   - scheduled games
   - completed/archive games
3. Add an offline sync queue for live Score Game work

## 6. Notes on offline scoring

The end-state architecture should be:

- local device storage / IndexedDB for live scoring
- Supabase for shared cloud state
- sync back to Supabase when the iPad reconnects

That gives us the right shape for scorekeeping at the field while still letting players and families see updates from the shared site.
