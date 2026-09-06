import { prisma } from "../database/prismaClient";
import { Role } from "@prisma/client";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id }, include: { facultyProfile: true } });
  },

  create(data: { name: string; email: string; password: string; role: Role }) {
    return prisma.user.create({ data });
  },

  createFacultyProfile(userId: number, department: string, designation: string) {
    return prisma.facultyProfile.create({ data: { userId, department, designation } });
  },
};
