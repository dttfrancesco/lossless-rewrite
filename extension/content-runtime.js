// Reloading an extension leaves its old isolated-world scripts in open tabs.
// Chrome may throw synchronously, before sendMessage returns a Promise.
export function createContentRuntime(runtime, onInvalidated) {
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    onInvalidated();
  }
  function active() {
    if (stopped) return false;
    try { if (runtime.id) return true; } catch { /* Invalidated context. */ }
    stop();
    return false;
  }
  async function send(message) {
    if (!active()) throw new Error('Lossless was updated. Refresh this chat to reconnect.');
    try { return await runtime.sendMessage(message); }
    catch (error) {
      if (/extension context invalidated/i.test(error?.message || '') || !active()) stop();
      throw error;
    }
  }
  return { active, send };
}
