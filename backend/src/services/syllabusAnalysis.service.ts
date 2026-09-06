import { reportRepository } from "../repositories/report.repository";
import { runSyllabusCoveragePipeline } from "../ai/pipeline/syllabusPipeline";
import { AnalyzeSyllabusInput } from "../validators/analysis.validator";
import { loadAnalysisContext, loadSyllabusText } from "./analysisContext.service";

export const syllabusAnalysisService = {
  async analyze(facultyId: number, input: AnalyzeSyllabusInput) {
    const { paper, questions } = await loadAnalysisContext(facultyId, input.courseId, input.questionPaperId);
    const syllabusText = await loadSyllabusText(input.courseId);
    const questionsText = questions.map((q) => `- ${q.questionText}`).join("\n");

    const result = await runSyllabusCoveragePipeline(syllabusText, questionsText);

    const report = await reportRepository.createExplainable(
      {
        facultyId,
        courseId: input.courseId,
        questionPaperId: paper.id,
        reportType: "SYLLABUS_COVERAGE",
        resultJson: result,
      },
      [],
      result.explanation
    );

    return { reportId: report.id, ...result };
  },
};
