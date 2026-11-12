# Withdrawal demos and one-time demo codes

Production migration applied and verified on 2026-11-10 (Supabase migration version 20261110124047). Frontend changes remain local; deployment is pending.

## Preview

- Client dashboard → Withdrawals: a separate **Client preview · Demo only** card opens the existing fee/QR simulation. Its QR contains demo text and its addresses are deliberately invalid. Nothing is submitted, charged, saved, or accelerated. Clients cannot simulate administrator approval.
- Client withdrawal details: the record reference is removed, including the list fallback when no wallet exists. Wallet addresses remain shortened and copyable.
- Admin → Withdrawals → each record's update-status cell: enable **Demo only · Token code**. Enabling generates a code automatically. Copy the code while it is displayed; only its hash is stored privately. Generate a new code if the displayed code is lost.
- Client → matching withdrawal details: enter the generated demo code. Success removes the form. Reloading does not restore a consumed code. The administrator sees completion and can enable a new exercise.
- Codes expire after 24 hours and lock after five wrong attempts. Disabling or regenerating invalidates the previous code. No payment/status fields are changed.

## Required SQL

Applied migration (do not rerun):

`supabase/migrations/20261110124047_withdrawal_demo_tokens.sql`

It adds public, RLS-protected demo metadata, a private hash table, two authenticated and authorized RPC functions, and adds only the metadata table to `supabase_realtime` if that publication exists. Existing Auth, withdrawal policies, and payment/status data are unchanged. No new environment variables are required.

Before the migration is installed, admin controls show an unavailable message and client token forms remain hidden. The independent fee/QR preview still works. Admin token choices in that preview are local to that preview; they are not published as withdrawal/payment settings.

## Verification

1. Use separate admin and client browser sessions. Enable a demo code for one of the client's withdrawals and copy it.
2. Open that withdrawal's client details. The entry form should appear without a page reload. Another client's withdrawal details must not expose the form or code.
3. Submit an incorrect code: expect an error, no status change, and no success message.
4. Submit the correct code: expect success and the input to disappear. Close/reopen or refresh: the input stays absent. Admin sees completion.
5. Regenerate and test the old code: it must fail. Disable the new code: its entry form disappears. Five wrong attempts require regeneration.
6. Open the client fee preview and follow priority → token → sample QR → simulated submission. Confirm there is no client approval control and no real payment destination.

Local checks: `node tests/withdrawal-records.test.cjs`, `node tests/withdrawal-realtime.test.cjs`, `node tests/withdrawal-demo-ui.test.cjs`, and `node tests/withdrawal-demo-db.test.cjs`. The database test requires a separately installed `@electric-sql/pglite` (set `PGLITE_MODULE_PATH` to its module path); it never contacts Supabase. It exercises the actual migration in a disposable database, including authorization, RLS, attempts, expiry, regeneration, disabling, and consumption.

Also run TypeScript, scoped ESLint and `npm.cmd run build`. Real cross-browser Realtime testing still requires the approved migration in the target environment.

## Automatic demo-status advancement (applied 2026-11-10)

The applied migration is `supabase/migrations/20261110183442_withdrawal_demo_status.sql`. It stores a separate `demo_status` and `auto_advance` flag on the existing demo metadata table. The admin sees **Advance demo status automatically** once the migration is applied; turning it off prevents later code submissions from advancing the preview. It does not reverse an earlier step.

A correct, enabled, unused code moves the displayed **Demo status** from Pending to Processing or Processing to Completed. A new code must be generated for each step. Terminal statuses stay terminal. Wrong, expired, locked, disabled, and already consumed codes do not advance it. The preview appears beneath the token control in client details and admin controls. The actual withdrawal status, badges, amounts, and payment fields remain untouched.

Code validation and preview advancement happen atomically under the same withdrawal lock. Only administrators may change the advancement switch. The database tests now execute both migrations and verify switch-off behavior, both transitions, terminal-state behavior, and unchanged withdrawal status. Migration applied with user approval and permissions verified. Local production build passed; no push or deployment performed.

## Preview presentation

Withdrawal rows and details use the same presentation in development and production. The former NODE_ENV-based label rule has been removed. The existing client demo card explains that token-driven status changes, token codes, and the fee flow are simulations; code acceptance does not verify payment or release funds. This presentation change does not alter validation, stored data, or status advancement.

Unchecking **Advance status automatically** hides the bottom Status bar immediately in admin controls and via Realtime in the client's open details. Rechecking restores the saved bar. Failed toggle saves roll back the checkbox and bar together. This visibility choice does not erase or reverse the preview status already reached, so list and top Current status remain consistent.

The client details dialog has no repeated Demo preview header or Simulated label, and list rows have no preview suffix. The shared demo card carries the broader notice. The top Current status badge and bottom Status label share the same preview value, including Realtime changes and reopening the dialog. The admin table has one Demo preview notice above the token controls; individual controls use plain Status / Advance status automatically / Token code accepted labels. The regular admin status dropdown and stored withdrawal status continue to represent the underlying record. No database changes are required for these presentation updates.

The client withdrawal list subscribes to preview metadata for the displayed withdrawal IDs, using ownership RLS and batched ID filters. Row status labels and status search use the same preview as the details dialog. Initial fetch, subscription recovery, returning to the tab, and reconnecting all reconcile the preview. Late snapshots cannot overwrite newer events, and temporary query failures preserve the last confirmed display. Stored withdrawal records remain unchanged. Verify a correct code changes both the list row and details from Pending to Processing without refreshing; repeat with a new code for Completed. Run `node tests/withdrawal-preview-statuses.test.cjs` for scoped subscriptions, live updates, stale-fetch handling, reconnection, deletion fallback, and cleanup coverage.

Admin rows reuse the same scoped preview-status subscription. Their status badges, summary counts, page filter, and row editor agree with the client's token-flow status. When a preview status exists, the row editor calls the admin-only `set_withdrawal_demo_status` RPC; otherwise it retains the existing saved-record update path. A successful preview edit refreshes the snapshot, and Postgres Changes updates other open dashboards. Missing RPC setup shows an error and never falls back to changing the real withdrawal. Preview status changes never silently write to the saved withdrawal. `node tests/admin-withdrawal-status.test.cjs` and `node tests/admin-withdrawal-editor.test.cjs` check visible-status parity, filtering, totals, editor routing, unauthorized refusal, and preserved saved records.

The new function was applied to Supabase project `pohraykayzgvukykaaiu` with user approval on 11 November 2026. Supabase recorded version `20261111222345`; the local file is aligned as `supabase/migrations/20261111222345_admin_withdrawal_demo_status.sql` (original reviewed filename: `20261111215953_admin_withdrawal_demo_status.sql`). It validates the administrator's protected profile role and status enum, locks rows in the same order as verification, and changes only existing demo metadata. It does not change RLS policies, authentication settings, code validity, auto-advance preferences, or `public.withdrawals.status`. The offline PGlite tests execute all three migrations and exercise manual status edits and denied client/anonymous calls.

Hosted verification confirmed the function exists with an empty search_path, denies anonymous execution, grants authenticated execution subject to its internal administrator check, and writes only demo metadata. An unauthenticated invocation was rejected. RLS on both withdrawal tables and the demo metadata's Realtime publication membership remain enabled. No real withdrawal was edited during verification. Browser acceptance testing still needs separate authenticated admin/client sessions; code was not pushed or deployed.

The security advisor lists the new function under [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); the authenticated grant is intentional and its administrator guard is checked both offline and in the hosted database. Existing unrelated anonymous-function and Auth password-protection advisories were not changed.
