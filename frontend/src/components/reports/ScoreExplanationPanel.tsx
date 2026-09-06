import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ScoreFactor } from "../../lib/insights";

export default function ScoreExplanationPanel({ factors }: { factors: ScoreFactor[] }) {
  const positives = factors.filter((f) => f.positive);
  const problems = factors.filter((f) => !f.positive);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-section font-semibold text-foreground">Why this score?</p>
      <p className="mt-1 text-small text-muted-foreground">
        The factors AcadIQ weighed most heavily in this exam's quality score.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-success">Positive factors</p>
          <ul className="flex flex-col gap-2">
            {positives.length === 0 && <li className="text-small text-muted-foreground">None identified yet.</li>}
            {positives.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-small text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-warning">Problems</p>
          <ul className="flex flex-col gap-2">
            {problems.length === 0 && <li className="text-small text-muted-foreground">None identified.</li>}
            {problems.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-small text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
