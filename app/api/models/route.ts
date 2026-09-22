import { CATALOG } from "@/lib/llm/catalog";
import { modelFor, resolveModel } from "@/lib/llm";

export async function GET() {
  const selected = resolveModel(modelFor("write"));
  return Response.json({
    defaultModel: `${selected.provider}/${selected.model}`,
    providers: CATALOG.map((p) => ({ ...p, configured: p.mode === "CLI" ? null : Boolean(process.env[p.key!]) })),
  }, { headers: { "Cache-Control": "no-store" } });
}
