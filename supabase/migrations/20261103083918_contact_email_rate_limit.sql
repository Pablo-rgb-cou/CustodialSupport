-- Draft for a separately generated Supabase CLI migration. No visitor content is stored.
-- The server calls this RPC with HMAC hashes; browsers cannot call it.
create schema if not exists support_private;
revoke all on schema support_private from public, anon, authenticated;
grant usage on schema support_private to service_role;

create table support_private.contact_rate_limits (
  bucket text primary key check (
    bucket in ('global-hour', 'global-day') or bucket ~ '^(email|ip):[a-f0-9]{64}$'
  ),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0)
);
alter table support_private.contact_rate_limits enable row level security;
revoke all on table support_private.contact_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on table support_private.contact_rate_limits to service_role;
create index contact_rate_limits_expiry on support_private.contact_rate_limits(window_start);

create function public.claim_contact_email_slot(p_email_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_hour timestamptz := date_trunc('hour', now());
  v_day timestamptz := date_trunc('day', now());
  v_keys text[] := array['global-day', 'global-hour', 'email:' || p_email_hash, 'ip:' || p_ip_hash];
  v_limits integer[] := array[200, 40, 3, 5];
  v_starts timestamptz[];
  v_ends timestamptz[];
  v_count integer;
  v_existing_start timestamptz;
  v_retry integer := 0;
  v_index integer;
begin
  if p_email_hash is null or p_ip_hash is null
    or p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Valid contact identity hashes are required.';
  end if;

  -- A single small critical section makes all buckets one atomic decision,
  -- including concurrent invocations on different serverless instances.
  perform pg_advisory_xact_lock(hashtextextended('custodialsupport:contact-email-limit:v1', 0));
  delete from support_private.contact_rate_limits where window_start < v_now - interval '2 days';
  v_starts := array[v_day, v_hour, v_hour, v_hour];
  v_ends := array[v_day + interval '1 day', v_hour + interval '1 hour', v_hour + interval '1 hour', v_hour + interval '1 hour'];

  for v_index in 1..4 loop
    select r.window_start, r.request_count into v_existing_start, v_count
      from support_private.contact_rate_limits r where r.bucket = v_keys[v_index];
    if v_existing_start = v_starts[v_index] and v_count >= v_limits[v_index] then
      v_retry := greatest(v_retry, ceil(extract(epoch from (v_ends[v_index] - v_now)))::integer);
    end if;
  end loop;
  if v_retry > 0 then return jsonb_build_object('allowed', false, 'retry_after', v_retry); end if;

  for v_index in 1..4 loop
    insert into support_private.contact_rate_limits as r(bucket, window_start, request_count)
      values(v_keys[v_index], v_starts[v_index], 1)
    on conflict(bucket) do update set
      request_count = case when r.window_start = excluded.window_start then r.request_count + 1 else 1 end,
      window_start = excluded.window_start;
  end loop;
  return jsonb_build_object('allowed', true, 'retry_after', 0);
end;
$$;

revoke all on function public.claim_contact_email_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_contact_email_slot(text, text) to service_role;
comment on table support_private.contact_rate_limits is
  'Private contact-form throttles. HMAC identities only; no names, email addresses, IP addresses or message bodies. Do not publish through Realtime.';
