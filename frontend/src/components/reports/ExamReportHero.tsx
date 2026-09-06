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
  const toneBg = score >= 75 ? "bg-success-bg text-success border-success-border" : score >= 50 ? "bg-warning-bg text-warning border-warning-border" : "bg-error-bg text-error border-error-border";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex flex-col gap-8 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary-200 bg-primary-50 text-primary-800">
              <ShieldCheck className="h-3 w-3" /> AI Exam Analysis
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              AcadIQ Reasoning Engine
            </Badge>
          </div>

          <h2 className="mt-3 text-heading font-bold tracking-tight text-foreground">Exam Quality Score</h2>
          <p className={cn("mt-2 inline-flex items-center rounded-md border px-2.5 py-1 text-small font-medium", toneBg)}>
            {scoreLabel(score)}
          </p>
          <p className="mt-3 text-small text-muted-foreground">
            Evaluated against the course syllabus for topic coverage, cognitive difficulty, learning-outcome
            alignment, and originality against prior papers.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative flex h-36 w-36 shrink-0 items-center justify-center self-center"
        >
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
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-display leading-none text-foreground">{Math.round(score)}</span>
            <span className="mt-1 text-xs text-muted-foreground">out of 100</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-4">
        {metrics(props).map((m) => (
          <div key={m.label} className="flex items-center gap-2.5 px-5 py-4">
            <m.icon className="h-4 w-4 shrink-0 text-primary-600" />
            <div>
              <p className="text-body font-semibold leading-none text-foreground">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
