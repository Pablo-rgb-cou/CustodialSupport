begin;

alter table public.notifications
  add column if not exists is_popup boolean not null default false;

create or replace function public.admin_update_client_notification(
  p_notification_id text,
  p_title text,
  p_message text,
  p_type text,
  p_is_popup boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_title, ''))) not between 1 and 200
     or length(trim(coalesce(p_message, ''))) not between 1 and 5000
     or p_type is null
     or p_type not in ('info', 'success', 'warning', 'error') then
    raise exception 'Notification title, message, or type is invalid.' using errcode = '22023';
  end if;

  update public.notifications as notification
  set title = trim(p_title),
      message = trim(p_message),
      type = p_type,
      is_popup = coalesce(p_is_popup, false)
  where notification.id::text = p_notification_id
    and exists (
      select 1 from public.profiles as client_profile
      where client_profile.id = notification.client_id
        and client_profile.role = 'client'
    );

  if not found then
    raise exception 'Notification was not found or is not addressed to a client.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_client_notification(text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_update_client_notification(text, text, text, text, boolean) to authenticated;

commit;
