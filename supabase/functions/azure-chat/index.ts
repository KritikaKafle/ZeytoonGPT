import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Attachment = { url: string; name: string; type: string; size: number };
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
};

function buildProviderMessages(msgs: ChatMessage[]) {
  return msgs.map(m => {
    const atts = m.attachments ?? [];
    if (!atts.length || m.role !== "user") {
      return { role: m.role, content: m.content };
    }
    const images = atts.filter(a => (a.type || "").startsWith("image/"));
    const docs = atts.filter(a => !(a.type || "").startsWith("image/"));
    const parts: Array<Record<string, unknown>> = [];
    let textContent = m.content || "";
    if (docs.length) {
      const list = docs.map(d => `- ${d.name} (${d.type || "file"}): ${d.url}`).join("\n");
      textContent = (textContent ? textContent + "\n\n" : "") +
        `The user attached the following document(s). You can reference them by filename:\n${list}`;
    }
    if (textContent) parts.push({ type: "text", text: textContent });
    for (const img of images) {
      parts.push({ type: "image_url", image_url: { url: img.url } });
    }
    return { role: m.role, content: parts.length ? parts : (m.content || "") };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token === anonKey) {
      return json({ error: "Not authenticated: no user session token provided" }, 401);
    }

    let userId = "";
    let userEmail = "";
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("invalid token format");
      const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson);
      userId = payload.sub ?? "";
      userEmail = payload.email ?? "";
      if (!userId) throw new Error("no sub claim");
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        throw new Error("token expired");
      }
    } catch (e) {
      return json({ error: `Not authenticated: ${e instanceof Error ? e.message : "invalid token"}` }, 401);
    }

    const { data: verifyUser, error: verifyErr } = await admin.auth.admin.getUserById(userId);
    if (verifyErr || !verifyUser?.user) {
      return json({ error: `Not authenticated: user lookup failed` }, 401);
    }
    const user = verifyUser.user;
    void userEmail;

    const body = await req.json();
    const { toolId, messages } = body as { toolId: string; messages: ChatMessage[] };
    if (!toolId || !Array.isArray(messages)) {
      return json({ error: "Invalid request body" }, 400);
    }

    const { data: tool } = await admin
      .from("ai_tools")
      .select("*")
      .eq("id", toolId)
      .maybeSingle();
    if (!tool || !tool.is_active) return json({ error: "Tool not available" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);

    if (profile.subscription_status !== "active") {
      return json({ error: "Subscription is not active" }, 403);
    }

    const { data: override } = await admin
      .from("user_tool_overrides")
      .select("*")
      .eq("user_id", user.id)
      .eq("tool_id", toolId)
      .maybeSingle();

    let limit = 0;
    if (override) {
      limit = override.monthly_token_limit;
    } else if (profile.subscription_plan_id) {
      const { data: planLimit } = await admin
        .from("plan_tool_limits")
        .select("*")
        .eq("plan_id", profile.subscription_plan_id)
        .eq("tool_id", toolId)
        .maybeSingle();
      limit = planLimit?.monthly_token_limit ?? 0;
    }

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const ps = periodStart.toISOString().slice(0, 10);

    const { data: usage } = await admin
      .from("token_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("tool_id", toolId)
      .eq("period_start", ps)
      .maybeSingle();
    const used = usage?.tokens_used ?? 0;

    if (limit === 0) {
      return json({ error: "This model is not included in your plan. Upgrade to get access." }, 403);
    }
    if (limit !== -1 && used >= limit) {
      return json({ error: `Monthly token limit reached for ${tool.display_name}. Upgrade or wait until next month.` }, 403);
    }

    let provider: any = null;
    if (tool.provider_id) {
      const { data: p } = await admin
        .from("api_providers")
        .select("*")
        .eq("id", tool.provider_id)
        .maybeSingle();
      provider = p;
    }

    const finalMessages: ChatMessage[] = [];
    if (tool.system_prompt && tool.system_prompt.trim().length > 0) {
      finalMessages.push({ role: "system", content: tool.system_prompt });
    }
    for (const m of messages) {
      if (m.role === "system" && finalMessages.some(f => f.role === "system")) continue;
      finalMessages.push(m);
    }

    const params = tool.model_params || {};
    const requestBody: Record<string, unknown> = {
      messages: buildProviderMessages(finalMessages),
      temperature: typeof params.temperature === "number" ? params.temperature : 0.7,
      max_tokens: typeof params.max_tokens === "number" ? params.max_tokens : 1500,
    };
    if (typeof params.top_p === "number") requestBody.top_p = params.top_p;
    if (typeof params.frequency_penalty === "number") requestBody.frequency_penalty = params.frequency_penalty;
    if (typeof params.presence_penalty === "number") requestBody.presence_penalty = params.presence_penalty;

    let assistantMessage = "";
    let tokensUsed = 0;

    const fallbackEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT");
    const fallbackKey = Deno.env.get("AZURE_OPENAI_API_KEY");
    const fallbackVersion = Deno.env.get("AZURE_OPENAI_API_VERSION") ?? "2024-02-15-preview";

    let url = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let modelInBody = false;

    if (provider && provider.is_active && provider.api_key && provider.base_url) {
      const base = provider.base_url.replace(/\/$/, "");
      const modelOrDeployment = tool.model_id || tool.azure_deployment_name;
      if (provider.provider_type === "azure-openai") {
        const apiVersion = provider.api_version || fallbackVersion;
        url = `${base}/openai/deployments/${modelOrDeployment}/chat/completions?api-version=${apiVersion}`;
        headers["api-key"] = provider.api_key;
      } else {
        url = `${base}/chat/completions`;
        headers["Authorization"] = `Bearer ${provider.api_key}`;
        requestBody.model = modelOrDeployment;
        modelInBody = true;
      }
    } else if (fallbackEndpoint && fallbackKey) {
      const base = fallbackEndpoint.replace(/\/$/, "");
      url = `${base}/openai/deployments/${tool.azure_deployment_name}/chat/completions?api-version=${fallbackVersion}`;
      headers["api-key"] = fallbackKey;
    }

    if (!url) {
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      assistantMessage =
        "No API provider is configured for '" + tool.display_name + "'. " +
        "An admin must assign a provider in the Admin panel. " +
        "You asked: \"" + (lastUser?.content ?? "") + "\"";
      tokensUsed = Math.min(200, Math.ceil(assistantMessage.length / 4));
    } else {
      let aiRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
      if (!aiRes.ok) {
        const text = await aiRes.text();
        const lower = text.toLowerCase();
        const needsMaxCompletion = lower.includes("max_completion_tokens");
        const tempUnsupported = lower.includes("'temperature'") && lower.includes("unsupported");
        if (needsMaxCompletion || tempUnsupported) {
          const retryBody: Record<string, unknown> = { ...requestBody };
          if (needsMaxCompletion && retryBody.max_tokens !== undefined) {
            retryBody.max_completion_tokens = retryBody.max_tokens;
            delete retryBody.max_tokens;
          }
          if (tempUnsupported) {
            delete retryBody.temperature;
            delete retryBody.top_p;
            delete retryBody.frequency_penalty;
            delete retryBody.presence_penalty;
          }
          aiRes = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(retryBody),
          });
          if (!aiRes.ok) {
            const t2 = await aiRes.text();
            return json({ error: `Provider API error: ${aiRes.status} ${t2.slice(0, 300)}` }, 502);
          }
        } else {
          return json({ error: `Provider API error: ${aiRes.status} ${text.slice(0, 300)}` }, 502);
        }
      }
      const aiData = await aiRes.json();
      assistantMessage = aiData.choices?.[0]?.message?.content ?? "";
      tokensUsed = aiData.usage?.total_tokens ?? Math.ceil(assistantMessage.length / 4);
      void modelInBody;
    }

    if (usage) {
      await admin
        .from("token_usage")
        .update({ tokens_used: used + tokensUsed })
        .eq("id", usage.id);
    } else {
      await admin.from("token_usage").insert({
        user_id: user.id,
        tool_id: toolId,
        tokens_used: tokensUsed,
        period_start: ps,
      });
    }

    return json({ message: assistantMessage, tokensUsed }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
