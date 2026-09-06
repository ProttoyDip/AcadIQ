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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent AI reports</CardTitle>
        <Link to="/upload" className="text-small font-medium text-primary-700 hover:underline">
          Analyze new document
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No analyses yet"
            description="Upload a syllabus and question paper to generate your first AI quality report."
          />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {recent.map((item, i) => {
              const Icon = reportIcon[item.reportType];
              const Row = (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3.5 transition-colors first:pt-0 last:pb-0 hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50">
                      <Icon className="h-4 w-4 text-primary-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.meta} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={scoreTone(item.score)}>{Math.round(item.score)}%</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.div>
              );

              return item.href ? (
                <Link key={item.id} to={item.href}>
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
