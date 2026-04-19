import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ToolOverride = { tool_id: string; monthly_token_limit: number };

type Payload = {
  email: string;
  password: string;
  full_name?: string;
  role?: "user" | "admin";
  subscription_plan_id?: string | null;
  tool_overrides?: ToolOverride[];
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile } = await authedClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Admin privileges required" }, 403);
    }

    const body = (await req.json()) as Payload;
    if (!body.email || !body.password) {
      return json({ error: "Email and password are required" }, 400);
    }
    if (body.password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name || "" },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || "Failed to create user" }, 400);
    }

    const newUserId = created.user.id;

    let planId = body.subscription_plan_id ?? null;
    if (!planId) {
      const { data: freePlan } = await admin
        .from("subscription_plans")
        .select("id")
        .eq("name", "Free")
        .maybeSingle();
      planId = freePlan?.id ?? null;
    }

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: newUserId,
      email: body.email,
      full_name: body.full_name || "",
      role: body.role === "admin" ? "admin" : "user",
      subscription_plan_id: planId,
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: profileErr.message }, 400);
    }

    if (Array.isArray(body.tool_overrides) && body.tool_overrides.length > 0) {
      const rows = body.tool_overrides
        .filter(o => o && o.tool_id)
        .map(o => ({
          user_id: newUserId,
          tool_id: o.tool_id,
          monthly_token_limit: Number.isFinite(o.monthly_token_limit) ? o.monthly_token_limit : 0,
        }));
      if (rows.length > 0) {
        const { error: ovErr } = await admin.from("user_tool_overrides").insert(rows);
        if (ovErr) return json({ error: `User created, but overrides failed: ${ovErr.message}` }, 200);
      }
    }

    return json({ success: true, user_id: newUserId }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
