import { runRewrite, type RewriteRequest } from "@/lib/rewrite/pipeline";
import type { PipelineEvent } from "@/lib/rewrite/types";
import { rewriteSchema } from "@/lib/rewrite/request";

export const maxDuration = 300;

/** Runs the write → verify → repair loop and streams every step as a server-sent event. */
export async function POST(request: Request) {
  const parsed = rewriteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const body: RewriteRequest = parsed.data;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The page went away; the run finishes quietly.
        }
      };
      try {
        await runRewrite(body, send);
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
