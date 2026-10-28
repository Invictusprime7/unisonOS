// A transport adapter, never a second author, renderer or canonical writer.
// Edge bundles cannot import sibling function directories, so this adapter
// forwards to ai-code-assistant internally and marks the request as
// page-generation-only via a header the assistant handler enforces.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FORWARDED_HEADERS = ["authorization", "apikey", "content-type", "x-client-info", "x-supabase-client-platform"];

serve(async (req: Request): Promise<Response> => {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) {
    return new Response(JSON.stringify({ error: "Backend URL is not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-unison-page-generation-only", "1");

  const response = await fetch(`${baseUrl}/functions/v1/ai-code-assistant`, {
    method: "POST",
    headers,
    body: await req.text(),
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
});
