import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Local shadow so isolated `tsc` checks resolve Deno without the global lib.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { safeParseBody, sanitizeString, isNonEmptyString } from "../_shared/validate.ts";
import { verifyPublishAttestation } from "../_shared/publishAttestation.ts";

type PublishProvider = "netlify" | "vercel";

interface PublishRequestBody {
  provider?: PublishProvider;
  siteName?: string;
  customDomain?: string;
  files?: Record<string, string>;
  /**
   * Track 5 — server-proven publish contract. When supplied the edge function
   * re-verifies PublishGate verdict + file fingerprint server-side before
   * touching the deploy provider. When `PUBLISH_REQUIRE_ATTESTATION=true` is
   * set in env this field is REQUIRED and missing/invalid attestations are
   * rejected with HTTP 412.
   */
  publishAttestation?: unknown;
}

type PublishResponse = Record<string, unknown> & {
  status: "success" | "error";
  url?: string;
  dashboardUrl?: string;
  provider: string;
  note?: string;
  error?: string;
  isLocalDevelopment?: boolean;
  attestation?: {
    enforced: boolean;
    evaluatedAt?: string;
    publishGateOk?: boolean;
    fingerprint?: string;
  };
};

const MAX_FILE_COUNT = 250;
const MAX_FILE_SIZE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 5_000_000;
const SAFE_PATH_PATTERN = /^(?!\/)(?!.*\.\.)(?!.*\\)[A-Za-z0-9._/-]+$/;
const SAFE_DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const REQUIRE_ATTESTATION = (Deno.env.get("PUBLISH_REQUIRE_ATTESTATION") || "").toLowerCase() === "true";
const UNISON_ATTRIBUTION_ASSET = "unison-powered-by-unison.js";
const UNISON_ATTRIBUTION_MARKER = "Powered by Unison";
const UNISON_ATTRIBUTION_SCRIPT = `(() => {
  if (document.getElementById('unison-powered-by')) return;
  const link = document.createElement('a');
  link.id = 'unison-powered-by';
  link.href = 'https://unisontasks.com';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '${UNISON_ATTRIBUTION_MARKER}';
  link.setAttribute('aria-label', '${UNISON_ATTRIBUTION_MARKER}');
  link.style.cssText = 'display:block;padding:14px 16px;text-align:center;font:500 12px/1.4 system-ui,sans-serif;color:#64748b;background:#f8fafc;text-decoration:none;';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(link), { once: true });
})();
`;

function sanitizeLogPreview(input: string) {
  return input.replace(/[\r\n\t]/g, " ").slice(0, 200);
}

