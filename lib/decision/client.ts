import { TypeSafeClient, type EntryType, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";

/** Backends that speak TypeSafe's `POST /v1/systemone` API. */
export type DecisionProvider = "jev" | "rizzo";

const DEFAULTS: Record<DecisionProvider, { baseURL: string; model: string; timeoutMs: number }> = {
  // Pinned rather than `jev-latest`: decision thresholds are tuned against this version.
  jev: { baseURL: "https://api.typesafe.ai", model: "jev-1.13.0", timeoutMs: 30_000 },
  // A local Rizzo Flow server. Its first request compiles GPU kernels and can take a minute.
  rizzo: { baseURL: "http://127.0.0.1:8017", model: "rizzo-latest", timeoutMs: 180_000 },
};

export interface DecisionConfig {
  provider: DecisionProvider;
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

/**
 * Resolve a decision backend. `DECISION_BASE_URL`, `DECISION_MODEL` and `DECISION_API_KEY`
 * configure the provider named by `DECISION_PROVIDER` (default `jev`); any other provider
 * requested in code gets its defaults.
 */
export function decisionConfig(provider?: DecisionProvider): DecisionConfig {
  const envProvider = (process.env.DECISION_PROVIDER || "jev") as DecisionProvider;
  const chosen = provider ?? envProvider;
  const defaults = DEFAULTS[chosen];
  if (!defaults) throw new Error(`Unknown decision provider "${chosen}". Use "jev" or "rizzo".`);

  const env: Record<string, string | undefined> = chosen === envProvider ? process.env : {};
  // Rizzo only checks a key when its server sets RIZZO_API_KEY, but the SDK always wants one.
  const apiKey =
    env.DECISION_API_KEY || (chosen === "jev" ? process.env.TYPESAFE_API_KEY : "local");
  if (!apiKey) throw new Error("Set TYPESAFE_API_KEY (or DECISION_API_KEY) to use Jev.");

  return {
    provider: chosen,
    baseURL: env.DECISION_BASE_URL || defaults.baseURL,
    model: env.DECISION_MODEL || defaults.model,
    apiKey,
    timeoutMs: defaults.timeoutMs,
  };
}

export interface Decision<Q extends Questions> {
  answers: SystemOneResult<Q>["answers"];
  /** The model id the backend reports, e.g. `jev-1.13.0`. */
  model: string;
  inputTokens: number;
  ms: number;
}

/** One state, many typed questions, answered in a single request. */
export class DecisionClient {
  readonly config: DecisionConfig;
  readonly #client: TypeSafeClient;

  constructor(config: DecisionConfig = decisionConfig()) {
    this.config = config;
    this.#client = new TypeSafeClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultModel: config.model,
      timeout: config.timeoutMs,
    });
  }

  async ask<const Q extends Questions>(
    state: EntryType,
    questions: Q,
    signal?: AbortSignal,
  ): Promise<Decision<Q>> {
    const started = performance.now();
    const result = await this.#client.systemOne({ state, questions }, { signal });
    return {
      answers: result.answers,
      model: result.model,
      inputTokens: result.usage.input_tokens,
      ms: performance.now() - started,
    };
  }
}

/** Jev bills input tokens only, at $0.042 per million. A local backend costs nothing per call. */
export function decisionCostUsd(provider: DecisionProvider, inputTokens: number): number {
  return provider === "jev" ? (inputTokens * 0.042) / 1_000_000 : 0;
}
