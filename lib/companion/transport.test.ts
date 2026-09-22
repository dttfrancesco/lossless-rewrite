import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigin, frame, FrameDecoder, responseFrames } from "../../companion/transport";
import { MAX_REQUEST_BYTES, type Chunk } from "../../companion/protocol";

test("native frames preserve Unicode across fragmented and coalesced input", () => {
  const result: unknown[] = [];
  const decoder = new FrameDecoder(message => result.push(message));
  const input = Buffer.concat([frame({text: "hello 🦊 café"}), frame({ok: true})]);
  for (let i = 0; i < input.length; i += 3) decoder.push(input.subarray(i, i + 3));
  decoder.finish();
  assert.deepEqual(result, [{text: "hello 🦊 café"}, {ok: true}]);
});

test("native frames reject oversized headers, incomplete bodies and invalid JSON", () => {
  const large = frame("x".repeat(MAX_REQUEST_BYTES + 1));
  assert.throws(() => new FrameDecoder(() => {}).push(large.subarray(0,4)), /limit/);
  const incomplete = new FrameDecoder(() => {});
  incomplete.push(frame({hello: true}).subarray(0,6));
  assert.throws(() => incomplete.finish(), /Truncated/);
  const invalid = frame(null); invalid[4] = 0xff;
  assert.throws(() => new FrameDecoder(() => {}).push(invalid));
});

test("large responses fit Chrome's 1MiB ceiling and reassemble exact UTF8", () => {
  const message = {text: "👋 hello".repeat(180_000)};
  const frames = responseFrames(message);
  assert.ok(frames.length > 1);
  const chunks: Chunk[] = [];
  const decoder = new FrameDecoder(message => chunks.push(message as Chunk));
  for (const encoded of frames) { assert.ok(encoded.length < 1024 * 1024); decoder.push(encoded); }
  assert.equal(new Set(chunks.map(c => c.transferId)).size,1);
  chunks.forEach((chunk, index) => { assert.equal(chunk.index,index); assert.equal(chunk.count,chunks.length); });
  const bytes = Buffer.concat(chunks.map(c => Buffer.from(c.data, "base64")));
  assert.equal(bytes.length, chunks[0]!.totalBytes);
  assert.deepEqual(JSON.parse(bytes.toString("utf8")), message);
});

test("native caller must exactly match a valid locally allowed extension origin", () => {
  const origin = `chrome-extension://${"a".repeat(32)}/`;
  assert.equal(allowedOrigin(origin, [origin]),true);
  for (const other of [undefined, "https://chatgpt.com/", origin + "evil", origin.replace("aaaa", "bbbb"), "chrome-extension://*/"]) assert.equal(allowedOrigin(other, [origin]),false);
});
