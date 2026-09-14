import { Sparkles, ShieldCheck, Activity, Database } from "lucide-react";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { AIExplanation } from "../../types";

const tone = (value: number): "success" | "warning" | "error" => (value >= 75 ? "success" : value >= 50 ? "warning" : "error");

/**
 * Reliability v2 surface: two honest numbers instead of one misleading one.
 *  - Evidence sufficiency: how much input the analysis had (reproducible arithmetic).
 *  - Model agreement: how stable the answer was across independent samples.
 *    Shown as "not measured" for single runs — never defaulted to 100.
 * Neither is accuracy; there is no labelled ground truth yet (see faculty feedback).
 */
export default function ReliabilityCard({ explanation }: { explanation: AIExplanation }) {
  const v2 = explanation.reliabilityVersion === 2;
  const evidence = v2 ? explanation.evidenceSufficiency ?? explanation.confidence : explanation.confidence;
  const agreement = v2 ? explanation.modelAgreement ?? null : null;
  const breakdown = explanation.evidenceBreakdown;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 dark:border-primary-900 dark:bg-primary-950/60">
            <Sparkles className="h-4.5 w-4.5 text-primary-700 dark:text-primary-300" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI decision</p>
            <p className="text-base font-bold tracking-tight text-foreground">{explanation.decision}</p>
          </div>
        </div>
        <Badge variant={tone(explanation.confidence)} className="px-2.5 py-0.5 text-xs font-semibold tabular-nums">
          {Math.round(explanation.confidence)}% confidence
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Evidence sufficiency</span>
            <span className="font-bold tabular-nums text-foreground">{Math.round(evidence)}%</span>
          </div>
          <Progress value={evidence} tone={tone(evidence)} className="h-2 rounded-full" />
          {breakdown && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              docs {breakdown.documentCompleteness}/30 · questions {breakdown.questionSample}/25 · syllabus {breakdown.syllabus}/20 · COs {breakdown.courseOutcomes}/15 · history {breakdown.history}/10
            </p>
          )}
          {!v2 && <p className="text-[11px] text-muted-foreground">Legacy report (v1): this number is input completeness only.</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Model agreement</span>
            <span className="font-bold tabular-nums text-foreground">{agreement === null ? "—" : `${Math.round(agreement)}%`}</span>
          </div>
          {agreement === null ? (
            <div className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Not measured — single run. Re-run as <span className="font-semibold">Verified</span> (3 samples) or <span className="font-semibold">Cross-model</span> (two vendors) to measure stability.
            </div>
          ) : (
            <>
              <Progress value={agreement} tone={tone(agreement)} className="h-2 rounded-full" />
              <p className="text-[11px] text-muted-foreground">
                {explanation.agreementMode === "cross-model"
                  ? `Agreement between ${(explanation.agreementModels ?? []).join(" and ")} — two vendors, not accuracy.`
                  : `Stability across ${explanation.sampleCount} independent samples — not accuracy.`}
              </p>
            </>
          )}
        </div>
      </div>

      {explanation.retrievalSupport !== null && explanation.retrievalSupport !== undefined && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Retrieval support {explanation.retrievalSupport}% (best embedding cosine; model-free)
        </p>
      )}

      <div className="space-y-1 rounded-lg border border-border/80 bg-muted/40 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reasoning</p>
        <p className="text-xs leading-relaxed text-foreground/90">{explanation.reason}</p>
        {explanation.reliabilityNote && (
          <p className="pt-1 text-[11px] italic leading-relaxed text-muted-foreground">{explanation.reliabilityNote}</p>
        )}
      </div>
    </div>
  );
}
