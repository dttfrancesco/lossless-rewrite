// Visual text matching only. This never supplies a semantic verdict or edits a reply.
function normalized(text) {
  let value = ''; const starts = [], ends = [];
  for (let i = 0; i < text.length; i++) {
    const char = /\s/.test(text[i]) ? ' ' : text[i];
    if (char === ' ' && value.endsWith(' ')) { ends[ends.length - 1] = i + 1; continue; }
    value += char; starts.push(i); ends.push(i + 1);
  }
  return { value, starts, ends };
}
export function findPassageMatches(text, items) {
  const haystack = normalized(text), matches = [], found = new Set();
  for (let item = 0; item < items.length; item++) {
    const needle = normalized(items[item].text).value.trim(); if (!needle) continue;
    let from = 0, index;
    while ((index = haystack.value.indexOf(needle, from)) !== -1) {
      if (matches.length >= 300) return { matches, found: found.size, limited: true };
      found.add(item);
      matches.push({ item, type: items[item].type, start: haystack.starts[index], end: haystack.ends[index + needle.length - 1] });
      from = index + Math.max(1, needle.length);
    }
  }
  return { matches, found: found.size };
}

function lastReply() {
  // Observed ChatGPT message containers, including editable writing blocks.
  // Other sites can expose the same explicit assistant-role semantics.
  const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"], article[aria-label="Assistant"], [role="article"][aria-label="Assistant"]')]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  return replies.at(-1);
}
function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let text = '', node, priorBlock;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('button,textarea,script,style,[aria-hidden="true"],[data-lossless]') || !parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
    const block = parent.closest('p,li,h1,h2,h3,h4,h5,h6,pre,td,th,blockquote');
    if (priorBlock && block !== priorBlock) text += '\n';
    priorBlock = block;
    const start = text.length; text += node.data; nodes.push({ node, start, end: text.length });
    if (text.length > 250000) throw new Error('This reply is too long to highlight. Use the full editor.');
  }
  return { text, nodes };
}
export function createReplyHighlighter(onChange = () => {}) {
  let active = false, observer, style, target;
  const keys = ['lossless-kept-wording', 'lossless-kept-meaning'];
  function clear() {
    observer?.disconnect(); observer = undefined;
    for (const key of keys) globalThis.CSS?.highlights?.delete(key);
    style?.remove(); style = undefined; target = undefined; active = false; onChange();
  }
  function toggle(items) {
    if (active) { clear(); return 'Highlights hidden.'; }
    if (!items.length) throw new Error('Select a passage to keep first. Then use Show kept text after the reply finishes.');
    if (!globalThis.CSS?.highlights || typeof Highlight === 'undefined') throw new Error('This browser does not support text highlighting. Update Chrome and try again.');
    const reply = lastReply();
    if (!reply) throw new Error('Cannot identify the latest reply on this layout. Use the full editor to compare the text.');
    const { text, nodes } = textNodes(reply), result = findPassageMatches(text, items);
    if (!result.matches.length) return 'No matching wording found in the latest reply. Ideas may be paraphrased; this is not a meaning check.';
    const wording = new Highlight(), meaning = new Highlight();
    wording.priority = 1; // The stricter wording mark wins when protections overlap.
    for (const match of result.matches) {
      const first = nodes.find(n => n.end > match.start), last = nodes.find(n => n.end >= match.end);
      if (!first || !last) continue;
      const range = document.createRange(); range.setStart(first.node, match.start - first.start); range.setEnd(last.node, match.end - last.start);
      (match.type === 'keep_wording' ? wording : meaning).add(range);
    }
    style = document.createElement('style'); style.dataset.lossless = 'highlight-style';
    style.textContent = '::highlight(lossless-kept-wording){background-color:#ffdf91;color:#352300}::highlight(lossless-kept-meaning){background-color:#b9e6cc;color:#123c25}';
    document.head.append(style);
    CSS.highlights.set(keys[0], wording); CSS.highlights.set(keys[1], meaning); active = true; target = reply;
    // Streaming, regeneration or editing invalidates the display instead of leaving stale highlights.
    observer = new MutationObserver(clear); observer.observe(reply, { subtree: true, childList: true, characterData: true });
    reply.scrollIntoView({ block: 'center', behavior: 'smooth' }); onChange();
    return `Matching text highlighted for ${result.found} of ${items.length} passages. Amber: Keep wording. Green: Keep meaning. Paraphrases are not checked.${result.limited ? ' Display limited to 300 matches.' : ''}`;
  }
  return { toggle, clear, reconcile() { if (active && (!target?.isConnected || lastReply() !== target)) clear(); }, get active() { return active; } };
}
