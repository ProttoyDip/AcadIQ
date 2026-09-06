import { motion } from "framer-motion";
import { ShieldCheck, ListChecks, Hash, FlagTriangleRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface ExamReportHeroProps {
  score: number;
  totalQuestions: number;
  totalMarks: number;
  topicsAssessed: number;
  highPriorityFlags: number;
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent quality — ready to administer";
  if (score >= 70) return "Good quality — minor gaps to address";
  if (score >= 50) return "Needs improvement before use";
  return "Significant revision required";
}

const metrics = (props: ExamReportHeroProps) => [
  { icon: Hash, label: "Total questions", value: String(props.totalQuestions) },
  { icon: ListChecks, label: "Total marks", value: String(props.totalMarks) },
  { icon: ShieldCheck, label: "Topics assessed", value: String(props.topicsAssessed) },
  { icon: FlagTriangleRight, label: "High-priority flags", value: String(props.highPriorityFlags) },
];

export default function ExamReportHero(props: ExamReportHeroProps) {
  const { score } = props;
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  const tone = score >= 75 ? "#1a7f4b" : score >= 50 ? "#b7791f" : "#c22a2a";
  const toneBg =
    score >= 75
      ? "bg-success-bg text-success border-success-border"
      : score >= 50
        ? "bg-warning-bg text-warning border-warning-border"
        : "bg-error-bg text-error border-error-border";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-8 p-6 sm:p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-1 text-xs font-semibold text-primary-800 dark:text-primary-300">
              <ShieldCheck className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" /> Pre-Exam Quality Assurance
            </span>
            <span className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Institutional Audit Standard
            </span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Examination Quality Assessment
          </h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={cn("inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold tracking-wide", toneBg)}>
              {scoreLabel(score)}
            </span>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Multi-dimensional evaluation measuring topic distribution, Bloom’s cognitive difficulty, course learning outcome alignment, and cross-semester academic memory uniqueness.
          </p>
        </div>

        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center self-center sm:self-auto">
          <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
            <circle cx="64" cy="64" r="58" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <motion.circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              stroke={tone}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-bold leading-none text-foreground tabular-nums tracking-tight">{Math.round(score)}</span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Score / 100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y sm:divide-y-0 divide-border/80 border-t border-border/80 bg-muted/20 sm:grid-cols-4">
        {metrics(props).map((m) => (
          <div key={m.label} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card border border-border">
              <m.icon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-none text-foreground tabular-nums tracking-tight">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground truncate">{m.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
