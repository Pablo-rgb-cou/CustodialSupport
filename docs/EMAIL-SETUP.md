# CustodialSupport email and interface setup

Status checked on 3 November 2026. Official support mailbox: **support@custodialmanagement.net**.

## Completed in the connected accounts

The Hostinger connection can inspect and update DNS; the Mail connection is authenticated to the support mailbox. The Supabase connection can inspect the database and apply migrations. Neither connection exposes the mailbox password, and the available Supabase tools do not manage Auth SMTP settings or email templates.

The approved Hostinger mail switch was applied and verified against the authoritative nameserver:

| Record | Current value |
| --- | --- |
| MX, `@`, priority 5 | `mx1.hostinger.com` |
| MX, `@`, priority 10 | `mx2.hostinger.com` |
| Single SPF TXT, `@` | `v=spf1 include:_spf.mail.hostinger.com include:zohomail.com ~all` |
| DMARC, `_dmarc` | Existing `v=DMARC1; p=none` retained |
| DKIM | All three existing Hostinger DKIM CNAME records retained |

The three Zoho MX records were replaced. The Zoho SPF include remains during the transition. Website A/CNAME records and existing verification records were preserved. MX TTL is 14,400 seconds, so cached records can take up to four hours to expire. This change routes new incoming email to Hostinger; it does not migrate old messages from Zoho. Hostinger DNS snapshot `193670808` records the state before the final MX update; earlier snapshots preserve the earlier transition states.

Rechecked after the user reported hPanel still showing Zoho MX records: both authoritative nameservers (`athena.dns-parking.com` and `apollo.dns-parking.com`), Cloudflare `1.1.1.1`, Google `8.8.8.8`, and Hostinger's zone API all returned the two correct Hostinger MX records. Opening hPanel's current Domain settings page and running **Check status** showed green MX, SPF, DKIM and DMARC checks. The old Zoho warning is no longer present in that refreshed view. No further DNS records were changed during this recheck.

Migration `supabase/migrations/20261103035431_support_ticket_email_outbox.sql` has already been applied to Supabase project `pohraykayzgvukykaaiu`. Do not run the same migration manually again on that project. Apply it normally when setting up another database.

It creates a private email queue and insert triggers for a client's new support ticket and subsequent public replies. Admin replies, internal messages and unauthenticated server inserts do not enqueue alerts. Queue rows contain event and ticket identifiers, without message bodies, photographs or credentials. The queue is protected by RLS, is excluded from Realtime, and cannot be read or processed by ordinary client sessions. Existing ticket/message policies are unchanged. Existing historical messages are not backfilled.

## Prepared application changes

- `app/signup/page.tsx` and `app/signup/SignupFlow.tsx`: signup routes to the dedicated `/verify-email` page, with six-digit verification, signup resend and a 60-second resend cooldown. Only pending email is kept temporarily in session storage; passwords and codes are not stored. The code page also works when storage is unavailable and the registered email is entered manually. Successful verification continues to `/dashboard`.
- `supabase/templates/confirm-signup.html`: branded confirmation template using `{{ .Token }}`.
- `lib/server/support-email.ts`: fixed support recipient/sender, encrypted SMTP, private queue claims, bounded retries, lease ownership and safe diagnostic codes.
- `app/api/support/email/route.ts`: authenticated client wakeup and separately authenticated scheduler endpoint.
- `lib/dispatch-ticket-email.ts` and `app/dashboard/page.tsx`: wake the delivery worker after a successful ticket/reply save. Email errors do not turn a saved chat message into a failed message.
- `app/contact/page.tsx`, `app/api/contact/route.ts` and `lib/server/contact-email.ts`: the contact request form submits to the server and sends to the official support mailbox. The visitor address is Reply-To only. The server validates fields, enforces same-origin JSON requests and a streamed 16 KB limit, and uses a honeypot plus a private, durable email/IP rate limiter. No success is shown unless SMTP accepted the message. Failed submissions retain the form content.

