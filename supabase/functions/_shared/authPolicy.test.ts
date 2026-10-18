import { hasAnonymousClaimForSubject, isAnonymousRequestAllowed } from "./authPolicy.ts";

function tokenFor(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${payload}.signature`;
}

Deno.test("permanent authenticated users remain allowed", () => {
  if (!isAnonymousRequestAllowed(false)) throw new Error("Expected a permanent user to be allowed");
});

Deno.test("anonymous users are denied by default", () => {
  if (isAnonymousRequestAllowed(true)) throw new Error("Expected anonymous access to be denied");
});

Deno.test("anonymous access requires an explicit handler opt-in", () => {
  if (!isAnonymousRequestAllowed(true, true)) throw new Error("Expected explicit anonymous access to be allowed");
});

Deno.test("anonymous claim is scoped to the verified token subject", () => {
  const token = tokenFor({ sub: "guest-id", is_anonymous: true });
  if (!hasAnonymousClaimForSubject(token, "guest-id")) throw new Error("Expected anonymous claim for matching subject");
  if (hasAnonymousClaimForSubject(token, "other-user")) throw new Error("Expected mismatched subject to be rejected");
});