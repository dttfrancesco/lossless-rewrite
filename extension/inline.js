import { composeInlinePrompt, isSendLabel } from "./inline-prompt.js";
import { sendPrepared } from "./inline-send.js";

export function mountInline({ composer, value, write, visible, allowed }) {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host{display:block;position:fixed;z-index:2147483000;bottom:18px;right:20px;font:14px/1.5 system-ui,sans-serif;color:#272822;color-scheme:light;max-width:calc(100vw - 40px)}
    *{box-sizing:border-box}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;border:1px solid #c8c6bd;border-radius:6px;background:#fffefb;padding:7px 12px}button:hover{background:#eeeae1}button:disabled{opacity:.55;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid #3a604c;outline-offset:2px}
    .bar{background:#faf9f5;border:1px solid #d0cec4;border-radius:9px;box-shadow:0 3px 14px #0001;padding:9px 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}.bar label{display:flex;gap:7px;align-items:center;font-weight:600}.primary{background:#2f5140;color:white;border-color:#2f5140}.primary:hover{background:#203d2e}.body{width:300px;max-width:100%;background:#faf9f5;border:1px solid #d0cec4;border-radius:8px;padding:16px;margin-bottom:8px}.body p{margin:0 0 12px}.body label{display:block;margin-top:12px}input[type=number],textarea{width:100%;border:1px solid #b6b9ad;border-radius:5px;background:#fffefb;padding:8px;margin-top:5px}textarea{resize:vertical;line-height:1.5;min-height:85px}summary{cursor:pointer}small{display:block;color:#52584e;margin-top:8px}dialog{width:min(620px,calc(100vw - 32px));max-height:85vh;overflow:auto;border:1px solid #bbbeb2;border-radius:10px;background:#faf9f5;color:#272822;padding:24px;font:15px/1.5 system-ui,sans-serif}dialog::backdrop{background:#0007}h2{font:600 23px/1.3 system-ui;margin:0 0 10px}dialog textarea{min-height:240px}dialog .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.status{white-space:normal;overflow-wrap:anywhere;margin:8px 0 0;max-width:340px;background:#faf9f5}.status:empty{display:none}[hidden]{display:none!important}
  </style>
  <div class="body" hidden><p>Write your request in the usual chat box.</p><label>Word limit · optional<input type="number" min="20" max="50000" step="1" placeholder="250"></label><details><summary>Anything that must stay?</summary><textarea aria-label="What must stay" maxlength="4000" placeholder="For example: the negative findings and study limitations."></textarea></details><small>Use Review &amp; send below. The chat’s usual Send button stays unchanged.</small></div>
  <div class="bar"><label><input type="checkbox">Lossless</label><button class="primary" id="review" hidden>Review &amp; send</button><button id="settings" hidden aria-label="Lossless options" aria-expanded="false">Options</button></div><p class="status" role="status"></p>
  <dialog><h2>Send with Lossless</h2><p>Your request plus instructions to preserve ideas. It goes to this chat’s provider, using your current model.</p><textarea aria-label="Complete prompt to send"></textarea><p class="review-status" role="status"></p><div class="actions"><button class="primary" id="send">Send with Lossless</button><button id="cancel">Cancel</button></div></dialog>`;
  document.documentElement.append(host);
  const q = s => root.querySelector(s);
  const toggle = q('[type=checkbox]'), options = q('.body'), dialog = q('dialog'), preview = q('dialog textarea');
  let snapshot, busy = false, destroyed = false, clicked = false;
  function position() {
    const el = composer(); host.hidden = !el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    host.style.left = `${Math.max(12, Math.min(r.left, innerWidth - 332))}px`;
    host.style.right = "auto";
    host.style.bottom = `${Math.max(12, Math.min(innerHeight - r.top + 10, innerHeight - host.getBoundingClientRect().height - 12))}px`;
  }
  const layout = new MutationObserver(position);
  layout.observe(document.body, { childList: true, subtree: true });
  const resize = new ResizeObserver(position); resize.observe(host);
  window.addEventListener('resize', position); window.addEventListener('scroll', position, true); position();
  function closeOptions() { options.hidden = true; q('#settings').setAttribute('aria-expanded', 'false'); }
  toggle.onchange = () => { q('#review').hidden = q('#settings').hidden = !toggle.checked; options.hidden = !toggle.checked; q('#settings').setAttribute('aria-expanded', String(toggle.checked)); q('.status').textContent = ''; };
  q('#settings').onclick = () => { options.hidden = !options.hidden; q('#settings').setAttribute('aria-expanded', String(!options.hidden)); };
  const outside = e => { if (!e.composedPath().includes(host)) closeOptions(); };
  document.addEventListener('pointerdown', outside);
  q('#review').onclick = () => {
    try {
      const el = composer(); if (!el) throw new Error('Cannot identify one chat box. Use the full editor instead.');
      snapshot = { el, text: value(el), url: location.href };
      preview.value = composeInlinePrompt(snapshot.text, { budget: q('[type=number]').value, keep: q('.body textarea').value });
      q('.review-status').textContent = ''; q('#send').disabled = false; clicked = false; closeOptions(); dialog.showModal();
    } catch (e) { q('.status').textContent = e.message; }
  };
  q('#cancel').onclick = () => { if (!busy) dialog.close(); };
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  dialog.onclick = e => { if (e.target === dialog && !busy) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } };
  function sendButton(el) {
    // Prefer the composer's form, and otherwise require one unambiguous labeled control.
    const scope = el.closest('form') || document;
    const buttons = [...scope.querySelectorAll('button,[role=button]')].filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && isSendLabel(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || ''));
    return buttons.length === 1 ? buttons[0] : null;
  }
  q('#send').onclick = async () => {
    if (busy || clicked) return;
    busy = true; q('#send').disabled = true; q('#cancel').disabled = true;
    try {
      dialog.close(); // Release modal inertness before editing the site's composer.
      const outcome = await sendPrepared({ snapshot, prepared: preview.value, adapter: { allowed: async () => !destroyed && await allowed(), url: () => location.href, composer, value, write, sendButton } });
      if (outcome === 'staged') { dialog.close(); q('.status').textContent = 'Prompt added to the chat. Use its Send button to finish.'; return; }
      clicked = true; dialog.close();
      q('.status').textContent = 'Send clicked once. Check the chat for its response. This reply has not been checked.';
    } catch (e) { q('.review-status').textContent = e.message; if (!destroyed) dialog.showModal(); }
    finally { busy = false; q('#cancel').disabled = false; /* A send attempt is never retried automatically. */ }
  };
  return { destroy() { destroyed = true; layout.disconnect(); resize.disconnect(); host.remove(); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); } };
}
