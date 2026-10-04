import { clampPosition, panelPosition, dragOverlay } from './overlay-layout.js';
import { createRadialMenu, radialStyles } from './radial-menu.js';
import { createReplyChecker } from './reply-check-ui.js';
import { isSendLabel } from './inline-prompt.js';
import { sendPrepared } from './inline-send.js';
import { protectedPrompt, slashRequest } from './protections.js';
import { createReplyHighlighter } from './reply-highlights.js';
import manifest from './manifest.json';
import { isInsertShortcut, insertCommand, isSendShortcut, isRulesShortcut, shortcutLabels } from './shortcuts.js';
import { detectWritingRules, waitForSentDraft } from './rule-learning.js';

export function mountInline({ composer, value, write, visible, allowed, sendMessage, active: runtimeActive }) {
  const keys = shortcutLabels();
  const host = document.createElement('div'); host.dataset.lossless = 'toolbar';
  host.dataset.losslessVersion = manifest.version;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;display:block;position:fixed;z-index:2147483000;bottom:18px;right:20px;pointer-events:auto;font:14px/1.5 system-ui,sans-serif;color:#18181b;color-scheme:light;max-width:calc(100vw - 24px)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer;border:1px solid #d4d4d8;border-radius:6px;background:#ffffff;padding:7px 11px}button:hover{background:#f4f4f5}button:focus-visible{outline:3px solid #18181b;outline-offset:2px}.bar{background:#ffffff;border:1px solid #d4d4d8;border-radius:8px;box-shadow:0 2px 10px #0001;padding:5px;display:flex;gap:5px;align-items:center;flex-wrap:wrap}.bar button{border-color:transparent;background:transparent}.body{width:330px;max-width:100%;background:#ffffff;border:1px solid #d4d4d8;border-radius:8px;padding:16px;margin-bottom:8px;max-height:45vh;overflow:auto}.body p{margin:0 0 12px}.item{border-top:1px solid #ddd;padding:10px 0}.item p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;max-height:140px;overflow:auto;margin:6px 0}.item small{display:block;color:#52525b}.status{white-space:normal;overflow-wrap:anywhere;margin:6px 0 0;max-width:330px;background:#ffffff;padding:3px}.status:empty{display:none}.pick{flex-wrap:wrap;max-width:300px;position:fixed;background:#ffffff;padding:5px;border:1px solid #d4d4d8;border-radius:8px;box-shadow:0 3px 12px #0002;display:flex;gap:5px;z-index:2147483640}.pick button:first-child{color:#18181b}.pick button:last-child{color:#18181b}[hidden]{display:none!important}code{font:inherit;font-weight:650}button:disabled{opacity:.5;cursor:default}
  </style><div class="body" hidden><p>Select a passage in this chat or a PDF. Then type <code>/lossless</code> before your request and send normally.</p><div id="items"></div><button id="clear">Unmark all</button></div><div class="bar"><button id="kept" aria-expanded="false">Lossless · 0 kept</button><button id="pdf">Open PDF</button></div><p class="status" role="status"></p><div class="pick" hidden><span style="flex-basis:100%;font-size:12px;padding:2px 6px">Selection remembered for your next Lossless send</span><button data-type="keep_meaning">Keep meaning</button><button data-type="keep_wording">Keep wording</button><button data-type="remove" title="Omit this content from the reply. The selection is still sent as context.">Remove this</button></div>`;
  root.querySelector('style').textContent += ':host([hidden]){display:none!important}.card{width:340px;max-width:100%;background:#ffffff;border:1px solid #d4d4d8;border-radius:10px;padding:12px;box-shadow:0 3px 16px #0001}.heading{display:flex;align-items:center;gap:10px}.heading strong{flex:1}.heading button{border:0;background:transparent;padding:0 5px;font-size:20px}.card p{margin:6px 0 0}.bar{border:0;box-shadow:none;padding:6px 0 0}.bar button{padding:5px 8px}.status{padding:0;margin-top:6px}.note{font-size:13px;color:#52525b}';
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<div class="heading"><strong id="heading">Lossless</strong><button id="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button><button id="dismiss" aria-label="Dismiss Lossless">×</button></div><p id="ready" role="status"></p><p class="note" id="check-note">Exact wording is checked on your device. Sign in to check meaning.</p><div id="keys" hidden><p><strong id="insert-key"></strong><br>Add /lossless to your draft. Nothing is sent.</p><p><strong id="send-key"></strong><br>Send your chat draft with the remembered selection and marked passages. Works from the source text too.</p><p><strong id="highlight-key"></strong><br>Show or hide source and reply highlights.</p><p><strong>Shift+Enter</strong> adds a new line.<br><strong>Escape</strong> closes this popup.</p><p class="note">/lossless with normal Send still works.</p></div>';
  card.append(root.querySelector('.body'), root.querySelector('.bar'), root.querySelector('.status')); root.append(card);
  root.querySelector('style').textContent += radialStyles + `
    :host{right:auto;bottom:auto;width:44px;height:44px;max-width:calc(100vw - 24px)}
    .card{position:fixed;right:auto;bottom:auto;width:min(340px,calc(100vw - 16px));max-width:none;max-height:calc(100vh - 24px);overflow:auto;overflow-wrap:anywhere}.body{width:100%;max-width:none;padding:10px 0;border:0;max-height:none;overflow:visible}.heading{cursor:default}
    .toast{position:fixed;right:auto;bottom:auto;width:min(280px,calc(100vw - 30px));padding:10px 13px;border:1px solid #dce1dc;background:#fff;border-radius:9px;box-shadow:0 3px 14px #0001;font-size:13px}
    .pick button{font-weight:600}.pick button[data-type=keep_wording]{background:#fff0ce;color:#684500;border-color:#dfbf79}.pick button[data-type=keep_meaning]{background:#e3f3e9;color:#20583d;border-color:#a5cbb4}.pick button[data-type=remove]{background:#fbe0df;color:#8b2620;border-color:#dda8a4}.item[data-type=remove]{border-left:3px solid #c16b63;padding-left:10px}.pick>span{display:none}.item[data-type=keep_wording]{border-left:3px solid #d3a140;padding-left:10px}.item[data-type=keep_meaning]{border-left:3px solid #5eac81;padding-left:10px}
    .legend{font-size:12px;line-height:1.6;color:#52525b}.legend span{display:inline-block;margin:2px 4px 0 0;padding:1px 5px;border-radius:3px}.legend .wording{background:#ffe4a6;color:#4b3100}.legend .meaning{background:#c5ead5;color:#174b33}.legend .other{background:#e1edff;color:#173c68}.check-results summary{cursor:pointer}.check-results p{font-size:13px}.check-summary{font-weight:600}
    .wheel:before{content:none}.orb{z-index:1}.card .bar{gap:8px;padding-top:10px}.card .bar button{border:1px solid #bdc5bf;border-radius:7px;background:#fff;padding:8px 10px;font-weight:600;box-shadow:0 1px 2px #0001}.card .bar button:hover{border-color:#738378;background:#f0f4f1}.card .bar button[aria-expanded=true]{background:#f0f4f1;border-color:#899a8f}.card #show-kept[aria-pressed=true]{background:#e3f3e9;color:#20583d;border-color:#8fbaa0}
  `;
  host.hidden = true; document.documentElement.append(host);
  const q = s => root.querySelector(s);
  q('#insert-key').textContent = keys.insert; q('#send-key').textContent = keys.send; q('#highlight-key').textContent = keys.highlight;
  const rulesHelp=document.createElement('p'),rulesKey=document.createElement('strong');rulesKey.textContent=keys.rules;rulesHelp.append(rulesKey,document.createElement('br'),'Open Writing rules.');q('#keys').append(rulesHelp);
  const show = document.createElement('button'); show.id = 'show-kept'; show.textContent = 'Show kept text'; show.title = `Toggle source and reply highlights (${keys.highlight})`; q('.bar').append(show);
  q('.body > p').textContent = 'Selected passages';
  const legend=document.createElement('p');legend.className='legend';legend.innerHTML='<span class="wording">Keep wording</span><span class="meaning">Keep meaning</span><span style="background:#fbe0df;color:#8b2620">Remove this</span><span class="other">Other wording</span><br>Colours show text matches. Meaning is checked separately.';card.append(legend);
  const toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');toast.hidden=true;root.append(toast);
  let quietNote='', quietTone='', panelOpen=false, hiddenByUser=false, overlayPosition={x:innerWidth-66,y:innerHeight-66};
  const highlighter = createReplyHighlighter(() => schedule());
  const radial=createRadialMenu(root,{
    highlights:()=>{closeOptions();opened=true;highlightOptions.hidden=false;schedule();},
    selections:()=>{closeOptions();opened=true;q('.body').hidden=false;q('#kept').setAttribute('aria-expanded','true');refresh();schedule();},
    check:()=>quickCheck(), rules:()=>openRules(), pdf:()=>openPDF(),
    sidebar:()=>{sendMessage({kind:'inline-ui',action:'open-panel'}).then(r=>{if(r?.error)status(r.error);},e=>status(e.message));},
    close:()=>dismiss(false),hide:()=>{hiddenByUser=true;dismiss(false);schedule();}
  });
  const stopDragging=dragOverlay(radial.orb,{getPosition:()=>radial.position||overlayPosition,move:point=>{overlayPosition=clampPosition(point,innerWidth,innerHeight);radial.collapse();schedule();},save:point=>sendMessage({kind:'inline-ui',action:'position',position:point}).catch(()=>{})});
  let message = '', noticeTimer, dismissedDraft, opened = false;
  const status = (text, duration = 8000) => {
    if (destroyed) return;
    message = text; q('.status').textContent = ''; toast.textContent=text; clearTimeout(noticeTimer);
    if (text && duration) noticeTimer = setTimeout(() => { message = ''; toast.textContent = ''; schedule(); }, duration);
    schedule();
  };
  const checker = createReplyChecker({card,composer,value,write,visible,status,sendMessage,active:runtimeActive,open:()=>schedule(),notify:(note,tone)=>{quietNote=note;quietTone=tone;schedule();},onReady:items=>highlighter.reply(items),getContext:()=>context});
  let context = { items: [] }, selection, busy = false, bypass = false, destroyed = false, lastURL = location.href, frame;
  const highlightOptions=document.createElement('div');highlightOptions.className='bar';highlightOptions.hidden=true;
  for(const scope of ['source','reply']){const button=document.createElement('button');button.dataset.highlightScope=scope;button.textContent=scope==='source'?'Source highlights':'Reply highlights';button.onclick=()=>highlight(scope);highlightOptions.append(button);}card.append(highlightOptions);
  const checkButton=document.createElement('button');checkButton.textContent='Check reply';checkButton.title='Check selections and writing rules against the latest finished reply';checkButton.onclick=()=>quickCheck();q('.bar').append(checkButton);
  function openRules(){sendMessage({kind:'inline-ui',action:'open-rules'}).then(result=>{if(result?.error)status(result.error);},e=>status(e.message));}
  async function quickCheck(){
    if(busy)return;
    try{context=await request('get');if(destroyed)return;closeOptions();opened=true;schedule();await checker.checkNow();}catch(e){status(e.message);}
  }
  function sentEvidence() {
    // Only user-authored turns, never assistant text that happens to echo a rule.
    const selector='[data-user-message-bubble="true"], [data-message-author-role="user"], [data-testid="user-message"], user-query .query-text';
    const normalize=text=>text.replace(/\s+/g,' ').trim();
    const before=[...document.querySelectorAll(selector)].map(el=>normalize(el.innerText||''));
    const url=location.href;
    return expected=>{
      const previous=new URL(url),current=new URL(location.href);
      if(previous.origin!==current.origin || previous.pathname!==current.pathname && !['/','/new','/app'].includes(previous.pathname))return false;
      const needle=normalize(expected),after=[...document.querySelectorAll(selector)].map(el=>normalize(el.innerText||''));
      return after.filter(text=>text===needle).length>before.filter(text=>text===needle).length;
    };
  }
  const learning = new WeakSet();
  async function learnFromSend(snapshot, sentText=snapshot.text) {
    if (!detectWritingRules(snapshot.text).length || learning.has(snapshot.el)) return false;
    learning.add(snapshot.el);
    try {
      if (!await waitForSentDraft({snapshot:{...snapshot,text:sentText},composer,value,url:()=>location.href,active:()=>!destroyed&&runtimeActive(),sent:snapshot.sent})) return false;
      const result=await sendMessage({kind:'writing-rules-auto',action:'learn',draft:snapshot.text});
      if (destroyed || !result?.added?.length) return false;
      status(`Remembered: ${result.added.join(' ')}`,12000);
      const undo=document.createElement('button');undo.textContent='Undo';undo.style.marginLeft='8px';
      undo.onclick=async()=>{
        undo.disabled=true;
        try { const response=await sendMessage({kind:'writing-rules-auto',action:'undo',token:result.undo});status(response?.error||'Writing rule removed.'); }
        catch(e){status(e.message);}
      };
      toast.append(undo);
      return true;
    } catch { return false; }
    finally { learning.delete(snapshot.el); }
  }
  async function request(action, args = {}) {
    const result = await sendMessage({ kind: 'protections', action, ...args });
    if (destroyed) throw new Error('Refresh this chat to reconnect Lossless.');
    if (result?.error) throw new Error(result.error);
    if (!result?.context) throw new Error('Reload the extension and refresh this chat.');
    if (['add', 'remove', 'clear'].includes(action)) { highlighter.clear(); checker.reset(); }
    return result.context;
  }
  async function highlight(scope='all') {
    try { const message = highlighter.toggle(scope); const enabled=scope==='source'?highlighter.sourceEnabled:scope==='reply'?highlighter.replyEnabled:highlighter.active;const result=await sendMessage({kind:'inline-ui',action:'highlights',scope,enabled});if(result?.error)throw new Error(result.error);draw();return {message}; }
    catch (e) { status(e.message, 12000); return { error: e.message }; }
  }
  show.onclick = ()=>{closeOptions();highlightOptions.hidden=false;opened=true;schedule();};
  function draw() {
    highlighter.sync(context.items);
    q('.body > p').textContent=context.items.length?'Selected passages':'Highlight text in your chat, then choose Keep meaning, Keep wording or Remove this. For a reference document, choose Open PDF below.';
    q('#kept').textContent = `Selections (${context.items.length})`;
    q('#clear').hidden = !context.items.length; q('#items').replaceChildren();
    for (const item of context.items) {
      const box = document.createElement('div'); box.className = 'item'; box.dataset.type=item.type;
      const label = document.createElement('small'); label.textContent = `${item.type === 'remove' ? 'Remove this' : item.type === 'keep_wording' ? 'Keep wording' : 'Keep meaning'} · ${item.source.label}${item.source.page ? ` · p. ${item.source.page}` : ''}`;
      const text = document.createElement('p'); text.textContent = item.text;
      const remove = document.createElement('button'); remove.textContent = 'Unmark';
      remove.onclick = async () => { try { context = await request('remove', { id: item.id, scope: context.scope }); draw(); } catch (e) { status(e.message); } };
      box.append(label, text, remove); q('#items').append(box);
    }
    schedule();
  }
  async function refresh() { try { const next = await request('get'); if (JSON.stringify([next.items,next.rules]) !== JSON.stringify([context.items,context.rules])) { highlighter.clear(); checker.reset(); } context = next; if (!destroyed) draw(); } catch (e) { const el = composer(); if (!destroyed && (opened || (el && slashRequest(value(el)) !== null))) status(e.message); } }
  function position() {
    frame = undefined;
    if (destroyed || !runtimeActive()) return;
    highlighter.reconcile();
    if (location.href !== lastURL) { checker.navigate(lastURL,location.href); lastURL = location.href; highlighter.reset(); quietNote='';quietTone=''; selection = undefined; opened = false; dismissedDraft = undefined; q('.pick').hidden = true; closeOptions(); status(''); refresh(); }
    const el = composer(), draft = el ? value(el) : '', command = slashRequest(draft);
    const active = command !== null && dismissedDraft !== draft;
    card.hidden = !opened; toast.hidden = !message || (opened && !toast.querySelector('button'));
    overlayPosition=clampPosition(overlayPosition,innerWidth,innerHeight);host.style.left=`${overlayPosition.x}px`;host.style.top=`${overlayPosition.y}px`;radial.layout(overlayPosition,innerWidth,innerHeight);
    for(const surface of [card,toast]){const r=surface.getBoundingClientRect();const p=panelPosition(overlayPosition,innerWidth,innerHeight,r.width,r.height);surface.style.left=`${p.x}px`;surface.style.top=`${p.y}px`;}
    toast.hidden = !message || (opened && !toast.querySelector('button'));
    if(opened && !toast.querySelector('button')){q('.status').textContent=message;}else q('.status').textContent='';
    radial.hide(opened || hiddenByUser || panelOpen && !opened && !message && q('.pick').hidden);
    radial.update({count:context.items.length,sourceEnabled:highlighter.sourceEnabled,replyEnabled:highlighter.replyEnabled,note:quietNote,tone:quietTone});
    host.hidden = (panelOpen || hiddenByUser) && card.hidden && !message && q('.pick').hidden;
    q('#heading').textContent = busy ? 'Preparing request…' : active ? 'Lossless request' : !q('.body').hidden ? context.items.length?'Selections':'Choose your source' : 'Lossless';
    q('#ready').hidden = Boolean(message || busy || !q('#keys').hidden || !q('.body').hidden);
    q('#ready').textContent = selection ? `Selection remembered. Write your request, then press ${keys.send}.` : !context.items.length && !context.rules?.length ? 'Select text in the chat. Lossless remembers it when you move to the chat box.' : command === '' ? 'Add an instruction, e.g. “Shorten this to 150 words.”' : active ? `Ready: ${context.items.length} passage${context.items.length === 1 ? '' : 's'} marked. Use the chat’s Send button.` : `Write your request, then press ${keys.send}. No /lossless needed.`;
    q('#check-note').hidden = Boolean(message || busy || !q('#keys').hidden || !q('.body').hidden);
    q('.bar').hidden = Boolean(message && !active && !opened && !highlighter.active);
    show.textContent = 'Highlights';for(const button of highlightOptions.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.highlightScope==='source'?highlighter.sourceEnabled:highlighter.replyEnabled));

  }
  const schedule = () => { if (!destroyed && !frame) frame = requestAnimationFrame(position); };
  const layout = new MutationObserver(schedule); layout.observe(document.body, { childList: true, subtree: true });
  const resize = new ResizeObserver(schedule); resize.observe(host);
  window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
  const input = e => { if (!e.composedPath().includes(host)) { status(''); schedule(); } };
  document.addEventListener('input', input);
  function dismiss(clearSelection = true) { const el = composer(); dismissedDraft = el ? value(el) : ''; opened = false; radial.collapse(); if (clearSelection) selection = undefined; closeOptions(); q('.pick').hidden = true; status(''); }
  q('#dismiss').onclick = dismiss;
  function closeOptions() { highlightOptions.hidden=true; q('.body').hidden = true; q('#keys').hidden = true; q('#kept').setAttribute('aria-expanded', 'false'); }
  q('#help').onclick = () => { const showHelp = q('#keys').hidden; closeOptions(); q('#keys').hidden = !showHelp; opened = true; schedule(); };
  q('#kept').onclick = () => { q('#keys').hidden = true; q('.body').hidden = !q('.body').hidden; q('#kept').setAttribute('aria-expanded', String(!q('.body').hidden)); refresh(); };
  q('#clear').onclick = async () => { try { selection = undefined; context = await request('clear', { scope: context.scope }); draw(); } catch (e) { status(e.message); } };
  function openPDF(){return request('reader').then(()=>dismiss(false)).catch(e=>status(e.message));}
  q('#pdf').onclick = openPDF;
  function captureSelection(e) {
    if (busy || e.key === 'Escape') return;
    if (e.composedPath().includes(host)) return;
    const focused = document.activeElement, selected = getSelection();
    const editor = composer();
    // Selecting or typing a request must not replace the remembered source passage.
    if (editor && (focused === editor || editor.contains(focused) || editor.contains(selected?.anchorNode))) { q('.pick').hidden = true; schedule(); return; }
    let text = '', rect;
    if (focused instanceof HTMLTextAreaElement && focused.selectionEnd > focused.selectionStart) { text = focused.value.slice(focused.selectionStart, focused.selectionEnd); rect = focused.getBoundingClientRect(); }
    else if (selected?.rangeCount && selected.toString().trim()) { text = selected.toString(); rect = selected.getRangeAt(0).getBoundingClientRect(); }
    if (!text.trim() || !rect) { q('.pick').hidden = true; schedule(); return; }
    if (text.length > 12000) { selection = undefined; q('.pick').hidden = true; status('Select up to 12,000 characters at a time.'); return; }
    selection = { text, range: selected?.rangeCount ? selected.getRangeAt(0).cloneRange() : undefined, url: location.href, scope: context.scope };
    q('.pick').style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 265))}px`;
    q('.pick').style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - 84))}px`;
    q('.pick').hidden = false; schedule();
  }
  q('.pick').addEventListener('pointerdown', e => e.preventDefault());
  for (const button of root.querySelectorAll('[data-type]')) button.onclick = async () => {
    try {
      if (!selection || selection.url !== location.href) throw new Error('Select the passage again in this chat.');
      context = await request('add', { scope: selection.scope, item: { type: button.dataset.type, text: selection.text, source: { kind: 'chat', label: 'Chat passage' } } });
      const saved=context.items.find(i=>i.type===button.dataset.type && i.text===selection.text);if(saved)highlighter.remember(saved,selection.range);
      draw(); selection = undefined; q('.pick').hidden = true; getSelection()?.removeAllRanges();
      const el = composer();
      if (el) el.focus();
      quietNote='';quietTone='';status('');radial.collapse();opened=false;schedule();
    } catch (e) { status(e.message); }
  };
  const outside = e => { if (!e.composedPath().includes(host)) dismiss(false); };
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
    busy = true; quietNote='Preparing request';quietTone='';dismissedDraft = undefined;closeOptions();q('.pick').hidden=true;radial.collapse();opened=false;status('');
    try {
      context = await request('get');
      if (destroyed || location.href !== snapshot.url) throw new Error('The chat changed. Nothing was sent.');
      // Treat the last selection like a private, per-chat clipboard. Commit it
      // only on an explicit Lossless send; normal messages never use it.
      if (selection?.url === snapshot.url && (!selection.scope || selection.scope === context.scope)) {
        if (!context.items.some(item => item.text === selection.text && item.source.kind === 'chat')) {
          context = await request('add', { scope: context.scope, item: { type: 'keep_meaning', text: selection.text, source: { kind: 'chat', label: 'Chat passage' } } });
        }
        const saved=context.items.find(i=>i.text===selection.text);if(saved)highlighter.remember(saved,selection.range);selection=undefined;draw();
      }
      if (!(slashRequest(snapshot.text) ?? snapshot.text).trim()) {
        snapshot.el.focus();
        status(`Write what you want AI to do in the chat box, e.g. “Shorten this to 150 words.” Then press ${keys.send}. Your selections are saved.`, 0);
        return;
      }
      const prepared = protectedPrompt(snapshot.text, context.items, { direct, rules:context.rules });
      const baseline = checker.text();
      await request('arm', { scope: context.scope });
      const outcome = await sendPrepared({ snapshot, prepared, adapter: {
        allowed: async () => !destroyed && await allowed(), url: () => location.href, composer, value, write,
        sendButton: el => { const button = sendButton(el); return button && { click() { bypass = true; try { button.click(); } finally { bypass = false; } } }; }
      } });
      if (outcome === 'clicked') {
        if(await learnFromSend(snapshot,prepared))context=await request('get');
        checker.watch(baseline, context.items, context.rules);
      }
      quietNote=outcome==='clicked'?'Waiting for reply':''; if(outcome!=='clicked')status('Selections added, but not sent. Use the chat’s Send button to finish.');
    } catch (e) { await request('disarm').catch(() => {}); status(e.message); }
    finally { busy = false; schedule(); }
  }
  function intercept(e) {
    if (bypass || destroyed || e.defaultPrevented || !runtimeActive()) return;
    if(e.type==='keydown' && isRulesShortcut(e)) {
      e.preventDefault();e.stopImmediatePropagation();
      openRules();return;
    }
    const el = composer(); if (!el) return;
    const path = e.composedPath(); if (path.includes(host)) return;
    if (e.type === 'keydown' && isInsertShortcut(e) && !e.isComposing && path.includes(el)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!busy && !e.repeat) {
        try { insertCommand(el, { value, write }); dismissedDraft = undefined; status('/lossless added. Finish your request, then send normally. Nothing sent yet.'); }
        catch (error) { status(error.message); }
      }
      return;
    }
    const shortcut = e.type === 'keydown' && isSendShortcut(e);
    if (e.type === 'keydown' && (e.key !== 'Enter' || (!shortcut && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) || e.isComposing || (!shortcut && !path.includes(el)))) return;
    // Do not hijack a shortcut in another editor or a site dialog.
    if (shortcut && !path.includes(el) && path.some(node => node instanceof Element && node.matches('input,textarea,[contenteditable="true"],[role="dialog"],dialog'))) return;
    if (e.type === 'click' && !path.includes(sendButton(el))) return;
    if (e.type === 'submit' && e.target !== el.closest('form')) return;
    if (!busy && !shortcut && slashRequest(value(el)) === null) {
      const snapshot={el,text:value(el),url:location.href,sent:sentEvidence()};
      selection = undefined; highlighter.clear(); checker.reset(); status('');
      if(e.isTrusted)void learnFromSend(snapshot);
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (!busy && !e.repeat) send({ el, text: value(el), url: location.href, sent:sentEvidence() }, shortcut);
  }
  for (const event of ['keydown', 'click', 'submit']) window.addEventListener(event, intercept, true);
  function uiState(state) {
    if(typeof state?.panelOpen==='boolean')panelOpen=state.panelOpen;
    if(typeof state?.sourceEnabled==='boolean')highlighter.setEnabled(state.sourceEnabled,'source');
    if(typeof state?.replyEnabled==='boolean')highlighter.setEnabled(state.replyEnabled,'reply');
    if(state?.position && Number.isFinite(state.position.x) && Number.isFinite(state.position.y))overlayPosition=clampPosition(state.position,innerWidth,innerHeight);
    schedule();
  }
  sendMessage({kind:'inline-ui',action:'get'}).then(uiState).catch(()=>{});
  refresh(); position();
  return { refresh, highlight, uiState, open() { hiddenByUser=false; opened = true; dismissedDraft = undefined; refresh(); schedule(); }, destroy() { destroyed = true; stopDragging(); checker.reset(); highlighter.reset(); clearTimeout(noticeTimer); cancelAnimationFrame(frame); layout.disconnect(); resize.disconnect(); host.remove(); document.removeEventListener('input', input); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); document.removeEventListener('mouseup', captureSelection); document.removeEventListener('keyup', captureSelection); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); for (const event of ['keydown', 'click', 'submit']) window.removeEventListener(event, intercept, true); } };
}
