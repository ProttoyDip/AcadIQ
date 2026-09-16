import { prisma } from "../../database/prismaClient";
import { gemmaService } from "../ollama/gemma.service";
import { AppError } from "../../middleware/error.middleware";

export type SummaryType = "short" | "detailed" | "key_points" | "important_concepts" | "topic_summary";

export interface SummaryResult {
  documentId: number;
  summaryType: SummaryType;
  summary: string;
  keyPoints: string[];
}

interface StructuredSummaryJson {
  summary: string;
  keyPoints: string[];
}

export class PdfSummaryService {
  /**
   * Generates a summary for a PDF document based on requested type.
   */
  async summarizeDocument(documentId: number, type: SummaryType = "detailed"): Promise<SummaryResult> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          select: { content: true, pageNumber: true },
          take: 30, // reasonable representative sample for very long documents
          orderBy: { chunkIndex: "asc" },
        },
      },
    });

    if (!document) {
      throw new AppError("Document not found", 404);
    }

    // Build representative text context from document or chunks
    let textToSummarize = document.extractedText || "";
    if (!textToSummarize && document.chunks.length > 0) {
      textToSummarize = document.chunks.map((c) => c.content).join("\n\n");
    }

    if (!textToSummarize || textToSummarize.trim().length === 0) {
      throw new AppError("Document has no extractable text content to summarize", 422);
    }

    // Limit text to ~25,000 characters to keep local model fast and within memory
    if (textToSummarize.length > 25000) {
      textToSummarize = textToSummarize.slice(0, 25000) + "\n\n... [Content truncated for summary] ...";
    }

    let typeInstruction = "";
    switch (type) {
      case "short":
        typeInstruction = "Provide a concise executive summary in 1-2 focused paragraphs highlighting the primary purpose, core findings, and overall conclusion.";
        break;
      case "detailed":
        typeInstruction = "Provide an in-depth, comprehensive summary detailing the background, core methodologies, major arguments, key findings, and practical implications.";
        break;
      case "key_points":
        typeInstruction = "Provide an analytical summary focusing on the most critical takeaways, followed by a detailed list of key points.";
        break;
      case "important_concepts":
        typeInstruction = "Focus on identifying, defining, and explaining the key theoretical concepts, formulas, terminology, and principles introduced in this text.";
        break;
      case "topic_summary":
        typeInstruction = "Organize the summary by the distinct topics, units, or chapters identified in the text, detailing what each covers.";
        break;
      default:
        typeInstruction = "Provide a clear and thorough educational summary of this document.";
    }

    const prompt = `You are an expert academic professor analyzing a curriculum or scholarly document.
Task: ${typeInstruction}

Document Text:
${textToSummarize}

Format your response as a JSON object with two fields:
1. "summary": A well-structured markdown string containing the summary according to the specified style.
2. "keyPoints": An array of 5 to 10 strings representing bullet-point key takeaways or concepts.

Return valid JSON ONLY.`;

    let generated: StructuredSummaryJson;
    try {
      generated = await gemmaService.generateJson<StructuredSummaryJson>(prompt);
    } catch {
      // Fallback: generate plain text if JSON formatting fails
      const fallbackText = await gemmaService.generateText(
        `Summarize the following document according to this instruction: ${typeInstruction}\n\nDocument:\n${textToSummarize}`
      );
      generated = {
        summary: fallbackText,
        keyPoints: [
          "Document analyzed successfully",
          "Summary generated via local Gemma 3 model",
        ],
      };
    }

    // Save summary and key points to document in database
    await prisma.document.update({
      where: { id: documentId },
      data: {
        summary: generated.summary,
        keyPoints: generated.keyPoints,
        status: "PROCESSED",
      },
    });

    return {
      documentId,
      summaryType: type,
      summary: generated.summary,
      keyPoints: Array.isArray(generated.keyPoints) ? generated.keyPoints : [],
    };
  }
}

export const pdfSummaryService = new PdfSummaryService();
