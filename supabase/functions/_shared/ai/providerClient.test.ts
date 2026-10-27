import {
  createLastResortGatewayChatCompletion,
  createPlannedChatCompletion,
  fetchWithShortRateLimitRetry,
  getShortRateLimitRetryMs,
  resolveConfiguredProviders,
} from "./providerClient.ts";

Deno.test("preserves multimodal image parts on Gemini, OpenAI and managed gateway wire requests", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "UNISONGEMINI_API_KEY", "OPENAI_API_KEY", "OPENAI_MODEL", "LOVABLE_API_KEY"];
  const saved = new Map(names.map(name => [name, Deno.env.get(name)]));
  const messages = [{ role: "system", content: "Edit only the supplied source" }, {
    role: "user", content: [
      { type: "text", text: "Place https://example.test/upload.png using this reference" },
      { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
    ],
  }];
  const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
  try {
    for (const name of names) Deno.env.delete(name);
    for (const name of ["GEMINI_API_KEY", "OPENAI_API_KEY", "LOVABLE_API_KEY"]) Deno.env.set(name, "test-key");
    globalThis.fetch = (async (url, init) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response('{"choices":[{"message":{"content":"ok"}}]}');
    }) as typeof fetch;
    for (const model of ["google/gemini-3.8-flash", "openai/gpt-4.1"]) {
      await createPlannedChatCompletion({ model, messages, max_tokens: 1000 });
    }
    await createLastResortGatewayChatCompletion({ model: "google/gemini-3.8-flash", messages, max_tokens: 1000 });
    assertEquals(sent.map(call => call.url), [
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "https://api.openai.com/v1/chat/completions",
      "https://ai.gateway.lovable.dev/v1/chat/completions",
    ]);
    for (const call of sent) assertEquals(call.body.messages, messages);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
});

Deno.test("preserves capable OpenAI models and applies actual model output limits", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["OPENAI_API_KEY", "OPENAI_MODEL"];
  const saved = new Map(names.map((name) => [name, Deno.env.get(name)]));
  const sent: Array<Record<string, unknown>> = [];
  Deno.env.set("OPENAI_API_KEY", "test-key");
  Deno.env.delete("OPENAI_MODEL");
  globalThis.fetch = (async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{"choices":[{"message":{"content":"ok"}}]}');
  }) as typeof fetch;
  try {
    for (const model of ["openai/gpt-4.1", "openai/gpt-5", "openai/gpt-5-mini"]) {
      await createPlannedChatCompletion({
        model, messages: [{ role: "user", content: "Edit this page" }],
        ...(model.includes("gpt-5") ? { max_completion_tokens: 40_000 } : { max_tokens: 40_000 }),
        reasoning_effort: "medium", tools: [],
      });
    }
    assertEquals(sent.map((body) => body.model), ["gpt-4.1", "gpt-4.1", "gpt-4.1"]);
    assertEquals(sent[0].max_tokens, 16_384);
    assertEquals(sent[0].reasoning_effort, undefined);
    for (const body of sent.slice(1)) {
      assertEquals(body.max_tokens, 16_384);
      assertEquals(body.max_completion_tokens, undefined);
      assertEquals(body.reasoning_effort, undefined);
      assertEquals(body.tools, []);
    }
    Deno.env.set("OPENAI_MODEL", "gpt-5-mini");
    await createPlannedChatCompletion({
      model: "openai/gpt-4.1", messages: [{ role: "user", content: "Edit" }],
      max_tokens: 24_000, reasoning_effort: "low",
    });
    assertEquals(sent[3].model, "gpt-4.1");
    assertEquals(sent[3].max_tokens, 16_384);
    assertEquals(sent[3].reasoning_effort, undefined);
    Deno.env.set("OPENAI_MODEL", "gpt-4o-mini");
    await createPlannedChatCompletion({
      model: "openai/gpt-5", messages: [{ role: "user", content: "Edit" }],
      max_completion_tokens: 2_000, reasoning_effort: "low",
    });
    assertEquals(sent[4].max_tokens, 2_000);
    assertEquals(sent[4].reasoning_effort, undefined);
    await createPlannedChatCompletion({
      model: "openai/gpt-5", messages: [{ role: "user", content: "Edit" }],
      max_completion_tokens: 64_000, reasoning_effort: "high",
    });
    assertEquals(sent[5].model, "gpt-4o-mini");
    assertEquals(sent[5].max_tokens, 16_384);
    assertEquals(sent[5].max_completion_tokens, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});

Deno.test("allows metered planned calls to disable the transparent rate-limit retry", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get("GEMINI_API_KEY");
  let calls = 0;
  Deno.env.set("GEMINI_API_KEY", "test-key");
  globalThis.fetch = (async () => {
    calls++;
    return new Response("rate limited", { status: 429 });
  }) as typeof fetch;
  try {
    const response = await createPlannedChatCompletion({
      model: "google/gemini-3.8-flash",
      messages: [{ role: "user", content: "Edit this page" }],
      max_tokens: 1000,
    }, undefined, false);
    assertEquals(response.status, 429);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete("GEMINI_API_KEY");
    else Deno.env.set("GEMINI_API_KEY", originalKey);
  }
});

