import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { Effort } from "./claude-cli";

/** Claude through the Anthropic API, for anyone running the app with their own API key. */

const ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
  haiku: "claude-haiku-4-5",
};

// Per million tokens, input / output, for the cost readout.
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5": [2, 10],
  "claude-opus-5": [5, 25],
  "claude-haiku-4-5": [1, 5],
};

let client: Anthropic | undefined;

export function modelId(model: string): string {
  return ALIASES[model] ?? model;
}

/** Haiku 4.5 rejects the effort setting; newer models accept it. */
const acceptsEffort = (id: string) => !id.startsWith("claude-haiku-4-5");

export interface AnthropicRequest {
  system: string;
  prompt: string;
  model: string;
  effort?: Effort;
}

export interface AnthropicResult<T> {
  text: string;
  data: T;
  model: string;
  ms: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

function usageCost(id: string, input: number, output: number): number {
  const [inPrice, outPrice] = PRICES[id] ?? [0, 0];
  return (input * inPrice + output * outPrice) / 1_000_000;
}

function assertAnswered(response: Anthropic.Message | { stop_reason: string | null }) {
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (max_tokens).");
}

// If the frontier models decline a request, the API re-runs it on this model within the same call.
const FALLBACK: Record<string, string> = {
  "claude-opus-5": "claude-opus-4-8",
  "claude-fable-5-1": "claude-opus-4-8",
};

export async function anthropicText(request: AnthropicRequest): Promise<AnthropicResult<string>> {
  const id = modelId(request.model);
  const started = performance.now();
  const params = {
    model: id,
    max_tokens: 16000,
    system: request.system,
    messages: [{ role: "user" as const, content: request.prompt }],
    ...(request.effort && acceptsEffort(id) ? { output_config: { effort: request.effort } } : {}),
  };
  client ??= new Anthropic();
  const fallback = FALLBACK[id];
  const response = fallback
    ? await client.beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: fallback }],
      })
    : await client.messages.create(params);
  assertAnswered(response);
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return {
    text,
    data: text,
    model: response.model,
    ms: performance.now() - started,
    costUsd: usageCost(id, response.usage.input_tokens, response.usage.output_tokens),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export async function anthropicJson<S extends z.ZodType>(
  request: AnthropicRequest & { schema: S },
): Promise<AnthropicResult<z.infer<S>>> {
  const id = modelId(request.model);
  const started = performance.now();
  const response = await (client ??= new Anthropic()).messages.parse({
    model: id,
    max_tokens: 16000,
    system: request.system,
    messages: [{ role: "user", content: request.prompt }],
    output_config: {
      format: zodOutputFormat(request.schema),
      ...(request.effort && acceptsEffort(id) ? { effort: request.effort } : {}),
    },
  });
  assertAnswered(response);
  if (response.parsed_output == null) throw new Error("Claude's answer did not match the expected format.");
  return {
    text: JSON.stringify(response.parsed_output),
    data: response.parsed_output as z.infer<S>,
    model: response.model,
    ms: performance.now() - started,
    costUsd: usageCost(id, response.usage.input_tokens, response.usage.output_tokens),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
