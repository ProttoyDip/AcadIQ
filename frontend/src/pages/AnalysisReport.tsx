import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  BookOpenCheck,
  Scale,
  Brain,
  Target,
  GitCompareArrows,
  Sparkles,
} from "lucide-react";
import { useReport, useReports } from "../hooks/useReports";
import PageHeader from "../components/layout/PageHeader";
import { LoadingState } from "../components/ui/loading-state";
import { EmptyState } from "../components/ui/empty-state";
import ScoreHero from "../components/reports/ScoreHero";
import ExamReportHero from "../components/reports/ExamReportHero";
import ReportSection from "../components/reports/ReportSection";
import SectionNav from "../components/reports/SectionNav";
import DifficultyBalance from "../components/reports/DifficultyBalance";
import RecommendationCard, { splitRecommendation } from "../components/reports/RecommendationCard";
import TopicCoverageTable from "../components/reports/TopicCoverageTable";
import SimilarityMatchTable from "../components/reports/SimilarityMatchTable";
import OutcomeMappingTable from "../components/reports/OutcomeMappingTable";
import MarksDistributionChart from "../components/analytics/MarksDistributionChart";
import DifficultyDistributionChart from "../components/analytics/DifficultyDistributionChart";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { formatDateTime, reportTypeLabel, bloomLabel } from "../lib/format";
import { ExamQualityResult, QuestionSimilarityResult, SyllabusCoverageResult } from "../types";
import { DEMO_SIMILARITY } from "../lib/demoData";

export default function AnalysisReport() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useReport(id ? Number(id) : null);
  const { data: allReports } = useReports();

  const similarity = useMemo(() => {
    const match = (allReports ?? []).find((r) => r.reportType === "QUESTION_SIMILARITY");
    return match ? { result: match.resultJson as unknown as QuestionSimilarityResult, isDemo: false } : { result: DEMO_SIMILARITY, isDemo: true };
  }, [allReports]);

  if (isLoading) return <LoadingState label="Loading report..." />;

  if (!report) {
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
          similarity={similarity.result}
          similarityIsDemo={similarity.isDemo}
        />
      )}
      {report.reportType === "SYLLABUS_COVERAGE" && (
        <SyllabusCoverageReport result={report.resultJson as unknown as SyllabusCoverageResult} />
      )}
      {report.reportType === "QUESTION_SIMILARITY" && (
        <SimilarityReport result={report.resultJson as unknown as QuestionSimilarityResult} />
      )}
    </div>
  );
}

const SECTIONS = [
  { id: "topic-coverage", label: "Topic Coverage", icon: BookOpenCheck },
  { id: "difficulty-balance", label: "Difficulty Balance", icon: Scale },
  { id: "bloom-taxonomy", label: "Bloom Taxonomy", icon: Brain },
  { id: "similarity", label: "Question Similarity", icon: GitCompareArrows },
  { id: "outcome-mapping", label: "Learning Outcomes", icon: Target },
  { id: "recommendations", label: "AI Recommendations", icon: Sparkles },
];

