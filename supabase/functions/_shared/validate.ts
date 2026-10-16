/**
 * Shared Input Validation Utilities for Edge Functions
 * 
 * Provides common validation patterns for request bodies.
 * Keeps edge functions focused on business logic.
 */

/** Strict email regex (RFC 5322 simplified) */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** UUID v4 regex */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** URL regex (basic) */
const URL_REGEX = /^https?:\/\/.+/;

/** Phone regex (international, digits/dashes/spaces/parens/plus) */
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

export function isValidUUID(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export function isValidUrl(url: unknown): url is string {
  return typeof url === "string" && URL_REGEX.test(url);
}

export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === "string" && PHONE_REGEX.test(phone.trim());
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Sanitize a string by stripping control characters and trimming.
 * Prevents null bytes and other injection vectors.
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return input
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Safely parse JSON from request body with size limit.
 * Returns null on failure instead of throwing.
 */
export async function safeParseBody<T = Record<string, unknown>>(
  req: Request,
  maxSizeBytes = 1_048_576 // 1 MB
): Promise<{ data: T | null; error: string | null }> {
  let text = "";
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return { data: null, error: `Request body exceeds ${maxSizeBytes} byte limit (content-length=${contentLength})` };
    }

    text = await req.text();
    if (text.length > maxSizeBytes) {
      return { data: null, error: `Request body exceeds ${maxSizeBytes} byte limit (text=${text.length})` };
    }

    if (!text || text.trim().length === 0) {
      return { data: null, error: "Empty request body" };
    }

    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const preview = text ? text.slice(0, 120).replace(/\s+/g, " ") : "(empty)";
    console.error("[safeParseBody] JSON parse failed", {
      reason,
      textLength: text.length,
      preview,
      contentType: req.headers.get("content-type"),
      contentEncoding: req.headers.get("content-encoding"),
    });
    return { data: null, error: `Invalid JSON in request body: ${reason} (len=${text.length})` };
  }
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "object" | "array";
  validator?: (value: unknown) => boolean;
  message?: string;
}

/**
 * Validate an object against a set of rules.
 * Returns an array of error messages (empty = valid).
 */
export function validateFields(
  data: Record<string, unknown>,
  rules: ValidationRule[]
): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = data[rule.field];

    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(rule.message || `${rule.field} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (rule.type && typeof value !== rule.type) {
      if (!(rule.type === "array" && Array.isArray(value))) {
        errors.push(rule.message || `${rule.field} must be of type ${rule.type}`);
        continue;
      }
    }

    if (rule.validator && !rule.validator(value)) {
      errors.push(rule.message || `${rule.field} is invalid`);
    }
  }

  return errors;
}

/** Escape untrusted text before it is placed inside an HTML email or page. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
