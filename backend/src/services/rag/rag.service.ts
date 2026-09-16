import { retrievalService, RetrievedChunkResult } from "./retrieval.service";
import { gemmaService } from "../ollama/gemma.service";
import { env } from "../../config/env";

export interface RagSource {
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  similarity: number;
  snippet: string;
}

export interface RagAnswerResult {
  answer: string;
  grounded: boolean;
  sources: RagSource[];
  model: string;
}

export class RagService {
  /**
   * Execute full RAG question answering pipeline over document chunks.
   */
  async answerDocumentQuestion(
    documentId: number,
    question: string,
    topK = 5
  ): Promise<RagAnswerResult> {
    const relevantChunks: RetrievedChunkResult[] = await retrievalService.retrieveChunks(
      documentId,
      question,
      { topK, similarityFloor: 0.35 }
    );

    const sources: RagSource[] = relevantChunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      section: chunk.section,
      similarity: chunk.similarity,
      snippet: chunk.content.length > 200 ? `${chunk.content.slice(0, 197)}...` : chunk.content,
    }));

    const result = await gemmaService.answerQuestionWithContext(
      question,
      relevantChunks.map((c) => ({
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        section: c.section,
      }))
    );

    return {
      answer: result.answer,
      grounded: result.grounded,
      sources,
      model: env.ollama.textModel,
    };
  }
}

export const ragService = new RagService();
