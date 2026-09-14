import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { DAY_SHORT, fmtTime, parseIso, toMinutes, todayIso } from "../../lib/dates";
import { CalendarEvent, ClassSession, SessionStatus } from "../../types";

const DAY_START = 8 * 60;
const DAY_END = 19 * 60;
const PX_PER_MIN = 1.1;

export const STATUS_STYLE: Record<SessionStatus, string> = {
  SCHEDULED: "border-primary-300 bg-primary-50 text-primary-900 dark:border-primary-700 dark:bg-primary-950/60 dark:text-primary-100",
  MAKEUP: "border-success-border bg-success-bg text-success",
  HELD: "border-border bg-muted text-muted-foreground",
  CANCELLED: "border-error-border bg-error-bg text-error line-through",
  RESCHEDULED: "border-dashed border-border bg-card text-muted-foreground line-through",
  HOLIDAY: "border-warning-border bg-warning-bg text-warning",
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  SCHEDULED: "Scheduled",
  MAKEUP: "Make-up",
  HELD: "Held",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Moved",
  HOLIDAY: "Holiday",
};

/** Deterministic pastel per course label so a week reads by colour. */
export function courseHue(label: string): number {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function WeekGrid({
  dates,
  sessions,
  events,
  onSelect,
  onEmptyClick,
  hideDays = [],
}: {
  dates: string[];
  sessions: ClassSession[];
  events: CalendarEvent[];
  onSelect: (session: ClassSession) => void;
  onEmptyClick?: (date: string, startTime: string) => void;
  hideDays?: number[];
}) {
  const today = todayIso();
  const visible = dates.filter((d) => !hideDays.includes(parseIso(d).getDay()));
  const byDate = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of sessions) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [sessions]);
  const eventByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      let d = e.date;
      const end = e.endDate ?? e.date;
      while (d <= end) {
        map.set(d, [...(map.get(d) ?? []), e]);
        const nd = parseIso(d);
        nd.setDate(nd.getDate() + 1);
        d = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
      }
    }
    return map;
  }, [events]);

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const height = (DAY_END - DAY_START) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `3.25rem repeat(${visible.length}, minmax(0, 1fr))` }}>
        <div />
        {visible.map((d) => {
          const day = parseIso(d);
          const isToday = d === today;
          const dayEvents = eventByDate.get(d) ?? [];
          return (
            <div key={d} className={cn("border-b border-border px-2 pb-2 text-center", isToday && "text-primary")}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{DAY_SHORT[day.getDay()]}</p>
              <p className={cn("text-base font-bold", isToday && "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground")}>{day.getDate()}</p>
              {dayEvents.map((e) => (
                <p key={e.id} className={cn("mt-0.5 truncate rounded px-1 text-[10px] font-medium", e.kind === "HOLIDAY" || e.kind === "EXAM_WEEK" ? "bg-warning-bg text-warning" : "bg-muted text-muted-foreground")} title={e.title}>
                  {e.title}
                </p>
              ))}
            </div>
          );
        })}

        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span key={m} className="absolute -translate-y-1/2 pr-2 text-right text-[10px] text-muted-foreground" style={{ top: (m - DAY_START) * PX_PER_MIN, right: 0 }}>
              {fmtTime(`${String(m / 60).padStart(2, "0")}:00`)}
            </span>
          ))}
        </div>
        {visible.map((d) => (
          <div
            key={d}
            className="relative border-l border-border"
            style={{ height }}
            onClick={(e) => {
              if (!onEmptyClick || e.target !== e.currentTarget) return;
              const y = e.nativeEvent.offsetY / PX_PER_MIN + DAY_START;
              const snapped = Math.floor(y / 30) * 30;
              onEmptyClick(d, `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`);
            }}
          >
            {hours.map((m) => (
              <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: (m - DAY_START) * PX_PER_MIN }} />
            ))}
            {(byDate.get(d) ?? []).map((s) => {
              const top = (Math.max(toMinutes(s.startTime), DAY_START) - DAY_START) * PX_PER_MIN;
              const h = (Math.min(toMinutes(s.endTime), DAY_END) - Math.max(toMinutes(s.startTime), DAY_START)) * PX_PER_MIN;
              const hue = courseHue(s.courseLabel);
              const neutral = s.status === "CANCELLED" || s.status === "RESCHEDULED" || s.status === "HOLIDAY" || s.status === "HELD";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s)}
                  className={cn("absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs transition-transform hover:z-10 hover:scale-[1.02]", STATUS_STYLE[s.status])}
                  style={{ top, height: Math.max(h, 22), ...(neutral ? {} : { borderLeftWidth: 4, borderLeftColor: `hsl(${hue} 70% 45%)` }) }}
                  title={`${s.courseLabel} ${s.startTime}–${s.endTime}${s.room ? ` · ${s.room}` : ""}`}
                >
                  <p className="truncate font-semibold">
                    {s.courseLabel}
                    {s.section ? ` · ${s.section}` : ""}
                  </p>
                  <p className="truncate opacity-80">
                    {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                    {s.room ? ` · ${s.room}` : ""}
                  </p>
                  {s.status !== "SCHEDULED" && <p className="truncate text-[10px] font-medium uppercase opacity-80">{STATUS_LABEL[s.status]}</p>}
                  {s.status === "SCHEDULED" && s.plannedTopics?.length ? <p className="truncate opacity-70">{s.plannedTopics[0]}</p> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
