import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "npm:imagescript@1.2.17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ImageOptions = {
  size?: string;
  quality?: string;
  output_format?: "png" | "jpeg" | "webp";
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function applyWatermark(imageBytes: Uint8Array, logoUrl: string): Promise<Uint8Array> {
  try {
    const base = await Image.decode(imageBytes);
    const logoRes = await fetch(logoUrl);
    if (!logoRes.ok) return imageBytes;
    const logoBuf = new Uint8Array(await logoRes.arrayBuffer());
    const logo = await Image.decode(logoBuf);
    const targetW = Math.floor(base.width * 0.12);
    const scale = targetW / logo.width;
    const targetH = Math.floor(logo.height * scale);
    logo.resize(targetW, targetH);
    const margin = Math.floor(base.width * 0.02);
    const x = base.width - logo.width - margin;
    const y = base.height - logo.height - margin;
    base.composite(logo, x, y);
    const encoded = await base.encode();
    return encoded;
  } catch {
    return imageBytes;
  }
}

function costForSize(size: string | undefined): number {
  if (!size) return 1000;
  const map: Record<string, number> = {
    "1024x1024": 1000,
    "1792x1024": 1500,
    "1024x1792": 1500,
    "1536x1024": 1500,
    "1024x1536": 1500,
    "2048x2048": 2500,
  };
  return map[size] ?? 1000;
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
      return json({ error: "Not authenticated" }, 401);
    }

    let userId = "";
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("invalid token");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      userId = payload.sub ?? "";
      if (!userId) throw new Error("no sub");
      if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("expired");
    } catch (e) {
      return json({ error: `Not authenticated: ${e instanceof Error ? e.message : "invalid"}` }, 401);
    }

    const { data: verifyUser } = await admin.auth.admin.getUserById(userId);
    if (!verifyUser?.user) return json({ error: "Not authenticated" }, 401);
    const user = verifyUser.user;

    const body = await req.json();
    const { toolId, prompt, options } = body as {
      toolId: string;
      prompt: string;
      options?: ImageOptions;
    };
    if (!toolId || !prompt || !prompt.trim()) {
      return json({ error: "Missing toolId or prompt" }, 400);
    }

    const { data: tool } = await admin
      .from("ai_tools")
      .select("*")
      .eq("id", toolId)
      .maybeSingle();
    if (!tool || !tool.is_active) return json({ error: "Tool not available" }, 400);
    if (tool.model_kind !== "image") {
      return json({ error: "This tool is not an image model" }, 400);
    }

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
    let plan: any = null;
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
    if (profile.subscription_plan_id) {
      const { data: p } = await admin
        .from("subscription_plans")
        .select("*")
        .eq("id", profile.subscription_plan_id)
        .maybeSingle();
      plan = p;
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
    const cost = costForSize(options?.size);
    if (limit !== -1 && used + cost > limit) {
      return json({ error: `Monthly image quota reached for ${tool.display_name}.` }, 403);
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
    if (!provider || !provider.is_active || !provider.api_key || !provider.base_url) {
      return json({ error: "No active provider configured for this image model." }, 400);
    }

    const params = tool.model_params || {};
    const size = options?.size || params.size || "1024x1024";
    const quality = options?.quality || params.quality || "standard";
    const outputFormat = (options?.output_format || params.output_format || "png") as "png" | "jpeg" | "webp";

    const deployment = tool.azure_deployment_name || tool.model_id;
    const base = provider.base_url.replace(/\/$/, "");
    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const requestBody: Record<string, unknown> = {
      prompt,
      size,
      quality,
      n: 1,
    };

    if (provider.provider_type === "azure-openai") {
      const apiVersion = provider.api_version || "2024-02-15-preview";
      url = `${base}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
      if (provider.auth_scheme === "bearer") {
        headers["Authorization"] = `Bearer ${provider.api_key}`;
      } else {
        headers["api-key"] = provider.api_key;
      }
      requestBody.output_format = outputFormat;
    } else {
      url = `${base}/images/generations`;
      headers["Authorization"] = `Bearer ${provider.api_key}`;
      requestBody.model = deployment;
      requestBody.response_format = "b64_json";
    }

    const aiRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return json({ error: `Provider API error: ${aiRes.status} ${text.slice(0, 400)}` }, 502);
    }
    const aiData = await aiRes.json();
    const b64 = aiData?.data?.[0]?.b64_json;
    const directUrl = aiData?.data?.[0]?.url;
    let imageBytes: Uint8Array;
    if (b64) {
      imageBytes = b64ToBytes(b64);
    } else if (directUrl) {
      const r = await fetch(directUrl);
      imageBytes = new Uint8Array(await r.arrayBuffer());
    } else {
      return json({ error: "No image data returned by provider" }, 502);
    }

    const userOverride = profile.watermark_disabled;
    const planDisabled = plan?.watermark_disabled === true;
    const watermarkDisabled =
      userOverride === true ? true : userOverride === false ? false : planDisabled;

    if (!watermarkDisabled) {
      const { data: setting } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "watermark_logo_url")
        .maybeSingle();
      const logoUrl = setting?.value?.trim();
      if (logoUrl) {
        imageBytes = await applyWatermark(imageBytes, logoUrl);
      }
    }

    const ext = outputFormat === "jpeg" ? "jpg" : outputFormat;
    const contentType =
      outputFormat === "jpeg" ? "image/jpeg" :
      outputFormat === "webp" ? "image/webp" : "image/png";
    const path = `${user.id}/generated/image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await admin.storage
      .from("chat-attachments")
      .upload(path, imageBytes, { contentType, upsert: false });
    if (upErr) {
      return json({ error: `Upload failed: ${upErr.message}` }, 500);
    }
    const { data: pub } = admin.storage.from("chat-attachments").getPublicUrl(path);

    if (usage) {
      await admin.from("token_usage").update({ tokens_used: used + cost }).eq("id", usage.id);
    } else {
      await admin.from("token_usage").insert({
        user_id: user.id,
        tool_id: toolId,
        tokens_used: cost,
        period_start: ps,
      });
    }

    return json({
      attachment: {
        url: pub.publicUrl,
        name: `image-${Date.now()}.${ext}`,
        type: contentType,
        size: imageBytes.byteLength,
      },
      tokensUsed: cost,
    }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
