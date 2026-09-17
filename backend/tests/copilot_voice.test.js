const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

/**
 * Voice Copilot transcription. Drives the real callLlmTranscription against a
 * stub provider so the multipart shape, retry policy and the "nothing was said"
 * guard are all exercised without touching Groq or billing audio minutes.
 */

let queued = [];
let requestCount = 0;
let lastContentType = "";
let lastBody = null;

const provider = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    requestCount += 1;
    lastContentType = req.headers["content-type"] || "";
    lastBody = Buffer.concat(chunks).toString("latin1");
    const next = queued.shift();
    res.setHeader("content-type", "application/json");
    if (next && next.status && next.status !== 200) {
      res.statusCode = next.status;
      res.end(JSON.stringify({ error: { message: next.message || "provider error" } }));
      return;
    }
    res.end(JSON.stringify({ text: next && next.text !== undefined ? next.text : "" }));
  });
});

let callLlmTranscription;

test.before(async () => {
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const { port } = provider.address();
  process.env.OPENAI_API_KEY = "test-key-not-a-real-credential";
  process.env.GROQ_API_KEY = "";
  process.env.SPEECH_BASE_URL = `http://127.0.0.1:${port}/v1/audio/transcriptions`;
  process.env.SPEECH_MODEL = "whisper-large-v3-turbo";
  process.env.AI_TIMEOUT_MS = "5000";
  ({ callLlmTranscription } = require("../dist/ai/llmClient"));
});

test.after(() => new Promise((resolve) => provider.close(resolve)));

function reset(...responses) {
  queued = responses;
  requestCount = 0;
  lastContentType = "";
  lastBody = null;
}

const clip = () => ({ buffer: Buffer.from("fake-opus-bytes"), filename: "voice.webm", mimeType: "audio/webm" });

test("a spoken question is transcribed and returned trimmed", async () => {
  reset({ text: "  How can I improve this exam?  " });
  const text = await callLlmTranscription(clip());
  assert.equal(text, "How can I improve this exam?");
  assert.equal(requestCount, 1);
});

test("the clip is posted as multipart with the model field", async () => {
  reset({ text: "hello" });
  await callLlmTranscription(clip());
  assert.match(lastContentType, /^multipart\/form-data; boundary=/);
  assert.match(lastBody, /name="file"/);
  assert.match(lastBody, /name="model"/);
  assert.match(lastBody, /whisper-large-v3-turbo/);
  assert.match(lastBody, /fake-opus-bytes/);
});

test("no language is sent unless one is requested, so Whisper auto-detects", async () => {
  reset({ text: "hello" });
  await callLlmTranscription(clip());
  assert.ok(!/name="language"/.test(lastBody), "language must be absent by default");

  reset({ text: "hello" });
  await callLlmTranscription(clip(), { language: "bn" });
  assert.match(lastBody, /name="language"/);
});

test("an empty transcription fails without retrying the same silence", async () => {
  reset({ text: "   " }, { text: "should never be requested" });
  await assert.rejects(
    () => callLlmTranscription(clip()),
    (err) => {
      assert.equal(err.status, 502);
      assert.match(err.message, /no speech was detected/i);
      return true;
    }
  );
  assert.equal(requestCount, 1, "silence is a user problem — retrying re-bills it");
});

test("a rejected clip is not retried", async () => {
  reset({ status: 400, message: "Invalid file format" }, { text: "unreachable" });
  await assert.rejects(() => callLlmTranscription(clip()));
  assert.equal(requestCount, 1, "a file the provider refuses once will be refused again");
});

test("a transient provider failure is retried and can recover", async () => {
  reset({ status: 503, message: "upstream busy" }, { text: "recovered question" });
  const text = await callLlmTranscription(clip());
  assert.equal(text, "recovered question");
  assert.equal(requestCount, 2);
});

test("transcription stops after three attempts rather than looping", async () => {
  reset(
    { status: 503, message: "busy" },
    { status: 503, message: "busy" },
    { status: 503, message: "busy" },
    { text: "unreachable" }
  );
  await assert.rejects(() => callLlmTranscription(clip()));
  assert.equal(requestCount, 3, "bounded at three attempts");
});
