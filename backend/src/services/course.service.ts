import { courseRepository } from "../repositories/course.repository";
import { CreateCourseInput } from "../validators/course.validator";
import { AppError } from "../middleware/error.middleware";

export const courseService = {
  listForFaculty(facultyId: number) {
    return courseRepository.findAllByFaculty(facultyId);
  },

  async getById(id: number, facultyId: number) {
    const course = await courseRepository.findById(id);
    if (!course || course.facultyId !== facultyId) {
      throw new AppError("Course not found", 404);
    }
    return course;
  },

  create(facultyId: number, input: CreateCourseInput) {
    return courseRepository.create({ facultyId, ...input });
  },
};
