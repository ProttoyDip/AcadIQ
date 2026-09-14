const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { aggregateNumeric, aggregateLabels, aggregateSets, median } = require("../dist/ai/aggregate");
const { redactPii } = require("../dist/ai/redaction");
const { cacheKeyOf } = require("../dist/ai/promptCache");
const { promptRegistrySnapshot, getPrompt } = require("../dist/ai/prompts/registry");
require("../dist/ai/prompts/index");

test("numeric aggregation reports median and spread, and picks the median sample for prose", () => {
  const { consensus, agreement, consensusIndex } = aggregateNumeric([78, 84, 74]);
  assert.equal(consensus, 78);
  assert.equal(consensusIndex, 0);
  assert.equal(agreement.spread, 10);
  assert.equal(agreement.agreement, 90);
  assert.equal(agreement.has_high_discrepancy, false);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("label aggregation takes the modal label and flags contested items", () => {
  const { consensus, agreement } = aggregateLabels([
    { 1: "APPLY", 2: "ANALYZE" },
    { 1: "APPLY", 2: "EVALUATE" },
    { 1: "APPLY", 2: "ANALYZE" },
  ]);
  assert.deepEqual(consensus, { 1: "APPLY", 2: "ANALYZE" });
  assert.equal(agreement.votes["1"], "3/3");
  assert.equal(agreement.votes["2"], "2/3");
  assert.deepEqual(agreement.contested, ["2"]);
  assert.equal(agreement.agreement, 83);
});

test("set aggregation keeps majority items and never averages prose", () => {
  const { kept, agreement } = aggregateSets([
    new Set(["a", "b"]),
    new Set(["a", "c"]),
    new Set(["a", "b"]),
  ]);
  assert.deepEqual([...kept].sort(), ["a", "b"]);
  assert.deepEqual(agreement.contested, ["c"]);
  assert.equal(agreement.votes.a, "3/3");
  assert.equal(agreement.votes.b, "2/3");
  assert.equal(agreement.sampleCount, 3);
  assert.ok(agreement.agreement > 50 && agreement.agreement < 100);
});

test("cache key includes sampleIndex so k samples never collapse into one cached response", () => {
  const base = { promptHash: "p", model: "m", temperature: 0.6, inputHash: "i" };
  assert.notEqual(cacheKeyOf({ ...base, sampleIndex: 0 }), cacheKeyOf({ ...base, sampleIndex: 1 }));
  assert.notEqual(cacheKeyOf({ ...base, sampleIndex: 0 }), cacheKeyOf({ ...base, sampleIndex: 0, temperature: 0.2 }));
  assert.equal(cacheKeyOf({ ...base, sampleIndex: 0 }), cacheKeyOf({ ...base, sampleIndex: 0 }));
});

test("PII redaction strips emails, phones, student ids, name fields and known identifiers", () => {
  const { text, redactions } = redactPii(
    "Name: Rahim Uddin\nRoll No: CSE-20210045\nContact rahim@aust.edu or +880 1712-345678.\nNormalization removes redundancy. ID 2021004567.",
    ["Rahim Uddin"]
  );
  assert.doesNotMatch(text, /rahim@aust\.edu/i);
  assert.doesNotMatch(text, /Rahim Uddin/);
  assert.doesNotMatch(text, /20210045/);
  assert.doesNotMatch(text, /1712-345678/);
  assert.match(text, /Normalization removes redundancy\./);
  assert.ok(redactions.email >= 1);
  assert.ok((redactions.knownIdentifier ?? 0) + (redactions.nameField ?? 0) >= 1);
});

test("Groq 413 is classified as retryable TPM exhaustion vs fatal oversized request", async () => {
  const { classifyFailure } = require("../dist/ai/llmClient");
  const groq = (message) => new Response(JSON.stringify({ error: { message } }), { status: 413 });
  const budget = await classifyFailure(groq("Request too large for model `openai/gpt-oss-120b` in organization `org` on tokens per minute (TPM): Limit 8000, Requested 2900, please try again in 4.2s."));
  assert.equal(budget.retryable, true);
  assert.equal(budget.retryAfterMs, 4200);
  assert.match(budget.message, /budget for this minute/);
  const oversized = await classifyFailure(groq("Request too large for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Requested 12450, please try again in 1s."));
  assert.equal(oversized.retryable, false);
  assert.match(oversized.message, /12,450 tokens but the AI provider allows 8,000/);
  const rate = await classifyFailure(new Response(JSON.stringify({ error: { message: "Rate limit reached. Please try again in 850ms." } }), { status: 429 }));
  assert.equal(rate.retryable, true);
  assert.equal(rate.retryAfterMs, 850);
});

test("similarity validator rejects comparing a paper with itself", () => {
  const { analyzeSimilaritySchema } = require("../dist/validators/analysis.validator");
  assert.equal(analyzeSimilaritySchema.safeParse({ courseId: 1, currentPaperId: 5, previousPaperId: 5 }).success, false);
  assert.equal(analyzeSimilaritySchema.safeParse({ courseId: 1, currentPaperId: 5, previousPaperId: 6 }).success, true);
});

test("prompt registry has every pipeline prompt and matches the checked-in snapshot", () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, "promptHashes.snapshot.json"), "utf8"));
  const live = promptRegistrySnapshot();
  for (const id of ["exam-quality", "syllabus-coverage", "question-review", "bloom-label", "course-outcome-mapping",
    "question-similarity", "question-similarity-candidates", "academic-memory", "academic-memory-candidates", "dual-evaluation"]) {
    assert.ok(live[id], `missing prompt ${id}`);
    assert.match(getPrompt(id).hash, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(live, snapshot, "Prompt changed: bump its version and run `npm run prompts:snapshot`");
});
