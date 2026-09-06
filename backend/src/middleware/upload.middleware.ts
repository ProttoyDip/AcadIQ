import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}.pdf`);
  },
});

export const uploadPdf = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only PDF files are allowed"));
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
      cb(new Error("Only PDF or text files (.pdf, .txt, .md) are allowed as marking schemes"));
    }
  },
});

