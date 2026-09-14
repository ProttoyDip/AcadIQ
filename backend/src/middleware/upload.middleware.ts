import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { AppError } from "./error.middleware";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_FILE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_FILE_TYPES.get(extension) !== file.mimetype) {
    return cb(new AppError("Only PDF and DOCX files are allowed", 400));
  }
  cb(null, true);
}

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});

export const uploadPdf = uploadDocument;

// Teaching materials: slide decks and notes on top of PDF/DOCX.
const MATERIAL_TYPES = new Map([
  [".pdf", ["application/pdf"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".pptx", ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"]],
  [".txt", ["text/plain", "application/octet-stream"]],
  [".md", ["text/markdown", "text/plain", "application/octet-stream"]],
]);
const MAX_MATERIAL_SIZE_BYTES = 40 * 1024 * 1024;

export const uploadTeachingMaterial = multer({
  storage,
  limits: { fileSize: MAX_MATERIAL_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = MATERIAL_TYPES.get(extension);
    if (!allowed || !allowed.includes(file.mimetype)) {
      return cb(new AppError("Teaching materials must be PDF, DOCX, PPTX, TXT or MD", 400));
    }
    cb(null, true);
  },
});

const ALLOWED_SCHEME_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
]);

const schemeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadReferenceScheme = multer({
  storage: schemeStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_SCHEME_MIMES.has(file.mimetype) ||
      [".pdf", ".txt", ".md"].includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Only PDF or text files (.pdf, .txt, .md) are allowed as marking schemes", 400));
    }
  },
});
