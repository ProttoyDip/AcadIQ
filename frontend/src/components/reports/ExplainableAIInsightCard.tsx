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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50">
            <Icon className="h-4 w-4 text-primary-700" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-small font-semibold text-foreground">{result}</p>
          </div>
        </div>
        <Badge variant={toneBadge[tone]}>{result}</Badge>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>AI confidence</span>
          <span className="font-medium text-foreground">{Math.round(confidence)}%</span>
        </div>
        <Progress value={confidence} tone={confidenceTone(confidence)} className="h-1.5" />
      </div>

      <div className={cn("rounded-md bg-muted/50 p-3")}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why this decision was made</p>
        <p className="mt-1 text-small text-foreground">{reasoning}</p>
      </div>

      {considered && considered.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What AI considered</p>
          <ul className="mt-1 flex flex-col gap-1 text-small text-muted-foreground">
            {considered.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
