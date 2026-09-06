import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultCourses = [
  {
    courseCode: "CSE 3811",
    courseName: "Artificial Intelligence",
    description: "Core computer science course covering AI, search algorithms, and machine learning.",
  },
  {
    courseCode: "CSE 4101",
    courseName: "Software Engineering",
    description: "Principles of software architecture, design patterns, and agile methodologies.",
  },
  {
    courseCode: "CSE 3101",
    courseName: "Database Systems",
    description: "Core computer science course covering relational databases, SQL, ER modeling, normalization, and transaction processing.",
  },
  {
    courseCode: "CSE 3201",
    courseName: "Operating Systems",
    description: "Core computer science course covering process management, CPU scheduling, memory management, file systems, and concurrency.",
  },
];

async function seed() {
  console.log("Seeding database default courses...");
  const users = await prisma.user.findMany({
    where: { role: "FACULTY" },
  });

  for (const user of users) {
    for (const course of defaultCourses) {
      await prisma.course.upsert({
        where: {
          facultyId_courseCode: {
            facultyId: user.id,
            courseCode: course.courseCode,
          },
        },
        update: {
          courseName: course.courseName,
          description: course.description,
        },
        create: {
          facultyId: user.id,
          courseCode: course.courseCode,
          courseName: course.courseName,
          description: course.description,
        },
      });
    }

    // Seed BeSTRaP DBMS Course & Question Papers
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

    // Seed OS Course & Question Papers
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
  }
  console.log(`Seeded default courses and datasets for ${users.length} faculty users.`);
}

seed()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
