import { promises as fs } from "fs";
import mammoth from "mammoth";
import JSZip from "jszip";
import { AppError } from "../middleware/error.middleware";
import { extractPdfText } from "./pdfTextExtractor";

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
  "application/msword",
]);
const PPTX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/** Slide decks: concatenates `<a:t>` runs per slide, in slide order, with a "Slide N" marker so chunks stay citeable. */
export async function extractPptxText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError("The uploaded file is not a valid PPTX", 400);
  }
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  if (!slideFiles.length) throw new AppError("The presentation contains no slides", 422);

  const slides: string[] = [];
  for (const [index, name] of slideFiles.entries()) {
    const xml = await zip.file(name)!.async("string");
    // Paragraph boundaries become newlines; text runs inside a paragraph are joined.
    const paragraphs = [...xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map((p) =>
      [...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXmlEntities(t[1])).join("")
    ).filter((line) => line.trim());
    const notesName = `ppt/notesSlides/notesSlide${index + 1}.xml`;
    const notes = zip.file(notesName)
      ? [...(await zip.file(notesName)!.async("string")).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXmlEntities(t[1])).join(" ").trim()
      : "";
    if (paragraphs.length || notes) {
      slides.push(`Slide ${index + 1}\n${paragraphs.join("\n")}${notes ? `\nNotes: ${notes}` : ""}`);
    }
  }
  const text = slides.join("\n\n").replace(/\u0000/g, "").trim();
  if (!text) throw new AppError("The presentation contains no extractable text", 422);
  return text;
}

export async function extractDocxText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const hasZipSignature = buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && ((buffer[2] === 0x03 && buffer[3] === 0x04)
      || (buffer[2] === 0x05 && buffer[3] === 0x06)
      || (buffer[2] === 0x07 && buffer[3] === 0x08));
  if (!hasZipSignature) {
    throw new AppError("The uploaded file is not a valid DOCX", 400);
  }

  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
    if (!text) throw new AppError("The DOCX document contains no extractable text", 422);
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("The DOCX document could not be parsed", 422);
  }
}

export function extractDocumentText(filePath: string, mimeType?: string): Promise<string> {
  const lower = filePath.toLowerCase();
  // A declared, specific MIME type wins; the extension only decides for generic/unknown types.
  const generic = !mimeType || mimeType === "application/octet-stream";
  const isDocx = mimeType ? DOCX_MIME_TYPES.has(mimeType) || (generic && lower.endsWith(".docx")) : lower.endsWith(".docx");
  if (isDocx) return extractDocxText(filePath);
  const isPptx = mimeType ? PPTX_MIME_TYPES.has(mimeType) || (generic && lower.endsWith(".pptx")) : lower.endsWith(".pptx");
  if (isPptx) return extractPptxText(filePath);
  const isText = mimeType
    ? TEXT_MIME_TYPES.has(mimeType) || (generic && (lower.endsWith(".txt") || lower.endsWith(".md")))
    : lower.endsWith(".txt") || lower.endsWith(".md");
  if (isText) {
    return fs.readFile(filePath, "utf-8").then((text) => {
      const clean = text.replace(/\u0000/g, "").trim();
      if (!clean) throw new AppError("The text document is empty", 422);
      return clean;
    });
  }
  return extractPdfText(filePath);
}
export { extractPdfText };
