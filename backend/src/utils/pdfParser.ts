import fs from "fs";
import pdfParse from "pdf-parse";

/** Extracts raw text from an uploaded PDF file on disk. */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer);
  return result.text;
}
