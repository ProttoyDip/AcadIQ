const test = require("node:test");
const assert = require("node:assert/strict");

// Explicit fixtures prevent dotenv from picking up a developer's credentials.
// Every provider request is mocked; this file uses no network or database.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/providers_test";
process.env.GROQ_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.TEST_ALPHA_API_KEY = "alpha-test-secret";
process.env.TEST_BETA_API_KEY = "beta-test-secret";
process.env.TEST_DISABLED_API_KEY = "";
process.env.AI_PROVIDERS_JSON = JSON.stringify([
  { id: "alpha", label: "Alpha", baseUrl: "https://alpha.invalid/v1/chat/completions", apiKeyEnv: "TEST_ALPHA_API_KEY", models: ["alpha-main", "alpha-alt"] },
  { id: "beta", label: "Beta", baseUrl: "https://beta.invalid/v1/chat/completions", apiKeyEnv: "TEST_BETA_API_KEY", models: ["beta-main"] },
  { id: "disabled", label: "Disabled", baseUrl: "https://disabled.invalid/v1/chat/completions", apiKeyEnv: "TEST_DISABLED_API_KEY", models: ["disabled-main"] },
]);

const { getAiProviders, getModelCatalog, resolveAiModel } = require("../dist/ai/providers");
const { runWithAiSelection, currentAiSelection } = require("../dist/ai/modelContext");
const { callLlmChat, callLlmChatJson, callLlmJsonWithMeta, resetAiProviderCooldowns } = require("../dist/ai/llmClient");
const messages = [{ role: "user", content: "Describe the next teaching step." }];
const nativeSetTimeout = global.setTimeout;

test.beforeEach(() => resetAiProviderCooldowns());

function success(content = JSON.stringify({ answer: "Review the syllabus." })) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function failure(status, message, code) {
  return new Response(JSON.stringify({ error: { message, code } }), {
    status,
    headers: { "content-type": "application/json", "retry-after": "0.001" },
  });
}

function mockProvider(t, handler) {
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    const call = {
      url: String(url),
      authorization: new Headers(options.headers).get("authorization"),
      body: JSON.parse(options.body),
    };
    calls.push(call);
    return handler(call, calls.length);
  });
  // Retry durations are not under test here; billing/request bounds are.
  t.mock.method(global, "setTimeout", (callback, delay, ...args) => nativeSetTimeout(callback, Math.min(delay, 1), ...args));
  return calls;
}

test("public model catalogue exposes configured models without credentials or endpoints", () => {
  const catalog = getModelCatalog();
  assert.equal(catalog.defaultModelId, "alpha:alpha-main");
  assert.deepEqual(catalog.models.map((model) => model.id), ["alpha:alpha-main", "alpha:alpha-alt", "beta:beta-main"]);
  assert.equal(catalog.models[0].providerLabel, "Alpha");
  assert.doesNotMatch(JSON.stringify(catalog), /test-secret|apiKey|apiKeyEnv|baseUrl|\.invalid|disabled-main/);
});

function configureProviders(t, definitions) {
  const original = process.env.AI_PROVIDERS_JSON;
  process.env.AI_PROVIDERS_JSON = typeof definitions === "string" ? definitions : JSON.stringify(definitions);
  t.after(() => { process.env.AI_PROVIDERS_JSON = original; });
}

test("qualified IDs resolve ambiguous raw names to the requested provider", (t) => {
  const definitions = JSON.parse(process.env.AI_PROVIDERS_JSON);
  definitions[1].models = ["alpha-main"];
  configureProviders(t, definitions);
  assert.equal(resolveAiModel("beta:alpha-main").provider.id, "beta");
  assert.equal(resolveAiModel("alpha-main").provider.id, "alpha");
});

test("a registry without configured keys has an empty catalogue and refuses calls", (t) => {
  configureProviders(t, []);
  assert.deepEqual(getModelCatalog(), { defaultModelId: null, models: [] });
  assert.throws(() => resolveAiModel(), (error) => error.status === 503);
});

for (const invalidConfiguration of ["malformed", "duplicate IDs", "unknown default", "inline credential"]) {
  test(`invalid provider configuration (${invalidConfiguration}) fails without leaking secrets`, (t) => {
    const definitions = JSON.parse(process.env.AI_PROVIDERS_JSON);
    if (invalidConfiguration === "duplicate IDs") definitions.push(definitions[0]);
    if (invalidConfiguration === "unknown default") definitions[0].defaultModel = "not-allowlisted";
    if (invalidConfiguration === "inline credential") definitions[0].apiKey = "accidentally-pasted-secret";
    configureProviders(t, invalidConfiguration === "malformed" ? '{"key":"accidentally-pasted-secret"' : definitions);
    assert.throws(() => getAiProviders(), (error) => {
      assert.match(error.message, /AI_PROVIDERS_JSON is invalid/);
      assert.doesNotMatch(error.message, /accidentally-pasted-secret|alpha-test-secret/);
      return true;
    });
  });
}

const entryPoints = [
  { name: "text chat", invoke: () => callLlmChat(messages), verify: (result) => assert.equal(JSON.parse(result).answer, "Review the syllabus.") },
  { name: "JSON chat", invoke: () => callLlmChatJson(messages), verify: (result) => assert.equal(result.answer, "Review the syllabus.") },
  { name: "analysis with metadata", invoke: () => callLlmJsonWithMeta("Return JSON.", "Review this syllabus."), verify: (result) => {
    assert.equal(result.data.answer, "Review the syllabus.");
    assert.equal(result.meta.model, "beta-main");
    assert.equal(result.meta.modelId, "beta:beta-main");
    assert.equal(result.meta.provider, "beta");
    assert.equal(result.meta.fallbackUsed, true);
    assert.equal(result.meta.totalTokens, 15);
  } },
];

