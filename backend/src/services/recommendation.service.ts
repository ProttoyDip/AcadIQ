import { reportRepository } from "../repositories/report.repository";
import { AppError } from "../middleware/error.middleware";

export const recommendationService = {
  async getForReport(reportId: number, facultyId: number) {
    const report = await reportRepository.findById(reportId);
    if (!report || report.facultyId !== facultyId) {
      throw new AppError("Report not found", 404);
    }
    return report.recommendations;
  },
};
