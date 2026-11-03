import { ContactEmailError, parseContactRequest, sendContactEmail } from "@/lib/server/contact-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 16384;

function json(body: object, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function boundedJson(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    throw new RangeError("Body limit");
  }
  if (!request.body) throw new ContactEmailError("INVALID");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError("Body limit"); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally { reader.releaseLock(); }
  return JSON.parse(raw) as unknown;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin
        || request.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "Please submit the form from this website." }, 403);
    }
  } catch { return json({ error: "Please submit the form from this website." }, 403); }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "This form requires a JSON request." }, 415);
  }

  let fields;
  try { fields = parseContactRequest(await boundedJson(request)); }
  catch (error) {
    return error instanceof RangeError
      ? json({ error: "Your message is too long. Please shorten it and try again." }, 413)
      : json({ error: "Check the form details and try again." }, 400);
  }

  try {
    await sendContactEmail(fields, request.headers);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ContactEmailError && error.code === "RATE_LIMITED") {
      return json({ error: "Too many contact requests. Please wait before trying again." }, 429,
        { "Retry-After": String(error.retryAfter) });
    }
    return json({ error: "We couldn't send your message right now. Please try again later or email support@custodialmanagement.net." }, 503);
  }
}