for (const status of [429, 402]) {
  for (const entryPoint of entryPoints) {
    test(`${entryPoint.name} switches endpoint, credential, and model after HTTP ${status}`, async (t) => {
      const calls = mockProvider(t, (call) => call.url.includes("alpha.invalid")
        ? failure(status, status === 429 ? "Rate limit reached." : "Account credits exhausted.")
        : success());
      await runWithAiSelection({ modelId: "alpha:alpha-main", allowFallback: true }, async () => {
        entryPoint.verify(await entryPoint.invoke());
        const selection = currentAiSelection();
        assert.equal(selection.fallbackUsed, true);
        assert.ok(selection.usedModels.some((model) => model.id === "beta:beta-main"));
      });
      assert.equal(calls[0].body.model, "alpha-main");
      assert.equal(calls[0].authorization, "Bearer alpha-test-secret");
      const last = calls.at(-1);
      assert.equal(last.url, "https://beta.invalid/v1/chat/completions");
      assert.equal(last.authorization, "Bearer beta-test-secret");
      assert.equal(last.body.model, "beta-main");
      assert.ok(calls.length <= 4, "fallback must not create an unbounded retry loop");
    });
  }
}

test("an explicit insufficient_quota provider error can use the next provider", async (t) => {
  const calls = mockProvider(t, (call) => call.url.includes("alpha.invalid")
    ? failure(400, "You exceeded your current quota.", "insufficient_quota")
    : success());
  await runWithAiSelection({ modelId: "alpha:alpha-main", allowFallback: true }, async () => {
    assert.equal((await callLlmChatJson(messages)).answer, "Review the syllabus.");
  });
  assert.equal(calls.at(-1).body.model, "beta-main");
});

for (const rejection of [
  { status: 400, message: "Unsupported response format." },
  { status: 413, message: "Request too large on tokens per minute (TPM): Limit 8000, Requested 12450, please try again in 1s." },
]) {
  test(`HTTP ${rejection.status} request errors stop without switching providers`, async (t) => {
    const calls = mockProvider(t, () => failure(rejection.status, rejection.message));
    await assert.rejects(async () => runWithAiSelection({ modelId: "alpha:alpha-main", allowFallback: true },
      () => callLlmChatJson(messages)), (error) => error.status === 502 || error.status === rejection.status);
    assert.equal(calls.length, 1, "a rejected payload must not be sent repeatedly or to other providers");
    assert.equal(calls[0].body.model, "alpha-main");
  });
}

test("a strict selected model never silently falls back", async (t) => {
  const calls = mockProvider(t, () => failure(429, "Rate limit reached."));
  await assert.rejects(async () => runWithAiSelection({ modelId: "alpha:alpha-alt", allowFallback: false },
    () => callLlmJsonWithMeta("Return JSON.", "Review this syllabus.")));
  assert.ok(calls.length >= 1 && calls.length <= 3);
  assert.ok(calls.every((call) => call.body.model === "alpha-alt" && call.authorization === "Bearer alpha-test-secret"));
});

test("unknown selected model is rejected before any provider receives data", async (t) => {
  const calls = mockProvider(t, () => success());
  await assert.rejects(async () => runWithAiSelection({ modelId: "unconfigured:secret-model", allowFallback: true },
    () => callLlmChat(messages)), (error) => error.status === 400);
  assert.equal(calls.length, 0);
});

test("all providers exhausted produces a bounded failure", async (t) => {
  const calls = mockProvider(t, () => failure(429, "Rate limit reached."));
  await assert.rejects(async () => runWithAiSelection({ modelId: "alpha:alpha-main", allowFallback: true },
    () => callLlmChatJson(messages)), (error) => error.status === 502 || error.status === 503 || error.status === 429);
  assert.ok(calls.some((call) => call.url.includes("alpha.invalid")));
  assert.ok(calls.some((call) => call.url.includes("beta.invalid")));
  assert.ok(calls.length <= 6, "at most three attempts per configured provider");
});

test("concurrent requests retain their own model selection and reported model", async (t) => {
  let releaseAlpha;
  let alphaStarted;
  const waitingAlpha = new Promise((resolve) => { releaseAlpha = resolve; });
  const startedAlpha = new Promise((resolve) => { alphaStarted = resolve; });
  mockProvider(t, async (call) => {
    if (call.body.model === "alpha-alt") {
      alphaStarted();
      await waitingAlpha;
    }
    return success(JSON.stringify({ model: call.body.model }));
  });
  const invokeSelected = (modelId) => runWithAiSelection({ modelId, allowFallback: false }, async () => {
    const result = await callLlmChatJson(messages);
    const selection = currentAiSelection();
    return { result, modelId: selection.modelId, used: selection.usedModels.map((model) => model.id), fallbackUsed: selection.fallbackUsed };
  });
  const alpha = invokeSelected("alpha:alpha-alt");
  await startedAlpha;
  let beta;
  try {
    beta = await invokeSelected("beta:beta-main");
  } finally {
    releaseAlpha();
  }
  assert.deepEqual(await alpha, { result: { model: "alpha-alt" }, modelId: "alpha:alpha-alt", used: ["alpha:alpha-alt"], fallbackUsed: false });
  assert.deepEqual(beta, { result: { model: "beta-main" }, modelId: "beta:beta-main", used: ["beta:beta-main"], fallbackUsed: false });
  assert.equal(currentAiSelection(), undefined, "completed request scopes must not leak into subsequent requests");
});
