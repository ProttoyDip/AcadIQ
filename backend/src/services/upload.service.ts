import { extractPdfText } from "../ai/pdfTextExtractor";
import { extractQuestions } from "../ai/questionExtractor";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { UploadedPdf } from "../validators/document.validator";

async function assertCourseOwnership(courseId: number, facultyId: number) {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) throw new AppError("Course not found", 404);
}

function fileData(courseId: number, file: UploadedPdf) {
  return {
    courseId,
    filePath: file.path,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
}

export const uploadService = {
  async uploadSyllabus(facultyId: number, courseId: number, file: UploadedPdf) {
    await assertCourseOwnership(courseId, facultyId);
    await extractPdfText(file.path);
    return documentRepository.createSyllabusDocument(fileData(courseId, file));
  },

  async uploadQuestionPaper(
    facultyId: number,
    courseId: number,
    year: number,
    semester: string,
    file: UploadedPdf
  ) {
    await assertCourseOwnership(courseId, facultyId);
    const questions = extractQuestions(await extractPdfText(file.path));
    if (questions.length > 500 || questions.some((question) => question.questionText.length > 60_000)) {
      throw new AppError("The question paper is too large to store safely", 413);
    }
    return documentRepository.createQuestionPaperWithQuestions(
      { ...fileData(courseId, file), year, semester },
      questions
    );
  },
};
