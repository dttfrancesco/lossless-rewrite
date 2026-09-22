import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "../lib/env";
import { allowedOrigin, FrameDecoder, responseFrames } from "./transport";
import { CompanionSession } from "./session";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Browser sends origin as argv[2]. No browser-supplied filesystem path/config is accepted.
const config = z.object({ allowedOrigins: z.array(z.string().regex(/^chrome-extension:\/\/[a-p]{32}\/$/)).min(1).max(10) }).strict();
try {
  const local = config.parse(JSON.parse(readFileSync(resolve(root, "companion/local-config.json"), "utf8")));
  if (!allowedOrigin(process.argv[2], local.allowedOrigins)) throw new Error("Origin denied");
  process.chdir(root);
  loadEnv();
  // Dependencies may use console.log: keep all textual logging out of native stdout.
  console.log = console.info = console.debug = () => {};
  console.warn = console.error = () => { process.stderr.write("Lossless companion: dependency diagnostic (details suppressed).\n"); };
  let queuedBytes = 0;
  let output: Buffer[] = [];
  let blocked = false;
  function flush() {
    while (!blocked && output.length) {
      const next = output.shift()!;
      queuedBytes -= next.length;
      blocked = !process.stdout.write(next);
    }
  }
  process.stdout.on("drain", () => { blocked = false; flush(); });
  const session = new CompanionSession(response => {
    const frames = responseFrames(response);
    const size = frames.reduce((sum, frame) => sum + frame.length, 0);
    if (queuedBytes + size > 24 * 1024 * 1024) throw new Error("Native output queue full");
    output.push(...frames); queuedBytes += size; flush();
  });
  const decoder = new FrameDecoder(message => {
    void session.receive(message).catch(() => { process.stderr.write("Lossless companion: invalid protocol envelope.\n"); process.exitCode = 1; process.stdin.destroy(); });
  });
  process.stdin.on("data", chunk => { try { decoder.push(chunk); } catch { process.stderr.write("Lossless companion: invalid native frame.\n"); process.exit(1); } });
  process.stdin.on("end", () => { try { decoder.finish(); } catch { process.exitCode = 1; } });
  process.stdout.on("error", () => process.exit(1));
} catch {
  process.stderr.write("Lossless companion: setup missing or extension origin not allowed. Run the setup generator for your exact extension ID.\n");
  process.exitCode = 1;
}
