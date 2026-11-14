/**
 * Server-issued visitor sessions for anonymous cart and order endpoints.
 *
 * A session token is `<uuid>.<signature>`. Only this backend can sign one, so a
 * caller can read or change cart and order data only for a session it was
 * issued — knowing another visitor's session id is never enough.
 */

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_LABEL = "unison-visitor-session:v1:";

let cachedKey: Promise<CryptoKey> | null = null;

function signingSecret(): string {
  const secret = Deno.env.get("VISITOR_SESSION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Visitor sessions are not configured");
  return secret;
}

function signingKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(TOKEN_LABEL + signingSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return cachedKey;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Issue a fresh visitor session and its signed token. */
export async function issueVisitorSession(): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionId = crypto.randomUUID();
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(sessionId));
  return { sessionId, sessionToken: `${sessionId}.${toBase64Url(signature)}` };
}

/** Return the session id inside a token this backend signed, otherwise null. */
export async function verifyVisitorSession(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length > 200) return null;
  const [sessionId, signature, extra] = token.split(".");
  if (extra !== undefined || !sessionId || !signature || !SESSION_ID.test(sessionId)) return null;
  const bytes = fromBase64Url(signature);
  if (!bytes) return null;
  const valid = await crypto.subtle.verify("HMAC", await signingKey(), bytes, new TextEncoder().encode(sessionId));
  return valid ? sessionId : null;
}
