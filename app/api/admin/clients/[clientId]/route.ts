import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ clientId: string }> };
type AdminContext = {
  service: SupabaseClient;
  userScoped: SupabaseClient;
};

const clientIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authorizeAdmin(
  request: Request
): Promise<
  | { context: AdminContext; response?: never }
  | { context?: never; response: Response }
> {
  if (!isSameOrigin(request)) {
    return { response: jsonError("Request origin is not allowed.", 403) };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return { response: jsonError("Sign in as an administrator first.", 401) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return {
      response: jsonError(
        "Server Supabase credentials are missing. Configure SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) on the server, then restart the app.",
        500
      ),
    };
  }

  // Verify the caller's identity and admin role using their own session and RLS.
  const verifier = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await verifier.auth.getUser(accessToken);

  if (authError || !user) {
    return { response: jsonError("Your admin session is invalid or expired.", 401) };
  }

  const { data: adminProfile, error: profileError } = await verifier
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      `[admin clients API] Admin profile lookup failed: code=${profileError.code}; message=${profileError.message}; details=${profileError.details}; hint=${profileError.hint}`
    );
    return {
      response: jsonError("Could not verify administrator access.", 500),
    };
  }

  if (adminProfile?.role !== "admin") {
    return { response: jsonError("Administrator access is required.", 403) };
  }

  // This privileged client is used only after the caller's admin role is verified.
  const service = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return { context: { service, userScoped: verifier } };
}

async function findClientProfile(service: SupabaseClient, clientId: string) {
  if (!clientIdPattern.test(clientId)) return { profile: null, error: null };

  const { data, error } = await service
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .eq("id", clientId)
    .eq("role", "client")
    .maybeSingle();

  return { profile: data, error };
}

export async function GET(request: Request, { params }: RouteContext) {
  const { context, response } = await authorizeAdmin(request);
  if (response) return response;

  const { clientId } = await params;
  // The admin list already reads client profiles through this user-scoped
  // client. Reuse it here so the same profile RLS policy applies.
  const { profile, error: profileError } = await findClientProfile(
    context.userScoped,
    clientId
  );

  if (profileError) {
    console.error(
      `[admin clients API] Client profile lookup failed: code=${profileError.code}; message=${profileError.message}; details=${profileError.details}; hint=${profileError.hint}`
    );
    return jsonError("Could not load the client profile.", 500);
  }
  if (!profile) return jsonError("Client profile was not found.", 404);

  const { data, error: userError } =
    await context.service.auth.admin.getUserById(clientId);

  if (userError || !data.user) {
    console.error(
      `[admin clients API] Client Auth lookup failed: ${userError?.message ?? "Auth user was not returned."} (status ${userError?.status ?? "unknown"})`
    );
    return jsonError("Could not load this client's registration details.", 500);
  }

  const authUser = data.user;

  return Response.json(
    {
      id: profile.id,
      fullName: profile.full_name ?? "",
      email: authUser.email ?? "",
      role: profile.role,
      registeredAt: authUser.created_at ?? profile.created_at ?? null,
      emailConfirmedAt: authUser.email_confirmed_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      profileUpdatedAt: profile.updated_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
