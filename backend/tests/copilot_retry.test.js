const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

/**
 * The Copilot rejects a reply that omits answer/reasoning/confidence. That is a
 * formatting slip rather than a provider outage, so llmClient's transport
 * retries never see it — response.service re-asks once instead. These tests
 * drive that through a stub provider so the behaviour is deterministic.
 */

let queued = [];
let requestCount = 0;
let lastRequestBody = null;

const provider = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    requestCount += 1;
    lastRequestBody = JSON.parse(raw);
    const content = queued.shift() ?? {};
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
  });
});

let generateCopilotResponse;

test.before(async () => {
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const { port } = provider.address();
  process.env.OPENAI_API_KEY = "test-key-not-a-real-credential";
  process.env.GROQ_API_KEY = "";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
  process.env.AI_TIMEOUT_MS = "5000";
  ({ generateCopilotResponse } = require("../dist/services/copilot/response.service"));
});

test.after(() => new Promise((resolve) => provider.close(resolve)));

function reset(...responses) {
  queued = responses;
  requestCount = 0;
  lastRequestBody = null;
}

const VALID = { answer: "Add two application-level questions.", reasoning: "Recall items dominate the paper.", confidence: 88 };

test("a well-formed reply is returned without any retry", async () => {
  reset(VALID);
  const result = await generateCopilotResponse([{ role: "user", content: "How can this exam improve?" }]);
  assert.equal(result.answer, VALID.answer);
  assert.equal(requestCount, 1, "a valid first reply must not trigger a second billed call");
});

test("a reply missing 'reasoning' is re-asked once and recovers", async () => {
  reset({ answer: "Add two application-level questions.", confidence: 88 }, VALID);
  const result = await generateCopilotResponse([{ role: "user", content: "How can this exam improve?" }]);

  assert.equal(result.reasoning, VALID.reasoning);
  assert.equal(requestCount, 2, "exactly one retry");

  // The re-ask must tell the model what was wrong, and carry the prior turns.
  const followUp = lastRequestBody.messages.at(-1);
  assert.equal(followUp.role, "user");
  assert.match(followUp.content, /reasoning/);
  assert.match(followUp.content, /required/i);
});

test("confidence outside 0-100 is treated as a shape failure and re-asked", async () => {
  reset({ ...VALID, confidence: 150 }, VALID);
  const result = await generateCopilotResponse([{ role: "user", content: "How can this exam improve?" }]);
  assert.equal(result.confidence, 88);
  assert.equal(requestCount, 2);
});

test("two malformed replies stop at 502 rather than retrying forever", async () => {
  reset({ answer: "only an answer" }, { answer: "still only an answer" });
  await assert.rejects(
    () => generateCopilotResponse([{ role: "user", content: "How can this exam improve?" }]),
    (err) => {
      assert.equal(err.status, 502);
      assert.match(err.message, /did not answer/i);
      return true;
    }
  );
  assert.equal(requestCount, 2, "bounded at one retry — never an unbounded billing loop");
});
