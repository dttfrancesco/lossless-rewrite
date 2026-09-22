import { readFile } from "node:fs/promises";
import { join } from "node:path";
import capture from "@/demo/document-repair.json";

/** A longer specification with two easy-to-recognize rules to protect. */
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("example") !== "long") {
    return Response.json({
      text: capture.source,
      protections: capture.facts.map(fact => {
        const span = fact.sources[0]!;
        return capture.source.slice(span.start, span.end);
      }),
      instruction: capture.instruction,
    });
  }
  const text = await readFile(join(process.cwd(), "demo", "lost-in-compression.md"), "utf8");
  return Response.json({ text: text.replace(/\r\n/g, "\n") });
}
