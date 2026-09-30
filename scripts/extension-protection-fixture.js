// Local test only: actual worker store, simulated Chrome transport and tabs.
import { protectionMessage } from '../extension/protection-store.js';
const listeners = [];
const reader = location.pathname === '/reference.html';
const getStored = () => JSON.parse(localStorage.getItem('lossless-fixture') || '{}');
window.chrome = {
  runtime: {
    id: 'fixture', getURL: path => `${location.origin}/${path}`,
    onMessage: { addListener: fn => listeners.push(fn), removeListener: fn => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } },
    sendMessage: async message => {
      if (message.kind === 'inline-access') return { allowed: true };
      if (message.kind !== 'protections') return {};
      const sender = reader ? { tab: { id: 2 }, url: location.href, frameId: 0 } : { tab: { id: 1 }, url: 'https://chatgpt.com/c/fixture', frameId: 0 };
      try { return await protectionMessage(message, sender); } catch (e) { return { error: e.message }; }
    }
  },
  permissions: { contains: async () => true },
  storage: { session: {
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
if (reader) { const banner = document.createElement('p'); banner.textContent = 'Local PDF reader test: chat transport is simulated.'; document.body.prepend(banner); }
