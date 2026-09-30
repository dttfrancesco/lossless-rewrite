import { cloudCall, session } from './cloud.js';
import { HOST, OPERATIONS, supportedPage, assembler } from "./shared.js";
import { SITES } from "./sites.js";
import { protectionMessage, forgetProtectionTab } from "./protection-store.js";
import { checkPayload, checkedItems, localWording } from './inline-check.js';
import { nativeCheck } from './native-check.js';
import {checkItems} from './writing-rules.js';
import {createRuleStore} from './rule-store.js';
const ruleStore=createRuleStore({storage:chrome.storage.local,notify:async()=>{
  for(const tab of await chrome.tabs.query({}))await chrome.tabs.sendMessage(tab.id,{kind:'lossless',action:'protections-changed'}).catch(()=>{});
}});
const inlineRuns = new Map();
const panels = new Set();
const panelWindows = new Map();
const pendingRulesWindows = new Set();
function openPendingRules(windowId) {
  if(!pendingRulesWindows.has(windowId))return;
  for(const [port,state] of panelWindows) {
    if(state.windowId!==windowId || !state.visible || !trustedPanel(port.sender))continue;
    try {port.postMessage({kind:'open-writing-rules'});pendingRulesWindows.delete(windowId);return;} catch {panelWindows.delete(port);}
  }
}
function panelVisible(windowId) { return [...panelWindows.values()].some(p=>p.windowId===windowId && p.visible); }
async function sendInlineUI(windowId,extra={}) {
  for(const tab of await chrome.tabs.query(windowId===undefined?{}:{windowId})) {
    await chrome.tabs.sendMessage(tab.id,{kind:'lossless',action:'inline-ui',panelOpen:panelVisible(tab.windowId),...extra}).catch(()=>{});
  }
}
let native;
const requests = new Map();
const decode = assembler();
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.tabs.onRemoved.addListener(tabId => forgetProtectionTab(tabId).catch(() => {}));
let siteSync = Promise.resolve();
function syncSites() {
  siteSync = siteSync.catch(() => {}).then(async () => {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    for (const site of SITES) {
      const origin = `https://${site.host}/*`, id = `lossless-${site.id}`;
      const enabled = await chrome.permissions.contains({ origins: [origin] });
      const exists = registered.some(s => s.id === id);
      if (enabled && !exists) await chrome.scripting.registerContentScripts([{ id, matches: [origin], js: ["content.js"], runAt: "document_idle", persistAcrossSessions: true }]);
      if (!enabled && exists) await chrome.scripting.unregisterContentScripts({ ids: [id] });
    }
  });
  return siteSync;
}
syncSites().catch(() => {});
chrome.permissions.onAdded.addListener(() => syncSites().catch(() => {}));
chrome.permissions.onRemoved.addListener(async permission => {
  await syncSites().catch(() => {});
  // Unregistering alone leaves injected scripts alive. Explicitly dispose them too.
  if (!permission.origins?.length) return;
  for (const tab of await chrome.tabs.query({})) {
    // Tab URLs may no longer be readable after revocation. Each existing script
    // asks the worker about its own trusted sender origin before staying active.
    await chrome.tabs.sendMessage(tab.id, { kind: "lossless", action: "access-changed" }).catch(() => {});
  }
});
function broadcast(message) { for (const port of panels) { try { port.postMessage(message); } catch { panels.delete(port); } } }
function connect() {
  if (native) return native;
  native = chrome.runtime.connectNative(HOST);
  native.onMessage.addListener((part) => {
    try {
      const envelope = decode(part); if (!envelope) return;
      const request = requests.get(envelope.requestId);
      if (!request || envelope.version !== 1 || envelope.documentId !== request.documentId || envelope.revision !== request.revision) return;
      broadcast({ kind: "native", envelope });
      if (["result", "error"].includes(envelope.type)) requests.delete(envelope.requestId);
    } catch (e) { broadcast({ kind: "connection", error: e.message }); native?.disconnect(); native = null; }
  });
  native.onDisconnect.addListener(() => { const error = chrome.runtime.lastError?.message || "Companion disconnected. The current request may have finished; it was not restarted."; native = null; requests.clear(); broadcast({ kind: "connection", error }); });
  return native;
}
function trustedPanel(sender) { return sender.id === chrome.runtime.id && sender.url?.split("?")[0] === chrome.runtime.getURL("panel.html"); }
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "lossless-panel" || !(trustedPanel(port.sender) || (port.sender.id===chrome.runtime.id && port.sender.url?.split("?")[0]===chrome.runtime.getURL("reference.html")))) return port.disconnect();
  panels.add(port); port.onDisconnect.addListener(() => { const state=panelWindows.get(port);panels.delete(port);panelWindows.delete(port);if(state)sendInlineUI(state.windowId).catch(()=>{}); });
  port.onMessage.addListener((message) => {
    if(message.kind==='panel-presence' && Number.isInteger(message.windowId)) {
      panelWindows.set(port,{windowId:message.windowId,visible:message.visible===true});sendInlineUI(message.windowId).catch(()=>{});openPendingRules(message.windowId);return;
    }
    if (!trustedPanel(port.sender) || message.kind !== "native" || !message.envelope || !OPERATIONS.has(message.envelope.operation)) return;
    const e = message.envelope;
    if (e.version !== 1 || typeof e.requestId !== "string" || typeof e.documentId !== "string" || !Number.isSafeInteger(e.revision) || new TextEncoder().encode(JSON.stringify(e)).length > 4 * 1024 * 1024) {
      port.postMessage({ kind: "native", envelope: { ...e, type: "error", payload: { message: "Request is invalid or too large. Reduce overlapping marks or source length." } } }); return;
    }
    requests.set(e.requestId, { documentId: e.documentId, revision: e.revision });
    try { connect().postMessage(e); } catch (error) { requests.delete(e.requestId); broadcast({ kind: "connection", error: error.message }); }
  });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(message.kind==='writing-rules' && trustedPanel(sender)) {
    if(!['get','save'].includes(message.action))return respond({error:'Unknown writing rules action.'});
    ruleStore(message).then(respond,e=>respond({error:e.message}));return true;
  }
  if(message.kind==='writing-rules-auto' && sender.id===chrome.runtime.id && sender.tab && sender.frameId===0 && supportedPage(sender.url)) {
    (async()=>{
      if(!['learn','undo'].includes(message.action))throw new Error('Unknown writing rules action.');
      if(!await chrome.permissions.contains({origins:[`${new URL(sender.url).origin}/*`]}))throw new Error('Site access was removed.');
      return ruleStore(message);
    })().then(respond,e=>respond({error:e.message}));return true;
  }
  if(message.kind==='inline-ui' && sender.id===chrome.runtime.id && sender.tab && sender.frameId===0 && supportedPage(sender.url)) {
    if(message.action==='open-rules') {
      const windowId=sender.tab.windowId;pendingRulesWindows.add(windowId);
      // Start open() on the keyboard gesture, before awaiting any other API.
      chrome.sidePanel.open({tabId:sender.tab.id}).then(async()=>{
        await chrome.sidePanel.setOptions({tabId:sender.tab.id,path:'panel.html',enabled:true});
        openPendingRules(windowId);respond({opened:true});
      },e=>{pendingRulesWindows.delete(windowId);respond({error:e.message});}).catch(e=>{pendingRulesWindows.delete(windowId);respond({error:e.message});});return true;
    }
    // Keep open() synchronous with the user's click; do not await storage first.
    if(message.action==='open-panel') { chrome.sidePanel.open({tabId:sender.tab.id}).then(()=>respond({opened:true}),e=>respond({error:e.message}));return true; }
    (async()=>{
      if(message.action==='highlights') {
        if(typeof message.enabled!=='boolean')throw new Error('Invalid highlight preference.');
        const scope=message.scope||'all';if(!['all','source','reply'].includes(scope))throw new Error('Invalid highlight scope.');
        const update={};if(scope!=='reply')update.inlineSourceHighlights=message.enabled;if(scope!=='source')update.inlineReplyHighlights=message.enabled;
        await chrome.storage.local.set(update);
        await sendInlineUI(undefined,{...(scope!=='reply'?{sourceEnabled:message.enabled}:{}),...(scope!=='source'?{replyEnabled:message.enabled}:{})});
      }else if(message.action==='position') {
        const p=message.position;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>20000||p.y>20000)throw new Error('Invalid overlay position.');
        await chrome.storage.local.set({inlinePosition:{x:p.x,y:p.y}});
      }else if(message.action!=='get')throw new Error('Unknown control.');
      const prefs=await chrome.storage.local.get(['inlineHighlights','inlineSourceHighlights','inlineReplyHighlights','inlinePosition']);const sourceEnabled=prefs.inlineSourceHighlights??prefs.inlineHighlights!==false,replyEnabled=prefs.inlineReplyHighlights??prefs.inlineHighlights!==false;return {enabled:sourceEnabled||replyEnabled,sourceEnabled,replyEnabled,position:prefs.inlinePosition,panelOpen:panelVisible(sender.tab.windowId)};
    })().then(respond,e=>respond({error:e.message}));return true;
  }
  if (message.kind === 'inline-check' && sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0 && supportedPage(sender.url)) {
    (async () => {
      const { context } = await protectionMessage({ action: 'get' }, sender);
      if (context.scope !== message.scope || JSON.stringify(context.items) !== JSON.stringify(message.items)) throw new Error('Selections changed. Check the current reply again.');
      if(JSON.stringify(context.rules||[])!==JSON.stringify(message.rules||[]))throw new Error('Writing rules changed. Send again with the current rules.');
      const items=checkItems(context.items,context.rules);
      if(!items.length||typeof message.reply!=='string'||!message.reply.trim()||message.reply.length>100000)throw new Error('Choose passages or writing rules and a complete reply first.');
      if (!items.some(i => i.type !== 'keep_wording')) return { items: localWording(items, message.reply), mode: 'local' };
      if (await session()) {
        const account=await cloudCall({action:'account'});
        if(message.automatic && account.plan==='free')return {manual:true};
        const data={reply:message.reply,items:items.map(({type,text})=>({type,text}))};
        const quote=await cloudCall({action:'quote',...data});
        if(quote.credits>1&&message.acceptedCredits!==quote.credits)return {quote:quote.credits};
        const result=await cloudCall({action:'check',...data,acceptedCredits:quote.credits,requestId:crypto.randomUUID()});
        if(!Array.isArray(result.items)||result.items.length!==items.length)throw new Error('The checker did not cover every passage and rule.');
        return {...result,items:result.items.map((item,i)=>({...items[i],status:item.status}))};
      }
      if(context.rules?.length)throw new Error('Sign in through Account to check writing rules. They were included in your prompt, but have not been checked.');
      const payload=checkPayload(context.items,message.reply);
      if (!(await chrome.storage.local.get('autoCheckConsent')).autoCheckConsent) throw new Error('Sign in through Account to check meaning, or set up your own Jev connection.');
      if (inlineRuns.has(sender.tab.id)) throw new Error('A check is already running for this chat.');
      inlineRuns.set(sender.tab.id, true);
      try { const result = await nativeCheck(payload); return { items: checkedItems(context.items, result), mode: 'jev', inputTokens: result.final.verification.decisionTokens }; }
      finally { inlineRuns.delete(sender.tab.id); }
    })().then(respond, e => respond({error:e.message})); return true;
  }
  if (message.kind === 'protections' && sender.id === chrome.runtime.id) {
    if(message.action==='reader' && sender.tab && sender.frameId===0 && supportedPage(sender.url)) {
      // Open on the click's user gesture. Then switch its content to the bound reader.
      chrome.sidePanel.open({tabId:sender.tab.id}).then(()=>protectionMessage(message,sender)).then(respond,error=>respond({error:error.message}));return true;
    }
    protectionMessage(message, sender).then(respond, error => respond({ error: error.message })); return true;
  }
  if (message.kind === "inline-access" && sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0 && supportedPage(sender.url)) {
    chrome.permissions.contains({ origins: [`${new URL(sender.url).origin}/*`] }).then(allowed => respond({ allowed }), () => respond({ allowed: false })); return true;
  }
  if (message.kind === "page-changed" && sender.id === chrome.runtime.id && sender.tab && supportedPage(sender.url)) {
    broadcast({ kind: "page-changed", tabId: sender.tab.id, ids: Array.isArray(message.ids) ? message.ids.filter((id) => typeof id === "string").slice(0, 100) : [], navigation: Boolean(message.navigation) }); return;
  }
  if (!trustedPanel(sender) || message.kind !== "page") return;
  (async () => {
    let tab;
    if (message.tabId) tab = await chrome.tabs.get(message.tabId);
    else [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !supportedPage(tab.url)) throw new Error("Open ChatGPT, Claude, Gemini, Grok or DeepSeek. You can also copy and paste text from any app.");
    const origin = `${new URL(tab.url).origin}/*`;
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error("Enable this site first using the site access buttons.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    if (!["list", "selection", "capture", "composer", "stage", "reveal", "activate", "inline-options", "highlight-reply"].includes(message.action)) throw new Error("Unknown page action");
    const result = await chrome.tabs.sendMessage(tab.id, { kind: "lossless", action: message.action, id: message.id, text: message.text, mode: message.mode, expected: message.expected });
    return { ...result, tabId: tab.id };
  })().then(respond, (error) => respond({ error: error.message }));
  return true;
});
