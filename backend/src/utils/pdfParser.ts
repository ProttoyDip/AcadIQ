import { extractPdfText } from "../ai/pdfTextExtractor";

/** Extracts raw text from an uploaded PDF file on disk. */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  return extractPdfText(filePath);
}
