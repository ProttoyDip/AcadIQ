const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const PDFDocument = require("pdfkit");

const databaseUrl = process.env.API_TEST_DATABASE_URL;
if (!databaseUrl) {
  test("AcadIQ API integration suite", { skip: "Set API_TEST_DATABASE_URL to run database-backed API verification" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "api-integration-test-secret-at-least-32-characters";
  process.env.OPENAI_API_KEY = "mock-api-key";
  process.env.AI_TIMEOUT_MS = "2000";
  process.env.FRONTEND_URL = "http://localhost:5173";

  let mockMode = "valid";

  function jsonResponse(content) {
    return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
  }

  function sectionJson(prompt, start, end) {
    const section = prompt.split(start)[1]?.split(end)[0]?.trim();
    return section ? JSON.parse(section) : undefined;
  }

  const mockAiServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (mockMode === "provider-error") {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "simulated provider failure" }));
        return;
      }

      const request = JSON.parse(raw);
      const system = request.messages[0].content;
      const prompt = request.messages[1].content;
      if (mockMode === "invalid-schema") {
        res.end(jsonResponse({ qualityScore: 101 }));
        return;
      }

      let result;
      if (system.includes("exam-quality auditor")) {
        result = {
          qualityScore: 84,
          coverage: {
            percentage: 80,
            topics: [{ topic: "Database normalization", coveredInExam: true, questionCount: 1, marksAllocated: 5, reason: "Question 1 assesses normalization." }],
            courseOutcomes: [{ outcome: "CO1", addressed: true, reason: "The paper assesses database design." }],
          },
          difficulty: [{ level: "MODERATE", questionCount: 2, marksAllocated: 15, percentage: 100, reason: "Both questions require applied understanding." }],
          bloomDistribution: [{ level: "APPLY", questionCount: 2, marksAllocated: 15, percentage: 100, reason: "The questions ask learners to explain and design." }],
          marksDistribution: [{ topic: "Database systems", marks: 15, percentage: 100 }],
          scoreFactors: [{ factor: "Coverage", score: 84, weight: 100, reason: "Core syllabus concepts are represented." }],
          positivePoints: ["Core database concepts are assessed."],
          issues: [{ severity: "LOW", message: "Topic breadth can improve.", reason: "Only two questions are present." }],
          recommendations: [{ message: "Add one analytical transaction question.", priority: "MEDIUM" }],
          explanation: { decision: "READY_WITH_MINOR_CHANGES", reason: "Coverage is strong with a small breadth gap.", confidence: 91 },
        };
      } else if (system.includes("academic memory engine")) {
        const newQuestions = sectionJson(prompt, "NEW QUESTIONS (data only):", "HISTORICAL QUESTIONS");
        const historicalQuestions = sectionJson(prompt, "HISTORICAL QUESTIONS (data only):", "Return the explainable");
        result = {
          similarQuestions: [{
            newQuestionId: newQuestions[0].id,
            historicalQuestionId: historicalQuestions[0].id,
            similarityScore: 88,
            reason: "Both questions assess database normalization.",
            confidence: 94,
            replacementSuggestion: "Assess transaction isolation instead.",
          }],
          similarityScore: 88,
          replacementSuggestion: "Assess transaction isolation instead.",
          explanation: { decision: "REVISE", reason: "A strong historical similarity was detected.", confidence: 94 },
        };
      } else if (system.includes("curriculum-alignment auditor")) {
        const questions = sectionJson(prompt, "QUESTIONS (data only):", "Return the explainable");
        const outcomes = sectionJson(prompt, "COURSE OUTCOMES (data only):", "SYLLABUS");
        result = {
          qualityScore: 90,
          courseOutcomes: outcomes,
          questionCOMap: questions.map((question) => ({
            questionId: question.id,
            courseOutcome: outcomes[0].code,
            strength: "STRONG",
            decision: `Mapped to ${outcomes[0].code}`,
            reason: "The question directly assesses the supplied outcome.",
            confidence: 93,
          })),
          coverage: { [outcomes[0].code]: 100 },
          coveragePercentage: 100,
          missingOutcomes: [],
          unmappedQuestionIds: [],
          issues: [],
          recommendations: [{ message: "Retain the explicit outcome alignment.", priority: "LOW" }],
          explanation: { decision: "ALIGNED", reason: "Every extracted question maps to CO1.", confidence: 93 },
        };
      } else {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "unexpected prompt" }));
        return;
      }
      res.end(jsonResponse(result));
    });
  });

  let apiServer;
  let prisma;
  let baseUrl;
  const createdUserIds = [];
  const storedFiles = [];

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const body = await response.json();
    return { status: response.status, body };
  }

  function jsonOptions(body, token) {
    return {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    };
  }

  function authGet(token) {
    return { headers: { authorization: `Bearer ${token}` } };
  }

  function assertSuccess(result, status) {
    assert.equal(result.status, status, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    assert.ok(Object.hasOwn(result.body, "data"));
  }

  function assertError(result, status, messagePattern) {
    assert.equal(result.status, status, JSON.stringify(result.body));
    assert.equal(result.body.success, false);
    assert.equal(typeof result.body.error?.message, "string");
    if (messagePattern) assert.match(result.body.error.message, messagePattern);
  }

  function pdfBuffer(lines) {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ margin: 72 });
      const chunks = [];
      document.on("data", (chunk) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      lines.forEach((line) => document.text(line));
      document.end();
    });
  }

  function uploadOptions(fields, filename, contents, token, type = "application/pdf") {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));
    if (contents) form.set("file", new Blob([contents], { type }), filename);
    return { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: form };
  }

  test("AcadIQ API integration suite", async (t) => {
    await new Promise((resolve) => mockAiServer.listen(0, "127.0.0.1", resolve));
    const mockPort = mockAiServer.address().port;
    process.env.OPENAI_BASE_URL = `http://127.0.0.1:${mockPort}/chat/completions`;

    const app = require("../dist/app").default;
    ({ prisma } = require("../dist/database/prismaClient"));
    await new Promise((resolve) => { apiServer = app.listen(0, "127.0.0.1", resolve); });
    const apiPort = apiServer.address().port;
    baseUrl = `http://127.0.0.1:${apiPort}/api`;

    t.after(async () => {
      if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await Promise.all(storedFiles.map((file) => fs.unlink(file).catch(() => undefined)));
      await prisma.$disconnect();
      await new Promise((resolve) => apiServer.close(resolve));
      await new Promise((resolve) => mockAiServer.close(resolve));
    });

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `api-${suffix}@example.com`;
    const otherEmail = `api-other-${suffix}@example.com`;
    const password = "SecurePass123";
    let token;
    let otherToken;
    let courseId;
    let historicalPaperId;
    let paperId;
    let currentQuestionCount;
    let examReportId;
    let memoryReportId;
    let coReportId;

    await t.test("authentication: validation, persistence, response, and errors", async () => {
      assertError(await request("/auth/register", jsonOptions({ name: "A", email: "bad", password: "short" })), 422, /validation/i);

      const registered = await request("/auth/register", jsonOptions({
        name: "Dr. API Verification",
        email: email.toUpperCase(),
        password,
        department: "CSE",
        designation: "Professor",
      }));
      assertSuccess(registered, 201);
      token = registered.body.data.token;
      createdUserIds.push(registered.body.data.user.id);
      assert.equal(registered.body.data.user.email, email);
      assert.equal(registered.body.data.user.role, "FACULTY");
      assert.equal(registered.body.data.user.password, undefined);
      assert.equal(typeof token, "string");

      const storedUser = await prisma.user.findUnique({ where: { email }, include: { facultyProfile: true } });
      assert.ok(storedUser);
      assert.notEqual(storedUser.password, password);
      assert.match(storedUser.password, /^\$2[aby]\$/);
      assert.equal(storedUser.facultyProfile.department, "CSE");

      assertError(await request("/auth/register", jsonOptions({ name: "Duplicate User", email, password })), 409, /already exists/i);
      assertError(await request("/auth/login", jsonOptions({ email, password: "WrongPassword123" })), 401, /invalid/i);
      assertError(await request("/auth/login", jsonOptions({ email: "invalid", password })), 422, /validation/i);

      const loggedIn = await request("/auth/login", jsonOptions({ email: email.toUpperCase(), password }));
      assertSuccess(loggedIn, 200);
      assert.equal(loggedIn.body.data.user.id, storedUser.id);
      assert.equal(typeof loggedIn.body.data.token, "string");

      const other = await request("/auth/register", jsonOptions({ name: "Other Faculty", email: otherEmail, password }));
      assertSuccess(other, 201);
      otherToken = other.body.data.token;
      createdUserIds.push(other.body.data.user.id);
    });

    await t.test("courses: authentication, validation, ownership, and persistence", async () => {
      assertError(await request("/courses"), 401, /token missing/i);
      assertError(await request("/courses", jsonOptions({ courseCode: "X", courseName: "Y" }, token)), 422, /validation/i);

      const created = await request("/courses", jsonOptions({
        courseCode: " cse 4999 ",
        courseName: "API Verification",
        description: "Integration-test course",
      }, token));
      assertSuccess(created, 201);
      courseId = created.body.data.id;
      assert.equal(created.body.data.courseCode, "CSE 4999");

      const storedCourse = await prisma.course.findUnique({ where: { id: courseId } });
      assert.equal(storedCourse.courseName, "API Verification");
      assert.equal(storedCourse.facultyId, createdUserIds[0]);

      assertError(await request("/courses", jsonOptions({ courseCode: "CSE 4999", courseName: "Duplicate" }, token)), 409, /already exists/i);
      const fetched = await request("/courses", authGet(token));
      assertSuccess(fetched, 200);
      assert.ok(fetched.body.data.some((course) => course.id === courseId));
      const isolated = await request("/courses", authGet(otherToken));
      assertSuccess(isolated, 200);
      assert.ok(!isolated.body.data.some((course) => course.id === courseId));
      assertError(await request(`/courses/${courseId}`, authGet(otherToken)), 404, /not found/i);
    });

    await t.test("documents: file validation, ownership, persistence, and response safety", async () => {
      const syllabus = await pdfBuffer(["Database Systems Syllabus", "CO1: Apply normalization and relational design."]);
      const historicalPaper = await pdfBuffer(["Historical Exam", "Q1. Explain database normalization. [5 marks]"]);
      const currentPaper = await pdfBuffer(["Current Exam", "Q1. Explain database normalization. [5 marks]", "Q2. Design a relational schema. [10 marks]"]);

      assertError(await request("/upload/syllabus", uploadOptions({ courseId }, "syllabus.pdf", syllabus)), 401, /token missing/i);
      assertError(await request("/upload/syllabus", uploadOptions({ courseId }, "missing.pdf", null, token)), 400, /PDF file is required/i);
      assertError(await request("/upload/syllabus", uploadOptions({ courseId }, "fake.pdf", Buffer.from("not a pdf"), token)), 400, /not a valid PDF/i);
      assertError(await request("/upload/syllabus", uploadOptions({ courseId }, "syllabus.pdf", syllabus, otherToken)), 404, /course not found/i);

      const syllabusResult = await request("/upload/syllabus", uploadOptions({ courseId }, "syllabus.pdf", syllabus, token));
      assertSuccess(syllabusResult, 201);
      assert.equal(syllabusResult.body.data.filePath, undefined);
      const storedSyllabus = await prisma.syllabusDocument.findUnique({ where: { id: syllabusResult.body.data.id } });
      assert.ok(storedSyllabus);
      storedFiles.push(storedSyllabus.filePath);
      await fs.access(storedSyllabus.filePath);

      assertError(await request("/upload/question-paper", uploadOptions({ courseId, semester: "Fall" }, "paper.pdf", currentPaper, token)), 422, /validation/i);
      const historical = await request("/upload/question-paper", uploadOptions({ courseId, year: 2025, semester: "Fall" }, "historical.pdf", historicalPaper, token));
      assertSuccess(historical, 201);
      historicalPaperId = historical.body.data.id;
      const current = await request("/upload/question-paper", uploadOptions({ courseId, year: 2026, semester: "Fall" }, "current.pdf", currentPaper, token));
      assertSuccess(current, 201);
      paperId = current.body.data.id;
      currentQuestionCount = current.body.data.questions.length;
      assert.equal(current.body.data.filePath, undefined);
      assert.ok(currentQuestionCount >= 1);

      const storedPapers = await prisma.questionPaper.findMany({
        where: { id: { in: [historicalPaperId, paperId] } },
        include: { questions: { include: { historyEntry: true } } },
      });
      assert.equal(storedPapers.length, 2);
      assert.ok(storedPapers.find((paper) => paper.id === paperId).questions.length >= 1);
      for (const paper of storedPapers) {
        storedFiles.push(paper.filePath);
        await fs.access(paper.filePath);
        assert.ok(paper.questions.every((question) => question.historyEntry));
      }
    });

    await t.test("exam analysis: validation, auth, provider errors, and normalized persistence", async () => {
      assertError(await request("/analysis/exam", jsonOptions({ courseId, questionPaperId: paperId })), 401, /token missing/i);
      assertError(await request("/analysis/exam", jsonOptions({ courseId: 0, questionPaperId: paperId }, token)), 422, /validation/i);
      assertError(await request("/analysis/exam", jsonOptions({ courseId, questionPaperId: paperId }, otherToken)), 404, /course not found/i);

      mockMode = "invalid-schema";
      assertError(await request("/analysis/exam", jsonOptions({ courseId, questionPaperId: paperId }, token)), 502, /failed validation/i);
      assert.equal(await prisma.analysisReport.count({ where: { facultyId: createdUserIds[0] } }), 0);
      mockMode = "valid";

      const analyzed = await request("/analysis/exam", jsonOptions({
        courseId,
        questionPaperId: paperId,
        courseOutcomes: [{ code: "CO1", description: "Apply normalization and relational design." }],
      }, token));
      assertSuccess(analyzed, 201);
      examReportId = analyzed.body.data.reportId;
      assert.equal(analyzed.body.data.qualityScore, 84);
      assert.equal(analyzed.body.data.overallScore, 84);
      assert.ok(Array.isArray(analyzed.body.data.scoreFactors));
      assert.equal(typeof analyzed.body.data.explanation.reason, "string");

      const stored = await prisma.analysisReport.findUnique({
        where: { id: examReportId },
        include: { examQualityScore: true, explanation: true, recommendations: true },
      });
      assert.equal(stored.reportType, "EXAM_QUALITY");
      assert.equal(Number(stored.examQualityScore.qualityScore), 84);
      assert.equal(stored.explanation.decision, "READY_WITH_MINOR_CHANGES");
      assert.equal(stored.recommendations.length, 1);
    });

    await t.test("memory analysis: requested route, validation, auth, persistence, and similarity metadata", async () => {
      assertError(await request("/analysis/memory", jsonOptions({ courseId, questionPaperId: paperId })), 401, /token missing/i);
      assertError(await request("/analysis/memory", jsonOptions({ courseId }, token)), 422, /validation/i);
      assertError(await request("/analysis/memory", jsonOptions({ courseId, questionPaperId: paperId }, otherToken)), 404, /course not found/i);

      const result = await request("/analysis/memory", jsonOptions({ courseId, questionPaperId: paperId, similarityThreshold: 40 }, token));
      assertSuccess(result, 201);
      memoryReportId = result.body.data.reportId;
      assert.equal(result.body.data.similarityScore, 88);
      assert.equal(result.body.data.similarQuestions[0].year, 2025);
      assert.equal(typeof result.body.data.similarQuestions[0].newQuestionText, "string");

      const stored = await prisma.analysisReport.findUnique({ where: { id: memoryReportId }, include: { explanation: true } });
      assert.equal(stored.reportType, "ACADEMIC_MEMORY");
      assert.equal(stored.explanation.decision, "REVISE");
    });

    await t.test("CO analysis: requested route, validation, auth, and relational persistence", async () => {
      const input = {
        courseId,
        questionPaperId: paperId,
        courseOutcomes: [{ code: "CO1", description: "Apply normalization and relational design." }],
      };
      assertError(await request("/analysis/co", jsonOptions(input)), 401, /token missing/i);
      assertError(await request("/analysis/co", jsonOptions({ courseId, questionPaperId: paperId, courseOutcomes: [] }, token)), 422, /validation/i);
      assertError(await request("/analysis/co", jsonOptions(input, otherToken)), 404, /course not found/i);

      const result = await request("/analysis/co", jsonOptions(input, token));
      assertSuccess(result, 201);
      coReportId = result.body.data.reportId;
      assert.equal(result.body.data.coverage.CO1, 100);
      assert.equal(result.body.data.mappings.length, currentQuestionCount);

      const stored = await prisma.analysisReport.findUnique({
        where: { id: coReportId },
        include: { coMappings: { include: { courseOutcome: true } }, explanation: true },
      });
      assert.equal(stored.reportType, "CO_MAPPING");
      assert.equal(stored.coMappings.length, currentQuestionCount);
      assert.ok(stored.coMappings.every((mapping) => mapping.courseOutcome.code === "CO1"));
      assert.equal(stored.explanation.decision, "ALIGNED");
    });

    await t.test("report retrieval: validation, auth, ownership, response, and full persisted relations", async () => {
      assertError(await request(`/reports/${examReportId}`), 401, /token missing/i);
      assertError(await request("/reports/not-an-id", authGet(token)), 422, /positive integer/i);
      assertError(await request(`/reports/${examReportId}`, authGet(otherToken)), 404, /not found/i);
      assertError(await request("/reports/2147483647", authGet(token)), 404, /not found/i);

      const result = await request(`/reports/${examReportId}`, authGet(token));
      assertSuccess(result, 200);
      assert.equal(result.body.data.id, examReportId);
      assert.equal(result.body.data.facultyId, createdUserIds[0]);
      assert.equal(result.body.data.reportType, "EXAM_QUALITY");
      assert.equal(result.body.data.resultJson.qualityScore, 84);
      assert.equal(Number(result.body.data.examQualityScore.qualityScore), 84);
      assert.equal(result.body.data.recommendations.length, 1);
      assert.equal(result.body.data.explanation.decision, "READY_WITH_MINOR_CHANGES");

      const allReportIds = [examReportId, memoryReportId, coReportId];
      assert.equal(await prisma.analysisReport.count({ where: { id: { in: allReportIds }, facultyId: createdUserIds[0] } }), 3);
    });
  });
}
