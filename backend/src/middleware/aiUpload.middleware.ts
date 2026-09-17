import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { AppError } from "./error.middleware";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ai_${randomUUID()}${ext}`);
  },
});

// PDF Upload
const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadAiPdf = multer({
  storage,
  limits: { fileSize: MAX_PDF_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf" || file.mimetype !== "application/pdf") {
      return cb(new AppError("Only valid PDF files (.pdf) are allowed", 400));
    }
    cb(null, true);
  },
});

// Image Upload
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export const uploadAiImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext) || !ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      return cb(new AppError("Only JPG, PNG, WEBP, or GIF image files are allowed", 400));
    }
    cb(null, true);
  },
});

// Course Outline Upload (PDF, DOCX, TXT)
const MAX_COURSE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_COURSE_EXTS = new Set([".pdf", ".docx", ".txt"]);

export const uploadAiCourseDoc = multer({
  storage,
  limits: { fileSize: MAX_COURSE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_COURSE_EXTS.has(ext)) {
      return cb(new AppError("Only PDF, Word (.docx), or plain text (.txt) files are allowed for course outlines", 400));
    }
    cb(null, true);
  },
});
