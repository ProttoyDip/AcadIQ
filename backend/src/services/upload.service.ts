import { documentRepository } from "../repositories/document.repository";
import { questionRepository } from "../repositories/question.repository";
import { extractTextFromPdf } from "../utils/pdfParser";

/** Splits raw question-paper text into individual questions using a numbering heuristic. */
function splitIntoQuestions(text: string): { questionText: string; marks: number }[] {
  const chunks = text.split(/\n\s*(?:Q\.?\s*\d+|Question\s*\d+|\d+[.)])\s*/gi).filter((c) => c.trim().length > 0);

  return chunks.map((chunk) => {
    const marksMatch = chunk.match(/\[(\d+)\s*marks?\]/i) ?? chunk.match(/\((\d+)\)/);
    return {
      questionText: chunk.trim(),
      marks: marksMatch ? Number(marksMatch[1]) : 0,
    };
  });
}

export const uploadService = {
  async uploadSyllabus(courseId: number, filePath: string) {
    return documentRepository.createSyllabusDocument(courseId, filePath);
  },

  async uploadQuestionPaper(courseId: number, year: number, semester: string, filePath: string) {
    const paper = await documentRepository.createQuestionPaper({ courseId, year, semester, filePath });

    const text = await extractTextFromPdf(filePath);
    const questions = splitIntoQuestions(text);
    if (questions.length > 0) {
      await questionRepository.createMany(paper.id, questions);
    }

    return paper;
  },

  extractText(filePath: string) {
    return extractTextFromPdf(filePath);
  },
};
