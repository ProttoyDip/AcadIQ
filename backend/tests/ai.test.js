const test = require("node:test");
const assert = require("node:assert/strict");
const { extractQuestions } = require("../dist/ai/questionExtractor");
const {
  academicMemoryResponseSchema,
  coMappingResponseSchema,
  examQualityResponseSchema,
  questionReviewResponseSchema,
} = require("../dist/ai/schemas/analysisResponse.schema");
const {
  applyCalculatedConfidence,
  calculateConfidence,
} = require("../dist/ai/confidence");

const explanation = {
  decision: "Ready with changes",
  reason: "The evidence shows broad alignment with one correctable gap.",
  confidence: 88,
};

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
    courseOutcomes: [{ code: "CO1", description: "Apply relational database design principles" }],
    coverage: { CO1: 90 },
    coveragePercentage: 90,
    questionCOMap: [{
      questionId: 1,
      courseOutcome: "CO1",
      strength: "STRONG",
      decision: "Mapped to CO1",
      reason: "The question directly assesses relational design.",
      confidence: 94,
    }],
    missingOutcomes: [],
    unmappedQuestionIds: [],
    issues: [],
    recommendations: [],
    explanation,
  });
  assert.equal(result.success, true);
});

test("academic memory requires a reason for every similarity match", () => {
  const result = academicMemoryResponseSchema.safeParse({
    similarQuestions: [{
      newQuestionId: 1,
      historicalQuestionId: 2,
      similarityScore: 84,
      confidence: 90,
      replacementSuggestion: "Assess query optimization instead.",
    }],
    similarityScore: 84,
    replacementSuggestion: "Assess query optimization instead.",
    explanation,
  });
  assert.equal(result.success, false);
});

test("exam quality result cannot omit its explanation", () => {
  const result = examQualityResponseSchema.safeParse({
    qualityScore: 80,
    coverage: { percentage: 80, topics: [], courseOutcomes: [] },
    difficulty: [],
    bloomDistribution: [],
    marksDistribution: [],
    scoreFactors: [{ factor: "Coverage", score: 80, weight: 100, reason: "Most topics are assessed." }],
    positivePoints: [],
    issues: [],
    recommendations: [],
  });
  assert.equal(result.success, false);
});

test("confidence is deterministic and uses all five evidence inputs", () => {
  const evidence = {
    documentCompleteness: 100,
    questionsAnalyzed: 30,
    syllabusAvailable: true,
    courseOutcomesAvailable: true,
    historicalQuestionCount: 30,
    historicalExamCount: 3,
  };
  const first = calculateConfidence(evidence);
  const second = calculateConfidence(evidence);

  assert.deepEqual(first, second);
  assert.equal(first.confidence, 100);
  assert.match(first.reason, /30 questions analyzed/);
  assert.match(first.reason, /syllabus available/);
  assert.match(first.reason, /course outcomes available/);
  assert.match(first.reason, /3 previous exams/);
});

test("server replaces model confidence and explains the evidence", () => {
  const result = applyCalculatedConfidence(
    { decision: "REVIEW", reason: "Two questions are ambiguous.", confidence: 99 },
    {
      documentCompleteness: 50,
      questionsAnalyzed: 3,
      syllabusAvailable: false,
      courseOutcomesAvailable: false,
      historicalQuestionCount: 0,
      historicalExamCount: 0,
    }
  );

  assert.equal(result.confidence, 18);
  assert.notEqual(result.confidence, 99);
  assert.match(result.reason, /Confidence 18\/100 is based on/);
});

test("question review requires decision reasoning and confidence per question", () => {
  const result = questionReviewResponseSchema.safeParse({
    qualityScore: 80,
    questions: [{ questionId: 1, clarityScore: 80, bloomLevel: "APPLY", issues: [] }],
    issues: [],
    recommendations: [],
    explanation,
  });
  assert.equal(result.success, false);
});
