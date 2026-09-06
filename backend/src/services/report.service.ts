import { reportRepository } from "../repositories/report.repository";
import { AppError } from "../middleware/error.middleware";

export const reportService = {
  listForFaculty(facultyId: number) {
    return reportRepository.findAllByFaculty(facultyId);
  },

  async getById(id: number, facultyId: number) {
    const report = await reportRepository.findById(id);
    if (!report || report.facultyId !== facultyId) {
      throw new AppError("Report not found", 404);
    }
    return report;
  },
};