Migration `supabase/migrations/20261103083918_contact_email_rate_limit.sql` is applied on the connected project. It stores hashed rate-limit identities, not contact messages. Only the server role can claim a sending slot. Limits are three per email per hour, five per IP per hour, 40 total per hour and 200 total per day. SMTP configuration is checked before consuming a slot.

Alerts link to the appropriate administrator ticket after normal sign-in checks. They contain an event type, short ticket ID and timestamp, rather than private conversation content. SMTP delivery is at least once: recovery can duplicate an alert if a mail server accepted it immediately before a worker interruption. Each event uses a stable Message-ID.

The worker claims at most two events per invocation, uses a three-minute lease, and retries up to six attempts with increasing delays. Missing credentials leave queued events pending without consuming attempts.

## Authentication configuration and remaining rollout

After the user saved SMTP credentials, custom SMTP was verified enabled with `smtp.hostinger.com`, port `465`, and sender name `CustodialSupport`. A real Supabase Auth invitation test reached the official support inbox from `CustodialSupport <support@custodialmanagement.net>` at 6:01 AM WAT on 3 November 2026. The temporary invitation account was removed, and a database check confirmed no test account remained. The mailbox password was not read or printed.

The approved OTP length **6** and expiry **600 seconds** were saved and verified by reopening the Email provider dialog. The branded Confirm Signup template and subject `Verify your CustodialSupport email` were installed and verified after reload. The preview contains only the new branded body, with `{{ .Token }}` for the actual code.

The **Confirm email** switch remains **off** intentionally: the live website still displays its older signup screen, which does not accept verification codes. Deploy the prepared new signup screen, verify its code-entry step, then enable the already-approved confirmation requirement. This coordinates the production rollout without stranding new users. No Git push or deployment was performed in this step.

