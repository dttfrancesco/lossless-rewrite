import { contextFor, addProtection, chatScope } from './protections.js';
import { supportedPage } from './shared.js';
import { activeRules } from './writing-rules.js';

// Serial read-modify-write keeps PDF selections and chat selections from racing.
let queue = Promise.resolve();
export function protectionMessage(message, sender) {
  const task = queue.catch(() => {}).then(() => handle(message, sender)); queue = task; return task;
}
export function forgetProtectionTab(tabId) {
  const task = queue.catch(() => {}).then(async () => {
    const all = await chrome.storage.session.get(null);
    const keys = Object.keys(all).filter(key => key === `inline:${tabId}` || (key.startsWith('reader:') && (all[key]?.tabId === tabId || all[key]?.readerTabId === tabId)));
    if (keys.length) await chrome.storage.session.remove(keys);
  }); queue = task; return task;
}
async function handle(m, sender) {
  let tabId, url, binding;
  const readerURL = chrome.runtime.getURL('reference.html');
  if (sender.url?.split('?')[0] === readerURL) {
    binding = (await chrome.storage.session.get(`reader:${m.token}`))[`reader:${m.token}`];
    // Extension-page senders do not always include tab metadata. The issued
    // token in this exact extension page URL remains the reader capability.
    if (!binding || new URL(sender.url).searchParams.get('token') !== m.token || (sender.tab && binding.readerTabId !== sender.tab.id)) throw new Error('Open the PDF reader from your chat again.');
    const tab = await chrome.tabs.get(binding.tabId);
    if (!supportedPage(tab.url)) throw new Error('The linked chat changed. Open the PDF reader again from that chat.');
    if (chatScope(tab.url) !== binding.scope) {
      const key = `inline:${tab.id}`, current = contextFor((await chrome.storage.session.get(key))[key], tab.url);
      if (current.migratedFrom !== binding.scope) throw new Error('The linked chat changed. Open the PDF reader again from that chat.');
      binding = { ...binding, scope: current.scope };
      await chrome.storage.session.set({ [key]: current, [`reader:${m.token}`]: binding });
    }
    tabId = tab.id; url = tab.url;
  } else {
    if (!sender.tab?.id || sender.frameId !== 0 || !supportedPage(sender.url)) throw new Error('Open a supported chat.');
    tabId = sender.tab.id; url = sender.url;
  }
  if (!await chrome.permissions.contains({ origins: [`${new URL(url).origin}/*`] })) throw new Error('Allow this chat site in Chrome first.');
  const key = `inline:${tabId}`, previous = (await chrome.storage.session.get(key))[key];
  let context = contextFor(previous, url);
  if (m.scope && m.scope !== context.scope) throw new Error('The chat changed. Select the passage again.');
  switch (m.action) {
    case 'get': break;
    case 'import': {
      if (!binding || !Array.isArray(m.items) || m.items.length>100) throw new Error('Open a saved reference project from the PDF reader.');
      let next=context;for(const item of m.items)next=addProtection(next,item);context=next;break;
    }
    case 'add': context = addProtection(context, m.item); break;
    case 'remove': context = { ...context, items: context.items.filter(i => i.id !== m.id) }; break;
    case 'clear': context = { ...context, items: [] }; break;
    case 'arm': context = { ...context, armedAt: Date.now() }; break;
    case 'disarm': context = { ...context, armedAt: 0 }; break;
    case 'reader': {
      if (binding) throw new Error('Reader already open.');
      const token = crypto.randomUUID();
      await chrome.storage.session.set({ [`reader:${token}`]: { readerTabId: tabId, tabId, scope: context.scope, sidePanel: true } });
      try { await chrome.sidePanel.setOptions({tabId,path:`reference.html?token=${token}`,enabled:true}); } catch(error) { await chrome.storage.session.remove(`reader:${token}`);throw error; }
      break;
    }
    case 'back': if (binding) { if(binding.sidePanel)await chrome.sidePanel.setOptions({tabId,path:'panel.html',enabled:true});else await chrome.tabs.update(tabId,{active:true}); } break;
    default: throw new Error('Unknown protection action.');
  }
  await chrome.storage.session.set({ [key]: context });
  if (m.action !== 'get') await chrome.tabs.sendMessage(tabId, { kind: 'lossless', action: 'protections-changed' }).catch(() => {});
  const {writingRules}=await chrome.storage.local.get('writingRules');
  return { context:{...context,rules:activeRules(writingRules)} };
}
