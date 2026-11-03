/* eslint-disable @typescript-eslint/no-require-imports -- This Node VM test harness executes CommonJS modules. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
const compile = (text) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const event = { preventDefault() {} };
function storage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values }; }
function loadHelper(file, context = {}, imports = {}) {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(path.join(project, file), 'utf8')), { exports, ...context, require: (name) => imports[name] });
  return exports;
}
function handler(file, name, initial = {}, auth = {}) {
  const text = fs.readFileSync(path.join(project, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) fn = node; else ts.forEachChild(node, visit); }
  visit(source); assert.ok(fn);
  const browser = { sessionStorage: storage(), localStorage: storage(), location: { origin: 'https://www.example.invalid' } };
  const verification = loadHelper('lib/email-verification.ts', { window: browser, Date });
  const activity = loadHelper('lib/session-activity.ts', { window: browser, Date });
  const routes = [];
  const ctx = { ...verification, ...activity, ...initial, window: browser, Date,
    supabase: { auth }, router: { replace: (target) => routes.push(target) }, withRequestTimeout: async (request) => request(new AbortController().signal),
    loading: false, resending: false, success: false, sessionReady: true, code: '', password: 'secure-password', confirmation: 'secure-password', fullName: '  Fixture  ', email: '  PERSON@EXAMPLE.INVALID  ',
    ...initial,
  };
  for (const setter of text.matchAll(/\bset([A-Z]\w*)\(/g)) {
    const key = setter[1][0].toLowerCase() + setter[1].slice(1);
    ctx[`set${setter[1]}`] = (value) => { ctx[key] = typeof value === 'function' ? value(ctx[key]) : value; };
  }
  vm.runInNewContext(compile(fn.getText(source)), ctx);
  return { ctx, routes, browser, invoke: () => ctx[name](event) };
}

test('signup stores only pending email then moves to verification without saving password', async () => {
  let parameters;
  const h = handler('app/signup/SignupFlow.tsx', 'handleSignup', {}, { signUp: async (value) => { parameters = value; return { data: { user: { id: 'fixture' }, session: null }, error: null }; } });
  await h.invoke();
  assert.equal(parameters.email, 'person@example.invalid');
  assert.equal(parameters.options.data.full_name, 'Fixture');
  assert.equal(h.ctx.pending.email, 'person@example.invalid');
  assert.equal(h.ctx.password, '');
  assert.deepEqual(h.routes, ['/verify-email']);
  assert.ok([...h.browser.sessionStorage.values.values()].every((value) => !value.includes('secure-password')));
});

test('verification rejects incomplete code before contacting Auth', async () => {
  let calls = 0;
  const h = handler('app/signup/SignupFlow.tsx', 'verifyEmail', { pending: { email: 'person@example.invalid', sentAt: 0 }, code: '123' }, { verifyOtp: async () => { calls += 1; } });
  await h.invoke(); assert.equal(calls, 0); assert.match(h.ctx.error, /six-digit/);
});

test('six-digit verification uses email token type and continues verified session', async () => {
  let parameters;
  const h = handler('app/signup/SignupFlow.tsx', 'verifyEmail', { pending: { email: 'person@example.invalid', sentAt: 0 }, code: '123456' }, { verifyOtp: async (value) => { parameters = value; return { data: { user: { id: 'verified' }, session: { access_token: 'test-only' } }, error: null }; } });
  await h.invoke();
  assert.deepEqual(JSON.parse(JSON.stringify(parameters)), { email: 'person@example.invalid', token: '123456', type: 'email' });
  assert.deepEqual(h.routes, ['/dashboard']);
  assert.equal(h.browser.localStorage.getItem('custodialsupport:last-active:v1:verified') !== null, true);
  assert.equal(h.ctx.code, '');
});

test('code entry works with a manually entered registered email when browser storage is unavailable', async () => {
  let parameters;
  const h = handler('app/signup/SignupFlow.tsx', 'verifyEmail', { pending: null, email: '  REGISTERED@EXAMPLE.INVALID  ', code: '654321' }, { verifyOtp: async (value) => { parameters = value; return { data: { user: { id: 'manual' }, session: { access_token: 'test-only' } }, error: null }; } });
  await h.invoke();
  assert.equal(parameters.email, 'registered@example.invalid');
  assert.equal(parameters.type, 'email');
  assert.deepEqual(h.routes, ['/dashboard']);
});

test('an expired or incorrect code retains verification state without navigating or signing out', async () => {
  let signsOut = 0;
  const h = handler('app/signup/SignupFlow.tsx', 'verifyEmail', { pending: { email: 'person@example.invalid', sentAt: 0 }, code: '123456' }, { verifyOtp: async () => ({ data: { user: null, session: null }, error: { code: 'otp_expired' } }), signOut: async () => { signsOut += 1; } });
  await h.invoke();
  assert.match(h.ctx.error, /invalid or has expired/);
  assert.deepEqual(h.routes, []);
  assert.equal(signsOut, 0);
  assert.equal(h.ctx.pending.email, 'person@example.invalid');
});

test('verification without a valid registered email does not call Auth', async () => {
  let calls = 0;
  const h = handler('app/signup/SignupFlow.tsx', 'verifyEmail', { pending: null, email: 'invalid', code: '123456' }, { verifyOtp: async () => { calls += 1; } });
  await h.invoke();
  assert.equal(calls, 0);
  assert.match(h.ctx.error, /email address used/);
});

test('resend respects cooldown and uses signup resend rather than creating another account', async () => {
  let calls = 0, parameters;
  const h = handler('app/signup/SignupFlow.tsx', 'resendCode', { pending: { email: 'person@example.invalid', sentAt: Date.now() } }, { resend: async (value) => { calls += 1; parameters = value; return { error: null }; } });
  await h.invoke(); assert.equal(calls, 0);
  h.ctx.pending.sentAt = Date.now() - 61000;
  await h.invoke(); assert.equal(calls, 1); assert.equal(parameters.type, 'signup');
  await h.invoke(); assert.equal(calls, 1);
});

test('resend from the code page uses the registered email without creating a second account', async () => {
  let calls = 0, parameters;
  const h = handler('app/signup/SignupFlow.tsx', 'resendCode', { pending: null, email: 'REGISTERED@EXAMPLE.INVALID' }, { resend: async (value) => { calls += 1; parameters = value; return { error: { code: 'over_email_send_rate_limit' } }; } });
  await h.invoke();
  assert.equal(parameters.email, 'registered@example.invalid');
  assert.equal(parameters.type, 'signup');
  assert.match(h.ctx.error, /couldn't resend/);
  await h.invoke();
  assert.equal(calls, 1);
});

test('refresh restores only pending email and rejects malformed or stale saved data', () => {
  const saved = storage();
  const helper = loadHelper('lib/email-verification.ts', { window: { sessionStorage: saved }, Date });
  helper.savePendingVerification({ email: ' PERSON@EXAMPLE.INVALID ', sentAt: Date.now() });
  assert.equal(helper.readPendingVerification().email, 'person@example.invalid');
  const [key] = saved.values.keys();
  const stored = JSON.parse(saved.getItem(key));
  assert.deepEqual(Object.keys(stored).sort(), ['email', 'sentAt', 'version']);
  saved.setItem(key, JSON.stringify({ version: 1, email: 'not-an-address', sentAt: Date.now() }));
  assert.equal(helper.readPendingVerification(), null);
  saved.setItem(key, JSON.stringify({ version: 1, email: 'person@example.invalid', sentAt: Date.now() - 25 * 60 * 60 * 1000 }));
  assert.equal(helper.readPendingVerification(), null);
});

test('unconfirmed sign-in offers verification without clearing the session or creating another account', async () => {
  let signsOut = 0;
  const h = handler('app/login/page.tsx', 'handleLogin', {}, { signInWithPassword: async () => ({ data: { user: null, session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } }), signOut: async () => { signsOut += 1; } });
  await h.invoke();
  assert.equal(h.ctx.needsVerification, true);
  assert.equal(signsOut, 0);
  assert.deepEqual(h.routes, []);
  assert.match(h.ctx.error, /six-digit/);
});

test('the dedicated code page renders email and code fields before hydration without a new-account form', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const exports = {};
  const source = fs.readFileSync(path.join(project, 'app/signup/SignupFlow.tsx'), 'utf8');
  const imports = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/app/components/AuthFrame': { default: ({ title, children }) => React.createElement('main', null, React.createElement('h1', null, title), children) },
    '@/lib/supabase': { supabase: { auth: {} } },
    '@/lib/with-request-timeout': {},
    '@/lib/email-verification': loadHelper('lib/email-verification.ts'),
    '@/lib/session-activity': {},
  };
  vm.runInNewContext(compile(source), { exports, require: (name) => imports[name] });
  const html = renderToStaticMarkup(React.createElement(exports.default, { verificationOnly: true }));
  assert.match(html, /Verify your email/);
  assert.match(html, /id="verification-email"/);
  assert.match(html, /id="verification-code"/);
  assert.doesNotMatch(html, /id="password"/);
  assert.doesNotMatch(html, /id="fullName"/);
});

test('signup, dedicated verification and older verification URLs select the correct screen', async () => {
  const React = require('react');
  const SignupFlow = () => null;
  const imports = { 'react/jsx-runtime': require('react/jsx-runtime'), './SignupFlow': { default: SignupFlow }, '../signup/SignupFlow': { default: SignupFlow } };
  const signup = loadHelper('app/signup/page.tsx', {}, imports);
  const verification = loadHelper('app/verify-email/page.tsx', {}, imports);
  const standard = await signup.default({ searchParams: Promise.resolve({}) });
  const legacy = await signup.default({ searchParams: Promise.resolve({ verify: '1' }) });
  const dedicated = verification.default();
  assert.equal(React.isValidElement(standard), true);
  assert.equal(standard.props.verificationOnly, false);
  assert.equal(legacy.props.verificationOnly, true);
  assert.equal(dedicated.props.verificationOnly, true);
});

test('reset password preserves authenticated session and clears typed passwords', async () => {
  let signsOut = 0, updates = 0;
  const h = handler('app/reset-password/page.tsx', 'handleReset', {}, { updateUser: async () => { updates += 1; return { data: { user: { id: 'fixture' } }, error: null }; }, signOut: async () => { signsOut += 1; } });
  await h.invoke();
  assert.equal(updates, 1); assert.equal(signsOut, 0); assert.equal(h.ctx.success, true);
  assert.equal(h.ctx.password, ''); assert.equal(h.ctx.confirmation, ''); assert.deepEqual(h.routes, []);
});

test('sending password-reset instructions retains the Settings callback and current session', async () => {
  let parameters, signsOut = 0;
  const h = handler('app/forgot-password/page.tsx', 'submit', { returnToSettings: true, sentAt: 0 }, { resetPasswordForEmail: async (...args) => { parameters = args; return { error: null }; }, signOut: async () => { signsOut += 1; } });
  await h.invoke();
  assert.equal(parameters[1].redirectTo, 'https://www.example.invalid/reset-password?returnTo=settings');
  assert.equal(signsOut, 0); assert.equal(h.ctx.sent, true);
});

function idle(savedAgo = 0) {
  let now = 100000;
  const browserStorage = storage(); browserStorage.setItem('custodialsupport:last-active:v1:fixture', String(now - savedAgo));
  const listeners = {}, timers = [], cleanups = [];
  let expired = 0, signouts = 0;
  const FakeDate = class extends Date { static now() { return now; } };
  const browser = { localStorage: browserStorage, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {}, setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval() {} };
  const doc = { visibilityState: 'visible', addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {} };
  const activity = loadHelper('lib/session-activity.ts', { window: browser, Date: FakeDate });
  const react = { useRef: (value) => ({ current: value }), useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } };
  const hook = loadHelper('lib/use-idle-session.ts', { window: browser, document: doc, Date: FakeDate }, { react, './supabase': { supabase: { auth: { signOut: async () => { signouts += 1; } } } }, './session-activity': activity, './with-request-timeout': { withRequestTimeout: async (fn) => fn() } });
  const mount = () => hook.useIdleSession('fixture', () => { expired += 1; }, { timeoutMs: 1000 });
  mount();
  return { advance: (ms) => { now += ms; }, check: () => timers.at(-1)(), touch: () => listeners.pointerdown(), resume: () => listeners.focus(), remount: () => { cleanups.splice(0).forEach((fn) => fn()); mount(); }, expired: () => expired, signouts: () => signouts };
}
test('navigation/remount preserves an active session; actual long inactivity ends it once', () => {
  const h = idle(); h.advance(300); h.touch(); h.advance(300); h.remount();
  assert.equal(h.expired(), 0); h.advance(1001); h.check(); h.check();
  assert.equal(h.expired(), 1); assert.equal(h.signouts(), 1);
});
test('returning after idle cannot extend an already expired session by touching page', () => {
  const h = idle(1500); h.touch(); h.resume();
  assert.equal(h.expired(), 1); assert.equal(h.signouts(), 1);
});
test('transient network/access-token expiry does not claim the session has ended', () => {
  const { sessionHasEnded } = loadHelper('lib/session-activity.ts');
  assert.equal(sessionHasEnded({ code: 'network_error', status: 503 }), false);
  assert.equal(sessionHasEnded({ code: 'bad_jwt', message: 'JWT expired' }), false);
  assert.equal(sessionHasEnded({ code: 'refresh_token_not_found' }), true);
  assert.equal(sessionHasEnded({ name: 'AuthSessionMissingError' }), true);
});