The SMTP settings are available at [Supabase SMTP settings](https://supabase.com/dashboard/project/pohraykayzgvukykaaiu/auth/smtp):

| Field | Value |
| --- | --- |
| Sender name | `CustodialSupport` |
| Sender email | `support@custodialmanagement.net` |
| SMTP host | `smtp.hostinger.com` |
| SMTP port | `465` with SSL/TLS; alternatively `587` with STARTTLS |
| SMTP username | `support@custodialmanagement.net` |
| SMTP password | Saved directly by the user; not retrieved by the agent |

Password recovery and invitation templates were not changed. The approved Site URL correction to `https://www.custodialmanagement.net` is saved and verified after reload. Eight exact allowed redirects are saved: `/reset-password`, `/reset-password?returnTo=Settings`, `/dashboard` and `/verify-email`, each on `https://www.custodialmanagement.net` and `http://localhost:3000`. There are no new wildcard redirects.

Signup-code delivery, expired-code rejection and the complete new-user verification flow remain to be tested after that coordinated rollout. The invitation test proves the saved SMTP transport and inbox delivery, rather than completion of the signup flow.

The ticket-alert worker needs the following **server-only** variables in Vercel project settings, and locally only if local delivery is wanted:

| Variable | Value |
| --- | --- |
| `SUPPORT_SMTP_HOST` | `smtp.hostinger.com` |
| `SUPPORT_SMTP_PORT` | `465` or `587` matching the secure mode above |
| `SUPPORT_SMTP_USER` | `support@custodialmanagement.net` |
| `SUPPORT_SMTP_PASSWORD` | Enter the mailbox password securely |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Use the project's existing server credential |
| `CRON_SECRET` | A random secret of at least 32 characters, entered securely |

Existing public Supabase URL/publishable-key variables remain required. Do not add `NEXT_PUBLIC_` to any SMTP or service secret. The application does not log SMTP credentials or raw mail errors. `.env.local` was not modified or staged.

Vercel team authorization is now working. Metadata-only checks with decryption disabled confirmed the existing Supabase URL, publishable key and server secret. Production now also has `SUPPORT_SMTP_HOST`, `SUPPORT_SMTP_PORT` and `SUPPORT_SMTP_USER`. The user entered `SUPPORT_SMTP_PASSWORD` directly in Vercel; its presence and sensitive type were verified without reading its value. A dedicated cryptographically generated recovery token is stored in Supabase Vault and Vercel's sensitive Production `CRON_SECRET`, without printing it or writing it to the repository. Local `.env.local` remains unchanged; local SMTP delivery is not configured.

Supabase Cron recovery is installed **inactive**, using migrations `20261103132447_support_email_recovery_scheduler.sql` and `20261103133444_support_email_private_scheduler_transport.sql`. It checks for due queue work every minute and calls the fixed HTTPS worker URL. The token is read from Vault at execution time and used only in an Authorization header. The final implementation uses synchronous `http`, so it never persists decrypted headers in `pg_net` request tables; the temporary unused `pg_net` extension was removed. The wake function is database-only and returns an HTTP status or a generic failure code, without logging raw errors. Browser and service roles cannot execute it or read Vault. No network call occurs with an empty queue.

The production email endpoint currently returns HTTP 404 because the new application has not been deployed. Keep the job inactive until the routes and Production environment are deployed and controlled contact/ticket delivery tests succeed. Then activate it with:

```sql
select cron.alter_job(jobid, active := true)
from cron.job
where jobname = 'custodial-support-email-recovery';
```

Deactivate with the same query using `active := false`. Inspect job status/history without exposing Vault values or request headers. Client wakeups handle prompt delivery; Cron handles interrupted requests and retries. No Vercel Pro upgrade is needed for this Supabase schedule.

## Interface and navigation changes

The admin ticket list and client withdrawal card reserve five visible rows, divide actual entries with faint lines, and scroll internally when more entries exist. Withdrawal details use a responsive modal with asset icons, wallet/details and an X close control; the duplicate Reference field is removed. Admin chat now explicitly tells the parent dashboard layout when a conversation is open, removing outer content padding and rounding. Its composer anchors to the viewport and only the transcript scrolls. X restores the ticket list. Shared scroll-lock ownership safely handles overlapping chat, mobile menu and photo viewer, and releases on navigation.

Auth pages share a compact safe-area-aware layout. Very short screens and an open keyboard can scroll inside the form to keep required controls reachable. Internal links and administrator ticket deep links were corrected. Password recovery started in Settings returns to Settings while preserving the session. Real session revocation/expiry requires sign-in again; a temporary network failure shows retry instead of claiming the session ended. A shared activity timestamp ends a session after 60 minutes of inactivity without browser navigation extending an already expired timestamp.

Official support contact links/defaults use the support mailbox above. Account-specific login email addresses and generic login placeholders retain their purpose. New PNG, Apple touch and ICO assets use the existing CustodialSupport shield. Versioned metadata URLs request the updated icons after deployment; browser/Safari caches cannot be forcibly cleared for every visitor. Authentication storage was not cleared.

## Validation completed

- `npx tsc --noEmit --incremental false`: passed.
- Targeted ESLint for new signup/code-entry, contact, server email and shared admin chat modules: passed. Existing admin route files retain their pre-existing hook lint findings; a clean application-wide lint run is not claimed.
- `npm run test:auth`: 17 tests passed, including six-digit verification, invalid/expired-code handling, storage-free code entry, resend, recovery return and idle handling. Auth calls in these tests are mocked.
- `npm run test:email`: offline tests passed for TLS, missing configuration, fixed addresses, ownership, scheduler authorization and retry handling.
- `npm run test:contact`: offline validation, fixed recipient/Reply-To, TLS, origin/body limit, rate-limit and success/failure handling tests passed.
- `npm run test:withdrawals`: render checks passed for 0, 1, 2, 5, 6 and 12 entries and modal details.
- Database transaction test `tests/support-email-queue.sql`: passed on the connected project; all fixtures were rolled back. It checked enqueue exclusions, lease tokens, retry delay, final abandoned lease and browser isolation.
- Database transaction test `tests/contact-rate-limit.sql`: passed on the connected project; fixtures rolled back. It checked limiter caps and browser-role isolation.
- Read-only database test `tests/support-email-scheduler.sql`: passed. Vault and scheduler function access remain private, the job contains no credential, and the shared request queue is absent. The dedicated HTTP transport reached the production endpoint and returned 404, confirming it still needs deployment. The job remains inactive.
- The earlier 17 application routes returned HTTP 200 with the branded title; literal internal route targets and favicon/image HTTP responses were checked. The new `/verify-email` page was also opened successfully in Chrome, showing registered-email and six-digit-code fields.
- Admin chat visual checks passed at desktop 1536×730, mobile 390×844 and short mobile 375×480. The composer reaches the bottom and document scrolling is locked; X/navigation restores normal scrolling.
- `git diff --check`: passed.

The local production build failure is now resolved with a supported bundler configuration. The original Turbopack build consistently crashed while starting the Tailwind/CSS worker, including outside the sandbox. `npm run build` now uses `next build --webpack`; Tailwind uses the official `@tailwindcss/postcss` 4.3.3 plugin in `postcss.config.mjs`, replacing the bundler-specific loader and its unused dependency. `next dev` retains the default development bundler and the project-specific root. No application styling or font definitions were changed.

`npm run build` completed successfully: compilation, TypeScript, all 24 static generation tasks, page optimization and build traces. `npm start -- --hostname 127.0.0.1 --port 3200` started the built application in production mode. Nineteen page URLs returned HTTP 200 with the branded metadata, generated Tailwind CSS and icon assets loaded, and cross-origin email API requests were rejected. Chrome confirmed compiled gradient/spacing styles and no console errors on `/verify-email`. These checks establish build/runtime readiness; authenticated and live email delivery acceptance remains a separate rollout step.

## Remaining coordinated rollout

1. Obtain the user's requested approval for Git push, excluding `.env.local`, then verify a successful Vercel deployment of the new code and Production variables. If the build fails, resolve it before claiming the changes are live.
2. Confirm `/verify-email` and the two email API routes exist on the deployed domain. Enable the previously approved Supabase **Confirm email** requirement only after the new signup page is live.
3. Perform actual signup-code delivery/verification, public contact-form delivery, and client-ticket/reply email tests using controlled test data and the official support inbox. The earlier successful Auth invitation establishes SMTP transport only; it does not prove these new application paths.
4. Activate the prepared recovery job after controlled delivery tests pass; verify a scheduled recovery run. Neither the confirmation requirement nor recovery scheduler is active yet.

## Live acceptance procedure after secure configuration

1. Create a new test client with an email inbox you control. Confirm no dashboard session is issued before verification. Check that a branded email arrives with six digits, and that a valid code creates the session.
2. Verify an incorrect/expired code is rejected and resend works after the cooldown. Check the 10-minute expiry and that a code cannot be reused.
3. Create a ticket and send another public client reply. Each should produce one queued event and an alert in the official support inbox. Open each admin link and confirm the correct ticket is selected after authentication.
4. Send an admin reply and an internal message. Confirm neither creates a support-mail alert. Confirm client/admin chat still updates normally.
5. Exercise a controlled SMTP failure in a test environment, then restore configuration. Confirm the chat remains saved, the queue retries and the recovery scheduler drains it. Check pending/failed counts without exposing client content or secrets.
6. Navigate between dashboard sections, use browser Back/Forward, reload and return from password reset. Confirm the session remains until sign-out, real revocation or the inactivity limit. Check five-row scrolling, both chat composers, withdrawal modal and keyboard layouts on real iOS/Android devices.

## Reference documentation

- [Hostinger SMTP configuration](https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/)
- [Hostinger email DNS records](https://www.hostinger.com/support/8671319-set-up-a-domain-for-hostinger-email-manually/)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Vercel cron usage and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
