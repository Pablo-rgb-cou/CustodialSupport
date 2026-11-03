-- LOCAL/PENDING APPROVAL. Do not apply to production before review.
-- Browser roles cannot read or mutate email content; access is via admin routes.
create table public.customer_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  subject text not null check (length(subject) between 1 and 160),
  message text not null check (length(message) between 1 and 12000),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.customer_email_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('admin_email','registration')),
  source_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  recipient_name text not null check (length(recipient_name) <= 100),
  recipient_email text not null check (length(recipient_email) <= 254),
  subject text not null check (length(subject) between 1 and 160),
  message text not null check (length(message) between 1 and 12000),
  -- Snapshots contain only name/email/id and registration/verification dates.
  registration_details jsonb,
  status text not null default 'queued' check (status in ('queued','processing','submitted','failed','uncertain')),
  attempts smallint not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  attempted_at timestamptz,
  submitted_at timestamptz,
  error_code text check (error_code in ('SMTP_AUTH','SMTP_TIMEOUT','SMTP_CONNECT','SMTP_REJECTED','SMTP_SEND','LEASE_EXPIRED','INVALID_JOB')),
  created_at timestamptz not null default now(),
  unique(kind, source_id),
  check ((status='processing' and lease_token is not null and lease_until is not null)
      or (status<>'processing' and lease_token is null and lease_until is null))
);
alter table public.customer_email_templates enable row level security;
alter table public.customer_email_jobs enable row level security;
revoke all on public.customer_email_templates, public.customer_email_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.customer_email_templates to service_role;
grant select on public.customer_email_jobs to service_role;
create index customer_email_queue_due on public.customer_email_jobs(next_attempt_at,created_at) where status='queued';
create index customer_email_actor_rate on public.customer_email_jobs(actor_id,created_at) where kind='admin_email';
create index customer_email_history on public.customer_email_jobs(created_at desc);
create index customer_email_attempt_rate on public.customer_email_jobs(attempted_at) where attempted_at is not null;

-- Remember activation time: no notifications for old registrations on rollout.
create table support_private.customer_email_activation (
  singleton boolean primary key default true check(singleton), started_at timestamptz not null default now()
);
insert into support_private.customer_email_activation(singleton) values(true);
revoke all on support_private.customer_email_activation from public, anon, authenticated;

create function public.enqueue_admin_customer_email(p_actor uuid,p_request_id uuid,p_client_id uuid,p_name text,p_email text,p_subject text,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_existing public.customer_email_jobs; v_email text:=lower(trim(p_email));
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception using errcode='42501',message='Administrator access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('customer-email-enqueue',0));
  select * into v_existing from public.customer_email_jobs where kind='admin_email' and source_id=p_request_id;
  if found then
    if v_existing.actor_id is distinct from p_actor or v_existing.recipient_email<>v_email or v_existing.subject<>p_subject or v_existing.message<>p_message or v_existing.recipient_name<>p_name or v_existing.client_id is distinct from p_client_id then
      raise exception using errcode='22023',message='Request ID already used for different content';
    end if;
    return v_existing.id;
  end if;
  if length(p_name)>100 or length(p_subject) not between 1 and 160 or length(p_message) not between 1 and 12000 or length(v_email)>254 or v_email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  if p_client_id is not null and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_client_id and p.role='client' and lower(u.email)=v_email) then raise exception using errcode='22023',message='Client email does not match'; end if;
  -- A second tab or a refreshed composer may generate a new request UUID.
  -- Treat identical submissions within ten minutes as the same operation.
  select id into v_id from public.customer_email_jobs where kind='admin_email'
    and actor_id=p_actor and recipient_email=v_email and recipient_name=p_name
    and client_id is not distinct from p_client_id and subject=p_subject and message=p_message
    and created_at>now()-interval '10 minutes' order by created_at desc limit 1;
  if found then return v_id; end if;
  if (select count(*) from public.customer_email_jobs where actor_id=p_actor and created_at>now()-interval '10 minutes')>=10
     or (select count(*) from public.customer_email_jobs where kind='admin_email' and created_at>now()-interval '1 day')>=200
     or (select count(*) from public.customer_email_jobs where kind='admin_email' and recipient_email=v_email and created_at>now()-interval '1 hour')>=5 then
    raise exception using errcode='P0001',message='EMAIL_RATE_LIMIT';
  end if;
  insert into public.customer_email_jobs(kind,source_id,actor_id,client_id,recipient_name,recipient_email,subject,message)
  values('admin_email',p_request_id,p_actor,p_client_id,p_name,v_email,p_subject,p_message) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.enqueue_admin_customer_email(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_admin_customer_email(uuid,uuid,uuid,text,text,text,text) to service_role;

create function support_private.capture_verified_registration()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op='UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if exists(select 1 from public.profiles where id=new.id and role='client') then
    insert into public.customer_email_jobs(kind,source_id,client_id,recipient_name,recipient_email,subject,message,registration_details)
    select 'registration',new.id,new.id,'Support team','support@custodialmanagement.net','New Client Registration — CustodialSupport','A new client has completed email verification.',
      jsonb_build_object('full_name',left(coalesce(p.full_name,''),100),'email',new.email,'user_id',new.id,'registered_at',new.created_at,'verified_at',new.email_confirmed_at)
    from public.profiles p where p.id=new.id and p.role='client'
    on conflict(kind,source_id) do nothing;
  end if;
  return new;
exception when others then
  -- Fail open: a queue outage must never block successful verification.
  -- The scheduler reconciles missed events; no secrets or PII in diagnostics.
  raise warning 'CUSTOMER_REGISTRATION_ENQUEUE_FAILED';
  return new;
end $$;
revoke all on function support_private.capture_verified_registration() from public,anon,authenticated,service_role;
create trigger zz_customer_registration_email after insert or update of email_confirmed_at on auth.users
for each row execute function support_private.capture_verified_registration();

create function public.reconcile_verified_registration_emails()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  insert into public.customer_email_jobs(kind,source_id,client_id,recipient_name,recipient_email,subject,message,registration_details)
  select 'registration',u.id,u.id,'Support team','support@custodialmanagement.net','New Client Registration — CustodialSupport','A new client has completed email verification.',
    jsonb_build_object('full_name',left(coalesce(p.full_name,''),100),'email',u.email,'user_id',u.id,'registered_at',u.created_at,'verified_at',u.email_confirmed_at)
  from auth.users u join public.profiles p on p.id=u.id
  where p.role='client' and u.email_confirmed_at >= (select started_at from support_private.customer_email_activation where singleton)
    and not exists(select 1 from public.customer_email_jobs j where j.kind='registration' and j.source_id=u.id)
  order by u.email_confirmed_at limit 100 on conflict(kind,source_id) do nothing;
  get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.reconcile_verified_registration_emails() from public,anon,authenticated;
grant execute on function public.reconcile_verified_registration_emails() to service_role;

create function public.claim_customer_email_jobs()
returns setof public.customer_email_jobs language plpgsql security definer set search_path='' as $$
declare v_capacity integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('customer-email-dispatch',0));
  -- A crashed worker may already have submitted to SMTP. Never blindly resend.
  update public.customer_email_jobs set status='uncertain',error_code='LEASE_EXPIRED',lease_token=null,lease_until=null
  where status='processing' and lease_until<=now();
  select greatest(0,10-count(*))::integer into v_capacity from public.customer_email_jobs where attempted_at>now()-interval '1 minute';
  if v_capacity=0 then return; end if;
  return query with picked as (
    select id from public.customer_email_jobs where status='queued' and next_attempt_at<=now() and attempts<6
    order by created_at,id limit least(2,v_capacity) for update skip locked
  ) update public.customer_email_jobs j set status='processing',attempts=j.attempts+1,attempted_at=now(),lease_token=gen_random_uuid(),lease_until=now()+interval '180 seconds'
  from picked where j.id=picked.id returning j.*;
