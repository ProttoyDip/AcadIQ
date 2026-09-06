import { PrismaClient } from "@prisma/client";
import { seedDatasets } from "../src/database/seedDatasets";

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
  }
  console.log(`Seeded default courses for ${users.length} faculty users.`);

  // Seed datasets with Question CO Mappings and Recommendations
  await seedDatasets();
}

seed()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
