import { promises as fs } from "node:fs";
import { prisma } from "../../database/prismaClient";
import { AppError } from "../../middleware/error.middleware";
import { runLlmAnalysis } from "../../ai/runner";
import { ROUTINE_EXTRACT_PROMPT } from "../../ai/prompts/timetable.prompt";
import { routineExtractResponseSchema } from "../../ai/schemas/facultyWorkflows.schema";
import { tracedAnalysis } from "../traced";
import { env } from "../../config/env";
import { toMinutes } from "./dates";
import { routineFileToText } from "./routineSource";

const MAX_ROUTINE_CHARS = Math.min(env.syllabusPromptChars, 24_000);

/**
 * Turns an uploaded department routine into proposed slots. Nothing is saved here:
 * the faculty reviews/corrects the grid and then calls saveSlots.
 */
export const routineImportService = {
  extract(
    facultyId: number,
    file: { path: string; mimetype: string; originalname: string },
    options: { facultyName?: string; initials?: string; keepFile?: boolean; /** The document is the faculty's own routine: keep every row. */ allRowsAreMine?: boolean }
  ) {
    return tracedAnalysis(async () => {
      let text: string;
      let method: "DOCUMENT" | "VISION";
      try {
        ({ text, method } = await routineFileToText(file));
      } finally {
        if (!options.keepFile) await fs.unlink(file.path).catch(() => undefined);
      }
      if (text.length > MAX_ROUTINE_CHARS) text = `${text.slice(0, MAX_ROUTINE_CHARS)}\n[Routine truncated to ${MAX_ROUTINE_CHARS} characters]`;

      const [user, courses] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: facultyId }, select: { name: true } }),
        prisma.course.findMany({ where: { facultyId }, select: { id: true, courseCode: true, courseName: true } }),
      ]);
      const facultyName = options.facultyName?.trim() || user.name;
      const initials = options.initials?.trim() || facultyName.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("");
      // A personal routine has no teacher column: if neither the name nor the initials occur
      // anywhere in the document, filtering would drop everything, so treat all rows as theirs.
      const haystack = text.toUpperCase();
      const surname = facultyName.split(/\s+/).pop()?.toUpperCase() ?? "";
      const nameAppears =
        haystack.includes(facultyName.toUpperCase()) ||
        (surname.length > 2 && haystack.includes(surname)) ||
        (initials.length >= 2 && new RegExp(`(^|[^A-Z])${initials.replace(/[^A-Z]/g, "")}([^A-Z]|$)`).test(haystack));
      const personal = Boolean(options.allRowsAreMine) || !nameAppears;
      const warnings: string[] = [];
      if (personal && !options.allRowsAreMine) warnings.push(`"${facultyName}" / "${initials}" does not appear in the document, so every class row was treated as yours.`);

      const { consensus } = await runLlmAnalysis(
        ROUTINE_EXTRACT_PROMPT,
        [{ text, scope: personal ? "PERSONAL" : "FACULTY", facultyName, facultyInitials: initials, knownCourses: courses.map((c) => ({ code: c.courseCode, name: c.courseName })) }],
        routineExtractResponseSchema,
        { cache: false }
      );

      const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const slots = consensus.slots
        .filter((s) => toMinutes(s.endTime) > toMinutes(s.startTime))
        .map((s) => {
          const match = courses.find((c) => norm(s.courseLabel).includes(norm(c.courseCode)));
          return { ...s, courseId: match?.id ?? null, matchedCourse: match ? `${match.courseCode} — ${match.courseName}` : null, source: "AI_IMPORT" as const };
        })
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
      if (!slots.length) {
        throw new AppError(
          personal
            ? `No class rows could be read from ${file.originalname}. Try a sharper photo or a PDF, or add slots manually.`
            : `No classes for "${facultyName}" (${initials}) were found in ${file.originalname}. If this routine is only yours, tick "all classes are mine"; otherwise check the initials.`,
          422
        );
      }

      return {
        file: file.originalname,
        facultyName,
        initials,
        scope: personal ? ("PERSONAL" as const) : ("FACULTY" as const),
        slots,
        termHint: consensus.termHint ?? null,
        warnings: [...warnings, ...(consensus.warnings ?? [])],
        lowConfidence: slots.filter((s) => s.confidence < 60).length,
        textChars: text.length,
        method,
      };
    });
  },
};
