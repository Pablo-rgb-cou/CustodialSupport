-- Put this SQL in a separately generated Supabase CLI migration.
-- It does not backfill existing tickets/messages or change their RLS policies.

create schema if not exists support_private;
revoke all on schema support_private from public, anon, authenticated;
grant usage on schema support_private to service_role;

create table support_private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_kind text not null check (event_kind in ('ticket_created', 'client_reply')),
  source_id uuid not null,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  last_error_code text check (last_error_code in (
    'SMTP_AUTH', 'SMTP_TIMEOUT', 'SMTP_CONNECT', 'SMTP_REJECTED',
    'SMTP_SEND', 'INVALID_JOB', 'LEASE_EXPIRED'
  )),
  constraint support_email_source_event_unique unique (event_kind, source_id),
  constraint support_email_lease_state check (
    (status = 'processing' and lease_until is not null and lease_token is not null)
    or (status <> 'processing' and lease_until is null and lease_token is null)
  )
);

alter table support_private.email_outbox enable row level security;
-- No user-facing policies: ordinary authenticated sessions cannot access this queue.
revoke all on table support_private.email_outbox from public, anon, authenticated, service_role;
grant select, update on table support_private.email_outbox to service_role;

create index support_email_pending_due
  on support_private.email_outbox (next_attempt_at, created_at)
  where status = 'pending';
create index support_email_processing_lease
  on support_private.email_outbox (lease_until, created_at)
  where status = 'processing';
create index support_email_ticket_scope
  on support_private.email_outbox (client_id, ticket_id, created_at);

-- A privileged trigger is necessary to insert into the private schema.
-- Ownership checks use auth.uid(), never user-provided sender metadata alone.
create function support_private.enqueue_support_ticket_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return new;
  end if;

  if tg_table_schema = 'public' and tg_table_name = 'support_tickets' then
    if new.client_id = caller_id and exists (
      select 1 from public.profiles p where p.id = caller_id and p.role = 'client'
    ) then
      insert into support_private.email_outbox (event_kind, source_id, ticket_id, client_id)
      values ('ticket_created', new.id, new.id, caller_id)
      on conflict (event_kind, source_id) do nothing;
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'ticket_messages' then
    if new.sender_id = caller_id and new.is_internal = false and exists (
      select 1
      from public.support_tickets t
      join public.profiles p on p.id = t.client_id
      where t.id = new.ticket_id and t.client_id = caller_id and p.role = 'client'
    ) then
      insert into support_private.email_outbox (event_kind, source_id, ticket_id, client_id)
      values ('client_reply', new.id, new.ticket_id, caller_id)
      on conflict (event_kind, source_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function support_private.enqueue_support_ticket_email() from public, anon, authenticated;

create trigger support_ticket_enqueue_email
after insert on public.support_tickets
for each row execute function support_private.enqueue_support_ticket_email();

create trigger support_reply_enqueue_email
after insert on public.ticket_messages
for each row execute function support_private.enqueue_support_ticket_email();

-- Exposed RPCs remain SECURITY INVOKER and have EXECUTE revoked for public users.
-- service_role can reach the private table; browsers cannot call these functions.
create function public.claim_support_email_jobs(
  p_limit integer default 2,
  p_client_id uuid default null,
  p_ticket_id uuid default null
)
returns table (
  id uuid,
  event_kind text,
  ticket_id uuid,
  created_at timestamptz,
  attempts smallint,
  lease_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (p_client_id is null) <> (p_ticket_id is null) then
    raise exception using errcode = '22023', message = 'Both scope IDs are required together.';
  end if;

  -- An abandoned final attempt must become terminal rather than stay processing.
  update support_private.email_outbox o
  set status = 'failed', lease_until = null, lease_token = null,
      last_error_code = 'LEASE_EXPIRED'
  where o.status = 'processing' and o.lease_until <= now() and o.attempts >= 6
    and (p_client_id is null or o.client_id = p_client_id)
    and (p_ticket_id is null or o.ticket_id = p_ticket_id);

  return query
  with picked as (
    select o.id
    from support_private.email_outbox o
    where o.attempts < 6
      and ((o.status = 'pending' and o.next_attempt_at <= now())
        or (o.status = 'processing' and o.lease_until <= now()))
      and (p_client_id is null or o.client_id = p_client_id)
      and (p_ticket_id is null or o.ticket_id = p_ticket_id)
    order by o.created_at, o.id
    limit greatest(1, least(coalesce(p_limit, 2), 2))
    for update of o skip locked
  )
  update support_private.email_outbox o
  set status = 'processing', attempts = o.attempts + 1,
      lease_until = now() + interval '180 seconds', lease_token = gen_random_uuid()
  from picked
  where o.id = picked.id
  returning o.id, o.event_kind, o.ticket_id, o.created_at, o.attempts, o.lease_token;
end;
$$;

create function public.finish_support_email_job(
  p_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
  safe_error text := case when p_error_code in (
    'SMTP_AUTH', 'SMTP_TIMEOUT', 'SMTP_CONNECT', 'SMTP_REJECTED',
    'SMTP_SEND', 'INVALID_JOB'
  ) then p_error_code else 'SMTP_SEND' end;
begin
  if p_success is null then
    raise exception using errcode = '22023', message = 'Delivery result is required.';
  end if;

  update support_private.email_outbox o
  set status = case when p_success then 'sent' when o.attempts >= 6 then 'failed' else 'pending' end,
      next_attempt_at = case when p_success then o.next_attempt_at
        else now() + make_interval(secs => least(3600, (60 * power(2, o.attempts - 1))::integer)) end,
      sent_at = case when p_success then now() else null end,
      last_error_code = case when p_success then null else safe_error end,
      lease_until = null,
      lease_token = null
  where o.id = p_id and o.status = 'processing' and o.lease_token = p_lease_token;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_support_email_jobs(integer, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_support_email_job(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_support_email_jobs(integer, uuid, uuid) to service_role;
grant execute on function public.finish_support_email_job(uuid, uuid, boolean, text) to service_role;

comment on table support_private.email_outbox is
  'Private server email delivery queue. IDs only; never publish through Realtime or expose to browser clients.';
