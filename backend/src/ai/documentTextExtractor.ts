import { promises as fs } from "fs";
import mammoth from "mammoth";
import { AppError } from "../middleware/error.middleware";
import { extractPdfText } from "./pdfTextExtractor";

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
  "application/msword",
]);

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
  const isDocx = (mimeType && DOCX_MIME_TYPES.has(mimeType)) || filePath.toLowerCase().endsWith(".docx");
  if (isDocx) {
    return extractDocxText(filePath);
  }
  return extractPdfText(filePath);
}
export { extractPdfText };
