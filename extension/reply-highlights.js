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

export function lastReply() {
  // Observed site-specific reply bodies, excluding headings and action bars.
  const siteSelector = {
    'claude.ai': '[data-testid="assistant-message"] [data-perf-reply-text]',
    'gemini.google.com': 'model-response-content message-content',
  }[globalThis.location?.hostname];
  const selector = siteSelector || '[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"], article[aria-label="Assistant"], [role="article"][aria-label="Assistant"]';
  const replies = [...document.querySelectorAll(selector)]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  return replies.at(-1);
}
export function textNodes(root) {
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
// Unmatched reply wording is a visual category, never a semantic verdict.
export function otherWordingRanges(length, matches) {
  const ranges = []; let end = 0;
  for (const match of [...matches].sort((a,b) => a.start-b.start)) {
    if (match.start > end) ranges.push({start:end,end:match.start});
    end = Math.max(end, match.end);
  }
  if (end < length) ranges.push({start:end,end:length});
  return ranges;
}
export function createReplyHighlighter(onChange = () => {}) {
  let sourceEnabled = true, replyEnabled = true, observer, style, target, capturedText, replyItems = [], sources = new Map();
  const keys = ['lossless-kept-wording', 'lossless-kept-meaning', 'lossless-other-wording', 'lossless-remove'];
  function paint() {
    if (!globalThis.CSS?.highlights || typeof Highlight === 'undefined') return;
    for (const key of keys) CSS.highlights.delete(key);
    if (!sourceEnabled && !replyEnabled) return;
    if (!style) {
      style = document.createElement('style'); style.dataset.lossless = 'highlight-style';
      style.textContent = '::highlight(lossless-kept-wording){background:#ffe4a6;color:#4b3100}::highlight(lossless-kept-meaning){background:#c5ead5;color:#174b33}::highlight(lossless-other-wording){background:#e1edff;color:#173c68}::highlight(lossless-remove){background:#fbe0df;color:#8b2620;text-decoration:line-through}';
      document.head.append(style);
    }
    const wording = new Highlight(), meaning = new Highlight(), other = new Highlight(), removed = new Highlight();
    removed.priority = 3;
    wording.priority = 2; meaning.priority = 1;
    if(sourceEnabled) for (const {item,range} of sources.values()) {
      if (range.startContainer.isConnected && normalized(range.toString()).value.trim() === normalized(item.text).value.trim()) (item.type === 'remove' ? removed : item.type === 'keep_wording' ? wording : meaning).add(range);
    }
    if (replyEnabled && target?.isConnected) {
      const {text,nodes} = textNodes(target), result = findPassageMatches(text,replyItems);
      const add = (match, highlight) => {
        const first = nodes.find(n => n.end > match.start), last = nodes.find(n => n.end >= match.end);
        if (!first || !last || match.end <= match.start) return;
        const range = document.createRange();
        range.setStart(first.node,Math.max(0,match.start-first.start)); range.setEnd(last.node,match.end-last.start); highlight.add(range);
      };
      for (const m of result.matches) add(m,m.type === 'remove' ? removed : m.type === 'keep_wording' ? wording : meaning);
      for (const m of otherWordingRanges(text.length,result.matches)) if (text.slice(m.start,m.end).trim()) add(m,other);
    }
    CSS.highlights.set(keys[0],wording); CSS.highlights.set(keys[1],meaning); CSS.highlights.set(keys[2],other); CSS.highlights.set(keys[3],removed);
  }
  function clear() { observer?.disconnect(); observer=undefined; target=undefined; capturedText=undefined; replyItems=[]; paint(); onChange(); }
  function remember(item,range) { if (range) sources.set(item.id,{item,range:range.cloneRange()}); paint(); }
  function sync(items) { const ids=new Set(items.map(i=>i.id)); for(const id of sources.keys()) if(!ids.has(id))sources.delete(id); paint(); }
  function reply(items) {
    clear(); target=lastReply(); if(!target)return;
    capturedText=normalized(textNodes(target).text).value;
    replyItems=structuredClone(items); observe(); paint(); onChange();
  }
  function observe() {
    observer?.disconnect(); observer=new MutationObserver(reconcile);
    observer.observe(target,{subtree:true,childList:true,characterData:true});
  }
  function reconcile() {
    if(!target)return;
    const latest=lastReply();
    // Chat providers add action buttons and replace Markdown nodes after streaming.
    // Rebuild DOM ranges if the reply text is unchanged; only invalidate actual edits.
    if(!latest || normalized(textNodes(latest).text).value!==capturedText){clear();return;}
    if(latest!==target){target=latest;observe();}
    paint();
  }
  function setEnabled(value,scope='all') {
    if(scope==='all'||scope==='source')sourceEnabled=Boolean(value);
    if(scope==='all'||scope==='reply')replyEnabled=Boolean(value);
    paint();onChange();
  }
  function reset() { sources.clear(); clear(); style?.remove(); style=undefined; }
  return {remember,sync,reply,clear,reset,setEnabled,reconcile,
    toggle(scope='all') { const before=scope==='source'?sourceEnabled:scope==='reply'?replyEnabled:sourceEnabled||replyEnabled;setEnabled(!before,scope);return `${scope==='all'?'Highlights':scope==='source'?'Source highlights':'Reply highlights'} ${!before?'on':'off'}.`; },
    get active() { return sourceEnabled||replyEnabled; }, get sourceEnabled(){return sourceEnabled;},get replyEnabled(){return replyEnabled;}
  };
}
