import type { AIMessage } from "./AIAssistantCore";

export const SITE_CONFIRMATION_MARKER = "<UNISON_SITE_CONFIRMATION>";

export function isSiteConfirmation(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  return /^(?:(?:yes|yeah|yep|yup|ya|yea)(?:,? (?:please|thanks|thank you|that(?:'s| is) (?:right|correct|accurate)|this (?:is|looks|sounds) (?:right|correct|accurate|good)))?|correct|confirmed|confirm|looks good|sounds good|that(?:'s| is) (?:right|correct|accurate)|this (?:is|looks|sounds) (?:right|correct|accurate|good)|go ahead|let's do it|sure|absolutely|proceed|perfect|exactly)$/.test(normalized);
}

export function stripSiteConfirmationMarker(value: string): string {
  return value.split(SITE_CONFIRMATION_MARKER).join("")
    .replace(/<UNISON_WIZARD_STEP:[a-z]+>/g, "").trim();
}

function stripConfirmationQuestion(value: string): string {
  return value
    .replace(/\s+(?:is|does|do|are|would|can)\s+(?:that|this|these|you)\b[^?]{0,220}\?\s*$/i, "")
    .trim();
}

export function buildConfirmedSiteBrief(messages: AIMessage[]): string {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const summary = lastAssistantMessage
    ? stripConfirmationQuestion(stripSiteConfirmationMarker(lastAssistantMessage.content))
    : "";
  const userRequests = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => Boolean(content) && !isSiteConfirmation(content));

  return [
    summary && `Confirmed site direction:\n${summary}`,
    userRequests.length > 0 && `Conversation details:\n${userRequests.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function hasSiteConfirmationRequest(message: AIMessage | undefined): boolean {
  if (message?.role !== "assistant") return false;
  if (message.content.includes(SITE_CONFIRMATION_MARKER)) return true;
  return /\b(?:is|does|do|are|would|can)\b[^?]{0,220}\b(?:right|correct|accurate|complete|direction|summary|plan|brief|look good|sound good)\b[^?]*\?/i
    .test(message.content)
    || /\b(?:clear direction|all set to (?:build|configure|set up)|ready to help you configure)\b/i
      .test(message.content);
}

export function describeAssistantFailure(error: unknown): string {
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  const message = error instanceof Error ? error.message : "";
  if (status === 401 || /session expired|sign in again|invalid or expired token/i.test(message)) {
    return "Your session expired. Please sign in again.";
  }
  return message && message.length <= 160 ? message : "Failed to get AI response";
}

// A backend that predates the isolated discovery lane ignores the mode and
// answers with builder-lane output, which must not be shown as chat.
export function isSiteDiscoveryResponse(data: unknown): boolean {
  return (data as { mode?: unknown } | null)?.mode === "site-discovery";
}
