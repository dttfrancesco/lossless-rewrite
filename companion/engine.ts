import { DecisionClient, decisionConfig } from "../lib/decision/client";
import { verifyRewrite } from "../lib/coverage/verify";
import { rewriteSchema } from "../lib/rewrite/request";
import { unitsFor } from "../lib/rewrite/units";
import { splitSentences, wordCount } from "../lib/text/sentences";
import type { PipelineEvent, RewriteResult } from "../lib/rewrite/types";
import type { Request } from "./protocol";

export function validateEnginePayload(operation: Request["operation"], payload: unknown) {
  if (operation !== "check") throw new Error("The companion only checks text. Use your existing chat to write or extract ideas.");
  const parsed = rewriteSchema.parse(payload);
  if (new Set(parsed.constraints.map(c => c.id)).size !== parsed.constraints.length) throw new Error("Duplicate mark IDs");
  if (operation === "check" && parsed.initialText === undefined) throw new Error("Check requires initialText");
  return parsed;
}

export async function checkOnly(payload: unknown, emit: (event: PipelineEvent) => void = () => {}, client?: DecisionClient): Promise<RewriteResult> {
  const request = validateEnginePayload("check", payload);
  if (request.initialText === undefined) throw new Error("Check requires initialText");
  const text = request.initialText;
  const sentences = splitSentences(text);
  const { facts, keepMeaning, keepWording } = unitsFor(request);
  emit({ type: "draft", attempt: 0, text, sentences, words: wordCount(text) });
  emit({ type: "stage", stage: "verifying", attempt: 0 });
  // Exact-only / zero-unit checks do not require a Jev key or make a network call.
  const decision = client ?? (facts.length + keepMeaning.length ? new DecisionClient() : { config: { provider: "jev" } } as DecisionClient);
  // Never escalate to an API/CLI writer, even if an older panel sends writer settings.
  const verification = await verifyRewrite({ client: decision, text, sentences, units: [...facts, ...keepMeaning], keepWording, adjudicate: false });
  emit({ type: "verified", attempt: 0, verification });
  const attempt = { pass: "edit" as const, text, sentences, words: wordCount(text), verification, repairing: [], writeMs: 0 };
  return { attempts: [attempt], final: attempt, sourceWords: wordCount(request.source) };
}

export async function execute(operation: Request["operation"], payload: unknown, emit: (event: PipelineEvent) => void) {
  if (operation === "hello") return { protocolVersion: 1, checkMode: "decision-only-v1", host: "com.lossless_rewrite.companion", capabilities: ["models.list", "check", "cancel", "run.status"], cancellation: "detach-only", persistence: "current-native-port-session", maxRequestBytes: 4 * 1024 * 1024, maxResultBytes: 16 * 1024 * 1024 };
  if (operation === "models.list") {
    let configured = false;
    try { decisionConfig(); configured = true; } catch { /* Missing local checker config. */ }
    return { checker: { configured, provider: process.env.DECISION_PROVIDER || "jev" } };
  }
  if (operation === "check") return checkOnly(payload, emit);
  throw new Error("Unsupported engine operation");
}
