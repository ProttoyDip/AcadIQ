import { prisma } from "./prismaClient";

async function seedDatasets() {
  console.log("Starting dataset seeding for BeSTRaP and OS Datasets...");

  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.error("No faculty users found in database. Please register a user first.");
    return;
  }

  for (const user of users) {
    console.log(`Seeding datasets for faculty: ${user.name} (ID: ${user.id})...`);

    // 1. BeSTRaP Dataset Course (DBMS / Database Transactions)
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
    const dbmsCOs = [
      { code: "CO1", description: "Understand transaction processing fundamentals, ACID properties, and execution schedules." },
      { code: "CO2", description: "Analyze serializability and concurrency control protocols including 2PL and Timestamp Ordering." },
      { code: "CO3", description: "Evaluate crash recovery mechanisms (ARIES, WAL) and index structures for database performance." },
      { code: "CO4", description: "Apply normalization theory to decompose relational schemas up to 3NF and BCNF." },
    ];

    for (const co of dbmsCOs) {
      await prisma.courseOutcome.upsert({
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
    }

    // DBMS Midterm Paper
    const dbmsMidterm = await prisma.questionPaper.create({
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

    // Populate QuestionHistory for DBMS Midterm
    for (const q of dbmsMidterm.questions) {
      await prisma.questionHistory.create({
        data: {
          courseId: dbmsCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // DBMS Final Paper
    const dbmsFinal = await prisma.questionPaper.create({
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

    // Populate QuestionHistory for DBMS Final
    for (const q of dbmsFinal.questions) {
      await prisma.questionHistory.create({
        data: {
          courseId: dbmsCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // Rubric & Sample Student Answers for DBMS
    const dbmsRubric = await prisma.rubric.create({
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

    // Add Student Answers for DBMS Question 1
    const q1 = dbmsMidterm.questions[0];
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


    // 2. OS Dataset Course (Operating Systems)
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
    const osCOs = [
      { code: "CO1", description: "Analyze process scheduling algorithms, turn-around times, and context switching." },
      { code: "CO2", description: "Evaluate virtual memory architectures, paging, and page replacement algorithms." },
      { code: "CO3", description: "Apply POSIX semaphores, mutexes, and locks to prevent race conditions and deadlocks." },
      { code: "CO4", description: "Understand file system allocation schemes (Inodes), disk scheduling, and I/O management." },
    ];

    for (const co of osCOs) {
      await prisma.courseOutcome.upsert({
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
    }

    // OS Midterm Paper
    const osMidterm = await prisma.questionPaper.create({
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

    // Populate QuestionHistory for OS Midterm
    for (const q of osMidterm.questions) {
      await prisma.questionHistory.create({
        data: {
          courseId: osCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // OS Final Paper
    const osFinal = await prisma.questionPaper.create({
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

    // Populate QuestionHistory for OS Final
    for (const q of osFinal.questions) {
      await prisma.questionHistory.create({
        data: {
          courseId: osCourse.id,
          sourceQuestionId: q.id,
          questionText: q.questionText,
          semester: "Spring 2024",
          year: 2024,
        },
      });
    }

    // OS Rubric & Student Answers
    const osRubric = await prisma.rubric.create({
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

    // Add Student Answers for OS Midterm Q1
    const osQ1 = osMidterm.questions[0];
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

  console.log("Successfully seeded BeSTRaP and OS Datasets question papers into database!");
}

seedDatasets()
  .catch((e) => {
    console.error("Error seeding datasets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
