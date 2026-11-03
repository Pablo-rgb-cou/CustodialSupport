/* eslint-disable @typescript-eslint/no-require-imports -- This Node VM test harness executes CommonJS modules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const fields = { fullName: 'Test Visitor', email: 'visitor@example.invalid', category: 'General inquiry', subject: 'Contact form test', message: 'This is a test question for support.', website: '' };
const compile = (source, fileName) => ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;

function fixture() {
  const state = { claims: [], transports: [], mails: [], closes: 0, allowed: true, retryAfter: 120, databaseError: false, sendError: false };
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-private-key',
    SUPPORT_SMTP_HOST: 'smtp.example.invalid', SUPPORT_SMTP_PORT: '465', SUPPORT_SMTP_USER: 'mailbox@example.invalid', SUPPORT_SMTP_PASSWORD: 'test-secret-only' };
  const mocks = {
    'server-only': {},
    '@supabase/supabase-js': { createClient: () => ({ rpc: async (name, args) => {
      assert.equal(name, 'claim_contact_email_slot'); state.claims.push(args);
      return { data: state.databaseError ? null : { allowed: state.allowed, retry_after: state.retryAfter }, error: state.databaseError ? { message: 'private diagnostic' } : null };
    } }) },
    nodemailer: { createTransport: (options) => {
      state.transports.push(options);
      return { sendMail: async (mail) => {
        state.mails.push(mail);
        if (state.sendError) throw new Error('test-secret-only private SMTP diagnostic');
        return { accepted: ['support@custodialmanagement.net'] };
      }, close: () => { state.closes++; } };
    } },
  };
  function load(file) {
    const loadedModule = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8'), file), {
      module: loadedModule, exports: loadedModule.exports, process: { env }, URL, Headers, Request, Response, TextDecoder,
      require: (name) => name in mocks ? mocks[name] : require(name),
    });
    return loadedModule.exports;
  }
  const server = load('lib/server/contact-email.ts');
  mocks['@/lib/server/contact-email'] = server;
  const route = load('app/api/contact/route.ts');
  const request = (body = fields, headers = {}) => new Request('https://example.invalid/api/contact', {
    method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { state, env, server, route, request };
}

function clientHandler(fetchResponse) {
  const file = 'app/contact/page.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSubmit') handler = node; else ts.forEachChild(node, visit); }
  visit(source); assert.ok(handler);
  const state = { sending: false, sent: false, error: '', resets: 0, fetches: 0 };
  const form = { reportValidity: () => true, reset: () => { state.resets++; } };
  const context = {
    Object, Error, String, FormData: class { get(key) { return fields[key]; } }, sending: false,
    setSending: (value) => { state.sending = value; }, setSent: (value) => { state.sent = value; }, setError: (value) => { state.error = value; },
    withRequestTimeout: async (work) => work(new AbortController().signal),
    fetch: async (url, options) => { assert.equal(url, '/api/contact'); assert.equal(options.method, 'POST'); state.fetches++; return fetchResponse; },
  };
  vm.runInNewContext(compile(handler.getText(source), file), context);
  return { state, invoke: () => context.handleSubmit({ preventDefault() {}, currentTarget: form }) };
}

(async () => {
  let f = fixture();
  let response = await f.route.POST(f.request());
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  assert.equal(f.state.mails.length, 1); assert.equal(f.state.closes, 1);
  const mail = f.state.mails[0];
  assert.equal(mail.from.address, 'support@custodialmanagement.net');
  assert.equal(mail.to, 'support@custodialmanagement.net');
  assert.deepEqual([...mail.envelope.to], ['support@custodialmanagement.net']);
  assert.equal(mail.replyTo.address, fields.email); assert(mail.text.includes(fields.message));
  assert.equal(mail.attachments, undefined); assert.equal(mail.html, undefined);
  assert.equal(mail.disableFileAccess, true); assert.equal(mail.disableUrlAccess, true);
  assert.equal(f.state.transports[0].secure, true); assert.equal(f.state.transports[0].requireTLS, true);
  assert.equal(f.state.transports[0].tls.rejectUnauthorized, true); assert.equal(f.state.transports[0].logger, false);
  assert.match(f.state.claims[0].p_email_hash, /^[a-f0-9]{64}$/); assert.match(f.state.claims[0].p_ip_hash, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(f.state.claims[0]).includes(fields.email));

  for (const invalid of [{ ...fields, email: 'victim@example.invalid,other@example.invalid' },
    { ...fields, subject: 'hello\r\nBcc: other@example.invalid' }, { ...fields, website: 'bot-value' },
    { ...fields, category: 'unrecognized' }, { ...fields, message: 'short' },
    { ...fields, to: 'other@example.invalid' }, { ...fields, fullName: 'Visitor\nInjected' }]) {
    f = fixture(); response = await f.route.POST(f.request(invalid));
    assert.equal(response.status, 400); assert.equal(f.state.claims.length, 0); assert.equal(f.state.mails.length, 0);
  }
  f = fixture(); assert.equal((await f.route.POST(f.request(fields, { Origin: 'https://other.invalid' }))).status, 403);
  assert.equal(f.state.claims.length, 0);
  f = fixture(); assert.equal((await f.route.POST(f.request(fields, { 'Content-Type': 'text/plain' }))).status, 415);
  f = fixture(); assert.equal((await f.route.POST(f.request({ ...fields, message: 'x'.repeat(17000) }))).status, 413);
  let cancelled = false;
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10000)); controller.enqueue(new Uint8Array(10000)); }, cancel() { cancelled = true; } });
  f = fixture(); response = await f.route.POST(new Request('https://example.invalid/api/contact', {
    method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: oversized, duplex: 'half',
  }));
  assert.equal(response.status, 413); assert.equal(cancelled, true); assert.equal(f.state.mails.length, 0);

  f = fixture(); delete f.env.SUPPORT_SMTP_PASSWORD;
  response = await f.route.POST(f.request()); assert.equal(response.status, 503); assert.equal(f.state.claims.length, 0);
  f = fixture(); f.state.allowed = false;
  response = await f.route.POST(f.request()); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '120'); assert.equal(f.state.mails.length, 0);
  f = fixture(); f.state.databaseError = true;
  response = await f.route.POST(f.request()); assert.equal(response.status, 503); assert.equal(f.state.mails.length, 0);
  f = fixture(); f.state.sendError = true;
  response = await f.route.POST(f.request()); assert.equal(response.status, 503);
  assert(!(await response.text()).includes('test-secret-only')); assert.equal(f.state.closes, 1);
  f = fixture(); f.env.SUPPORT_SMTP_PORT = '587'; await f.route.POST(f.request());
  assert.equal(f.state.transports[0].secure, false); assert.equal(f.state.transports[0].requireTLS, true);

  const success = clientHandler(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  await success.invoke(); assert.equal(success.state.sent, true); assert.equal(success.state.resets, 1); assert.equal(success.state.sending, false);
  const failure = clientHandler(new Response(JSON.stringify({ error: 'Not configured' }), { status: 503 }));
  await failure.invoke(); assert.equal(failure.state.sent, false); assert.equal(failure.state.resets, 0); assert(failure.state.error); assert.equal(failure.state.sending, false);
  console.log('PASS: contact validation, fixed recipients, reply-to, TLS, bounded streaming body, origin, honeypot, hashed durable limiter, safe configuration/SMTP errors, and honest client success/failure states.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
