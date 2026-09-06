import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ScoreFactor } from "../../lib/insights";

export default function ScoreExplanationPanel({ factors }: { factors: ScoreFactor[] }) {
  const positives = factors.filter((f) => f.positive);
  const problems = factors.filter((f) => !f.positive);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground">Score Factor Decomposition</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Core evidentiary drivers weighted by the AcadIQ evaluation engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-success-border bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
            {positives.length} Strengths
          </span>
          <span className="inline-flex items-center rounded-md border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
            {problems.length} Advisories
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-success-border/60 bg-success-bg/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-success mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-success" /> Validated Strengths
          </p>
          <ul className="flex flex-col gap-2.5">
            {positives.length === 0 && (
              <li className="text-xs text-muted-foreground italic">No distinctive positive factors logged yet.</li>
            )}
            {positives.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-xs font-medium text-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span className="leading-relaxed">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-warning-border/60 bg-warning-bg/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warning mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-warning" /> Areas for Quality Improvement
          </p>
          <ul className="flex flex-col gap-2.5">
            {problems.length === 0 && (
              <li className="text-xs text-muted-foreground italic">No non-compliance flags detected.</li>
            )}
            {problems.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-xs font-medium text-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span className="leading-relaxed">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
