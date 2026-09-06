import { reportRepository } from "../repositories/report.repository";
import { runExamAnalysisPipeline } from "../ai/pipeline/examAnalysisPipeline";
import { AnalyzeExamInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadSyllabusText } from "./analysisContext.service";

export const examAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeExamInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const questionsText = questions.map((q) => `- ${q.questionText} [${Number(q.marks)} marks]`).join("\n");

    const result = await runExamAnalysisPipeline(syllabusText, questionsText);

    const report = await reportRepository.create({
      facultyId,
      courseId: input.courseId,
      questionPaperId: paper.id,
      reportType: "EXAM_QUALITY",
      resultJson: result,
    });

    await reportRepository.addRecommendations(
      report.id,
      result.recommendations.map((r) => ({ message: r.message, priority: r.priority }))
    );

    return { reportId: report.id, ...result };
  },
};
