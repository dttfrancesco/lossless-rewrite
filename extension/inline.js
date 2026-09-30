import { isSendLabel } from './inline-prompt.js';
import { sendPrepared } from './inline-send.js';
import { protectedPrompt, slashRequest } from './protections.js';

export function mountInline({ composer, value, write, visible, allowed }) {
  const host = document.createElement('div'); host.dataset.lossless = 'toolbar';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;display:block;position:fixed;z-index:2147483000;bottom:18px;right:20px;pointer-events:auto;font:14px/1.5 system-ui,sans-serif;color:#272822;color-scheme:light;max-width:calc(100vw - 24px)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;border:1px solid #c8c6bd;border-radius:6px;background:#fffefb;padding:7px 11px}button:hover{background:#eeeae1}button:focus-visible{outline:3px solid #3a604c;outline-offset:2px}.bar{background:#faf9f5;border:1px solid #d0cec4;border-radius:8px;box-shadow:0 2px 10px #0001;padding:5px;display:flex;gap:5px;align-items:center;flex-wrap:wrap}.bar button{border-color:transparent;background:transparent}.body{width:330px;max-width:100%;background:#faf9f5;border:1px solid #d0cec4;border-radius:8px;padding:16px;margin-bottom:8px;max-height:45vh;overflow:auto}.body p{margin:0 0 12px}.item{border-top:1px solid #ddd;padding:10px 0}.item p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;max-height:140px;overflow:auto;margin:6px 0}.item small{display:block;color:#4d5a4f}.status{white-space:normal;overflow-wrap:anywhere;margin:6px 0 0;max-width:330px;background:#faf9f5;padding:3px}.status:empty{display:none}.pick{position:fixed;background:#faf9f5;padding:5px;border:1px solid #acae9f;border-radius:8px;box-shadow:0 3px 12px #0002;display:flex;gap:5px;z-index:2147483640}.pick button:first-child{color:#21573e}.pick button:last-child{color:#74411b}[hidden]{display:none!important}code{font:inherit;font-weight:650}button:disabled{opacity:.5;cursor:default}
  </style><div class="body" hidden><p>Select a passage in this chat or a PDF. Then type <code>/lossless</code> before your request and send normally.</p><div id="items"></div><button id="clear">Clear selections</button></div><div class="bar"><button id="kept" aria-expanded="false">Lossless · 0 kept</button><button id="pdf">Open PDF</button></div><p class="status" role="status"></p><div class="pick" hidden><button data-type="keep_meaning">Keep meaning</button><button data-type="keep_wording">Keep wording</button></div>`;
  document.documentElement.append(host);
  const q = s => root.querySelector(s), status = text => { q('.status').textContent = text; };
  let context = { items: [] }, selection, busy = false, bypass = false, destroyed = false, lastURL = location.href, frame;
  async function request(action, args = {}) {
    const result = await chrome.runtime.sendMessage({ kind: 'protections', action, ...args });
    if (result?.error) throw new Error(result.error);
    if (!result?.context) throw new Error('Reload the extension and refresh this chat.');
    return result.context;
  }
  function draw() {
    q('#kept').textContent = `Lossless · ${context.items.length} kept`;
    q('#clear').hidden = !context.items.length; q('#items').replaceChildren();
    for (const item of context.items) {
      const box = document.createElement('div'); box.className = 'item';
      const label = document.createElement('small'); label.textContent = `${item.type === 'keep_wording' ? 'Keep wording' : 'Keep meaning'} · ${item.source.label}${item.source.page ? ` · p. ${item.source.page}` : ''}`;
      const text = document.createElement('p'); text.textContent = item.text;
      const remove = document.createElement('button'); remove.textContent = 'Remove';
      remove.onclick = async () => { try { context = await request('remove', { id: item.id, scope: context.scope }); draw(); } catch (e) { status(e.message); } };
      box.append(label, text, remove); q('#items').append(box);
    }
  }
  async function refresh() { try { context = await request('get'); if (!destroyed) draw(); } catch (e) { status(e.message); } }
  function position() {
    frame = undefined;
    if (location.href !== lastURL) { lastURL = location.href; selection = undefined; q('.pick').hidden = true; q('.body').hidden = true; status(''); refresh(); }
    const el = composer(); host.hidden = !el && !selection; if (!el) return;
    const r = el.getBoundingClientRect(); host.style.left = `${Math.max(12, Math.min(r.left, innerWidth - 342))}px`; host.style.right = 'auto';
    host.style.bottom = `${Math.max(12, Math.min(innerHeight - r.top + 10, innerHeight - host.getBoundingClientRect().height - 12))}px`;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
  const layout = new MutationObserver(schedule); layout.observe(document.body, { childList: true, subtree: true });
  const resize = new ResizeObserver(schedule); resize.observe(host);
  window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
  function closeOptions() { q('.body').hidden = true; q('#kept').setAttribute('aria-expanded', 'false'); }
  q('#kept').onclick = () => { q('.body').hidden = !q('.body').hidden; q('#kept').setAttribute('aria-expanded', String(!q('.body').hidden)); refresh(); };
  q('#clear').onclick = async () => { try { context = await request('clear', { scope: context.scope }); draw(); } catch (e) { status(e.message); } };
  q('#pdf').onclick = () => request('reader').catch(e => status(e.message));
  function captureSelection(e) {
    if (e.composedPath().includes(host)) return;
    const focused = document.activeElement, selected = getSelection();
    let text = '', rect;
    if (focused instanceof HTMLTextAreaElement && focused.selectionEnd > focused.selectionStart) { text = focused.value.slice(focused.selectionStart, focused.selectionEnd); rect = focused.getBoundingClientRect(); }
    else if (selected?.rangeCount && selected.toString().trim()) { text = selected.toString(); rect = selected.getRangeAt(0).getBoundingClientRect(); }
    if (!text.trim() || text.length > 12000 || !rect) { selection = undefined; q('.pick').hidden = true; return; }
    selection = { text, url: location.href, scope: context.scope };
    q('.pick').style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 265))}px`;
    q('.pick').style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - 52))}px`;
    q('.pick').hidden = false; host.hidden = false;
  }
  q('.pick').addEventListener('pointerdown', e => e.preventDefault());
  for (const button of root.querySelectorAll('[data-type]')) button.onclick = async () => {
    try {
      if (!selection || selection.url !== location.href) throw new Error('Select the passage again in this chat.');
      context = await request('add', { scope: selection.scope, item: { type: button.dataset.type, text: selection.text, source: { kind: 'chat', label: 'Chat passage' } } });
      draw(); selection = undefined; q('.pick').hidden = true; status('Saved. Start your request with /lossless and send normally.');
    } catch (e) { status(e.message); }
  };
  const outside = e => { if (!e.composedPath().includes(host)) { closeOptions(); q('.pick').hidden = true; } };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('mouseup', captureSelection); document.addEventListener('keyup', captureSelection);
  function sendButton(el) {
    const scope = el.closest('form') || document;
    const buttons = [...scope.querySelectorAll('button,[role=button]')].filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && isSendLabel(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || ''));
    return buttons.length === 1 ? buttons[0] : null;
  }
  async function send(snapshot) {
    busy = true; closeOptions(); q('.pick').hidden = true; status('Applying your selections…');
    try {
      context = await request('get');
      if (destroyed || location.href !== snapshot.url) throw new Error('The chat changed. Nothing was sent.');
      const prepared = protectedPrompt(snapshot.text, context.items);
      await request('arm', { scope: context.scope });
      const outcome = await sendPrepared({ snapshot, prepared, adapter: {
        allowed: async () => !destroyed && await allowed(), url: () => location.href, composer, value, write,
        sendButton: el => { const button = sendButton(el); return button && { click() { bypass = true; try { button.click(); } finally { bypass = false; } } }; }
      } });
      status(outcome === 'clicked' ? `${context.items.length} selection${context.items.length === 1 ? '' : 's'} included. Reply not yet checked.` : 'Selections added. Use the chat’s Send button to finish.');
    } catch (e) { await request('disarm').catch(() => {}); status(e.message); }
    finally { busy = false; }
  }
  function intercept(e) {
    if (bypass || destroyed || e.defaultPrevented) return;
    const el = composer(); if (!el) return;
    const path = e.composedPath(); if (path.includes(host)) return;
    if (e.type === 'keydown' && (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || !path.includes(el))) return;
    if (e.type === 'click' && !path.includes(sendButton(el))) return;
    if (e.type === 'submit' && e.target !== el.closest('form')) return;
    if (!busy && slashRequest(value(el)) === null) { status(''); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (!busy && !e.repeat) send({ el, text: value(el), url: location.href });
  }
  for (const event of ['keydown', 'click', 'submit']) window.addEventListener(event, intercept, true);
  refresh(); position();
  return { refresh, destroy() { destroyed = true; cancelAnimationFrame(frame); layout.disconnect(); resize.disconnect(); host.remove(); document.removeEventListener('pointerdown', outside); document.removeEventListener('mouseup', captureSelection); document.removeEventListener('keyup', captureSelection); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); for (const event of ['keydown', 'click', 'submit']) window.removeEventListener(event, intercept, true); } };
}
