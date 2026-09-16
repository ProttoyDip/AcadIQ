import { promises as fs } from "fs";
import { qwenService } from "../ollama/qwen.service";
import { AppError } from "../../middleware/error.middleware";
import { env } from "../../config/env";

export interface AnalyzeImageInput {
  filePath?: string;
  base64?: string;
  mimeType?: string;
  question?: string;
}

export interface AnalyzeImageOutput {
  answer: string;
  question: string;
  model: string;
}

export class ImageAnalysisService {
  /**
   * Analyzes an uploaded educational or academic image using Qwen2.5-VL.
   */
  async analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
    let base64String = input.base64;

    if (!base64String && input.filePath) {
      try {
        const buffer = await fs.readFile(input.filePath);
        base64String = buffer.toString("base64");
      } catch {
        throw new AppError("Failed to read the uploaded image file", 500);
      }
    }

    if (!base64String) {
      throw new AppError("No image data provided for vision analysis", 400);
    }

    const question = input.question?.trim() || "What is shown in this image? Provide an educational breakdown.";

    const answer = await qwenService.analyzeImage({
      imageBase64: base64String,
      question,
    });

    return {
      answer,
      question,
      model: env.ollama.visionModel,
    };
  }
}

export const imageAnalysisService = new ImageAnalysisService();
