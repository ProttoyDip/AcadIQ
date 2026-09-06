import { runCoMappingPipeline } from "../ai/pipeline/coMappingPipeline";
import { reportRepository } from "../repositories/report.repository";
import { CoMappingInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadReliabilityEvidence, loadSyllabusText } from "./analysisContext.service";
import { courseRepository } from "../repositories/course.repository";
import { withDecisionContract } from "../ai/confidence";

export const coMappingService = {
  async analyze(facultyId: number, input: CoMappingInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const storedOutcomes = await courseRepository.findOutcomes(input.courseId);
    const requestedOutcomes = input.courseOutcomes ?? (storedOutcomes.length ? storedOutcomes : undefined);
    const evidence = await loadReliabilityEvidence(input.courseId, {
      sourceTexts: questions.map((question) => question.questionText),
      excludedQuestionIds: questions.map((question) => question.id),
      syllabusText,
      courseOutcomeCount: requestedOutcomes?.length ?? 0,
    });
    const result = await runCoMappingPipeline(
      syllabusText,
      questions.map((question) => ({ id: question.id, text: question.questionText, marks: Number(question.marks) })),
      requestedOutcomes,
      evidence
    );
    const completeResult = withDecisionContract({
      ...result,
      mappings: result.questionCOMap.map(({ questionId, courseOutcome, strength, decision, reason, confidence }) => ({
        questionId,
        courseOutcome,
        strength,
        decision,
        rationale: reason,
        reason,
        confidence,
      })),
    });
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
