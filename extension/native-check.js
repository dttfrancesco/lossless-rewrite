import { HOST, assembler, assertCheckerOnly } from './shared.js';
// A dedicated port keeps inline checks separate from the full editor's document.
export async function nativeCheck(payload) {
  if (!await chrome.permissions.contains({ permissions: ['nativeMessaging'] })) throw new Error('Set up Jev in the Lossless sidebar to check meaning. Wording checks work without a key.');
  const port = chrome.runtime.connectNative(HOST), decode = assembler(), pending = new Map();
  const documentId = crypto.randomUUID();
  function rejectAll(error) { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); } pending.clear(); }
  port.onDisconnect.addListener(() => rejectAll(new Error(chrome.runtime.lastError?.message || 'Jev connection closed. Open Set up Jev in the sidebar.')));
  port.onMessage.addListener(part => {
    try {
      const e = decode(part); if (!e || e.documentId !== documentId || e.revision !== 0) return;
      const task = pending.get(e.requestId); if (!task || !['result','error'].includes(e.type)) return;
      pending.delete(e.requestId); clearTimeout(task.timer);
      if (e.type === 'error') task.reject(new Error(e.payload?.message || 'Check failed.')); else task.resolve(e.payload);
    } catch (error) { rejectAll(error); }
  });
  function call(operation, payload = {}) {
    return new Promise((resolve,reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Check timed out. It was not retried.')); }, 45000);
      pending.set(requestId,{resolve,reject,timer});
      try { port.postMessage({version:1,requestId,documentId,revision:0,operation,payload}); } catch (e) { clearTimeout(timer); pending.delete(requestId); reject(e); }
    });
  }
  try { assertCheckerOnly(await call('hello')); return await call('check',payload); }
  finally { rejectAll(new Error('Check closed.')); port.disconnect(); }
}
