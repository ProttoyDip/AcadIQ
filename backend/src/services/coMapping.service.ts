import { runCoMappingPipeline } from "../ai/pipeline/coMappingPipeline";
import { reportRepository } from "../repositories/report.repository";
import { CoMappingInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadSyllabusText } from "./analysisContext.service";
import { courseRepository } from "../repositories/course.repository";

export const coMappingService = {
  async analyze(facultyId: number, input: CoMappingInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const storedOutcomes = await courseRepository.findOutcomes(input.courseId);
    const requestedOutcomes = input.courseOutcomes ?? (storedOutcomes.length ? storedOutcomes : undefined);
    const result = await runCoMappingPipeline(
      syllabusText,
      questions.map((question) => ({ id: question.id, text: question.questionText, marks: Number(question.marks) })),
      requestedOutcomes
    );
    const completeResult = {
      ...result,
      mappings: result.questionCOMap.map(({ questionId, courseOutcome, strength, reason }) => ({
        questionId,
        courseOutcome,
        strength,
        rationale: reason,
      })),
    };
    const report = await reportRepository.createCoAnalysis(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: paper.id,
        reportType: "CO_MAPPING",
        resultJson: completeResult,
      },
      result.recommendations.map((item) => ({ message: item.message, priority: item.priority })),
      result.explanation,
      result.courseOutcomes,
      result.questionCOMap
    );
    return { reportId: report.id, ...completeResult };
  },
};
