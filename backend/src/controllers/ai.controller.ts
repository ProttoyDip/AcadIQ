import { Response, NextFunction } from "express";
import { promises as fs } from "fs";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { success } from "../utils/apiResponse";
import { prisma } from "../database/prismaClient";
import { pdfParserService } from "../services/pdf/pdfParser.service";
import { chunkingService } from "../services/rag/chunking.service";
import { embeddingService } from "../services/ollama/embedding.service";
import { pdfSummaryService } from "../services/pdf/pdfSummary.service";
import { pdfQAService } from "../services/pdf/pdfQA.service";
import { imageAnalysisService } from "../services/vision/imageAnalysis.service";
import { courseParserService } from "../services/question/courseParser.service";
import { questionGeneratorService } from "../services/question/questionGenerator.service";
import { ollamaService } from "../services/ollama/ollama.service";
import { getModelCatalog } from "../ai/providers";
import {
  pdfSummarizeSchema,
  pdfAskSchema,
  imageAnalyzeSchema,
  courseGenerateQuestionsSchema,
} from "../validators/ai.validator";

async function unlinkSafely(path?: string) {
  if (path) {
    await fs.unlink(path).catch(() => undefined);
  }
}

export const aiController = {
  /**
   * Allowlisted chat model catalogue for the model picker. Credentials and
   * endpoints stay server-side; only provider/model identifiers are returned.
   */
  async listModels(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return success(res, getModelCatalog());
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check Ollama status and model readiness.
   */
  async getStatus(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = await ollamaService.getStatus();
      return success(res, status);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload, parse, chunk, and embed a PDF document.
   */
  async uploadPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const file = req.file;
    if (!file) {
      return next(new AppError("A PDF file is required", 400));
    }

    try {
      // 1. Extract text and page layout
      const parsed = await pdfParserService.parsePdf(file.path);

      // 2. Create document record in database
      const document = await prisma.document.create({
        data: {
          userId: req.user?.userId || null,
          title: (req.body.title || file.originalname.replace(/\.[^/.]+$/, "")).trim(),
          originalName: file.originalname,
          filePath: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
          fileType: "PDF",
          extractedText: parsed.fullText,
          status: "PROCESSING",
          metadata: {
            pageCount: parsed.pageCount,
            info: parsed.info,
          },
        },
      });

      // 3. Chunk text (page-aware)
      const chunks = chunkingService.chunkPages(parsed.pages);

      // 4. Generate embeddings and store chunks
      for (const chunk of chunks) {
        let embeddingBuffer: Buffer | null = null;
        try {
          const vector = await embeddingService.embedDocument(chunk.content);
          embeddingBuffer = embeddingService.vectorToBuffer(vector);
        } catch {
          // If embedding fails for a single chunk, chunk is still saved for keyword retrieval
        }

        await prisma.documentChunk.create({
          data: {
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            section: chunk.section,
            tokenCount: chunk.tokenCount,
            embedding: embeddingBuffer,
          },
        });
      }

      // 5. Update document status to PROCESSED
      const updated = await prisma.document.update({
        where: { id: document.id },
        data: { status: "PROCESSED" },
        select: {
          id: true,
          title: true,
          originalName: true,
          fileSize: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
      });

      return success(
        res,
        {
          documentId: updated.id,
          title: updated.title,
          originalName: updated.originalName,
          fileSize: updated.fileSize,
          pageCount: parsed.pageCount,
          chunkCount: chunks.length,
          status: updated.status,
          createdAt: updated.createdAt,
        },
        201
      );
    } catch (error) {
      await unlinkSafely(file.path);
      next(error);
    }
  },

  /**
   * Summarize an existing PDF document.
   */
  async summarizePdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = pdfSummarizeSchema.parse(req.body);
      const result = await pdfSummaryService.summarizeDocument(input.documentId, input.type);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Ask question about an uploaded PDF with RAG retrieval.
   */
  async askPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const input = pdfAskSchema.parse(req.body);
      const result = await pdfQAService.askQuestion(input.documentId, input.question);
      return success(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Analyze an image with Qwen2.5-VL vision AI.
   */
  async analyzeImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const file = req.file;
    try {
      const input = imageAnalyzeSchema.parse(req.body);

      if (!file && !req.body.base64) {
        throw new AppError("An image file (or base64 image data) is required", 400);
      }

      const result = await imageAnalysisService.analyzeImage({
        filePath: file?.path,
        base64: req.body.base64,
        mimeType: file?.mimetype,
        question: input.question,
      });

      // Clean up temporary uploaded image file after analysis
      if (file?.path) {
        await unlinkSafely(file.path);
      }

      return success(res, result);
    } catch (error) {
      if (file?.path) {
        await unlinkSafely(file.path);
      }
      next(error);
    }
  },

  /**
   * Generate questions from course outline / syllabus.
   */
  async generateCourseQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const file = req.file;
    try {
      const input = courseGenerateQuestionsSchema.parse(req.body);

      let courseText = input.courseText;
      let documentId = input.documentId;

      if (file) {
        const parsed = await courseParserService.parseCourseFile(file.path, file.mimetype);
        courseText = parsed.rawText;

        // Persist course outline document record
        const doc = await prisma.document.create({
          data: {
            userId: req.user?.userId || null,
            title: file.originalname.replace(/\.[^/.]+$/, ""),
            originalName: file.originalname,
            filePath: file.path,
            mimeType: file.mimetype,
            fileSize: file.size,
            fileType: "COURSE_OUTLINE",
            extractedText: parsed.rawText,
            status: "PROCESSED",
            metadata: {
              detectedTopics: parsed.topics,
            },
          },
        });
        documentId = doc.id;
      } else if (documentId && !courseText) {
        const existing = await prisma.document.findUnique({
          where: { id: documentId },
          select: { extractedText: true },
        });
        if (!existing || !existing.extractedText) {
          throw new AppError("Document not found or contains no course outline text", 404);
        }
        courseText = existing.extractedText;
      }

      if (!courseText) {
        throw new AppError("Course outline file or text content is required", 400);
      }

      const result = await questionGeneratorService.generateQuestions({
        courseText,
        documentId,
        userId: req.user?.userId,
        questionCount: input.questionCount,
        questionType: input.questionType,
        difficulty: input.difficulty,
        topic: input.topic,
        includeAnswers: input.includeAnswers,
        includeExplanations: input.includeExplanations,
      });

      return success(res, result);
    } catch (error) {
      if (file?.path) {
        await unlinkSafely(file.path);
      }
      next(error);
    }
  },

  /**
   * Get single document metadata.
   */
  async getDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError("Invalid document ID", 400);
      }

      const doc = await prisma.document.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          fileType: true,
          summary: true,
          keyPoints: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          _count: {
            select: { chunks: true, questions: true },
          },
        },
      });

      if (!doc) {
        throw new AppError("Document not found", 404);
      }

      return success(res, {
        ...doc,
        chunkCount: doc._count.chunks,
        questionCount: doc._count.questions,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a document and all related chunks/questions.
   */
  async deleteDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError("Invalid document ID", 400);
      }

      const doc = await prisma.document.findUnique({
        where: { id },
        select: { id: true, filePath: true, userId: true },
      });

      if (!doc) {
        throw new AppError("Document not found", 404);
      }

      // Check ownership if user is logged in
      if (req.user?.userId && doc.userId && doc.userId !== req.user.userId) {
        throw new AppError("You do not have permission to delete this document", 403);
      }

      // Remove physical file
      await unlinkSafely(doc.filePath);

      // Cascade delete in database
      await prisma.document.delete({
        where: { id },
      });

      return success(res, { deleted: true, documentId: id });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List uploaded documents for the user.
   */
  async listDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const docs = await prisma.document.findMany({
        where: req.user?.userId ? { userId: req.user.userId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          originalName: true,
          fileType: true,
          fileSize: true,
          status: true,
          summary: true,
          keyPoints: true,
          createdAt: true,
          metadata: true,
          _count: {
            select: { chunks: true, questions: true },
          },
        },
      });

      return success(
        res,
        docs.map((d) => ({
          ...d,
          chunkCount: d._count.chunks,
          questionCount: d._count.questions,
        }))
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * List generated questions history for the user.
   */
  async getQuestionsHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const documentId = req.query.documentId ? Number(req.query.documentId) : undefined;
      const type = typeof req.query.type === "string" && req.query.type ? req.query.type : undefined;
      const difficulty = typeof req.query.difficulty === "string" && req.query.difficulty ? req.query.difficulty : undefined;
      const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;

      const where: any = {};
      if (req.user?.userId) {
        where.OR = [
          { userId: req.user.userId },
          { document: { userId: req.user.userId } },
          { userId: null },
        ];
      }
      if (documentId) where.documentId = documentId;
      if (type) where.type = type;
      if (difficulty) where.difficulty = difficulty;
      if (search) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { question: { contains: search } },
              { topic: { contains: search } },
            ],
          },
        ];
      }

      const questions = await prisma.generatedQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          document: {
            select: { id: true, title: true, originalName: true },
          },
        },
      });

      return success(res, questions);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a generated question.
   */
  async deleteQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        throw new AppError("Invalid question ID", 400);
      }

      const q = await prisma.generatedQuestion.findUnique({
        where: { id },
        include: { document: { select: { userId: true } } },
      });

      if (!q) {
        throw new AppError("Question not found", 404);
      }

      if (req.user?.userId && q.userId && q.userId !== req.user.userId && q.document?.userId !== req.user.userId) {
        throw new AppError("You do not have permission to delete this question", 403);
      }

      await prisma.generatedQuestion.delete({ where: { id } });
      return success(res, { deleted: true, questionId: id });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Aggregated AI history and overview stats for the user.
   */
  async getAiHistoryOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userFilter = req.user?.userId ? { userId: req.user.userId } : undefined;

      const [totalDocuments, totalQuestions, documentsWithSummary] = await Promise.all([
        prisma.document.count({ where: userFilter }),
        prisma.generatedQuestion.count({
          where: req.user?.userId
            ? {
                OR: [
                  { userId: req.user.userId },
                  { document: { userId: req.user.userId } },
                ],
              }
            : undefined,
        }),
        prisma.document.findMany({
          where: {
            ...(userFilter || {}),
            summary: { not: null },
          },
          select: {
            id: true,
            title: true,
            originalName: true,
            summary: true,
            keyPoints: true,
            createdAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
      ]);

      const recentQuestions = await prisma.generatedQuestion.findMany({
        where: req.user?.userId
          ? {
              OR: [
                { userId: req.user.userId },
                { document: { userId: req.user.userId } },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          document: {
            select: { id: true, title: true },
          },
        },
      });

      return success(res, {
        totalDocuments,
        totalQuestions,
        readySummariesCount: documentsWithSummary.length,
        documentsWithSummary,
        recentQuestions,
      });
    } catch (error) {
      next(error);
    }
  },
};
