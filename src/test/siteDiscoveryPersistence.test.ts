import { describe, expect, it, vi } from "vitest";
import {
  clearSiteDiscoveryHandoff,
  readSiteDiscoveryHandoff,
  readSiteDiscoveryMessages,
  siteDiscoveryHandoffKey,
  siteDiscoveryMessagesKey,
  writeSiteDiscoveryHandoff,
  writeSiteDiscoveryMessages,
} from "@/components/ai/siteDiscoveryPersistence";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

describe("site discovery persistence", () => {
  it("scopes transcript and handoff storage to the signed-in user", () => {
    expect(siteDiscoveryMessagesKey("user/a")).not.toBe(siteDiscoveryMessagesKey("user-b"));
    expect(siteDiscoveryHandoffKey("user/a")).not.toBe(siteDiscoveryHandoffKey("user-b"));
  });

  it("round-trips conversation messages and restores Date timestamps", () => {
    const storage = memoryStorage();
    const timestamp = new Date("2026-10-04T12:00:00.000Z");
    const messages = [{ role: "assistant" as const, content: "Does this fit?", timestamp }];
    const key = siteDiscoveryMessagesKey("user-123");

    writeSiteDiscoveryMessages(key, messages, storage);

    expect(readSiteDiscoveryMessages(key, storage)).toEqual(messages);
    expect(readSiteDiscoveryMessages(key, storage)?.[0].timestamp).toBeInstanceOf(Date);
  });

  it("ignores malformed transcript data and reports the invalid payload", () => {
    const storage = memoryStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = siteDiscoveryMessagesKey("user-123");
    storage.setItem(key, JSON.stringify({ version: 99, messages: [] }));

    expect(readSiteDiscoveryMessages(key, storage)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("restores a confirmed Wizard brief until the user dismisses it", () => {
    const storage = memoryStorage();

    writeSiteDiscoveryHandoff("user-123", "Confirmed bakery site with online ordering.", storage);
    expect(readSiteDiscoveryHandoff("user-123", storage)).toBe("Confirmed bakery site with online ordering.");
    clearSiteDiscoveryHandoff("user-123", storage);
    expect(readSiteDiscoveryHandoff("user-123", storage)).toBeNull();
  });
});