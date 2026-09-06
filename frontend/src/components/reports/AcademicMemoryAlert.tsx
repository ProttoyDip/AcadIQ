import { History, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface AcademicMemoryAlertProps {
  currentQuestionText: string;
  previousQuestionText: string;
  previousPaperLabel: string;
  similarityPercentage: number;
  recommendation?: string;
}

function similarityTone(pct: number): "error" | "warning" | "muted" {
  if (pct >= 75) return "error";
  if (pct >= 50) return "warning";
  return "muted";
}

export default function AcademicMemoryAlert({
  currentQuestionText,
  previousQuestionText,
  previousPaperLabel,
  similarityPercentage,
  recommendation,
}: AcademicMemoryAlertProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-warning-border/80 bg-warning-bg/10 p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-warning-border/40 pb-3">
        <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning-bg text-warning border border-warning-border">
            <History className="h-4 w-4" />
          </div>
          <span>Academic Memory Similarity Detected</span>
        </div>
        <Badge variant={similarityTone(similarityPercentage)} className="tabular-nums font-semibold text-xs">
          {Math.round(similarityPercentage)}% Pattern Match
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <span>Proposed Draft Question</span>
            <span className="text-primary-700 dark:text-primary-400 font-semibold">Current</span>
          </div>
          <p className="text-xs sm:text-sm text-foreground leading-relaxed font-medium">{currentQuestionText}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            <span>Historical Question</span>
            <span className="text-muted-foreground font-semibold">{previousPaperLabel}</span>
          </div>
          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-medium">{previousQuestionText}</p>
        </div>
      </div>

      {recommendation && (
        <div className="flex items-start gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-950/40 p-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-300" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary-800 dark:text-primary-300">
              Prescriptive Modification Guidance
            </p>
            <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed">{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