function ExamQualityReport({
  result,
  similarity,
  similarityIsDemo,
}: {
  result: ExamQualityResult;
  similarity: QuestionSimilarityResult;
  similarityIsDemo: boolean;
}) {
  const totalQuestions = result.bloomDistribution.reduce((sum, b) => sum + b.questionCount, 0);
  const totalMarks = result.marksDistribution.reduce((sum, m) => sum + m.marks, 0);
  const topicsAssessed = result.topicCoverage.length;
  const highPriorityFlags =
    result.recommendations.filter((r) => r.priority === "HIGH").length +
    similarity.matches.filter((m) => m.similarityPercentage >= 75).length;

  const coveredCount = result.topicCoverage.filter((t) => t.coveredInExam).length;
  const coveragePct = topicsAssessed > 0 ? Math.round((coveredCount / topicsAssessed) * 100) : 0;

  const outcomesAddressed = result.learningOutcomeAlignment.filter((o) => o.addressed).length;
  const outcomesTotal = result.learningOutcomeAlignment.length;
  const outcomesPct = outcomesTotal > 0 ? Math.round((outcomesAddressed / outcomesTotal) * 100) : 0;

  return (
    <>
      <ExamReportHero
        score={result.overallScore}
        totalQuestions={totalQuestions}
        totalMarks={totalMarks}
        topicsAssessed={topicsAssessed}
        highPriorityFlags={highPriorityFlags}
      />

      <SectionNav items={SECTIONS} />

      <div id="topic-coverage" className="scroll-mt-20">
        <ReportSection
          icon={BookOpenCheck}
          title="Topic coverage"
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

      <div id="difficulty-balance" className="scroll-mt-20">
        <ReportSection
          icon={Scale}
          title="Difficulty balance"
          explanation="Whether cognitive load is spread across foundational, applied, and advanced thinking — not concentrated in recall."
        >
          <DifficultyBalance data={result.bloomDistribution} />
        </ReportSection>
      </div>

      <div id="bloom-taxonomy" className="scroll-mt-20">
        <ReportSection
          icon={Brain}
          title="Bloom's taxonomy distribution"
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

      <div id="similarity" className="scroll-mt-20">
        <ReportSection
          icon={GitCompareArrows}
          title="Question similarity detection"
          explanation="Questions checked against a previous paper for duplication, conceptual overlap, and repeated patterns."
        >
          {similarityIsDemo && (
            <Badge variant="outline" className="mb-4 border-primary-200 bg-primary-50 text-primary-700">
              Preview — run a similarity check for this course to replace with real matches
            </Badge>
          )}
          <div className="mb-5 flex items-center gap-3">
            <Progress
              value={100 - similarity.overallDuplicationPercentage}
              tone={similarity.overallDuplicationPercentage <= 20 ? "success" : similarity.overallDuplicationPercentage <= 40 ? "warning" : "error"}
              className="h-2.5"
            />
            <span className="w-36 shrink-0 text-right text-small font-semibold text-foreground">
              {similarity.overallDuplicationPercentage}% duplication
            </span>
          </div>
          <SimilarityMatchTable matches={similarity.matches} />
          <div className="mt-4 flex items-start gap-2.5 rounded-md bg-primary-50/60 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
            <p className="text-small text-foreground">{similarity.recommendation}</p>
          </div>
        </ReportSection>
      </div>

      <div id="outcome-mapping" className="scroll-mt-20">
        <ReportSection
          icon={Target}
          title="Learning outcome mapping"
          explanation="Whether each declared course outcome is addressed by at least one exam question."
        >
          <div className="mb-5 flex items-center gap-3">
            <Progress value={outcomesPct} tone={outcomesPct >= 75 ? "success" : outcomesPct >= 50 ? "warning" : "error"} className="h-2.5" />
            <span className="w-28 shrink-0 text-right text-small font-semibold text-foreground">
              {outcomesAddressed}/{outcomesTotal} outcomes
            </span>
          </div>
          <OutcomeMappingTable data={result.learningOutcomeAlignment} />
        </ReportSection>
      </div>

      <div id="recommendations" className="scroll-mt-20">
        <ReportSection
          icon={Sparkles}
          title="AI recommendations"
          explanation="Evidence-based suggestions faculty can act on — AcadIQ does not make the final call."
        >
          <div className="flex flex-col gap-3">
            {result.recommendations.map((rec, i) => {
              const { issue, recommendation } = splitRecommendation(rec.message);
              return (
                <RecommendationCard key={i} index={i} issue={issue} recommendation={recommendation} priority={rec.priority} />
              );
            })}
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

function SimilarityReport({ result }: { result: QuestionSimilarityResult }) {
  return (
    <>
      <ScoreHero
        score={100 - result.overallDuplicationPercentage}
        title="Question Originality Score"
        subtitle="AI-generated assessment"
      />
      <ReportSection
        icon={GitCompareArrows}
        title="Question similarity matches"
        explanation="Questions flagged as duplicate, conceptually similar, or repeated patterns against a previous paper."
      >
        <SimilarityMatchTable matches={result.matches} />
      </ReportSection>
      <ReportSection icon={Sparkles} title="AI recommendation" explanation="Suggested action based on the similarity findings.">
        <p className="text-small text-foreground">{result.recommendation}</p>
      </ReportSection>
    </>
  );
}
