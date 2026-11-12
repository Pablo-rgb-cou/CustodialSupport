-- Applied to production with user approval on 2026-11-10. Demo only. Never changes a withdrawal's payment/status fields.
begin;
create schema if not exists support_private;
create table public.withdrawal_demo_tokens (
  withdrawal_id uuid primary key references public.withdrawals(id) on delete cascade,
  generation uuid not null default gen_random_uuid(),
  enabled boolean not null default false,
  consumed_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.withdrawal_demo_tokens enable row level security;
revoke all on public.withdrawal_demo_tokens from public, anon, authenticated;
grant select on public.withdrawal_demo_tokens to authenticated;
create policy withdrawal_demo_read on public.withdrawal_demo_tokens for select to authenticated using (
  exists(select 1 from public.withdrawals w where w.id=withdrawal_id and w.client_id=(select auth.uid()))
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
create table support_private.withdrawal_demo_secrets (
  withdrawal_id uuid primary key references public.withdrawals(id) on delete cascade,
  code_hash bytea not null,
  attempts integer not null default 0 check(attempts between 0 and 5)
);
alter table support_private.withdrawal_demo_secrets enable row level security;
revoke all on support_private.withdrawal_demo_secrets from public, anon, authenticated;

-- Definer access is needed only for private hashes and atomic consumption.
-- Every entry point verifies auth.uid()/protected profile role and ownership.
create function public.configure_withdrawal_demo_token(p_withdrawal_id uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text; v_generation uuid:=gen_random_uuid();
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception using errcode='42501',message='Administrator access required';
  end if;
  if p_enabled is null then raise exception 'Choose enabled or disabled'; end if;
  perform 1 from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception using errcode='22023',message='Withdrawal unavailable'; end if;
  if p_enabled then
    v_code:='DEMO-' || upper(replace(gen_random_uuid()::text,'-',''));
    insert into support_private.withdrawal_demo_secrets(withdrawal_id,code_hash,attempts)
      values(p_withdrawal_id,sha256(convert_to(v_code,'UTF8')),0)
      on conflict(withdrawal_id) do update set code_hash=excluded.code_hash,attempts=0;
  else
    delete from support_private.withdrawal_demo_secrets where withdrawal_id=p_withdrawal_id;
  end if;
  insert into public.withdrawal_demo_tokens(withdrawal_id,generation,enabled,consumed_at,expires_at)
    values(p_withdrawal_id,v_generation,p_enabled,null,case when p_enabled then now()+interval '24 hours' else null end)
    on conflict(withdrawal_id) do update set generation=excluded.generation,enabled=excluded.enabled,
      consumed_at=null,expires_at=excluded.expires_at,updated_at=now();
  return jsonb_build_object('code',v_code,'generation',v_generation);
end $$;

create function public.verify_withdrawal_demo_token(p_withdrawal_id uuid,p_generation uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.withdrawal_demo_tokens; v_secret support_private.withdrawal_demo_secrets;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='client') then
    raise exception using errcode='42501',message='Client access required';
  end if;
  perform 1 from public.withdrawals where id=p_withdrawal_id and client_id=auth.uid() for update;
  if not found then raise exception using errcode='42501',message='Withdrawal unavailable'; end if;
  select * into v_state from public.withdrawal_demo_tokens where withdrawal_id=p_withdrawal_id for update;
  if not found or not v_state.enabled or v_state.generation is distinct from p_generation then
    return jsonb_build_object('status','inactive');
  end if;
  if v_state.expires_at<=now() then return jsonb_build_object('status','expired'); end if;
  select * into v_secret from support_private.withdrawal_demo_secrets where withdrawal_id=p_withdrawal_id for update;
  if not found or v_secret.attempts>=5 then return jsonb_build_object('status','locked'); end if;
  -- Invalid input also consumes an attempt; callers cannot bypass the limit.
  if p_code is null or length(p_code)>80 or v_secret.code_hash is distinct from sha256(convert_to(upper(trim(p_code)),'UTF8')) then
    update support_private.withdrawal_demo_secrets set attempts=attempts+1 where withdrawal_id=p_withdrawal_id;
    return jsonb_build_object('status',case when v_secret.attempts>=4 then 'locked' else 'incorrect' end);
  end if;
  update public.withdrawal_demo_tokens set enabled=false,consumed_at=now(),updated_at=now() where withdrawal_id=p_withdrawal_id;
  delete from support_private.withdrawal_demo_secrets where withdrawal_id=p_withdrawal_id;
  return jsonb_build_object('status','success');
end $$;
revoke all on function public.configure_withdrawal_demo_token(uuid,boolean) from public,anon;
revoke all on function public.verify_withdrawal_demo_token(uuid,uuid,text) from public,anon;
grant execute on function public.configure_withdrawal_demo_token(uuid,boolean) to authenticated;
grant execute on function public.verify_withdrawal_demo_token(uuid,uuid,text) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='withdrawal_demo_tokens'
  ) then alter publication supabase_realtime add table public.withdrawal_demo_tokens; end if;
end $$;
commit;
