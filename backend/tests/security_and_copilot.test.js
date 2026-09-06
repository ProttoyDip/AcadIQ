const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { buildCopilotSystemPrompt } = require("../dist/services/copilot/prompt.service");
const { extractDocumentText, extractDocxText, extractPdfText } = require("../dist/ai/documentTextExtractor");
const { callLlmChat } = require("../dist/ai/llmClient");

test("Copilot prompt incorporates course context, questions, and report metrics", () => {
  const prompt = buildCopilotSystemPrompt({
    courseCode: "CSE301",
    courseName: "Database Systems",
    courseOutcomes: [
      { code: "CO1", description: "Design relational database schemas" },
    ],
    paperMetadata: {
      year: 2026,
      semester: "Fall",
      originalName: "midterm_exam.pdf",
    },
    questions: [
      { sequenceNumber: 1, questionText: "Define 3NF normalization.", marks: 5, bloomLevel: "Remember" },
      { sequenceNumber: 2, questionText: "Construct an ER diagram for a hospital.", marks: 15, bloomLevel: "Create" },
    ],
    reportSummary: {
      qualityScore: 84,
      positivePoints: ["Strong cognitive depth"],
      issues: ["Uneven mark allocation on question 2"],
      recommendations: ["Balance Bloom levels across Part A"],
    },
    syllabusExcerpt: "Module 1: Relational Data Models and Normal Forms.",
  });

  assert.ok(prompt.includes("CSE301 - Database Systems"));
  assert.ok(prompt.includes("[CO1]: Design relational database schemas"));
  assert.ok(prompt.includes("midterm_exam.pdf"));
  assert.ok(prompt.includes("Q1 (5 marks) [Bloom: Remember]: Define 3NF normalization."));
  assert.ok(prompt.includes("Q2 (15 marks) [Bloom: Create]: Construct an ER diagram for a hospital."));
  assert.ok(prompt.includes("84/100"));
  assert.ok(prompt.includes("Module 1: Relational Data Models"));
});

test("documentTextExtractor rejects files without valid PDF or DOCX binary signatures", async () => {
  const dummyFilePath = path.join(__dirname, "temp_fake_doc.txt");
  fs.writeFileSync(dummyFilePath, "This is just plain text, not a real PDF or DOCX file.");

  try {
    await assert.rejects(
      async () => {
        await extractDocumentText(dummyFilePath, "application/pdf");
      },
      { message: "The uploaded file is not a valid PDF" }
    );

    await assert.rejects(
      async () => {
        await extractDocumentText(dummyFilePath, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      },
      { message: "The uploaded file is not a valid DOCX" }
    );
  } finally {
    if (fs.existsSync(dummyFilePath)) {
      fs.unlinkSync(dummyFilePath);
    }
  }
});

test("Groq API copilot chat returns ultra-fast conversational response", async () => {
  const reply = await callLlmChat([
    { role: "system", content: "You are AcadIQ Copilot. Answer in one brief sentence." },
    { role: "user", content: "What is Bloom's Taxonomy?" },
  ]);

  assert.ok(typeof reply === "string");
  assert.ok(reply.length > 5);
  assert.ok(/bloom|taxonomy|cognitive|learning|framework/i.test(reply));
});