function env(values: Record<string, string>): (name: string) => string | undefined {
  return (name) => values[name];
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("defaults to Gemini when multiple text providers are configured", () => {
  const providers = resolveConfiguredProviders(undefined, env({
    GEMINI_API_KEY: "gemini-test-key",
    OPENAI_API_KEY: "openai-test-key",
    ANTHROPIC_API_KEY: "anthropic-test-key",
  }));

  assertEquals(providers, ["gemini", "openai", "anthropic"]);
});

Deno.test("keeps Gemini first for explicit OpenAI model requests", () => {
  const providers = resolveConfiguredProviders("openai/gpt-5", env({
    GEMINI_API_KEY: "gemini-test-key",
    OPENAI_API_KEY: "openai-test-key",
  }));

  assertEquals(providers, ["gemini", "openai"]);
});

Deno.test("routes explicit Gemini models to Gemini first", () => {
  const providers = resolveConfiguredProviders("google/gemini-3.8-flash", env({
    GEMINI_API_KEY: "gemini-test-key",
    OPENAI_API_KEY: "openai-test-key",
  }));

  assertEquals(providers, ["gemini", "openai"]);
});

Deno.test("accepts GOOGLE_API_KEY as the server-side Gemini alias", () => {
  const providers = resolveConfiguredProviders("gemini-3.8-flash", env({
    GOOGLE_API_KEY: "google-test-key",
  }));

  assertEquals(providers, ["gemini"]);
});

Deno.test("retries a short rate limit response once", async () => {
  let calls = 0;
  const response = await fetchWithShortRateLimitRetry(
    "https://provider.example.test/chat",
    undefined,
    undefined,
    () => {
      calls += 1;
      return Promise.resolve(calls === 1
        ? new Response("busy", { status: 429, headers: { "retry-after": "0" } })
        : new Response("ok", { status: 200 }));
    },
  );

  if (calls !== 2) throw new Error(`Expected two provider calls, received ${calls}`);
  if (response.status !== 200) throw new Error(`Expected retry success, received ${response.status}`);
});

Deno.test("does not retry a long provider cooldown", async () => {
  let calls = 0;
  const response = await fetchWithShortRateLimitRetry(
    "https://provider.example.test/chat",
    undefined,
    undefined,
    () => {
      calls += 1;
      return Promise.resolve(
        new Response("busy", { status: 429, headers: { "retry-after": "5" } }),
      );
    },
  );

  if (calls !== 1) throw new Error(`Expected one provider call, received ${calls}`);
  if (response.status !== 429) throw new Error(`Expected original 429, received ${response.status}`);
});

Deno.test("retries a transient provider capacity response once", async () => {
  let calls = 0;
  const response = await fetchWithShortRateLimitRetry(
    "https://provider.example.test/chat",
    undefined,
    undefined,
    () => {
      calls += 1;
      return Promise.resolve(calls === 1
        ? new Response("temporarily unavailable", { status: 503, headers: { "retry-after": "0" } })
        : new Response("ok", { status: 200 }));
    },
  );

  if (calls !== 2) throw new Error(`Expected two provider calls, received ${calls}`);
  if (response.status !== 200) throw new Error(`Expected retry success, received ${response.status}`);
});

Deno.test("parses a short HTTP-date Retry-After value", () => {
  const now = Date.parse("2026-07-17T00:00:00Z");
  const retryMs = getShortRateLimitRetryMs(
    new Headers({ "retry-after": "Fri, 17 Jul 2026 00:00:02 GMT" }),
    now,
  );
  if (retryMs !== 2000) throw new Error(`Expected 2000ms retry, received ${retryMs}`);
});

Deno.test("never places the Lovable gateway ahead of direct provider keys", () => {
  const providers = resolveConfiguredProviders("openai/gpt-5-mini", env({
    LOVABLE_API_KEY: "lovable-test-key",
    GEMINI_API_KEY: "gemini-test-key",
    OPENAI_API_KEY: "openai-test-key",
  }));

  assertEquals(providers, ["gemini", "openai", "lovable"]);
});

Deno.test("current Gemini wire models survive deployment defaults and blank key aliases", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL"];
  const saved = new Map(names.map(name => [name, Deno.env.get(name)]));
  const sent: Record<string, unknown>[] = [];
  Deno.env.set("GEMINI_API_KEY", " ");
  Deno.env.set("GOOGLE_API_KEY", " test-key ");
  Deno.env.set("GEMINI_MODEL", "google/gemini-3.8-flash");
  globalThis.fetch = (async (url, init) => {
    assertEquals(String(url), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    assertEquals(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    sent.push(JSON.parse(String(init?.body)));
    return new Response('{"choices":[{"message":{"content":"ok"}}]}');
  }) as typeof fetch;
  try {
    for (const model of ["google/gemini-3.8-flash"]) {
      await createPlannedChatCompletion({ model, messages: [{ role: "user", content: "Generate a page" }], max_tokens: 16000 });
    }
    assertEquals(sent.map(body => body.model), ["gemini-3.8-flash"]);
    assertEquals(sent.every(body => body.reasoning_effort === "low"), true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
});

Deno.test("toAnthropicMessages converts OpenAI image_url parts to Anthropic image blocks", async () => {
  const { toAnthropicMessages } = await import("./providerClient.ts");
  const out = toAnthropicMessages([
    { role: "system", content: "sys" },
    { role: "user", content: [
      { type: "text", text: "Place this image" },
      { type: "image_url", image_url: { url: "data:image/png;base64,aGVs bG8=" } },
      { type: "image_url", image_url: { url: "https://example.test/remote.png" } },
    ] },
    { role: "assistant", content: "done" },
  ]);
  assertEquals(out.length, 2);
  assertEquals(out[0].role, "user");
  assertEquals(out[0].content, [
    { type: "text", text: "Place this image" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" } },
  ]);
  assertEquals(out[1], { role: "assistant", content: "done" });
  assertEquals(toAnthropicMessages([{ role: "user", content: [
    { type: "image_url", image_url: { url: "https://example.test/x.png" } },
  ] }])[0].content, "");
});
