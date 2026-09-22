import { z } from "zod";
import { anthropicJson, anthropicText } from "./anthropic";
import { callClaude, type Effort } from "./claude-cli";
import { callCodex } from "./codex-cli";
import { PROVIDERS, type Provider } from "./catalog";

export type { Effort } from "./claude-cli";

/**
 * Every generative call goes through here: API adapters and local subscription CLIs.
 * Legacy Claude routes remain supported:
 * - `claude-cli`: Claude Code's headless mode with the local Claude Code login (a Claude
 *   subscription works; local, personal use only).
 * - `anthropic`: the Anthropic API with ANTHROPIC_API_KEY.
 * LLM_PROVIDER picks one; otherwise an API key means `anthropic` and no key means `claude-cli`.
 */
export type LlmProvider = Provider;

export function llmProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit && PROVIDERS.includes(explicit as Provider)) return explicit as Provider;
  if (explicit) throw new Error(`Unknown LLM_PROVIDER: ${explicit}`);
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google" : process.env.AI_GATEWAY_API_KEY ? "gateway" : "claude-cli";
}

/** Which model a task uses: its own variable if set, then LLM_MODEL, then Sonnet. */
export type Purpose = "write" | "extract" | "judge";
const PURPOSE_VAR: Record<Purpose, string> = {
  write: "LLM_MODEL_WRITE",
  extract: "LLM_MODEL_EXTRACT",
  judge: "LLM_MODEL_JUDGE",
};

export function modelFor(purpose: Purpose): string {
  const defaults: Record<Provider, string> = { "claude-cli": "sonnet", "codex-cli": "default", anthropic: "sonnet", openai: "gpt-6-astra", google: "gemini-3.8-flash", gateway: "openai/gpt-6-astra", compatible: "" };
  const model = process.env[PURPOSE_VAR[purpose]] || process.env.LLM_MODEL || defaults[llmProvider()];
  if (!model) throw new Error("Set LLM_MODEL for your custom API.");
  return model;
}

/** Explicit prefixes allow a local subscription writer without changing the checker. */
export function resolveModel(model: string): { provider: LlmProvider; model: string } {
  for (const provider of PROVIDERS) {
    if (model.startsWith(`${provider}/`)) return { provider, model: model.slice(provider.length + 1) };
  }
  return { provider: llmProvider(), model };
}

export interface LlmRequest {
  system: string;
  prompt: string;
  purpose: Purpose;
  effort?: Effort;
  /** Overrides the model chosen by `purpose`. */
  model?: string;
}

export interface LlmResult<T> {
  data: T;
  model: string;
  /** Wall time, including starting Claude Code for the CLI provider. */
  ms: number;
  /** Time spent in the API itself. */
  apiMs: number;
  /** Actual API cost, or the list-price equivalent Claude Code reports. */
  costUsd?: number;
}

export async function completeText(request: LlmRequest): Promise<LlmResult<string>> {
  const { provider, model } = resolveModel(request.model ?? modelFor(request.purpose));
  if (provider === "openai" || provider === "google" || provider === "gateway" || provider === "compatible") {
    const { apiText } = await import("./api");
    return apiText({ ...request, provider, model });
  }
  if (provider === "codex-cli") {
    const result = await callCodex({ ...request, model });
    return { data: result.text, model: result.model, ms: result.ms, apiMs: result.ms, costUsd: undefined };
  }
  if (provider === "anthropic") {
    const result = await anthropicText({ ...request, model });
    return { data: result.text, model: result.model, ms: result.ms, apiMs: result.ms, costUsd: result.costUsd };
  }
  const result = await callClaude({ ...request, model });
  return { data: result.text, model: result.model, ms: result.ms, apiMs: result.apiMs, costUsd: result.costUsd };
}

export async function completeJson<S extends z.ZodType>(
  request: LlmRequest & { schema: S },
): Promise<LlmResult<z.infer<S>>> {
  const { provider, model } = resolveModel(request.model ?? modelFor(request.purpose));
  if (provider === "openai" || provider === "google" || provider === "gateway" || provider === "compatible") {
    const { apiJson } = await import("./api");
    return apiJson({ ...request, provider, model });
  }
  if (provider === "codex-cli") {
    const { $schema: _, ...schema } = z.toJSONSchema(request.schema) as Record<string, unknown>;
    const result = await callCodex({ ...request, model, schema });
    return { data: request.schema.parse(JSON.parse(result.text)), model: result.model, ms: result.ms, apiMs: result.ms, costUsd: undefined };
  }
  if (provider === "anthropic") {
    const result = await anthropicJson({ ...request, model });
    return { data: result.data, model: result.model, ms: result.ms, apiMs: result.ms, costUsd: result.costUsd };
  }
  const { $schema: _, ...schema } = z.toJSONSchema(request.schema) as Record<string, unknown>;
  const result = await callClaude({ ...request, model, schema });
  return {
    data: request.schema.parse(result.structured),
    model: result.model,
    ms: result.ms,
    apiMs: result.apiMs,
    costUsd: result.costUsd,
  };
}
