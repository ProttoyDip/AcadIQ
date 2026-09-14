import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";
import { scheduleService } from "../../services/scheduleService";
import { fmtShortDate, fmtTime, todayIso } from "../../lib/dates";
import { Badge } from "../ui/badge";
import { ClassSession } from "../../types";
import { STATUS_LABEL } from "../schedule/WeekGrid";
import SessionDialog from "../schedule/SessionDialog";

/** Morning briefing: today's classes with the planned topic and what was covered last time. */
export default function TodayBriefing() {
  const today = todayIso();
  const briefing = useQuery({ queryKey: ["schedule", "today", today], queryFn: () => scheduleService.today(today) });
  const [selected, setSelected] = useState<ClassSession | null>(null);
  const data = briefing.data;
  if (!data || !data.term) return null;

  const active = data.sessions.filter((s) => s.status === "SCHEDULED" || s.status === "MAKEUP" || s.status === "HELD");
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-small font-bold text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" /> Today · {fmtShortDate(today)}
          <Badge variant="muted">{data.term.name}</Badge>
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {(data.makeupDebt ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3.5 w-3.5" /> {data.makeupDebt} make-up{data.makeupDebt === 1 ? "" : "s"} owed</span>
          )}
          <Link to="/schedule" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Full schedule <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">No classes today.{data.upcoming[0] ? ` Next: ${data.upcoming[0].courseLabel} on ${fmtShortDate(data.upcoming[0].date)} at ${fmtTime(data.upcoming[0].startTime)}.` : ""}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data.sessions.map((s) => {
            const live = s.status !== "HELD" && toMin(s.startTime) <= nowMin && nowMin < toMin(s.endTime);
            const past = toMin(s.endTime) <= nowMin;
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setSelected(s)} className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary ${live ? "border-primary bg-primary-50/50" : "border-border"} ${s.status === "CANCELLED" || s.status === "HOLIDAY" ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-small font-semibold text-foreground">{s.courseLabel}{s.section ? ` · ${s.section}` : ""}</p>
                    <span className="text-xs text-muted-foreground">{fmtTime(s.startTime)}–{fmtTime(s.endTime)}{s.room ? ` · ${s.room}` : ""}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {live && <Badge variant="brand" className="px-1.5 py-0 text-[10px]">now</Badge>}
                    {s.status !== "SCHEDULED" && <Badge variant={s.status === "HELD" ? "success" : "error"} className="px-1.5 py-0 text-[10px]">{STATUS_LABEL[s.status]}</Badge>}
                    {past && s.status === "SCHEDULED" && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">log this class</Badge>}
                  </div>
                  {s.plannedTopics?.length ? <p className="text-xs text-foreground"><Sparkles className="mr-1 inline h-3 w-3 text-primary" />{s.plannedTopics.join(" · ")}</p> : <p className="text-xs text-muted-foreground">No planned topic — click to set one.</p>}
                  {s.lastLog && <p className="truncate text-[11px] text-muted-foreground">Last time ({fmtShortDate(s.lastLog.date)}): {(s.lastLog.coveredTopics ?? []).join(", ") || s.lastLog.notes || "—"}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <SessionDialog session={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
