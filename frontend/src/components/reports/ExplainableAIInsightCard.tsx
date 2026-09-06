import { LucideIcon } from "lucide-react";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export type InsightTone = "success" | "warning" | "error" | "neutral";

interface ExplainableAIInsightCardProps {
  icon: LucideIcon;
  label: string;
  result: string;
  confidence: number;
  reasoning: string;
  tone?: InsightTone;
  considered?: string[];
}

const toneBadge: Record<InsightTone, "success" | "warning" | "error" | "outline"> = {
  success: "success",
  warning: "warning",
  error: "error",
  neutral: "outline",
};

const confidenceTone = (confidence: number): "success" | "warning" | "error" => {
  if (confidence >= 75) return "success";
  if (confidence >= 50) return "warning";
  return "error";
};

/**
 * Every AI-derived value on AcadIQ renders through this card: the result, how
 * confident the model is, and — critically — what it considered and why it
 * reached that conclusion. Never show an AI output without this context.
 */
export default function ExplainableAIInsightCard({
  icon: Icon,
  label,
  result,
  confidence,
  reasoning,
  tone = "neutral",
  considered,
}: ExplainableAIInsightCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary-200 dark:hover:border-primary-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900">
            <Icon className="h-4.5 w-4.5 text-primary-700 dark:text-primary-300" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-base font-bold text-foreground tracking-tight">{result}</p>
          </div>
        </div>
        <Badge variant={toneBadge[tone]} className="text-xs font-semibold px-2.5 py-0.5">
          {result}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Evidence confidence</span>
          <span className="font-bold text-foreground tabular-nums">{Math.round(confidence)}%</span>
        </div>
        <Progress value={confidence} tone={confidenceTone(confidence)} className="h-2 rounded-full" />
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Reasoning
        </p>
        <p className="text-xs text-foreground/90 leading-relaxed font-normal">{reasoning}</p>
      </div>

      {considered && considered.length > 0 && (
        <div className="pt-1 border-t border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Evidence evaluated
          </p>
          <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {considered.map((item) => (
              <li
                key={item}
                className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground/80 shadow-2xs"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
