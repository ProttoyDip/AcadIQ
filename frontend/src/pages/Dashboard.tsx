import { useMemo } from "react";
import { GraduationCap, Copy, Target, Sparkles, GitCompareArrows, Scale, TrendingUp, TrendingDown } from "lucide-react";
import { useCourses } from "../hooks/useCourses";
import { useReports } from "../hooks/useReports";
import { useAuth } from "../hooks/useAuth";
import WelcomeHeader from "../components/dashboard/WelcomeHeader";
import StatCard from "../components/dashboard/StatCard";
import RiskCard from "../components/dashboard/RiskCard";
import RecentAnalysisList, { RecentReportItem } from "../components/dashboard/RecentAnalysisList";
import ChartContainer from "../components/analytics/ChartContainer";
import QualityTrendChart from "../components/analytics/QualityTrendChart";
import { CardSkeleton } from "../components/ui/loading-state";
import { formatDate, reportTypeLabel } from "../lib/format";
import { difficultyBucketBreakdown } from "../lib/insights";
import { ExamQualityResult, CoMappingResult, QuestionSimilarityResult } from "../types";

function ChartEmpty({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-small text-muted-foreground">{message}</div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: courses, isLoading: coursesLoading, isError: coursesError } = useCourses();
  const { data: reports, isLoading: reportsLoading, isError: reportsError } = useReports();

  const isLoading = coursesLoading || reportsLoading;
  const hasError = coursesError || reportsError;

  const DEMO_MODE = reports?.length === 0;

  const examReports = useMemo(
    () => (reports ?? []).filter((r) => r.reportType === "EXAM_QUALITY").slice().reverse(),
    [reports]
  );
  const similarityReports = useMemo(
    () => (reports ?? []).filter((r) => r.reportType === "QUESTION_SIMILARITY"),
    [reports]
  );
  const coMappingReports = useMemo(() => (reports ?? []).filter((r) => r.reportType === "CO_MAPPING"), [reports]);

  const latestExam = examReports[examReports.length - 1]?.resultJson as unknown as ExamQualityResult | undefined;
  const previousExam = examReports[examReports.length - 2]?.resultJson as unknown as ExamQualityResult | undefined;
  const latestCoMapping = coMappingReports[0]?.resultJson as unknown as CoMappingResult | undefined;

  const trendData = useMemo(() => {
    if (DEMO_MODE) {
      return [
        { label: "Feb 10", score: 72 },
        { label: "Feb 24", score: 75 },
        { label: "Mar 08", score: 78 },
        { label: "Apr 15", score: 82 },
        { label: "May 02", score: 86 },
      ];
    }
    return examReports.slice(-8).map((r) => ({
      label: formatDate(r.createdAt).replace(/,.*/, ""),
      score: Math.round((r.resultJson as unknown as ExamQualityResult).overallScore),
    }));
  }, [examReports, DEMO_MODE]);

  const avgScore = DEMO_MODE ? 86 : examReports.length > 0
    ? Math.round(examReports.reduce((sum, r) => sum + (r.resultJson as unknown as ExamQualityResult).overallScore, 0) / examReports.length)
    : null;

  const scoreDelta = DEMO_MODE ? 8 : latestExam && previousExam ? Math.round(latestExam.overallScore - previousExam.overallScore) : null;

  const totalRecommendations = DEMO_MODE ? 3 : (reports ?? []).reduce((sum, r) => sum + r.recommendations.length, 0);

  // Repeated Questions Detected: near-duplicate matches (>=75% similarity) found
  // across every academic memory check the faculty member has run.
  const repeatedQuestionCount = DEMO_MODE ? 2 : similarityReports.reduce((sum, r) => {
    const result = r.resultJson as unknown as QuestionSimilarityResult;
    return sum + result.matches.filter((m) => m.similarityPercentage >= 75).length;
  }, 0);

  // CO Coverage Health: prefer a real CO Mapping report; fall back to the
  // latest exam's learning-outcome alignment when none has been run yet.
  const coverageOutcomes = DEMO_MODE ? [100, 40, 80] : latestCoMapping
    ? Object.values(latestCoMapping.coverage)
    : (latestExam?.learningOutcomeAlignment ?? []).map((o) => (o.addressed ? 100 : 0));
  const coCoverageHealth = DEMO_MODE ? 73 :
    coverageOutcomes.length > 0
      ? Math.round(coverageOutcomes.reduce((a, b) => a + b, 0) / coverageOutcomes.length)
      : null;
  const weakOutcomeCount = coverageOutcomes.filter((p) => p < 50).length;

  const difficultyBuckets = DEMO_MODE ? { Easy: 60, Medium: 30, Hard: 10 } as any : latestExam ? difficultyBucketBreakdown(latestExam.bloomDistribution) : null;
  const difficultyImbalanced = DEMO_MODE ? false : !!difficultyBuckets && difficultyBuckets.Easy > 55;

  const courseById = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c])), [courses]);

  const recentItems: RecentReportItem[] = DEMO_MODE ? [
    { id: 1, title: "Database Midterm — Exam Quality", meta: "Issues: 3", reportType: "EXAM_QUALITY", score: 86, createdAt: new Date().toISOString(), href: "#" },
    { id: 2, title: "Software Engineering — CO Mapping", meta: "Issues: 1", reportType: "CO_MAPPING", score: 92, createdAt: new Date(Date.now() - 86400000).toISOString(), href: "#" },
  ] as any : (reports ?? []).slice(0, 5).map((r) => {
    const course = r.courseId ? courseById.get(r.courseId) : undefined;
    return {
      id: r.id,
      title: course ? `${course.courseCode} — ${reportTypeLabel(r.reportType)}` : reportTypeLabel(r.reportType),
      meta: `Issues: ${r.recommendations.length}`,
      reportType: r.reportType,
      score: Number((r.resultJson as any)?.overallScore ?? (r.resultJson as any)?.coveragePercentage ?? (r.resultJson as any)?.qualityScore ?? 0),
      createdAt: r.createdAt,
      href: `/reports/${r.id}`,
    };
  });

  if (hasError) {
    return (
      <div className="rounded-md border border-error-border bg-error-bg px-4 py-3 text-small text-error">
        Could not load your dashboard data. Check your connection and reload the page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WelcomeHeader name={user?.name} />

      <div>
        <h2 className="mb-3 text-small font-semibold uppercase tracking-wide text-muted-foreground">
          Academic quality overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Average exam quality score"
                value={avgScore !== null ? `${avgScore}%` : "—"}
                icon={GraduationCap}
                index={0}
              />
              <StatCard
                label="Repeated questions detected"
                value={String(repeatedQuestionCount)}
                icon={Copy}
                index={1}
              />
              <StatCard
                label="CO coverage health"
                value={coCoverageHealth !== null ? `${coCoverageHealth}%` : "—"}
                icon={Target}
                index={2}
              />
              <StatCard label="AI recommendations" value={String(totalRecommendations)} icon={Sparkles} index={3} />
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-small font-semibold uppercase tracking-wide text-muted-foreground">Quality trend</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex flex-col justify-center rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current exam score</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-heading font-bold text-foreground">
                  {latestExam ? Math.round(latestExam.overallScore) : "—"}
                </span>
                <span className="text-small text-muted-foreground">/100</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Spring 2026</p>
            </div>
            
            <div className="flex flex-col justify-center rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous exam score</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-heading font-bold text-muted-foreground">
                  {previousExam ? Math.round(previousExam.overallScore) : "—"}
                </span>
                <span className="text-small text-muted-foreground">/100</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Fall 2025</p>
            </div>
          </div>
          
          <div className="lg:col-span-3">
            <ChartContainer
              title="Exam quality trend"
              description="Overall AI score across your most recent analyses"
              action={
                scoreDelta !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      scoreDelta >= 0
                        ? "border-success-border bg-success-bg text-success"
                        : "border-error-border bg-error-bg text-error"
                    }`}
                  >
                    {scoreDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {scoreDelta >= 0 ? "+" : ""}
                    {scoreDelta} pts vs. previous
                  </span>
                )
              }
            >
              {trendData.length > 0 ? (
                <QualityTrendChart data={trendData} />
              ) : (
                <ChartEmpty message="Run your first exam analysis to see a trend here." />
              )}
            </ChartContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-small font-semibold uppercase tracking-wide text-muted-foreground">Risk overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RiskCard
            level="HIGH"
            icon={GitCompareArrows}
            category="Repeated questions"
            finding={
              repeatedQuestionCount > 0
                ? `${repeatedQuestionCount} near-duplicate question(s) found against prior papers.`
                : "No near-duplicate questions detected."
            }
            active={repeatedQuestionCount > 0}
            index={0}
          />
          <RiskCard
            level="MEDIUM"
            icon={Target}
            category="Low CO coverage"
            finding={
              coverageOutcomes.length === 0
                ? "Run an exam or CO Mapping analysis to assess outcome coverage."
                : weakOutcomeCount > 0
                  ? `${weakOutcomeCount} course outcome(s) below 50% coverage.`
                  : "All course outcomes reasonably covered."
            }
            active={weakOutcomeCount > 0}
            index={1}
          />
          <RiskCard
            level="LOW"
            icon={Scale}
            category="Difficulty imbalance"
            finding={
              !difficultyBuckets
                ? "Run an exam analysis to assess difficulty balance."
                : difficultyImbalanced
                  ? `${Math.round(difficultyBuckets.Easy)}% of questions are recall-based (Easy).`
                  : "Difficulty is reasonably balanced across cognitive levels."
            }
            active={difficultyImbalanced}
            index={2}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-small font-semibold uppercase tracking-wide text-muted-foreground">
          Recent AI reports
        </h2>
        <RecentAnalysisList items={recentItems} />
      </div>
    </div>
  );
}
