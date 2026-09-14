import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileBarChart, Search } from "lucide-react";
import { useReports } from "../hooks/useReports";
import { useCourses } from "../hooks/useCourses";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";
import { Button } from "../components/ui/button";
import { formatDateTime, reportTypeLabel, scoreTone } from "../lib/format";
import { AnalysisReport, ReportType } from "../types";

const TYPES: ReportType[] = ["EXAM_QUALITY", "SYLLABUS_COVERAGE", "QUESTION_REVIEW", "CO_MAPPING", "QUESTION_SIMILARITY"];

function headlineMetric(report: AnalysisReport): { label: string; value: number } | null {
  const r = report.resultJson as Record<string, unknown>;
  switch (report.reportType) {
    case "EXAM_QUALITY":
      return typeof r.overallScore === "number" ? { label: "Quality", value: r.overallScore } : null;
    case "SYLLABUS_COVERAGE":
      return typeof r.coveragePercentage === "number" ? { label: "Coverage", value: r.coveragePercentage } : null;
    case "QUESTION_SIMILARITY":
      return typeof r.overallDuplicationPercentage === "number"
        ? { label: "Originality", value: 100 - r.overallDuplicationPercentage }
        : null;
    default:
      return typeof r.qualityScore === "number" ? { label: "Quality", value: r.qualityScore } : null;
  }
}

export default function Reports() {
  const { data: reports, isLoading, isError, error, refetch } = useReports();
  const { data: courses } = useCourses();
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

  const courseById = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c])), [courses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reports ?? [])
      .filter((r) => courseFilter === "all" || String(r.courseId) === courseFilter)
      .filter((r) => typeFilter === "all" || r.reportType === typeFilter)
      .filter((r) => {
        if (!q) return true;
        const course = r.courseId ? courseById.get(r.courseId) : undefined;
        return `${course?.courseCode ?? ""} ${course?.courseName ?? ""} ${reportTypeLabel(r.reportType)} #${r.id}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, courseFilter, typeFilter, query, courseById]);

  if (isLoading) return <LoadingState label="Loading reports..." />;

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Analysis reports" description="Every AI audit you have run, across all courses and paper versions." />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load reports"
          description={apiErrorMessage(error, "The reports request failed. Your existing reports are unaffected.")}
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analysis reports"
        description="Every AI audit you have run, across all courses and paper versions."
        actions={
          <Button asChild>
            <Link to="/upload">New analysis</Link>
          </Button>
        }
      />

      <Card className="shadow-xs">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course or report type…"
              className="pl-9"
              aria-label="Search reports"
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="sm:w-56" aria-label="Filter by course">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {(courses ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.courseCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {reportTypeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title={reports && reports.length > 0 ? "No reports match these filters" : "No reports yet"}
          description={
            reports && reports.length > 0
              ? "Try clearing the search or choosing a different course or type."
              : "Upload a syllabus and question paper, then run a full audit to generate your first reports."
          }
        />
      ) : (
        <Card className="shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Recommendations</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const course = r.courseId ? courseById.get(r.courseId) : undefined;
                const metric = headlineMetric(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/reports/${r.id}`} className="font-semibold text-primary hover:underline">
                        #{r.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {course ? (
                        <Link to={`/courses/${course.id}`} className="hover:underline">
                          <span className="font-medium text-foreground">{course.courseCode}</span>
                          <span className="ml-1.5 text-muted-foreground">{course.courseName}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{reportTypeLabel(r.reportType)}</Badge>
                    </TableCell>
                    <TableCell>
                      {metric ? (
                        <Badge variant={scoreTone(metric.value)} className="tabular-nums">
                          {metric.label} {Math.round(metric.value)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.recommendations.length}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
