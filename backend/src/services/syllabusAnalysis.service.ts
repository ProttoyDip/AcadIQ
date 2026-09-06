import { reportRepository } from "../repositories/report.repository";
import { runSyllabusCoveragePipeline } from "../ai/pipeline/syllabusPipeline";
import { AnalyzeSyllabusInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadReliabilityEvidence, loadSyllabusText } from "./analysisContext.service";
import { withDecisionContract } from "../ai/confidence";

export const syllabusAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeSyllabusInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const questionsText = questions.map((q) => `- ${q.questionText}`).join("\n");
    const evidence = await loadReliabilityEvidence(input.courseId, {
      sourceTexts: questions.map((question) => question.questionText),
      excludedQuestionIds: questions.map((question) => question.id),
      syllabusText,
    });

    const result = await runSyllabusCoveragePipeline(syllabusText, questionsText, evidence);
    const completeResult = withDecisionContract(result);

    const report = await reportRepository.createExplainable(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: paper.id,
        reportType: "SYLLABUS_COVERAGE",
        resultJson: completeResult,
      },
      [],
      result.explanation
    );

    return { reportId: report.id, ...completeResult };
  },
};
