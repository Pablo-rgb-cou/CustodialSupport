-- Client unread-state updates and admin notification maintenance.
-- Clients can change only read_at on their own notices. Admins can edit the
-- content or delete notifications addressed to client profiles.
begin;

grant update (read_at) on table public.notifications to authenticated;
grant delete on table public.notifications to authenticated;

drop policy if exists client_mark_own_notification_read
  on public.notifications;
create policy client_mark_own_notification_read
  on public.notifications
  for update
  to authenticated
  using (
    client_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as client_profile
      where client_profile.id = (select auth.uid())
        and client_profile.role = 'client'
    )
  )
  with check (
    client_id = (select auth.uid())
    and read_at is not null
    and exists (
      select 1
      from public.profiles as client_profile
      where client_profile.id = (select auth.uid())
        and client_profile.role = 'client'
    )
  );

create or replace function public.admin_update_client_notification(
  p_notification_id text,
  p_title text,
  p_message text,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.profiles as admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
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
      type = p_type
  where notification.id::text = p_notification_id
    and exists (
      select 1
      from public.profiles as client_profile
      where client_profile.id = notification.client_id
        and client_profile.role = 'client'
    );

  if not found then
    raise exception 'Notification was not found or is not addressed to a client.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_client_notification(text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_client_notification(text, text, text, text)
  to authenticated;

drop policy if exists admin_delete_client_notifications
  on public.notifications;
create policy admin_delete_client_notifications
  on public.notifications
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = (select auth.uid())
        and admin_profile.role = 'admin'
    )
    and exists (
      select 1
      from public.profiles as client_profile
      where client_profile.id = notifications.client_id
        and client_profile.role = 'client'
    )
  );

commit;
