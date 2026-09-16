import { extractDocumentText } from "../../ai/documentTextExtractor";
import { AppError } from "../../middleware/error.middleware";

export interface ParsedCourseContent {
  rawText: string;
  topics: string[];
  moduleCount: number;
}

const MODULE_OR_TOPIC_REGEX = /^(?:module|unit|chapter|topic|week)\s+[\dIVXLC]+[:.-]?\s*([^\n]+)/gim;

export class CourseParserService {
  /**
   * Extracts clean text from an uploaded course outline file (PDF, DOCX, TXT).
   */
  async parseCourseFile(filePath: string, mimeType?: string): Promise<ParsedCourseContent> {
    let rawText: string;
    try {
      rawText = await extractDocumentText(filePath, mimeType);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to parse course outline document: ${error.message}`, 422);
    }

    const cleanText = rawText
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!cleanText || cleanText.length < 30) {
      throw new AppError("The uploaded course outline contains insufficient text content.", 422);
    }

    // Extract potential topic/module headers for UI suggestions
    const topics: string[] = [];
    const matches = cleanText.matchAll(MODULE_OR_TOPIC_REGEX);
    for (const match of matches) {
      const topicName = match[0].trim();
      if (topicName && !topics.includes(topicName)) {
        topics.push(topicName.slice(0, 120));
      }
    }

    return {
      rawText: cleanText,
      topics: topics.slice(0, 20),
      moduleCount: topics.length,
    };
  }
}

export const courseParserService = new CourseParserService();
