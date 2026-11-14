/**
 * Site-Auth Edge Function
 * 
 * Handles per-site/template user authentication.
 * This allows the same email to be registered on multiple sites without conflicts.
 * 
 * Actions:
 * - register: Create a new user for a specific site
 * - login: Authenticate a user for a specific site
 * - verify-session: Validate a site session token
 * - get-user: Get user details by session token
 * - logout: Invalidate session (client-side only)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { SignJWT, jwtVerify } from "https://deno.land/x/jose@v5.2.0/index.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidEmail, isValidUUID } from "../_shared/validate.ts";

interface SiteAuthPayload {
  action: "register" | "login" | "logout" | "get-user" | "verify-session";
  siteId: string;
  email?: string;
  password?: string;
  name?: string;
  sessionToken?: string;
  metadata?: Record<string, unknown>;
}

interface SiteUser {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SiteSession {
  token: string;
  expiresAt: number;
  siteId: string;
  userId: string;
}

// JWT secret for signing site session tokens — REQUIRED, no hardcoded fallback
const JWT_SECRET_RAW = Deno.env.get("SITE_AUTH_JWT_SECRET") || Deno.env.get("JWT_SECRET");
if (!JWT_SECRET_RAW) {
  console.error("[site-auth] FATAL: SITE_AUTH_JWT_SECRET or JWT_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || "");

// One reply for every failed sign-up, so it never reveals existing accounts.
const REGISTER_FAILED_MESSAGE = "We couldn't create an account with these details. Try signing in instead.";

// Session duration: 24 hours (reduced from 7 days for security)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  // Reject if JWT secret is not configured
  if (!JWT_SECRET_RAW) {
    return errorResponse("Authentication service not configured", 503, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: payload, error: parseError } = await safeParseBody<SiteAuthPayload>(req);
    if (parseError || !payload) {
      return errorResponse(parseError || "Invalid request body", 400, corsHeaders);
    }

    const {
      action,
      siteId,
      email,
      password,
      name,
      sessionToken,
      metadata,
    } = payload;

    // Validate siteId for all actions
    const normalizedSiteId = typeof siteId === "string" ? sanitizeString(siteId, 200) : "";
    if (!normalizedSiteId) {
      return errorResponse("siteId is required", 400, corsHeaders);
    }
    if (!isValidUUID(normalizedSiteId)) {
      return errorResponse("Invalid siteId format", 400, corsHeaders);
    }

    const allowedActions = new Set<SiteAuthPayload["action"]>([
      "register",
      "login",
      "logout",
      "get-user",
      "verify-session",
    ]);

    if (!action || !allowedActions.has(action)) {
      return errorResponse("Invalid action", 400, corsHeaders);
    }

    console.log(`[site-auth] Action: ${action}, siteId: ${normalizedSiteId}`);

    switch (action) {
      // ====================================================================
      // REGISTER - Create new site user
      // ====================================================================
      case "register": {
        if (!email || !password) {
          return errorResponse("Email and password are required", 400, corsHeaders);
        }

        const normalizedEmail = sanitizeString(email.toLowerCase(), 320);
        if (!isValidEmail(normalizedEmail)) {
          return errorResponse("Invalid email format", 400, corsHeaders);
        }

        // Validate password strength (min 8 chars, at least one letter and one number)
        if (!password || password.length < 8) {
          return errorResponse("Password must be at least 8 characters", 400, corsHeaders);
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
          return errorResponse("Password must contain at least one letter and one number", 400, corsHeaders);
        }

        // The visitor must never choose a tenant. Resolve the business from
        // the canonical generated-site record, not from request data.
        const { data: site, error: siteError } = await supabase
          .from("sites")
          .select("id,business_id,status")
          .eq("id", normalizedSiteId)
          .maybeSingle();
        if (siteError || !site || !["preview", "published"].includes(site.status)) {
          return errorResponse("Site authentication is unavailable", 404, corsHeaders);
        }

        // Registration never reveals whether an email already has an account.
        // An existing account is signed in only when the caller proves its
        // password; otherwise the reply matches any other failed sign-up.
        const { data: existingUser } = await supabase
          .from("site_users")
          .select("id, email, name, metadata, password_hash, created_at")
          .eq("site_id", normalizedSiteId)
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (existingUser) {
          const passwordValid = await bcrypt.compare(password, existingUser.password_hash);
          if (!passwordValid) {
            return errorResponse(REGISTER_FAILED_MESSAGE, 400, corsHeaders);
          }
          await supabase
            .from("site_users")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", existingUser.id);
          const existingSession = await createSession(existingUser.id, normalizedSiteId, normalizedEmail);
          return secureJsonResponse({
            success: true,
            message: "Account created successfully",
            user: sanitizeUser(existingUser),
            session: existingSession,
          }, 200, corsHeaders);
        }

        // Hash password with bcrypt
        const passwordHash = await bcrypt.hash(password);

        // Create user
        const { data: newUser, error: insertError } = await supabase
          .from("site_users")
          .insert({
            site_id: normalizedSiteId,
            business_id: site.business_id,
            email: normalizedEmail,
            password_hash: passwordHash,
            name: typeof name === "string" ? sanitizeString(name, 200) || null : null,
            metadata: metadata || {},
          })
          .select("id, email, name, metadata, created_at")
          .single();

        if (insertError) {
          console.error("[site-auth] Insert error:", insertError.code ?? "unknown");
          return errorResponse(REGISTER_FAILED_MESSAGE, 400, corsHeaders);
        }

        // Generate session token
        const session = await createSession(newUser.id, normalizedSiteId, normalizedEmail);

        console.log(`[site-auth] User registered for site ${normalizedSiteId}`);

        return secureJsonResponse({
          success: true,
          message: "Account created successfully",
          user: sanitizeUser(newUser),
          session,
        }, 200, corsHeaders);
      }

      // ====================================================================
      // LOGIN - Authenticate existing site user
      // ====================================================================
      case "login": {
        if (!email || !password) {
          return errorResponse("Email and password are required", 400, corsHeaders);
        }

        const normalizedEmail = sanitizeString(email.toLowerCase(), 320);
        if (!isValidEmail(normalizedEmail)) {
          return errorResponse("Invalid email format", 400, corsHeaders);
        }

        // Find user for this specific site
        const { data: user, error: findError } = await supabase
          .from("site_users")
          .select("id, email, name, metadata, password_hash, created_at")
          .eq("site_id", normalizedSiteId)
          .eq("email", normalizedEmail)
          .single();

        if (findError || !user) {
          console.log(`[site-auth] Login failed for site ${normalizedSiteId}`);
          return errorResponse("Invalid email or password", 401, corsHeaders);
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
          console.log(`[site-auth] Login failed for site ${normalizedSiteId}`);
          return errorResponse("Invalid email or password", 401, corsHeaders);
        }

        // Update last login timestamp
        await supabase
          .from("site_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id);

        // Generate session token
        const session = await createSession(user.id, normalizedSiteId, normalizedEmail);

        console.log(`[site-auth] User logged in for site ${normalizedSiteId}`);

        return secureJsonResponse({
          success: true,
          message: "Login successful",
          user: sanitizeUser(user),
          session,
        }, 200, corsHeaders);
      }

      // ====================================================================
      // VERIFY-SESSION - Validate a session token
      // ====================================================================
      case "verify-session": {
        if (!sessionToken) {
          return errorResponse("Session token is required", 400, corsHeaders);
        }

        try {
          const { payload: decoded } = await jwtVerify(sessionToken, JWT_SECRET);

          // Verify token is for the correct site
          if (decoded.siteId !== normalizedSiteId) {
            return errorResponse("Session is not valid for this site", 401, corsHeaders);
          }

          // Get current user data
          const { data: user, error: userError } = await supabase
            .from("site_users")
            .select("id, email, name, metadata, created_at")
            .eq("id", decoded.userId)
            .eq("site_id", normalizedSiteId)
            .single();

          if (userError || !user) {
            return errorResponse("User not found", 401, corsHeaders);
          }

          return secureJsonResponse({
            success: true,
            user: sanitizeUser(user),
            session: {
              token: sessionToken,
              expiresAt: (decoded.exp as number) * 1000,
              siteId: normalizedSiteId,
              userId: user.id,
            },
          }, 200, corsHeaders);
        } catch (err) {
          console.log("[site-auth] Token verification failed:", err);
          return errorResponse("Invalid or expired session", 401, corsHeaders);
        }
      }

      // ====================================================================
      // GET-USER - Get user by session token
      // ====================================================================
      case "get-user": {
        if (!sessionToken) {
          return errorResponse("Session token is required", 400, corsHeaders);
        }

        try {
          const { payload: decoded } = await jwtVerify(sessionToken, JWT_SECRET);

          if (decoded.siteId !== normalizedSiteId) {
            return errorResponse("Session is not valid for this site", 401, corsHeaders);
          }

          const { data: user } = await supabase
            .from("site_users")
            .select("id, email, name, metadata, created_at")
            .eq("id", decoded.userId)
            .eq("site_id", normalizedSiteId)
            .single();

          if (!user) {
            return errorResponse("User not found", 404, corsHeaders);
          }

          return secureJsonResponse({ success: true, user: sanitizeUser(user) }, 200, corsHeaders);
        } catch {
          return errorResponse("Invalid session", 401, corsHeaders);
        }
      }

      // ====================================================================
      // LOGOUT - Acknowledge logout (actual invalidation is client-side)
      // ====================================================================
      case "logout": {
        // Note: JWT tokens are stateless, so logout is handled client-side
        // by removing the token from localStorage. This endpoint just acknowledges.
        console.log(`[site-auth] Logout acknowledged for site ${normalizedSiteId}`);
        return secureJsonResponse({ success: true, message: "Logged out successfully" }, 200, corsHeaders);
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
    }
  } catch (error) {
    console.error("[site-auth] Error:", error);
    return errorResponse("Internal server error", 500, corsHeaders);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function createSession(userId: string, siteId: string, email: string): Promise<SiteSession> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const token = await new SignJWT({
    userId,
    siteId,
    email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(JWT_SECRET);

  return {
    token,
    expiresAt,
    siteId,
    userId,
  };
}

function sanitizeUser(user: Record<string, unknown>): SiteUser {
  return {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string | null,
    metadata: (user.metadata as Record<string, unknown>) || {},
    created_at: user.created_at as string,
  };
}
