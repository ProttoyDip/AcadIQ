import { z } from "zod";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { env } from "../../config/env";
import { isMailerConfigured, sendMail } from "../../utils/mailer";
import { logger } from "../../utils/logger";
import { addDays, isValidTimeZone, localClock, todayIso } from "./dates";
import { scheduleService } from "./schedule.service";

export const digestPrefsSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestHour: z.coerce.number().int().min(0).max(23).optional(),
  timezone: z.string().trim().max(60).nullable().optional().refine((v) => !v || isValidTimeZone(v), "Unknown time zone"),
});

export interface Digest {
  date: string;
  termName: string | null;
  today: Array<{ courseLabel: string; section: string | null; startTime: string; endTime: string; room: string | null; status: string; plannedTopics: string[]; lastCovered: string[] }>;
  unlogged: Array<{ id: number; courseLabel: string; date: string; startTime: string }>;
  makeupDebt: number;
  upcomingChanges: Array<{ courseLabel: string; date: string; startTime: string; status: string; reason: string | null }>;
  assessments: Array<{ title: string; date: string; courseLabel: string | null }>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

export const digestService = {
  async build(facultyId: number, date = todayIso()): Promise<Digest> {
    const briefing = await scheduleService.today(facultyId, date);
    if (!briefing.term) return { date, termName: null, today: [], unlogged: [], makeupDebt: 0, upcomingChanges: [], assessments: [] };
    const termId = briefing.term.id;
    const [unlogged, changes, assessments] = await Promise.all([
      prisma.classSession.findMany({
        where: { termId, status: "SCHEDULED", date: { gte: addDays(date, -7), lt: date } },
        orderBy: { date: "desc" },
        take: 6,
        select: { id: true, courseLabel: true, date: true, startTime: true },
      }),
      prisma.classSession.findMany({
        where: { termId, date: { gte: date, lte: addDays(date, 7) }, status: { in: ["CANCELLED", "MAKEUP", "HOLIDAY"] } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { courseLabel: true, date: true, startTime: true, status: true, reason: true },
      }),
      prisma.calendarEvent.findMany({
        where: { termId, kind: "ASSESSMENT", date: { gte: date, lte: addDays(date, 7) } },
        orderBy: { date: "asc" },
        select: { title: true, date: true, course: { select: { courseCode: true } } },
      }),
    ]);
    return {
      date,
      termName: briefing.term.name,
      today: briefing.sessions.map((s) => ({
        courseLabel: s.courseLabel,
        section: s.section,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        status: s.status,
        plannedTopics: (s.plannedTopics as string[] | null) ?? [],
        lastCovered: (s.lastLog?.coveredTopics as string[] | null) ?? [],
      })),
      unlogged,
      makeupDebt: briefing.makeupDebt ?? 0,
      upcomingChanges: changes,
      assessments: assessments.map((a) => ({ title: a.title, date: a.date, courseLabel: a.course?.courseCode ?? null })),
    };
  },

  render(digest: Digest, name: string): { subject: string; html: string; text: string } {
    const active = digest.today.filter((s) => s.status !== "CANCELLED" && s.status !== "HOLIDAY" && s.status !== "RESCHEDULED");
    const subject = `AcadIQ · ${digest.date}: ${active.length ? `${active.length} class${active.length === 1 ? "" : "es"} today` : "no classes today"}${digest.makeupDebt ? ` · ${digest.makeupDebt} make-up owed` : ""}`;
    const li = (s: string) => `<li style="margin:0 0 8px 0">${s}</li>`;
    const sections: string[] = [];
    sections.push(
      `<h2 style="font-size:16px;margin:0 0 8px">Today</h2>` +
        (digest.today.length
          ? `<ul style="padding-left:18px;margin:0">${digest.today
              .map((s) =>
                li(
                  `<strong>${esc(s.courseLabel)}${s.section ? ` · ${esc(s.section)}` : ""}</strong> ${fmtTime(s.startTime)}–${fmtTime(s.endTime)}${s.room ? ` · ${esc(s.room)}` : ""}${s.status !== "SCHEDULED" ? ` <em>(${s.status.toLowerCase()})</em>` : ""}` +
                    (s.plannedTopics.length ? `<br><span style="color:#475569">Plan: ${esc(s.plannedTopics.join(", "))}</span>` : "") +
                    (s.lastCovered.length ? `<br><span style="color:#94a3b8">Last time: ${esc(s.lastCovered.join(", "))}</span>` : "")
                )
              )
              .join("")}</ul>`
          : `<p style="margin:0;color:#475569">No classes today.</p>`)
    );
    if (digest.unlogged.length) {
      sections.push(`<h2 style="font-size:16px;margin:20px 0 8px">Classes not yet logged</h2><ul style="padding-left:18px;margin:0">${digest.unlogged.map((u) => li(`${esc(u.courseLabel)} · ${u.date} ${fmtTime(u.startTime)}`)).join("")}</ul>`);
    }
    if (digest.upcomingChanges.length || digest.assessments.length) {
      sections.push(
        `<h2 style="font-size:16px;margin:20px 0 8px">Next 7 days</h2><ul style="padding-left:18px;margin:0">${[
          ...digest.assessments.map((a) => li(`<strong>${esc(a.title)}</strong>${a.courseLabel ? ` · ${esc(a.courseLabel)}` : ""} · ${a.date}`)),
          ...digest.upcomingChanges.map((c) => li(`${esc(c.courseLabel)} · ${c.date} ${fmtTime(c.startTime)} · <em>${c.status.toLowerCase()}</em>${c.reason ? ` — ${esc(c.reason)}` : ""}`)),
        ].join("")}</ul>`
      );
    }
    if (digest.makeupDebt) sections.push(`<p style="margin:20px 0 0;color:#b45309"><strong>${digest.makeupDebt}</strong> class${digest.makeupDebt === 1 ? "" : "es"} still need a make-up slot.</p>`);
    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f6f8;margin:0;padding:20px;color:#1e293b">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-weight:700;color:#4f46e5">AcadIQ</p>
<h1 style="font-size:20px;margin:0 0 4px">Good morning, ${esc(name)}</h1>
<p style="margin:0 0 20px;color:#64748b">${digest.date}${digest.termName ? ` · ${esc(digest.termName)}` : ""}</p>
${sections.join("")}
<p style="margin:28px 0 0;font-size:13px;color:#94a3b8"><a href="${env.frontendUrl}/schedule" style="color:#4f46e5">Open your schedule</a> · manage this email in Settings.</p>
</div></body></html>`;
    const text = [
      `AcadIQ — ${digest.date}${digest.termName ? ` (${digest.termName})` : ""}`,
      "",
      "Today:",
      ...(digest.today.length ? digest.today.map((s) => `- ${s.courseLabel}${s.section ? ` ${s.section}` : ""} ${s.startTime}-${s.endTime}${s.room ? ` ${s.room}` : ""}${s.status !== "SCHEDULED" ? ` (${s.status.toLowerCase()})` : ""}${s.plannedTopics.length ? ` — ${s.plannedTopics.join(", ")}` : ""}`) : ["- no classes"]),
      ...(digest.unlogged.length ? ["", "Not yet logged:", ...digest.unlogged.map((u) => `- ${u.courseLabel} ${u.date} ${u.startTime}`)] : []),
      ...(digest.assessments.length ? ["", "Assessments this week:", ...digest.assessments.map((a) => `- ${a.title} ${a.date}`)] : []),
      ...(digest.makeupDebt ? ["", `${digest.makeupDebt} make-up class(es) owed.`] : []),
    ].join("\n");
    return { subject, html, text };
  },

  async preview(facultyId: number, date?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: facultyId }, select: { name: true, email: true, digestEnabled: true, digestHour: true, digestLastSent: true, timezone: true } });
    const digest = await this.build(facultyId, date ?? localClock(new Date(), user.timezone).date);
    return { ...this.render(digest, user.name), digest, prefs: { digestEnabled: user.digestEnabled, digestHour: user.digestHour, digestLastSent: user.digestLastSent, timezone: user.timezone, email: user.email }, mailerConfigured: isMailerConfigured };
  },

  async sendNow(facultyId: number, date?: string) {
    if (!isMailerConfigured) throw new AppError("Email is not configured on this server (SMTP_USER / SMTP_PASS). Use Preview instead.", 400);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: facultyId }, select: { name: true, email: true, timezone: true } });
    const day = date ?? localClock(new Date(), user.timezone).date;
    const rendered = this.render(await this.build(facultyId, day), user.name);
    await sendMail({ to: user.email, ...rendered });
    await prisma.user.update({ where: { id: facultyId }, data: { digestLastSent: day } });
    return { sent: true, to: user.email, subject: rendered.subject };
  },

  async getPrefs(facultyId: number) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: facultyId }, select: { digestEnabled: true, digestHour: true, digestLastSent: true, timezone: true, email: true } });
    return { ...user, serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone, mailerConfigured: isMailerConfigured };
  },

  async updatePrefs(facultyId: number, input: z.infer<typeof digestPrefsSchema>) {
    await prisma.user.update({ where: { id: facultyId }, data: input });
    return this.getPrefs(facultyId);
  },

  /** Called by the scheduler; each user's hour/date is evaluated in their own time zone. */
  async runDue(now = new Date()) {
    if (!isMailerConfigured) return { sent: 0, skipped: "mailer_not_configured" as const };
    const candidates = await prisma.user.findMany({ where: { digestEnabled: true, role: "FACULTY" }, select: { id: true, digestHour: true, digestLastSent: true, timezone: true } });
    let sent = 0;
    for (const user of candidates) {
      const clock = localClock(now, user.timezone);
      if (clock.hour < user.digestHour || user.digestLastSent === clock.date) continue;
      try {
        await this.sendNow(user.id, clock.date);
        sent += 1;
      } catch (error) {
        logger.warn("digest_send_failed", { userId: user.id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    if (sent) logger.info("digest_sent", { count: sent });
    return { sent };
  },
};

let timer: NodeJS.Timeout | null = null;
export function startDigestScheduler(intervalMs = 10 * 60_000) {
  if (timer || env.nodeEnv === "test") return;
  if (!isMailerConfigured) {
    logger.info("digest_scheduler_disabled_no_smtp");
    return;
  }
  timer = setInterval(() => void digestService.runDue().catch((e) => logger.warn("digest_run_failed", { reason: e instanceof Error ? e.message : String(e) })), intervalMs);
  timer.unref();
}
export function stopDigestScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
