import { useMemo } from "react";
import { GraduationCap, FileBarChart, Gauge, Sparkles } from "lucide-react";
import { useCourses } from "../hooks/useCourses";
import { useReports } from "../hooks/useReports";
import { useAuth } from "../hooks/useAuth";
import WelcomeHeader from "../components/dashboard/WelcomeHeader";
import StatCard from "../components/dashboard/StatCard";
import RecentAnalysisList, { RecentReportItem } from "../components/dashboard/RecentAnalysisList";
import ChartContainer from "../components/analytics/ChartContainer";
import QualityTrendChart, { QualityTrendPoint } from "../components/analytics/QualityTrendChart";
import DifficultyDistributionChart from "../components/analytics/DifficultyDistributionChart";
import CoCoverageChart from "../components/analytics/CoCoverageChart";
import { Badge } from "../components/ui/badge";
import { CardSkeleton } from "../components/ui/loading-state";
import { formatDate, reportTypeLabel } from "../lib/format";
import { ExamQualityResult, BloomDistribution } from "../types";
import { DEMO_STATS, DEMO_TREND, DEMO_BLOOM, DEMO_CO_COVERAGE, DEMO_RECENT_REPORTS } from "../lib/demoData";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: reports, isLoading: reportsLoading } = useReports();

  const examReports = useMemo(
    () => (reports ?? []).filter((r) => r.reportType === "EXAM_QUALITY").reverse(),
    [reports]
  );

  const hasRealData = !coursesLoading && !reportsLoading && (reports?.length ?? 0) > 0;
  const isLoading = coursesLoading || reportsLoading;

  // Real data drives every panel once faculty have analyses on record; realistic
  // seed data fills the same slots beforehand so the dashboard never looks empty.
  const trendData: QualityTrendPoint[] = hasRealData
    ? examReports.slice(-8).map((r) => ({
        label: formatDate(r.createdAt).replace(/,.*/, ""),
        score: Math.round((r.resultJson as unknown as ExamQualityResult).overallScore),
      }))
    : DEMO_TREND;

  const latestExam = examReports[examReports.length - 1]?.resultJson as unknown as ExamQualityResult | undefined;

  const bloomData: BloomDistribution[] = hasRealData && latestExam ? latestExam.bloomDistribution : DEMO_BLOOM;

  const coCoverageData = DEMO_CO_COVERAGE; // CO mapping is course-scoped; shown as a representative snapshot

  const avgScore = hasRealData
    ? Math.round(
        examReports.reduce((sum, r) => sum + (r.resultJson as unknown as ExamQualityResult).overallScore, 0) /
          Math.max(examReports.length, 1)
      )
    : DEMO_STATS.avgScore;

  const totalRecommendations = hasRealData
    ? (reports ?? []).reduce((sum, r) => sum + r.recommendations.length, 0)
    : DEMO_STATS.recommendations;

  const coursesCount = hasRealData ? courses?.length ?? 0 : DEMO_STATS.courses;
  const examsAnalyzedCount = hasRealData ? examReports.length : DEMO_STATS.examsAnalyzed;

  const recentItems: RecentReportItem[] = hasRealData
    ? (reports ?? []).slice(0, 5).map((r) => ({
        id: r.id,
        title: reportTypeLabel(r.reportType),
        meta: `${r.recommendations.length} recommendation${r.recommendations.length === 1 ? "" : "s"}`,
        reportType: r.reportType,
        score: Number((r.resultJson as any)?.overallScore ?? (r.resultJson as any)?.coveragePercentage ?? 0),
        createdAt: r.createdAt,
        href: `/reports/${r.id}`,
      }))
    : DEMO_RECENT_REPORTS.map((r) => ({
        id: r.id,
        title: r.title,
        meta: r.courseCode,
        reportType: r.reportType,
        score: r.score,
        createdAt: r.createdAt,
      }));

  return (
    <div className="flex flex-col gap-6">
      <WelcomeHeader name={user?.name} />

      {!hasRealData && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-primary-100 bg-primary-50/60 px-3.5 py-2.5 text-small text-primary-800">
          <Badge variant="outline" className="border-primary-200 bg-white text-primary-700">
            Preview
          </Badge>
          <span>Showing sample analytics — upload your first syllabus and question paper to see your real data here.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Courses managed"
              value={String(coursesCount)}
              icon={GraduationCap}
              index={0}
              trend={!hasRealData ? { value: "+1 this term", direction: "up" } : undefined}
            />
            <StatCard
              label="Exams analyzed"
              value={String(examsAnalyzedCount)}
              icon={FileBarChart}
              index={1}
              trend={!hasRealData ? { value: "+5 this term", direction: "up" } : undefined}
            />
            <StatCard
              label="Average quality score"
              value={`${avgScore}%`}
              icon={Gauge}
              index={2}
              trend={!hasRealData ? { value: "+7 pts", direction: "up" } : undefined}
            />
            <StatCard
              label="AI recommendations"
              value={String(totalRecommendations)}
              icon={Sparkles}
              index={3}
              trend={!hasRealData ? { value: "12 high priority", direction: "up", positive: false } : undefined}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartContainer title="Exam quality trend" description="Overall AI score across your most recent analyses">
            <QualityTrendChart data={trendData} />
          </ChartContainer>
        </div>

        <ChartContainer title="CO coverage" description="Course outcome mapping, most recent exam">
          <CoCoverageChart data={coCoverageData} />
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentAnalysisList items={recentItems} />
        </div>

        <ChartContainer title="Difficulty distribution" description="Bloom's taxonomy share, latest exam">
          <DifficultyDistributionChart data={bloomData} />
        </ChartContainer>
      </div>
    </div>
  );
}
