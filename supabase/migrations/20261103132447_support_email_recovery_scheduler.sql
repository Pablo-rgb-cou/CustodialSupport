-- Recovery is installed inactive. Activate only after the new Vercel routes and
-- server credentials are deployed and a controlled delivery test succeeds.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- pg_net queues plaintext headers briefly. Keep those tables inaccessible to
-- browser roles; only the database scheduler needs this dedicated credential.
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;

create function support_private.wake_email_recovery()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bearer text;
  request_id bigint;
begin
  if not exists (
    select 1 from support_private.email_outbox
    where (status = 'pending' and next_attempt_at <= now())
       or (status = 'processing' and lease_until <= now())
  ) then
    return null;
  end if;

  select decrypted_secret into bearer
  from vault.decrypted_secrets where name = 'custodial_support_email_cron';
  if bearer is null or length(bearer) < 32 then
    return null;
  end if;

  select net.http_get(
    url := 'https://www.custodialmanagement.net/api/support/email',
    headers := jsonb_build_object('Authorization', 'Bearer ' || bearer),
    timeout_milliseconds := 55000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function support_private.wake_email_recovery()
  from public, anon, authenticated, service_role;

do $$
declare
  recovery_job bigint;
begin
  select cron.schedule(
    'custodial-support-email-recovery', '* * * * *',
    'select support_private.wake_email_recovery();'
  ) into recovery_job;
  perform cron.alter_job(recovery_job, active := false);
end;
$$;

comment on function support_private.wake_email_recovery() is
  'Database-only recovery wakeup. Dedicated token stays in Vault, never job text or URLs.';
