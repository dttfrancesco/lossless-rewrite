import { endianness } from "node:os";
import { randomUUID } from "node:crypto";
import { CHUNK_BYTES, MAX_REQUEST_BYTES, MAX_RESULT_BYTES, type Chunk } from "./protocol";

const littleEndian = endianness() === "LE";
export function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  if (littleEndian) header.writeUInt32LE(body.length); else header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}

/** Decode fragmented/coalesced native frames, rejecting length before buffering the body. */
export class FrameDecoder {
  private pending = Buffer.alloc(0);
  constructor(private readonly receive: (message: unknown) => void, private readonly limit = MAX_REQUEST_BYTES) {}
  push(chunk: Buffer) {
    let offset = 0;
    while (offset < chunk.length) {
      const target = this.pending.length < 4 ? 4 : 4 + this.length();
      const take = Math.min(target - this.pending.length, chunk.length - offset);
      this.pending = Buffer.concat([this.pending, chunk.subarray(offset, offset + take)]);
      offset += take;
      if (this.pending.length < 4) continue;
      const length = this.length();
      if (!length || length > this.limit) throw new Error("Native message length exceeds limit");
      if (this.pending.length === 4 + length) {
        const body = this.pending.subarray(4);
        this.pending = Buffer.alloc(0);
        this.receive(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
      }
    }
  }
  finish() { if (this.pending.length) throw new Error("Truncated native message"); }
  private length() { return littleEndian ? this.pending.readUInt32LE(0) : this.pending.readUInt32BE(0); }
}

export function responseFrames(message: unknown): Buffer[] {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_RESULT_BYTES) throw new Error("Result exceeds transport limit");
  if (body.length <= CHUNK_BYTES) return [frame(message)];
  const transferId = randomUUID();
  const count = Math.ceil(body.length / CHUNK_BYTES);
  return Array.from({ length: count }, (_, index) => frame({
    version: 1, type: "chunk", transferId, index, count, totalBytes: body.length,
    data: body.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES).toString("base64"),
  } satisfies Chunk));
}

export function allowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  return Boolean(origin && /^chrome-extension:\/\/[a-p]{32}\/$/.test(origin) && allowed.includes(origin));
}
