import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { reportService } from "../../services/reportService";
import { apiErrorMessage } from "../../services/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import ReportSection from "./ReportSection";
import { ReproduceResult } from "../../types";

const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`;

/**
 * "Defend the number": every LLM run behind this report with prompt version +
 * hash, model, temperature, input hash, token usage and agreement — plus a
 * one-click reproduction that re-runs at the same settings and diffs headlines.
 */
export default function ProvenancePanel({ reportId }: { reportId: number }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["provenance", reportId], queryFn: () => reportService.provenance(reportId) });
  const [result, setResult] = useState<ReproduceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reproduce = useMutation({
    mutationFn: () => reportService.reproduce(reportId),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Reproduction failed")),
  });

  return (
    <ReportSection
      icon={Fingerprint}
      title="Provenance"
      explanation="How this report was produced: prompt version, model, temperature, input hash, token usage and sample agreement. Reproduce re-runs at the same settings and diffs the headline numbers."
    >
      {isLoading && <p className="text-small text-muted-foreground">Loading provenance…</p>}
      {isError && <p className="text-small text-error">Provenance is unavailable for this report.</p>}
      {data && data.runs.length === 0 && (
        <p className="text-small text-muted-foreground">No run records — this report predates provenance tracking.</p>
      )}
      {data && data.runs.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-small text-muted-foreground">
            <Badge variant="outline" className="font-normal tabular-nums">{data.totals.llmCalls} LLM call{data.totals.llmCalls === 1 ? "" : "s"}</Badge>
            <Badge variant="outline" className="font-normal tabular-nums">{data.totals.cacheHits} cache hit{data.totals.cacheHits === 1 ? "" : "s"}</Badge>
            <Badge variant="outline" className="font-normal tabular-nums">{data.totals.totalTokens.toLocaleString()} tokens</Badge>
            <Badge variant="outline" className="font-normal tabular-nums">{(data.totals.latencyMs / 1000).toFixed(1)} s</Badge>
            <Badge variant="outline" className="font-normal">reliability v{data.reliabilityVersion}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3">Pipeline</th>
                  <th className="py-1.5 pr-3">Prompt</th>
                  <th className="py-1.5 pr-3">Model</th>
                  <th className="py-1.5 pr-3 text-right">Temp</th>
                  <th className="py-1.5 pr-3">Input</th>
                  <th className="py-1.5 pr-3 text-right">k</th>
                  <th className="py-1.5 pr-3 text-right">Agreement</th>
                  <th className="py-1.5 pr-3 text-right">Tokens</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.id} className="border-t border-border/60">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{run.pipeline}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs" title={run.prompt.hash}>
                      {run.prompt.version}@{short(run.prompt.hash)}
                      {!run.prompt.current && <Badge variant="warning" className="ml-1.5 font-normal">changed since</Badge>}
                    </td>
                    <td className="py-1.5 pr-3">{run.model}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{run.temperature.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs" title={run.inputHash}>{short(run.inputHash)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{run.sampleCount}{run.cacheHit ? " (cached)" : ""}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{run.agreement ? `${run.agreement.agreement}%` : "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{run.usage.totalTokens?.toLocaleString() ?? "—"}</td>
                    <td className="py-1.5 pr-3">
                      <Badge variant={run.status === "OK" ? "success" : "error"} className="font-normal">{run.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => reproduce.mutate()} disabled={reproduce.isPending || !data || data.runs.length === 0}>
          {reproduce.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {reproduce.isPending ? "Reproducing…" : "Reproduce this report"}
        </Button>
        <span className="text-xs text-muted-foreground">Re-runs the same analysis on the same inputs and diffs the headline figures.</span>
      </div>
      {error && <p className="mt-2 text-small text-error">{error}</p>}
      {result && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-small">
          <div className="flex flex-wrap items-center gap-2">
            {result.identical ? (
              <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Headline reproduced exactly</Badge>
            ) : (
              <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Headline differs</Badge>
            )}
            <Badge variant="outline" className="font-normal">inputs {result.inputsUnchanged ? "unchanged" : "changed"}</Badge>
            <Badge variant="outline" className="font-normal">prompts {result.promptsUnchanged ? "unchanged" : "changed"}</Badge>
            <Link to={`/reports/${result.reproducedReportId}`} className="text-primary underline-offset-2 hover:underline">
              Open report #{result.reproducedReportId}
            </Link>
          </div>
          {Object.keys(result.headline.changes).length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {Object.entries(result.headline.changes).map(([key, change]) => (
                <li key={key}>
                  <span className="font-medium text-foreground">{key}</span>: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{result.note}</p>
        </div>
      )}
    </ReportSection>
  );
}
