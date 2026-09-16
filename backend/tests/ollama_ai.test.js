const test = require("node:test");
const assert = require("node:assert/strict");
const { chunkingService } = require("../dist/services/rag/chunking.service");
const { questionValidatorService } = require("../dist/services/question/questionValidator.service");
const { pdfParserService } = require("../dist/services/pdf/pdfParser.service");
const { gemmaService } = require("../dist/services/ollama/gemma.service");
const { embeddingService } = require("../dist/services/ollama/embedding.service");

test("chunkingService creates sentence-aware chunks and estimates tokens", () => {
  const sampleText = "Artificial intelligence is a branch of computer science. It aims to create systems capable of performing tasks that typically require human intelligence. Examples include visual perception, speech recognition, decision-making, and translation between languages. Machine learning is a core subset of AI.";
  const chunks = chunkingService.splitText(sampleText, { chunkSize: 120, chunkOverlap: 20 });

  assert.ok(chunks.length >= 2, "Should split text into multiple chunks");
  for (const chunk of chunks) {
    assert.ok(chunk.length >= 20, "Chunks should meet minimum length");
    const tokens = chunkingService.estimateTokens(chunk);
    assert.ok(tokens > 0, "Token count should be positive");
  }
});

test("chunkingService chunkPages tracks page numbers and section headers", () => {
  const pages = [
    { pageNumber: 1, text: "Chapter 1: Foundations of Machine Learning\nMachine learning enables computers to learn from empirical data without being explicitly programmed." },
    { pageNumber: 2, text: "Section 1.2: Supervised Learning\nSupervised learning maps an input to an output based on example input-output pairs." },
  ];

  const chunkItems = chunkingService.chunkPages(pages, { chunkSize: 200, chunkOverlap: 30 });
  assert.ok(chunkItems.length >= 2, "Should have chunks from both pages");
  assert.equal(chunkItems[0].pageNumber, 1);
  assert.ok(chunkItems.some((c) => c.pageNumber === 2));
  assert.ok(chunkItems[0].section?.includes("Chapter 1"));
});

test("questionValidatorService validates and normalizes valid question JSON", () => {
  const validData = {
    questions: [
      {
        question: "What does CNN stand for in computer vision?",
        type: "MCQ",
        difficulty: "Easy",
        options: [
          "Convolutional Neural Network",
          "Continuous Number Node",
          "Calculus Network Node",
          "Centralized Neural Network",
        ],
        correctAnswer: "Convolutional Neural Network",
        explanation: "CNN stands for Convolutional Neural Network.",
      },
      {
        question: "Is backpropagation used to calculate gradients?",
        type: "True/False",
        difficulty: "Easy",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: "Yes, backpropagation computes the gradient of the loss function.",
      },
    ],
  };

  const validated = questionValidatorService.validateQuestions(validData);
  assert.equal(validated.length, 2);
  assert.equal(validated[0].type, "MCQ");
  assert.equal(validated[0].options.length, 4);
  assert.equal(validated[1].type, "True/False");
});

test("questionValidatorService repairs raw array without questions envelope", () => {
  const rawArray = [
    {
      question: "Define overfitting in machine learning models.",
      type: "Short Answer",
      difficulty: "Medium",
      correctAnswer: "When a model learns the training data and noise too closely, failing to generalize to unseen data.",
      explanation: "High variance and low bias scenario.",
    },
  ];

  const validated = questionValidatorService.validateQuestions(rawArray);
  assert.equal(validated.length, 1);
  assert.equal(validated[0].type, "Short Answer");
  assert.ok(validated[0].question.includes("overfitting"));
});

test("pdfParserService cleanText normalizes whitespace and unicode", () => {
  const dirty = "Machine   Learning\r\n\r\n\r\n\r\nis\tpowerful.\u0000";
  const clean = pdfParserService.cleanText(dirty);
  assert.equal(clean, "Machine Learning\n\nis powerful.");
});

test("gemmaService cleanJsonResponse strips markdown code fences", () => {
  const fenced = "```json\n{\n  \"message\": \"hello\"\n}\n```";
  const cleaned = gemmaService.cleanJsonResponse(fenced);
  assert.equal(cleaned, "{\n  \"message\": \"hello\"\n}");
});

test("embeddingService roundtrips Float32Array to Buffer and computes dot product", () => {
  const vector = new Float32Array([0.5, 0.5, 0.5, 0.5]);
  const buffer = embeddingService.vectorToBuffer(vector);
  assert.equal(buffer.length, 16);

  const restored = embeddingService.bufferToVector(buffer);
  assert.equal(restored.length, 4);
  assert.ok(Math.abs(restored[0] - 0.5) < 1e-6);

  const similarity = embeddingService.similarity(vector, restored);
  assert.ok(Math.abs(similarity - 1.0) < 1e-6);
});
