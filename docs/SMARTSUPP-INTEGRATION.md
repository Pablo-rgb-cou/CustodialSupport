# Client-dashboard live chat

## Option B update — 10 November 2026

This section supersedes the earlier always-deny consent implementation described
below. No commit, push or deployment was performed.

- `app/components/SmartsuppChat.tsx` now provides a compact, responsive privacy
  panel with independent, initially unchecked analytics, marketing and
  profile-name-sharing choices. Clients may Reject optional, Save choices,
  or reopen Chat privacy choices. All app choices reset on page refresh/sign-out.
- `lib/smartsupp-lifecycle.ts` accepts explicit consent changes only while an
  authenticated client runtime is mounted on `/dashboard`. Only the documented
  `analyticsConsent`, `marketingConsent`, and optional `name` commands are used.
  There is no recording API, email/phone/ID identification, financial data,
  automatic message sending, or private ticket synchronization with Smartsupp.
- Name sharing requires a separate opt-in. Removing that opt-in creates a fresh
  visitor context through document navigation. Previously sent information may
  remain in Smartsupp history; revocation does not retroactively erase it.
- `app/dashboard/page.tsx` supplies the display name to the component locally;
  it is sent to Smartsupp only after the separate explicit name-sharing choice.
- `app/globals.css` conceals the privacy panel under existing modal dialogs.
- `tests/smartsupp.test.cjs` now includes independent consent/revocation and
  server-rendered default-checkbox/responsive-boundary checks: 17 tests pass.
  The 17 existing Auth tests also pass. Changed helpers/components are lint-clean.
  The production build passes. Its first attempt hit a Windows EPERM directory
  creation error; an approved rerun completed successfully. `git diff --check`
  also passes. The repository-wide lint baseline still has pre-existing errors
  described below; it is not claimed clean.

The user reports Cookie consent enabled and IP tracking disabled. The previous
console warning has NOT yet been reverified against the saved live account.
Windows Firefox inspection was blocked by the computer-use URL policy in the
preceding turn. No authenticated account settings were inspected or modified.
The new consent panel's responsive classes and server-rendered controls were
tested; prior actual-widget viewport tests below are not a new real-device test
of this new panel. Real client/admin sessions and mobile keyboard tests remain.

### Monitoring behavior and limits

Live chat/basic visitor presence remain available without optional tracking.
The integration does not force analytics or marketing consent. Named online
visitors require name-sharing consent; anonymous visitors cannot reliably be
matched to a registered client. Smartsupp account/package limitations still apply.
Its current help states browsing history requires cookie consent, installed
tracking code and a visitor message/interaction; simply browsing is not enough.
Dashboard section changes use existing URL history navigation; no custom tracker
copies component content, transaction information or ticket text. The vendor's
SPA section detection and operator-side history must still be tested with a real
account after privacy clearance; there is no unsupported page-tracking API added.

### Recordings: deployment remains blocked

Older official Smartsupp training and marketing describe video recordings, but
the current help/pricing pages reviewed do not establish this account's recording
entitlement or a verified disable switch. Absence of a menu is not proof it is off.
Request Smartsupp confirmation that all session/screen/video recording is disabled
for this website key/account, including whether it can be activated by optional
analytics consent. No recording command is enabled by our code, but denial of
analytics is not a documented independent kill switch for all recording products.

Do NOT deploy until that confirmation and consent behavior are verified. If the
vendor cannot guarantee no recording, the safest alternative is to omit its loader
and use the existing ticket system, or design a separate-origin, chat-only surface
with no dashboard DOM/data. Hiding the widget or placing it in a same-origin iframe
does not isolate dashboard information from a third-party script.

Official sources:
- https://help.smartsupp.com/en/articles/12647328-cookie-consent
- https://help.smartsupp.com/en/articles/12647322-inbox-general-settings
- https://docs.smartsupp.com/chat-box/visitor-identification/
- https://www.smartsupp.com/courses/ultimate-getting-started-guide/
- https://www.smartsupp.com/pricing/

---

## Earlier implementation baseline

Local implementation report, 10 November 2026. No commit, push, deployment,
database migration, Auth setting, DNS change, or Smartsupp account change was made.

## Changes and boundaries

