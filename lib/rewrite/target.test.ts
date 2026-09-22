import assert from "node:assert/strict";
import { test } from "node:test";
import { targetWords } from "./target";

test("reads the target length from an instruction", () => {
  assert.equal(targetWords("Cut this to ~350 words and make it much tighter.", 1400), 350);
  assert.equal(targetWords("Make it 300–350 words", 1400), 350);
  assert.equal(targetWords("Keep it under 1,200 words", 1400), 1200);
  assert.equal(targetWords("Make this section 70% shorter", 1000), 300);
  assert.equal(targetWords("Cut it by 40%", 1000), 600);
  assert.equal(targetWords("Cut it in half", 1000), 500);
  assert.equal(targetWords("Make it more technical", 1000), undefined);
});
