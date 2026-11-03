# Customer emails and verified-registration alerts

Implemented locally on 3 November 2026. **Not deployed; the production migration and activation require approval.** No real client emails were sent during implementation.

## Features

- Admin sidebar → Emails (`/admin/emails`), using the existing dashboard layout and colored icon tile.
- Search and paginate registered clients (25 per page). Email addresses are resolved from Supabase Auth on the server, never guessed from profile names. An external recipient can be entered instead.
- One recipient per email, personalized greeting, editable subject and plain-text message, branded responsive HTML with the existing company icon, plus a plain-text alternative. No arbitrary HTML, attachments, CC/BCC, tracking pixels, or sender overrides are accepted.
- Preview in an isolated, sandboxed iframe before an explicit Queue email action. Templates store the name, subject and message, excluding recipient details. Templates can be reused or deleted.
- Paginated history includes recipient, subject, creation time, submission status, submission time, attempt count and safe error diagnostics. The visible History page refreshes every 15 seconds.
- Verified-registration alerts go only to `support@custodialmanagement.net`. They include full name, registered email, registration time (UTC), verification time (UTC), Supabase user ID and verified status. No password, OTP, token, session or Auth metadata dump is included.

## Files for this feature

Created:

| File | Purpose |
| --- | --- |
| `app/admin/emails/page.tsx` | Composer, recipient selection, preview, template library, history |
| `app/api/admin/emails/route.ts` | Authenticated admin-only API; previews, client lookup, templates, enqueue and history |
| `lib/customer-email-content.ts` | Bounded plain-text/email validation |
| `lib/server/admin-email-auth.ts` | Verified bearer-session and database-role checks, service client, bounded JSON reader |
| `lib/server/customer-email.ts` | Customer and registration HTML, existing SMTP transport reuse, safe worker |
| `supabase/migrations/20261103192437_customer_email_management.sql` | Tables, restricted RPCs, verification trigger, retries, existing scheduler integration |
| `tests/customer-email.test.cjs` | Offline API, auth, validation, templates and SMTP-worker tests |
| `tests/customer-email-sql.test.cjs` | Isolated PostgreSQL migration and queue behavior tests |
| `docs/CUSTOMER-EMAILS.md` | This implementation/activation report |

Modified:

- `app/admin/layout.tsx`: Emails navigation item and matching envelope icon tile.
- `app/api/support/email/route.ts`: the existing authenticated scheduler endpoint now runs the two workers independently; client ticket wakeups retain their existing behavior.
- `lib/server/support-email.ts`: exposes the existing validated SMTP configuration, safe error mapping and TLS transport for reuse. Existing ticket recipients and event behavior remain intact.
- `lib/server/email-brand.ts`: optional existing company icon for the new email types. Existing callers retain their original frame behavior.
- `tests/support-email.test.cjs`: mocks the additional worker when testing the existing scheduler route.
- `package.json`: adds the offline customer-email test command.
- `docs/EMAIL-SETUP.md`: links to these activation instructions.

Earlier withdrawal and email-branding changes already present in the working tree are separate work. This feature does not change the six-digit confirmation flow, confirmation template, authentication settings, RLS on existing application tables, contact submission behavior, support-ticket templates, withdrawals or chat.

## Required migration — pending approval

Apply **only** `20261103192437_customer_email_management.sql` after checking its dependencies are already installed. Do not blindly run all local migrations against production.

Dependencies: existing `profiles`, `auth.users`, `support_private.email_outbox`, `support_private.wake_email_recovery()`, Vault secret `custodial_support_email_cron`, and the existing `custodial-support-email-recovery` cron job. The migration reuses that job; it does not create another scheduler or change SMTP/Auth configuration.

New tables:

- `public.customer_email_templates`: saved subjects and messages. RLS enabled; no anonymous/authenticated table grants or policies. Only the verified admin server API uses service-role CRUD.
- `public.customer_email_jobs`: durable admin-message and registration outbox/history. RLS enabled; browser roles have no access. Service role can read history; queue writes occur through restricted functions.
- `support_private.customer_email_activation`: rollout boundary, preventing a flood of alerts for previously verified users.

The verification trigger observes `auth.users.email_confirmed_at`. It inserts a unique `(kind, source_id)` registration event after successful verification, only for a database profile with role `client`. Its guarded enqueue has no network I/O and catches failures so verification can succeed. Scheduled reconciliation recovers missed verified events after activation. Refreshes, logins, repeated verification updates and repeated reconciliations cannot create a second job for the same user.

The migration changes the existing scheduler wake-up predicate to include the new queue and missed verified registrations. Its URL and Vault-backed authentication remain unchanged. **Schema installation itself does not send SMTP messages**, but enabling the application worker afterward will process queued registrations from the activation boundary onward.

## Environment variables

