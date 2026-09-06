import { reportRepository } from "../repositories/report.repository";
import { runExamAnalysisPipeline } from "../ai/pipeline/examAnalysisPipeline";
import { AnalyzeExamInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadReliabilityEvidence, loadSyllabusText } from "./analysisContext.service";
import { courseRepository } from "../repositories/course.repository";
import { withDecisionContract } from "../ai/confidence";
import { auditService } from "./audit.service";

export const examAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeExamInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const storedOutcomes = await courseRepository.findOutcomes(input.courseId);
    const courseOutcomes = input.courseOutcomes ?? storedOutcomes;
    const questionsText = questions.map((q) => `- ${q.questionText} [${Number(q.marks)} marks]`).join("\n");
    const evidence = await loadReliabilityEvidence(input.courseId, {
      sourceTexts: questions.map((question) => question.questionText),
      excludedQuestionIds: questions.map((question) => question.id),
      syllabusText,
      courseOutcomeCount: courseOutcomes.length,
    });

    const result = await runExamAnalysisPipeline(syllabusText, questionsText, courseOutcomes, evidence);
    const completeResult = withDecisionContract({
      ...result,
      // Existing frontend aliases remain available while the new explainable contract is adopted.
      overallScore: result.qualityScore,
      topicCoverage: result.coverage.topics,
      learningOutcomeAlignment: result.coverage.courseOutcomes.map(({ outcome, addressed }) => ({ outcome, addressed })),
    });

    const report = await reportRepository.createExamAnalysis({
      facultyId,
      courseId: input.courseId,
      questionPaperId: paper.id,
      reportType: "EXAM_QUALITY",
      resultJson: completeResult,
    }, result);

    await auditService.recordAuditLog({
      userId: facultyId,
      action: "Faculty generated analysis",
      document: paper.originalName,
    });

    return { reportId: report.id, ...completeResult };
  },
};
