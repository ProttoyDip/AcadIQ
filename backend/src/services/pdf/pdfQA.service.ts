import { prisma } from "../../database/prismaClient";
import { ragService, RagAnswerResult } from "../rag/rag.service";
import { AppError } from "../../middleware/error.middleware";

export interface PdfQAResponse extends RagAnswerResult {
  documentId: number;
  documentTitle: string;
}

export class PdfQAService {
  /**
   * Answers a question about an uploaded PDF document using RAG.
   */
  async askQuestion(documentId: number, question: string): Promise<PdfQAResponse> {
    if (!question || !question.trim()) {
      throw new AppError("Question text is required", 400);
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, status: true },
    });

    if (!document) {
      throw new AppError("Document not found", 404);
    }

    const chunkCount = await prisma.documentChunk.count({
      where: { documentId },
    });

    if (chunkCount === 0) {
      throw new AppError(
        "Document has no indexed chunks. Please re-upload or wait for processing to finish.",
        422
      );
    }

    const ragResult = await ragService.answerDocumentQuestion(documentId, question.trim());

    return {
      documentId: document.id,
      documentTitle: document.title,
      ...ragResult,
    };
  }
}

export const pdfQAService = new PdfQAService();
