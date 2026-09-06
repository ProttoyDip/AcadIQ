import { Prisma, Priority, ReportType } from "@prisma/client";
import { prisma } from "./prismaClient";

export async function seedDatasets() {
  console.log("Starting dataset seeding for BeSTRaP and OS Datasets (including CO Mappings and Recommendations)...");

  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.error("No faculty users found in database. Please register a user first.");
    return;
  }

  for (const user of users) {
    console.log(`\n======================================================`);
    console.log(`Seeding datasets for faculty: ${user.name} (ID: ${user.id})...`);
    console.log(`======================================================`);

    // ------------------------------------------------------------------------
    // 1. BeSTRaP Dataset Course (DBMS / Database Transactions)
    // ------------------------------------------------------------------------
    const dbmsCourse = await prisma.course.upsert({
      where: {
        facultyId_courseCode: {
          facultyId: user.id,
          courseCode: "CSE301",
        },
      },
      update: {
        courseName: "Database Systems & Transactions (BeSTRaP Dataset)",
        description:
          "Course based on Beni-Suef University BeSTRaP Dataset (doi:10.3390/data11030057) covering Database Transaction Processing, Concurrency Control, Serializability, SQL, Normalization, and Crash Recovery.",
      },
      create: {
        facultyId: user.id,
        courseCode: "CSE301",
        courseName: "Database Systems & Transactions (BeSTRaP Dataset)",
        description:
          "Course based on Beni-Suef University BeSTRaP Dataset (doi:10.3390/data11030057) covering Database Transaction Processing, Concurrency Control, Serializability, SQL, Normalization, and Crash Recovery.",
      },
    });

    // DBMS Course Outcomes
    const dbmsCODefs = [
      { code: "CO1", description: "Understand transaction processing fundamentals, ACID properties, and execution schedules." },
      { code: "CO2", description: "Analyze serializability and concurrency control protocols including 2PL and Timestamp Ordering." },
      { code: "CO3", description: "Evaluate crash recovery mechanisms (ARIES, WAL) and index structures for database performance." },
      { code: "CO4", description: "Apply normalization theory to decompose relational schemas up to 3NF and BCNF." },
    ];

    const dbmsCOMap = new Map<string, number>();
    for (const co of dbmsCODefs) {
      const outcome = await prisma.courseOutcome.upsert({
        where: {
          courseId_code: {
            courseId: dbmsCourse.id,
            code: co.code,
          },
        },
        update: { description: co.description },
        create: {
          courseId: dbmsCourse.id,
          code: co.code,
          description: co.description,
        },
      });
      dbmsCOMap.set(outcome.code, outcome.id);
    }

    // DBMS Midterm Paper
    let dbmsMidterm = await prisma.questionPaper.findFirst({
      where: { courseId: dbmsCourse.id, originalName: "BeSTRaP_DBMS_Midterm_Exam_2024.pdf" },
      include: { questions: true },
    });

    if (!dbmsMidterm) {
      dbmsMidterm = await prisma.questionPaper.create({
        data: {
          courseId: dbmsCourse.id,
          year: 2024,
          semester: "Spring 2024",
          originalName: "BeSTRaP_DBMS_Midterm_Exam_2024.pdf",
          filePath: "uploads/bestrap_dbms_midterm_2024.pdf",
          mimeType: "application/pdf",
          fileSize: 204800,
          questions: {
            create: [
              {
                sequenceNumber: 1,
                questionText:
                  "Explain the ACID properties of a Database Transaction Management System. Provide concrete transaction scenarios illustrating how Atomicity and Isolation are maintained during system failures and concurrent execution.",
                marks: 10,
                topic: "Transaction Processing & ACID",
                bloomLevel: "Comprehension",
              },
              {
                sequenceNumber: 2,
                questionText:
                  "Given the concurrent execution schedule S: r1(X), w1(X), r2(X), r2(Y), w2(Y), w1(Y). Draw the precedence graph for schedule S, determine whether S is conflict serializable, and find an equivalent serial schedule if one exists.",
                marks: 15,
                topic: "Serializability & Concurrency",
                bloomLevel: "Analysis",
              },
              {
                sequenceNumber: 3,
                questionText:
                  "Differentiate between Strict Two-Phase Locking (Strict 2PL) and Rigorous Two-Phase Locking (Rigorous 2PL). Explain how each protocol guarantees freedom from cascading aborts/rollbacks.",
                marks: 10,
                topic: "Concurrency Control & 2PL",
                bloomLevel: "Analysis",
              },
              {
                sequenceNumber: 4,
                questionText:
                  "Describe the Wait-For Graph (WFG) method for deadlock detection in database transactions. Discuss deadlock prevention strategies including Wait-Die and Wound-Wait schemes.",
                marks: 10,
                topic: "Deadlock Management",
                bloomLevel: "Application",
              },
              {
                sequenceNumber: 5,
                questionText:
                  "Explain B+ Tree indexing structure. Compare clustered indexing versus non-clustered indexing in relational database optimization and query execution.",
                marks: 15,
                topic: "Indexing & Storage",
                bloomLevel: "Evaluation",
              },
            ],
          },
        },
        include: { questions: true },
      });
    }

    // Populate QuestionHistory for DBMS Midterm
    for (const q of dbmsMidterm.questions) {
      await prisma.questionHistory.upsert({
        where: { sourceQuestionId: q.id },
        update: {
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
        create: {
          courseId: dbmsCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // DBMS Final Paper
    let dbmsFinal = await prisma.questionPaper.findFirst({
      where: { courseId: dbmsCourse.id, originalName: "BeSTRaP_DBMS_Final_Exam_2024.pdf" },
      include: { questions: true },
    });

    if (!dbmsFinal) {
      dbmsFinal = await prisma.questionPaper.create({
        data: {
          courseId: dbmsCourse.id,
          year: 2024,
          semester: "Spring 2024",
          originalName: "BeSTRaP_DBMS_Final_Exam_2024.pdf",
          filePath: "uploads/bestrap_dbms_final_2024.pdf",
          mimeType: "application/pdf",
          fileSize: 312000,
          questions: {
            create: [
              {
                sequenceNumber: 1,
                questionText:
                  "Analyze 3rd Normal Form (3NF) vs Boyce-Codd Normal Form (BCNF) schema decomposition. Prove why functional dependency preservation is always guaranteed in 3NF but not always achievable in BCNF.",
                marks: 15,
                topic: "Schema Normalization",
                bloomLevel: "Synthesis",
              },
              {
                sequenceNumber: 2,
                questionText:
                  "Explain the ARIES crash recovery algorithm in DBMS. Detail the three main passes: Analysis, Redo, and Undo, and describe how Write-Ahead Logging (WAL) ensures durability.",
                marks: 15,
                topic: "Crash Recovery & Logging",
                bloomLevel: "Comprehension",
              },
              {
                sequenceNumber: 3,
                questionText:
                  "Compare SQL Transaction Isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable). Explain Dirty Reads, Non-Repeatable Reads, and Phantom Reads with examples.",
                marks: 20,
                topic: "SQL Isolation Levels",
                bloomLevel: "Application",
              },
            ],
          },
        },
        include: { questions: true },
      });
    }

    // Populate QuestionHistory for DBMS Final
    for (const q of dbmsFinal.questions) {
      await prisma.questionHistory.upsert({
        where: { sourceQuestionId: q.id },
        update: {
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
        create: {
          courseId: dbmsCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // Rubric & Sample Student Answers for DBMS
    let dbmsRubric = await prisma.rubric.findFirst({
      where: { courseId: dbmsCourse.id, createdById: user.id },
    });
    if (!dbmsRubric) {
      dbmsRubric = await prisma.rubric.create({
        data: {
          courseId: dbmsCourse.id,
          createdById: user.id,
          name: "DBMS Transaction & Concurrency Grading Rubric",
          description: "Evaluation rubric for ACID properties, serializability graphs, and locking mechanisms.",
          maxScore: 10,
          criteria: [
            { name: "Concept Accuracy", weight: 0.4, description: "Correct definition of ACID properties and 2PL locking protocols." },
            { name: "Technical Rigor", weight: 0.4, description: "Accurate precedence graph construction and conflict analysis." },
            { name: "Clarity & Examples", weight: 0.2, description: "Clear concrete examples illustrating isolation levels and abort handling." },
          ],
        },
      });
    }

    const q1 = dbmsMidterm.questions.find((q) => q.sequenceNumber === 1);
    if (q1) {
      const existingAnswers = await prisma.studentAnswer.findMany({ where: { questionId: q1.id } });
      if (existingAnswers.length === 0) {
        await prisma.studentAnswer.createMany({
          data: [
            {
              questionId: q1.id,
              rubricId: dbmsRubric.id,
              studentIdentifier: "STUDENT_DBMS_001",
              answerText:
                "ACID stands for Atomicity, Consistency, Isolation, and Durability. Atomicity ensures all operations in a transaction succeed or all fail (all-or-nothing). Isolation ensures concurrent transactions do not interfere with each other, using locking mechanisms like 2PL.",
              score: 9.5,
              feedback: { summary: "Excellent explanation of Atomicity and Isolation with accurate transaction context." },
            },
            {
              questionId: q1.id,
              rubricId: dbmsRubric.id,
              studentIdentifier: "STUDENT_DBMS_002",
              answerText:
                "Atomicity means the transaction is atomic and cannot be divided. Isolation means transactions run isolated. For example if T1 writes X and T2 reads X, isolation prevents dirty read.",
              score: 7.0,
              feedback: { summary: "Good response but missing details on failure recovery mechanisms for atomicity." },
            },
          ],
        });
      }
    }

    // ------------------------------------------------------------------------
    // Seed Question CO Mappings & Recommendations: DBMS Midterm
    // ------------------------------------------------------------------------
    console.log(`Seeding Question CO Mappings & Recommendations for DBMS Midterm...`);
    const dbmsMidtermQuestions = await prisma.question.findMany({
      where: { paperId: dbmsMidterm.id },
      orderBy: { sequenceNumber: "asc" },
    });

    const dbmsMidtermMappings = [
      {
        sequenceNumber: 1,
        outcomeCode: "CO1",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly assesses transaction processing fundamentals and ACID recovery and isolation mechanics under failures.",
        confidence: 95.0,
      },
      {
        sequenceNumber: 2,
        outcomeCode: "CO2",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Requires precedence graph construction and conflict serializability equivalence proofs.",
        confidence: 96.0,
      },
      {
        sequenceNumber: 3,
        outcomeCode: "CO2",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly evaluates 2PL locking protocols and concurrency control guarantees against cascading rollbacks.",
        confidence: 94.0,
      },
      {
        sequenceNumber: 4,
        outcomeCode: "CO2",
        strength: "MODERATE",
        decision: "MAPPED",
        reason: "Evaluates transaction deadlock handling and timestamp-based deadlock prevention protocols.",
        confidence: 91.0,
      },
      {
        sequenceNumber: 5,
        outcomeCode: "CO3",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly examines index structures (B+ tree, clustered vs non-clustered) for storage and query performance.",
        confidence: 95.0,
      },
    ];

    const dbmsMidtermRecommendations = [
      {
        message: "Increase assessment coverage for CO4 (Relational Normalization) in midterm assignments to identify schema design weaknesses before the final exam.",
        priority: Priority.HIGH,
      },
      {
        message: "Include a practical SQL execution problem involving concurrency anomalies alongside theoretical serializability proofs.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Incorporate multi-version concurrency control (MVCC) questions to bridge classical 2PL locking with modern industrial database engines.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Provide benchmark performance datasets for B+ tree vs Hash index comparisons to strengthen storage evaluation.",
        priority: Priority.LOW,
      },
    ];

    let dbmsMidtermCoReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: dbmsCourse.id,
        questionPaperId: dbmsMidterm.id,
        reportType: ReportType.CO_MAPPING,
      },
    });

    const dbmsMidtermCoResultJson = {
      qualityScore: 86,
      courseOutcomes: dbmsCODefs,
      questionCOMap: dbmsMidtermMappings.map((m) => {
        const q = dbmsMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          decision: m.decision,
          reason: m.reason,
          confidence: m.confidence,
        };
      }),
      mappings: dbmsMidtermMappings.map((m) => {
        const q = dbmsMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          rationale: m.reason,
        };
      }),
      coverage: { CO1: 100, CO2: 100, CO3: 100, CO4: 0 },
      coveragePercentage: 75,
      missingOutcomes: ["CO4"],
      unmappedQuestionIds: [],
      issues: [
        {
          severity: "HIGH",
          message: "CO4 (Relational Normalization) has 0% coverage in the Midterm examination.",
        },
      ],
      recommendations: dbmsMidtermRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "Exam adequately covers transactions (CO1), concurrency control (CO2), and storage indexing (CO3), but omits normalization theory (CO4).",
        reason: "All 5 questions mapped with high AI confidence (>0.90). CO4 requires formative evaluation prior to final exams.",
        confidence: 94.0,
      },
    };

    if (!dbmsMidtermCoReport) {
      dbmsMidtermCoReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: dbmsCourse.id,
          questionPaperId: dbmsMidterm.id,
          reportType: ReportType.CO_MAPPING,
          resultJson: dbmsMidtermCoResultJson as Prisma.InputJsonValue,
          explanation: {
            create: {
              module: "CO_MAPPING",
              decision: dbmsMidtermCoResultJson.explanation.decision,
              reason: dbmsMidtermCoResultJson.explanation.reason,
              confidence: dbmsMidtermCoResultJson.explanation.confidence,
            },
          },
        },
      });
    }

    // Insert Question CO Mappings for DBMS Midterm
    for (const m of dbmsMidtermMappings) {
      const q = dbmsMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber);
      const coId = dbmsCOMap.get(m.outcomeCode);
      if (q && coId) {
        await prisma.questionCOMapping.upsert({
          where: {
            reportId_questionId_courseOutcomeId: {
              reportId: dbmsMidtermCoReport.id,
              questionId: q.id,
              courseOutcomeId: coId,
            },
          },
          update: {
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
          create: {
            reportId: dbmsMidtermCoReport.id,
            questionId: q.id,
            courseOutcomeId: coId,
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
        });
      }
    }

    // Insert Recommendations for DBMS Midterm CO Mapping
    const existingDbmsMidtermRecs = await prisma.recommendation.findMany({
      where: { reportId: dbmsMidtermCoReport.id },
    });
    if (existingDbmsMidtermRecs.length === 0) {
      await prisma.recommendation.createMany({
        data: dbmsMidtermRecommendations.map((r) => ({
          reportId: dbmsMidtermCoReport.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }

    // ------------------------------------------------------------------------
    // Seed Exam Quality Report: DBMS Midterm
    // ------------------------------------------------------------------------
    let dbmsMidtermExamReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: dbmsCourse.id,
        questionPaperId: dbmsMidterm.id,
        reportType: ReportType.EXAM_QUALITY,
      },
    });

    const dbmsExamQualityRecommendations = [
      { message: "Include at least one design question on schema normalization to ensure holistic topic coverage.", priority: Priority.HIGH },
      { message: "Cognitive distribution is healthy with 50% analytical rigor (Analysis/Evaluation).", priority: Priority.LOW },
      { message: "Consider adding scenario-based locking questions for transaction isolation testing.", priority: Priority.MEDIUM },
    ];

    const dbmsExamQualityResultJson = {
      overallScore: 88,
      qualityScore: 88,
      topicCoverage: [
        { topic: "Transaction Processing & ACID", coveredInExam: true, questionCount: 1, marksAllocated: 10, reason: "ACID properties and isolation" },
        { topic: "Serializability & Concurrency", coveredInExam: true, questionCount: 1, marksAllocated: 15, reason: "Precedence graph conflict analysis" },
        { topic: "Concurrency Control & 2PL", coveredInExam: true, questionCount: 1, marksAllocated: 10, reason: "Strict vs Rigorous 2PL" },
        { topic: "Deadlock Management", coveredInExam: true, questionCount: 1, marksAllocated: 10, reason: "Wait-For Graph & Wait-Die schemes" },
        { topic: "Indexing & Storage", coveredInExam: true, questionCount: 1, marksAllocated: 15, reason: "B+ Tree index structures" },
      ],
      difficulty: [
        { level: "EASY", questionCount: 1, marksAllocated: 10, percentage: 17, reason: "Conceptual recall on ACID" },
        { level: "MODERATE", questionCount: 2, marksAllocated: 20, percentage: 33, reason: "Algorithm application on deadlocks & 2PL" },
        { level: "HARD", questionCount: 2, marksAllocated: 30, percentage: 50, reason: "Complex schedule serializability & index evaluation" },
      ],
      bloomDistribution: [
        { level: "COMPREHENSION", questionCount: 1, marksAllocated: 10, percentage: 17, reason: "ACID explanation" },
        { level: "ANALYSIS", questionCount: 2, marksAllocated: 25, percentage: 42, reason: "Precedence graph & 2PL comparison" },
        { level: "APPLICATION", questionCount: 1, marksAllocated: 10, percentage: 17, reason: "Deadlock prevention schemes" },
        { level: "EVALUATION", questionCount: 1, marksAllocated: 15, percentage: 24, reason: "Index performance evaluation" },
      ],
      marksDistribution: [
        { topic: "Serializability & Concurrency", marks: 15, percentage: 25 },
        { topic: "Indexing & Storage", marks: 15, percentage: 25 },
        { topic: "Transaction Processing & ACID", marks: 10, percentage: 16.7 },
        { topic: "Concurrency Control & 2PL", marks: 10, percentage: 16.7 },
        { topic: "Deadlock Management", marks: 10, percentage: 16.7 },
      ],
      scoreFactors: [
        { factor: "Topic Coverage", score: 85, weight: 30, reason: "5 major syllabus topics assessed effectively" },
        { factor: "Cognitive Balance", score: 90, weight: 35, reason: "Balanced Bloom taxonomy without excessive recall" },
        { factor: "Course Outcome Alignment", score: 88, weight: 35, reason: "Strong alignment across CO1, CO2, and CO3" },
      ],
      positivePoints: [
        "Rigorous technical questions on conflict serializability.",
        "Excellent mark allocation reflecting depth of topics.",
        "Clear rubric criteria established for grading.",
      ],
      issues: [
        { severity: "MEDIUM", message: "Relational normalization not assessed in midterm.", reason: "Saved for final paper." },
      ],
      learningOutcomeAlignment: [
        { outcome: "CO1", addressed: true },
        { outcome: "CO2", addressed: true },
        { outcome: "CO3", addressed: true },
        { outcome: "CO4", addressed: false },
      ],
      recommendations: dbmsExamQualityRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "High quality midterm examination with strong analytical rigor in transaction processing.",
        reason: "Balanced distribution across Bloom levels (Comprehension to Evaluation) with clear mark allocations.",
        confidence: 93.0,
      },
    };

    if (!dbmsMidtermExamReport) {
      dbmsMidtermExamReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: dbmsCourse.id,
          questionPaperId: dbmsMidterm.id,
          reportType: ReportType.EXAM_QUALITY,
          resultJson: dbmsExamQualityResultJson as Prisma.InputJsonValue,
          examQualityScore: {
            create: {
              qualityScore: 88.0,
              scoreFactors: dbmsExamQualityResultJson.scoreFactors as unknown as Prisma.InputJsonValue,
              positivePoints: dbmsExamQualityResultJson.positivePoints as Prisma.InputJsonValue,
              issues: dbmsExamQualityResultJson.issues as unknown as Prisma.InputJsonValue,
              recommendations: dbmsExamQualityResultJson.recommendations as unknown as Prisma.InputJsonValue,
              confidenceScore: 93.0,
            },
          },
          explanation: {
            create: {
              module: "EXAM_QUALITY",
              decision: dbmsExamQualityResultJson.explanation.decision,
              reason: dbmsExamQualityResultJson.explanation.reason,
              confidence: dbmsExamQualityResultJson.explanation.confidence,
            },
          },
        },
      });

      const report = dbmsMidtermExamReport!;
      await prisma.recommendation.createMany({
        data: dbmsExamQualityRecommendations.map((r) => ({
          reportId: report.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }

    // ------------------------------------------------------------------------
    // Seed Question CO Mappings & Recommendations: DBMS Final
    // ------------------------------------------------------------------------
    console.log(`Seeding Question CO Mappings & Recommendations for DBMS Final...`);
    const dbmsFinalQuestions = await prisma.question.findMany({
      where: { paperId: dbmsFinal.id },
      orderBy: { sequenceNumber: "asc" },
    });

    const dbmsFinalMappings = [
      {
        sequenceNumber: 1,
        outcomeCode: "CO4",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly evaluates relational normalization theory, 3NF synthesis, and BCNF dependency preservation limits.",
        confidence: 97.0,
      },
      {
        sequenceNumber: 2,
        outcomeCode: "CO3",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "In-depth evaluation of database crash recovery mechanisms including ARIES passes and WAL durability.",
        confidence: 96.0,
      },
      {
        sequenceNumber: 3,
        outcomeCode: "CO1",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Evaluates transaction isolation levels and concurrency phenomena according to ACID standards.",
        confidence: 93.0,
      },
    ];

    const dbmsFinalRecommendations = [
      {
        message: "Incorporate distributed transaction recovery (2PC) to extend ARIES recovery concepts to distributed architectures.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Add decomposition synthesis problems requiring lossless join and dependency preservation verification.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Ensure CO2 (Concurrency Control & 2PL) maintains coverage in the final examination.",
        priority: Priority.HIGH,
      },
    ];

    let dbmsFinalCoReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: dbmsCourse.id,
        questionPaperId: dbmsFinal.id,
        reportType: ReportType.CO_MAPPING,
      },
    });

    const dbmsFinalCoResultJson = {
      qualityScore: 90,
      courseOutcomes: dbmsCODefs,
      questionCOMap: dbmsFinalMappings.map((m) => {
        const q = dbmsFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          decision: m.decision,
          reason: m.reason,
          confidence: m.confidence,
        };
      }),
      mappings: dbmsFinalMappings.map((m) => {
        const q = dbmsFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          rationale: m.reason,
        };
      }),
      coverage: { CO1: 100, CO2: 0, CO3: 100, CO4: 100 },
      coveragePercentage: 75,
      missingOutcomes: ["CO2"],
      unmappedQuestionIds: [],
      issues: [
        {
          severity: "MEDIUM",
          message: "CO2 (Concurrency Control) was thoroughly tested in Midterm but is omitted from Final.",
        },
      ],
      recommendations: dbmsFinalRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "Final exam heavily targets high-level synthesis: schema normalization (CO4), crash recovery (CO3), and isolation (CO1).",
        reason: "All 3 comprehensive questions mapped to their respective outcomes with >93% AI confidence.",
        confidence: 95.0,
      },
    };

    if (!dbmsFinalCoReport) {
      dbmsFinalCoReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: dbmsCourse.id,
          questionPaperId: dbmsFinal.id,
          reportType: ReportType.CO_MAPPING,
          resultJson: dbmsFinalCoResultJson as Prisma.InputJsonValue,
          explanation: {
            create: {
              module: "CO_MAPPING",
              decision: dbmsFinalCoResultJson.explanation.decision,
              reason: dbmsFinalCoResultJson.explanation.reason,
              confidence: dbmsFinalCoResultJson.explanation.confidence,
            },
          },
        },
      });
    }

    for (const m of dbmsFinalMappings) {
      const q = dbmsFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber);
      const coId = dbmsCOMap.get(m.outcomeCode);
      if (q && coId) {
        await prisma.questionCOMapping.upsert({
          where: {
            reportId_questionId_courseOutcomeId: {
              reportId: dbmsFinalCoReport.id,
              questionId: q.id,
              courseOutcomeId: coId,
            },
          },
          update: {
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
          create: {
            reportId: dbmsFinalCoReport.id,
            questionId: q.id,
            courseOutcomeId: coId,
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
        });
      }
    }

    const existingDbmsFinalRecs = await prisma.recommendation.findMany({
      where: { reportId: dbmsFinalCoReport.id },
    });
    if (existingDbmsFinalRecs.length === 0) {
      await prisma.recommendation.createMany({
        data: dbmsFinalRecommendations.map((r) => ({
          reportId: dbmsFinalCoReport.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }

    // ------------------------------------------------------------------------
    // 2. OS Dataset Course (Operating Systems)
    // ------------------------------------------------------------------------
    const osCourse = await prisma.course.upsert({
      where: {
        facultyId_courseCode: {
          facultyId: user.id,
          courseCode: "CSE302",
        },
      },
      update: {
        courseName: "Operating Systems (CityU HK Dataset)",
        description:
          "Course based on City University of Hong Kong OS Open Dataset (arXiv:2405.19694) covering Process Management, CPU Scheduling, Semaphores, Memory Management, Page Replacement, and File Systems.",
      },
      create: {
        facultyId: user.id,
        courseCode: "CSE302",
        courseName: "Operating Systems (CityU HK Dataset)",
        description:
          "Course based on City University of Hong Kong OS Open Dataset (arXiv:2405.19694) covering Process Management, CPU Scheduling, Semaphores, Memory Management, Page Replacement, and File Systems.",
      },
    });

    // OS Course Outcomes
    const osCODefs = [
      { code: "CO1", description: "Analyze process scheduling algorithms, turn-around times, and context switching." },
      { code: "CO2", description: "Evaluate virtual memory architectures, paging, and page replacement algorithms." },
      { code: "CO3", description: "Apply POSIX semaphores, mutexes, and locks to prevent race conditions and deadlocks." },
      { code: "CO4", description: "Understand file system allocation schemes (Inodes), disk scheduling, and I/O management." },
    ];

    const osCOMap = new Map<string, number>();
    for (const co of osCODefs) {
      const outcome = await prisma.courseOutcome.upsert({
        where: {
          courseId_code: {
            courseId: osCourse.id,
            code: co.code,
          },
        },
        update: { description: co.description },
        create: {
          courseId: osCourse.id,
          code: co.code,
          description: co.description,
        },
      });
      osCOMap.set(outcome.code, outcome.id);
    }

    // OS Midterm Paper
    let osMidterm = await prisma.questionPaper.findFirst({
      where: { courseId: osCourse.id, originalName: "CityU_OS_Midterm_Exam_2024.pdf" },
      include: { questions: true },
    });

    if (!osMidterm) {
      osMidterm = await prisma.questionPaper.create({
        data: {
          courseId: osCourse.id,
          year: 2024,
          semester: "Spring 2024",
          originalName: "CityU_OS_Midterm_Exam_2024.pdf",
          filePath: "uploads/cityu_os_midterm_2024.pdf",
          mimeType: "application/pdf",
          fileSize: 198000,
          questions: {
            create: [
              {
                sequenceNumber: 1,
                questionText:
                  "Consider three processes P1, P2, and P3 arriving at time t=0 with CPU burst times of 8ms, 4ms, and 2ms respectively. Calculate average waiting time and turnaround time for Shortest Job First (SJF) non-preemptive vs Round Robin (time quantum = 3ms).",
                marks: 15,
                topic: "CPU Scheduling",
                bloomLevel: "Application",
              },
              {
                sequenceNumber: 2,
                questionText:
                  "Implement a thread-safe solution to the Producer-Consumer Bounded Buffer Problem using POSIX counting semaphores (empty, full) and a mutex lock in C/C++ pseudo-code.",
                marks: 15,
                topic: "Process Synchronization & Semaphores",
                bloomLevel: "Synthesis",
              },
              {
                sequenceNumber: 3,
                questionText:
                  "Explain the fundamental architectural differences between User-Level Threads (ULT) and Kernel-Level Threads (KLT). Discuss context switching overhead and blocking behavior in both models.",
                marks: 10,
                topic: "Threads & Concurrency",
                bloomLevel: "Comprehension",
              },
              {
                sequenceNumber: 4,
                questionText:
                  "Illustrate the First Readers-Writers Problem using semaphores. Explain how writer starvation can occur and how it can be mitigated using a fair queueing semaphore approach.",
                marks: 10,
                topic: "Synchronization Anomalies",
                bloomLevel: "Analysis",
              },
            ],
          },
        },
        include: { questions: true },
      });
    }

    for (const q of osMidterm.questions) {
      await prisma.questionHistory.upsert({
        where: { sourceQuestionId: q.id },
        update: {
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
        create: {
          courseId: osCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // OS Final Paper
    let osFinal = await prisma.questionPaper.findFirst({
      where: { courseId: osCourse.id, originalName: "CityU_OS_Final_Exam_2024.pdf" },
      include: { questions: true },
    });

    if (!osFinal) {
      osFinal = await prisma.questionPaper.create({
        data: {
          courseId: osCourse.id,
          year: 2024,
          semester: "Spring 2024",
          originalName: "CityU_OS_Final_Exam_2024.pdf",
          filePath: "uploads/cityu_os_final_2024.pdf",
          mimeType: "application/pdf",
          fileSize: 285000,
          questions: {
            create: [
              {
                sequenceNumber: 1,
                questionText:
                  "Given reference string 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1 with 3 physical memory frames, calculate total page faults for FIFO, Least Recently Used (LRU), and Optimal Page Replacement.",
                marks: 20,
                topic: "Virtual Memory & Page Replacement",
                bloomLevel: "Evaluation",
              },
              {
                sequenceNumber: 2,
                questionText:
                  "Describe logical to physical address translation in a 2-level paging system. Explain the role and hit ratio impact of Translation Lookaside Buffer (TLB) on Effective Access Time (EAT).",
                marks: 15,
                topic: "Memory Paging & TLB",
                bloomLevel: "Analysis",
              },
              {
                sequenceNumber: 3,
                questionText:
                  "Compare Indexed File Allocation (Inodes in UNIX/Linux) with Contiguous Allocation. Evaluate disk space utilization, file growth flexibility, and random access performance.",
                marks: 15,
                topic: "File Systems & Disks",
                bloomLevel: "Analysis",
              },
            ],
          },
        },
        include: { questions: true },
      });
    }

    for (const q of osFinal.questions) {
      await prisma.questionHistory.upsert({
        where: { sourceQuestionId: q.id },
        update: {
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
        create: {
          courseId: osCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // OS Rubric & Student Answers
    let osRubric = await prisma.rubric.findFirst({
      where: { courseId: osCourse.id, createdById: user.id },
    });
    if (!osRubric) {
      osRubric = await prisma.rubric.create({
        data: {
          courseId: osCourse.id,
          createdById: user.id,
          name: "OS Synchronization & Scheduling Rubric",
          description: "Evaluation rubric for CPU Gantt charts, semaphore code correctness, and page fault calculations.",
          maxScore: 15,
          criteria: [
            { name: "Algorithm Calculation", weight: 0.5, description: "Correct computation of waiting times, turnaround times, and page fault counts." },
            { name: "Code & Semaphore Correctness", weight: 0.3, description: "Proper wait() and signal() semaphore calls preventing race conditions." },
            { name: "Analysis & Clarity", weight: 0.2, description: "Clear explanation of thread models and memory translation." },
          ],
        },
      });
    }

    const osQ1 = osMidterm.questions.find((q) => q.sequenceNumber === 1);
    if (osQ1) {
      const existingAnswers = await prisma.studentAnswer.findMany({ where: { questionId: osQ1.id } });
      if (existingAnswers.length === 0) {
        await prisma.studentAnswer.createMany({
          data: [
            {
              questionId: osQ1.id,
              rubricId: osRubric.id,
              studentIdentifier: "STUDENT_OS_001",
              answerText:
                "SJF Non-preemptive execution order: P3 (2ms), P2 (4ms), P1 (8ms). P3 finish t=2, P2 finish t=6, P1 finish t=14. Waiting time: P3=0, P2=2, P1=6. Avg waiting time = (0+2+6)/3 = 2.67ms. For Round Robin (q=3): P1(3)->P2(3)->P3(2)->P1(3)->P2(1)->P1(2). Avg waiting time calculation attached.",
              score: 14.0,
              feedback: { summary: "Accurate Gantt chart and waiting time calculations for both SJF and Round Robin." },
            },
          ],
        });
      }
    }

    // ------------------------------------------------------------------------
    // Seed Question CO Mappings & Recommendations: OS Midterm
    // ------------------------------------------------------------------------
    console.log(`Seeding Question CO Mappings & Recommendations for OS Midterm...`);
    const osMidtermQuestions = await prisma.question.findMany({
      where: { paperId: osMidterm.id },
      orderBy: { sequenceNumber: "asc" },
    });

    const osMidtermMappings = [
      {
        sequenceNumber: 1,
        outcomeCode: "CO1",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly calculates process turnaround and waiting times under preemptive (RR) and non-preemptive (SJF) scheduling.",
        confidence: 96.0,
      },
      {
        sequenceNumber: 2,
        outcomeCode: "CO3",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Requires implementation of POSIX semaphores and mutexes to achieve race-condition-free process synchronization.",
        confidence: 95.0,
      },
      {
        sequenceNumber: 3,
        outcomeCode: "CO1",
        strength: "MODERATE",
        decision: "MAPPED",
        reason: "Examines thread models and context switching cost differences in processor execution.",
        confidence: 89.0,
      },
      {
        sequenceNumber: 4,
        outcomeCode: "CO3",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Analyzes classical concurrency synchronization anomalies and starvation prevention using semaphores.",
        confidence: 94.0,
      },
    ];

    const osMidtermRecommendations = [
      {
        message: "Include multi-threaded synchronization trace scenarios with deadlocks to enhance CO3 practical problem-solving.",
        priority: Priority.HIGH,
      },
      {
        message: "Balance recall-based thread architecture questions with quantitative context-switching overhead calculations.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Add introductory virtual memory concepts (paging, address translation) to ensure early CO2 feedback before finals.",
        priority: Priority.HIGH,
      },
      {
        message: "Introduce POSIX condition variables alongside semaphores to demonstrate monitor semantics.",
        priority: Priority.LOW,
      },
    ];

    let osMidtermCoReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: osCourse.id,
        questionPaperId: osMidterm.id,
        reportType: ReportType.CO_MAPPING,
      },
    });

    const osMidtermCoResultJson = {
      qualityScore: 85,
      courseOutcomes: osCODefs,
      questionCOMap: osMidtermMappings.map((m) => {
        const q = osMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          decision: m.decision,
          reason: m.reason,
          confidence: m.confidence,
        };
      }),
      mappings: osMidtermMappings.map((m) => {
        const q = osMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          rationale: m.reason,
        };
      }),
      coverage: { CO1: 100, CO2: 0, CO3: 100, CO4: 0 },
      coveragePercentage: 50,
      missingOutcomes: ["CO2", "CO4"],
      unmappedQuestionIds: [],
      issues: [
        {
          severity: "HIGH",
          message: "Virtual Memory (CO2) and File Systems (CO4) have 0% coverage in the Midterm examination.",
        },
      ],
      recommendations: osMidtermRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "Midterm thoroughly tests CPU scheduling (CO1) and semaphore synchronization (CO3). Virtual memory & file systems deferred to final.",
        reason: "Strong code synthesis and application questions mapped with high confidence (>0.90).",
        confidence: 93.0,
      },
    };

    if (!osMidtermCoReport) {
      osMidtermCoReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: osCourse.id,
          questionPaperId: osMidterm.id,
          reportType: ReportType.CO_MAPPING,
          resultJson: osMidtermCoResultJson as Prisma.InputJsonValue,
          explanation: {
            create: {
              module: "CO_MAPPING",
              decision: osMidtermCoResultJson.explanation.decision,
              reason: osMidtermCoResultJson.explanation.reason,
              confidence: osMidtermCoResultJson.explanation.confidence,
            },
          },
        },
      });
    }

    for (const m of osMidtermMappings) {
      const q = osMidtermQuestions.find((item) => item.sequenceNumber === m.sequenceNumber);
      const coId = osCOMap.get(m.outcomeCode);
      if (q && coId) {
        await prisma.questionCOMapping.upsert({
          where: {
            reportId_questionId_courseOutcomeId: {
              reportId: osMidtermCoReport.id,
              questionId: q.id,
              courseOutcomeId: coId,
            },
          },
          update: {
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
          create: {
            reportId: osMidtermCoReport.id,
            questionId: q.id,
            courseOutcomeId: coId,
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
        });
      }
    }

    const existingOsMidtermRecs = await prisma.recommendation.findMany({
      where: { reportId: osMidtermCoReport.id },
    });
    if (existingOsMidtermRecs.length === 0) {
      await prisma.recommendation.createMany({
        data: osMidtermRecommendations.map((r) => ({
          reportId: osMidtermCoReport.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }

    // ------------------------------------------------------------------------
    // Seed Exam Quality Report: OS Midterm
    // ------------------------------------------------------------------------
    let osMidtermExamReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: osCourse.id,
        questionPaperId: osMidterm.id,
        reportType: ReportType.EXAM_QUALITY,
      },
    });

    const osExamQualityRecommendations = [
      { message: "Add sample code snippets with subtle race condition bugs for students to identify and fix.", priority: Priority.MEDIUM },
      { message: "Good distribution of Application (50%) and Synthesis (30%) Bloom levels.", priority: Priority.LOW },
      { message: "Ensure virtual memory questions are tested in upcoming quizzes or labs.", priority: Priority.HIGH },
    ];

    const osExamQualityResultJson = {
      overallScore: 84,
      qualityScore: 84,
      topicCoverage: [
        { topic: "CPU Scheduling", coveredInExam: true, questionCount: 1, marksAllocated: 15, reason: "SJF vs Round Robin calculations" },
        { topic: "Process Synchronization & Semaphores", coveredInExam: true, questionCount: 1, marksAllocated: 15, reason: "Bounded buffer POSIX code" },
        { topic: "Threads & Concurrency", coveredInExam: true, questionCount: 1, marksAllocated: 10, reason: "ULT vs KLT architecture" },
        { topic: "Synchronization Anomalies", coveredInExam: true, questionCount: 1, marksAllocated: 10, reason: "Readers-Writers starvation" },
      ],
      difficulty: [
        { level: "MODERATE", questionCount: 2, marksAllocated: 20, percentage: 40, reason: "Scheduling math & thread concepts" },
        { level: "HARD", questionCount: 2, marksAllocated: 30, percentage: 60, reason: "Concurrent semaphore code synthesis & starvation analysis" },
      ],
      bloomDistribution: [
        { level: "COMPREHENSION", questionCount: 1, marksAllocated: 10, percentage: 20, reason: "Thread model explanation" },
        { level: "ANALYSIS", questionCount: 1, marksAllocated: 10, percentage: 20, reason: "Starvation analysis in Readers-Writers" },
        { level: "APPLICATION", questionCount: 1, marksAllocated: 15, percentage: 30, reason: "CPU turnaround & waiting time computation" },
        { level: "SYNTHESIS", questionCount: 1, marksAllocated: 15, percentage: 30, reason: "Thread-safe bounded buffer code implementation" },
      ],
      marksDistribution: [
        { topic: "CPU Scheduling", marks: 15, percentage: 30 },
        { topic: "Process Synchronization & Semaphores", marks: 15, percentage: 30 },
        { topic: "Threads & Concurrency", marks: 10, percentage: 20 },
        { topic: "Synchronization Anomalies", marks: 10, percentage: 20 },
      ],
      scoreFactors: [
        { factor: "Topic Coverage", score: 80, weight: 30, reason: "Focused deeply on process management and synchronization" },
        { factor: "Cognitive Balance", score: 88, weight: 35, reason: "Strong synthesis and algorithmic evaluation" },
        { factor: "Course Outcome Alignment", score: 84, weight: 35, reason: "100% coverage of CO1 and CO3" },
      ],
      positivePoints: [
        "Hands-on POSIX pseudo-code implementation tests practical coding proficiency.",
        "Clear mathematical criteria for CPU scheduling comparison.",
        "Excellent examination of starvation anomalies.",
      ],
      issues: [
        { severity: "MEDIUM", message: "Memory and storage topics deferred to final exam.", reason: "Syllabus timing." },
      ],
      learningOutcomeAlignment: [
        { outcome: "CO1", addressed: true },
        { outcome: "CO2", addressed: false },
        { outcome: "CO3", addressed: true },
        { outcome: "CO4", addressed: false },
      ],
      recommendations: osExamQualityRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "Solid exam paper emphasizing concurrent programming and algorithmic evaluation.",
        reason: "60% of marks allocated to higher-order cognitive skills (Analysis and Synthesis).",
        confidence: 91.0,
      },
    };

    if (!osMidtermExamReport) {
      osMidtermExamReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: osCourse.id,
          questionPaperId: osMidterm.id,
          reportType: ReportType.EXAM_QUALITY,
          resultJson: osExamQualityResultJson as Prisma.InputJsonValue,
          examQualityScore: {
            create: {
              qualityScore: 84.0,
              scoreFactors: osExamQualityResultJson.scoreFactors as unknown as Prisma.InputJsonValue,
              positivePoints: osExamQualityResultJson.positivePoints as Prisma.InputJsonValue,
              issues: osExamQualityResultJson.issues as unknown as Prisma.InputJsonValue,
              recommendations: osExamQualityResultJson.recommendations as unknown as Prisma.InputJsonValue,
              confidenceScore: 91.0,
            },
          },
          explanation: {
            create: {
              module: "EXAM_QUALITY",
              decision: osExamQualityResultJson.explanation.decision,
              reason: osExamQualityResultJson.explanation.reason,
              confidence: osExamQualityResultJson.explanation.confidence,
            },
          },
        },
      });

      const report = osMidtermExamReport!;
      await prisma.recommendation.createMany({
        data: osExamQualityRecommendations.map((r) => ({
          reportId: report.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }

    // ------------------------------------------------------------------------
    // Seed Question CO Mappings & Recommendations: OS Final
    // ------------------------------------------------------------------------
    console.log(`Seeding Question CO Mappings & Recommendations for OS Final...`);
    const osFinalQuestions = await prisma.question.findMany({
      where: { paperId: osFinal.id },
      orderBy: { sequenceNumber: "asc" },
    });

    const osFinalMappings = [
      {
        sequenceNumber: 1,
        outcomeCode: "CO2",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Directly evaluates virtual memory page replacement algorithms (FIFO, LRU, Optimal) and fault counts.",
        confidence: 97.0,
      },
      {
        sequenceNumber: 2,
        outcomeCode: "CO2",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Tests mathematical modeling of multi-level paging memory architectures and TLB performance.",
        confidence: 95.0,
      },
      {
        sequenceNumber: 3,
        outcomeCode: "CO4",
        strength: "STRONG",
        decision: "MAPPED",
        reason: "Evaluates file system allocation schemes (UNIX Inodes vs contiguous) regarding disk utilization and random access.",
        confidence: 94.0,
      },
    ];

    const osFinalRecommendations = [
      {
        message: "Add disk scheduling algorithms (SSTF, SCAN, C-LOOK) to the final exam paper to ensure comprehensive coverage of CO4.",
        priority: Priority.HIGH,
      },
      {
        message: "Incorporate virtual memory thrashing and working set model scenarios to deepen CO2 evaluation beyond standard page replacement trace problems.",
        priority: Priority.MEDIUM,
      },
      {
        message: "Include RAID architecture comparison questions to broaden storage reliability evaluation in CO4.",
        priority: Priority.LOW,
      },
    ];

    let osFinalCoReport = await prisma.analysisReport.findFirst({
      where: {
        facultyId: user.id,
        courseId: osCourse.id,
        questionPaperId: osFinal.id,
        reportType: ReportType.CO_MAPPING,
      },
    });

    const osFinalCoResultJson = {
      qualityScore: 88,
      courseOutcomes: osCODefs,
      questionCOMap: osFinalMappings.map((m) => {
        const q = osFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          decision: m.decision,
          reason: m.reason,
          confidence: m.confidence,
        };
      }),
      mappings: osFinalMappings.map((m) => {
        const q = osFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber)!;
        return {
          questionId: q.id,
          courseOutcome: m.outcomeCode,
          strength: m.strength,
          rationale: m.reason,
        };
      }),
      coverage: { CO1: 0, CO2: 100, CO3: 0, CO4: 100 },
      coveragePercentage: 50,
      missingOutcomes: ["CO1", "CO3"],
      unmappedQuestionIds: [],
      issues: [
        {
          severity: "LOW",
          message: "CO1 and CO3 were comprehensively tested in Midterm; Final focuses on Memory & Storage.",
        },
      ],
      recommendations: osFinalRecommendations.map((r) => ({ message: r.message, priority: r.priority })),
      explanation: {
        decision: "Final examination effectively evaluates Virtual Memory (CO2) and File Systems (CO4).",
        reason: "Page replacement and TLB address translation questions provide deep analytical rigor.",
        confidence: 95.0,
      },
    };

    if (!osFinalCoReport) {
      osFinalCoReport = await prisma.analysisReport.create({
        data: {
          facultyId: user.id,
          courseId: osCourse.id,
          questionPaperId: osFinal.id,
          reportType: ReportType.CO_MAPPING,
          resultJson: osFinalCoResultJson as Prisma.InputJsonValue,
          explanation: {
            create: {
              module: "CO_MAPPING",
              decision: osFinalCoResultJson.explanation.decision,
              reason: osFinalCoResultJson.explanation.reason,
              confidence: osFinalCoResultJson.explanation.confidence,
            },
          },
        },
      });
    }

    for (const m of osFinalMappings) {
      const q = osFinalQuestions.find((item) => item.sequenceNumber === m.sequenceNumber);
      const coId = osCOMap.get(m.outcomeCode);
      if (q && coId) {
        await prisma.questionCOMapping.upsert({
          where: {
            reportId_questionId_courseOutcomeId: {
              reportId: osFinalCoReport.id,
              questionId: q.id,
              courseOutcomeId: coId,
            },
          },
          update: {
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
          create: {
            reportId: osFinalCoReport.id,
            questionId: q.id,
            courseOutcomeId: coId,
            strength: m.strength,
            decision: m.decision,
            reason: m.reason,
            confidence: m.confidence,
          },
        });
      }
    }

    const existingOsFinalRecs = await prisma.recommendation.findMany({
      where: { reportId: osFinalCoReport.id },
    });
    if (existingOsFinalRecs.length === 0) {
      await prisma.recommendation.createMany({
        data: osFinalRecommendations.map((r) => ({
          reportId: osFinalCoReport.id,
          message: r.message,
          priority: r.priority,
        })),
      });
    }
  }

  console.log("\nSuccessfully seeded BeSTRaP and OS Datasets with Question CO Mappings and Recommendations into database!");
}

if (require.main === module) {
  seedDatasets()
    .catch((e) => {
      console.error("Error seeding datasets:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
