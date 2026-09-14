import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2, Trash2, UploadCloud, Users } from "lucide-react";
import { workflowService } from "../../services/workflowService";
import { apiErrorMessage } from "../../services/api";
import { useChartTheme } from "../../lib/chartTheme";
import { bloomLabel, priorityTone } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { GroupAttainment, ItemStat, MarksAnalysisResult } from "../../types";

const DIFFICULTY_TONE: Record<ItemStat["difficultyBand"], "success" | "warning" | "error"> = { MODERATE: "success", EASY: "warning", HARD: "error" };
const DISCRIMINATION_TONE: Record<ItemStat["discriminationBand"], "success" | "warning" | "error" | "muted"> = {
  EXCELLENT: "success",
  GOOD: "success",
  MARGINAL: "warning",
  POOR: "error",
};
const LEVEL_TONE: Record<GroupAttainment["attainmentLevel"], "success" | "warning" | "error"> = { 3: "success", 2: "success", 1: "warning", 0: "error" };

function AttainmentTable({ title, rows, threshold, emptyNote }: { title: string; rows: GroupAttainment[]; threshold: number; emptyNote: string }) {
  return (
    <div>
      <p className="mb-2 text-small font-semibold text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyNote}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-small font-semibold text-foreground">
                    {row.key === row.label ? bloomLabel(row.key) : `${row.key} · ${row.label}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Q{row.questionSequence.join(", Q")} · {row.maxMarks} marks · mean {row.meanPercent}%
                  </p>
                </div>
                <Badge variant={LEVEL_TONE[row.attainmentLevel]} className="shrink-0">
                  Level {row.attainmentLevel}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={row.studentsAboveThreshold} tone={LEVEL_TONE[row.attainmentLevel]} className="h-1.5" />
                <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{row.studentsAboveThreshold}% ≥ {threshold}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DistributionChart({ data }: { data: MarksAnalysisResult["distribution"] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: t.track, opacity: 0.5 }} contentStyle={t.tooltip} formatter={(v: number) => [`${v} students`, ""]} />
        <Bar dataKey="count" fill={t.primary} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Post-exam loop: upload the marks sheet, get classical item analysis (difficulty,
 * discrimination, alpha) plus Bloom/topic/CO attainment. Deterministic — no LLM.
 */
export default function MarksAnalysisPanel({ paperId, courseId }: { paperId: number; courseId: number }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [threshold, setThreshold] = useState(60);

  const summary = useQuery({ queryKey: ["marks", paperId], queryFn: () => workflowService.marksSummary(paperId) });
  const hasMarks = (summary.data?.students ?? 0) > 0;
  const analysis = useQuery({
    queryKey: ["marks", paperId, "analysis", threshold],
    queryFn: () => workflowService.marksAnalysis(paperId, { threshold }),
    enabled: hasMarks,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["marks", paperId] });
  const upload = useMutation({
    mutationFn: (csv: string) => workflowService.uploadMarksCsv(paperId, csv),
    onSuccess: (r) => {
      setError(
        r.unknownColumns.length || r.unmatchedQuestions.length
          ? `Imported ${r.students} students.${r.unknownColumns.length ? ` Ignored columns: ${r.unknownColumns.join(", ")}.` : ""}${r.unmatchedQuestions.length ? ` No marks for Q${r.unmatchedQuestions.join(", Q")}.` : ""}`
          : null
      );
      setPasted("");
      setShowPaste(false);
      void invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not import marks")),
  });
  const remove = useMutation({
    mutationFn: () => workflowService.deleteMarks(paperId),
    onSuccess: () => void invalidate(),
    onError: (e) => setError(apiErrorMessage(e, "Could not remove marks")),
  });

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files[0]) return;
      upload.mutate(await files[0].text());
    },
    [upload]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: upload.isPending,
    accept: { "text/csv": [".csv"], "text/plain": [".txt", ".tsv"] },
  });

  const flagged = useMemo(() => (analysis.data?.items ?? []).filter((i) => i.discriminationBand === "POOR" || i.difficultyBand !== "MODERATE").length, [analysis.data]);
  const data = analysis.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-small font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-primary" /> Results &amp; item analysis
          </p>
          <p className="text-xs text-muted-foreground">
            Upload a CSV (<code className="rounded bg-muted px-1">student, Q1, Q2, …</code>) to get difficulty, discrimination and CO attainment for {" "}
            this paper. Nothing here is AI-generated.
          </p>
        </div>
        {hasMarks && (
          <div className="flex items-center gap-2">
            <Badge variant="brand" className="gap-1">
              <Users className="h-3 w-3" /> {summary.data?.students} students
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label="Remove marks">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-xs transition-colors",
            isDragActive ? "border-primary bg-primary-50/60" : "border-border hover:border-primary-200 hover:bg-muted/40",
            upload.isPending && "pointer-events-none opacity-60"
          )}
        >
          <input {...getInputProps()} />
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4 text-muted-foreground" />}
          <span className="text-muted-foreground">{hasMarks ? "Drop a new CSV to replace the marks" : "Drop the marks CSV here, or click to browse"}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? "Hide paste box" : "Paste CSV"}
        </Button>
      </div>
      {showPaste && (
        <div className="flex flex-col gap-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder={"student,Q1,Q2,Q3\n2021001,8,5,10\n2021002,6,,7"}
            className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
          />
          <div>
            <Button size="sm" onClick={() => upload.mutate(pasted)} disabled={pasted.trim().length < 3 || upload.isPending}>
              Import
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-warning">{error}</p>}

      {hasMarks && analysis.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing item statistics…
        </p>
      )}
      {analysis.isError && <p className="text-xs text-error">{apiErrorMessage(analysis.error, "Could not compute analysis")}</p>}

      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Mean", value: `${data.totals.mean} / ${data.totals.maxMarks}` },
              { label: "Median · SD", value: `${data.totals.median} · ${data.totals.sd}` },
              { label: `Pass rate (≥${data.totals.passMarkPercent}%)`, value: `${data.totals.passRate}%` },
              {
                label: "Cronbach's α",
                value: data.totals.cronbachAlpha === null ? "n/a" : `${data.totals.cronbachAlpha} · ${data.totals.alphaBand?.toLowerCase()}`,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-small font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-small font-semibold text-foreground">Score distribution</p>
            <DistributionChart data={data.distribution} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-small font-semibold text-foreground">Per-question statistics</p>
              {flagged > 0 && <Badge variant="warning">{flagged} flagged</Badge>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Q</TableHead>
                  <TableHead>Mean</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Discrimination</TableHead>
                  <TableHead>r<sub>pb</sub></TableHead>
                  <TableHead>Zero / Full</TableHead>
                  <TableHead>Bloom · Topic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.questionId}>
                    <TableCell className="font-semibold" title={item.text}>
                      Q{item.sequenceNumber}
                    </TableCell>
                    <TableCell>
                      {item.mean} / {item.maxMarks}
                    </TableCell>
                    <TableCell>
                      <Badge variant={DIFFICULTY_TONE[item.difficultyBand]}>
                        {Math.round(item.difficulty * 100)}% · {item.difficultyBand.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={DISCRIMINATION_TONE[item.discriminationBand]}>
                        {item.discrimination.toFixed(2)} · {item.discriminationBand.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.pointBiserial === null ? "—" : item.pointBiserial.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Math.round(item.zeroRate * 100)}% / {Math.round(item.fullMarksRate * 100)}%
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.bloomLevel ? bloomLabel(item.bloomLevel) : "—"}
                      {item.topic ? ` · ${item.topic}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label htmlFor={`threshold-${paperId}`} className="font-medium">
              Attainment threshold
            </label>
            <input
              id={`threshold-${paperId}`}
              type="range"
              min={40}
              max={80}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-40 accent-primary"
            />
            <span>{threshold}% of the group's marks</span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <AttainmentTable title="Course outcomes" rows={data.coAttainment} threshold={data.thresholdPercent} emptyNote={data.note} />
            <AttainmentTable title="Bloom levels" rows={data.bloomAttainment} threshold={data.thresholdPercent} emptyNote="Run a question review to label questions." />
            <AttainmentTable title="Topics" rows={data.topicAttainment} threshold={data.thresholdPercent} emptyNote="Run a question review to label questions." />
          </div>

          {data.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-small font-semibold text-foreground">What the numbers suggest</p>
              <ul className="flex flex-col gap-1.5">
                {data.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-foreground">
                    <Badge variant={priorityTone(rec.priority)} className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]">
                      {rec.priority}
                    </Badge>
                    <span>{rec.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