async function netlifyApi(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Netlify API ${path} failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

function sanitizeSiteName(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `site-${crypto.randomUUID().slice(0, 8)}`;
}

async function generateSha1Hash(input: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  const view = new Uint8Array(hash);
  return Array.from(view).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateFiles(files: Record<string, string>): string | null {
  const entries = Object.entries(files);
  if (entries.length === 0) {
    return "No files provided";
  }
  if (entries.length > MAX_FILE_COUNT) {
    return `Too many files; limit is ${MAX_FILE_COUNT}`;
  }

  let totalBytes = 0;
  for (const [rawPath, content] of entries) {
    const path = rawPath.replace(/^\/+/, "");
    if (!path || !SAFE_PATH_PATTERN.test(path)) {
      return `Invalid file path: ${rawPath}`;
    }
    if (!isNonEmptyString(content) && content !== "") {
      return `Invalid file contents for ${rawPath}`;
    }

    const size = new TextEncoder().encode(content).length;
    if (size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds size limit: ${rawPath}`;
    }

    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return `Deployment exceeds total size limit of ${MAX_TOTAL_BYTES} bytes`;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(files, "index.html")) {
    return "index.html is required";
  }

  return null;
}

function withPoweredByUnisonAttribution(files: Record<string, string>): Record<string, string> {
  const indexHtml = files["index.html"] || "";
  const nextIndex = indexHtml.includes(UNISON_ATTRIBUTION_ASSET) || indexHtml.includes(UNISON_ATTRIBUTION_MARKER)
    ? indexHtml
    : /<\/body>/i.test(indexHtml)
      ? indexHtml.replace(/<\/body>/i, `<script defer src="/${UNISON_ATTRIBUTION_ASSET}"></script></body>`)
      : `${indexHtml}\n<script defer src="/${UNISON_ATTRIBUTION_ASSET}"></script>\n`;
  return {
    ...files,
    "index.html": nextIndex,
    [UNISON_ATTRIBUTION_ASSET]: UNISON_ATTRIBUTION_SCRIPT,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const auth = await verifyAuth(req);
  if (!auth.user) {
    return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
  }

  try {
    const { data: body, error: parseError } = await safeParseBody<PublishRequestBody>(req, MAX_TOTAL_BYTES + 100_000);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const provider = body.provider;
    const rawSiteName = sanitizeString(body.siteName || "my-site", 80);
    const siteName = sanitizeSiteName(rawSiteName);
    const customDomain = sanitizeString(body.customDomain || "", 255).toLowerCase();
    const files = withPoweredByUnisonAttribution(body.files || {});

    if (provider !== "netlify" && provider !== "vercel") {
      return errorResponse("Unsupported provider", 400, corsHeaders);
    }

    if (customDomain && !SAFE_DOMAIN_PATTERN.test(customDomain)) {
      return errorResponse("Invalid customDomain", 400, corsHeaders);
    }

    const fileError = validateFiles(files);
    if (fileError) {
      return errorResponse(fileError, 400, corsHeaders);
    }

    // Track 5 — server-proven publish contract.
    let attestationMeta: PublishResponse["attestation"] = { enforced: false };
    if (body.publishAttestation !== undefined && body.publishAttestation !== null) {
      const verdict = await verifyPublishAttestation(body.publishAttestation, files);
      if (verdict.ok !== true) {
        const failure = verdict as { code: string; message: string; details?: unknown };
        console.warn(
          "[publish-site] attestation rejected user=%s code=%s message=%s",
          auth.user.id,
          failure.code,
          failure.message,
        );
        return errorResponse(failure.message, 412, corsHeaders, {
          status: "error",
          provider: provider ?? "unknown",
          attestation: { enforced: true, code: failure.code, details: failure.details },
        });
      }
      attestationMeta = {
        enforced: true,
        evaluatedAt: verdict.attestation.evaluatedAt,
        publishGateOk: verdict.attestation.gates.publish.ok,
        fingerprint: verdict.attestation.filesFingerprint,
      };
      console.log(
        "[publish-site] attestation verified user=%s fingerprint=%s evaluatedAt=%s",
        auth.user.id,
        verdict.attestation.filesFingerprint,
        verdict.attestation.evaluatedAt,
      );
    } else if (REQUIRE_ATTESTATION) {
      return errorResponse(
        "Publish attestation is required but was not supplied.",
        412,
        corsHeaders,
        { status: "error", provider: provider ?? "unknown", attestation: { enforced: true, code: "attestation-required" } },
      );
    }

    const NETLIFY_AUTH_TOKEN = Deno.env.get("NETLIFY_AUTH_TOKEN");
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    const vercelTeamId = Deno.env.get("VERCEL_TEAM_ID")?.trim();
    const vercelScope = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : "";
    const indexHtmlPreview = files["index.html"] ? sanitizeLogPreview(files["index.html"]) : "no index.html";
    console.log(
      "[publish-site] user=%s provider=%s siteName=%s customDomain=%s indexPreview=%s attestation=%s",
      auth.user.id,
      provider,
      siteName,
      customDomain || "n/a",
      indexHtmlPreview,
      attestationMeta.enforced ? "verified" : "absent",
    );

    if (!NETLIFY_AUTH_TOKEN && !VERCEL_TOKEN) {
      return secureJsonResponse(
        {
          status: "success",
          provider,
          url: `https://preview.local/${siteName}`,
          dashboardUrl: "https://example.com/dashboard",
          note: "Mock publish successful (local dev). Configure NETLIFY_AUTH_TOKEN or VERCEL_TOKEN in Supabase to enable real deployments.",
          isLocalDevelopment: true,
          attestation: attestationMeta,
        } as PublishResponse,
        200,
        corsHeaders,
      );
    }

    if (provider === "netlify") {
      if (!NETLIFY_AUTH_TOKEN) {
        return errorResponse("Missing NETLIFY_AUTH_TOKEN in environment", 400, corsHeaders, { provider });
      }

      const headers = {
        Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      } as const;

      // Track 1 — provider liveness preflight. Refuse to start a deploy if
      // the provider's auth/identity endpoint is unreachable or rejecting our
      // token. Prevents half-written deploys on outages or revoked tokens.
      try {
        const liveness = await fetch("https://api.netlify.com/api/v1/user", {
          method: "GET",
          headers: { Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}` },
        });
        if (!liveness.ok) {
          return errorResponse(
            `Netlify liveness check failed (HTTP ${liveness.status}). Refusing to deploy.`,
            502,
            corsHeaders,
            { provider, liveness: { ok: false, status: liveness.status } },
          );
        }
      } catch (err) {
        return errorResponse(
          `Netlify unreachable: ${err instanceof Error ? err.message : "unknown"}`,
          502,
          corsHeaders,
          { provider, liveness: { ok: false } },
        );
      }

      let siteId: string | null = Deno.env.get("NETLIFY_SITE_ID") || null;
      let siteAdminUrl: string | null = null;
      let siteUrl: string | null = null;

      if (!siteId) {
        let finalName = siteName;
        let created: { id: string; admin_url?: string; ssl_url?: string; url?: string } | null = null;
        for (let i = 0; i < 2; i++) {
          try {
            created = await netlifyApi("/sites", NETLIFY_AUTH_TOKEN, {
              method: "POST",
              headers,
              body: JSON.stringify({ name: finalName }),
            }) as { id: string; admin_url?: string; ssl_url?: string; url?: string };
            break;
          } catch (error) {
            if (i === 0) {
              finalName = `${siteName}-${crypto.randomUUID().slice(0, 4)}`;
              continue;
            }
            throw error;
          }
        }

        siteId = created!.id;
        siteAdminUrl = created!.admin_url || null;
        siteUrl = created!.ssl_url || created!.url || null;
      } else {
        const site = await netlifyApi(`/sites/${siteId}`, NETLIFY_AUTH_TOKEN) as { admin_url?: string; ssl_url?: string; url?: string };
        siteAdminUrl = site.admin_url || null;
        siteUrl = site.ssl_url || site.url || null;
      }

      const fileShaMap: Record<string, string> = {};
      for (const [path, content] of Object.entries(files)) {
        const normalizedPath = path.replace(/^\/+/, "");
        fileShaMap[normalizedPath] = await generateSha1Hash(content);
      }

      const deployInit = await netlifyApi(`/sites/${siteId}/deploys`, NETLIFY_AUTH_TOKEN, {
        method: "POST",
        headers,
        body: JSON.stringify({ files: fileShaMap, draft: false }),
      }) as { id: string; required?: string[] };

      const deployId = deployInit.id;
      const required = Array.isArray(deployInit.required) ? deployInit.required : [];
      const encoder = new TextEncoder();

      for (const requiredPath of required) {
        const normalizedPath = requiredPath.replace(/^\/+/, "");
        const content = files[normalizedPath];
        if (typeof content !== "string") {
          continue;
        }
        const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deployId}/files/${encodeURIComponent(normalizedPath)}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
            "Content-Type": "application/octet-stream",
          },
          body: encoder.encode(content),
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text().catch(() => "");
          throw new Error(`Upload failed for ${normalizedPath}: ${uploadRes.status} ${text}`);
        }
      }

      let deployUrl: string | null = null;
      let state = "new";
      const start = Date.now();
      while (Date.now() - start < 20_000) {
        const deploy = await netlifyApi(`/deploys/${deployId}`, NETLIFY_AUTH_TOKEN) as {
          state: string;
          deploy_ssl_url?: string;
          deploy_url?: string;
        };
        state = deploy.state;
        deployUrl = deploy.deploy_ssl_url || deploy.deploy_url || null;
        if (state === "ready") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }

      return secureJsonResponse(
        {
          status: "success",
          provider: "netlify",
          url: deployUrl || siteUrl || undefined,
          dashboardUrl: siteAdminUrl || "https://app.netlify.com/sites",
          note: state === "ready" ? "Deploy is ready" : "Deploy created, still processing",
          attestation: attestationMeta,
        } as PublishResponse,
        200,
        corsHeaders,
      );
    }

    if (!VERCEL_TOKEN) {
      return errorResponse("Missing VERCEL_TOKEN in environment", 400, corsHeaders, { provider });
    }

    // Track 1 — provider liveness preflight for Vercel.
    try {
      const liveness = await fetch(`https://api.vercel.com/v6/deployments${vercelScope}${vercelScope ? "&" : "?"}limit=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      if (!liveness.ok) {
        return errorResponse(
          `Vercel liveness check failed (HTTP ${liveness.status}). Refusing to deploy.`,
          502,
          corsHeaders,
          { provider, liveness: { ok: false, status: liveness.status } },
        );
      }
    } catch (err) {
      return errorResponse(
        `Vercel unreachable: ${err instanceof Error ? err.message : "unknown"}`,
        502,
        corsHeaders,
        { provider, liveness: { ok: false } },
      );
    }


    const filesPayload = Object.entries(files).map(([path, content]) => ({
      file: path.replace(/^\/+/, ""),
      data: btoa(unescape(encodeURIComponent(content))),
    }));

    const vercelRes = await fetch(`https://api.vercel.com/v13/deployments${vercelScope}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: siteName,
        files: filesPayload,
        projectSettings: {
          framework: null,
        },
      }),
    });

    if (!vercelRes.ok) {
      const text = await vercelRes.text().catch(() => "");
      return errorResponse(`Vercel deploy failed: ${vercelRes.status} ${text}`, 500, corsHeaders, { provider: "vercel" });
    }

    const deployData = await vercelRes.json() as { url?: string };
    return secureJsonResponse(
      {
        status: "success",
        provider: "vercel",
        url: deployData.url ? `https://${deployData.url}` : undefined,
        dashboardUrl: "https://vercel.com/dashboard",
        note: "Vercel deployment created",
        attestation: attestationMeta,
      } as PublishResponse,
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error("[publish-site] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500, corsHeaders, {
      status: "error",
      provider: "unknown",
    });
  }
});
