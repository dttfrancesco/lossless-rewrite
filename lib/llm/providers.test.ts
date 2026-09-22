import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { z } from "zod";
import { completeJson, completeText, resolveModel } from "./index";

test("explicit provider prefixes preserve nested gateway model IDs", () => {
  assert.deepEqual(resolveModel("gateway/openai/gpt-6-astra"), { provider: "gateway", model: "openai/gpt-6-astra" });
  assert.deepEqual(resolveModel("codex-cli/default"), { provider: "codex-cli", model: "default" });
});
test("compatible API sends a real HTTP request and validates structured responses", async () => {
  let content = "A complete rewrite.";
  const bodies: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    let body = "";
    for await (const part of req) body += part;
    bodies.push(JSON.parse(body));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "test", created: 1, model: "test-model", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const previous = process.env.LLM_BASE_URL;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  try {
    const request = { model: "compatible/test-model", system: "Edit carefully.", prompt: "Text.", purpose: "write" as const };
    assert.equal((await completeText(request)).data, content);
    content = '{"kept":true}';
    assert.deepEqual((await completeJson({ ...request, schema: z.object({ kept: z.boolean() }) })).data, { kept: true });
    content = '{"kept":"wrong type"}';
    await assert.rejects(completeJson({ ...request, schema: z.object({ kept: z.boolean() }) }));
    assert.equal(bodies[0]?.model, "test-model");
    assert.ok(Array.isArray(bodies[0]?.messages));
  } finally {
    if (previous === undefined) delete process.env.LLM_BASE_URL; else process.env.LLM_BASE_URL = previous;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
