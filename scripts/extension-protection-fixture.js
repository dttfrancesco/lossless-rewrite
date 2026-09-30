import {localWording} from '../extension/inline-check.js';
// Local test only: actual worker store, simulated Chrome transport and tabs.
import { protectionMessage } from '../extension/protection-store.js';
import { createRuleStore } from '../extension/rule-store.js';
const listeners = [];
const reader = location.pathname === '/reference.html';
const getStored = () => JSON.parse(localStorage.getItem('lossless-fixture') || '{}');
window.chrome = {
  runtime: {
    id: 'fixture', getURL: path => `${location.origin}/${path}`,
    onMessage: { addListener: fn => listeners.push(fn), removeListener: fn => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } },
    sendMessage: async message => {
      if(message.kind==='writing-rules-auto')return fixtureRules(message);
      if(message.kind==='inline-ui') {
        if(message.action==='highlights'){if(message.scope!=='reply')localStorage.setItem('fixture-source-highlights',String(message.enabled));if(message.scope!=='source')localStorage.setItem('fixture-reply-highlights',String(message.enabled));}
        if(message.action==='position')localStorage.setItem('fixture-position',JSON.stringify(message.position));
        if(message.action==='open-panel')document.querySelector('#simulate-panel')?.click();
        return {sourceEnabled:localStorage.getItem('fixture-source-highlights')!=='false',replyEnabled:localStorage.getItem('fixture-reply-highlights')!=='false',position:JSON.parse(localStorage.getItem('fixture-position')||'null'),panelOpen:document.querySelector('#simulate-panel')?.checked||false};
      }
      if (message.kind === 'inline-access') return { allowed: true };
      if(message.kind==='inline-check')return {items:localWording(message.items,message.reply),mode:'local'};
      if (message.kind !== 'protections') return {};
      const sender = reader ? { url: location.href, frameId: 0 } : { tab: { id: 1 }, url: 'https://chatgpt.com/c/fixture', frameId: 0 };
      try { return await protectionMessage(message, sender); } catch (e) { return { error: e.message }; }
    }
  },
  sidePanel:{setOptions:async options=>{if(options.path==='panel.html'){location.href='/chat-fixture.html';return;}const link=document.createElement('a');link.href='/'+options.path;link.textContent='Open the linked PDF reader (local test)';link.id='reader-link';document.querySelector('main').prepend(link);}},
  permissions: { contains: async () => true },
  storage: { local:{get:async()=>JSON.parse(localStorage.getItem('lossless-fixture-rules')||'{}'),set:async values=>localStorage.setItem('lossless-fixture-rules',JSON.stringify({...JSON.parse(localStorage.getItem('lossless-fixture-rules')||'{}'),...values}))},session: {
    get: async key => ({ [key]: getStored()[key] }),
    set: async items => localStorage.setItem('lossless-fixture', JSON.stringify({ ...getStored(), ...items }))
  } },
  tabs: {
    get: async () => ({ id: 1, url: 'https://chatgpt.com/c/fixture' }),
    create: async () => ({ id: 2 }),
    update: async (id, options) => { if (options.url) { const link = document.createElement('a'); link.href = options.url; link.textContent = 'Open the linked PDF reader (local test)'; link.id = 'reader-link'; document.querySelector('main').prepend(link); } else if (reader) location.href = '/chat-fixture.html'; },
    sendMessage: async (_id, message) => { if (!reader) for (const fn of listeners) fn(message, { id: 'fixture' }, () => {}); }
  }
};
const fixtureRules=createRuleStore({storage:chrome.storage.local,notify:async()=>{for(const fn of listeners)fn({kind:'lossless',action:'protections-changed'},{id:'fixture'},()=>{});}});
if (reader) { document.body.style.width='min(420px,100vw)';const banner = document.createElement('p'); banner.textContent = 'Local PDF reader test: chat transport is simulated.'; document.body.prepend(banner); }

if(!reader)document.addEventListener('DOMContentLoaded',()=>{const label=document.createElement('label');label.textContent=' Simulate sidebar open ';const input=document.createElement('input');input.type='checkbox';input.id='simulate-panel';label.prepend(input);document.querySelector('main').append(label);input.onchange=()=>{for(const fn of listeners)fn({kind:'lossless',action:'inline-ui',panelOpen:input.checked},{id:'fixture'},()=>{});};});
