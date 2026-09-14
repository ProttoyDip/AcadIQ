/** Minimal RFC 5545 writer: floating local times so phones show the class at the printed time. */
export interface IcsEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  summary: string;
  description?: string;
  location?: string | null;
  status?: "CONFIRMED" | "CANCELLED";
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

export function buildIcs(calendarName: string, events: IcsEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcadIQ//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.date, e.startTime)}`,
      `DTEND:${stamp(e.date, e.endTime)}`,
      `SUMMARY:${esc(e.summary)}`,
      `STATUS:${e.status ?? "CONFIRMED"}`
    );
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map((l) => (l.length > 75 ? l.match(/.{1,74}/g)!.join("\r\n ") : l)).join("\r\n") + "\r\n";
}
