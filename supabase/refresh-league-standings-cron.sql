-- Template for scheduling the `refresh-league-standings` Edge Function in Supabase.
-- Replace <project-ref> with your actual project ref before running.
-- Run this only after:
-- 1. deploying the function
-- 2. creating a LEAGUE_REFRESH_SECRET secret for the function
-- 3. storing the same secret in Vault for pg_cron / pg_net usage

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-aa-league-standings';

select
  cron.schedule(
    'refresh-aa-league-standings',
    '15 6 * * *',
    $$
      select
        net.http_post(
          url := 'https://<project-ref>.supabase.co/functions/v1/refresh-league-standings',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'league_refresh_secret')
          ),
          body := jsonb_build_object('season', extract(year from now())::int)::text
        );
    $$
  );
