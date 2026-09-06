import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BookOpenCheck,
  Scale,
  Brain,
  Target,
  GitCompareArrows,
  Sparkles,
  History,
  Gauge,
  ListChecks,
} from "lucide-react";
import { useReport, useReports } from "../hooks/useReports";
import { useCourse } from "../hooks/useCourses";
import PageHeader from "../components/layout/PageHeader";
import { LoadingState } from "../components/ui/loading-state";
import { EmptyState } from "../components/ui/empty-state";
import { Button } from "../components/ui/button";
import ScoreHero from "../components/reports/ScoreHero";
import ExamReportHero from "../components/reports/ExamReportHero";
import ReportSection from "../components/reports/ReportSection";
import SectionNav from "../components/reports/SectionNav";
import DifficultyBalance from "../components/reports/DifficultyBalance";
import ScoreExplanationPanel from "../components/reports/ScoreExplanationPanel";
import AcademicMemoryAlert from "../components/reports/AcademicMemoryAlert";
import ExplainableAIInsightCard from "../components/reports/ExplainableAIInsightCard";
import CoMappingTable from "../components/reports/CoMappingTable";
import QuestionReviewTable from "../components/reports/QuestionReviewTable";
import RecommendationCard from "../components/reports/RecommendationCard";
import TopicCoverageTable from "../components/reports/TopicCoverageTable";
import SimilarityMatchTable from "../components/reports/SimilarityMatchTable";
import OutcomeMappingTable from "../components/reports/OutcomeMappingTable";
import MarksDistributionChart from "../components/analytics/MarksDistributionChart";
import DifficultyDistributionChart from "../components/analytics/DifficultyDistributionChart";
import CoCoverageChart from "../components/analytics/CoCoverageChart";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { formatDateTime, reportTypeLabel, bloomLabel } from "../lib/format";
import { deriveScoreFactors, difficultyBucketBreakdown, confidenceFromSimilarity, confidenceFromSampleSize, confidenceForCoStrength } from "../lib/insights";
import {
  ExamQualityResult,
  QuestionSimilarityResult,
  SyllabusCoverageResult,
  CoMappingResult,
  QuestionReviewResult,
  Course,
} from "../types";

interface ResolvedQuestion {
  text: string;
  paperLabel: string;
}

function buildQuestionLookup(course?: Course): Map<number, ResolvedQuestion> {
  const map = new Map<number, ResolvedQuestion>();
  for (const paper of course?.questionPapers ?? []) {
    for (const question of paper.questions ?? []) {
      map.set(question.id, {
        text: question.questionText,
        paperLabel: `${course?.courseCode ?? ""} ${paper.semester} ${paper.year}`.trim(),
      });
    }
  }
  return map;
}

