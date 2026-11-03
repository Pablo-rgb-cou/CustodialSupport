import "server-only";

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { brandedEmail, emailButton, escapeEmailHtml } from "./email-brand";

const SUPPORT_MAILBOX = "support@custodialmanagement.net";
const ADMIN_ORIGIN = "https://www.custodialmanagement.net";
const BATCH_SIZE = 2;
const MAX_ATTEMPTS = 6;

export const supportEmailTicketIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupportEmailError extends Error {
  constructor(readonly code: "NOT_CONFIGURED" | "DATABASE") {
    super(code === "NOT_CONFIGURED" ? "Email alerts are not configured." : "Email delivery is temporarily unavailable.");
    this.name = "SupportEmailError";
  }
}

type OutboxJob = {
  id: string;
  event_kind: "ticket_created" | "client_reply";
  ticket_id: string;
  created_at: string;
  attempts: number;
  lease_token: string;
};

export type SupportEmailDispatchSummary = {
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
  unconfirmed: number;
};

export type SupportEmailScope = { clientId: string; ticketId: string };

function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new SupportEmailError("NOT_CONFIGURED");
  return { url, key };
}

// Uses the caller's token and existing RLS to verify ticket ownership.
export function createSupportEmailUserClient(accessToken: string) {
  const { url, key } = supabasePublicConfig();
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function supportMailConfig() {
  const { url } = supabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const host = process.env.SUPPORT_SMTP_HOST?.trim();
  const port = process.env.SUPPORT_SMTP_PORT?.trim();
  const user = process.env.SUPPORT_SMTP_USER?.trim();
  const pass = process.env.SUPPORT_SMTP_PASSWORD;

  if (!serviceKey || !host || /[\s/@]/.test(host) || !user || !pass || (port !== "465" && port !== "587")) {
    throw new SupportEmailError("NOT_CONFIGURED");
  }

  return { url, serviceKey, host, port: Number(port), user, pass };
}

// Store only allowlisted diagnostics, never SMTP error messages or credentials.
export function supportDeliveryErrorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "EAUTH") return "SMTP_AUTH";
  if (code === "ETIMEDOUT" || code === "ESOCKET") return "SMTP_TIMEOUT";
  if (code === "ECONNECTION" || code === "ECONNREFUSED" || code === "EDNS") return "SMTP_CONNECT";
  if (code === "EENVELOPE") return "SMTP_REJECTED";
  return "SMTP_SEND";
}

function alertMessage(job: OutboxJob) {
  const link = new URL("/admin/tickets", ADMIN_ORIGIN);
  link.searchParams.set("ticket", job.ticket_id);
  const event = job.event_kind === "ticket_created" ? "A client created a support ticket." : "A client replied to a support ticket.";
  const subject = job.event_kind === "ticket_created" ? "New support ticket" : "New client support reply";
  const receivedAt = new Date(job.created_at).toISOString();

  return {
    from: { name: "CustodialSupport", address: SUPPORT_MAILBOX },
    to: SUPPORT_MAILBOX,
    envelope: { from: SUPPORT_MAILBOX, to: [SUPPORT_MAILBOX] },
    subject: `${subject} · ${job.ticket_id.slice(0, 8)}`,
    messageId: `<support-alert-${job.id}@custodialmanagement.net>`,
    html: brandedEmail({ title: subject, eyebrow: "Support desk update", preview: event, content: `<p style="margin:0 0 20px;color:#b9cadb;">${event}</p><div style="padding:18px;border:1px solid #285565;border-radius:12px;background-color:#071725;"><p style="margin:0;color:#65edd0;">Ticket #${escapeEmailHtml(job.ticket_id.slice(0, 8))}</p><p style="margin:6px 0 0;color:#8ba4bb;font-size:13px;">Received ${escapeEmailHtml(receivedAt)}</p></div>${emailButton("Review conversation", link.toString())}<p style="margin:0;color:#8ba4bb;font-size:12px;">Sign in to your administrator account to read the conversation. Private message content is kept in your dashboard.</p>` }),
    text: `${event}\n\nTicket: ${job.ticket_id.slice(0, 8)}\nReceived: ${receivedAt}\n\nSign in to the administrator dashboard to review it:\n${link.toString()}\n\nThis alert does not include private conversation content.`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

/** The database owns enqueue, retries and leases; callers cannot construct jobs. */
export async function dispatchSupportEmails(scope?: SupportEmailScope): Promise<SupportEmailDispatchSummary> {
  // This gate runs before claiming: absent SMTP secrets leave every job pending.
  const config = supportMailConfig();
  if (scope && (!supportEmailTicketIdPattern.test(scope.clientId) || !supportEmailTicketIdPattern.test(scope.ticketId))) {
    throw new SupportEmailError("DATABASE");
  }

  const service = createClient(config.url, config.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await service.rpc("claim_support_email_jobs", {
    p_limit: BATCH_SIZE,
    p_client_id: scope?.clientId ?? null,
    p_ticket_id: scope?.ticketId ?? null,
  });
  if (error || !Array.isArray(data)) throw new SupportEmailError("DATABASE");

  const jobs = data as OutboxJob[];
  const summary: SupportEmailDispatchSummary = { claimed: jobs.length, sent: 0, retrying: 0, failed: 0, unconfirmed: 0 };
  if (jobs.length === 0) return summary;

  const transport = createSupportMailTransport(config);

  try {
    await Promise.all(jobs.map(async (job) => {
      let delivered = false;
      let errorCode: string | null = null;

      try {
        if (!supportEmailTicketIdPattern.test(job.id) || !supportEmailTicketIdPattern.test(job.ticket_id)
          || !supportEmailTicketIdPattern.test(job.lease_token)
          || !["ticket_created", "client_reply"].includes(job.event_kind)
          || !Number.isFinite(new Date(job.created_at).getTime())) {
          errorCode = "INVALID_JOB";
        } else {
          const result = await transport.sendMail(alertMessage(job));
          delivered = result.accepted.some((recipient) => recipient.toLowerCase() === SUPPORT_MAILBOX);
          if (!delivered) errorCode = "SMTP_REJECTED";
        }
      } catch (sendError) {
        errorCode = supportDeliveryErrorCode(sendError);
      }

      try {
        const { data: completed, error: completionError } = await service.rpc("finish_support_email_job", {
          p_id: job.id, p_lease_token: job.lease_token, p_success: delivered, p_error_code: errorCode,
        });
        if (completionError || completed !== true) summary.unconfirmed += 1;
        else if (delivered) summary.sent += 1;
        else if (job.attempts >= MAX_ATTEMPTS) summary.failed += 1;
        else summary.retrying += 1;
      } catch { summary.unconfirmed += 1; }
    }));
  } finally { transport.close(); }
  return summary;
}

export function createSupportMailTransport(config: ReturnType<typeof supportMailConfig>) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

}
