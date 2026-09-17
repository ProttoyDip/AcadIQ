import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "../../middleware/error.middleware";
import { extractDocumentText } from "../../ai/documentTextExtractor";
import { callLlmVision } from "../../ai/llmClient";
import { env } from "../../config/env";

export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS = new Map([[".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"], [".webp", "image/webp"]]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Groq caps base64 images at ~4 MB.

const TRANSCRIBE_INSTRUCTION = `This is a photo or scan of a university class routine / timetable.
Transcribe it faithfully into plain text, one class per line, in this exact form:
DAY | START-END (24h HH:MM) | COURSE CODE and title if shown | SECTION | ROOM | TEACHER
Rules: keep every row, including other teachers'. Expand merged cells (a class spanning two periods becomes one row with the combined time). Use the day names printed. If a cell is unreadable write "?" for that field. Do not add commentary — output only the rows, preceded by one line with the routine title/term if visible.`;

export function isImageFile(file: { mimetype: string; originalname: string }): boolean {
  return IMAGE_MIME_TYPES.has(file.mimetype) || IMAGE_EXTENSIONS.has(path.extname(file.originalname).toLowerCase());
}

/** Text of a routine regardless of format: documents are parsed, images are transcribed by the vision model. */
export async function routineFileToText(file: { path: string; mimetype: string; originalname: string }): Promise<{ text: string; method: "DOCUMENT" | "VISION" }> {
  if (!isImageFile(file)) return { text: await extractDocumentText(file.path, file.mimetype), method: "DOCUMENT" };
  if (!env.visionModel) throw new AppError("Image import is disabled on this server (VISION_MODEL is empty). Upload a PDF or DOCX instead.", 400);
  const stat = await fs.stat(file.path);
  if (stat.size > MAX_IMAGE_BYTES) throw new AppError("Routine photo must be under 4 MB — crop or compress it and try again", 413);
  const mimeType = IMAGE_MIME_TYPES.has(file.mimetype) ? file.mimetype : IMAGE_EXTENSIONS.get(path.extname(file.originalname).toLowerCase())!;
  const base64 = (await fs.readFile(file.path)).toString("base64");
  const text = await callLlmVision({ mimeType, base64 }, TRANSCRIBE_INSTRUCTION);
  if (text.replace(/\W/g, "").length < 20) throw new AppError("Could not read a timetable from this image. Try a sharper, straight-on photo.", 422);
  return { text, method: "VISION" };
}
