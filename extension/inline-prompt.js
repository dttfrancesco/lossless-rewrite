// Only compose text. No network calls, DOM access, or claims of verification.
export function composeInlinePrompt(draft, { budget = "", keep = "" } = {}) {
  if (typeof draft !== "string" || !draft.trim()) throw new Error("Write your request in the chat box first.");
  if (draft.length > 100000) throw new Error("The chat draft exceeds 100,000 characters.");
  if (budget !== "" && (!/^\d+$/.test(String(budget)) || Number(budget) < 20 || Number(budget) > 50000)) throw new Error("Use a word limit between 20 and 50,000, or leave it blank.");
  if (typeof keep !== "string" || keep.length > 4000) throw new Error("Keep notes must be at most 4,000 characters.");
  return `${draft}\n\n[Lossless Rewrite instructions]\nWhen condensing or rewriting the material in this request, cut repetition before cutting ideas. Preserve findings, qualifications, conditions, numbers and which source made each claim. Do not turn uncertainty into certainty or merge conflicting findings. Return the complete requested text, not only the protected passages.${budget !== "" ? `\nAim for at most ${Number(budget)} words. If the necessary ideas cannot fit, say so instead of silently dropping them.` : ""}${keep.trim() ? `\nThe following notes identify what must survive:\n${keep.trim()}` : ""}\nThese instructions are not a verification result. Do not claim the output has been checked by Lossless Rewrite.`;
}

export function isSendLabel(label) {
  // Fail closed for unlabeled/localized/ambiguous controls; leave text staged.
  return /^(send|send message|send prompt|submit|submit prompt)$/i.test(label.trim());
}
