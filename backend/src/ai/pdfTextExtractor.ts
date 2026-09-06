import { promises as fs } from "fs";
import pdfParse from "pdf-parse";
import { AppError } from "../middleware/error.middleware";

const PDF_SIGNATURE = "%PDF-";

/** Validates the file signature and extracts normalized text from a PDF. */
export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (buffer.subarray(0, PDF_SIGNATURE.length).toString("ascii") !== PDF_SIGNATURE) {
    throw new AppError("The uploaded file is not a valid PDF", 400);
  }

  try {
    // pdf.js can misinterpret Node Buffers as PDF strings on newer Node
    // runtimes. A plain Uint8Array preserves the binary bytes consistently.
    const bytes = new Uint8Array(buffer);
    const result = await pdfParse(bytes as unknown as Buffer);
    const text = result.text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
    if (!text) throw new AppError("The PDF contains no extractable text", 422);
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("The PDF could not be parsed", 422);
  }
}
