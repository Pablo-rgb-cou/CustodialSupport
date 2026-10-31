-- Allow authenticated administrators to create notifications for client profiles.
-- RLS remains responsible for restricting which authenticated users may insert.
begin;

alter table public.notifications enable row level security;

grant select, insert on table public.notifications to authenticated;
revoke all on table public.notifications from anon;

drop policy if exists read_client_notifications on public.notifications;
create policy read_client_notifications
  on public.notifications
  for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles as admin_profile
      where admin_profile.id = (select auth.uid())
        and admin_profile.role = 'admin'
    )
  );

drop policy if exists admin_insert_client_notifications on public.notifications;
create policy admin_insert_client_notifications
  on public.notifications
  for insert
  to authenticated
  with check (
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
