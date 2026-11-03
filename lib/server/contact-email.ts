import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { brandedEmail, escapeEmailHtml } from "./email-brand";

const SUPPORT_MAILBOX = "support@custodialmanagement.net";
const categories = new Set(["General inquiry", "Account assistance", "Transaction support", "Technical issue", "Other"]);
const headerControls = /[\u0000-\u001f\u007f]/;
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type ContactRequest = {
  fullName: string;
  email: string;
  category: string;
  subject: string;
  message: string;
};

export class ContactEmailError extends Error {
  constructor(readonly code: "INVALID" | "NOT_CONFIGURED" | "RATE_LIMITED" | "UNAVAILABLE", readonly retryAfter = 0) {
    super(code);
    this.name = "ContactEmailError";
  }
}

/** Accept only the public form's fields. Nothing can set recipients or mail headers. */
export function parseContactRequest(value: unknown): ContactRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContactEmailError("INVALID");
  const record = value as Record<string, unknown>;
  const allowed = new Set(["fullName", "email", "category", "subject", "message", "website"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new ContactEmailError("INVALID");
  if (record.website !== undefined && (typeof record.website !== "string" || record.website.trim())) {
    throw new ContactEmailError("INVALID");
  }
  const fields = ["fullName", "email", "category", "subject", "message"] as const;
  if (fields.some((field) => typeof record[field] !== "string")) throw new ContactEmailError("INVALID");
  const request = Object.fromEntries(fields.map((field) => [field, (record[field] as string).trim()])) as ContactRequest;
  const localPart = request.email.split("@")[0];
  if (!request.fullName || request.fullName.length > 100 || headerControls.test(request.fullName)
      || !request.subject || request.subject.length > 160 || headerControls.test(request.subject)
      || request.email.length > 254 || !emailPattern.test(request.email) || localPart.startsWith(".")
      || localPart.endsWith(".") || localPart.includes("..") || !categories.has(request.category)
      || request.message.length < 10 || request.message.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(request.message)) {
    throw new ContactEmailError("INVALID");
  }
  return request;
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const host = process.env.SUPPORT_SMTP_HOST?.trim();
  const port = process.env.SUPPORT_SMTP_PORT?.trim();
  const user = process.env.SUPPORT_SMTP_USER?.trim();
  const pass = process.env.SUPPORT_SMTP_PASSWORD;
  if (!url || !key || !host || /[\s/@]/.test(host) || !user || !pass || (port !== "465" && port !== "587")) {
    throw new ContactEmailError("NOT_CONFIGURED");
  }
  return { url, key, host, port: Number(port), user, pass };
}

function identityHashes(request: ContactRequest, headers: Headers, key: string) {
  // Vercel sets this header. Do not trust arbitrary forwarded headers elsewhere.
  const forwarded = process.env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  const ip = forwarded && isIP(forwarded) ? forwarded : "shared-unidentified-client";
  const hash = (kind: string, value: string) => createHmac("sha256", key).update(`${kind}:${value}`).digest("hex");
  return { email: hash("contact-email", request.email.toLowerCase()), ip: hash("contact-ip", ip) };
}

export async function sendContactEmail(request: ContactRequest, headers: Headers): Promise<void> {
  // Check SMTP before consuming a rate-limit slot; missing config never claims success.
  const settings = config();
  const service = createClient(settings.url, settings.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const hashes = identityHashes(request, headers, settings.key);
  const { data, error } = await service.rpc("claim_contact_email_slot", {
    p_email_hash: hashes.email,
    p_ip_hash: hashes.ip,
  });
  if (error || !data || typeof data.allowed !== "boolean") throw new ContactEmailError("UNAVAILABLE");
  if (!data.allowed) {
    const retryAfter = typeof data.retry_after === "number" && Number.isFinite(data.retry_after)
      ? Math.min(86400, Math.max(1, Math.ceil(data.retry_after))) : 3600;
    throw new ContactEmailError("RATE_LIMITED", retryAfter);
  }

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: true,
    auth: { user: settings.user, pass: settings.pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 20000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const reference = randomUUID();
    const result = await transport.sendMail({
      from: { name: "CustodialSupport", address: SUPPORT_MAILBOX },
      to: SUPPORT_MAILBOX,
      envelope: { from: SUPPORT_MAILBOX, to: [SUPPORT_MAILBOX] },
      replyTo: { name: request.fullName, address: request.email },
      subject: `Contact request: ${request.subject}`,
      messageId: `<contact-${reference}@custodialmanagement.net>`,
      html: brandedEmail({ title: "New contact request", eyebrow: "Website enquiry", preview: "A visitor submitted the CustodialSupport contact form.", content: `<p style="margin:0 0 20px;color:#b9cadb;">A visitor sent a message through your website.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="color:#b9cadb;font-size:13px;line-height:23px;">${[["Name", request.fullName], ["Reply email", request.email], ["Category", request.category], ["Subject", request.subject]].map(([label, value]) => `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #214052;color:#8ba4bb;vertical-align:top;">${label}</td><td style="padding:8px 0;border-bottom:1px solid #214052;word-break:break-word;">${escapeEmailHtml(value)}</td></tr>`).join("")}</table><div style="margin:24px 0;padding:18px;border:1px solid #285565;border-radius:12px;background-color:#071725;color:#e8f1fa;white-space:pre-wrap;word-break:break-word;">${escapeEmailHtml(request.message)}</div><p style="margin:0;color:#8ba4bb;font-size:12px;">Reference: ${escapeEmailHtml(reference)}<br>Reply to this email to respond to the sender.</p>` }),
      text: `A visitor submitted the CustodialSupport contact form.\n\nReference: ${reference}\nName: ${request.fullName}\nReply email: ${request.email}\nCategory: ${request.category}\nSubject: ${request.subject}\n\n${request.message}`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted.some((address) => address.toLowerCase() === SUPPORT_MAILBOX)) {
      throw new ContactEmailError("UNAVAILABLE");
    }
  } catch {
    // Do not return or log raw SMTP diagnostics, addresses or visitor content.
    throw new ContactEmailError("UNAVAILABLE");
  } finally {
    transport.close();
  }
}
