# CustodialSupport Realtime update

## What changed

This bundle contains the complete app source with focused changes to seven dashboard files. Live subscriptions cover profiles, tickets, ticket conversations, withdrawals, notifications, admin activity logs, and admin settings. Client subscriptions use client-scoped Postgres Changes filters. The client profile, withdrawal, and message listeners use safe mirror tables that replicate only full_name and client-visible withdrawal fields, and only public ticket messages. Internal messages and admin_note are not broadcast to client browsers. Existing authentication and RLS policies on the original app tables are unchanged; the SQL adds scoped RLS policies and full replica identity to the three mirror tables so delete filters remain scoped.

The app retains initial database fetching, re-fetches after subscription/reconnection, and re-fetches when the browser returns online or a background tab becomes visible. Channels and browser listeners are removed on unmount. The client Notifications section now reads and displays database notifications.

## Files changed

- app/dashboard/page.tsx
- app/admin/clients/page.tsx
- app/admin/tickets/page.tsx
- app/admin/withdrawals/page.tsx
- app/admin/notifications/page.tsx
- app/admin/activity/page.tsx
- app/admin/settings/page.tsx

## Apply SQL and verify publication membership

In the Supabase SQL Editor for the same project, run:

supabase/migrations/202610300001_enable_realtime_sync.sql

The migration creates and backfills three safe client event tables, adds database triggers, grants authenticated read access guarded by new scoped policies, and adds app tables to supabase_realtime only when they are not already members. It does not replace existing policies on profiles, withdrawals, ticket_messages, or other app tables.

The trigger assumes the schema reflected in the current app code: profiles.id and support_tickets.client_id use UUIDs, profile roles use the value admin, and the listed withdrawal/ticket/message columns exist. Review the column types if your live database differs before applying.

Verify publication membership by running:

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

Confirm the result includes profiles, support_tickets, ticket_messages, withdrawals, notifications, activity_logs, admin_settings, client_profile_realtime, client_withdrawal_realtime, and client_ticket_message_realtime. The project must also have existing SELECT policies that authorize the intended reads from original tables. The mirror policies allow each client to read only its own mirrored rows and allow admins to read all mirror rows. No service-role key is used in the browser.

## Replace the project files

Use the contents of this bundle as the complete project source (dependencies and Git metadata are excluded). To update an existing checkout, replace the seven files listed above and run the SQL migration. Keep your existing environment file and values. Install dependencies with npm install, then start with npm run dev.

## Two-way verification procedure

1. Apply the SQL migration and confirm all ten table names appear in the publication query.
2. Open two separate browser sessions: sign in as an administrator in one and as a client in the other. Keep both dashboards open without refreshing.
3. In the client session, submit a support ticket. Confirm it appears in Admin → Support Tickets within a second or two.
4. Open that ticket in the admin session and send a public reply. Confirm it appears in the client conversation. Reply from the client and confirm it appears in the admin conversation.
5. Change the ticket status as admin. Confirm the client's ticket badge changes immediately.
6. Create a notification for that client in Admin → Notifications. Confirm it appears immediately in the client's Notifications section.
7. Create a withdrawal for the client in Admin → Withdrawals, then change its status or client-visible details. Confirm the client withdrawal list updates immediately. Verify admin notes remain absent from the client dashboard and client Realtime payloads.
8. Change the client's profiles.full_name in an authorized admin/database workflow. Confirm the client name and admin client list update while both remain open.
9. Test recovery by briefly taking a browser offline and back online, or backgrounding then reopening a tab. Confirm the app re-fetches current state without a page reload.
10. Sign in as a second client and confirm the first client's tickets, messages, withdrawals, profile mirror, and notifications never appear. If internal ticket messages are supported by another admin workflow, create one and confirm it is absent from the client conversation and client message mirror.

