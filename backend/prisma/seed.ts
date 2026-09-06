import { PrismaClient, Role, ChatRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting AcadIQ Copilot database seeding...");

  // 1. Ensure Demo Faculty User exists
  const passwordHash = await bcrypt.hash("AcademicPass@2026", 10);
  const user = await prisma.user.upsert({
    where: { email: "faculty.copilot@acadiq.edu" },
    update: {},
    create: {
      name: "Dr. Sarah Jenkins",
      email: "faculty.copilot@acadiq.edu",
      password: passwordHash,
      role: Role.FACULTY,
      facultyProfile: {
        create: {
          department: "Computer Science & Engineering",
          designation: "Associate Professor",
        },
      },
    },
  });
  console.log(`👤 User verified: ${user.name} (${user.email})`);

  // 2. Ensure Demo Course exists
  const course = await prisma.course.upsert({
    where: {
      facultyId_courseCode: {
        facultyId: user.id,
        courseCode: "CSE301",
      },
    },
    update: {},
    create: {
      facultyId: user.id,
      courseCode: "CSE301",
      courseName: "Database Management Systems",
      description: "Comprehensive relational database design, SQL querying, indexing, and transaction processing.",
    },
  });
  console.log(`📚 Course verified: ${course.courseCode} - ${course.courseName}`);

  // 3. Ensure Demo Course Outcomes exist
  await prisma.courseOutcome.upsert({
    where: { courseId_code: { courseId: course.id, code: "CO1" } },
    update: {},
    create: {
      courseId: course.id,
      code: "CO1",
      description: "Design relational database schemas, normalization (3NF/BCNF), and integrity constraints.",
    },
  });
  await prisma.courseOutcome.upsert({
    where: { courseId_code: { courseId: course.id, code: "CO2" } },
    update: {},
    create: {
      courseId: course.id,
      code: "CO2",
      description: "Formulate complex relational queries and execute transaction isolation protocols.",
    },
  });
  console.log("🎯 Course Outcomes seeded (CO1, CO2)");

  // 4. Ensure Demo Question Paper exists
  let exam = await prisma.questionPaper.findFirst({
    where: { courseId: course.id, year: 2026, semester: "Fall" },
  });
  if (!exam) {
    exam = await prisma.questionPaper.create({
      data: {
        courseId: course.id,
        year: 2026,
        semester: "Fall",
        originalName: "CSE301_Final_Exam_2026.pdf",
        filePath: "uploads/seed_cse301_final.pdf",
        mimeType: "application/pdf",
        fileSize: 245760,
        questions: {
          create: [
            {
              sequenceNumber: 1,
              questionText: "Define Boyce-Codd Normal Form (BCNF) and explain differences with 3NF.",
              marks: 5,
              topic: "Normalization",
              bloomLevel: "Understand",
            },
            {
              sequenceNumber: 2,
              questionText: "Formulate SQL queries to calculate student GPA percentiles across departments.",
              marks: 10,
              topic: "SQL Queries",
              bloomLevel: "Apply",
            },
            {
              sequenceNumber: 3,
              questionText: "Design an E-R schema and convert it to relational tables for a hospital management system.",
              marks: 15,
              topic: "Relational Modeling",
              bloomLevel: "Create",
            },
          ],
        },
      },
    });
  }
  console.log(`📄 Exam Paper verified: ${exam.originalName} (ID: ${exam.id})`);

  // 5. Seed Copilot ChatSession
  // Check if session already exists for this user/course
  let session = await prisma.chatSession.findFirst({
    where: { userId: user.id, courseId: course.id, examId: exam.id },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        courseId: course.id,
        examId: exam.id,
        title: "Bloom's Taxonomy and CO Coverage Analysis for CSE301 Final",
        // Seed Copilot Context items
        contexts: {
          create: [
            {
              sourceType: "Exam Report",
              sourceId: 101,
              content: "Quality Score: 88.5/100. Strengths: High cognitive depth, clear CO alignment. Recommendation: Subdivide Q3 into progressive difficulty stages.",
            },
            {
              sourceType: "Question History",
              sourceId: 201,
              content: "Historical Similarity Match: Q1 appeared with 32% lexical overlap in Spring 2024. Safe from verbatim repetition risk.",
            },
            {
              sourceType: "CO Mapping",
              sourceId: 301,
              content: "CO1 addresses 45% (15 marks) of evaluation; CO2 addresses 55% (15 marks). Meets university curriculum compliance target.",
            },
            {
              sourceType: "Syllabus",
              sourceId: 401,
              content: "Module 1: Relational Data Models & Constraints. Module 2: Schema Normalization (1NF, 2NF, 3NF, BCNF). Module 3: Concurrency Control & Indexing.",
            },
          ],
        },
        // Seed Multi-Turn Chat Messages
        messages: {
          create: [
            {
              role: ChatRole.USER,
              content: "How balanced is the Bloom's taxonomy in this CSE301 final exam paper, and does question 3 align with CO1?",
              createdAt: new Date(Date.now() - 60000),
            },
            {
              role: ChatRole.ASSISTANT,
              content: "### Cognitive Balance & CO Alignment Assessment\n\nThe **CSE301 Final Examination (Fall 2026)** displays well-calibrated cognitive distribution across its 30 total marks:\n\n1. **Cognitive Taxonomy Breakdown**:\n   - **Understand (16.7% / 5 marks)**: [Q1] tests conceptual grounding in BCNF vs 3NF anomalies.\n   - **Apply (33.3% / 10 marks)**: [Q2] demands practical synthesis of SQL aggregate functions and windowing.\n   - **Create (50.0% / 15 marks)**: [Q3] challenges students to synthesize real-world enterprise constraints into clean relational schemas.\n\n2. **Course Outcome Alignment for Q3**:\n   - **Q3 directly aligns with CO1** (*Design relational database schemas and normal forms*).\n   - By allocating 15 marks to full schema synthesis, Q3 provides comprehensive evidence of student mastery for institutional accreditation.",
              aiReasoning: "Retrieved exam question marks [5, 10, 15], computed percentage weights, cross-referenced Bloom's taxonomy classifications against CO1 declaration, and verified against latest Exam Report strengths.",
              confidence: 94.50,
              createdAt: new Date(Date.now() - 30000),
            },
          ],
        },
      },
    });
    console.log(`💬 Seeded ChatSession: "${session.title}" (ID: ${session.id})`);
  } else {
    console.log(`💬 ChatSession already exists (ID: ${session.id})`);
  }

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

