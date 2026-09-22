import { extractFacts } from "@/lib/rewrite/extract";
import { z } from "zod";
import { constraintSchema, modelSchema } from "@/lib/rewrite/request";

/** The fact inventory of one Must cover region. Ids are local (F1…); the page numbers them globally. */
export async function POST(request: Request) {
  const parsed = z.object({ region: constraintSchema, model: modelSchema.optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Select a valid, non-empty source passage." }, { status: 400 });
  const { region, model } = parsed.data;
  try {
    return Response.json({ facts: await extractFacts(region, 1, model) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