Reuse the existing server settings:

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing user-session verifier |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only queue/admin access |
| `SUPPORT_SMTP_HOST` | Existing Hostinger SMTP hostname |
| `SUPPORT_SMTP_PORT` | Existing `465` (SSL/TLS) or `587` (required STARTTLS) |
| `SUPPORT_SMTP_USER` | Existing support mailbox login |
| `SUPPORT_SMTP_PASSWORD` | Existing secure mailbox credential |
| `CRON_SECRET` | Existing scheduler bearer secret matching Vault |

New server-only switch: **`CUSTOMER_EMAILS_ENABLED=true`** enables admin enqueue and registration dispatch. Leave it unset/false until the migration, server settings and deployment are approved. Never prefix SMTP, service-role or cron credentials with `NEXT_PUBLIC_`. `.env.local` remains ignored; no credentials were added to it for this feature.

## Duplicate prevention, limits and failure behavior

- Admin requests carry a persistent per-draft idempotency UUID. The database also deduplicates identical messages from the same admin to the same recipient within ten minutes, including cross-tab retries with new UUIDs.
- Database transactions/advisory locks enforce 10 admin submissions per admin per 10 minutes, 5 per recipient per hour and 200 admin messages per day globally. The new worker claims at most two jobs per request and respects a 10-attempt/minute ceiling for this queue. Existing support-ticket alerts remain separate.
- Workers use exclusive 180-second leases, stable Message-IDs and lease-token-guarded completion. Known pre-submission/connect/auth failures and explicit temporary SMTP rejection retry with exponential delay, up to six attempts.
- **SMTP is not an exactly-once delivery protocol.** If an SMTP timeout/disconnect leaves acceptance uncertain, or a worker disappears mid-submission, the job is marked `uncertain`/Needs review. It is not automatically resent. Check Hostinger mailbox logs before authorizing any replacement message. Stable Message-ID is an aid to tracing, not a guarantee that a mail provider deduplicates.
- Submitted means the server accepted the recipient; it does not mean delivered/read. Bounce processing or read receipts are not implemented. History stores only allowlisted error codes, not raw SMTP responses or credentials.
- Existing signup and registration never wait for SMTP submission.

## Tests completed

- Production `npm.cmd run build`: passed (includes `/admin/emails` and `/api/admin/emails`).
- TypeScript: passed.
- Targeted lint for the new page, new API/helpers/worker, modified scheduler/SMTP utility and new tests: passed. Broader lint also reports two **pre-existing** `react-hooks/set-state-in-effect` errors in `app/admin/layout.tsx` at the login check and unread-counter reset; those authentication/chat paths were not rewritten for this feature.
- Offline regression run: `node --test tests/auth-flows.test.cjs tests/customer-email.test.cjs tests/email-brand.test.cjs tests/contact-email.test.cjs tests/support-email.test.cjs tests/withdrawal-realtime.test.cjs tests/withdrawal-records.test.cjs`: 23 passing Node test results (several files contain additional assertions).
- Complete migration executed against isolated local PGlite/PostgreSQL with mock Auth/scheduler dependencies: verified-only enqueue, no historical backfill, repeat verification/reconciliation deduplication, secret-free snapshots, fail-open verification and recovery, admin/client permissions, request and content deduplication, address matching, database rate limit, exclusive claims, stale-token rejection, retry delay and expired-lease handling. No production SQL was applied.
- Browser UI reviewed using the actual email page component and built stylesheet in a separate example-data harness. The harness cannot deliver mail and does not bypass authentication in the application. Live authenticated production UI, Hostinger delivery, cron invocation and final inbox rendering remain acceptance tests after approval.

To rerun the SQL test, install `@electric-sql/pglite` in an isolated test directory and pass its absolute module path to `node tests/customer-email-sql.test.cjs <module-path>`. It is a development test runtime, not an application dependency.

## Approval and activation sequence

1. Approve the migration above, production feature-flag change and deployment separately from permission to send test emails. No additional Auth setting/template change is required.
2. Apply that one reviewed migration to the intended Supabase project. Confirm new browser table/RPC access is denied and the existing recovery cron is still active.
3. Configure `CUSTOMER_EMAILS_ENABLED=true` in the intended Vercel production environment, retaining existing SMTP/service/cron settings securely. Deploy the reviewed code; do not commit `.env.local`.
4. With approval, use only an inbox you control for a test email. Check preview, saved-template reuse and one history submission. Repeat the same sending request and confirm only one queued operation.
5. With approval, register a controlled test client. Confirm no registration alert before verification; verify once and check exactly one registration queue row and one support-inbox notification. Refresh, sign in again and repeat verification/reconciliation to confirm no extra notification.
6. Check the scheduler processes the queue without any browser staying open. Test known connection failures, exhaustion and uncertain SMTP acceptance only in an isolated test environment, then restore configuration.
7. Confirm ordinary clients receive 403 from admin email APIs, no secrets appear in browser payloads, and existing confirmation/contact/ticket notifications still work.

No real-client email, production migration, authentication-setting update, repository push or deployment is authorized by the local implementation alone.
