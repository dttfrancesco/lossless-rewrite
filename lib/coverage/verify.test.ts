import assert from "node:assert/strict";
import { test } from "node:test";
import type { DecisionClient } from "../decision/client";
import { splitSentences } from "../text/sentences";
import { verifyRewrite } from "./verify";
import { findWording } from "./wording";

const client = (answers: object) => ({ config: { provider: "jev" }, ask: async () => ({ answers, ms: 1, inputTokens: 10 }) }) as unknown as DecisionClient;
test("wording locations refer to the actual draft, preserving paragraphs and indentation", async () => {
  const text = "  A heading.\n\n\nThe exact claim — unchanged.\n";
  const span = "The exact claim — unchanged.";
  const v = await verifyRewrite({ client: client({}), text, sentences: splitSentences(text), units: [], keepWording: [{ id: "W1", text: span }] });
  assert.equal(v.wording[0]?.location?.start, text.indexOf(span));
  const location = v.wording[0]!.location!;
  assert.equal(text.slice(location.start, location.end), span);
});
test("Keep wording does not silently allow changed punctuation or empty locks", () => {
  assert.equal(findWording("A—B", "A-B"), undefined);
  assert.equal(findWording("", "text"), undefined);
});
test("malformed decision responses fail closed", async () => {
  for (const answers of [{}, { "F1::present": { noul: 2 } }, { "F1::present": { noul: NaN } }]) {
    await assert.rejects(verifyRewrite({ client: client(answers), sentences: [{ id: "S1", text: "A claim." }], units: [{ id: "F1", kind: "must_cover", text: "A claim." }], keepWording: [], adjudicate: false }), /invalid presence/);
  }
});
