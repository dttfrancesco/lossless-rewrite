/** Explicit route prefixes prevent accidental billing through the wrong backend. */
export const PROVIDERS = ["claude-cli", "codex-cli", "anthropic", "openai", "google", "gateway", "compatible"] as const;
export type Provider = typeof PROVIDERS[number];
export const CATALOG: Array<{ id: Provider; name: string; mode: "CLI" | "API"; key?: string; models: string[] }> = [
  { id: "claude-cli", name: "Claude Code", mode: "CLI", models: ["sonnet", "opus", "haiku"] },
  { id: "codex-cli", name: "Codex · ChatGPT", mode: "CLI", models: ["default", "gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] },
  { id: "anthropic", name: "Anthropic", mode: "API", key: "ANTHROPIC_API_KEY", models: ["sonnet", "opus", "haiku"] },
  { id: "openai", name: "OpenAI", mode: "API", key: "OPENAI_API_KEY", models: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] },
  { id: "google", name: "Google Gemini", mode: "API", key: "GOOGLE_GENERATIVE_AI_API_KEY", models: ["gemini-3.8-flash", "gemini-3.5-flash"] },
  { id: "gateway", name: "AI Gateway · multi-provider", mode: "API", key: "AI_GATEWAY_API_KEY", models: ["openai/gpt-6-astra", "anthropic/claude-opus-5", "google/gemini-3.8-flash", "deepseek/deepseek-v4.1-flash", "mistral/mistral-large-3", "meta/llama-4-maverick"] },
  { id: "compatible", name: "OpenAI-compatible · custom / local", mode: "API", key: "LLM_BASE_URL", models: [] },
];
