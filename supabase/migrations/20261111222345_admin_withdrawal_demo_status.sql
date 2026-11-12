-- Admin editor for the existing simulation metadata. Never writes withdrawals.status.
-- Applied with user approval; filename matches the hosted migration history version.
begin;

create function public.set_withdrawal_demo_status(p_withdrawal_id uuid, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if p_status is null or p_status not in ('pending', 'processing', 'completed', 'failed', 'cancelled') then
    raise exception using errcode = '22023', message = 'Choose a valid status';
  end if;
  -- Use the same parent-first lock order as code verification and configuration.
  perform 1 from public.withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Withdrawal unavailable';
  end if;
  update public.withdrawal_demo_tokens
    set demo_status = p_status, updated_at = now()
    where withdrawal_id = p_withdrawal_id
    returning demo_status into v_status;
  if not found then
    raise exception using errcode = '22023', message = 'Token-flow status unavailable';
  end if;
  return v_status;
end $$;

revoke all on function public.set_withdrawal_demo_status(uuid, text) from public, anon;
grant execute on function public.set_withdrawal_demo_status(uuid, text) to authenticated;

commit;
