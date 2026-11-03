-- Read-only checks. No requests are sent and no customer rows are changed.
begin;
do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'custodial-support-email-recovery'
      and schedule = '* * * * *'
      and command = 'select support_private.wake_email_recovery();'
  ) then
    raise exception 'Recovery schedule is missing or changed';
  end if;
  if has_function_privilege('anon', 'support_private.wake_email_recovery()', 'execute')
     or has_function_privilege('authenticated', 'support_private.wake_email_recovery()', 'execute')
     or has_function_privilege('service_role', 'support_private.wake_email_recovery()', 'execute') then
    raise exception 'Recovery function must be database-scheduler only';
  end if;
  if has_table_privilege('anon', 'vault.decrypted_secrets', 'select')
     or has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select') then
    raise exception 'Browser roles can read Vault';
  end if;
  if to_regclass('net.http_request_queue') is not null then
    raise exception 'Shared request queue unexpectedly exists';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'custodial_support_email_cron' and decrypted_secret ~ '^[a-f0-9]{96}$'
  ) then
    raise exception 'Dedicated recovery credential is missing';
  end if;
  if exists (
    select 1 from cron.job
    where jobname = 'custodial-support-email-recovery' and command ilike '%Bearer%'
  ) then
    raise exception 'Credential must not appear in job text';
  end if;
end;
$$;
rollback;
