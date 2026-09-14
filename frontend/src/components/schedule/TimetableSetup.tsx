import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Loader2, Plus, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { useCourses } from "../../hooks/useCourses";
import { DAY_LONG, DAY_SHORT, fmtTime } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CalendarEvent, ExtractedSlot, SlotDraft, SlotKind, Term } from "../../types";

const KINDS: SlotKind[] = ["LECTURE", "LAB", "TUTORIAL", "OFFICE_HOUR", "OTHER"];
const EMPTY: SlotDraft = { courseLabel: "", section: "", dayOfWeek: 0, startTime: "09:00", endTime: "10:30", room: "", kind: "LECTURE" };

function SlotRow({ slot, onChange, onRemove, courses }: { slot: SlotDraft & { confidence?: number }; onChange: (s: SlotDraft) => void; onRemove: () => void; courses: Array<{ id: number; courseCode: string }> }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1.4fr)_5rem_6rem_5.5rem_5.5rem_5rem_6.5rem_auto] sm:items-center", slot.confidence !== undefined && slot.confidence < 60 && "border-warning-border bg-warning-bg/30")}>
      <Input value={slot.courseLabel} onChange={(e) => onChange({ ...slot, courseLabel: e.target.value })} placeholder="Course" className="h-9" list="course-codes" />
      <Input value={slot.section ?? ""} onChange={(e) => onChange({ ...slot, section: e.target.value || null })} placeholder="Sec" className="h-9" />
      <Select value={String(slot.dayOfWeek)} onValueChange={(v) => onChange({ ...slot, dayOfWeek: Number(v) })}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{DAY_LONG.map((d, i) => <SelectItem key={d} value={String(i)}>{DAY_SHORT[i]}</SelectItem>)}</SelectContent>
      </Select>
      <Input type="time" value={slot.startTime} onChange={(e) => onChange({ ...slot, startTime: e.target.value })} className="h-9" />
      <Input type="time" value={slot.endTime} onChange={(e) => onChange({ ...slot, endTime: e.target.value })} className="h-9" />
      <Input value={slot.room ?? ""} onChange={(e) => onChange({ ...slot, room: e.target.value || null })} placeholder="Room" className="h-9" />
      <Select value={slot.kind} onValueChange={(v) => onChange({ ...slot, kind: v as SlotKind })}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k.toLowerCase().replace("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        {slot.confidence !== undefined && <span className="text-[10px] text-muted-foreground">{slot.confidence}%</span>}
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
      </div>
      <datalist id="course-codes">{courses.map((c) => <option key={c.id} value={c.courseCode} />)}</datalist>
    </div>
  );
}

function ImportTab({ term, onSaved }: { term: Term; onSaved: () => void }) {
  const { data: courses } = useCourses();
  const [drafts, setDrafts] = useState<Array<SlotDraft & { confidence?: number }> | null>(null);
  const [meta, setMeta] = useState<{ file: string; warnings: string[]; facultyName: string; initials: string } | null>(null);
  const [initials, setInitials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replace, setReplace] = useState(true);

  const extract = useMutation({
    mutationFn: (file: File) => scheduleService.extractRoutine(file, { initials: initials || undefined }),
    onSuccess: (r) => {
      setDrafts(r.slots.map((s: ExtractedSlot) => ({ ...s })));
      setMeta({ file: r.file, warnings: r.warnings, facultyName: r.facultyName, initials: r.initials });
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not read the routine")),
  });
  const save = useMutation({
    mutationFn: () => scheduleService.saveSlots(term.id, drafts!.map(({ confidence: _c, ...s }) => ({ ...s, source: "AI_IMPORT" as const })), replace),
    onSuccess: () => {
      setDrafts(null);
      onSaved();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save slots")),
  });

  const onDrop = useCallback((files: File[]) => files[0] && extract.mutate(files[0]), [extract]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, disabled: extract.isPending, accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt", ".csv"] } });

  return (
    <div className="flex flex-col gap-4">
      {!drafts && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
            <div {...getRootProps()} className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", isDragActive ? "border-primary bg-primary-50/60" : "border-border hover:border-primary-200 hover:bg-muted/40", extract.isPending && "pointer-events-none opacity-60")}>
              <input {...getInputProps()} />
              {extract.isPending ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-muted-foreground" />}
              <p className="text-small font-semibold text-foreground">{extract.isPending ? "Reading your routine…" : "Drop the department routine (PDF / DOCX / TXT)"}</p>
              <p className="text-xs text-muted-foreground">AI picks out your rows; you review before anything is saved.</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="initials" className="text-xs">Your initials in the routine</Label>
              <Input id="initials" value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="e.g. MRK" className="h-9" />
            </div>
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
        </>
      )}
      {drafts && meta && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="brand">{drafts.length} slots from {meta.file}</Badge>
            <span>filtered for {meta.facultyName} ({meta.initials})</span>
            {drafts.some((d) => (d.confidence ?? 100) < 60) && <Badge variant="warning">check highlighted rows</Badge>}
          </div>
          {meta.warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-warning">{meta.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          <div className="flex flex-col gap-2">
            {drafts.map((d, i) => (
              <SlotRow key={i} slot={d} courses={courses ?? []} onChange={(s) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, ...s } : x)))} onRemove={() => setDrafts(drafts.filter((_, j) => j !== i))} />
            ))}
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending || drafts.length === 0}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {drafts.length} slots & build calendar
            </Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-primary" /> Replace existing slots
            </label>
            <Button variant="ghost" onClick={() => setDrafts(null)}>Start over</Button>
          </div>
        </>
      )}
    </div>
  );
}

