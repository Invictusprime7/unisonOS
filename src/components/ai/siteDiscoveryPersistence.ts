import type { AIMessage } from "./AIAssistantCore";

const STORAGE_VERSION = 1;
const MAX_PERSISTED_MESSAGES = 60;

export function siteDiscoveryMessagesKey(userId: string): string {
  return `unison.site-discovery.v${STORAGE_VERSION}.${encodeURIComponent(userId)}.messages`;
}

export function siteDiscoveryHandoffKey(userId: string): string {
  return `unison.site-discovery.v${STORAGE_VERSION}.${encodeURIComponent(userId)}.handoff`;
}

function isPersistedMessage(value: unknown): value is AIMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<AIMessage>;
  return (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
    && typeof message.timestamp === "string"
    && Number.isFinite(Date.parse(message.timestamp));
}

export function readSiteDiscoveryMessages(
  key: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): AIMessage[] | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed
      || typeof parsed !== "object"
      || (parsed as { version?: unknown }).version !== STORAGE_VERSION
      || !Array.isArray((parsed as { messages?: unknown }).messages)
    ) {
      throw new Error("Stored site-discovery conversation has an invalid shape.");
    }
    const messages = (parsed as { messages: unknown[] }).messages;
    if (!messages.every(isPersistedMessage)) {
      throw new Error("Stored site-discovery conversation contains an invalid message.");
    }
    return messages.slice(-MAX_PERSISTED_MESSAGES).map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp),
    }));
  } catch (error) {
    console.warn("[siteDiscoveryPersistence] Ignoring invalid saved conversation.", error);
    return null;
  }
}

export function writeSiteDiscoveryMessages(
  key: string,
  messages: AIMessage[],
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  storage.setItem(key, JSON.stringify({
    version: STORAGE_VERSION,
    messages: messages.slice(-MAX_PERSISTED_MESSAGES).map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
  }));
}

export function readSiteDiscoveryHandoff(
  userId: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): string | null {
  const raw = storage.getItem(siteDiscoveryHandoffKey(userId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Saved handoff has an invalid shape.");
    const value = parsed as { version?: unknown; brief?: unknown };
    if (value.version !== STORAGE_VERSION || typeof value.brief !== "string" || !value.brief.trim()) {
      throw new Error("Saved handoff is missing its confirmed brief.");
    }
    return value.brief;
  } catch (error) {
    console.warn("[siteDiscoveryPersistence] Ignoring invalid saved Wizard handoff.", error);
    return null;
  }
}

export function writeSiteDiscoveryHandoff(
  userId: string,
  brief: string,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  storage.setItem(siteDiscoveryHandoffKey(userId), JSON.stringify({
    version: STORAGE_VERSION,
    brief,
  }));
}

export function clearSiteDiscoveryHandoff(
  userId: string,
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  storage.removeItem(siteDiscoveryHandoffKey(userId));
}