import test from 'node:test';
import assert from 'node:assert/strict';
import { findPassageMatches } from './reply-highlights.js';
const item = (text, type = 'keep_meaning') => ({ text, type });
test('highlight spans retain offsets across rich-text whitespace and repeated wording', () => {
  const text = 'Pilot\n  had no control group. Pilot had no control group.';
  const result = findPassageMatches(text, [item('Pilot had no control group.', 'keep_wording')]);
  assert.equal(result.found, 1); assert.equal(result.matches.length, 2);
  assert.equal(text.slice(result.matches[0].start, result.matches[0].end), 'Pilot\n  had no control group.');
  assert.equal(text.slice(result.matches[1].start, result.matches[1].end), 'Pilot had no control group.');
});
test('overlapping protections remain distinct and missing or paraphrased ideas get no guessed highlight', () => {
  const result = findPassageMatches('No control group. Accuracy rose.', [item('No control group.'), item('control group', 'keep_wording'), item('The trial lacked a comparison arm.'), item('Speed improved.')]);
  assert.equal(result.found, 2); assert.deepEqual(result.matches.map(m => m.type), ['keep_meaning', 'keep_wording']);
  assert.equal(findPassageMatches('Accuracy rose.', [item('Accuracy fell.')]).found, 0);
});
test('Unicode offsets, empty passages and rendering limits remain safe', () => {
  const text = '🧪 Café improved.';
  const m = findPassageMatches(text, [item('Café')]).matches[0];
  assert.equal(text.slice(m.start,m.end), 'Café');
  assert.equal(findPassageMatches(text,[item(' ')]).found,0);
  assert.equal(findPassageMatches('x '.repeat(1000),[item('x')]).matches.length,300);
});
