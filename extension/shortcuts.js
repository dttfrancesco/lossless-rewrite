import { slashRequest } from './protections.js';

export function isInsertShortcut(event) {
  return Boolean(event.code === 'KeyL' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey);
}
export function commandDraft(draft) {
  return slashRequest(draft) === null ? `/lossless ${draft}` : draft;
}
// Insertion is synchronous and never invokes Send. Repeated presses are harmless.
export function insertCommand(el, { value, write }) {
  const before = value(el), after = commandDraft(before);
  if (after !== before) write(el, after);
}
export function isSendShortcut(event) {
  return Boolean(event.key === 'Enter' && event.shiftKey && !event.altKey && Boolean(event.ctrlKey) !== Boolean(event.metaKey));
}
export function shortcutLabels(platform = globalThis.navigator?.platform || '') {
  const mac = /Mac|iPhone|iPad/.test(platform);
  return { insert: `${mac ? 'Option' : 'Alt'}+Shift+L`, send: `${mac ? '⌘' : 'Ctrl'}+Shift+Enter`, highlight: `${mac ? 'Option' : 'Alt'}+Shift+H` };
}
