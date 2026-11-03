import { timingSafeEqual } from "node:crypto";
import { dispatchCustomerEmails } from "@/lib/server/customer-email";

import {
  createSupportEmailUserClient,
  dispatchSupportEmails,
  SupportEmailError,
  supportEmailTicketIdPattern,
} from "@/lib/server/support-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function accessToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1] ?? null;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function dispatchError(error: unknown) {
  if (error instanceof SupportEmailError && error.code === "NOT_CONFIGURED") {
    return json({ error: "Email alerts are not configured. Your ticket or reply remains saved." }, 503);
  }
  return json({ error: "Email delivery is temporarily unavailable. Your ticket or reply remains saved." }, 503);
}

// Recovery endpoint: scheduler only; never send CRON_SECRET from browser code.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return json({ error: "Scheduled email delivery is not configured." }, 503);
  const token = accessToken(request);
  if (!token || Buffer.byteLength(token) !== Buffer.byteLength(secret)
    || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    // Keep the established ticket worker independent from the new queue.
    const [support, customer] = await Promise.allSettled([dispatchSupportEmails(), dispatchCustomerEmails()]);
    if (support.status === "rejected") return dispatchError(support.reason);
    return json({ ...support.value, customerEmails: customer.status === "fulfilled" ? customer.value : { error: "CUSTOMER_EMAIL_WORKER_UNAVAILABLE" } });
  } catch (error) {
    return dispatchError(error);
  }
}

// Best-effort wakeup after a successful client insert. It cannot enqueue events.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  const token = accessToken(request);
  if (!token) return json({ error: "Sign in first." }, 401);

  // Only a UUID is accepted; recipients, mail headers and content are never inputs.
  let ticketId: string;
  try {
    if (Number(request.headers.get("content-length") ?? "0") > 1024) return json({ error: "Invalid request." }, 400);
    const raw = await request.text();
    if (raw.length > 1024) return json({ error: "Invalid request." }, 400);
    const body: unknown = JSON.parse(raw);
    if (typeof body !== "object" || body === null || !("ticketId" in body)
      || typeof body.ticketId !== "string" || !supportEmailTicketIdPattern.test(body.ticketId)) {
      return json({ error: "A valid ticket ID is required." }, 400);
    }
    ticketId = body.ticketId;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  try {
    const verifier = createSupportEmailUserClient(token);
    const { data: { user }, error: authError } = await verifier.auth.getUser(token);
    if (authError || !user) return json({ error: "Your session is invalid or expired." }, 401);

    const { data: ticket, error: ticketError } = await verifier
      .from("support_tickets")
      .select("id")
      .eq("id", ticketId)
      .eq("client_id", user.id)
      .maybeSingle();
    if (ticketError || !ticket) return json({ error: "Ticket access is not allowed." }, 403);

    return json(await dispatchSupportEmails({ clientId: user.id, ticketId }));
  } catch (error) {
    return dispatchError(error);
  }
}
