/* eslint-disable @typescript-eslint/no-require-imports -- Execute the actual TypeScript lifecycle/auth effect in isolated browser mocks. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let authEffect;
function find(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('supabase.auth.onAuthStateChange')) authEffect = node.arguments[0].getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
assert.ok(authEffect);
function storage() {
  const map = new Map();
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i], getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k), map };
}
function browser(pathname = '/dashboard') {
  const scripts = [], navigations = [], timers = new Map(), listeners = {}, warnings = [];
  let nextTimer = 0;
  const window = { localStorage: storage(), sessionStorage: storage(), addEventListener: (name, fn) => { listeners[name] = fn; }, location: { pathname, hostname: 'www.example.invalid', href: `https://www.example.invalid${pathname}`, replace: (url) => navigations.push(url) } };
  const doc = { cookie: '', documentElement: { dataset: {} }, createElement: () => ({}), head: { appendChild: (script) => scripts.push(script) } };
  const ctx = { window, document: doc, console: { warn: (...args) => warnings.push(args) }, setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: (id) => timers.delete(id), exports: {} };
  vm.runInNewContext(compile(fs.readFileSync('lib/smartsupp-lifecycle.ts', 'utf8')), ctx);
  return { ...ctx.exports, ctx, window, doc, scripts, navigations, listeners, warnings, flush: () => { const fns = [...timers.values()]; timers.clear(); fns.forEach((fn) => fn()); } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
test('optional consent choices are independent, revocable, and ignored outside an active client dashboard', () => {
  const b = browser(); b.setSmartsuppConsent(true, true, 'Fixture'); assert.equal(b.scripts.length, 0);
  b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true);
  b.setSmartsuppConsent(true, false);
  let calls = b.window.smartsupp._.map(args => [...args]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(-2))), [['analyticsConsent', true], ['marketingConsent', false]]);
  assert.equal(calls.some(([cmd]) => cmd === 'name'), false);
  b.setSmartsuppConsent(false, true, 'Fixture');
  calls = b.window.smartsupp._.map(args => [...args]); assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(-3))), [['analyticsConsent', false], ['marketingConsent', true], ['name', 'Fixture']]);
  b.setSmartsuppConsent(false, false); assert.deepEqual(JSON.parse(JSON.stringify(b.window.smartsupp._.map(args => [...args]).slice(-2))), [['analyticsConsent', false], ['marketingConsent', false]]);
  b.revokeSmartsupp(); const count = b.window.smartsupp._.length; b.setSmartsuppConsent(true, true, 'Denied'); assert.equal(b.window.smartsupp._.length, count);
});
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
test('consent form renders unchecked choices and stays bounded on mobile and desktop', () => {
  const exports = {}, react = require('react');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/components/SmartsuppChat.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => name === 'next/navigation' ? { usePathname: () => '/dashboard' } : name === '@/lib/smartsupp-lifecycle' ? {} : require(name),
  });
  const html = require('react-dom/server').renderToStaticMarkup(react.createElement(exports.default, { userId: 'fixture', hidden: false, profileName: 'Fixture' }));
  assert.equal((html.match(/type="checkbox"/g) || []).length, 3);
  assert.equal(html.includes('checked=""'), false);
  assert.match(html, /Reject optional/); assert.match(html, /Save choices/);
  assert.match(html, /max-w-\[calc\(100vw-2rem\)\]/); assert.match(html, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.equal(require('react-dom/server').renderToStaticMarkup(react.createElement(exports.default, { userId: 'fixture', hidden: true, profileName: 'Fixture' })), '');
});
function auth({ user = { id: 'client-1', email: 'fixture@example.invalid', user_metadata: {} }, error = null, role = 'client', roleError = null, userPromise, rolePromise } = {}) {
  const b = browser(), soft = [], state = {}, queries = [];
  let onAuth, getUserCalls = 0, signouts = 0;
  const ctx = { ...b.ctx, exports: {}, AbortController, signingOutRef: { current: false }, idleExpiredRef: { current: false }, popupAnnouncementCache: { current: [] },
    leaveClientDashboard: b.leaveClientDashboard, revokeSmartsupp: b.revokeSmartsupp,
    sessionHasEnded: (e) => e?.name === 'AuthSessionMissingError', router: { replace: (url) => soft.push(url) },
    withRequestTimeout: (fn, { signal }) => fn(signal),
    supabase: { auth: {
      onAuthStateChange: (cb) => { onAuth = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      getUser: () => { getUserCalls++; return userPromise ?? Promise.resolve({ data: { user }, error }); },
      signOut: async () => { signouts++; return { error: null }; },
    }, from: (table) => { queries.push(table); const chain = { select: (field) => { queries.push(field); return chain; }, eq: (field, value) => { queries.push([field, value]); return chain; }, abortSignal: () => chain, maybeSingle: () => rolePromise ?? Promise.resolve({ data: role === null ? null : { role }, error: roleError }) }; return chain; } },
  };
  for (const match of source.matchAll(/\b(set[A-Z]\w*)\(/g)) ctx[match[1]] = (value) => { state[match[1]] = value; };
  vm.runInNewContext(compile(`exports.run = ${authEffect};`), ctx);
  const cleanup = ctx.exports.run();
  return { b, ctx, state, queries, soft, cleanup, emit: (...args) => onAuth(...args), getUserCalls: () => getUserCalls, signouts: () => signouts };
}

test('public/admin routes never install a loader, even if mount is accidentally invoked', () => {
  for (const path of ['/', '/home', '/about', '/services', '/contact', '/login', '/signup', '/verify-email', '/reset-password', '/admin', '/admin/login', '/admin/tickets']) {
    const b = browser(path); b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true);
    assert.equal(b.scripts.length, 0, path); assert.notEqual(b.doc.documentElement.dataset.liveChatVisible, 'true');
  }
});
test('Auth verification pending cannot authorize chat', async () => {
  const pending = deferred(), h = auth({ userPromise: pending.promise });
  await settle(); assert.equal(h.state.setSmartsuppAuthorized, false); assert.equal(h.state.setAuthLoading, true); assert.equal(h.queries.length, 0); h.cleanup();
});
test('verified Auth alone cannot authorize chat while the client role query is pending', async () => {
  const pending = deferred(), h = auth({ rolePromise: pending.promise });
  await settle(); assert.equal(h.state.setCurrentUserId, 'client-1'); assert.equal(h.state.setAuthLoading, false); assert.equal(h.state.setSmartsuppAuthorized, false); h.cleanup();
});
test('a verified client is authorized using its protected role, without a duplicate getUser request', async () => {
  const h = auth(); await settle(); assert.equal(h.state.setSmartsuppAuthorized, true); assert.equal(h.getUserCalls(), 1);
  assert.equal(h.queries[0], 'profiles'); assert.equal(h.queries[1], 'role'); assert.equal(h.queries[2][1], 'client-1'); h.cleanup();
});
test('admin/missing/failed profile roles are denied chat; normal ticket dashboard is not blocked', async () => {
  for (const options of [{ role: 'admin' }, { role: null }, { roleError: { message: 'permission denied' } }, { role: 'client-untrusted' }]) {
    const h = auth(options); await settle(); assert.equal(h.state.setSmartsuppAuthorized, false); assert.equal(h.state.setAuthLoading, false); assert.equal(h.soft.length, 0); h.cleanup();
  }
});
test('invalid or missing Auth requires fresh sign-in; a network failure never enables chat', async () => {
  for (const options of [{ user: null }, { error: { name: 'AuthSessionMissingError' } }]) {
    const h = auth(options); await settle(); assert.equal(h.state.setSmartsuppAuthorized, false); assert.deepEqual(h.soft, ['/login']); assert.equal(h.signouts(), 1); h.cleanup();
  }
  const h = auth({ error: { name: 'NetworkError' } }); await settle(); assert.equal(h.state.setSmartsuppAuthorized, false); assert.equal(h.signouts(), 0); assert.ok(h.state.setAuthCheckError); h.cleanup();
});
test('SIGNED_OUT racing either verification response cannot resurrect chat', async () => {
  for (const stage of ['user', 'role']) {
    const pending = deferred(); const h = auth(stage === 'user' ? { userPromise: pending.promise } : { rolePromise: pending.promise });
    await settle(); h.emit('SIGNED_OUT', null);
    pending.resolve(stage === 'user' ? { data: { user: { id: 'old-client', user_metadata: {} } }, error: null } : { data: { role: 'client' }, error: null });
    await settle(); assert.equal(h.state.setSmartsuppAuthorized, false); assert.equal(h.state.setCurrentUserId, ''); assert.deepEqual(h.soft, ['/login']); h.cleanup();
  }
});
test('component cleanup cancels stale authorization on a route change', async () => {
  const pending = deferred(), h = auth({ rolePromise: pending.promise }); await settle(); h.cleanup();
  pending.resolve({ data: { role: 'client' }, error: null }); await settle(); assert.equal(h.state.setSmartsuppAuthorized, false);
});
test('hidden views defer the loader; Strict Mode and section navigation create one widget', () => {
  const b = browser(); let cleanup = b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(false); assert.equal(b.scripts.length, 0);
  b.setSmartsuppVisibility(true); assert.equal(b.scripts.length, 1); cleanup(); cleanup = b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true); b.flush();
  for (let i = 0; i < 5; i++) { b.setSmartsuppVisibility(false); b.setSmartsuppVisibility(true); }
  assert.equal(b.scripts.length, 1); assert.equal(b.navigations.length, 0); assert.equal(b.scripts[0].src, 'https://www.smartsuppchat.com/loader.js?'); cleanup();
});
test('privacy controls grant no automatic tracking consent or client identification', () => {
  const b = browser(); b.mountSmartsupp('private-account-id'); b.setSmartsuppVisibility(true);
  const calls = b.window.smartsupp._.map((args) => [...args]);
  assert.ok(calls.some(([cmd, value]) => cmd === 'analyticsConsent' && value === false));
  assert.ok(calls.some(([cmd, value]) => cmd === 'marketingConsent' && value === false));
  assert.equal(JSON.stringify(b.window._smartsupp).includes('private-account-id'), false);
  assert.equal(JSON.stringify(calls).includes('private-account-id'), false);
  assert.equal(b.window._smartsupp.privacyNoticeCheckRequired, true);
});
test('real route departure conceals immediately and unloads vendor JS at the destination', () => {
  const b = browser(), cleanup = b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true);
  b.window.location.pathname = '/contact'; b.window.location.href = 'https://www.example.invalid/contact'; cleanup();
  assert.equal(b.doc.documentElement.dataset.liveChatVisible, 'false'); b.flush(); assert.deepEqual(b.navigations, ['https://www.example.invalid/contact']);
});
test('sign-out waits for Auth to finish, then clears only Smartsupp identity and hard navigates', () => {
  const b = browser(), cleanup = b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true);
  const key = `ssupp_${b.SMARTSUPP_KEY}vid`;
  b.window.localStorage.setItem(key, 'visitor'); b.window.sessionStorage.setItem(key, 'visitor'); b.window.localStorage.setItem('sb-fixture-auth-token', 'do-not-change');
  b.revokeSmartsupp(true); cleanup(); b.flush(); assert.equal(b.navigations.length, 0); assert.equal(b.doc.documentElement.dataset.liveChatVisible, 'false');
  b.leaveClientDashboard('/login', () => assert.fail('must unload vendor context'));
  assert.deepEqual(b.navigations, ['/login']); assert.equal(b.window.localStorage.getItem(key), null); assert.equal(b.window.sessionStorage.getItem(key), null); assert.equal(b.window.localStorage.getItem('sb-fixture-auth-token'), 'do-not-change');
});
test('account switching and browser history restore cannot reuse the old chat context', () => {
  const b = browser(); b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true); b.mountSmartsupp('client-2');
  assert.equal(b.scripts.length, 1); assert.equal(b.doc.documentElement.dataset.liveChatVisible, 'false'); assert.equal(b.navigations.length, 1);
  const next = browser(); next.mountSmartsupp('client-1'); next.setSmartsuppVisibility(true); next.listeners.pagehide(); assert.equal(next.doc.documentElement.dataset.liveChatVisible, 'false'); next.listeners.pageshow({ persisted: true }); assert.equal(next.navigations.length, 1);
});
test('blocked script/cookies/storage fail safely without touching the ticket system', () => {
  const b = browser(); b.mountSmartsupp('client-1'); b.setSmartsuppVisibility(true); b.scripts[0].onerror();
  assert.equal(b.doc.documentElement.dataset.liveChatVisible, 'false'); assert.equal(b.warnings.length, 1);
  Object.defineProperty(b.window, 'localStorage', { get() { throw new Error('blocked'); } }); Object.defineProperty(b.doc, 'cookie', { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => b.leaveClientDashboard('/login', () => {})); assert.deepEqual(b.navigations, ['/login']);
});
test('idle expiry hides chat before Auth cleanup and navigates only after cleanup finishes', async () => {
  for (const fail of [false, true]) {
    const pending = deferred(), trace = [], cleanups = [], b = browser();
    b.window.localStorage.setItem('activity', '1'); b.window.setInterval = () => 1; b.window.clearInterval = () => {}; b.window.removeEventListener = () => {};
    b.doc.addEventListener = () => {}; b.doc.removeEventListener = () => {};
    const imports = {
      react: { useRef: (current) => ({ current }), useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } },
      './supabase': { supabase: { auth: { signOut: () => pending.promise } } },
      './session-activity': { defaultIdleTimeoutMs: 1000, sessionActivityKey: () => 'activity', recordSessionActivity: () => {} },
      './with-request-timeout': { withRequestTimeout: (fn) => fn() },
    };
    const ctx = { ...b.ctx, exports: {}, require: (name) => imports[name], Date: { now: () => 10000 } };
    vm.runInNewContext(compile(fs.readFileSync('lib/use-idle-session.ts', 'utf8')), ctx);
    ctx.exports.useIdleSession('client-1', () => trace.push('hide'), { onSignedOut: () => trace.push('navigate') });
    assert.deepEqual(trace, ['hide']); cleanups.forEach((fn) => fn());
    if (fail) pending.resolve(Promise.reject(new Error('offline'))); else pending.resolve({ error: null });
    await settle(); assert.deepEqual(trace, ['hide', 'navigate']);
  }
});

