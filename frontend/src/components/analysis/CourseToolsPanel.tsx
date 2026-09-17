import { useState } from "react";
import { VoiceInput, appendTranscript } from "../ui/voice-input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, FolderArchive, Loader2, SearchCheck, Trash2, Wand2 } from "lucide-react";
import { workflowService } from "../../services/workflowService";
import { apiErrorMessage } from "../../services/api";
import { formatDate } from "../../lib/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { MaterialGapTopic } from "../../types";

const GAP_TONE: Record<MaterialGapTopic["status"], "success" | "warning" | "error"> = { COVERED: "success", PARTIAL: "warning", GAP: "error" };

function LecturePlanTab({ courseId, disabled }: { courseId: number; disabled: boolean }) {
  const queryClient = useQueryClient();
  const [weeks, setWeeks] = useState(14);
  const [hours, setHours] = useState(3);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const plans = useQuery({ queryKey: ["lecture-plans", courseId], queryFn: () => workflowService.listLecturePlans(courseId) });
  const generate = useMutation({
    mutationFn: () => workflowService.generateLecturePlan(courseId, { weeks, hoursPerWeek: hours, startNote: note || undefined }),
    onSuccess: (p) => {
      setError(null);
      setOpenId(p.id);
      void queryClient.invalidateQueries({ queryKey: ["lecture-plans", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not generate a plan")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => workflowService.deleteLecturePlan(courseId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lecture-plans", courseId] }),
  });

  const active = (plans.data ?? []).find((p) => p.id === openId) ?? plans.data?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lp-weeks" className="text-xs">Weeks</Label>
          <Input id="lp-weeks" type="number" min={4} max={30} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lp-hours" className="text-xs">Hours / week</Label>
          <Input id="lp-hours" type="number" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lp-note" className="text-xs">Note (optional)</Label>
          <div className="flex items-center gap-2">
            <Input id="lp-note" placeholder="e.g. midterm in week 7, skip chapter 9" value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
            <VoiceInput label="the planning note" onTranscript={(t) => setNote((v) => appendTranscript(v, t))} />
          </div>
        </div>
        <Button size="sm" onClick={() => generate.mutate()} disabled={disabled || generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Draft plan
        </Button>
      </div>
      {disabled && <p className="text-xs text-warning">Upload a syllabus first.</p>}
      {error && <p className="text-xs text-error">{error}</p>}

      {(plans.data ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {plans.data!.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className={`rounded-full border px-3 py-1 text-xs ${active?.id === p.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              {p.weeks} wks · {formatDate(p.createdAt)}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <div>
              <p className="text-small font-semibold text-foreground">{active.planJson.title}</p>
              <p className="text-xs text-muted-foreground">{active.weeks} weeks × {active.hoursPerWeek} h · AI draft {formatDate(active.createdAt)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(active.id)} aria-label="Delete plan">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ol className="divide-y divide-border">
            {active.planJson.weeks.map((w) => (
              <li key={w.week} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-xs">
                <span className="font-bold text-primary">W{w.week}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{w.title}</p>
                  <p className="text-muted-foreground">{w.topics.join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.outcomes.map((o) => (
                      <Badge key={o} variant="brand" className="px-1.5 py-0 text-[10px]">{o}</Badge>
                    ))}
                    {w.assessment && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">{w.assessment}</Badge>}
                  </div>
                  {w.materialsHint && <p className="mt-1 italic text-muted-foreground">{w.materialsHint}</p>}
                </div>
              </li>
            ))}
          </ol>
          {active.planJson.assumptions.length > 0 && (
            <ul className="list-disc border-t border-border px-3 py-2 pl-8 text-xs text-muted-foreground">
              {active.planJson.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function GapsTab({ courseId }: { courseId: number }) {
  const [run, setRun] = useState(false);
  const gaps = useQuery({ queryKey: ["material-gaps", courseId], queryFn: () => workflowService.materialGaps(courseId), enabled: run, retry: false });
  const data = gaps.data;
  const [filter, setFilter] = useState<"ALL" | "GAP">("GAP");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Matches every syllabus passage to your closest slide/notes passage. Passages with nothing close are gaps in what was taught (or uploaded).</p>
        <Button size="sm" variant="outline" onClick={() => { setRun(true); void gaps.refetch(); }} disabled={gaps.isFetching}>
          {gaps.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} {data ? "Re-check" : "Check coverage"}
        </Button>
      </div>
      {gaps.isError && <p className="text-xs text-warning">{apiErrorMessage(gaps.error, "Could not check coverage")}</p>}
      {data && data.method === "UNAVAILABLE" && <p className="text-xs text-warning">{data.note}</p>}
      {data && data.method === "EMBEDDING" && (
        <>
          <div className="flex items-center gap-4">
            <Progress value={data.coveragePercent} tone={data.coveragePercent >= 75 ? "success" : data.coveragePercent >= 50 ? "warning" : "error"} className="h-2" />
            <span className="shrink-0 text-xs font-semibold text-foreground">{data.coveragePercent}% covered</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="success">{data.covered} covered</Badge>
            <Badge variant="warning">{data.partial} partial</Badge>
            <Badge variant="error">{data.gaps} gaps</Badge>
            <span className="text-muted-foreground">across {data.syllabusChunks} passages · {data.materials} materials</span>
            <button type="button" className="ml-auto text-primary underline-offset-2 hover:underline" onClick={() => setFilter(filter === "GAP" ? "ALL" : "GAP")}>
              {filter === "GAP" ? "Show all" : "Show gaps only"}
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.topics
              .filter((t) => filter === "ALL" || t.status !== "COVERED")
              .map((t) => (
                <li key={t.chunkIndex} className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-xs">
                  <Badge variant={GAP_TONE[t.status]} className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]">{t.status.toLowerCase()}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{t.excerpt}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {t.bestMaterial ? `Closest: ${t.bestMaterial.title}${t.bestMaterial.locator ? ` · ${t.bestMaterial.locator}` : ""} · ` : ""}
                      cos {t.bestSimilarity}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">{data.note}</p>
        </>
      )}
    </div>
  );
}

function ExportTab({ courseId, courseCode }: { courseId: number; courseCode: string }) {
  const [error, setError] = useState<string | null>(null);
  const download = useMutation({
    mutationFn: async () => {
      const blob = await workflowService.downloadCourseFile(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${courseCode}-course-file.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setError(apiErrorMessage(e, "Export failed")),
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        One ZIP for moderation or accreditation: syllabus, course outcomes, blueprint, every question paper with its latest report PDFs and marks, marking schemes, and the latest lecture plan, plus a README index.
      </p>
      {error && <p className="text-xs text-error">{error}</p>}
      <div>
        <Button size="sm" onClick={() => download.mutate()} disabled={download.isPending}>
          {download.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderArchive className="h-4 w-4" />} Download course file
        </Button>
      </div>
    </div>
  );
}

export default function CourseToolsPanel({ courseId, courseCode, hasSyllabus }: { courseId: number; courseCode: string; hasSyllabus: boolean }) {
  return (
    <Tabs defaultValue="plan">
      <TabsList className="mb-4 h-auto flex-wrap">
        <TabsTrigger value="plan"><CalendarDays className="h-4 w-4" /> Lecture plan</TabsTrigger>
        <TabsTrigger value="gaps"><SearchCheck className="h-4 w-4" /> Material coverage</TabsTrigger>
        <TabsTrigger value="export"><FolderArchive className="h-4 w-4" /> Course file</TabsTrigger>
      </TabsList>
      <TabsContent value="plan"><LecturePlanTab courseId={courseId} disabled={!hasSyllabus} /></TabsContent>
      <TabsContent value="gaps"><GapsTab courseId={courseId} /></TabsContent>
      <TabsContent value="export"><ExportTab courseId={courseId} courseCode={courseCode} /></TabsContent>
    </Tabs>
  );
}
