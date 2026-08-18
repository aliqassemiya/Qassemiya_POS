import { isAxiosError } from "axios";

/**
 * NestJS's default exception shape is `{ statusCode, message, error }`, where
 * `message` is either a plain string (e.g. our own ConflictException("SKU
 * already in use")) or an array of strings (class-validator/zod pipe
 * failures) — this normalizes both into one display string.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
