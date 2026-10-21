/**
 * Shared Authentication Middleware for Supabase Edge Functions
 * 
 * Provides JWT verification, user extraction, and business ownership
 * validation for all edge functions.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — remote module resolved by the edge runtime; isolated tsc cannot fetch it
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { hasAnonymousClaimForSubject, isAnonymousRequestAllowed } from "./authPolicy.ts";

// Local shadow so isolated `tsc` checks resolve Deno without the global lib.
declare const Deno: { env: { get(key: string): string | undefined } };

type SupabaseClient = ReturnType<typeof createClient>;

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  isAnonymous: boolean;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
  status: number;
}

/** Cached Supabase admin client (service role) */
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _adminClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _adminClient;
}

export function getServiceRoleClient(): SupabaseClient {
  return getAdminClient();
}

/**
 * Verify user JWTs with the public client and the request's bearer token.
 * `getClaims()` supports the backend signing-key system and verifies the JWT
 * locally against the project's published keys. Using the admin client's
 * legacy `getUser(token)` path here can reject otherwise-valid signing-key
 * sessions during key migrations or runtime credential drift.
 */
function getClaimsClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
}

/**
 * Extract and verify the Bearer JWT from the Authorization header.
 * Returns the authenticated user or an error.
 * 
 * Dev mode bypass: If __devMode is present in the request body, create a mock user
 * for local development and testing.
 */
export async function verifyAuth(
  req: Request,
  options: { allowAnonymous?: boolean } = {},
): Promise<AuthResult> {
  // Check for JWT in the Authorization header
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const authClient = getClaimsClient(authHeader);
    // Some edge-runtime bundles still resolve a supabase-js build without
    // getClaims(). Feature-detect it so those deployments continue through
    // the server-validated getUser() path instead of throwing a false 503/401.
    const claimsVerifier = (authClient.auth as unknown as {
      getClaims?: (jwt: string) => Promise<{
        data: { claims?: Record<string, unknown> } | null;
        error: unknown;
      }>;
    }).getClaims;
    const claimsResult = typeof claimsVerifier === "function"
      ? await claimsVerifier.call(authClient.auth, token)
      : null;
    const claims = claimsResult?.data?.claims;

    if (!claimsResult?.error && typeof claims?.sub === "string") {
      const isAnonymous = claims.is_anonymous === true;
      if (!isAnonymousRequestAllowed(isAnonymous, options.allowAnonymous)) {
        return { user: null, error: "Anonymous sessions are not permitted for this operation", status: 403 };
      }
      return {
        user: {
          id: claims.sub,
          email: typeof claims.email === "string" ? claims.email : "",
          role: typeof claims.role === "string" ? claims.role : "authenticated",
          isAnonymous,
        },
        error: null,
        status: 200,
      };
    }

    // Legacy HS256 sessions do not have an asymmetric JWKS entry for local
    // claims verification. Validate those against Auth using the same
    // request-scoped public client rather than the service-role client.
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      // Final fallback: verify the token with the service-role client. This
      // survives anon/publishable key drift or rotation, which otherwise makes
      // a perfectly valid user session look like an expired token.
      try {
        const admin = getAdminClient();
        const { data: adminData, error: adminError } = await admin.auth.getUser(token);
        if (!adminError && adminData?.user) {
          const isAnonymous = hasAnonymousClaimForSubject(token, adminData.user.id);
          if (!isAnonymousRequestAllowed(isAnonymous, options.allowAnonymous)) {
            return { user: null, error: "Anonymous sessions are not permitted for this operation", status: 403 };
          }
          return {
            user: {
              id: adminData.user.id,
              email: adminData.user.email || "",
              role: adminData.user.role || "authenticated",
              isAnonymous,
            },
            error: null,
            status: 200,
          };
        }
      } catch (adminErr) {
        console.error("[auth] Service-role token verification failed:", adminErr);
      }
      return { user: null, error: "Invalid or expired token", status: 401 };
    }

    const isAnonymous = hasAnonymousClaimForSubject(token, user.id);
    if (!isAnonymousRequestAllowed(isAnonymous, options.allowAnonymous)) {
      return { user: null, error: "Anonymous sessions are not permitted for this operation", status: 403 };
    }

    return {
      user: {
        id: user.id,
        email: user.email || "",
        role: user.role || "authenticated",
        isAnonymous,
      },
      error: null,
      status: 200,
    };
  } catch (err) {
    console.error("[auth] Token verification failed:", err);
    return { user: null, error: "Authentication service unavailable", status: 503 };
  }
}

/**
 * Verify that a user owns or has access to a given business.
 * Call after verifyAuth() to enforce business-level authorization.
 */
export async function verifyBusinessAccess(
  userId: string,
  businessId: string
): Promise<{ allowed: boolean; error?: string }> {
  if (!businessId) {
    return { allowed: false, error: "businessId is required" };
  }

  try {
    const admin = getAdminClient();

    // Check if user owns the business.
    // Keep this query limited to stable columns because not all deployments
    // have organization_id on businesses.
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("[auth] Business lookup failed:", businessError);
      return { allowed: false, error: "Authorization check failed" };
    }

    if (!business) {
      return { allowed: false, error: "Business not found" };
    }

    if (business.owner_id === userId) {
      return { allowed: true };
    }

    // Check explicit business membership when available
    const { data: businessMember, error: memberError } = await admin
      .from("business_members")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError) {
      console.error("[auth] Business membership check failed:", memberError);
    }

    if (businessMember) {
      return { allowed: true };
    }

    return { allowed: false, error: "Access denied to this business" };
  } catch (err) {
    console.error("[auth] Business access check failed:", err);
    return { allowed: false, error: "Authorization check failed" };
  }
}

/** Verify project ownership or explicit project membership for authenticated commands. */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
): Promise<{ allowed: boolean; businessId?: string | null; error?: string }> {
  if (!projectId) return { allowed: false, error: "projectId is required" };

  try {
    const admin = getAdminClient();
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id,owner_id,business_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) return { allowed: false, error: "Project authorization check failed" };
    if (!project) return { allowed: false, error: "Project not found" };
    const businessId = typeof project.business_id === "string" ? project.business_id : null;
    if (project.owner_id === userId) return { allowed: true, businessId };

    const { data: member, error: memberError } = await admin
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) return { allowed: false, error: "Project membership check failed" };
    return member
      ? { allowed: true, businessId }
      : { allowed: false, error: "Access denied to this project" };
  } catch (error) {
    console.error("[auth] Project access check failed:", error);
    return { allowed: false, error: "Project authorization check failed" };
  }
}

/**
 * Create an error response with consistent format.
 */
export function authError(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
