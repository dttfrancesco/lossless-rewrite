export function isSendShortcut(event) {
  return Boolean(event.key === 'Enter' && event.shiftKey && !event.altKey && Boolean(event.ctrlKey) !== Boolean(event.metaKey));
}
export function shortcutLabels(platform = globalThis.navigator?.platform || '') {
  const mac = /Mac|iPhone|iPad/.test(platform);
  return { send: `${mac ? '⌘' : 'Ctrl'}+Shift+Enter`, highlight: `${mac ? 'Option' : 'Alt'}+Shift+H` };
}
