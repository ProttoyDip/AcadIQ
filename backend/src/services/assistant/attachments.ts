import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { AppError } from "../../middleware/error.middleware";

export interface StagedAttachment {
  id: string;
  userId: number;
  path: string;
  mimetype: string;
  originalname: string;
  size: number;
  createdAt: number;
}

const TTL_MS = 30 * 60_000;
const staged = new Map<string, StagedAttachment>();

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, a] of staged) {
    if (a.createdAt < cutoff) {
      staged.delete(id);
      fs.unlink(a.path).catch(() => undefined);
    }
  }
}

/** Files the faculty drops into the chat; a tool consumes them by id after confirmation. */
export const attachmentStore = {
  stage(userId: number, file: { path: string; mimetype: string; originalname: string; size: number }): StagedAttachment {
    sweep();
    const entry: StagedAttachment = { id: randomUUID(), userId, path: file.path, mimetype: file.mimetype, originalname: file.originalname, size: file.size, createdAt: Date.now() };
    staged.set(entry.id, entry);
    return entry;
  },
  /** Ownership-checked lookup; the file stays until `consume` so a failed action can be retried. */
  get(userId: number, id: string): StagedAttachment {
    sweep();
    const entry = staged.get(id);
    if (!entry || entry.userId !== userId) throw new AppError("Attachment not found or expired — upload it again", 404);
    return entry;
  },
  consume(id: string) {
    const entry = staged.get(id);
    staged.delete(id);
    if (entry) fs.unlink(entry.path).catch(() => undefined);
  },
  listFor(userId: number) {
    sweep();
    return [...staged.values()].filter((a) => a.userId === userId).map(({ id, originalname, mimetype, size }) => ({ id, name: originalname, mimetype, size }));
  },
};
