/**
 * Check your setup with one tiny request per backend.
 *   npx tsx eval/smoke.ts            Jev and Claude
 *   npx tsx eval/smoke.ts jev        just the decision backend (also: rizzo)
 *   npx tsx eval/smoke.ts llm        just Claude, through whichever provider is configured
 */
import { z } from "zod";
import { loadEnv } from "../lib/env";
import { DecisionClient, decisionConfig, type DecisionProvider } from "../lib/decision/client";
import { presenceQuestion, rewriteState, traceQuestion } from "../lib/coverage/questions";
import { completeJson, llmProvider, modelFor } from "../lib/llm";

loadEnv();

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["jev", "llm"];

for (const target of targets) {
  if (target === "llm") {
    const started = performance.now();
    const result = await completeJson({
      system: "You check whether a rewrite keeps a fact.",
      prompt: 'Fact: "12 participants completed the experiment."\nRewrite: "The experiment involved 12 participants."\nIs the fact present?',
      schema: z.object({ present: z.boolean() }),
      purpose: "judge",
      effort: "low",
    });
    console.log(
      `LLM via ${llmProvider()} (${result.model}, asked for "${modelFor("judge")}"): ${Math.round(performance.now() - started)} ms → ${JSON.stringify(result.data)}`,
    );
    continue;
  }
  const unit = { id: "F1", kind: "must_cover" as const, text: "12 participants completed the experiment." };
  const sentences = [
    { id: "S1", text: "The experiment involved 12 participants." },
    { id: "S2", text: "They alternated between sketching and prototyping." },
  ];
  const client = new DecisionClient(decisionConfig(target as DecisionProvider));
  const result = await client.ask(rewriteState(sentences), {
    present: presenceQuestion(unit),
    trace: traceQuestion(unit, sentences.map((s) => s.id)),
  });
  console.log(`${target} (${result.model}): ${Math.round(result.ms)} ms, ${result.inputTokens} input tokens`);
  console.log(JSON.stringify(result.answers, null, 1));
}
