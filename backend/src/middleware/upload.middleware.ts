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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
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
      [".pdf", ".docx", ".txt", ".md"].includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word, or text files (.pdf, .docx, .txt, .md) are allowed"));
    }
  },
});

// Class routines: documents plus photos/scans (transcribed by the vision model).
const ROUTINE_TYPES = new Map([
  [".pdf", ["application/pdf"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".txt", ["text/plain", "application/octet-stream"]],
  [".csv", ["text/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"]],
  [".md", ["text/markdown", "text/plain", "application/octet-stream"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]],
  [".webp", ["image/webp"]],
]);

export const uploadRoutine = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = ROUTINE_TYPES.get(extension);
    if (!allowed || !allowed.includes(file.mimetype)) {
      return cb(new AppError("Routine must be PDF, DOCX, TXT/CSV or a JPG/PNG/WebP photo", 400));
    }
    cb(null, true);
  },
});

/**
 * Whatever the browser's MediaRecorder produces. Chrome/Firefox emit
 * `audio/webm;codecs=opus` and Safari `audio/mp4`, so the codec parameter is
 * stripped before matching and the extension is ignored entirely — a recorded
 * Blob has no meaningful filename.
 */
const VOICE_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

export const uploadVoiceClip = multer({
  // Memory, not disk: the clip exists only to reach the transcription model.
  // Voice carries more identifying information than the text it becomes, and
  // writing it to UPLOAD_DIR would create a retention problem nothing cleans up.
  storage: multer.memoryStorage(),
  // Two minutes of Opus is well under 2 MB; 10 MB leaves headroom for WAV
  // without letting a stuck recorder upload something enormous.
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const base = file.mimetype.split(";")[0].trim().toLowerCase();
    if (!VOICE_MIMES.has(base)) {
      return cb(new AppError("Voice input must be a recorded audio clip (WebM, MP4, OGG, MP3 or WAV)", 400));
    }
    cb(null, true);
  },
});
