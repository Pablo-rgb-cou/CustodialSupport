-- Use a synchronous database-only HTTP call instead of pg_net's shared request
-- queue, so the bearer token is never persisted in a readable headers table.
create extension if not exists http with schema extensions;

create or replace function support_private.wake_email_recovery()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bearer text;
  response_status integer;
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
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '55000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '8000');
  select status into response_status from extensions.http((
    'GET', 'https://www.custodialmanagement.net/api/support/email',
    array[extensions.http_header('Authorization', 'Bearer ' || bearer)],
    null, null
  )::extensions.http_request);
  return response_status;
exception when others then
  -- Do not put raw transport errors or request headers in cron history.
  return -1;
end;
$$;

revoke all on function support_private.wake_email_recovery()
  from public, anon, authenticated, service_role;

-- Installed by the preceding migration for this inactive job only. It has
-- never sent a request and is no longer used. No CASCADE: preserve dependencies.
drop extension pg_net;

comment on function support_private.wake_email_recovery() is
  'Database-only retry wakeup; returns HTTP status only. Dedicated token stays in Vault, never queues, URLs or job text.';