export default function AnalysisReport() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, isError } = useReport(id ? Number(id) : null);
  const { data: allReports } = useReports();
  const { data: course } = useCourse(report?.courseId ?? null);

  // Cross-references to the other AI analyses for the same course, so the
  // exam report reads as one complete assessment instead of sending faculty
  // to hunt across separate reports for related evidence.
  const similarity = useMemo(() => {
    if (!report?.courseId) return undefined;
    const match = (allReports ?? []).find(
      (r) => r.reportType === "QUESTION_SIMILARITY" && r.courseId === report.courseId
    );
    return match?.resultJson as unknown as QuestionSimilarityResult | undefined;
  }, [allReports, report?.courseId]);

  const coMapping = useMemo(() => {
    if (!report?.courseId) return undefined;
    const match = (allReports ?? []).find((r) => r.reportType === "CO_MAPPING" && r.courseId === report.courseId);
    return match?.resultJson as unknown as CoMappingResult | undefined;
  }, [allReports, report?.courseId]);

  const questionLookup = useMemo(() => buildQuestionLookup(course), [course]);

  if (isLoading) return <LoadingState label="Loading report..." />;

  if (isError || !report) {
    return (
      <EmptyState
        icon={BookOpenCheck}
        title="Report not found"
        description="This report may have been removed, or you may not have access to it."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={reportTypeLabel(report.reportType)}
        description={`Generated ${formatDateTime(report.createdAt)}`}
        actions={<Badge variant="outline">Report #{report.id}</Badge>}
      />

      {report.reportType === "EXAM_QUALITY" && (
        <ExamQualityReport
          result={report.resultJson as unknown as ExamQualityResult}
          similarity={similarity}
          coMapping={coMapping}
          questionLookup={questionLookup}
        />
      )}
      {report.reportType === "SYLLABUS_COVERAGE" && (
        <SyllabusCoverageReport result={report.resultJson as unknown as SyllabusCoverageResult} />
      )}
      {report.reportType === "QUESTION_SIMILARITY" && (
        <SimilarityReport result={report.resultJson as unknown as QuestionSimilarityResult} questionLookup={questionLookup} />
      )}
      {report.reportType === "CO_MAPPING" && (
        <CoMappingReport result={report.resultJson as unknown as CoMappingResult} />
      )}
      {report.reportType === "QUESTION_REVIEW" && (
        <QuestionReviewReport result={report.resultJson as unknown as QuestionReviewResult} />
      )}
    </div>
  );
}

const SECTIONS = [
  { id: "topic-coverage", label: "Topic Coverage", icon: BookOpenCheck },
  { id: "difficulty-analysis", label: "Difficulty Analysis", icon: Scale },
  { id: "bloom-taxonomy", label: "Bloom Taxonomy", icon: Brain },
  { id: "academic-memory", label: "Academic Memory", icon: History },
  { id: "co-coverage", label: "CO Coverage", icon: Target },
  { id: "explainable-ai", label: "Explainable AI", icon: Sparkles },
  { id: "recommendations", label: "Recommendations", icon: ListChecks },
];

function ExamQualityReport({
  result,
  similarity,
  coMapping,
  questionLookup,
}: {
  result: ExamQualityResult;
  similarity?: QuestionSimilarityResult;
  coMapping?: CoMappingResult;
  questionLookup: Map<number, ResolvedQuestion>;
}) {
  const totalQuestions = result.bloomDistribution.reduce((sum, b) => sum + b.questionCount, 0);
  const totalMarks = result.marksDistribution.reduce((sum, m) => sum + m.marks, 0);
  const topicsAssessed = result.topicCoverage.length;
  const highPriorityFlags =
    result.recommendations.filter((r) => r.priority === "HIGH").length +
    (similarity?.matches.filter((m) => m.similarityPercentage >= 75).length ?? 0);

  const coveredCount = result.topicCoverage.filter((t) => t.coveredInExam).length;
  const coveragePct = topicsAssessed > 0 ? Math.round((coveredCount / topicsAssessed) * 100) : 0;

  const outcomePoints = coMapping
    ? Object.entries(coMapping.coverage).map(([outcome, percentage]) => ({ outcome, percentage }))
    : result.learningOutcomeAlignment.map((o) => ({ outcome: o.outcome, percentage: o.addressed ? 100 : 0 }));
  const outcomesPct =
    outcomePoints.length > 0
      ? Math.round(outcomePoints.reduce((sum, o) => sum + o.percentage, 0) / outcomePoints.length)
      : 0;

  const scoreFactors = deriveScoreFactors(result, coMapping, similarity);

  const buckets = difficultyBucketBreakdown(result.bloomDistribution);
  const bloomResult = buckets.Easy > 55 ? "Recall-heavy" : buckets.Hard >= 15 ? "Higher-order weighted" : "Balanced";

  const topMatches = (similarity?.matches ?? []).slice().sort((a, b) => b.similarityPercentage - a.similarityPercentage).slice(0, 2);
  const weakestOutcome = outcomePoints.length > 0 ? outcomePoints.reduce((min, o) => (o.percentage < min.percentage ? o : min)) : undefined;
  const weakestMapping = coMapping?.mappings.find((m) => m.courseOutcome === weakestOutcome?.outcome);

  return (
    <>
      <ExamReportHero
        score={result.overallScore}
        totalQuestions={totalQuestions}
        totalMarks={totalMarks}
        topicsAssessed={topicsAssessed}
        highPriorityFlags={highPriorityFlags}
      />

      <ScoreExplanationPanel factors={scoreFactors} />

      <SectionNav items={SECTIONS} />

      <div id="topic-coverage" className="scroll-mt-20">
        <ReportSection
          icon={BookOpenCheck}
          title="Topic coverage intelligence"
          explanation="How exam questions map onto syllabus topics, weighted by marks."
        >
          <div className="mb-5 flex items-center gap-3">
            <Progress value={coveragePct} tone={coveragePct >= 75 ? "success" : coveragePct >= 50 ? "warning" : "error"} className="h-2.5" />
            <span className="w-28 shrink-0 text-right text-small font-semibold text-foreground">
              {coveredCount}/{topicsAssessed} topics
            </span>
          </div>
          <TopicCoverageTable data={result.topicCoverage} />
          <div className="mt-6 h-64 border-t border-border pt-6">
            <p className="mb-3 text-small font-medium text-muted-foreground">Marks weight by topic</p>
            <MarksDistributionChart data={result.marksDistribution} />
          </div>
        </ReportSection>
      </div>

      <div id="difficulty-analysis" className="scroll-mt-20">
        <ReportSection
          icon={Scale}
          title="Difficulty analysis"
          explanation="Question share across Easy, Medium, and Hard cognitive demand — not concentrated in recall."
        >
          <DifficultyBalance data={result.bloomDistribution} />
        </ReportSection>
      </div>

      <div id="bloom-taxonomy" className="scroll-mt-20">
        <ReportSection
          icon={Brain}
          title="Bloom's taxonomy analysis"
          explanation="Question share and marks allocated at each of the six cognitive levels."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72">
              <DifficultyDistributionChart data={result.bloomDistribution} />
            </div>
            <div className="flex flex-col justify-center gap-2.5">
              {result.bloomDistribution.map((b) => (
                <div key={b.level} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-small font-medium text-foreground">{bloomLabel(b.level)}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.questionCount} questions · {b.marksAllocated} marks
                  </span>
                  <Badge variant="outline">{Math.round(b.percentage)}%</Badge>
                </div>
              ))}
            </div>
          </div>
        </ReportSection>
      </div>

      <div id="academic-memory" className="scroll-mt-20">
        <ReportSection
          icon={History}
          title="Academic memory alert"
          explanation="Questions checked against this course's question history for duplication or repeated patterns."
        >
          {similarity ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Progress
                  value={100 - similarity.overallDuplicationPercentage}
                  tone={similarity.overallDuplicationPercentage <= 20 ? "success" : similarity.overallDuplicationPercentage <= 40 ? "warning" : "error"}
                  className="h-2.5"
                />
                <span className="w-36 shrink-0 text-right text-small font-semibold text-foreground">
                  {similarity.overallDuplicationPercentage}% duplication
                </span>
              </div>

              {topMatches.map((m, i) => {
                const current = questionLookup.get(m.currentQuestionId);
                const previous = questionLookup.get(m.previousQuestionId);
                return (
                  <AcademicMemoryAlert
                    key={i}
                    currentQuestionText={current?.text ?? `Question #${m.currentQuestionId}`}
                    previousQuestionText={previous?.text ?? `Question #${m.previousQuestionId}`}
                    previousPaperLabel={previous?.paperLabel ?? "a previous paper"}
                    similarityPercentage={m.similarityPercentage}
                    recommendation={i === 0 ? similarity.recommendation : undefined}
                  />
                );
              })}

              <SimilarityMatchTable matches={similarity.matches} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                <History className="h-6 w-6 text-primary-700" strokeWidth={1.75} />
              </div>
              <div className="max-w-sm">
                <p className="text-body font-semibold text-foreground">No academic memory check run for this course yet</p>
                <p className="mt-1 text-small text-muted-foreground">
                  Compare this paper against a previous semester's exam from Academic Memory to detect duplicate or
                  repeated questions.
                </p>
              </div>
              <Button asChild size="sm" className="mt-1">
                <Link to="/question-memory">Go to Academic Memory</Link>
              </Button>
            </div>
          )}
        </ReportSection>
      </div>

      <div id="co-coverage" className="scroll-mt-20">
        <ReportSection
          icon={Target}
          title="CO coverage analysis"
          explanation="Whether each course outcome is meaningfully addressed by this exam, and how strongly."
        >
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Progress value={outcomesPct} tone={outcomesPct >= 75 ? "success" : outcomesPct >= 50 ? "warning" : "error"} className="h-2.5" />
              <span className="w-36 shrink-0 text-right text-small font-semibold text-foreground">
                {outcomesPct}% average coverage
              </span>
            </div>
            {outcomePoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {outcomePoints.map((op) => (
                  <div key={op.outcome} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                    <span className="text-small font-medium text-foreground">{op.outcome}:</span>
                    <Badge variant={op.percentage >= 75 ? "success" : op.percentage >= 50 ? "warning" : "error"}>{Math.round(op.percentage)}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="h-56">
            <CoCoverageChart data={outcomePoints} />
          </div>
          {coMapping ? (
            <div className="mt-6 border-t border-border pt-6">
              <CoMappingTable mappings={coMapping.mappings} />
              {coMapping.unmappedQuestionIds.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {coMapping.unmappedQuestionIds.length} question(s) could not be mapped to any course outcome:{" "}
                  {coMapping.unmappedQuestionIds.map((id) => `#${id}`).join(", ")}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 border-t border-border pt-6">
              <OutcomeMappingTable data={result.learningOutcomeAlignment} />
              <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-border bg-muted/40 px-4 py-3">
                <p className="text-small text-muted-foreground">
                  Run CO Mapping for question-level strength grading and reasoning.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/upload">Run CO Mapping</Link>
                </Button>
              </div>
            </div>
          )}
        </ReportSection>
      </div>

      <div id="explainable-ai" className="scroll-mt-20">
        <ReportSection
          icon={Sparkles}
          title="Explainable AI panel"
          explanation="Every AI decision on this page shows its confidence and its reasoning — never a bare number."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ExplainableAIInsightCard
              icon={Gauge}
              label="Exam quality score"
              result={`${Math.round(result.overallScore)}/100`}
              confidence={confidenceFromSampleSize(totalQuestions)}
              tone={result.overallScore >= 75 ? "success" : result.overallScore >= 50 ? "warning" : "error"}
              reasoning={
                scoreFactors.find((f) => !f.positive)?.label ??
                scoreFactors[0]?.label ??
                "Computed from topic coverage, cognitive balance, CO alignment, and originality."
              }
              considered={scoreFactors.map((f) => f.label)}
            />

            <ExplainableAIInsightCard
              icon={Brain}
              label="Cognitive difficulty"
              result={bloomResult}
              confidence={confidenceFromSampleSize(totalQuestions)}
              tone={bloomResult === "Balanced" ? "success" : "warning"}
              reasoning={`${Math.round(buckets.Easy)}% Easy, ${Math.round(buckets.Medium)}% Medium, ${Math.round(buckets.Hard)}% Hard — classified from each question's Bloom level.`}
              considered={result.bloomDistribution.map((b) => `${bloomLabel(b.level)}: ${Math.round(b.percentage)}%`)}
            />

            <ExplainableAIInsightCard
              icon={Target}
              label="CO coverage"
              result={weakestOutcome ? `${weakestOutcome.outcome} weakest (${Math.round(weakestOutcome.percentage)}%)` : "All outcomes covered"}
              confidence={weakestMapping ? confidenceForCoStrength(weakestMapping.strength) : confidenceFromSampleSize(outcomePoints.length)}
              tone={weakestOutcome && weakestOutcome.percentage < 50 ? "error" : "success"}
              reasoning={
                weakestMapping?.rationale ??
                (coMapping
                  ? "Every mapped question was checked against each declared course outcome."
                  : "Derived from whether at least one question addresses each outcome — run CO Mapping for per-question reasoning.")
              }
            />

            <ExplainableAIInsightCard
              icon={GitCompareArrows}
              label="Originality"
              result={similarity ? `${100 - similarity.overallDuplicationPercentage}% original` : "Not yet assessed"}
              confidence={similarity && topMatches[0] ? confidenceFromSimilarity(topMatches[0].similarityPercentage) : 0}
              tone={!similarity ? "neutral" : similarity.overallDuplicationPercentage <= 20 ? "success" : "error"}
              reasoning={
                similarity
                  ? similarity.recommendation
                  : "Run an Academic Memory check against a previous paper to assess originality."
              }
            />
          </div>
        </ReportSection>
      </div>

      <div id="recommendations" className="scroll-mt-20">
        <ReportSection
          icon={ListChecks}
          title="AI recommendations"
          explanation="Evidence-based suggestions faculty can act on — AcadIQ does not make the final call."
        >
          <div className="flex flex-col gap-3">
            {result.recommendations.map((rec, i) => (
              <RecommendationCard key={i} index={i} message={rec.message} priority={rec.priority} />
            ))}
          </div>
        </ReportSection>
      </div>
    </>
  );
}

function SyllabusCoverageReport({ result }: { result: SyllabusCoverageResult }) {
  return (
    <>
      <ScoreHero score={result.coveragePercentage} title="Syllabus Coverage Score" subtitle="AI-generated assessment" />
      <ReportSection
        icon={BookOpenCheck}
        title="Coverage breakdown"
        explanation="Which syllabus topics appear in the exam, which are missing, and which are overrepresented."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-small font-semibold text-success">Covered topics</p>
            <ul className="flex flex-col gap-1.5 text-small text-foreground">
              {result.coveredTopics.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-small font-semibold text-error">Missing topics</p>
            <ul className="flex flex-col gap-1.5 text-small text-foreground">
              {result.missingTopics.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-small font-semibold text-warning">Overused topics</p>
            <ul className="flex flex-col gap-1.5 text-small text-foreground">
              {result.overusedTopics.map((t) => (
                <li key={t.topic}>
                  • {t.topic} ({t.occurrences}×)
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ReportSection>
    </>
  );
}

function SimilarityReport({
  result,
  questionLookup,
}: {
  result: QuestionSimilarityResult;
  questionLookup: Map<number, ResolvedQuestion>;
}) {
  const topMatch = result.matches.slice().sort((a, b) => b.similarityPercentage - a.similarityPercentage)[0];
  const current = topMatch ? questionLookup.get(topMatch.currentQuestionId) : undefined;
  const previous = topMatch ? questionLookup.get(topMatch.previousQuestionId) : undefined;

  return (
    <>
      <ScoreHero
        score={100 - result.overallDuplicationPercentage}
        title="Question Originality Score"
        subtitle="AI-generated assessment"
      />
      {topMatch && (
        <AcademicMemoryAlert
          currentQuestionText={current?.text ?? `Question #${topMatch.currentQuestionId}`}
          previousQuestionText={previous?.text ?? `Question #${topMatch.previousQuestionId}`}
          previousPaperLabel={previous?.paperLabel ?? "a previous paper"}
          similarityPercentage={topMatch.similarityPercentage}
          recommendation={result.recommendation}
        />
      )}
      <ReportSection
        icon={GitCompareArrows}
        title="Question similarity matches"
        explanation="Questions flagged as duplicate, conceptually similar, or repeated patterns against a previous paper."
      >
        <SimilarityMatchTable matches={result.matches} />
      </ReportSection>
    </>
  );
}

function CoMappingReport({ result }: { result: CoMappingResult }) {
  const outcomePoints = Object.entries(result.coverage).map(([outcome, percentage]) => ({ outcome, percentage }));

  return (
    <>
      <ScoreHero score={result.qualityScore} title="CO Mapping Quality Score" subtitle="AI-generated assessment" />
      <ReportSection
        icon={Target}
        title="CO coverage"
        explanation="Percentage of exam evidence supporting each declared course outcome."
      >
        <div className="h-56">
          <CoCoverageChart data={outcomePoints} />
        </div>
      </ReportSection>
      <ReportSection
        icon={Sparkles}
        title="Question-to-outcome mapping"
        explanation="Every mapping includes AcadIQ's reasoning — not just a strength label."
      >
        <CoMappingTable mappings={result.mappings} />
        {result.unmappedQuestionIds.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {result.unmappedQuestionIds.length} question(s) could not be mapped to any course outcome:{" "}
            {result.unmappedQuestionIds.map((id) => `#${id}`).join(", ")}
          </p>
        )}
      </ReportSection>
      <ReportSection icon={ListChecks} title="AI recommendations" explanation="Evidence-based suggestions faculty can act on.">
        <div className="flex flex-col gap-3">
          {result.recommendations.map((rec, i) => (
            <RecommendationCard key={i} index={i} message={rec.message} priority={rec.priority} />
          ))}
        </div>
      </ReportSection>
    </>
  );
}

function QuestionReviewReport({ result }: { result: QuestionReviewResult }) {
  return (
    <>
      <ScoreHero score={result.qualityScore} title="Question Quality Score" subtitle="AI-generated assessment" />
      <ReportSection
        icon={Brain}
        title="Per-question clarity review"
        explanation="Each question's clarity, Bloom level, and any AI-suggested rewrite."
      >
        <QuestionReviewTable questions={result.questions} />
      </ReportSection>
      <ReportSection icon={ListChecks} title="AI recommendations" explanation="Evidence-based suggestions faculty can act on.">
        <div className="flex flex-col gap-3">
          {result.recommendations.map((rec, i) => (
            <RecommendationCard key={i} index={i} message={rec.message} priority={rec.priority} />
          ))}
        </div>
      </ReportSection>
    </>
  );
}
