import { isSendLabel } from './inline-prompt.js';
import { sendPrepared } from './inline-send.js';
import { protectedPrompt, slashRequest } from './protections.js';
import { createReplyHighlighter } from './reply-highlights.js';
import manifest from './manifest.json';
import { isSendShortcut, shortcutLabels } from './shortcuts.js';

export function mountInline({ composer, value, write, visible, allowed }) {
  const keys = shortcutLabels();
  const host = document.createElement('div'); host.dataset.lossless = 'toolbar';
  host.dataset.losslessVersion = manifest.version;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;display:block;position:fixed;z-index:2147483000;bottom:18px;right:20px;pointer-events:auto;font:14px/1.5 system-ui,sans-serif;color:#272822;color-scheme:light;max-width:calc(100vw - 24px)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;border:1px solid #c8c6bd;border-radius:6px;background:#fffefb;padding:7px 11px}button:hover{background:#eeeae1}button:focus-visible{outline:3px solid #3a604c;outline-offset:2px}.bar{background:#faf9f5;border:1px solid #d0cec4;border-radius:8px;box-shadow:0 2px 10px #0001;padding:5px;display:flex;gap:5px;align-items:center;flex-wrap:wrap}.bar button{border-color:transparent;background:transparent}.body{width:330px;max-width:100%;background:#faf9f5;border:1px solid #d0cec4;border-radius:8px;padding:16px;margin-bottom:8px;max-height:45vh;overflow:auto}.body p{margin:0 0 12px}.item{border-top:1px solid #ddd;padding:10px 0}.item p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;max-height:140px;overflow:auto;margin:6px 0}.item small{display:block;color:#4d5a4f}.status{white-space:normal;overflow-wrap:anywhere;margin:6px 0 0;max-width:330px;background:#faf9f5;padding:3px}.status:empty{display:none}.pick{position:fixed;background:#faf9f5;padding:5px;border:1px solid #acae9f;border-radius:8px;box-shadow:0 3px 12px #0002;display:flex;gap:5px;z-index:2147483640}.pick button:first-child{color:#21573e}.pick button:last-child{color:#74411b}[hidden]{display:none!important}code{font:inherit;font-weight:650}button:disabled{opacity:.5;cursor:default}
  </style><div class="body" hidden><p>Select a passage in this chat or a PDF. Then type <code>/lossless</code> before your request and send normally.</p><div id="items"></div><button id="clear">Clear selections</button></div><div class="bar"><button id="kept" aria-expanded="false">Lossless · 0 kept</button><button id="pdf">Open PDF</button></div><p class="status" role="status"></p><div class="pick" hidden><button data-type="keep_meaning">Keep meaning</button><button data-type="keep_wording">Keep wording</button></div>`;
  root.querySelector('style').textContent += ':host([hidden]){display:none!important}.card{width:340px;max-width:100%;background:#faf9f5;border:1px solid #d0cec4;border-radius:10px;padding:12px;box-shadow:0 3px 16px #0001}.heading{display:flex;align-items:center;gap:10px}.heading strong{flex:1}.heading button{border:0;background:transparent;padding:0 5px;font-size:20px}.card p{margin:6px 0 0}.bar{border:0;box-shadow:none;padding:6px 0 0}.bar button{padding:5px 8px}.status{padding:0;margin-top:6px}.note{font-size:13px;color:#53574e}';
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<div class="heading"><strong id="heading">Lossless</strong><button id="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button><button id="dismiss" aria-label="Dismiss Lossless">×</button></div><p id="ready" role="status"></p><p class="note" id="check-note">Adds your selections to this request. No Jev check.</p><div id="keys" hidden><p><strong id="send-key"></strong><br>Send your draft with saved passages. Focus the chat box first.</p><p><strong id="highlight-key"></strong><br>Show or hide matching text in the latest reply.</p><p><strong>Shift+Enter</strong> adds a new line.<br><strong>Escape</strong> closes this popup.</p><p class="note">/lossless with normal Send still works.</p></div>';
  card.append(root.querySelector('.body'), root.querySelector('.bar'), root.querySelector('.status')); root.append(card);
  host.hidden = true; document.documentElement.append(host);
  const q = s => root.querySelector(s);
  q('#send-key').textContent = keys.send; q('#highlight-key').textContent = keys.highlight;
  const show = document.createElement('button'); show.id = 'show-kept'; show.textContent = 'Show kept text'; show.title = `Highlight matching wording in the latest reply (${keys.highlight})`; q('.bar').append(show);
  q('.body > p').textContent = `Select a passage in this chat or a PDF. Write your request, then press ${keys.send} to send it with your saved passages.`;
  const highlighter = createReplyHighlighter(() => schedule());
  let message = '', noticeTimer, dismissedDraft, opened = false;
  const status = (text, duration = 8000) => {
    message = text; q('.status').textContent = text; clearTimeout(noticeTimer);
    if (text && duration) noticeTimer = setTimeout(() => { message = ''; q('.status').textContent = ''; schedule(); }, duration);
    schedule();
  };
  let context = { items: [] }, selection, busy = false, bypass = false, destroyed = false, lastURL = location.href, frame;
  async function request(action, args = {}) {
    const result = await chrome.runtime.sendMessage({ kind: 'protections', action, ...args });
    if (result?.error) throw new Error(result.error);
    if (!result?.context) throw new Error('Reload the extension and refresh this chat.');
    if (['add', 'remove', 'clear'].includes(action)) highlighter.clear();
    return result.context;
  }
  async function highlight() {
    try { context = await request('get'); if (destroyed) return; const message = highlighter.toggle(context.items); status(message, 12000); draw(); return { message }; }
    catch (e) { status(e.message, 12000); return { error: e.message }; }
  }
  show.onclick = highlight;
  function draw() {
    q('#kept').textContent = `Selections (${context.items.length})`;
    q('#clear').hidden = !context.items.length; q('#items').replaceChildren();
    for (const item of context.items) {
      const box = document.createElement('div'); box.className = 'item';
      const label = document.createElement('small'); label.textContent = `${item.type === 'keep_wording' ? 'Keep wording' : 'Keep meaning'} · ${item.source.label}${item.source.page ? ` · p. ${item.source.page}` : ''}`;
      const text = document.createElement('p'); text.textContent = item.text;
      const remove = document.createElement('button'); remove.textContent = 'Remove';
      remove.onclick = async () => { try { context = await request('remove', { id: item.id, scope: context.scope }); draw(); } catch (e) { status(e.message); } };
      box.append(label, text, remove); q('#items').append(box);
    }
    schedule();
  }
  async function refresh() { try { const next = await request('get'); if (JSON.stringify(next.items) !== JSON.stringify(context.items)) highlighter.clear(); context = next; if (!destroyed) draw(); } catch (e) { const el = composer(); if (!destroyed && (opened || (el && slashRequest(value(el)) !== null))) status(e.message); } }
  function position() {
    frame = undefined;
    highlighter.reconcile();
    if (location.href !== lastURL) { lastURL = location.href; highlighter.clear(); selection = undefined; opened = false; dismissedDraft = undefined; q('.pick').hidden = true; closeOptions(); status(''); refresh(); }
    const el = composer(), draft = el ? value(el) : '', command = slashRequest(draft);
    const active = command !== null && dismissedDraft !== draft;
    card.hidden = !(active || opened || message || busy);
    host.hidden = card.hidden && q('.pick').hidden;
    q('#heading').textContent = busy ? 'Preparing request…' : active ? 'Lossless request' : 'Lossless';
    q('#ready').hidden = Boolean(message || busy || !q('#keys').hidden);
    q('#ready').textContent = !context.items.length ? 'Select text in the chat and choose Keep meaning or Keep wording.' : command === '' ? 'Add an instruction, e.g. “Shorten this to 150 words.”' : active ? `Ready: ${context.items.length} saved passage${context.items.length === 1 ? '' : 's'}. Use the chat’s Send button.` : `Write your request, then press ${keys.send}. No /lossless needed.`;
    q('#check-note').hidden = Boolean(message || busy || !q('#keys').hidden);
    q('.bar').hidden = Boolean(message && !active && !opened && !highlighter.active);
    show.textContent = highlighter.active ? 'Hide kept text' : 'Show kept text';
    if (!el) return;
    const r = el.getBoundingClientRect(); host.style.left = `${Math.max(12, Math.min(r.left, innerWidth - 342))}px`; host.style.right = 'auto';
    host.style.bottom = `${Math.max(12, Math.min(innerHeight - r.top + 10, innerHeight - host.getBoundingClientRect().height - 12))}px`;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
  const layout = new MutationObserver(schedule); layout.observe(document.body, { childList: true, subtree: true });
  const resize = new ResizeObserver(schedule); resize.observe(host);
  window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
  const input = e => { if (!e.composedPath().includes(host)) { status(''); schedule(); } };
  document.addEventListener('input', input);
  function dismiss() { const el = composer(); dismissedDraft = el ? value(el) : ''; opened = false; selection = undefined; closeOptions(); q('.pick').hidden = true; status(''); }
  q('#dismiss').onclick = dismiss;
  function closeOptions() { q('.body').hidden = true; q('#keys').hidden = true; q('#kept').setAttribute('aria-expanded', 'false'); }
  q('#help').onclick = () => { const showHelp = q('#keys').hidden; closeOptions(); q('#keys').hidden = !showHelp; opened = true; schedule(); };
  q('#kept').onclick = () => { q('#keys').hidden = true; q('.body').hidden = !q('.body').hidden; q('#kept').setAttribute('aria-expanded', String(!q('.body').hidden)); refresh(); };
  q('#clear').onclick = async () => { try { context = await request('clear', { scope: context.scope }); draw(); } catch (e) { status(e.message); } };
  q('#pdf').onclick = () => request('reader').catch(e => status(e.message));
  function captureSelection(e) {
    if (e.key === 'Escape') return;
    if (e.composedPath().includes(host)) return;
    const focused = document.activeElement, selected = getSelection();
    let text = '', rect;
    if (focused instanceof HTMLTextAreaElement && focused.selectionEnd > focused.selectionStart) { text = focused.value.slice(focused.selectionStart, focused.selectionEnd); rect = focused.getBoundingClientRect(); }
    else if (selected?.rangeCount && selected.toString().trim()) { text = selected.toString(); rect = selected.getRangeAt(0).getBoundingClientRect(); }
    if (!text.trim() || text.length > 12000 || !rect) { selection = undefined; q('.pick').hidden = true; schedule(); return; }
    selection = { text, url: location.href, scope: context.scope };
    q('.pick').style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 265))}px`;
    q('.pick').style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - 52))}px`;
    q('.pick').hidden = false; schedule();
  }
  q('.pick').addEventListener('pointerdown', e => e.preventDefault());
  for (const button of root.querySelectorAll('[data-type]')) button.onclick = async () => {
    try {
      if (!selection || selection.url !== location.href) throw new Error('Select the passage again in this chat.');
      context = await request('add', { scope: selection.scope, item: { type: button.dataset.type, text: selection.text, source: { kind: 'chat', label: 'Chat passage' } } });
      draw(); selection = undefined; q('.pick').hidden = true; status(`Saved. Write your request and press ${keys.send} to send with Lossless.`);
    } catch (e) { status(e.message); }
  };
  const outside = e => { if (!e.composedPath().includes(host)) dismiss(); };
  const escape = e => { if (e.key === 'Escape') dismiss(); if (!e.defaultPrevented && !e.repeat && !e.isComposing && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyH') { e.preventDefault(); highlight(); } };
  document.addEventListener('keydown', escape);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('mouseup', captureSelection); document.addEventListener('keyup', captureSelection);
  function sendButton(el) {
    const scope = el.closest('form') || document;
    const buttons = [...scope.querySelectorAll('button,[role=button]')].filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && isSendLabel(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || ''));
    return buttons.length === 1 ? buttons[0] : null;
  }
  async function send(snapshot, direct = false) {
    busy = true; dismissedDraft = undefined; closeOptions(); q('.pick').hidden = true; status('Adding your selections…', 0);
    try {
      context = await request('get');
      if (destroyed || location.href !== snapshot.url) throw new Error('The chat changed. Nothing was sent.');
      const prepared = protectedPrompt(snapshot.text, context.items, { direct });
      await request('arm', { scope: context.scope });
      const outcome = await sendPrepared({ snapshot, prepared, adapter: {
        allowed: async () => !destroyed && await allowed(), url: () => location.href, composer, value, write,
        sendButton: el => { const button = sendButton(el); return button && { click() { bypass = true; try { button.click(); } finally { bypass = false; } } }; }
      } });
      status(outcome === 'clicked' ? `Added ${context.items.length} saved passage${context.items.length === 1 ? '' : 's'} and pressed Send. Jev has not checked the reply.` : 'Selections added, but not sent. Use the chat’s Send button to finish.');
    } catch (e) { await request('disarm').catch(() => {}); status(e.message); }
    finally { busy = false; schedule(); }
  }
  function intercept(e) {
    if (bypass || destroyed || e.defaultPrevented) return;
    const el = composer(); if (!el) return;
    const path = e.composedPath(); if (path.includes(host)) return;
    const shortcut = e.type === 'keydown' && isSendShortcut(e);
    if (e.type === 'keydown' && (e.key !== 'Enter' || (!shortcut && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) || e.isComposing || !path.includes(el))) return;
    if (e.type === 'click' && !path.includes(sendButton(el))) return;
    if (e.type === 'submit' && e.target !== el.closest('form')) return;
    if (!busy && !shortcut && slashRequest(value(el)) === null) { highlighter.clear(); status(''); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (!busy && !e.repeat) send({ el, text: value(el), url: location.href }, shortcut);
  }
  for (const event of ['keydown', 'click', 'submit']) window.addEventListener(event, intercept, true);
  refresh(); position();
  return { refresh, highlight, open() { opened = true; dismissedDraft = undefined; refresh(); schedule(); }, destroy() { destroyed = true; highlighter.clear(); clearTimeout(noticeTimer); cancelAnimationFrame(frame); layout.disconnect(); resize.disconnect(); host.remove(); document.removeEventListener('input', input); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); document.removeEventListener('mouseup', captureSelection); document.removeEventListener('keyup', captureSelection); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); for (const event of ['keydown', 'click', 'submit']) window.removeEventListener(event, intercept, true); } };
}
