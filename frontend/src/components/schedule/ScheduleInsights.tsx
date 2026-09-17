import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Copy, Link2, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { useChartTheme } from "../../lib/chartTheme";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Clash } from "../../types";

/** Subscribe link for Google/Outlook/Apple calendars; the token is the credential, so it can be rotated. */
export function SubscribeCard({ termId }: { termId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const get = useMutation({ mutationFn: (rotate: boolean) => scheduleService.feedUrl(termId, rotate), onSuccess: (r) => { setUrl(r.url); setError(null); }, onError: (e) => setError(apiErrorMessage(e, "Could not create link")) });
  const revoke = useMutation({ mutationFn: () => scheduleService.revokeFeed(termId), onSuccess: () => setUrl(null) });
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-small font-bold"><Link2 className="h-4 w-4 text-primary" /> Phone calendar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        {!url ? (
          <>
            <p className="text-muted-foreground">Subscribe once; cancellations and make-ups then update on your phone automatically.</p>
            <Button size="sm" variant="outline" onClick={() => get.mutate(false)} disabled={get.isPending}>
              {get.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Get subscribe link
            </Button>
          </>
        ) : (
          <>
            <code className="block truncate rounded bg-muted px-2 py-1 text-[11px]" title={url}>{url}</code>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => get.mutate(true)} disabled={get.isPending} title="Invalidate the old link"><RefreshCw className="h-3.5 w-3.5" /> Rotate</Button>
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate()} disabled={revoke.isPending} className="text-error"><ShieldOff className="h-3.5 w-3.5" /> Revoke</Button>
            </div>
            <p className="text-muted-foreground">Google Calendar → Other calendars → From URL. Outlook → Add calendar → Subscribe from web. Anyone with the link can read your timetable.</p>
          </>
        )}
        {error && <p className="text-error">{error}</p>}
      </CardContent>
    </Card>
  );
}

const SEV: Record<Clash["severity"], "error" | "warning" | "muted"> = { HIGH: "error", MEDIUM: "warning", LOW: "muted" };

export function ClashesCard({ termId }: { termId: number }) {
  const clashes = useQuery({ queryKey: ["schedule", "clashes", termId], queryFn: () => scheduleService.clashes(termId) });
  const list = clashes.data ?? [];
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-small font-bold">
          <AlertTriangle className={`h-4 w-4 ${list.some((c) => c.severity === "HIGH") ? "text-error" : "text-primary"}`} /> Assessment clashes
          {list.length > 0 && <Badge variant={list.some((c) => c.severity === "HIGH") ? "error" : "warning"}>{list.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        {clashes.isLoading && <p className="text-muted-foreground">Checking…</p>}
        {clashes.data && list.length === 0 && <p className="text-muted-foreground">No clashes. Add quizzes/mids as “Assessment” events and they are checked against each other, your classes and holidays.</p>}
        {list.slice(0, 6).map((c, i) => (
          <div key={i} className="rounded-lg border border-border p-2">
            <p className="flex items-start gap-2 text-foreground"><Badge variant={SEV[c.severity]} className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]">{c.severity}</Badge><span>{c.message}</span></p>
            <p className="mt-1 text-muted-foreground">{c.hint}</p>
          </div>
        ))}
        {list.length > 6 && <p className="text-muted-foreground">+{list.length - 6} more</p>}
      </CardContent>
    </Card>
  );
}

export function WorkloadCard({ termId }: { termId: number }) {
  const t = useChartTheme();
  const w = useQuery({ queryKey: ["schedule", "workload", termId], queryFn: () => scheduleService.workload(termId) });
  const d = w.data;
  const max = d ? Math.max(1, ...d.heatmap.rows.flatMap((r) => r.cells)) : 1;
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-small font-bold"><BarChart3 className="h-4 w-4 text-primary" /> Workload</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!d ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Contact h / week", value: `${d.contactHoursPerWeek}` },
                { label: "Busiest day", value: d.busiestDay ?? "—" },
                { label: "Cancelled / lost", value: `${d.cancellationRate}%` },
                { label: "Make-up coverage", value: `${d.makeupCoverage}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-0.5 text-small font-bold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground">Hours per week by course</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={d.perCourse} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
                    <XAxis dataKey="courseLabel" tick={{ fontSize: 10, fill: t.axis }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: t.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={t.tooltip} formatter={(v: number) => [`${v} h/week`, ""]} />
                    <Bar dataKey="hoursPerWeek" fill={t.primary} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground">When you teach (classes per hour, whole term)</p>
                <div className="grid gap-px text-[9px]" style={{ gridTemplateColumns: `2.2rem repeat(${d.heatmap.hours.length}, minmax(0,1fr))` }}>
                  <span />
                  {d.heatmap.hours.map((h) => <span key={h} className="text-center text-muted-foreground">{h}</span>)}
                  {d.heatmap.rows.map((r) => (
                    <div key={r.dayOfWeek} className="contents">
                      <span className="text-muted-foreground">{r.day.slice(0, 3)}</span>
                      {r.cells.map((c, i) => (
                        <span key={i} title={`${r.day} ${d.heatmap.hours[i]}:00 · ${c} classes`} className="h-4 rounded-sm bg-primary" style={{ opacity: c ? 0.2 + (c / max) * 0.8 : 0.06 }} />
                      ))}
                    </div>
                  ))}
                </div>
                {d.peakWeeks.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Heavier weeks: {d.peakWeeks.map((p) => `W${p.week} (${p.hours} h)`).join(", ")}</p>}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
