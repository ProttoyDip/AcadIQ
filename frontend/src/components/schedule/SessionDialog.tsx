import { useEffect, useState } from "react";
import { VoiceInput, appendTranscript } from "../ui/voice-input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, CheckCircle2, ClipboardCheck, Copy, Loader2, MessageSquareText, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { fmtLongDate, fmtShortDate, fmtTime } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ClassSession, FreeSlotCandidate } from "../../types";
import { STATUS_LABEL } from "./WeekGrid";

type Mode = "view" | "cancel" | "reschedule" | "log" | "notice";

export default function SessionDialog({ session, onClose }: { session: ClassSession | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState({ date: "", startTime: "", endTime: "", room: "" });
  const [covered, setCovered] = useState("");
  const [notes, setNotes] = useState("");
  const [planned, setPlanned] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "CHAT">("CHAT");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMode("view");
    setError(null);
    setReason("");
    setCopied(false);
    if (session) {
      setManual({ date: session.date, startTime: session.startTime, endTime: session.endTime, room: session.room ?? "" });
      setCovered((session.coveredTopics ?? session.plannedTopics ?? []).join("\n"));
      setNotes(session.notes ?? "");
      setPlanned((session.plannedTopics ?? []).join("\n"));
    }
  }, [session]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["schedule"] });
  };
  const done = () => {
    refresh();
    onClose();
  };
  const fail = (fallback: string) => (e: unknown) => setError(apiErrorMessage(e, fallback));

  const suggestions = useQuery({
    queryKey: ["schedule", "suggestions", session?.id],
    queryFn: () => scheduleService.suggestions(session!.id),
    enabled: Boolean(session) && mode === "reschedule",
  });
  const cancel = useMutation({ mutationFn: () => scheduleService.cancelSession(session!.id, reason || undefined), onSuccess: done, onError: fail("Could not cancel") });
  const restore = useMutation({ mutationFn: () => scheduleService.restoreSession(session!.id), onSuccess: done, onError: fail("Could not restore") });
  const remove = useMutation({ mutationFn: () => scheduleService.deleteSession(session!.id), onSuccess: done, onError: fail("Could not delete") });
  const reschedule = useMutation({
    mutationFn: (c: { date: string; startTime: string; endTime: string; room?: string | null }) => scheduleService.reschedule(session!.id, { ...c, reason: reason || undefined }),
    onSuccess: done,
    onError: fail("Could not reschedule"),
  });
  const log = useMutation({
    mutationFn: () => scheduleService.logSession(session!.id, { coveredTopics: covered.split(/\n|,/).map((t) => t.trim()).filter(Boolean), notes: notes || undefined }),
    onSuccess: done,
    onError: fail("Could not save the log"),
  });
  const savePlanned = useMutation({
    mutationFn: () => scheduleService.updateSession(session!.id, { plannedTopics: planned.split(/\n|,/).map((t) => t.trim()).filter(Boolean) }),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: fail("Could not save"),
  });
  const notice = useMutation({ mutationFn: () => scheduleService.notice(session!.id, channel), onError: fail("Could not draft a notice") });
  const roomsAvailable = useQuery({ queryKey: ["schedule", "rooms-available"], queryFn: scheduleService.roomsAvailable, staleTime: 5 * 60_000 });
  const freeRooms = useQuery({
    queryKey: ["schedule", "free-rooms", manual.date, manual.startTime, manual.endTime],
    queryFn: () => scheduleService.freeRooms({ date: manual.date, startTime: manual.startTime, endTime: manual.endTime }),
    enabled: mode === "reschedule" && Boolean(roomsAvailable.data?.available) && Boolean(manual.date && manual.startTime && manual.endTime && manual.endTime > manual.startTime),
  });

  if (!session) return null;
  const s = session;
  const active = s.status === "SCHEDULED" || s.status === "MAKEUP";
  const lost = s.status === "CANCELLED" || s.status === "HOLIDAY";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {s.courseLabel}
            {s.section && <span className="text-muted-foreground">· {s.section}</span>}
            <Badge variant={s.status === "SCHEDULED" ? "brand" : s.status === "MAKEUP" || s.status === "HELD" ? "success" : lost ? "error" : "muted"}>{STATUS_LABEL[s.status]}</Badge>
            {s.kind !== "LECTURE" && <Badge variant="outline">{s.kind.toLowerCase()}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {fmtLongDate(s.date)} · {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
            {s.room ? ` · ${s.room}` : ""}
            {s.course ? ` · ${s.course.courseName}` : ""}
            {s.reason ? ` · ${s.reason}` : ""}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-error">{error}</p>}

        {mode === "view" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Planned topics (one per line)</Label>
              <textarea value={planned} onChange={(e) => setPlanned(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-xs" placeholder="What you intend to cover" />
              <div>
                <Button size="sm" variant="outline" onClick={() => savePlanned.mutate()} disabled={savePlanned.isPending}>
                  {savePlanned.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save plan
                </Button>
              </div>
            </div>
            {s.status === "HELD" && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-foreground">Covered</p>
                <p className="text-foreground">{(s.coveredTopics ?? []).join(", ") || "—"}</p>
                {s.notes && <p className="mt-1 text-muted-foreground">{s.notes}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {active && (
                <>
                  <Button size="sm" onClick={() => setMode("log")}>
                    <ClipboardCheck className="h-4 w-4" /> Log class
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMode("reschedule")}>
                    <CalendarClock className="h-4 w-4" /> Reschedule
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMode("cancel")}>
                    <Ban className="h-4 w-4" /> Cancel class
                  </Button>
                </>
              )}
              {s.status === "HELD" && (
                <Button size="sm" variant="outline" onClick={() => setMode("log")}>
                  <ClipboardCheck className="h-4 w-4" /> Edit log
                </Button>
              )}
              {lost && (
                <Button size="sm" onClick={() => setMode("reschedule")}>
                  <CalendarClock className="h-4 w-4" /> Schedule make-up
                </Button>
              )}
              {s.status === "CANCELLED" && (
                <Button size="sm" variant="outline" onClick={() => restore.mutate()} disabled={restore.isPending}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              )}
              {(lost || s.status === "RESCHEDULED" || s.status === "MAKEUP") && (
                <Button size="sm" variant="outline" onClick={() => setMode("notice")}>
                  <MessageSquareText className="h-4 w-4" /> Draft notice
                </Button>
              )}
              {!s.slotId && s.status !== "RESCHEDULED" && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending} className="ml-auto text-error">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === "cancel" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cancel-reason" className="text-xs">Reason (optional, shown in notices)</Label>
              <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Faculty meeting, illness" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel this class
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Back</Button>
            </div>
            <p className="text-xs text-muted-foreground">It stays on the calendar as cancelled and is added to your make-up debt until you schedule a replacement.</p>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-small font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Suggested make-up slots
              </p>
              {suggestions.isLoading && <p className="text-xs text-muted-foreground">Finding free slots…</p>}
              {suggestions.data && suggestions.data.suggestions.length === 0 && <p className="text-xs text-muted-foreground">No free slot found in the next three weeks; pick a time manually.</p>}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestions.data?.suggestions.map((c: FreeSlotCandidate) => (
                  <li key={`${c.date}${c.startTime}`}>
                    <button
                      type="button"
                      onClick={() => reschedule.mutate({ date: c.date, startTime: c.startTime, endTime: c.endTime, room: c.room })}
                      disabled={reschedule.isPending}
                      className="flex w-full flex-col items-start rounded-lg border border-border p-2.5 text-left hover:border-primary hover:bg-primary-50/40"
                    >
                      <span className="text-small font-semibold text-foreground">
                        {fmtShortDate(c.date)} · {fmtTime(c.startTime)}–{fmtTime(c.endTime)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{c.reasons.slice(0, 2).join(" · ")}</span>
                      <span className="mt-1 text-[10px] font-semibold text-primary">fit {c.score}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted-foreground">Suggestions avoid your other classes, holidays and Fridays, and prefer the same weekday/time. Nothing is booked until you click one.</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Or choose manually</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} className="h-9" />
                <Input type="time" value={manual.startTime} onChange={(e) => setManual({ ...manual, startTime: e.target.value })} className="h-9" />
                <Input type="time" value={manual.endTime} onChange={(e) => setManual({ ...manual, endTime: e.target.value })} className="h-9" />
                <Input placeholder="Room" value={manual.room} onChange={(e) => setManual({ ...manual, room: e.target.value })} className="h-9" />
              </div>
              <Input className="mt-2 h-9" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              {freeRooms.data && freeRooms.data.source !== "NONE" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Free rooms then: {freeRooms.data.free.length ? freeRooms.data.free.slice(0, 8).map((r) => (
                    <button key={r} type="button" onClick={() => setManual({ ...manual, room: r })} className={cn("mr-1 rounded border px-1.5 py-0.5", manual.room === r ? "border-primary text-primary" : "border-border hover:border-primary")}>{r}</button>
                  )) : "none in the department routine"}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => reschedule.mutate({ ...manual, room: manual.room || null })} disabled={reschedule.isPending || !manual.date || !manual.startTime || !manual.endTime}>
                  {reschedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Move class
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Back</Button>
              </div>
            </div>
          </div>
        )}

        {mode === "log" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Topics covered (one per line)</Label>
              <textarea value={covered} onChange={(e) => setCovered(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-background p-2 text-xs" />
              <div className="mt-1 flex justify-end"><VoiceInput label="covered topics" onTranscript={(t) => setCovered((v) => appendTranscript(v, t))} /></div>
              {s.plannedTopics?.length ? <p className="text-[11px] text-muted-foreground">Pre-filled from the plan — remove what you did not reach.</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background p-2 text-xs" placeholder="Students struggled with…, ran out of time for…" />
              <div className="mt-1 flex justify-end"><VoiceInput label="the class notes" onTranscript={(t) => setNotes((v) => appendTranscript(v, t))} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => log.mutate()} disabled={log.isPending}>
                {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark as held
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Back</Button>
            </div>
          </div>
        )}

        {mode === "notice" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {(["CHAT", "EMAIL"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)} className={cn("rounded-full border px-3 py-1 text-xs", channel === c ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                  {c === "CHAT" ? "Short message" : "Email"}
                </button>
              ))}
              <Button size="sm" onClick={() => notice.mutate()} disabled={notice.isPending} className="ml-auto">
                {notice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Draft
              </Button>
            </div>
            {notice.data && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                {notice.data.subject && <p className="mb-1 font-semibold text-foreground">Subject: {notice.data.subject}</p>}
                <p className="whitespace-pre-wrap text-foreground">{notice.data.body}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${notice.data.subject ? `${notice.data.subject}\n\n` : ""}${notice.data.body}`);
                    setCopied(true);
                  }}
                >
                  <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => setMode("view")} className="self-start">Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
