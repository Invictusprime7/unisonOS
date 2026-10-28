// Lovable Cloud relay: lets the UNISON backend (which has no LOVABLE_API_KEY)
// use the managed AI gateway as its last-resort fallback. Callers must present
// the shared MANAGED_AI_RELAY_SECRET; the request body is forwarded unchanged
// to the gateway chat-completions endpoint and the response is streamed back.
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const expected = Deno.env.get("MANAGED_AI_RELAY_SECRET");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!expected || !apiKey) return json(503, { error: "Managed AI relay is not configured" });
  const presented = req.headers.get("x-managed-ai-relay-secret") ?? "";
  if (!safeEqual(presented, expected)) {
    console.warn("[managed-ai-relay] rejected unauthenticated request");
    return json(401, { error: "Unauthorized" });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (typeof body.model !== "string" || !Array.isArray(body.messages)) {
    return json(400, { error: "model and messages are required" });
  }
  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: raw,
    signal: req.signal,
  });
  if (!upstream.ok) console.warn(`[managed-ai-relay] gateway ${upstream.status}`);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      ...(upstream.headers.get("Retry-After") ? { "Retry-After": upstream.headers.get("Retry-After")! } : {}),
    },
  });
});
