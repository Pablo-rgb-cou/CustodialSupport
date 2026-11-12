-- Applied with user approval on 2026-11-10. Displayed demo status only; no withdrawal/payment updates.
begin;
alter table public.withdrawal_demo_tokens
  add column auto_advance boolean not null default true,
  add column demo_status text check (demo_status in ('pending','processing','completed','failed','cancelled'));
create function public.set_withdrawal_demo_auto_advance(p_withdrawal_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception using errcode='42501',message='Administrator access required';
  end if;
  if p_enabled is null then raise exception using errcode='22023',message='Choose enabled or disabled'; end if;
  perform 1 from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception using errcode='22023',message='Withdrawal unavailable'; end if;
  update public.withdrawal_demo_tokens set auto_advance=p_enabled,updated_at=now() where withdrawal_id=p_withdrawal_id;
  if not found then raise exception using errcode='22023',message='Enable a token code first'; end if;
end $$;
revoke all on function public.set_withdrawal_demo_auto_advance(uuid,boolean) from public,anon;
grant execute on function public.set_withdrawal_demo_auto_advance(uuid,boolean) to authenticated;
create or replace function public.verify_withdrawal_demo_token(p_withdrawal_id uuid,p_generation uuid,p_code text)
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
  -- Advance only the clearly labelled preview. Never write public.withdrawals.
  update public.withdrawal_demo_tokens set enabled=false,consumed_at=now(),updated_at=now(),
    demo_status=case when auto_advance then
      case coalesce(demo_status,(select w.status from public.withdrawals w where w.id=p_withdrawal_id))
        when 'pending' then 'processing' when 'processing' then 'completed'
        else coalesce(demo_status,(select w.status from public.withdrawals w where w.id=p_withdrawal_id)) end
      else demo_status end
    where withdrawal_id=p_withdrawal_id
    returning * into v_state;
  delete from support_private.withdrawal_demo_secrets where withdrawal_id=p_withdrawal_id;
  return jsonb_build_object('status','success','demo_status',v_state.demo_status);
end $$;

commit;
