import { generateText, Output, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway } from "@ai-sdk/gateway";
import type { z } from "zod";

export type ApiProvider = "openai" | "google" | "gateway" | "compatible";
function apiModel(provider: ApiProvider, model: string): LanguageModel {
  const keyName = { openai: "OPENAI_API_KEY", google: "GOOGLE_GENERATIVE_AI_API_KEY", gateway: "AI_GATEWAY_API_KEY", compatible: "LLM_API_KEY" }[provider];
  const apiKey = process.env[keyName];
  if (!apiKey && provider !== "compatible") throw new Error(`Set ${keyName} in .env.local to use ${provider}.`);
  switch (provider) {
    case "openai": return createOpenAI({ apiKey })(model);
    case "google": return createGoogleGenerativeAI({ apiKey })(model);
    case "gateway": return createGateway({ apiKey })(model);
    case "compatible": {
      const baseURL = process.env.LLM_BASE_URL;
      if (!baseURL) throw new Error("Set LLM_BASE_URL to your OpenAI-compatible API endpoint.");
      return createOpenAICompatible({ name: "compatible", baseURL, apiKey, supportsStructuredOutputs: process.env.LLM_STRUCTURED_OUTPUTS === "true" })(model);
    }
  }
}

export async function apiText(request: { provider: ApiProvider; model: string; system: string; prompt: string }) {
  const started = performance.now();
  const result = await generateText({ model: apiModel(request.provider, request.model), system: request.system, prompt: request.prompt, abortSignal: AbortSignal.timeout(300_000), maxRetries: 1 });
  if (!result.text.trim() || result.finishReason === "length" || result.finishReason === "content-filter") throw new Error("The model did not return a complete rewrite. Try another model or a shorter source.");
  return { data: result.text, model: result.response.modelId, ms: performance.now() - started, apiMs: performance.now() - started, costUsd: undefined };
}

export async function apiJson<S extends z.ZodType>(request: { provider: ApiProvider; model: string; system: string; prompt: string; schema: S }) {
  const started = performance.now();
  const result = await generateText({ model: apiModel(request.provider, request.model), system: request.system, prompt: request.prompt, output: Output.object({ schema: request.schema }), abortSignal: AbortSignal.timeout(300_000), maxRetries: 1 });
  return { data: request.schema.parse(result.output), model: result.response.modelId, ms: performance.now() - started, apiMs: performance.now() - started, costUsd: undefined };
}
