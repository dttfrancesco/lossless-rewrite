import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * Claude through Claude Code's headless mode (`claude -p`), authenticated with the local
 * Claude Code login, so a Claude subscription works without an API key. Meant for local,
 * personal use; a hosted deployment needs an API key instead.
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeRequest {
  system: string;
  prompt: string;
  /** An alias (`sonnet`, `opus`, `haiku`) or a full model id. Default: `LLM_MODEL`, else `sonnet`. */
  model?: string;
  /** JSON Schema for the answer; the validated object is returned as `structured`. */
  schema?: object;
  effort?: Effort;
  timeoutMs?: number;
}

export interface ClaudeResponse<T> {
  text: string;
  structured: T | undefined;
  model: string;
  ms: number;
  apiMs: number;
  /** List-price equivalent reported by Claude Code; not what a subscription pays. */
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

interface CliResult {
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  duration_api_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
}

// Set by a parent Claude Code session; a child that inherits them would attach to that session.
const PARENT_SESSION_VARS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_EFFORT",
  "CLAUDE_PID",
];

function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of PARENT_SESSION_VARS) delete env[name];
  return env;
}

// Each call is a separate process; cap them to stay inside subscription rate limits.
const MAX_PARALLEL = Math.max(1, Number(process.env.LLM_CONCURRENCY) || 3);
let active = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
}

function release(): void {
  active--;
  waiting.shift()?.();
}

function run(args: string[], input: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Run outside the project so no project memory or settings reach the model.
    const child = spawn("claude", args, { env: childEnv(), cwd: tmpdir(), windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude -p timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else {
        let detail = stderr || stdout;
        try { const parsed = JSON.parse(stdout); detail = parsed.result || parsed.errors?.join("; ") || detail; } catch {}
        reject(new Error(`Claude Code: ${detail.slice(0, 500)}`));
      }
    });
    child.stdin.end(input, "utf8");
  });
}

export async function callClaude<T = unknown>(request: ClaudeRequest): Promise<ClaudeResponse<T>> {
  const args = [
    "-p",
    "--output-format", "json",
    "--model", request.model ?? process.env.LLM_MODEL ?? "sonnet",
    "--system-prompt", request.system,
    "--tools", "",
    // Skips plugins, hooks, MCP servers and CLAUDE.md but keeps the subscription login.
    // (`--bare` would skip them too, but it only accepts an API key.)
    "--safe-mode",
    "--no-session-persistence",
    "--max-turns", "1",
  ];
  if (request.schema) args.push("--json-schema", JSON.stringify(request.schema));
  if (request.effort) args.push("--effort", request.effort);

  await acquire();
  const started = performance.now();
  let stdout: string;
  try {
    stdout = await run(args, request.prompt, request.timeoutMs ?? 300_000);
  } finally {
    release();
  }
  const ms = performance.now() - started;

  const out = JSON.parse(stdout) as CliResult;
  if (/you.ve hit your .*limit|usage limit|rate limit|not logged in/i.test(out.result ?? "")) {
    throw new Error(`Claude Code: ${out.result}`);
  }
  if (out.is_error || out.subtype !== "success") {
    throw new Error(`claude -p failed (${out.subtype ?? "unknown"}): ${String(out.result ?? "").slice(0, 300)}`);
  }
  if (request.schema && out.structured_output === undefined) {
    throw new Error("claude -p returned no structured output");
  }
  const usage = out.usage ?? {};
  return {
    text: out.result ?? "",
    structured: out.structured_output as T | undefined,
    model: Object.keys(out.modelUsage ?? {})[0] ?? request.model ?? "",
    ms,
    apiMs: out.duration_api_ms ?? 0,
    costUsd: out.total_cost_usd ?? 0,
    inputTokens:
      (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  };
}
