import { useEffect, useMemo, useState } from "react";
import { VoiceInput, appendTranscript } from "../components/ui/voice-input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Download, Loader2, Settings2, AlertTriangle, Plus } from "lucide-react";
import { scheduleService } from "../services/scheduleService";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import WeekGrid, { STATUS_LABEL } from "../components/schedule/WeekGrid";
import SessionDialog from "../components/schedule/SessionDialog";
import TimetableSetup from "../components/schedule/TimetableSetup";
import { ClashesCard, SubscribeCard, WorkloadCard } from "../components/schedule/ScheduleInsights";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { addDays, fmtShortDate, fmtTime, startOfWeek, todayIso, weekDates } from "../lib/dates";
import { ClassSession, Term } from "../types";

function TermForm({ onCreated }: { onCreated: (t: Term) => void }) {
  const today = todayIso();
  const [form, setForm] = useState({ name: "", startDate: today, endDate: addDays(today, 112) });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => scheduleService.createTerm(form), onSuccess: onCreated, onError: (e) => setError(apiErrorMessage(e, "Could not create term")) });
  return (
    // Name gets its own row: the two date inputs and the button need ~27rem
    // between them, which is already the whole width of a max-w-lg dialog, so a
    // single four-column row starved the name field and collided its label.
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor="term-name" className="text-xs">Term name</Label>
        <Input id="term-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fall 2026" className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="term-start" className="text-xs">Starts</Label>
          <Input id="term-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-9 w-full min-w-0" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="term-end" className="text-xs">Ends</Label>
          <Input id="term-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-9 w-full min-w-0" />
        </div>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <Button className="w-full sm:w-auto sm:self-end" onClick={() => create.mutate()} disabled={create.isPending || form.name.trim().length < 2}>
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Create term
      </Button>
    </div>
  );
}

