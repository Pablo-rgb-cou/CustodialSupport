/* eslint-disable @typescript-eslint/no-require-imports */
// Offline: all authentication, database, and SMTP operations are mocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const id = "12345678-1234-4234-8234-123456789abc";
const lease = "abcdef12-1234-4234-8234-123456789abc";
const draft = { recipientName: "Alex <img src=x>", recipientEmail: "alex@example.test", clientId: null, subject: "Account <update>", message: "Hello <script>alert(1)</script>\nSecond line" };
function fixture() {
  const env = { CUSTOMER_EMAILS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "test-only" };
  const state = { authenticated: true, role: "admin", jobs: [], sent: [], calls: [], sendsError: null, dbError: null, finishError: false, createdServices: 0, clientEmail: "alex@example.test", rows: [] };
  const query = () => {
    const result = { data: state.rows, error: state.dbError, count: state.rows.length };
    const q = { then: (ok, bad) => Promise.resolve(result).then(ok, bad), maybeSingle: async () => ({ data: { role: "client", full_name: "Alex" }, error: state.dbError }), single: async () => ({ data: { id }, error: state.dbError }) };
    for (const method of ["select", "eq", "order", "range", "limit", "ilike", "insert", "delete"]) q[method] = () => q;
    return q;
  };
  const service = { from: query, auth: { admin: { getUserById: async () => ({ data: { user: { email: state.clientEmail, email_confirmed_at: "2026-11-03T12:00:00Z" } }, error: null }) } }, rpc: async (name, args) => {
    state.calls.push({ name, args });
    if (name === "claim_customer_email_jobs") return { data: state.jobs, error: state.dbError };
    if (name === "finish_customer_email_job") return { data: !state.finishError, error: state.finishError };
    return { data: id, error: state.dbError };
  } };
  const user = { auth: { getUser: async () => ({ data: { user: state.authenticated ? { id } : null }, error: state.authenticated ? null : {} }) }, from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { role: state.role }, error: null }) }; return q; } };
  const support = { createSupportEmailUserClient: () => user, supportMailConfig: () => ({}), supportDeliveryErrorCode: (error) => ({ EAUTH: "SMTP_AUTH", ECONNECTION: "SMTP_CONNECT", ETIMEDOUT: "SMTP_TIMEOUT" })[error?.code] || "SMTP_SEND", createSupportMailTransport: () => ({ close: () => {}, sendMail: async (mail) => { state.sent.push(mail); if (state.sendsError) throw state.sendsError; return { accepted: [mail.to.address] }; } }) };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const loadedModule = { exports: {} };
    const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const resolve = (name) => {
      if (name === "server-only") return {};
      if (name === "@supabase/supabase-js") return { createClient: () => { state.createdServices++; return service; } };
      if (name === "./support-email") return support;
      if (name === "./email-brand") return load("lib/server/email-brand.ts");
      if (name === "./admin-email-auth" || name === "@/lib/server/admin-email-auth") return load("lib/server/admin-email-auth.ts");
      if (name === "../customer-email-content" || name === "@/lib/customer-email-content") return load("lib/customer-email-content.ts");
      if (name === "@/lib/server/customer-email") return load("lib/server/customer-email.ts");
      throw new Error(`Unexpected import ${name}`);
    };
    vm.runInNewContext(compiled, { exports: loadedModule.exports, module: loadedModule, require: resolve, process: { env }, Request, Response, URL, TextDecoder, Buffer, Date });
    cache[file] = loadedModule.exports; return loadedModule.exports;
  }
  return { env, state, content: load("lib/customer-email-content.ts"), worker: load("lib/server/customer-email.ts"), route: load("app/api/admin/emails/route.ts") };
}
const request = (body, headers = {}) => new Request("https://app.test/api/admin/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-session", ...headers }, body: JSON.stringify(body) });
(async () => {
  let f = fixture();
  assert.equal((await f.route.GET(new Request("https://app.test/api/admin/emails"))).status, 401);
  assert.equal(f.state.createdServices, 0, "No privileged client before verified admin auth");
  f.state.role = "client";
  assert.equal((await f.route.POST(request({ action: "send", ...draft, requestId: id }))).status, 403);
  assert.equal(f.state.calls.length, 0);
  assert.equal(f.state.createdServices, 0);
  f = fixture(); f.state.authenticated = false;
  assert.equal((await f.route.POST(request({ action: "preview", ...draft }))).status, 401);
  f = fixture();
  assert.equal((await f.route.POST(request({ action: "preview", ...draft }, { Origin: "https://evil.test" }))).status, 403);
  for (const patch of [{ recipientEmail: "a@example.test,b@example.test" }, { recipientEmail: "a@example.test\r\nBcc:b@example.test" }, { subject: "Subject\nBcc:test" }, { message: "x".repeat(12001) }, { clientId: "wrong" }]) assert.throws(() => f.content.parseCustomerEmailDraft({ ...draft, ...patch }));
  let response = await f.route.POST(request({ action: "preview", ...draft }));
  assert.equal(response.status, 200);
  const preview = await response.json();
  assert(preview.html.includes("&lt;script&gt;")); assert(!preview.html.includes("<script>"));
  assert(preview.html.includes("Alex &lt;img")); assert(preview.html.includes("#061321"));
  assert.equal(f.state.sent.length, 0); assert.equal(f.state.calls.length, 0, "Preview cannot queue or send");
  assert.equal((await f.route.POST(request({ action: "preview", ...draft, clientId: id, recipientEmail: "stale@example.test" }))).status, 409);
  response = await f.route.POST(request({ action: "send", ...draft, requestId: id }));
  assert.equal(response.status, 202); assert.equal(f.state.calls[0].args.p_actor, id); assert.equal(f.state.calls[0].args.p_request_id, id); assert.equal(f.state.sent.length, 0, "Send only enqueues durable work");
  f.state.dbError = { message: "EMAIL_RATE_LIMIT" };
  assert.equal((await f.route.POST(request({ action: "send", ...draft, requestId: id }))).status, 429);
  f.env.CUSTOMER_EMAILS_ENABLED = "false";
  assert.equal((await f.route.POST(request({ action: "send", ...draft, requestId: id }))).status, 503);
  const before = f.state.calls.length; await f.worker.dispatchCustomerEmails(); assert.equal(f.state.calls.length, before);
  f = fixture();
  assert.equal((await f.route.POST(request({ action: "save-template", name: "Reusable", subject: draft.subject, message: draft.message }))).status, 201);
  assert.equal((await f.route.POST(request({ action: "delete-template", id: "invalid" }))).status, 400);
  f = fixture(); f.state.jobs = [{ id, lease_token: lease, kind: "admin_email", recipient_name: draft.recipientName, recipient_email: draft.recipientEmail, subject: draft.subject, message: draft.message, client_id: null, attempts: 1 }];
  let summary = await f.worker.dispatchCustomerEmails();
  assert.equal(summary.submitted, 1); assert.equal(f.state.sent[0].from.address, "support@custodialmanagement.net"); assert.equal(f.state.sent[0].messageId, `<customer-email-${id}@custodialmanagement.net>`); assert.equal(f.state.sent[0].disableUrlAccess, true);
  assert.equal(f.state.calls.at(-1).args.p_lease, lease);
  f.state.sendsError = { code: "EAUTH", message: "secret mailbox error" }; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.retrying, 1); assert.equal(f.state.calls.at(-1).args.p_error, "SMTP_AUTH"); assert(!JSON.stringify(summary).includes("secret"));
  f.state.sendsError = { code: "ETIMEDOUT" }; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.uncertain, 1, "Ambiguous SMTP outcome must never auto-resend");
  f.state.sendsError = { responseCode: 550 }; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.failed, 1);
  f.state.sendsError = { code: "EENVELOPE", responseCode: 450 }; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.retrying, 1, "Explicit temporary recipient rejection can retry safely");
  f.state.sendsError = { code: "ECONNECTION", command: "DATA" }; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.uncertain, 1, "A connection loss after DATA is not a safe retry");
  f.state.sendsError = null; f.state.finishError = true; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.unconfirmed, 1);
  f = fixture(); f.state.jobs = [{ id, lease_token: lease, kind: "registration", recipient_name: "Support team", recipient_email: "support@custodialmanagement.net", subject: "New Client Registration — CustodialSupport", attempts: 1, registration_details: { full_name: "Verified Client", email: "verified@example.test", user_id: id, registered_at: "2026-11-03T11:00:00Z", verified_at: "2026-11-03T12:00:00Z", password: "DO_NOT_INCLUDE", token: "DO_NOT_INCLUDE" } }];
  summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.submitted, 1);
  assert(f.state.sent[0].html.includes("Verified Client")); assert(f.state.sent[0].html.includes(id)); assert(!JSON.stringify(f.state.sent).includes("DO_NOT_INCLUDE"));
  f.state.jobs[0].recipient_email = "wrong@example.test"; summary = await f.worker.dispatchCustomerEmails(); assert.equal(summary.failed, 1); assert.equal(f.state.sent.length, 1);
  response = await fixture().route.POST(request({ action: "preview", ...draft, message: "x".repeat(25000) })); assert.equal(response.status, 413);
  console.log("PASS: admin auth/authorization, origin checks, input validation/escaping, preview isolation, queue-only sends, client email resolution, rate-limit response, templates, disabled mode, leases, safe retries/uncertain outcomes, registration allowlist; no real SMTP calls.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
