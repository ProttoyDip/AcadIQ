import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Target } from "lucide-react";
import { workflowService } from "../../services/workflowService";
import { apiErrorMessage } from "../../services/api";
import { bloomLabel } from "../../lib/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { BloomLevel, BlueprintComparison } from "../../types";

const BLOOM: BloomLevel[] = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"];
const VERDICT: Record<BlueprintComparison["verdict"], { label: string; tone: "success" | "warning" | "error" }> = {
  ON_TARGET: { label: "On target", tone: "success" },
  MINOR_DRIFT: { label: "Minor drift", tone: "warning" },
  OFF_TARGET: { label: "Off target", tone: "error" },
};

function DeviationBars({ rows }: { rows: Array<{ label: string; target: number; observed: number; deviation: number }> }) {
  const max = Math.max(100, ...rows.map((r) => Math.max(r.target, r.observed)));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">{row.label}</span>
            <span className={Math.abs(row.deviation) > 15 ? "text-error" : Math.abs(row.deviation) > 5 ? "text-warning" : "text-muted-foreground"}>
              {row.observed}% vs {row.target}% ({row.deviation > 0 ? "+" : ""}
              {row.deviation})
            </span>
          </div>
          <div className="relative mt-1 h-2 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary/80" style={{ width: `${(row.observed / max) * 100}%` }} />
            <div className="absolute -top-0.5 h-3 w-0.5 bg-foreground" style={{ left: `${(row.target / max) * 100}%` }} title={`Target ${row.target}%`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Faculty-owned target distribution; papers are judged against it rather than a generic ideal. */
export default function BlueprintPanel({ courseId, paperId, outcomes }: { courseId: number; paperId: number | null; outcomes: string[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [bloom, setBloom] = useState<Record<BloomLevel, number>>({ REMEMBER: 10, UNDERSTAND: 20, APPLY: 30, ANALYZE: 20, EVALUATE: 10, CREATE: 10 });
  const [outcomeWeights, setOutcomeWeights] = useState<Record<string, number>>({});
  const [totalMarks, setTotalMarks] = useState(100);
  const [questionCount, setQuestionCount] = useState(8);
  const [dirty, setDirty] = useState(false);

  const blueprint = useQuery({ queryKey: ["blueprint", courseId], queryFn: () => workflowService.getBlueprint(courseId) });
  const comparison = useQuery({
    queryKey: ["blueprint", courseId, "compare", paperId],
    queryFn: () => workflowService.compareBlueprint(courseId, paperId!),
    enabled: paperId !== null,
    retry: false,
  });

  useEffect(() => {
    if (!blueprint.data || dirty) return;
    setBloom((prev) => ({ ...prev, ...(blueprint.data.targetBloom as Record<BloomLevel, number>) }));
    setOutcomeWeights(blueprint.data.outcomeWeights ?? {});
    setTotalMarks(blueprint.data.totalMarks);
    setQuestionCount(blueprint.data.questionCount);
  }, [blueprint.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      workflowService.saveBlueprint(courseId, {
        targetBloom: bloom,
        outcomeWeights: Object.values(outcomeWeights).some((v) => v > 0) ? outcomeWeights : null,
        totalMarks,
        questionCount,
      }),
    onSuccess: () => {
      setError(null);
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["blueprint", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save blueprint")),
  });

  const bloomSum = useMemo(() => Object.values(bloom).reduce((s, v) => s + (Number(v) || 0), 0), [bloom]);
  const data = comparison.data;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-small font-semibold text-foreground">
            <Target className="h-4 w-4 text-primary" /> Course blueprint
            {blueprint.data?.isDefault && <Badge variant="muted">not saved yet</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">Your intended Bloom and CO weightage (percent of marks). Values are normalised to 100 on save.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BLOOM.map((level) => (
            <div key={level} className="flex flex-col gap-1">
              <Label htmlFor={`bp-${level}`} className="text-xs">
                {bloomLabel(level)}
              </Label>
              <Input
                id={`bp-${level}`}
                type="number"
                min={0}
                max={100}
                value={bloom[level]}
                onChange={(e) => {
                  setDirty(true);
                  setBloom((prev) => ({ ...prev, [level]: Number(e.target.value) }));
                }}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <p className={`text-xs ${Math.round(bloomSum) === 100 ? "text-muted-foreground" : "text-warning"}`}>Bloom total: {bloomSum}%</p>

        {outcomes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Outcome weights (optional)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {outcomes.map((code) => (
                <div key={code} className="flex flex-col gap-1">
                  <Label htmlFor={`bp-co-${code}`} className="text-xs">
                    {code}
                  </Label>
                  <Input
                    id={`bp-co-${code}`}
                    type="number"
                    min={0}
                    max={100}
                    value={outcomeWeights[code] ?? 0}
                    onChange={(e) => {
                      setDirty(true);
                      setOutcomeWeights((prev) => ({ ...prev, [code]: Number(e.target.value) }));
                    }}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bp-total" className="text-xs">
              Total marks
            </Label>
            <Input id="bp-total" type="number" min={10} max={500} value={totalMarks} onChange={(e) => { setDirty(true); setTotalMarks(Number(e.target.value)); }} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bp-count" className="text-xs">
              Question count
            </Label>
            <Input id="bp-count" type="number" min={1} max={60} value={questionCount} onChange={(e) => { setDirty(true); setQuestionCount(Number(e.target.value)); }} className="h-9" />
          </div>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || bloomSum <= 0}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save blueprint
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-small font-semibold text-foreground">Selected paper vs blueprint</p>
        {paperId === null && <p className="text-xs text-muted-foreground">Select a paper to compare.</p>}
        {comparison.isLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Comparing…</p>}
        {comparison.isError && <p className="text-xs text-warning">{apiErrorMessage(comparison.error, "Could not compare")}</p>}
        {data && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant={VERDICT[data.verdict].tone}>{VERDICT[data.verdict].label}</Badge>
              <span className="text-xs text-muted-foreground">
                Fit {data.fitScore}/100 · largest deviation {data.maxAbsDeviation} pts · {data.totalMarks} marks
              </span>
            </div>
            <DeviationBars rows={data.bloom.map((r) => ({ label: bloomLabel(r.level), target: r.target, observed: r.observed, deviation: r.deviation }))} />
            {data.outcomes && data.outcomes.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-foreground">Course outcomes</p>
                <DeviationBars rows={data.outcomes.map((r) => ({ label: r.code, target: r.target, observed: r.observed, deviation: r.deviation }))} />
              </>
            )}
            {data.notes.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {data.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