function ManualTab({ term, onSaved }: { term: Term; onSaved: () => void }) {
  const { data: courses } = useCourses();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SlotDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const slots = useQuery({ queryKey: ["schedule", "slots", term.id], queryFn: () => scheduleService.listSlots(term.id) });
  const add = useMutation({
    mutationFn: () => scheduleService.saveSlots(term.id, [draft], false),
    onSuccess: () => {
      setDraft({ ...EMPTY, dayOfWeek: draft.dayOfWeek });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onSaved();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not add slot")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => scheduleService.deleteSlot(term.id, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onSaved();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not remove slot")),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SlotRow slot={draft} courses={courses ?? []} onChange={setDraft} onRemove={() => setDraft(EMPTY)} />
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !draft.courseLabel.trim()}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add weekly slot
          </Button>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      </div>
      {slots.data && slots.data.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {slots.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="text-foreground">
                <span className="font-semibold">{DAY_SHORT[s.dayOfWeek]}</span> {fmtTime(s.startTime)}–{fmtTime(s.endTime)} · <span className="font-semibold">{s.courseLabel}</span>
                {s.section ? ` (${s.section})` : ""}
                {s.room ? ` · ${s.room}` : ""} · {s.kind.toLowerCase()}
                {s.course && <span className="text-muted-foreground"> → {s.course.courseCode}</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(s.id)} aria-label="Remove slot"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventsTab({ term, onSaved }: { term: Term; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{ date: string; endDate: string; kind: CalendarEvent["kind"]; title: string }>({ date: "", endDate: "", kind: "HOLIDAY", title: "" });
  const [error, setError] = useState<string | null>(null);
  const events = useQuery({ queryKey: ["schedule", "events", term.id], queryFn: () => scheduleService.listEvents(term.id) });
  const add = useMutation({
    mutationFn: () => scheduleService.addEvents(term.id, [{ ...draft, endDate: draft.endDate || null }]),
    onSuccess: () => {
      setDraft({ date: "", endDate: "", kind: "HOLIDAY", title: "" });
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onSaved();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not add")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => scheduleService.deleteEvent(term.id, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      onSaved();
    },
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Holidays and exam weeks automatically mark the affected classes and add them to your make-up debt.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[8.5rem_8.5rem_8rem_minmax(0,1fr)_auto] sm:items-center">
        <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="h-9" />
        <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className="h-9" placeholder="End (optional)" />
        <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as CalendarEvent["kind"] })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HOLIDAY">Holiday</SelectItem>
            <SelectItem value="EXAM_WEEK">Exam week</SelectItem>
            <SelectItem value="DEADLINE">Deadline</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className="h-9" />
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !draft.date || !draft.title.trim()}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarOff className="h-4 w-4" />} Add
        </Button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {events.data && events.data.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {events.data.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="text-foreground">
                <span className="font-semibold">{e.date}{e.endDate ? ` → ${e.endDate}` : ""}</span> · {e.title} <Badge variant={e.kind === "HOLIDAY" || e.kind === "EXAM_WEEK" ? "warning" : "muted"} className="ml-1 px-1.5 py-0 text-[10px]">{e.kind.toLowerCase().replace("_", " ")}</Badge>
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(e.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TimetableSetup({ term, onSaved }: { term: Term; onSaved: () => void }) {
  return (
    <Tabs defaultValue="import">
      <TabsList className="mb-4 h-auto flex-wrap">
        <TabsTrigger value="import"><Sparkles className="h-4 w-4" /> Import routine</TabsTrigger>
        <TabsTrigger value="manual"><Plus className="h-4 w-4" /> Weekly slots</TabsTrigger>
        <TabsTrigger value="events"><CalendarOff className="h-4 w-4" /> Holidays & exams</TabsTrigger>
      </TabsList>
      <TabsContent value="import"><ImportTab term={term} onSaved={onSaved} /></TabsContent>
      <TabsContent value="manual"><ManualTab term={term} onSaved={onSaved} /></TabsContent>
      <TabsContent value="events"><EventsTab term={term} onSaved={onSaved} /></TabsContent>
    </Tabs>
  );
}
