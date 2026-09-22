import { z } from "zod";

export const HOST_NAME = "com.lossless_rewrite.companion";
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_RESULT_BYTES = 16 * 1024 * 1024;
export const CHUNK_BYTES = 384 * 1024;
export const requestSchema = z.object({
  version: z.literal(1), requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  documentId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  operation: z.enum(["hello", "models.list", "extract", "check", "rewrite", "cancel", "run.status"]),
  payload: z.unknown(),
}).strict();
export type Request = z.infer<typeof requestSchema>;
export interface Response {
  version: 1; requestId: string; documentId: string; revision: number; sequence: number;
  type: "accepted" | "event" | "result" | "error" | "status"; payload: unknown;
}
export interface Chunk {
  version: 1; type: "chunk"; transferId: string; index: number; count: number; totalBytes: number; data: string;
}
