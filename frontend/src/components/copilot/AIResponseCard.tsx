import { Sparkles } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import SourceReferenceCard from "./SourceReferenceCard";

interface AIResponseCardProps {
  answer: string;
  reasoning: string;
  confidence: number;
  sources: string[];
}

export default function AIResponseCard({ answer, reasoning, confidence, sources }: AIResponseCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
          <p className="text-small leading-relaxed text-foreground">{answer}</p>
        </div>
      </div>

      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why</p>
        <p className="mt-1 text-small text-foreground">{reasoning}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConfidenceBadge confidence={confidence} />
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sources.map((s) => (
              <SourceReferenceCard key={s} label={s} />
            ))}
          </div>
        )}
      </div>

      {sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No AcadIQ data was available for this question — treat this answer as general guidance only.
        </p>
      )}
    </div>
  );
}
