import { z } from "zod";
import { CATALOG } from "../lib/llm/catalog";
import { modelFor, resolveModel } from "../lib/llm";
import { DecisionClient, decisionConfig } from "../lib/decision/client";
import { verifyRewrite } from "../lib/coverage/verify";
import { constraintSchema, modelSchema, rewriteSchema } from "../lib/rewrite/request";
import { runRewrite, unitsFor } from "../lib/rewrite/pipeline";
import { extractAll } from "../lib/rewrite/extract";
import { splitSentences, wordCount } from "../lib/text/sentences";
import type { PipelineEvent, RewriteResult } from "../lib/rewrite/types";
import type { Request } from "./protocol";

const extractionSchema = z.object({ source: z.string().min(1).max(100_000), constraints: z.array(constraintSchema).min(1).max(100), writerModel: modelSchema.optional() }).strict().superRefine((r, ctx) => {
  if (r.constraints.some(c => c.type !== "must_cover" || r.source.slice(c.start, c.end) !== c.text) || new Set(r.constraints.map(c => c.id)).size !== r.constraints.length) ctx.addIssue({code: "custom", message: "Invalid extraction regions"});
});
export function validateEnginePayload(operation: Request["operation"], payload: unknown) {
  if (operation === "extract") return extractionSchema.parse(payload);
  const parsed = rewriteSchema.parse(payload);
  if (new Set(parsed.constraints.map(c => c.id)).size !== parsed.constraints.length) throw new Error("Duplicate mark IDs");
  if (operation === "check" && parsed.initialText === undefined) throw new Error("Check requires initialText");
  return parsed;
}

export async function checkOnly(payload: unknown, emit: (event: PipelineEvent) => void = () => {}, client?: DecisionClient): Promise<RewriteResult> {
  const request = rewriteSchema.parse(payload);
  if (request.initialText === undefined) throw new Error("Check requires initialText");
  const text = request.initialText;
  const sentences = splitSentences(text);
  const { facts, keepMeaning, keepWording } = unitsFor(request);
  emit({ type: "draft", attempt: 0, text, sentences, words: wordCount(text) });
  emit({ type: "stage", stage: "verifying", attempt: 0 });
  // Exact-only / zero-unit checks do not require a Jev key or make a network call.
  const decision = client ?? (facts.length + keepMeaning.length ? new DecisionClient() : { config: { provider: "jev" } } as DecisionClient);
  const verification = await verifyRewrite({ client: decision, text, sentences, units: [...facts, ...keepMeaning], keepWording, judgeModel: request.writerModel,
    onEscalate: units => emit({ type: "stage", stage: "adjudicating", attempt: 0, ids: units.map(u => u.id) }),
  });
  emit({ type: "verified", attempt: 0, verification });
  const attempt = { pass: "edit" as const, text, sentences, words: wordCount(text), verification, repairing: [], writeMs: 0 };
  return { attempts: [attempt], final: attempt, sourceWords: wordCount(request.source) };
}

export async function execute(operation: Request["operation"], payload: unknown, emit: (event: PipelineEvent) => void) {
  if (operation === "hello") return { protocolVersion: 1, host: "com.lossless_rewrite.companion", capabilities: ["models.list", "extract", "check", "rewrite", "cancel", "run.status"], cancellation: "detach-only", persistence: "current-native-port-session", maxRequestBytes: 4 * 1024 * 1024, maxResultBytes: 16 * 1024 * 1024 };
  if (operation === "models.list") {
    const selected = resolveModel(modelFor("write"));
    let configured = false;
    try { decisionConfig(); configured = true; } catch { /* Missing local checker config. */ }
    return { defaultModel: `${selected.provider}/${selected.model}`, providers: CATALOG.map(({ key, ...provider }) => ({ ...provider, configured: provider.mode === "CLI" ? null : Boolean(key && process.env[key]) })), checker: { configured, provider: process.env.DECISION_PROVIDER || "jev" } };
  }
  if (operation === "extract") {
    const request = extractionSchema.parse(payload);
    return { facts: await extractAll(request.constraints, request.writerModel) };
  }
  if (operation === "check") return checkOnly(payload, emit);
  if (operation === "rewrite") return runRewrite(rewriteSchema.parse(payload), emit);
  throw new Error("Unsupported engine operation");
}
