# CustodialSupport: authenticated client live chat

## Current configuration — 10 November 2026

This report supersedes the earlier consent-panel implementation. These changes
are local only: no commit, push, deployment, account setting, DNS change, database
migration, or authentication configuration change was made in this update.

### Client experience

After the existing Supabase getUser verification and protected own-profile
client-role check succeed, the existing lifecycle shows the Smartsupp launcher.
Clients can open its normal chat interface. There is no application-owned privacy
popup, checkbox, Save choices, Reject optional, or floating privacy-choices button.

The existing visibility protections remain: native ticket conversations/forms,
the navigation menu, Settings, and account/photo dialogs hide the live widget.
Returning to an unobscured dashboard restores the same widget without installing
another loader. Public and admin pages never install it.

### Tracking and monitoring

- The loader queues analyticsConsent(false) and marketingConsent(false) before
  loading the official SDK. Both are always denied; no opt-in/grant API remains.
- No custom page tracker, visitor name/email/phone/ID API, wallet/withdrawal payload,
  authentication token, or private native-ticket conversation is supplied.
- The previous profile-name prop and optional name-sharing function are removed.
  Agents will not automatically receive the client's registered identity.
- Normal vendor connection metadata, such as the current URL/referrer and network
  address, may still be exposed when the SDK connects. Necessary chat metadata is
  not a complete page-visit history or a guarantee of named visitor monitoring.
- **Page-visit/browsing-history monitoring is disabled under this configuration.**
  Smartsupp's current help requires cookie consent, installed tracking code, and
  a visitor message. Without consent, it says browsing history is unavailable.
  This implementation does not bypass that restriction or silently grant consent.
  A separately reviewed consent solution would be needed before enabling it.
- Smartsupp's account-level Cookie consent setting must remain enabled for its
  consent commands to be effective. The user previously reported enabling it and
  disabling IP tracking. In this update's actual-widget fixture test, the earlier
  warning that consent management was disabled did not appear. This is runtime
  evidence, not a full audit of the operator-account configuration.

Official references:
- [Cookie consent and denial commands](https://help.smartsupp.com/en/articles/12647328-cookie-consent)
- [Browsing-history prerequisites](https://help.smartsupp.com/en/articles/12647322-inbox-general-settings)

### Session recordings

The integration contains no session/screen/video recording enable command and
does not enable analytics consent. **Account-level recording disablement remains
unverified.** The absence of a recordings menu or console error does not establish
that the vendor cannot record. Confirmation in Smartsupp's account settings or
from Smartsupp support is still needed before declaring recordings disabled.

No account privacy controls were changed. Keep Cookie consent enabled, marketing
and analytics denied, and recordings off in the vendor account. The third-party
SDK is not a privacy sandbox: hiding it does not prevent its JavaScript from
running. If the provider cannot verify recordings are off, omit the loader/use
the existing native ticket system until that requirement is resolved.

### Authentication and cleanup preserved

The existing server-verified Auth and RLS-protected profiles.role authorization
are unchanged. Missing/failed/pending Auth or role checks do not authorize chat.
Delayed responses cannot resurrect it after sign-out or a route departure.

Manual logout, actual session expiration, existing idle expiration, account
switching, Strict Mode, destination navigation and back/forward-cache protections
remain unchanged. Real departure unloads the vendor document context; sign-out
allows Supabase to clear its own session before that navigation. Cleanup targets
Smartsupp identity storage only; it does not delete Supabase session storage or
unrelated preferences. Vendor-side historical messages are outside this cleanup.

## Files modified

| File | Change |
| --- | --- |
| app/components/SmartsuppChat.tsx | Remove custom preference UI/state and name sharing; retain lifetime and visibility effects; render null. |
| app/dashboard/page.tsx | Stop passing the profile name to the live-chat component. Auth, dashboard design and navbar fixes remain unchanged. |
| lib/smartsupp-lifecycle.ts | Remove consent-grant and name APIs; keep startup denial and all cleanup behavior. |
| app/globals.css | Remove only the obsolete custom-panel modal rule; retain widget sizing, visibility, and navbar styles. |
| tests/smartsupp.test.cjs | Verify no custom controls/grant API, automatic effect mounting, tracking denial and existing auth/lifecycle protections. |
| docs/SMARTSUPP-INTEGRATION.md | Replace the historical report with this current configuration and evidence. |

No dependencies, environment variables, credentials, schema/RLS changes, email
templates, support-ticket features, or other dashboard features were added/changed.

## Validation

- npm.cmd run test:smartsupp: **18 passed**.
- npm.cmd run test:auth: **17 passed**.
- Scoped ESLint on SmartsuppChat.tsx, smartsupp-lifecycle.ts and smartsupp.test.cjs:
  **passed**.
- npm.cmd run lint: **16 existing errors and 6 warnings** across the repository.
  Existing dashboard effect/image findings were not refactored as part of this task.
- npm.cmd run build: **passed**, including TypeScript and all 25 static pages.
- git diff --check: **passed**.
- Built app in a local production server: /home and /admin/login had no chat
  loaders/iframes. Anonymous /admin/tickets redirected to admin login; anonymous
  /dashboard redirected to client login without loading chat.
- Isolated fixture executing the actual lifecycle helper and official vendor
  widget: launcher loads once, chat opens with a usable composer, sensitive views
  hide it, and restoring the overview does not duplicate the loader. No custom
  privacy controls or consent-management warnings appeared.
- Actual vendor panel measured within viewport at **320×640, 390×844, 768×1024,
  and 1440×900** (allowing subpixel rounding).
- Fixture sign-out and route departure: destination pages contain **zero chat
  loaders and zero iframes**. Auth/idle-expiry races and cleanup were additionally
  checked using the actual Auth effect and lifecycle code with isolated mocks.
- No message was sent to a support agent; no real client details or authentication
  credentials were used in the fixture.

### Remaining acceptance checks / limits

A real authenticated client/operator session was not available for end-to-end
two-way messaging or operator online-list/history verification. Physical iOS/
Android keyboard behavior was not tested; viewport emulation is not equivalent.
Run those checks after the account recording configuration is verified. The
report does not claim successful message delivery or account-level no-recording
certification.

**Nothing committed, pushed, or deployed.** The live site keeps its previously
deployed behavior until a later explicitly authorized release.
