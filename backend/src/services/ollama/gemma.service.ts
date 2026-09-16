import { ollamaService } from "./ollama.service";
import { AppError } from "../../middleware/error.middleware";

export interface DocumentContextItem {
  content: string;
  chunkIndex?: number;
  pageNumber?: number | null;
  section?: string | null;
}

export class GemmaService {
  /**
   * Helper to clean JSON string from LLM responses (strips markdown codeblocks if present).
   */
  public cleanJsonResponse(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }
    return clean.trim();
  }

  /**
   * General text generation with Gemma 3.
   */
  async generateText(prompt: string, system?: string, temperature = 0.3): Promise<string> {
    return ollamaService.generate({
      prompt,
      system: system || "You are an expert academic AI tutor and pedagogical assistant in AcadIQ.",
      temperature,
    });
  }

  /**
   * Generate structured JSON with Gemma 3.
   */
  async generateJson<T>(prompt: string, system?: string, temperature = 0.1): Promise<T> {
    const raw = await ollamaService.generate({
      prompt,
      system: (system ? `${system}\n` : "") + "Return valid JSON ONLY. Do not include introductory text, conversational remarks, or closing commentary.",
      format: "json",
      temperature,
    });

    const cleaned = this.cleanJsonResponse(raw);
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // If parsing fails directly, try locating the first '{' or '[' and last '}' or ']'
      const start = Math.min(
        cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
        cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("[")
      );
      const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
      if (start !== Infinity && end !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.substring(start, end + 1)) as T;
        } catch {
          // fallback
        }
      }
      throw new AppError("The AI model returned an invalid JSON response format. Please retry.", 502);
    }
  }

  /**
   * Answer a question based on retrieved context passages with strict grounding and anti-hallucination.
   */
  async answerQuestionWithContext(
    question: string,
    contextItems: DocumentContextItem[]
  ): Promise<{ answer: string; grounded: boolean }> {
    if (!contextItems || contextItems.length === 0) {
      return {
        answer: "The uploaded document does not contain sufficient information to answer this question, as no relevant excerpts could be retrieved.",
        grounded: false,
      };
    }

    const contextText = contextItems
      .map((item, idx) => {
        const sourceMeta = [
          item.pageNumber ? `Page ${item.pageNumber}` : null,
          item.section ? `Section: ${item.section}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        return `[EXCERPT ${idx + 1}${sourceMeta ? ` - ${sourceMeta}` : ""}]\n${item.content}`;
      })
      .join("\n\n");

    const systemPrompt = `You are AcadIQ's Academic Document Assistant. Your role is to answer questions strictly based on the provided document excerpts.

CRITICAL INSTRUCTIONS:
1. Base your answer EXCLUSIVELY on the provided document excerpts below.
2. If the excerpts do not contain the answer, or if you cannot definitively verify it from the text, state clearly: "The uploaded document does not contain sufficient information to answer this question." Do not attempt to guess or hallucinate.
3. Where possible and relevant, cite the source page numbers or sections mentioned in the excerpts.
4. Keep explanations educational, objective, and clear.`;

    const userPrompt = `Document Excerpts:
${contextText}

Question:
${question}

Answer:`;

    const answer = await this.generateText(userPrompt, systemPrompt, 0.2);
    const ungroundedPatterns = [
      "not contain sufficient information",
      "not mentioned in the provided",
      "not found in the document",
      "cannot be answered from the provided",
      "information is not available in the uploaded document",
    ];
    const isUngrounded = ungroundedPatterns.some((pattern) =>
      answer.toLowerCase().includes(pattern)
    );

    return {
      answer: answer.trim(),
      grounded: !isUngrounded,
    };
  }
}

export const gemmaService = new GemmaService();
