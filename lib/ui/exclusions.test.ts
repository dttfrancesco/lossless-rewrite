import test from "node:test";
import assert from "node:assert/strict";
import { omitSource } from "./exclusions";
test("excluded content never reaches the writer, while protected offsets and paragraphs survive", () => {
  const source = "Private aside.\nDelivery takes 3 days.\nExtra note.";
  const at = source.indexOf("Delivery");
  const filtered = omitSource(source, [{ start: 0, end: source.indexOf("\n") }, { start: source.indexOf("Extra"), end: source.length }]);
  assert.equal(filtered.length, source.length);
  assert.equal(filtered.slice(at, at + "Delivery takes 3 days.\n".length), "Delivery takes 3 days.\n");
  assert.ok(!filtered.includes("Private"));
  assert.ok(!filtered.includes("Extra"));
  assert.throws(() => omitSource(source, [{ start: 0, end: 10 }, { start: 8, end: 12 }]));
});
