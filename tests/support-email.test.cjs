/* eslint-disable @typescript-eslint/no-require-imports -- This Node VM test harness executes CommonJS modules. */
/* Offline checks only: mocked Supabase and SMTP, no credentials/network/database writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const project = path.resolve(__dirname, '..');
const ts = require(path.join(project, "node_modules/typescript"));
const draft = project;
const id = "12345678-1234-4234-8234-123456789abc";
const clientId = "abcdef12-1234-4234-8234-123456789abc";
const tokenId = "87654321-1234-4234-8234-123456789abc";
const job = { id, ticket_id: id, event_kind: "client_reply", created_at: "2026-11-03T10:00:00Z", attempts: 1, lease_token: tokenId };

function build() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
    SUPPORT_SMTP_HOST: "smtp.example.test", SUPPORT_SMTP_PORT: "587",
    SUPPORT_SMTP_USER: "support@custodialmanagement.net", SUPPORT_SMTP_PASSWORD: "test-only",
    CRON_SECRET: "a".repeat(40),
  };
  const state = { jobs: [], claims: [], finishes: [], sends: [], transports: [], sendError: null, finishError: false, owner: true, auth: true };
  const service = { rpc: async (name, args) => {
    if (name === "claim_support_email_jobs") { state.claims.push(args); return { data: state.jobs, error: null }; }
    assert.equal(name, "finish_support_email_job");
    state.finishes.push(args);
    return { data: !state.finishError, error: state.finishError ? { code: "TEST" } : null };
  } };
  const user = {
    auth: { getUser: async () => ({ data: { user: state.auth ? { id: clientId } : null }, error: state.auth ? null : { message: "expired" } }) },
    from: (table) => {
      assert.equal(table, "support_tickets");
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: state.owner ? { id } : null, error: null }) };
      return query;
    },
  };
  const mocks = {
    "server-only": {},
    "@supabase/supabase-js": { createClient: (_url, key) => key === "public-test-key" ? user : service },
    nodemailer: { createTransport: (options) => {
      state.transports.push(options);
      return { close: () => {}, sendMail: async (mail) => {
        state.sends.push(mail);
        if (state.sendError) throw state.sendError;
        return { accepted: ["support@custodialmanagement.net"] };
      } };
    } },
  };
  function load(file) {
    const source = fs.readFileSync(path.join(draft, file), "utf8");
    const compiled = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true,
    } });
    const errors = compiled.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (value) => value, getCurrentDirectory: () => draft, getNewLine: () => "\n",
    }));
    const loadedModule = { exports: {} };
    vm.runInNewContext(compiled.outputText, { module: loadedModule, exports: loadedModule.exports, process: { env }, URL, Date, Buffer, Request, Response,
      require: (name) => name in mocks ? mocks[name] : require(name),
    }, { filename: file });
    return loadedModule.exports;
  }
  const worker = load("lib/server/support-email.ts");
  mocks["@/lib/server/support-email"] = worker;
  const route = load("app/api/support/email/route.ts");
  return { env, state, worker, route };
}

(async () => {
  let f = build();
  delete f.env.SUPPORT_SMTP_PASSWORD;
  await assert.rejects(() => f.worker.dispatchSupportEmails(), (error) => error.code === "NOT_CONFIGURED");
  assert.equal(f.state.claims.length, 0, "Unconfigured SMTP must not claim jobs");

  f = build();
  f.state.jobs = [job];
  let summary = await f.worker.dispatchSupportEmails({ clientId, ticketId: id });
  assert.equal(summary.sent, 1);
  assert.equal(f.state.claims[0].p_client_id, clientId);
  assert.equal(f.state.claims[0].p_ticket_id, id);
  assert.equal(f.state.finishes[0].p_lease_token, tokenId);
  assert.equal(f.state.finishes[0].p_success, true);
  assert.equal(f.state.transports[0].secure, false);
  assert.equal(f.state.transports[0].requireTLS, true);
  assert.equal(f.state.transports[0].tls.rejectUnauthorized, true);
  assert.equal(f.state.sends[0].to, "support@custodialmanagement.net");
  assert.equal(f.state.sends[0].from.address, "support@custodialmanagement.net");
  assert.match(f.state.sends[0].text, /https:\/\/www\.custodialmanagement\.net\/admin\/tickets\?ticket=/);
  assert.equal(f.state.sends[0].messageId, `<support-alert-${id}@custodialmanagement.net>`);

  f = build(); f.env.SUPPORT_SMTP_PORT = "465"; f.state.jobs = [{ ...job, attempts: 6 }];
  f.state.sendError = Object.assign(new Error("Never expose mailbox credentials or raw body"), { code: "EAUTH" });
  summary = await f.worker.dispatchSupportEmails();
  assert.equal(f.state.transports[0].secure, true);
  assert.equal(summary.failed, 1);
  assert.equal(f.state.finishes[0].p_error_code, "SMTP_AUTH");
  assert.equal(JSON.stringify(summary).includes("credentials"), false);

  f = build(); f.state.jobs = [job]; f.state.finishError = true;
  summary = await f.worker.dispatchSupportEmails();
  assert.equal(summary.unconfirmed, 1);
  assert.equal(f.state.sends.length, 1, "Completion failures must not resend in same request");

  f = build();
  assert.equal((await f.route.GET(new Request("https://app.test/api/support/email"))).status, 401);
  assert.equal(f.state.claims.length, 0);
  assert.equal((await f.route.GET(new Request("https://app.test/api/support/email", { headers: { authorization: `Bearer ${f.env.CRON_SECRET}` } }))).status, 200);

  const post = (headers = {}, body = { ticketId: id }) => new Request("https://app.test/api/support/email", {
    method: "POST", headers: { authorization: "Bearer valid-token", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  f = build();
  assert.equal((await f.route.POST(post({ origin: "https://wrong.test" }))).status, 403);
  assert.equal((await f.route.POST(post({}, { ticketId: "invalid" }))).status, 400);
  f.state.auth = false;
  assert.equal((await f.route.POST(post())).status, 401);
  f.state.auth = true; f.state.owner = false;
  assert.equal((await f.route.POST(post())).status, 403);
  assert.equal(f.state.claims.length, 0);
  f.state.owner = true;
  assert.equal((await f.route.POST(post())).status, 200);
  assert.equal(f.state.claims[0].p_client_id, clientId);
  assert.equal(f.state.claims[0].p_ticket_id, id);

  const sql = fs.readFileSync(path.join(draft, "supabase/migrations/20261103035431_support_ticket_email_outbox.sql"), "utf8");
  assert.match(sql, /unique \(event_kind, source_id\)/);
  assert.match(sql, /for update of o skip locked/i);
  assert.match(sql, /o\.lease_token = p_lease_token/);
  assert.match(sql, /new\.sender_id = caller_id and new\.is_internal = false/);
  assert.match(sql, /revoke all on function public\.claim_support_email_jobs/);
  console.log("PASS: offline worker/config/TLS/fixed recipient/retry/completion/auth/scope checks; TS syntax; SQL invariant checks.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
