import { AppError } from "../middleware/error.middleware";

export function parsePositiveId(value: string | string[], field = "id"): number {
  if (Array.isArray(value)) throw new AppError(`${field} must be a positive integer`, 422);
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(`${field} must be a positive integer`, 422);
  return id;
}
