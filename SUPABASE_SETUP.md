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

## 3. What this pass does not change yet

This pass does **not** switch the live scoring workflow over to Supabase yet.

That is intentional. We want to keep:

- offline iPad scoring stable
- the current PWA behavior stable
- local save behavior intact while we build sync deliberately

## 4. Recommended next implementation steps

1. Add Supabase-backed read bootstrap for roster and games
2. Push non-live data first:
   - roster
   - scheduled games
   - completed/archive games
3. Add an offline sync queue for live Score Game work

## 5. Notes on offline scoring

The end-state architecture should be:

- local device storage / IndexedDB for live scoring
- Supabase for shared cloud state
- sync back to Supabase when the iPad reconnects

That gives us the right shape for scorekeeping at the field while still letting players and families see updates from the shared site.
