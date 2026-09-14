import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Loader2, MinusCircle, Sparkles } from "lucide-react";
import {
  useAnalyzeExam,
  useAnalyzeFull,
  useAnalyzeSyllabus,
  useMapCourseOutcomes,
  useReviewQuestions,
} from "../../hooks/useAnalysis";
import { apiErrorMessage } from "../../services/api";
import { FullAnalysisResult } from "../../types";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

interface AnalysisActionsProps {
  courseId: number;
  questionPaperId: number;
  disabled?: boolean;
  /** Navigate straight to the primary report when the full audit finishes (Upload flow). */
  navigateOnComplete?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  className?: string;
}

const SINGLE_RUNS = [
  { key: "exam", label: "Exam Quality only" },
  { key: "syllabus", label: "Syllabus Coverage only" },
  { key: "review", label: "Question Review only" },
  { key: "co", label: "CO Mapping only" },
] as const;

type SingleKey = (typeof SINGLE_RUNS)[number]["key"];

/**
 * One place that can trigger every analysis the backend offers for a paper.
 * The full audit runs them all server-side and reports per-step outcomes so a
 * single failing analysis never hides the ones that succeeded.
 */
export default function AnalysisActions({
  courseId,
  questionPaperId,
  disabled,
  navigateOnComplete,
  onStart,
  onFinish,
  className,
}: AnalysisActionsProps) {
  const navigate = useNavigate();
  const full = useAnalyzeFull();
  const exam = useAnalyzeExam();
  const syllabus = useAnalyzeSyllabus();
  const review = useReviewQuestions();
  const co = useMapCourseOutcomes();

  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningSingle, setRunningSingle] = useState<SingleKey | null>(null);
  // Verified = 3 sampled calls per analysis with model-agreement reporting. Full audit is always fast (5 analyses × 3 = too many calls).
  const [verified, setVerified] = useState(false);

  const busy = full.isPending || runningSingle !== null;

  async function runFull() {
    setError(null);
    setResult(null);
    onStart?.();
    try {
      const outcome = await full.mutateAsync({ courseId, questionPaperId });
      setResult(outcome);
      if (navigateOnComplete && outcome.primaryReportId) {
        navigate(`/reports/${outcome.primaryReportId}`, { state: { fullAnalysis: outcome } });
      }
    } catch (err) {
      setError(apiErrorMessage(err, "The audit could not be completed"));
    } finally {
      onFinish?.();
    }
  }

  async function runSingle(key: SingleKey) {
    setError(null);
    setResult(null);
    setRunningSingle(key);
    onStart?.();
    try {
      const args = { courseId, questionPaperId, reliability: verified ? ("verified" as const) : ("fast" as const) };
      const outcome =
        key === "exam" ? await exam.mutateAsync(args)
        : key === "syllabus" ? await syllabus.mutateAsync({ courseId, questionPaperId })
        : key === "review" ? await review.mutateAsync(args)
        : await co.mutateAsync(args);
      navigate(`/reports/${outcome.reportId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Analysis failed"));
    } finally {
      setRunningSingle(null);
      onFinish?.();
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={runFull} disabled={disabled || busy} className="gap-2 font-semibold shadow-xs">
          {full.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {full.isPending ? "Running full audit…" : "Run full audit"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={disabled || busy} className="gap-1.5">
              {runningSingle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {runningSingle ? SINGLE_RUNS.find((r) => r.key === runningSingle)?.label : "Single analysis"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SINGLE_RUNS.map((run) => (
              <DropdownMenuItem key={run.key} onSelect={() => runSingle(run.key)}>
                {run.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground" title="Runs the single analysis 3 times at higher temperature and reports how stable the answer was. Slower; uses ~3× the LLM budget.">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={verified} onChange={(e) => setVerified(e.target.checked)} disabled={disabled || busy} />
          Verified (3 samples, single analyses only)
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-error-border bg-error-bg/60 px-3 py-2 text-small text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && <FullAnalysisSummary result={result} />}
    </div>
  );
}

export function FullAnalysisSummary({ result }: { result: FullAnalysisResult }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-small font-semibold text-foreground">
          Full audit: {result.completed} completed{result.failed > 0 ? `, ${result.failed} failed` : ""}
        </p>
        {result.primaryReportId && (
          <Link
            to={`/reports/${result.primaryReportId}`}
            className="inline-flex items-center gap-1 text-small font-medium text-primary hover:underline"
          >
            Open main report <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <ul className="divide-y divide-border">
        {result.steps.map((step) => (
          <li key={step.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {step.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : step.status === "failed" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              ) : (
                <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-small font-medium text-foreground">{step.label}</p>
                {(step.error || step.note) && (
                  <p className="truncate text-xs text-muted-foreground">{step.error ?? step.note}</p>
                )}
              </div>
            </div>
            {step.reportId && (
              <Link to={`/reports/${step.reportId}`} className="shrink-0 text-xs font-medium text-primary hover:underline">
                View
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