end $$;
revoke all on function public.claim_customer_email_jobs() from public,anon,authenticated;
grant execute on function public.claim_customer_email_jobs() to service_role;

create function public.finish_customer_email_job(p_id uuid,p_lease uuid,p_outcome text,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_outcome not in ('submitted','retry','failed','uncertain') then raise exception 'Invalid outcome'; end if;
  update public.customer_email_jobs set
    status=case when p_outcome='retry' then case when attempts>=6 then 'failed' else 'queued' end else p_outcome end,
    submitted_at=case when p_outcome='submitted' then now() else null end,
    next_attempt_at=now()+make_interval(secs=>least(3600,(60*power(2,attempts-1))::integer)),
    error_code=case when p_outcome='submitted' then null when p_error in ('SMTP_AUTH','SMTP_TIMEOUT','SMTP_CONNECT','SMTP_REJECTED','SMTP_SEND','INVALID_JOB') then p_error else 'SMTP_SEND' end,
    lease_token=null,lease_until=null
  where id=p_id and status='processing' and lease_token=p_lease;
  get diagnostics v_count=row_count;return v_count=1;
end $$;
revoke all on function public.finish_customer_email_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_customer_email_job(uuid,uuid,text,text) to service_role;

-- Reuse the existing Vault-backed scheduler endpoint. Do not create a second job.
create or replace function support_private.wake_email_recovery()
returns bigint language plpgsql security invoker set search_path='' as $$
declare bearer text; response_status integer;
begin
  if not exists(select 1 from support_private.email_outbox where (status='pending' and next_attempt_at<=now()) or (status='processing' and lease_until<=now()))
    and not exists(select 1 from public.customer_email_jobs where (status='queued' and next_attempt_at<=now()) or (status='processing' and lease_until<=now()))
    and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where p.role='client' and u.email_confirmed_at >= (select started_at from support_private.customer_email_activation where singleton) and not exists(select 1 from public.customer_email_jobs j where j.kind='registration' and j.source_id=u.id)) then return null; end if;
  select decrypted_secret into bearer from vault.decrypted_secrets where name='custodial_support_email_cron';
  if bearer is null or length(bearer)<32 then return null; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','55000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','8000');
  select status into response_status from extensions.http(('GET','https://www.custodialmanagement.net/api/support/email',array[extensions.http_header('Authorization','Bearer '||bearer)],null,null)::extensions.http_request);
  return response_status;
exception when others then return -1;
end $$;
revoke all on function support_private.wake_email_recovery() from public,anon,authenticated,service_role;
