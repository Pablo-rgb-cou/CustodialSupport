import "server-only";
import { brandedEmail, escapeEmailHtml } from "./email-brand";
import { createSupportMailTransport, supportDeliveryErrorCode, supportMailConfig } from "./support-email";
import { emailServiceClient } from "./admin-email-auth";
import { customerEmailUuid, parseCustomerEmailDraft, type CustomerEmailDraft } from "../customer-email-content";

const MAILBOX = "support@custodialmanagement.net";
export function customerEmailHtml(draft: CustomerEmailDraft) {
  return brandedEmail({ logo: true, title: draft.subject, eyebrow: "A message from your support team", preview: "A personal message from CustodialSupport.", content: `<p style="margin:0 0 18px;color:#e8f1fa;">Hello ${escapeEmailHtml(draft.recipientName || "there")},</p><div style="color:#b9cadb;white-space:pre-wrap;word-break:break-word;">${escapeEmailHtml(draft.message)}</div><p style="margin:26px 0 0;color:#e8f1fa;">Kind regards,<br><strong style="color:#65edd0;">The CustodialSupport team</strong></p>` });
}

type RegistrationDetails = { full_name: string; email: string; user_id: string; registered_at: string; verified_at: string };
export function registrationEmailHtml(details: RegistrationDetails) {
  const rows = [["Full name", details.full_name || "Not provided"], ["Registered email", details.email], ["Registration date (UTC)", new Date(details.registered_at).toISOString()], ["Verified at (UTC)", new Date(details.verified_at).toISOString()], ["Supabase user ID", details.user_id], ["Verification status", "Email verified"]];
  return brandedEmail({ logo: true, title: "New client registration", eyebrow: "Verified account", preview: "A new client has completed email verification.", content: `<p style="color:#b9cadb;">A client has completed registration and verified their email address.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => `<tr><td style="padding:12px 10px 12px 0;vertical-align:top;border-bottom:1px solid #214052;color:#8ba4bb;font-size:12px;">${label}</td><td style="padding:12px 0;border-bottom:1px solid #214052;color:#e8f1fa;font-size:13px;word-break:break-word;">${escapeEmailHtml(value)}</td></tr>`).join("")}</table>` });
}

// Retry only failures known to precede submission. Unknown transport outcomes
// need human review; an automatic resend could deliver the same email twice.
export function customerEmailFailure(error: unknown): { outcome: "retry" | "failed" | "uncertain"; code: string } {
  const code = supportDeliveryErrorCode(error);
  const smtp = error as { code?: string; command?: string; responseCode?: number } | null;
  if (code === "SMTP_AUTH" || smtp?.code === "EDNS" || smtp?.code === "ECONNREFUSED" || smtp?.command === "CONN") return { outcome: "retry", code };
  if (smtp?.responseCode && smtp.responseCode >= 400 && smtp.responseCode < 500) return { outcome: "retry", code: "SMTP_REJECTED" };
  if (smtp?.code === "EENVELOPE" || (smtp?.responseCode && smtp.responseCode >= 500)) return { outcome: "failed", code: "SMTP_REJECTED" };
  return { outcome: "uncertain", code };
}

export async function dispatchCustomerEmails() {
  if (process.env.CUSTOMER_EMAILS_ENABLED !== "true") return { enabled: false, claimed: 0, submitted: 0 };
  const config = supportMailConfig(); // Check configuration before leasing work.
  const service = emailServiceClient();
  const { error: reconcileError } = await service.rpc("reconcile_verified_registration_emails");
  if (reconcileError) throw new Error("CUSTOMER_EMAIL_DATABASE");
  const { data: jobs, error } = await service.rpc("claim_customer_email_jobs");
  if (error || !Array.isArray(jobs)) throw new Error("CUSTOMER_EMAIL_DATABASE");
  const summary = { enabled: true, claimed: jobs.length, submitted: 0, uncertain: 0, retrying: 0, failed: 0, unconfirmed: 0 };
  if (!jobs.length) return summary;
  const transport = createSupportMailTransport(config);
  try {
    await Promise.all(jobs.map(async (job) => {
      let outcome = "failed", errorCode: string | null = "INVALID_JOB";
      try {
        if (!customerEmailUuid.test(job.id) || !customerEmailUuid.test(job.lease_token)) throw new Error("INVALID_JOB");
        let html: string, text: string;
        if (job.kind === "registration") {
          const d = job.registration_details as RegistrationDetails;
          if (job.recipient_email !== MAILBOX || !d || !customerEmailUuid.test(d.user_id) || !d.verified_at) throw new Error("INVALID_JOB");
          html = registrationEmailHtml(d);
          text = `New Client Registration — CustodialSupport\n\nName: ${d.full_name}\nEmail: ${d.email}\nRegistered (UTC): ${new Date(d.registered_at).toISOString()}\nUser ID: ${d.user_id}\nVerification: Email verified\nVerified (UTC): ${new Date(d.verified_at).toISOString()}`;
        } else if (job.kind === "admin_email") {
          const draft = parseCustomerEmailDraft({ recipientName: job.recipient_name, recipientEmail: job.recipient_email, clientId: job.client_id, subject: job.subject, message: job.message });
          html = customerEmailHtml(draft);
          text = `Hello ${draft.recipientName || "there"},\n\n${draft.message}\n\nKind regards,\nThe CustodialSupport team\nsupport@custodialmanagement.net`;
        } else throw new Error("INVALID_JOB");
        try {
          const result = await transport.sendMail({ from: { name: "CustodialSupport", address: MAILBOX }, to: { name: job.recipient_name, address: job.recipient_email }, replyTo: MAILBOX, envelope: { from: MAILBOX, to: [job.recipient_email] }, subject: job.subject, text, html, messageId: `<customer-email-${job.id}@custodialmanagement.net>`, disableFileAccess: true, disableUrlAccess: true });
          outcome = result.accepted.some((address) => address.toLowerCase() === job.recipient_email.toLowerCase()) ? "submitted" : "failed";
          errorCode = outcome === "submitted" ? null : "SMTP_REJECTED";
        } catch (sendError) { const failure = customerEmailFailure(sendError); outcome = failure.outcome; errorCode = failure.code; }
      } catch { outcome = "failed"; errorCode = "INVALID_JOB"; }
      try {
        const { data: finished, error: finishError } = await service.rpc("finish_customer_email_job", { p_id: job.id, p_lease: job.lease_token, p_outcome: outcome, p_error: errorCode });
        if (finishError || !finished) summary.unconfirmed++;
        else if (outcome === "submitted") summary.submitted++;
        else if (outcome === "uncertain") summary.uncertain++;
        else if (outcome === "retry" && job.attempts < 6) summary.retrying++;
        else summary.failed++;
      } catch { summary.unconfirmed++; }
    }));
  } finally { transport.close(); }
  return summary;
}
