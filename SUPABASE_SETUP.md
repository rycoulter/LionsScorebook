# Supabase Setup

This project is set up for a local-first scoring flow with Supabase as the shared backend.

The current app still saves live scoring locally on the device first. This first backend pass adds:

- a browser-safe Supabase client config
- a shared storage adapter scaffold for `app_state` and `games`
- SQL for the initial shared tables and RLS policies

## QA and Production split

The app now supports separate Supabase projects for QA and Production.

Environment selection rules:

- `www.oakmontlions.com` and `oakmontlions.com` use `prod`
- every other hostname uses `qa`

Optional override for testing:

- query string: `?supabaseEnv=qa` or `?supabaseEnv=prod`
- localStorage key: `oakmont:supabaseEnv`

Current config lives in [`supabase-config.js`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase-config.js).

Production is still wired to the current live project.
QA is intentionally left blank until you create the QA Supabase project and paste in its URL and publishable key.

Recommended setup:

1. Keep the current Supabase project as Production
2. Create a second Supabase project for QA
3. Run the same schema in both
4. Add admin users to both
5. Put the QA project URL + publishable key into the `qa` block in `supabase-config.js`
6. Deploy QA first and verify the app version badge shows `QA`

## Supabase dashboard steps for a new QA project

1. In Supabase, click `New project`
2. Name it something obvious like `oakmont-scorebook-qa`
3. Choose the same organization as Production
4. Generate and save the database password somewhere safe
5. Pick the closest region to your Production project
6. Create the project and wait for it to finish provisioning

When the project is ready:

1. Open `Project Settings`
2. Open `API`
3. Copy:
   - `Project URL`
   - `Publishable key` / `anon public` key

Those are the two frontend values you will place into the `qa` config block.

## 1. Run the schema

In the Supabase dashboard:

1. Open the project
2. Go to `SQL Editor`
3. Create a new query
4. Paste in [`supabase-schema.sql`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase-schema.sql)
5. Run it

This creates:

- `public.app_state`
- `public.roster_players`
- `public.games`
- `public.app_admins`
- `public.league_standings`

`app_state`, `roster_players`, and `games` allow public read access.

Writes are restricted to authenticated users whose email appears in `public.app_admins`.

`roster_players` is backfilled from the existing `app_state.roster` JSON payload the first time the updated schema runs. The app still writes the JSON roster fallback in `app_state`, but reads and writes `roster_players` as the preferred roster data source once the table exists.

If you already ran the earlier first-pass schema before the admin-auth update, run [`supabase-admin-auth.sql`](C:\Users\vikin\OneDrive\Desktop\Scorebook\ScorebookGit\supabase-admin-auth.sql) as a follow-up migration.

Do this in both Production and QA if you want the environments to stay structurally aligned.

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

If you want the same coaches to sign into both QA and Production, create the same auth users in both projects and add the same emails to `public.app_admins` in both projects.

## 3. Optional: seed QA from Production

If you want QA to start with a copy of the current Production data:

1. In Production Supabase, open `Table Editor`
2. Export data from:
   - `public.app_state`
   - `public.games`
   - optionally `public.league_standings`
3. In QA Supabase, import those rows into the matching tables

Safer option:

- seed only roster, schedule, and a few completed games
- avoid copying everything if you want a cleaner QA sandbox

For first setup, I recommend:

- copy `app_state`
- copy a small subset of `games`
- manually add `app_admins`

That gives you realistic QA data without a full production mirror.

## 4. Set up automatic league standings refresh

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

If you split QA and Production, use separate GitHub secrets per repo/environment so the QA workflow writes to QA Supabase and the Production workflow writes to Production Supabase.

## 5. What this pass does not change yet

This pass does **not** switch the live scoring workflow over to Supabase yet.

That is intentional. We want to keep:

- offline iPad scoring stable
- the current PWA behavior stable
- local save behavior intact while we build sync deliberately

## 6. Recommended next implementation steps

1. Run the updated schema in QA and Production so `public.roster_players` exists in both environments
2. Confirm roster edits upsert rows into `roster_players` while preserving `app_state.lineup`
3. Continue hardening scheduled/completed game sync and live offline queue behavior

## 7. Notes on offline scoring

The end-state architecture should be:

- local device storage / IndexedDB for live scoring
- Supabase for shared cloud state
- sync back to Supabase when the iPad reconnects

That gives us the right shape for scorekeeping at the field while still letting players and families see updates from the shared site.
