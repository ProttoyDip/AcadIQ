import { runCoMappingPipeline } from "../ai/pipeline/coMappingPipeline";
import { reportRepository } from "../repositories/report.repository";
import { CoMappingInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadSyllabusText } from "./analysisContext.service";

export const coMappingService = {
  async analyze(facultyId: number, input: CoMappingInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const result = await runCoMappingPipeline(
      syllabusText,
      questions.map((question) => ({ id: question.id, text: question.questionText, marks: Number(question.marks) })),
      input.courseOutcomes
    );
    const report = await reportRepository.createWithRecommendations(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: paper.id,
        reportType: "CO_MAPPING",
        resultJson: result,
      },
      result.recommendations.map((item) => ({ message: item.message, priority: item.priority }))
    );
    return { reportId: report.id, ...result };
  },
};
