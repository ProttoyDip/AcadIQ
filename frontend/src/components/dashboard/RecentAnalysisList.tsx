import { Link } from "react-router-dom";
import { FileBarChart, GraduationCap, GitCompareArrows, BookOpenCheck, Target, Brain, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { EmptyState } from "../ui/empty-state";
import { formatDate, scoreTone } from "../../lib/format";
import { ReportType } from "../../types";

export interface RecentReportItem {
  id: number;
  title: string;
  meta: string;
  reportType: ReportType;
  score: number;
  createdAt: string;
  href?: string;
}

const reportIcon: Record<ReportType, typeof FileBarChart> = {
  EXAM_QUALITY: FileBarChart,
  SYLLABUS_COVERAGE: BookOpenCheck,
  QUESTION_SIMILARITY: GitCompareArrows,
  CO_MAPPING: Target,
  QUESTION_REVIEW: Brain,
};

export default function RecentAnalysisList({ items }: { items: RecentReportItem[] }) {
  const recent = items.slice(0, 5);

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-bold tracking-tight">Recent AI Quality Audits</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Historical evaluations and compliance reports</p>
        </div>
        <Link
          to="/upload"
          className="text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          Analyze new paper &rarr;
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No audit reports generated yet"
            description="Upload a course syllabus and examination paper to run your initial AI quality assessment."
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {recent.map((item) => {
              const Icon = reportIcon[item.reportType];
              const Row = (
                <div
                  className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900">
                      <Icon className="h-4.5 w-4.5 text-primary-700 dark:text-primary-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground tracking-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.meta} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={scoreTone(item.score)} className="font-semibold tabular-nums text-xs">
                      {Math.round(item.score)}% Score
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.id} to={item.href} className="block">
                  {Row}
                </Link>
              ) : (
                <div key={item.id}>{Row}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
