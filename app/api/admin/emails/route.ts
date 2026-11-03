import { AdminEmailError, authorizeEmailAdmin, readEmailJson } from "@/lib/server/admin-email-auth";
import { customerEmailUuid, parseCustomerEmailDraft } from "@/lib/customer-email-content";
import { customerEmailHtml } from "@/lib/server/customer-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function failure(error: unknown) { return error instanceof AdminEmailError ? json({ error: error.message }, error.status) : json({ error: "Email management is unavailable. Check the approved migration and server configuration." }, 503); }

export async function GET(request: Request) {
  try {
    const { service } = await authorizeEmailAdmin(request);
    const url = new URL(request.url);
    const page = Math.min(10000, Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0));
    const view = url.searchParams.get("view");
    if (view === "clients") {
      const search = (url.searchParams.get("q") || "").trim().slice(0, 100).replace(/[%_\\]/g, "");
      let query = service.from("profiles").select("id,full_name", { count: "exact" }).eq("role", "client").order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 24);
      if (search) query = query.ilike("full_name", `%${search}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      const clients = await Promise.all((data || []).map(async (profile) => {
        const { data: auth, error: authError } = await service.auth.admin.getUserById(profile.id);
        if (authError) throw new Error("CLIENT_LOOKUP");
        return { id: profile.id, fullName: profile.full_name || "Client", email: auth.user?.email || "", verified: Boolean(auth.user?.email_confirmed_at) };
      }));
      return json({ clients, hasMore: (count || 0) > (page + 1) * 25 });
    }
    if (view === "templates") {
      const { data, error } = await service.from("customer_email_templates").select("id,name,subject,message,updated_at").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ templates: data });
    }
    const { data, error, count } = await service.from("customer_email_jobs").select("id,kind,recipient_name,recipient_email,subject,status,created_at,submitted_at,error_code,attempts", { count: "exact" }).order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 24);
    if (error) throw error;
    return json({ messages: data, hasMore: (count || 0) > (page + 1) * 25, sendingEnabled: process.env.CUSTOMER_EMAILS_ENABLED === "true" });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { actorId, service } = await authorizeEmailAdmin(request);
    const body = await readEmailJson(request);
    if (body.action === "save-template") {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 80 || /[\r\n\x00]/.test(body.name)) throw new AdminEmailError(400, "Enter a template name of 1–80 characters.");
      let draft;
      try { draft = parseCustomerEmailDraft({ ...body, recipientEmail: "template@example.invalid", recipientName: "", clientId: null }); } catch (error) { throw new AdminEmailError(400, (error as Error).message); }
      const { count, error: countError } = await service.from("customer_email_templates").select("id", { count: "exact", head: true });
      if (countError) throw countError;
      if ((count || 0) >= 100) throw new AdminEmailError(429, "The template library is full (100 templates).");
      const { data, error } = await service.from("customer_email_templates").insert({ name: body.name.trim(), subject: draft.subject, message: draft.message, created_by: actorId }).select("id").single();
      if (error) throw error;
      return json({ templateId: data.id }, 201);
    }
    if (body.action === "delete-template") {
      if (typeof body.id !== "string" || !customerEmailUuid.test(body.id)) throw new AdminEmailError(400, "Choose a valid template.");
      const { error } = await service.from("customer_email_templates").delete().eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (!["preview", "send"].includes(String(body.action))) throw new AdminEmailError(400, "Choose a valid email action.");
    let draft;
    try { draft = parseCustomerEmailDraft(body); } catch (error) { throw new AdminEmailError(400, (error as Error).message); }
    if (draft.clientId) {
      const { data: profile, error: profileError } = await service.from("profiles").select("full_name,role").eq("id", draft.clientId).maybeSingle();
      const { data: auth, error: authError } = await service.auth.admin.getUserById(draft.clientId);
      if (profileError || authError || profile?.role !== "client" || !auth.user?.email) throw new AdminEmailError(400, "The client account is unavailable.");
      // Resolve the address afresh; never trust the dropdown's cached address.
      if (draft.recipientEmail !== auth.user.email.toLowerCase()) throw new AdminEmailError(409, "The client email changed. Select the client again before sending.");
      draft.recipientEmail = auth.user.email.toLowerCase();
    }
    if (body.action === "preview") return json({ html: customerEmailHtml(draft), recipient: draft.recipientEmail, subject: draft.subject });
    if (process.env.CUSTOMER_EMAILS_ENABLED !== "true") throw new AdminEmailError(503, "Customer email sending is not enabled yet. Preview and templates remain available.");
    if (typeof body.requestId !== "string" || !customerEmailUuid.test(body.requestId)) throw new AdminEmailError(400, "A valid sending request ID is required.");
    const { data: id, error } = await service.rpc("enqueue_admin_customer_email", { p_actor: actorId, p_request_id: body.requestId, p_client_id: draft.clientId, p_name: draft.recipientName, p_email: draft.recipientEmail, p_subject: draft.subject, p_message: draft.message });
    if (error?.message?.includes("EMAIL_RATE_LIMIT")) throw new AdminEmailError(429, "Sending limit reached. Please wait before sending another email.");
    if (error?.code === "22023") throw new AdminEmailError(409, "This sending request was already used for different content. Review the draft again.");
    if (error) throw error;
    return json({ id, status: "queued" }, 202);
  } catch (error) { return failure(error); }
}
