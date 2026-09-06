const test = require("node:test");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

test("Database has ChatSession, ChatMessage, and CopilotContext with correct relations", async () => {
  const session = await prisma.chatSession.findFirst({
    where: { title: "Bloom's Taxonomy and CO Coverage Analysis for CSE301 Final" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      contexts: true,
      user: true,
      course: true,
      exam: true,
    },
  });

  assert.ok(session, "ChatSession should exist in database");
  assert.equal(session.title, "Bloom's Taxonomy and CO Coverage Analysis for CSE301 Final");
  assert.ok(session.userId > 0, "userId should be populated");
  assert.ok(session.courseId > 0, "courseId should be populated");
  assert.ok(session.examId > 0, "examId should be populated");

  // Check messages
  assert.equal(session.messages.length, 2, "Should have 2 seeded messages");
  assert.equal(session.messages[0].role, "USER");
  assert.equal(session.messages[1].role, "ASSISTANT");
  assert.ok(session.messages[1].aiReasoning, "Assistant message should have aiReasoning");
  assert.ok(Number(session.messages[1].confidence) > 90, "Confidence should be > 90");

  // Check contexts
  assert.equal(session.contexts.length, 4, "Should have 4 seeded context items");
  const sourceTypes = session.contexts.map((c) => c.sourceType).sort();
  assert.deepEqual(sourceTypes, ["CO Mapping", "Exam Report", "Question History", "Syllabus"].sort());

  // Check foreign key relations
  assert.equal(session.user.email, "faculty.copilot@acadiq.edu");
  assert.equal(session.course.courseCode, "CSE301");
  assert.equal(session.exam.originalName, "CSE301_Final_Exam_2026.pdf");

  await prisma.$disconnect();
});

