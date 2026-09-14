import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, GraduationCap, ScrollText, TrendingUp, UploadCloud, Presentation } from "lucide-react";
import TeachingMaterialsPanel from "../components/upload/TeachingMaterialsPanel";
import { useCourse } from "../hooks/useCourses";
import { useReports } from "../hooks/useReports";
import PageHeader from "../components/layout/PageHeader";
import AnalysisActions from "../components/analysis/AnalysisActions";
import QualityTrendChart, { QualityTrendPoint } from "../components/analytics/QualityTrendChart";
import RecentAnalysisList, { RecentReportItem } from "../components/dashboard/RecentAnalysisList";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";
import { formatDate, reportTypeLabel } from "../lib/format";
import { cn } from "../lib/utils";
import { AnalysisReport, QuestionPaper } from "../types";

function reportScore(report: AnalysisReport): number {
  const result = report.resultJson as Record<string, unknown>;
  const raw = result.overallScore ?? result.qualityScore ?? result.coveragePercentage ?? result.confidence;
  if (typeof raw === "number") return raw;
  if (report.reportType === "QUESTION_SIMILARITY" && typeof result.overallDuplicationPercentage === "number") {
    return Math.max(0, 100 - result.overallDuplicationPercentage);
  }
  return 0;
}

function paperLabel(paper: QuestionPaper): string {
  return `${paper.semester} ${paper.year}`;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = id ? Number(id) : null;
  const { data: course, isLoading, isError } = useCourse(courseId);
  const { data: allReports } = useReports();
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);

  const papers = useMemo(
    () => [...(course?.questionPapers ?? [])].sort((a, b) => b.year - a.year || b.uploadedAt.localeCompare(a.uploadedAt)),
    [course]
  );
  const activePaperId = selectedPaperId ?? papers[0]?.id ?? null;
  const activePaper = papers.find((p) => p.id === activePaperId) ?? null;

  const courseReports = useMemo(
    () =>
      (allReports ?? [])
        .filter((r) => r.courseId === courseId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allReports, courseId]
  );

  // One point per paper (latest exam-quality report), oldest term first.
  const trend: QualityTrendPoint[] = useMemo(() => {
    const latestByPaper = new Map<number, AnalysisReport>();
    for (const r of courseReports) {
      if (r.reportType !== "EXAM_QUALITY" || !r.questionPaperId) continue;
      if (!latestByPaper.has(r.questionPaperId)) latestByPaper.set(r.questionPaperId, r);
    }
    return [...papers]
      .reverse()
      .filter((p) => latestByPaper.has(p.id))
      .map((p) => ({ label: paperLabel(p), score: Math.round(reportScore(latestByPaper.get(p.id)!)) }));
  }, [courseReports, papers]);

  const recentItems: RecentReportItem[] = useMemo(
    () =>
      courseReports.map((r) => {
        const paper = papers.find((p) => p.id === r.questionPaperId);
        return {
          id: r.id,
          title: reportTypeLabel(r.reportType),
          meta: paper ? paperLabel(paper) : course?.courseCode ?? "",
          reportType: r.reportType,
          score: reportScore(r),
          createdAt: r.createdAt,
          href: `/reports/${r.id}`,
        };
      }),
    [courseReports, papers, course?.courseCode]
  );

  if (isLoading) return <LoadingState label="Loading course..." />;
  if (isError || !course) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Course not found"
        description="This course may have been removed, or you may not have access to it."
      />
    );
  }

  const syllabus = course.syllabusDocuments?.[0];
  const paperReports = activePaper ? courseReports.filter((r) => r.questionPaperId === activePaper.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <Link to="/courses" className="inline-flex items-center gap-1 text-small font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      <PageHeader
        title={`${course.courseCode} — ${course.courseName}`}
        description={course.description || "Question papers, analyses and quality trend for this course."}
        actions={
          <Button asChild>
            <Link to="/upload">
              <UploadCloud className="h-4 w-4" /> Upload paper
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ScrollText} label="Syllabus" value={syllabus ? "Uploaded" : "Missing"} meta={syllabus ? formatDate(syllabus.uploadedAt) : "Upload one to enable coverage checks"} tone={syllabus ? "success" : "warning"} />
        <StatCard icon={FileText} label="Question papers" value={String(papers.length)} meta={papers.length ? `Latest: ${paperLabel(papers[0])}` : "None uploaded yet"} />
        <StatCard icon={TrendingUp} label="Analyses run" value={String(courseReports.length)} meta={courseReports.length ? `Last: ${formatDate(courseReports[0].createdAt)}` : "Run your first audit below"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold tracking-tight">Question papers</CardTitle>
            <p className="text-xs text-muted-foreground">Select a paper to run or review its analyses.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {papers.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No question papers yet"
                description="Upload a question paper for this course to start analyzing it."
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {papers.map((paper) => {
                  const active = paper.id === activePaperId;
                  const count = courseReports.filter((r) => r.questionPaperId === paper.id).length;
                  return (
                    <li key={paper.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPaperId(paper.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-primary bg-primary-50/60 dark:bg-primary-950/40"
                            : "border-border hover:border-primary-200 hover:bg-muted/40 dark:hover:border-primary-800"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-small font-semibold text-foreground">{paperLabel(paper)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {paper.originalName} · {paper.questions?.length ?? 0} questions
                          </p>
                        </div>
                        <Badge variant={count > 0 ? "brand" : "muted"} className="shrink-0">
                          {count} {count === 1 ? "report" : "reports"}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {activePaper && (
              <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 dark:border-primary-800 dark:bg-primary-950/20">
                <p className="mb-3 text-small font-semibold text-foreground">
                  Analyze {paperLabel(activePaper)}
                </p>
                <AnalysisActions courseId={course.id} questionPaperId={activePaper.id} disabled={!syllabus} />
                {!syllabus && (
                  <p className="mt-2 text-xs text-warning">Upload a syllabus first — coverage and CO mapping depend on it.</p>
                )}
                {paperReports.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {paperReports.map((r) => (
                      <Link
                        key={r.id}
                        to={`/reports/${r.id}`}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                      >
                        {reportTypeLabel(r.reportType)} · {formatDate(r.createdAt)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold tracking-tight">Quality trend</CardTitle>
            <p className="text-xs text-muted-foreground">Exam quality score per term, from the latest analysis of each paper.</p>
          </CardHeader>
          <CardContent className="h-[280px]">
            <QualityTrendChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Presentation className="h-4 w-4 text-primary" /> Teaching materials
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Slides, notes and handouts you actually taught from. Indexed for the Copilot (cited by slide) and used to ground generated papers.
          </p>
        </CardHeader>
        <CardContent>
          <TeachingMaterialsPanel courseId={course.id} compact />
        </CardContent>
      </Card>

      <RecentAnalysisList items={recentItems} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  meta: string;
  tone?: "success" | "warning";
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("text-body font-bold", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{value}</p>
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        </div>
      </CardContent>
    </Card>
  );
}
