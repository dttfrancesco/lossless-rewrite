import assert from "node:assert/strict";
import { test } from "node:test";
import { missingNumbers, numbersIn, unsupportedNumbers } from "./numbers";
import { splitSentences, wordCount } from "./sentences";

test("splits sentences, keeping abbreviations, decimals and headings intact", () => {
  const text =
    "## 5.1 Accuracy\nParticipants (n = 12) were fast, e.g. in task 3. Smith et al. found 3.5% more errors. Dr. Lee agreed.\n\nA new paragraph starts here. And another sentence!";
  const sentences = splitSentences(text);
  assert.deepEqual(
    sentences.map((s) => s.text),
    [
      "## 5.1 Accuracy",
      "Participants (n = 12) were fast, e.g. in task 3.",
      "Smith et al. found 3.5% more errors.",
      "Dr. Lee agreed.",
      "A new paragraph starts here.",
      "And another sentence!",
    ],
  );
  assert.deepEqual(sentences.map((s) => s.paragraph), [0, 1, 1, 1, 2, 2]);
  for (const s of sentences) assert.equal(text.slice(s.start, s.end), s.text);
  assert.deepEqual(sentences.map((s) => s.id), ["S1", "S2", "S3", "S4", "S5", "S6"]);
});

test("counts words", () => {
  assert.equal(wordCount("Cut words, not ideas."), 4);
  assert.equal(wordCount("It's a 73% cut — well-done."), 5);
});

test("reads numbers by value", () => {
  assert.deepEqual(numbersIn("1,426 words, p = .02, 95% CI −1.9 to −0.5, 12 percent, twelve"), [1426, 0.02, 95, 1.9, 0.5, 12, 12]);
  assert.deepEqual(numbersIn("/v2/batch returned S3 and Q8"), []);
  assert.deepEqual(numbersIn("options 3,4"), [3, 4]);
});

test("finds numbers a rewrite dropped or invented", () => {
  assert.deepEqual(missingNumbers("median 31 vs 44 minutes, p = .02", "from 44 to 31 minutes (p = .02)"), []);
  assert.deepEqual(missingNumbers("12 participants", "Twelve participants"), []);
  assert.deepEqual(missingNumbers("12 participants", "10 participants"), [12]);
  assert.deepEqual(unsupportedNumbers("12 participants took part", "10 participants took part"), [10]);
});
