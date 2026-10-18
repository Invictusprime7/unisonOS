export function isAnonymousRequestAllowed(isAnonymous: boolean, allowAnonymous = false): boolean {
  return !isAnonymous || allowAnonymous;
}

export function hasAnonymousClaimForSubject(token: string, subject: string): boolean {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return false;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const claims = JSON.parse(decoded) as { sub?: unknown; is_anonymous?: unknown };
    return claims.sub === subject && claims.is_anonymous === true;
  } catch {
    return false;
  }
}