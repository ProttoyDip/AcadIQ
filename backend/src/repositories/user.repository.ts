import { prisma } from "../database/prismaClient";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id }, include: { facultyProfile: true } });
  },

  createWithFacultyProfile(data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "FACULTY";
    department: string;
    designation: string;
  }) {
    const { department, designation, ...user } = data;
    return prisma.user.create({
      data: {
        ...user,
        facultyProfile: { create: { department, designation } },
      },
      include: { facultyProfile: true },
    });
  },
};
