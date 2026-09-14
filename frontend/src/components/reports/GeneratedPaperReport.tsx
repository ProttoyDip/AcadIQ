import { FileText, Gauge, ListChecks, Repeat } from "lucide-react";
import ScoreHero from "./ScoreHero";
import ReliabilityCard from "./ReliabilityCard";
import ReportSection from "./ReportSection";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { GeneratedPaperResult } from "../../types";
import { bloomLabel } from "../../lib/format";

const SCORE_LABELS: Record<string, string> = {
  clarity: "Clarity (question review)",
  bloomFit: "Bloom fit vs target",
  outcomeFit: "CO weight fit",
  syllabusCoverage: "Syllabus coverage",
  originality: "Originality vs bank (embeddings)",
};

/**
 * A generated paper is only as good as its verifier. This view leads with the
 * machine-checkable objective and the iteration trace, then the paper itself.
 */
export default function GeneratedPaperReport({ result }: { result: GeneratedPaperResult }) {
  const v = result.verification;
  return (
    <>
      <ScoreHero
        score={v.objective}
        title="Verifier objective"
        subtitle={`${v.passed ? "Passed" : "Below"} the ${result.constraints.passThreshold} threshold · best of ${result.iterations.length} iteration${result.iterations.length === 1 ? "" : "s"}`}
      />
      <ReliabilityCard explanation={result.explanation} />

      <ReportSection icon={Gauge} title="Objective breakdown" explanation="Weighted, machine-checkable components. Clarity, CO fit and coverage come from the existing analysers; Bloom fit and originality are deterministic.">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(v.scores).map(([key, score]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-small">
                <span className="text-muted-foreground">{SCORE_LABELS[key] ?? key}</span>
                <span className="tabular-nums font-semibold text-foreground">{score} <span className="text-muted-foreground">× {v.weights[key]}%</span></span>
              </div>
              <Progress value={score} tone={score >= 75 ? "success" : score >= 50 ? "warning" : "error"} className="h-1.5" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 text-small sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bloom (marks %) — target → observed</p>
            <ul className="space-y-0.5 tabular-nums">
              {Object.keys(result.constraints.targetBloom).map((level) => (
                <li key={level} className="flex justify-between">
                  <span>{bloomLabel(level)}</span>
                  <span>{Math.round(result.constraints.targetBloom[level])}% → {Math.round(v.observedBloom[level] ?? 0)}%</span>
                </li>
              ))}
            </ul>
          </div>
          {result.constraints.outcomeWeights && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course outcomes (marks %) — target → observed</p>
              <ul className="space-y-0.5 tabular-nums">
                {Object.keys(result.constraints.outcomeWeights).map((code) => (
                  <li key={code} className="flex justify-between">
                    <span>{code}</span>
                    <span>{Math.round(result.constraints.outcomeWeights![code])}% → {Math.round(v.observedOutcomes[code] ?? 0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {v.violations.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining violations</p>
            <ul className="list-disc space-y-0.5 pl-5 text-small text-muted-foreground">
              {v.violations.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </ReportSection>

      <ReportSection icon={Repeat} title="Generate → verify → repair trace" explanation={`${result.totalLlmCalls} LLM calls in total. Each iteration's verifier feedback was fed back into the next generation.`}>
        <ol className="space-y-2">
          {result.iterations.map((it) => (
            <li key={it.iteration} className={`rounded-lg border p-3 ${it.iteration === result.bestIteration ? "border-primary-300 bg-primary-50/40 dark:border-primary-800 dark:bg-primary-950/30" : "border-border"}`}>
              <div className="flex flex-wrap items-center gap-2 text-small">
                <span className="font-semibold">Iteration {it.iteration}</span>
                <Badge variant={it.passed ? "success" : "warning"} className="tabular-nums">{it.objective}/100 {it.passed ? "passed" : "repair"}</Badge>
                <span className="text-muted-foreground">{it.questionCount} questions</span>
                {it.iteration === result.bestIteration && <Badge variant="outline">best</Badge>}
              </div>
              {it.violations.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {it.violations.slice(0, 6).map((item, i) => <li key={i}>{item}</li>)}
                  {it.violations.length > 6 && <li>…and {it.violations.length - 6} more</li>}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </ReportSection>

      <ReportSection icon={FileText} title={result.paper.title} explanation={result.paper.designNotes}>
        <ol className="space-y-3">
          {result.paper.questions.map((q) => (
            <li key={q.sequenceNumber} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-small text-foreground"><span className="font-semibold">Q{q.sequenceNumber}.</span> {q.text}</p>
                <Badge variant="outline" className="shrink-0 tabular-nums">{q.marks} marks</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="muted">{bloomLabel(q.intendedBloom)}</Badge>
                {q.intendedOutcome && <Badge variant="muted">{q.intendedOutcome}</Badge>}
                <Badge variant="muted">{q.topic}</Badge>
                {v.nearDuplicates.some((d) => d.sequenceNumber === q.sequenceNumber) && <Badge variant="error">near-duplicate of bank</Badge>}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Total {v.marksTotal} / {result.constraints.totalMarks} marks.</p>
      </ReportSection>

      <ReportSection icon={ListChecks} title="What this is not" explanation="The objective measures constraint satisfaction as judged by AcadIQ's own analysers plus deterministic checks. It is not a measure of pedagogical quality, and every question still needs faculty review before use.">
        <p className="text-small text-muted-foreground">Use the thumbs and Bloom corrections on the Question Review report once this paper is uploaded to keep improving the labels.</p>
      </ReportSection>
    </>
  );
}
