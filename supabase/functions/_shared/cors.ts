/**
 * Shared CORS Configuration for Edge Functions
 * 
 * Provides environment-aware CORS headers that restrict origins in production
 * while allowing development flexibility.
 */

// Local shadow so isolated `tsc` checks resolve Deno without the global lib.
declare const Deno: { env: { get(key: string): string | undefined } };

/** Trusted origins for production CORS */
const TRUSTED_ORIGINS: string[] = [
  "https://unisonos.ai",
  "https://www.unisonos.ai",
  "https://unisonos.vercel.app",
  "https://unison-tasks.vercel.app",
  "https://unison-tasks-official.vercel.app",
  "https://unison-tasks.netlify.app",
  "https://www.unisontasks.com",
  "https://unisontasks.com",
];

function isUnisonVercelDeployment(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === "https:" &&
      (
        (
          hostname.startsWith("unisonos-") &&
          hostname.endsWith("-unrealdev02s-projects.vercel.app")
        ) ||
        hostname.startsWith("unison-tasks-official-")
      ) &&
      hostname.endsWith(".vercel.app")
    );
  } catch {
    return false;
  }
}

/**
 * Lovable-hosted surfaces for this project: the in-editor preview, the
 * shareable preview and the published app. These are first-party origins the
 * builder itself runs from — without them every browser call from the preview
 * fails CORS preflight and surfaces as "Failed to send a request to the Edge
 * Function", which looks like a transport/timeout failure but never reaches
 * the handler.
 */
function isLovableHostedOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    return (
      hostname.endsWith(".lovableproject.com") ||
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovable.dev")
    );
  } catch {
    return false;
  }
}


/**
 * Build CORS headers based on the request origin.
 * - In production: only allows registered origins
 * - Falls back to ALLOWED_ORIGINS env var (comma-separated)
 * - Development: allows localhost origins
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  const allowedOrigins = envOrigins
    ? envOrigins.split(",").map((o) => o.trim())
    : TRUSTED_ORIGINS;

  // Allow localhost in development
  const isLocalDev =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");

  const allowedOrigin =
    allowedOrigins.includes(origin) ||
    isUnisonVercelDeployment(origin) ||
    isLovableHostedOrigin(origin) ||
    isLocalDev
      ? origin
      : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, x-supabase-api-version, apikey, content-type, x-request-id, x-dev-mode-user, x-session-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Legacy wildcard CORS headers for public-facing endpoints
 * (lead capture, booking forms, published sites).
 * Only use when the endpoint MUST accept cross-origin requests from any domain.
 */
export const publicCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-supabase-api-version, apikey, content-type, x-request-id, x-session-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Standard preflight response */
export function handleCorsPreflightRequest(
  req: Request,
  headers?: Record<string, string>
): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: headers ?? getCorsHeaders(req),
    });
  }
  return null;
}
