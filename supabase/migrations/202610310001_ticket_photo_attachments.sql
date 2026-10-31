begin;

-- Private, image-only ticket attachments. Messages store only a relative
-- object path; the client and admin create short-lived signed URLs as needed.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ticket_attachments_participant_read
  on storage.objects;
create policy ticket_attachments_participant_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1
      from public.support_tickets as ticket
      where ticket.id::text = (storage.foldername(name))[1]
        and (
          ticket.client_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles as profile
            where profile.id = (select auth.uid())
              and profile.role = 'admin'
          )
        )
    )
  );

drop policy if exists ticket_attachments_participant_insert_own
  on storage.objects;
create policy ticket_attachments_participant_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.support_tickets as ticket
      where ticket.id::text = (storage.foldername(name))[1]
        and (
          ticket.client_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles as profile
            where profile.id = (select auth.uid())
              and profile.role = 'admin'
          )
        )
    )
  );

drop policy if exists ticket_attachments_uploader_delete_own
  on storage.objects;
create policy ticket_attachments_uploader_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.support_tickets as ticket
      where ticket.id::text = (storage.foldername(name))[1]
        and (
          ticket.client_id = (select auth.uid())
          or exists (
            select 1
            from public.profiles as profile
            where profile.id = (select auth.uid())
              and profile.role = 'admin'
          )
        )
    )
  );

commit;
