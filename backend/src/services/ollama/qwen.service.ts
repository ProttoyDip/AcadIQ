import { ollamaService } from "./ollama.service";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";

export interface ImageAnalysisOptions {
  imageBase64: string;
  question?: string;
  systemPrompt?: string;
  temperature?: number;
}

export class QwenService {
  /**
   * Cleans base64 data URI headers (e.g. data:image/png;base64,...)
   */
  private cleanBase64(raw: string): string {
    if (raw.includes(",")) {
      return raw.split(",")[1].trim();
    }
    return raw.trim();
  }

  /**
   * Analyze an image using Qwen2.5-VL via Ollama.
   */
  async analyzeImage(options: ImageAnalysisOptions): Promise<string> {
    const cleanImg = this.cleanBase64(options.imageBase64);
    if (!cleanImg) {
      throw new AppError("A valid image is required for vision analysis", 400);
    }

    const question = options.question?.trim() || "What is shown in this image? Provide an educational breakdown.";

    const defaultSystem = `You are AcadIQ's Academic Vision Intelligence Assistant powered by Qwen2.5-VL.
Your expertise includes:
- Detailed breakdown of educational diagrams, flowcharts, architectures, and biological/physical schemas
- Accurate reading and transcription of text, scanned handwriting, and code screenshots (OCR)
- Visual interpretation of charts, plots, axes, trends, data tables, and legends
- Recognition and step-by-step explanation of mathematical equations, proofs, and scientific formulas
- Clear pedagogical explanations tailored for faculty and students.

Guidelines:
1. Provide structured, lucid, and thorough answers.
2. If text or formulas are present, quote or transcribe them accurately.
3. If analyzing charts, report explicit data points, labels, and overall trends.
4. Highlight key takeaways and conceptual explanations.`;

    const response = await ollamaService.generate({
      model: env.ollama.visionModel,
      prompt: question,
      system: options.systemPrompt || defaultSystem,
      images: [cleanImg],
      temperature: options.temperature ?? 0.2,
      timeoutMs: env.ollama.timeoutMs,
    });

    return response.trim();
  }
}

export const qwenService = new QwenService();
