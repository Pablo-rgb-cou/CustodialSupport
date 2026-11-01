-- Restrict private ticket typing broadcasts to that ticket's client and admins.
-- The payload contains only an actor label and a typing boolean, never draft text.

drop policy if exists ticket_typing_broadcast_read_participants on realtime.messages;
create policy ticket_typing_broadcast_read_participants
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and exists (
      select 1
      from public.support_tickets as ticket
      where realtime.topic() = 'ticket-typing:' || ticket.id::text
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

drop policy if exists ticket_typing_broadcast_send_participants on realtime.messages;
create policy ticket_typing_broadcast_send_participants
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension = 'broadcast'
    and exists (
      select 1
      from public.support_tickets as ticket
      where realtime.topic() = 'ticket-typing:' || ticket.id::text
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
