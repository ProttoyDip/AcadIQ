import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Check, X } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { todayIso } from "../../lib/dates";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { FreeSlotCandidate } from "../../types";

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Notifications live here rather than on the Copilot bubble: a count on the chat
 * launcher told you something needed doing without letting you do it.
 *
 * A class whose end time has passed while still SCHEDULED is not assumed to be
 * missed — the teacher is asked. "Yes" logs it as held; "No" offers the
 * clash-free slots the scheduler already computes, each with a room that no other
 * teacher holds at that time (see departmentRoutineService.freeRooms).
 */
export default function NotificationCenter() {
  const { user } = useAuth();
  const isFaculty = user?.role === "FACULTY";
  const queryClient = useQueryClient();
  const date = todayIso();

  const [open, setOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const briefing = useQuery({
    queryKey: ["schedule", "today", date],
    queryFn: () => scheduleService.today(date),
    enabled: isFaculty,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const due = (briefing.data?.sessions ?? []).filter(
    (session) => session.status === "SCHEDULED" && toMinutes(session.endTime) <= nowMinutes
  );

  const suggestions = useQuery({
    queryKey: ["schedule", "suggestions", rescheduling],
    queryFn: () => scheduleService.suggestions(rescheduling as number),
    enabled: rescheduling !== null,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedule"] });

  const markHeld = useMutation({
    // No topics: the question asked was "did it happen", not "what did you cover".
    mutationFn: (sessionId: number) => scheduleService.logSession(sessionId, { coveredTopics: [] }),
    onSuccess: refresh,
    onError: (err) => setError(apiErrorMessage(err, "Could not mark that class as held.")),
  });

  const moveTo = useMutation({
    mutationFn: ({ sessionId, slot }: { sessionId: number; slot: FreeSlotCandidate }) =>
      scheduleService.reschedule(sessionId, {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
      }),
    onSuccess: () => {
      setRescheduling(null);
      refresh();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not reschedule that class.")),
  });

  if (!isFaculty) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
        aria-label={due.length ? `Notifications: ${due.length} class${due.length === 1 ? "" : "es"} to confirm` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {due.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {due.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away layer: a Radix menu would close on every Yes/No press. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="region"
            aria-label="Notifications"
            className="absolute right-0 z-40 mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-xl border border-border bg-card shadow-float"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-small font-semibold text-foreground">Notifications</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[22rem] overflow-y-auto scrollbar-thin">
              {error && <p className="border-b border-border px-4 py-2 text-xs font-medium text-error">{error}</p>}

              {due.length === 0 ? (
                <p className="px-4 py-6 text-center text-small text-muted-foreground">
                  {briefing.isPending ? "Checking your classes..." : "Nothing to confirm. You're up to date."}
                </p>
              ) : (
                due.map((session) => (
                  <div key={session.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    <p className="text-small font-semibold text-foreground">{session.courseLabel}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {session.startTime}–{session.endTime}
                      {session.room ? ` · ${session.room}` : ""}
                    </p>
                    <p className="mt-2 text-small text-foreground">Have you taken this class?</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={markHeld.isPending}
                        onClick={() => {
                          setError(null);
                          markHeld.mutate(session.id);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Yes, it was held
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setError(null);
                          setRescheduling(rescheduling === session.id ? null : session.id);
                        }}
                      >
                        No, reschedule it
                      </Button>
                    </div>

                    {rescheduling === session.id && (
                      <div className="mt-3 rounded-lg border border-border bg-background/60 p-2.5">
                        {suggestions.isPending ? (
                          <p className="text-xs text-muted-foreground">Looking for a free time and room...</p>
                        ) : suggestions.isError ? (
                          <p className="text-xs text-error">{apiErrorMessage(suggestions.error, "Could not load suggestions.")}</p>
                        ) : suggestions.data && suggestions.data.suggestions.length > 0 ? (
                          <>
                            <p className="mb-1.5 text-xs font-semibold text-foreground">Free slots (room checked against the department routine)</p>
                            <ul className="flex flex-col gap-1.5">
                              {suggestions.data.suggestions.slice(0, 5).map((slot) => (
                                <li key={`${slot.date}-${slot.startTime}-${slot.room ?? ""}`}>
                                  <button
                                    type="button"
                                    disabled={moveTo.isPending}
                                    onClick={() => {
                                      setError(null);
                                      moveTo.mutate({ sessionId: session.id, slot });
                                    }}
                                    className={cn(
                                      "flex w-full flex-col items-start rounded-md border border-border px-2.5 py-1.5 text-left transition-colors",
                                      "hover:border-primary hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary-950/40"
                                    )}
                                  >
                                    <span className="text-xs font-semibold text-foreground">
                                      {slot.date} · {slot.startTime}–{slot.endTime}
                                      {slot.room ? ` · ${slot.room}` : " · room not assigned"}
                                    </span>
                                    {slot.reasons.length > 0 && (
                                      <span className="text-[11px] text-muted-foreground">{slot.reasons.join(" · ")}</span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No clash-free slot was found before the term ends. Pick a time manually on the Schedule page.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
