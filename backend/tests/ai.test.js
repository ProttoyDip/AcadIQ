const test = require("node:test");
const assert = require("node:assert/strict");
const { extractQuestions } = require("../dist/ai/questionExtractor");
const {
  coMappingResponseSchema,
  questionReviewResponseSchema,
} = require("../dist/ai/schemas/analysisResponse.schema");

test("extractQuestions segments numbered questions and marks", () => {
  const result = extractQuestions([
    "Final examination",
    "Q1. Explain database normalization. [5 marks]",
    "2) Design a relational schema. (10)",
  ].join("\n"));

  assert.deepEqual(result.map(({ sequenceNumber, marks }) => ({ sequenceNumber, marks })), [
    { sequenceNumber: 1, marks: 5 },
    { sequenceNumber: 2, marks: 10 },
  ]);
});

test("question review schema rejects out-of-range scores", () => {
  const result = questionReviewResponseSchema.safeParse({
    qualityScore: 101,
    questions: [],
    issues: [],
    recommendations: [],
  });
  assert.equal(result.success, false);
});

test("CO mapping schema accepts structured coverage", () => {
  const result = coMappingResponseSchema.safeParse({
    qualityScore: 86,
    coverage: { CO1: 90 },
    mappings: [{ questionId: 1, courseOutcome: "CO1", strength: "STRONG", rationale: "Directly assessed" }],
    unmappedQuestionIds: [],
    issues: [],
    recommendations: [],
  });
  assert.equal(result.success, true);
});