| File | Purpose |
| --- | --- |
| `app/layout.tsx` | Preserves the manual removal of the global Smartsupp installation. Public/admin layouts never install chat. |
| `app/dashboard/page.tsx` | Completes the existing authorization state, renders the component, verifies `profiles.role`, and handles Auth/sign-out races. |
| `app/components/SmartsuppChat.tsx` | Client-only effect component, limited to exactly `/dashboard`, with separate lifetime and visibility effects. |
| `lib/smartsupp-lifecycle.ts` | One browser-scoped runtime, official loader/commands, tracking consent denial, identity isolation, and document unloading. |
| `lib/use-idle-session.ts` | Optional completion callback, so the client waits for local Auth cleanup before hard navigation. Existing admin callers are unchanged. |
| `app/globals.css` | Immediate widget concealment, modal protection, narrow/short viewport limits. No existing dashboard styles were replaced. |
| `package.json` | Adds `test:smartsupp`. No dependencies added. |
| `tests/smartsupp.test.cjs` | Auth, lifecycle, race, route, privacy, failure, Strict Mode and idle-cleanup regression checks. |
| `docs/SMARTSUPP-INTEGRATION.md` | This report and rollout checklist. |

The manual dashboard work was incomplete: it imported a component but never
rendered it, enabled its boolean for any verified user without a client-role
check, and did not provide widget teardown. Those changes were completed without
replacing the existing ticket system, Realtime subscriptions, attachments,
withdrawals, notifications, profile UI, or dashboard redesign.

## Authorization

1. The existing `supabase.auth.getUser()` verifies the user against Auth.
2. With that user's normal authenticated Supabase client, query only their
   `profiles.role` using `id = user.id`. Only the literal `client` is accepted.
   The existing database authorization/RLS must continue protecting this role.
   Editable `user_metadata` remains display-only and never authorizes chat.
3. Render chat only after Auth loading ends, with no Auth error, a current user,
   successful client-role verification, and no sign-out in progress.
4. Abort pending verification on `SIGNED_OUT`/account changes; ignore late
   results on unmount, idle expiry, and manual sign-out. Role-query failure
   disables live chat while leaving independently working ticket support usable.

There is no service-role key, REST API token, new environment variable, database
table, grant, policy, or production configuration required by this code. The
installation key is a public website identifier. It is not access control for
the Smartsupp operator console.

A read-only production metadata check confirmed `profiles` RLS is enabled,
authenticated users can read only their own profile (administrators have their
existing separate policy), and `authenticated` has only SELECT privilege on the
`role` column. No client records or authentication secrets were retrieved.

## Lifecycle and navigation

- One window-scoped runtime and mount leases prevent duplicate loaders during
  section changes, Strict Mode's setup/cleanup replay, and component remounts.
- Loading is deferred while the native conversation, ticket form, mobile menu,
  Settings, or an account/photo popup obscures the dashboard. Once installed,
  official `chat:close` and `chat:hide` commands plus a CSS guard conceal it in
  those views. Modal dialogs also conceal vendor chrome.
- Manual/idle sign-out conceals immediately, then lets Supabase clear its own
  session. On completion, hard navigation to login unloads vendor code,
  listeners, timers and iframes. Invalid Auth and `SIGNED_OUT` take the same exit.
- A real dashboard unmount conceals synchronously and replaces the current URL
  after the router completes its synchronous transition. This reloads the
  destination once to unload vendor code. Strict Mode's immediate remount
  cancels that reload. No reload is needed if the vendor never started.
- Browser back/forward-cache restores force fresh verification. A different
  client cannot reuse an already initialized vendor runtime.
- Only this installation's `ssupp_<installation-key>...` storage and legacy
  `ssupp.vid`/`ssupp.visits` cookies are cleared. Supabase auth storage and other
  application preferences are untouched. Browser-level third-party storage and
  vendor-side chat history are outside application control.
- No unsupported `destroy`, `reset`, or `logout` vendor command is used. Merely
  removing the script node would not stop already executed JavaScript.

## Required Smartsupp account privacy setup BEFORE deployment

**Observed blocker:** the real widget console reports: "Enable managing cookie
consent in widget settings to allow this command." The account currently ignores
the queued `analyticsConsent(false)` and `marketingConsent(false)` commands.
Do not treat those tracking controls as effective until the setting below is
enabled and retested. The user has been asked to make this account-side change.

In Smartsupp Settings → Security and privacy:

1. Enable **Cookie consent**. Retest that the warning is gone and optional
   analytics/marketing remain denied. This integration never grants them.
2. Keep session recording, sensitive-page capture, and optional visitor analytics
   disabled for dashboard/account/financial forms. Hiding the chat UI alone
   does not stop tracking; account-level settings must enforce this.
3. Check that IP storage is disabled and set appropriate retention/access rules.
4. Limit allowed domains to the intended production hosts; allow localhost only
   while testing. Review automated campaigns so none ask for credentials, wallet
   recovery phrases, private keys, verification codes, or payment information.
5. Review the widget privacy notice and your site's privacy policy/consent
   requirements. The code enables the documented required privacy-notice option;
   confirm its behavior with the current widget version/account settings.