export default function Schedule() {
  const queryClient = useQueryClient();
  const terms = useQuery({ queryKey: ["schedule", "terms"], queryFn: scheduleService.listTerms });
  const [termId, setTermId] = useState<number | null>(null);
  const term = useMemo(() => (terms.data ?? []).find((t) => t.id === termId) ?? (terms.data ?? []).find((t) => t.isActive) ?? terms.data?.[0] ?? null, [terms.data, termId]);
  const [anchor, setAnchor] = useState(todayIso());
  const [selected, setSelected] = useState<ClassSession | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ date: string; startTime: string } | null>(null);
  const [hideWeekend, setHideWeekend] = useState(true);

  useEffect(() => {
    if (term && (anchor < term.startDate || anchor > term.endDate)) setAnchor(term.startDate);
  }, [term, anchor]);

  const dates = weekDates(anchor);
  const sessions = useQuery({
    queryKey: ["schedule", "sessions", term?.id, dates[0]],
    queryFn: () => scheduleService.listSessions(term!.id, { from: dates[0], to: dates[6] }),
    enabled: Boolean(term),
  });
  const events = useQuery({ queryKey: ["schedule", "events", term?.id], queryFn: () => scheduleService.listEvents(term!.id), enabled: Boolean(term) });
  const debt = useQuery({ queryKey: ["schedule", "debt", term?.id], queryFn: () => scheduleService.makeupDebt(term!.id), enabled: Boolean(term) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["schedule"] });

  const weekStats = useMemo(() => {
    const list = sessions.data ?? [];
    return { total: list.filter((s) => s.status === "SCHEDULED" || s.status === "MAKEUP" || s.status === "HELD").length, lost: list.filter((s) => s.status === "CANCELLED" || s.status === "HOLIDAY").length };
  }, [sessions.data]);

  const [ics, setIcs] = useState<string | null>(null);
  const downloadIcs = useMutation({
    mutationFn: async () => {
      const content = await scheduleService.ics(term!.id);
      const url = URL.createObjectURL(new Blob([content], { type: "text/calendar" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${term!.name}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setIcs(apiErrorMessage(e, "Export failed")),
  });

  if (terms.isLoading) return <LoadingState label="Loading your timetable..." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Your term at a glance — import the department routine once, then cancel, reschedule and log classes here."
        actions={
          term ? (
            <div className="flex flex-wrap items-center gap-2">
              {(terms.data ?? []).length > 1 && (
                <Select value={String(term.id)} onValueChange={(v) => setTermId(Number(v))}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{terms.data!.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => downloadIcs.mutate()} disabled={downloadIcs.isPending}>
                {downloadIcs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} .ics
              </Button>
              <Button size="sm" onClick={() => setSetupOpen(true)}>
                <Settings2 className="h-4 w-4" /> Routine & holidays
              </Button>
            </div>
          ) : undefined
        }
      />
      {ics && <p className="text-xs text-error">{ics}</p>}

      {!term ? (
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold tracking-tight">Start with a term</CardTitle>
            <p className="text-xs text-muted-foreground">Classes are generated week by week between these dates. You can add holidays afterwards.</p>
          </CardHeader>
          <CardContent>
            <TermForm onCreated={(t) => { setTermId(t.id); invalidate(); setSetupOpen(true); }} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card className="shadow-xs">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, -7))} disabled={startOfWeek(anchor) <= startOfWeek(term.startDate)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setAnchor(todayIso())}>Today</Button>
                  <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, 7))} disabled={startOfWeek(addDays(anchor, 7)) > term.endDate} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
                  <p className="ml-2 text-small font-semibold text-foreground">
                    {fmtShortDate(dates[0])} – {fmtShortDate(dates[6])}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="brand">{weekStats.total} classes</Badge>
                  {weekStats.lost > 0 && <Badge variant="error">{weekStats.lost} lost</Badge>}
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={hideWeekend} onChange={(e) => setHideWeekend(e.target.checked)} className="accent-primary" /> hide Fri/Sat</label>
                </div>
              </CardHeader>
              <CardContent>
                {sessions.isLoading ? (
                  <LoadingState label="Loading week..." />
                ) : (sessions.data ?? []).length === 0 && (term._count?.slots ?? 0) === 0 ? (
                  <EmptyState icon={CalendarDays} title="No classes yet" description="Import your routine or add weekly slots to fill the calendar." className="py-10" actionLabel="Set up timetable" onAction={() => setSetupOpen(true)} />
                ) : (
                  <WeekGrid dates={dates} sessions={sessions.data ?? []} events={events.data ?? []} onSelect={setSelected} hideDays={hideWeekend ? [5, 6] : []} onEmptyClick={(date, startTime) => setQuickAdd({ date, startTime })} />
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">Click a class to log, cancel or move it. Click an empty spot to add a one-off class.</p>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-small font-bold"><AlertTriangle className="h-4 w-4 text-warning" /> Make-up debt</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {debt.data && debt.data.total === 0 && <p className="text-xs text-muted-foreground">No classes owed. Cancelled or holiday classes appear here until you schedule a make-up.</p>}
                  {debt.data?.courses.map((c) => (
                    <div key={c.courseLabel} className="rounded-lg border border-border p-2.5">
                      <p className="flex items-center justify-between text-small font-semibold text-foreground">
                        {c.courseLabel} <Badge variant="error">{c.owed.length}</Badge>
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {c.owed.slice(0, 4).map((o) => (
                          <li key={o.id}>
                            <button type="button" className="w-full truncate text-left text-xs text-muted-foreground hover:text-primary" onClick={() => scheduleService.listSessions(term.id, { from: o.date, to: o.date }).then((list) => setSelected(list.find((s) => s.id === o.id) ?? null))}>
                              {fmtShortDate(o.date)} {fmtTime(o.startTime)} · {STATUS_LABEL[o.status]}{o.reason ? ` · ${o.reason}` : ""}
                            </button>
                          </li>
                        ))}
                        {c.owed.length > 4 && <li className="text-[11px] text-muted-foreground">+{c.owed.length - 4} more</li>}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="shadow-xs">
                <CardHeader className="pb-2"><CardTitle className="text-small font-bold">{term.name}</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <p>{fmtShortDate(term.startDate)} → {fmtShortDate(term.endDate)}</p>
                  <p className="mt-1">{term._count?.slots ?? 0} weekly slots · {term._count?.sessions ?? 0} sessions · {term._count?.events ?? 0} calendar events</p>
                  <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => setTermId(-1)}>+ New term</Button>
                </CardContent>
              </Card>
              <ClashesCard termId={term.id} />
              <SubscribeCard termId={term.id} />
            </div>
          </div>

          <WorkloadCard termId={term.id} />

          <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Timetable setup — {term.name}</DialogTitle>
                <DialogDescription>Import the routine with AI, add weekly slots by hand, or mark holidays. The calendar rebuilds automatically.</DialogDescription>
              </DialogHeader>
              <TimetableSetup term={term} onSaved={invalidate} />
            </DialogContent>
          </Dialog>
        </>
      )}

      {termId === -1 && (
        <Dialog open onOpenChange={(o) => !o && setTermId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>New term</DialogTitle><DialogDescription>The new term becomes active; the old one stays available in the dropdown.</DialogDescription></DialogHeader>
            <TermForm onCreated={(t) => { setTermId(t.id); invalidate(); }} />
          </DialogContent>
        </Dialog>
      )}

      {quickAdd && term && <QuickAddDialog term={term} initial={quickAdd} onClose={() => setQuickAdd(null)} onSaved={invalidate} />}
      <SessionDialog session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function QuickAddDialog({ term, initial, onClose, onSaved }: { term: Term; initial: { date: string; startTime: string }; onClose: () => void; onSaved: () => void }) {
  const end = (() => { const [h, m] = initial.startTime.split(":").map(Number); const t = h * 60 + m + 90; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; })();
  const [form, setForm] = useState({ courseLabel: "", section: "", date: initial.date, startTime: initial.startTime, endTime: end, room: "", topics: "" });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => scheduleService.createSession(term.id, { courseLabel: form.courseLabel, section: form.section || null, date: form.date, startTime: form.startTime, endTime: form.endTime, room: form.room || null, kind: "LECTURE", plannedTopics: form.topics ? form.topics.split(/\n|,/).map((t) => t.trim()).filter(Boolean) : undefined }),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(apiErrorMessage(e, "Could not add class")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a one-off class</DialogTitle><DialogDescription>Extra lecture, make-up or review session on {fmtShortDate(form.date)}.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Course (e.g. CSE301)" value={form.courseLabel} onChange={(e) => setForm({ ...form, courseLabel: e.target.value })} className="h-9 col-span-2 sm:col-span-1" />
          <Input placeholder="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="h-9" />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9" />
          <Input placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="h-9" />
          <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9" />
          <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9" />
          <textarea placeholder="Planned topics (optional)" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} rows={2} className="col-span-2 rounded-lg border border-border bg-background p-2 text-xs" />
          <div className="col-span-2 flex justify-end"><VoiceInput label="the planned topics" onTranscript={(t) => setForm((f) => ({ ...f, topics: appendTranscript(f.topics, t) }))} /></div>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <Button onClick={() => create.mutate()} disabled={create.isPending || !form.courseLabel.trim()}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add class
        </Button>
      </DialogContent>
    </Dialog>
  );
}
