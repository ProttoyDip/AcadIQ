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
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-small font-semibold text-foreground">
          <History className="h-4 w-4 text-primary-700" />
          Similar question found in academic memory
        </div>
        <Badge variant={similarityTone(similarityPercentage)}>{Math.round(similarityPercentage)}% similar</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current</p>
          <p className="mt-1 text-small text-foreground">{currentQuestionText}</p>
        </div>
        <div className={cn("rounded-md border border-border bg-muted/40 p-3")}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous — {previousPaperLabel}</p>
          <p className="mt-1 text-small text-foreground">{previousQuestionText}</p>
        </div>
      </div>

      {recommendation && (
        <div className="flex items-start gap-2.5 rounded-md bg-primary-50/60 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-700">AI recommendation</p>
            <p className="text-small text-foreground">{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