No name, email, Supabase ID, token, financial record or ticket conversation is
passed through a Smartsupp identification API. The owner marker stays in local
browser storage. The loader still exposes normal connection metadata (such as
the page URL and IP) to the vendor; hiding a launcher is not a privacy sandbox.

Official references checked:

- [Installation](https://docs.smartsupp.com/chat-box/installation/)
- [Configuration and required privacy notice](https://docs.smartsupp.com/chat-box/configuration/)
- [Supported JavaScript methods](https://docs.smartsupp.com/chat-box/javascript-api/methods/)
- [Cookie consent and account prerequisite](https://help.smartsupp.com/en/articles/12647328-cookie-consent)
- [Data privacy and storage](https://help.smartsupp.com/en/articles/12647741-data-privacy-gdpr)
- [Supabase getUser verification](https://supabase.com/docs/reference/javascript/auth-getuser)

## Validation performed

- `npm.cmd run test:smartsupp`: **15 passed**. Executes the actual Auth effect
  and lifecycle module with isolated Auth/browser mocks, including delayed
  responses racing sign-out and idle cleanup finishing after component unmount.
- `npm.cmd run test:auth`: **17 passed**, including signup, six-digit
  verification, reset-password session preservation and idle expiration.
- `npm.cmd run build`: optimized webpack build and TypeScript completed. An
  initial sandbox filesystem EPERM was resolved by an approved external build.
- Configured `npm.cmd run lint`: **16 pre-existing errors, 6 warnings** remain
  across the repository. The modified dashboard has the same four
  `react-hooks/set-state-in-effect` errors and two image warnings as `HEAD`.
  The new component, lifecycle module, idle-hook changes and tests are lint-clean.
- `git diff --check`: passed.
- Local production browser: no Smartsupp loader/widget on home, about,
  services, contact, signup, login, reset-password, admin login/tickets, or the
  unauthenticated dashboard. Dashboard redirects to login without loading chat;
  refreshing login also stays widget-free.
- Isolated browser fixture using the **actual official widget and lifecycle
  module**, no real account: one loader; successful widget startup; sensitive
  view concealment; sign-out and route-departure document unload; zero loaders
  and zero iframes on the destination public/login page.
- The live panel was opened and measured at 320×640, 390×844, 768×1024 and
  1440×900. Added bounds prevent a 380px desktop panel extending outside narrow
  screens. The test tolerates subpixel viewport rounding (under one CSS pixel).
- No chat message or test email was sent. No real credentials were requested.

## Remaining signed-in acceptance checks

No authenticated client/admin browser session was available; mocked Auth tests
are not a substitute for a final real-account end-to-end test. After completing
the account privacy setup, use separate client/admin browser profiles:

1. Keep Network open, filter `smartsupp`, and visit public pages and admin routes:
   no loader should be requested. An admin visiting `/dashboard` must not load it.
2. Sign in as a client: the dashboard renders while the role check finishes, then
   one loader appears on an unobscured overview. Refresh and repeat.
3. Move between sections: no second loader. Open a native ticket conversation,
   form, mobile menu or modal: the widget hides. Return: the same widget reappears.
4. Sign out with chat open: concealment is immediate; login has no vendor script
   or iframe. Browser Back must verify Auth again and must not reopen old chat.
5. Sign in as another client on the same browser: no previous visitor conversation.
6. Exercise real SDK session expiry and the existing 60-minute idle timeout:
   authenticated UI hides immediately, Auth clears, then login is shown.
7. Confirm native messages, typing, attachments, withdrawal changes and notices
   still synchronize between client/admin. No Smartsupp calls should include them.
8. Repeat on real iOS/Android with the keyboard open and on a tablet/desktop.
   Real device keyboard behavior and vendor-side recording settings remain to
   be verified; viewport emulation does not establish those facts.

## Review and optional commit/push (not executed)

Run in the project root on `integrate-dashboard-update`. Review the staged file
list before committing; keep `.env.local` ignored. These commands stage only the
integration files, not unrelated work:

```powershell
git status --short
git diff
git check-ignore .env.local
git add -- app/layout.tsx app/dashboard/page.tsx app/globals.css app/components/SmartsuppChat.tsx lib/smartsupp-lifecycle.ts lib/use-idle-session.ts package.json tests/smartsupp.test.cjs docs/SMARTSUPP-INTEGRATION.md
git diff --cached --stat
git diff --cached --name-only
git commit -m "Complete authenticated client Smartsupp integration"
git push origin HEAD
```

Push only after reviewing the privacy prerequisite and completing the real-account
checks. Follow the repository's normal review/merge workflow; do not force-push.
