import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2, Sparkles, Check } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { fmtShortDate } from "../../lib/dates";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { PaceReport, ReplanResult } from "../../types";

const TONE: Record<PaceReport["status"], { label: string; tone: "success" | "warning" | "error" | "muted" }> = {
  AHEAD: { label: "Ahead of plan", tone: "success" },
  ON_TRACK: { label: "On track", tone: "success" },
  BEHIND: { label: "Behind", tone: "warning" },
  AT_RISK: { label: "Will not finish", tone: "error" },
  NO_PLAN: { label: "No lecture plan", tone: "muted" },
  NO_TERM: { label: "No term", tone: "muted" },
};

/** Planned-vs-covered for one course, with an AI re-plan of the remaining sessions. */
export default function PaceCard({ courseId }: { courseId: number }) {
  const queryClient = useQueryClient();
  const pace = useQuery({ queryKey: ["schedule", "pace", courseId], queryFn: () => scheduleService.pace(courseId) });
  const [preview, setPreview] = useState<ReplanResult | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const replan = useMutation({
    mutationFn: (apply: boolean) => scheduleService.replan(courseId, note || undefined, apply),
    onSuccess: (r) => {
      setPreview(r);
      setError(null);
      if (r.applied) void queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Re-plan failed")),
  });
  const p = pace.data;
  if (!p) return null;
  const pct = p.plannedTopics.length ? Math.round((p.coveredTopics.length / p.plannedTopics.length) * 100) : 0;
  const t = TONE[p.status];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-small font-semibold text-foreground"><Gauge className="h-4 w-4 text-primary" /> Syllabus pace <Badge variant={t.tone}>{t.label}</Badge></p>
        {p.term ? <span className="text-xs text-muted-foreground">{p.term.name} · {p.sessions.held} held · {p.sessions.remaining} left · {p.sessions.lost} lost</span> : <Link to="/schedule" className="text-xs text-primary hover:underline">Set up a term →</Link>}
      </div>
      {p.plannedTopics.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Progress value={pct} tone={t.tone === "muted" ? "primary" : t.tone} className="h-2" />
            <span className="shrink-0 text-xs font-semibold text-foreground">{p.coveredTopics.length}/{p.plannedTopics.length} topics</span>
          </div>
          <p className="text-xs text-muted-foreground">{p.note}{p.deltaTopics !== 0 && p.status !== "NO_PLAN" ? ` Expected about ${p.expectedCoveredByNow} by now (${p.deltaTopics > 0 ? "+" : ""}${p.deltaTopics}).` : ""}</p>
        </>
      )}
      {p.status === "NO_PLAN" && <p className="text-xs text-muted-foreground">{p.note}</p>}
      {p.term && p.plannedTopics.length > 0 && p.sessions.remaining > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the planner (optional): e.g. skip NoSQL, keep 2 sessions for revision" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" />
            <Button size="sm" variant="outline" onClick={() => replan.mutate(false)} disabled={replan.isPending}>
              {replan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Re-plan remaining sessions
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
          {preview && (
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <p className="text-foreground">{preview.summary}</p>
              {preview.dropped.length > 0 && <p className="text-error">Dropped: {preview.dropped.join(", ")}</p>}
              {preview.compressed.length > 0 && <p className="text-warning">Compressed: {preview.compressed.join(", ")}</p>}
              <ul className="max-h-56 overflow-y-auto divide-y divide-border rounded-md border border-border">
                {preview.sessions.map((s) => (
                  <li key={s.sessionId} className="flex gap-3 px-2 py-1.5">
                    <span className="w-16 shrink-0 font-semibold text-foreground">{fmtShortDate(s.date)}</span>
                    <span className="text-foreground">{s.topics.join(" · ")}{s.note ? <span className="text-muted-foreground"> — {s.note}</span> : null}</span>
                  </li>
                ))}
              </ul>
              {!preview.applied ? (
                <div><Button size="sm" onClick={() => replan.mutate(true)} disabled={replan.isPending}><Check className="h-4 w-4" /> Apply to calendar</Button></div>
              ) : (
                <p className="text-success">Applied — each remaining session now carries its planned topics.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
