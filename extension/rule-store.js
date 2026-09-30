import { validateRules } from './writing-rules.js';
import { mergeLearnedRules } from './rule-learning.js';

export function createRuleStore({ storage, notify, token = () => crypto.randomUUID() }) {
  let queue = Promise.resolve();
  return message => {
    const operation = queue.then(async () => {
      const saved = await storage.get(['writingRules', 'writingRuleUndo']);
      const current = validateRules(saved.writingRules || { enabled: true, autoLearn: true, rules: [] });
      if (message.action === 'get') return current;
      let value, undo = null, result;
      if (message.action === 'save') {
        value = validateRules(message.value); result = value;
      } else if (message.action === 'learn') {
        const merged = mergeLearnedRules(current, message.draft);
        if (!merged.added.length) return { added: [] };
        value = merged.value;
        undo = { token: token(), before: current, after: value };
        result = { added: merged.added, undo: undo.token };
      } else if (message.action === 'undo') {
        undo = saved.writingRuleUndo;
        if (!undo || undo.token !== message.token || JSON.stringify(current) !== JSON.stringify(undo.after)) throw new Error('Rules changed since then. Edit them in My writing rules.');
        value = validateRules(undo.before); undo = null; result = { undone: true };
      } else throw new Error('Unknown writing rules action.');
      await storage.set({ writingRules: value, writingRuleUndo: undo });
      await notify();
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  };
}
