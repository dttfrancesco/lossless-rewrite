// Local only. Learn instructions the user sends, never assistant replies or PDFs.
// Custom preferences need an explicit "Writing rules:" block; ordinary messages
// use a bounded vocabulary so pasted source prose does not become a global rule.
export function detectWritingRules(draft) {
  if (typeof draft !== 'string' || draft.length > 12000) return [];
  const text = draft.replace(/^\s*\/(?:lossless|loseless)\s+/i, '').replace(/’/g, "'").replace(/^\s*(?:I(?:'d| would) like (?:you to|the writing to)|I want you to|can you|could you)\s+/i, '').replace(/^\s*please remember to\s+/i, 'Remember to ');
  if (/[`{}<>]|^\s*>/m.test(text)) return [];
  const block = text.match(/^\s*(?:(?:my|remember (?:these|my))\s+)?writing rules?\s*:\s*([\s\S]+)$/i);
  if (block) {
    // A blank line ends the rules block, so a following task/source isn't saved.
    return [...new Set(block[1].split(/\n\s*\n/)[0].split(/\n/).map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean))]
      .filter(s => s.length <= 500).slice(0, 20);
  }
  if (/["“”]/.test(text)) return [];
  // A preference must lead the message, rather than occur inside pasted prose.
  if (!/^\s*(?:please\s+)?(?:from now on[, ]+|in future[, ]+|always\s+|remember to\s+)?(?:use|avoid|prefer|i prefer|do not|don't|never|keep|write|no)\b/i.test(text)) return [];
  const rules = [];
  for (const part of text.split(/[.!\n;]+|,?\s+and\s+(?=(?:please\s+)?(?:use|avoid|prefer|do not|don't|never|keep|write)\b)/i)) {
    const sentence = part.trim();
    if (!sentence) continue;
    if (sentence.length > 180 || /[?:]|\b(this time|this reply|this paragraph|for now|for this|only here|\d+\s*words?)\b/i.test(sentence)) break;
    const rule = sentence.replace(/^i prefer\s+/i, 'Prefer ').replace(/^(?:please\s+)?(?:from now on[, ]+|in future[, ]+|always\s+|remember to\s+)?/i, '').replace(/^please\s+/i, '').replace(/\s+please$/i, '').replace(/^no\s+/i, 'Avoid ').replace(/^avoid using\s+/i, 'Avoid ').replace(/^(?:don't|do not|never)\s+write\s+(?:in\s+)?/i, 'Avoid ').replace(/^write\s+(?:in|with)\s+/i, 'Use ').replace(/^write\s+(?=short sentences|short paragraphs)/i, 'Use ').replace(/\bem[- ]dashes?\b/gi, 'em dashes');
    if (!/^(?:use|avoid|prefer|do not use|don't use|never use|keep)\s+/i.test(rule)) break;
    // The whole instruction must describe a known writing preference. Do not
    // turn a sentence containing a style keyword into a permanent instruction.
    if (!/^(?:(?:use|prefer|do not use|don't use|never use|avoid)\s+(?:British English|American English|active voice|(?:the )?passive voice|em dashes|semicolons|bullet points|numbered lists|short sentences|short paragraphs|plain language|simple (?:words|language)|jargon|technical jargon|repetition|a formal tone|an informal tone|a conversational tone)|keep\s+(?:sentences short|paragraphs short|(?:the |your )?(?:writing|language|text) (?:concise|simple|clear)))(?:\s+(?:in (?:your|my) (?:writing|replies)|when writing))?$/i.test(rule)) break;
    rules.push(rule[0].toUpperCase() + rule.slice(1) + '.');
  }
  return [...new Set(rules)].slice(0, 3);
}

export function mergeLearnedRules(value, draft) {
  if (value.autoLearn === false || !value.enabled) return { value, added: [] };
  const key = text => text.toLowerCase().replace(/[.!]+$/, '').trim();
  const existing = new Set(value.rules.map(key));
  const added = detectWritingRules(draft).filter(rule => !existing.has(key(rule))).slice(0, Math.max(0, 20 - value.rules.length));
  return { value: { ...value, rules: [...value.rules, ...added] }, added };
}

// Wait for the chat to consume the draft. A click on a disabled Send button,
// failed send, another chat, or an edited draft must not save preferences.
export async function waitForSentDraft({ snapshot, composer, value, url, active, sent = () => false, wait = () => new Promise(resolve => setTimeout(resolve, 100)) }) {
  for (let attempt = 0; attempt < 50; attempt++) {
    await wait();
    if (!active()) return false;
    // First messages often navigate / -> /c/id and recreate the composer.
    // Require a matching newly-added user turn to accept either transition.
    if (sent(snapshot.text)) return true;
    if (url() !== snapshot.url) return false;
    const el = composer();
    if (el !== snapshot.el) continue;
    const current = value(el).trim();
    if (!current) return true;
    if (current !== snapshot.text.trim()) return false;
  }
  return false;
}
