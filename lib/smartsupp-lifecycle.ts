// The installation key is a public website identifier, never a REST API token.
export const SMARTSUPP_KEY = "951fb46282afc63496427e8fbbe184821af58267";
export const SMARTSUPP_LOADER_ID = "custodial-smartsupp-loader";
const ownerKey = "custodialsupport:live-chat-owner:v1";
type ChatCommand = "chat:show" | "chat:hide" | "chat:close" | "analyticsConsent" | "marketingConsent" | "name";
type ChatApi = { (command: ChatCommand, value?: boolean | string): void; _?: [ChatCommand, (boolean | string)?][] };
type Runtime = { owner: string; leases: Set<symbol>; started: boolean; revoked: boolean; signingOut?: boolean; cleanup?: ReturnType<typeof setTimeout> };

declare global {
  interface Window {
    smartsupp?: ChatApi;
    _smartsupp?: Record<string, unknown>;
    __custodialLiveChat?: Runtime;
  }
}

function call(command: ChatCommand, value?: boolean | string) {
  try { window.smartsupp?.(command, value); } catch { /* Live chat must never break ticket support or sign-out. */ }
}

/** Called only by the explicit client preference form; grants are never restored automatically. */
export function setSmartsuppConsent(analytics: boolean, marketing: boolean, profileName?: string) {
  const runtime = window.__custodialLiveChat;
  if (!runtime?.started || runtime.revoked || !runtime.leases.size || window.location.pathname !== "/dashboard") return;
  call("analyticsConsent", analytics === true);
  call("marketingConsent", marketing === true);
  if (profileName?.trim()) call("name", profileName.trim().slice(0, 100));
}

/** Clear only this website's Smartsupp identity; Supabase storage is untouched. */
export function clearSmartsuppIdentity() {
  const prefix = `ssupp_${SMARTSUPP_KEY}`;
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = storage();
      for (let index = store.length - 1; index >= 0; index--) {
        const key = store.key(index);
        if (key?.startsWith(prefix)) store.removeItem(key);
      }
      store.removeItem(ownerKey);
    } catch { /* Storage can be disabled. The document is still unloaded. */ }
  }
  // Also remove cookies from older/global installations, across the host scopes.
  try {
    const parts = window.location.hostname.split(".");
    const domains = ["", ...parts.map((_, index) => parts.slice(index).join(".")).filter((domain) => domain.includes("."))];
    for (const entry of document.cookie.split(";")) {
      const name = entry.trim().split("=")[0];
      if (!name.startsWith(prefix) && name !== "ssupp.vid" && name !== "ssupp.visits") continue;
      for (const domain of domains) {
        for (const path of ["/", "/dashboard"]) {
          document.cookie = `${name}=; Max-Age=0; Path=${path};${domain ? ` Domain=${domain};` : ""} SameSite=Lax`;
        }
      }
    }
  } catch { /* Cookie access must never interrupt signing out. */ }
}

function startSmartsupp(runtime: Runtime) {
  if (runtime.started) return;
  runtime.started = true;
  window._smartsupp = {
    key: SMARTSUPP_KEY, hideWidget: true, color: "#2dd4bf", offsetX: 16, offsetY: 24,
    privacyNoticeEnabled: true, privacyNoticeCheckRequired: true,
  };
  const queue: ChatApi = (...args) => { queue._!.push(args); };
  queue._ = [];
  window.smartsupp = queue;
  call("analyticsConsent", false);
  call("marketingConsent", false);
  const script = document.createElement("script");
  script.id = SMARTSUPP_LOADER_ID;
  script.async = true;
  script.charset = "utf-8";
  script.src = "https://www.smartsuppchat.com/loader.js?";
  script.onerror = () => { revokeSmartsupp(); console.warn("Live chat could not load. Ticket support remains available."); };
  document.head.appendChild(script);
}

export function setSmartsuppVisibility(visible: boolean) {
  if (typeof window === "undefined") return;
  const runtime = window.__custodialLiveChat;
  const allowed = visible && window.location.pathname === "/dashboard" && !!runtime?.leases.size && !runtime.revoked;
  document.documentElement.dataset.liveChatVisible = allowed ? "true" : "false";
  if (allowed && runtime) startSmartsupp(runtime);
  if (!allowed) call("chat:close");
  call(allowed ? "chat:show" : "chat:hide");
}

/** Synchronous: revoke and conceal before waiting for the Supabase sign-out. */
export function revokeSmartsupp(signingOut = false) {
  if (typeof window === "undefined") return;
  if (window.__custodialLiveChat) {
    window.__custodialLiveChat.revoked = true;
    window.__custodialLiveChat.signingOut = signingOut;
  }
  setSmartsuppVisibility(false);
}

/** Unloading the document, rather than removing a script tag, stops vendor JS. */
export function leaveClientDashboard(destination: string, softNavigate: (url: string) => void) {
  revokeSmartsupp();
  clearSmartsuppIdentity();
  if (window.__custodialLiveChat?.started || window.smartsupp) window.location.replace(destination);
  else softNavigate(destination);
}

export function mountSmartsupp(userId: string): () => void {
  if (!userId || window.location.pathname !== "/dashboard") return () => {};
  let runtime = window.__custodialLiveChat;
  if (runtime?.revoked || (runtime && runtime.owner !== userId) || (!runtime && window.smartsupp)) {
    revokeSmartsupp();
    clearSmartsuppIdentity();
    window.location.replace(window.location.href);
    return () => {};
  }
  if (!runtime) {
    runtime = { owner: userId, leases: new Set(), started: false, revoked: false };
    window.__custodialLiveChat = runtime;
    // A back/forward-cache restore must verify Auth again before displaying chat.
    window.addEventListener("pagehide", () => setSmartsuppVisibility(false));
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        revokeSmartsupp();
        clearSmartsuppIdentity();
        window.location.replace(window.location.href);
      }
    });
    // No name/email/id/financial data is sent to Smartsupp. This marker is local.
    try {
      if (window.localStorage.getItem(ownerKey) !== userId) clearSmartsuppIdentity();
      window.localStorage.setItem(ownerKey, userId);
    } catch { clearSmartsuppIdentity(); }
  }
  if (runtime.cleanup) clearTimeout(runtime.cleanup);
  const lease = Symbol("client-live-chat");
  runtime.leases.add(lease);
  const current = runtime;
  return () => {
    current.leases.delete(lease);
    if (current.leases.size) return;
    setSmartsuppVisibility(false);
    // Await Supabase clearing its session before unloading the document.
    if (current.signingOut || !current.started) return;
    // Strict Mode immediately reacquires the lease. A real unmount unloads all
    // vendor timers/iframes/listeners before continuing at the destination URL.
    current.cleanup = setTimeout(() => {
      if (current.leases.size || current.signingOut) return;
      current.revoked = true;
      clearSmartsuppIdentity();
      window.location.replace(window.location.href);
    }, 0);
  };
}
