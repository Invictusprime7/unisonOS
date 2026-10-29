import { getCorsHeaders } from "./cors.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function headersFor(origin: string) {
  return getCorsHeaders(new Request("https://example.test", {
    headers: { origin },
  }));
}

Deno.test("allows canonical UnisonOS Vercel deployments", () => {
  const origin = "https://unisonos-d0xgj0brm-unrealdev02s-projects.vercel.app";
  assertEquals(headersFor(origin)["Access-Control-Allow-Origin"], origin);
});

Deno.test("allows canonical UnisonOS custom domains", () => {
  assertEquals(headersFor("https://unisonai.dev")["Access-Control-Allow-Origin"], "https://unisonai.dev");
  assertEquals(headersFor("https://www.unisonai.dev")["Access-Control-Allow-Origin"], "https://www.unisonai.dev");
  assertEquals(headersFor("https://unisonos.ai")["Access-Control-Allow-Origin"], "https://unisonos.ai");
  assertEquals(headersFor("https://www.unisonos.ai")["Access-Control-Allow-Origin"], "https://www.unisonos.ai");
  assertEquals(headersFor("https://unisonai.vercel.app")["Access-Control-Allow-Origin"], "https://unisonai.vercel.app");
});

Deno.test("retains legacy deployment support", () => {
  const origin = "https://unison-tasks-official-preview.vercel.app";
  assertEquals(headersFor(origin)["Access-Control-Allow-Origin"], origin);
});

Deno.test("rejects lookalike Vercel origins", () => {
  assertEquals(
    headersFor("https://unisonos-attacker.vercel.app")["Access-Control-Allow-Origin"],
    "",
  );
  assertEquals(headersFor("http://unisonos-preview.vercel.app")["Access-Control-Allow-Origin"], "");
});
