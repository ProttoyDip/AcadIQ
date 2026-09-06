import { extractDocumentText } from "../ai/documentTextExtractor";
import { extractQuestions } from "../ai/questionExtractor";
import { AppError } from "../middleware/error.middleware";
import { courseRepository } from "../repositories/course.repository";
import { documentRepository } from "../repositories/document.repository";
import { UploadedDocument } from "../validators/document.validator";

async function assertCourseOwnership(courseId: number, facultyId: number) {
  const course = await courseRepository.findOwnedById(courseId, facultyId);
  if (!course) throw new AppError("Course not found", 404);
}

function fileData(courseId: number, file: UploadedDocument) {
  return {
    courseId,
    filePath: file.path,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
}

import { auditService } from "./audit.service";

export const uploadService = {
  async uploadSyllabus(facultyId: number, courseId: number, file: UploadedDocument) {
    await assertCourseOwnership(courseId, facultyId);
    await extractDocumentText(file.path, file.mimetype);
    const doc = await documentRepository.createSyllabusDocument(facultyId, fileData(courseId, file));
    await auditService.recordAuditLog({
      userId: facultyId,
      action: "Faculty uploaded syllabus",
      document: file.originalname,
    });
    return doc;
  },

  async uploadQuestionPaper(
    facultyId: number,
    courseId: number,
    year: number,
    semester: string,
    file: UploadedDocument
  ) {
    await assertCourseOwnership(courseId, facultyId);
    const questions = extractQuestions(await extractDocumentText(file.path, file.mimetype));
    if (questions.length > 500 || questions.some((question) => question.questionText.length > 60_000)) {
      throw new AppError("The question paper is too large to store safely", 413);
    }
    const paper = await documentRepository.createQuestionPaperWithQuestions(
      facultyId,
      { ...fileData(courseId, file), year, semester },
      questions
    );
    await auditService.recordAuditLog({
      userId: facultyId,
      action: "Faculty uploaded exam paper",
      document: file.originalname,
    });
    return paper;
  },
};
