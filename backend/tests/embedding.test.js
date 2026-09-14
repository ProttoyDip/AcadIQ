const test = require("node:test");
const assert = require("node:assert/strict");
const {
  bufferToVector,
  vectorToBuffer,
  dot,
  normalizeInPlace,
  topKNeighbours,
  contentHash,
} = require("../dist/ai/embedding/vectorMath");
const { selectCandidatePairs, backgroundSimilarityP95, chunk } = require("../dist/ai/retrieval/candidateSelector");
const { similarityCandidateResponseSchema, academicMemoryCandidateResponseSchema } = require("../dist/ai/schemas/analysisResponse.schema");

function unit(values) {
  return normalizeInPlace(Float32Array.from(values));
}

test("vector round-trips through the LONGBLOB encoding at any byte offset", () => {
  const original = unit([0.2, -0.4, 0.6, 0.8]);
  const bytes = vectorToBuffer(original);
  // Simulate Node's slab pool by placing the payload at an odd offset.
  const padded = Buffer.concat([Buffer.from([1, 2, 3]), bytes]);
  const view = padded.subarray(3);
  const decoded = bufferToVector(view, 4);
  assert.deepEqual(Array.from(decoded), Array.from(original));
  assert.throws(() => bufferToVector(view.subarray(0, 8), 4), /does not match dimension/);
});

test("normalised vectors make cosine a plain dot product", () => {
  const a = unit([3, 4]);
  const b = unit([3, 4]);
  const c = unit([-4, 3]);
  assert.ok(Math.abs(dot(a, b) - 1) < 1e-6);
  assert.ok(Math.abs(dot(a, c)) < 1e-6);
});

test("topKNeighbours respects k and the floor and sorts descending", () => {
  const query = unit([1, 0]);
  const candidates = [
    { item: "same", vector: unit([1, 0]) },
    { item: "close", vector: unit([0.9, 0.1]) },
    { item: "far", vector: unit([0, 1]) },
    { item: "opposite", vector: unit([-1, 0]) },
  ];
  const result = topKNeighbours(query, candidates, 5, 0.5);
  assert.deepEqual(result.map((r) => r.item), ["same", "close"]);
  assert.equal(topKNeighbours(query, candidates, 1, 0.5).length, 1);
});

test("candidate selection shortlists top-k per current question above an adaptive floor", () => {
  const current = [
    { id: 1, text: "normalisation", vector: unit([1, 0, 0]) },
    { id: 2, text: "sorting", vector: unit([0, 1, 0]) },
  ];
  const previous = [
    { id: 11, text: "normalisation again", vector: unit([0.95, 0.05, 0]) },
    { id: 12, text: "sorting again", vector: unit([0, 0.95, 0.05]) },
    { id: 13, text: "unrelated", vector: unit([0, 0, 1]) },
    { id: 14, text: "unrelated 2", vector: unit([0.1, 0.1, 1]) },
  ];
  const selection = selectCandidatePairs(current, previous, { floor: 0.55, topK: 5, maxPairs: 40 });
  assert.deepEqual(
    selection.pairs.map((p) => [p.current.id, p.previous.id]).sort(),
    [[1, 11], [2, 12]]
  );
  assert.ok(selection.pairs.every((p) => p.vectorSimilarity >= selection.floor));
  assert.ok(selection.floor >= 0.55);
  assert.equal(selection.truncated, false);
  // The background p95 is the within-previous distribution and never lowers the configured floor.
  const p95 = backgroundSimilarityP95(previous);
  assert.ok(p95 !== null && p95 < 1);
  assert.equal(selection.floor, Math.max(0.55, p95));
});

test("candidate selection caps the total pairs and reports truncation", () => {
  const vector = unit([1, 0]);
  const current = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, text: "q", vector }));
  const previous = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, text: "q", vector }));
  const selection = selectCandidatePairs(current, previous, { floor: 0.5, topK: 5, maxPairs: 12, adaptive: false });
  assert.equal(selection.pairs.length, 12);
  assert.equal(selection.truncated, true);
});

test("candidate selection with nothing above the floor yields zero pairs (no LLM call needed)", () => {
  const selection = selectCandidatePairs(
    [{ id: 1, text: "a", vector: unit([1, 0]) }],
    [{ id: 2, text: "b", vector: unit([0, 1]) }],
    { floor: 0.55, adaptive: false }
  );
  assert.equal(selection.pairs.length, 0);
});

test("chunk splits into bounded LLM batches", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("content hash is stable under unicode normalisation", () => {
  assert.equal(contentHash("caf\u00e9"), contentHash("cafe\u0301"));
});

test("candidate-pair schemas accept rejected pairs and default them to empty", () => {
  const similarity = similarityCandidateResponseSchema.safeParse({
    matches: [],
    recommendation: "Nothing to change.",
    explanation: { decision: "OK", reason: "All shortlisted pairs assess different skills.", confidence: 0 },
  });
  assert.equal(similarity.success, true);
  assert.deepEqual(similarity.data.rejectedPairs, []);

  const memory = academicMemoryCandidateResponseSchema.safeParse({
    similarQuestions: [],
    rejectedPairs: [{ newQuestionId: 1, historicalQuestionId: 2, reason: "Different topic." }],
    replacementSuggestion: "None.",
    explanation: { decision: "OK", reason: "No overlap.", confidence: 0 },
  });
  assert.equal(memory.success, true);
});
