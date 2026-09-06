import { useMemo } from "react";
import { GraduationCap, FileBarChart, Gauge, Sparkles } from "lucide-react";
import { useCourses } from "../hooks/useCourses";
import { useReports } from "../hooks/useReports";
import { useAuth } from "../hooks/useAuth";
import WelcomeHeader from "../components/dashboard/WelcomeHeader";
import StatCard from "../components/dashboard/StatCard";
import RecentAnalysisList, { RecentReportItem } from "../components/dashboard/RecentAnalysisList";
import ChartContainer from "../components/analytics/ChartContainer";
import QualityTrendChart from "../components/analytics/QualityTrendChart";
import DifficultyDistributionChart from "../components/analytics/DifficultyDistributionChart";
import CoCoverageChart, { CoCoveragePoint } from "../components/analytics/CoCoverageChart";
import { CardSkeleton } from "../components/ui/loading-state";
import { formatDate, reportTypeLabel } from "../lib/format";
import { ExamQualityResult } from "../types";

function ChartEmpty({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-small text-muted-foreground">{message}</div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: courses, isLoading: coursesLoading, isError: coursesError } = useCourses();
  const { data: reports, isLoading: reportsLoading, isError: reportsError } = useReports();

  const isLoading = coursesLoading || reportsLoading;
  const hasError = coursesError || reportsError;

  const examReports = useMemo(
    () => (reports ?? []).filter((r) => r.reportType === "EXAM_QUALITY").slice().reverse(),
    [reports]
  );

  const latestExam = examReports[examReports.length - 1]?.resultJson as unknown as ExamQualityResult | undefined;

  const trendData = useMemo(
    () =>
      examReports.slice(-8).map((r) => ({
        label: formatDate(r.createdAt).replace(/,.*/, ""),
        score: Math.round((r.resultJson as unknown as ExamQualityResult).overallScore),
      })),
    [examReports]
  );

  const coCoverageData: CoCoveragePoint[] = useMemo(
    () =>
      (latestExam?.learningOutcomeAlignment ?? []).map((o) => ({
        outcome: o.outcome,
        percentage: o.addressed ? 100 : 0,
      })),
    [latestExam]
  );

  const avgScore =
    examReports.length > 0
      ? Math.round(
          examReports.reduce((sum, r) => sum + (r.resultJson as unknown as ExamQualityResult).overallScore, 0) /
            examReports.length
        )
      : null;

  const totalRecommendations = (reports ?? []).reduce((sum, r) => sum + r.recommendations.length, 0);

  const courseById = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c])), [courses]);

  const recentItems: RecentReportItem[] = (reports ?? []).slice(0, 5).map((r) => {
    const course = r.courseId ? courseById.get(r.courseId) : undefined;
    return {
      id: r.id,
      title: course ? `${course.courseCode} — ${reportTypeLabel(r.reportType)}` : reportTypeLabel(r.reportType),
      meta: `${r.recommendations.length} recommendation${r.recommendations.length === 1 ? "" : "s"}`,
      reportType: r.reportType,
      score: Number((r.resultJson as any)?.overallScore ?? (r.resultJson as any)?.coveragePercentage ?? 0),
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Courses managed" value={String(courses?.length ?? 0)} icon={GraduationCap} index={0} />
            <StatCard label="Exams analyzed" value={String(examReports.length)} icon={FileBarChart} index={1} />
            <StatCard
              label="Average quality score"
              value={avgScore !== null ? `${avgScore}%` : "—"}
              icon={Gauge}
              index={2}
            />
            <StatCard label="AI recommendations" value={String(totalRecommendations)} icon={Sparkles} index={3} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartContainer title="Exam quality trend" description="Overall AI score across your most recent analyses">
            {trendData.length > 0 ? (
              <QualityTrendChart data={trendData} />
            ) : (
              <ChartEmpty message="Run your first exam analysis to see a trend here." />
            )}
          </ChartContainer>
        </div>

        <ChartContainer title="CO coverage" description="Course outcome mapping, most recent exam">
          {coCoverageData.length > 0 ? (
            <CoCoverageChart data={coCoverageData} />
          ) : (
            <ChartEmpty message="Run an exam analysis to see course outcome coverage." />
          )}
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentAnalysisList items={recentItems} />
        </div>

        <ChartContainer title="Difficulty distribution" description="Bloom's taxonomy share, latest exam">
          {latestExam ? (
            <DifficultyDistributionChart data={latestExam.bloomDistribution} />
          ) : (
            <ChartEmpty message="No Bloom's taxonomy data yet." />
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
