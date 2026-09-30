// Exact declared chat origins only. Chrome manages site access; manual paste is a fallback.
export const SITES = [
  { id: "chatgpt", name: "ChatGPT", host: "chatgpt.com" },
  { id: "claude", name: "Claude", host: "claude.ai" },
  { id: "gemini", name: "Gemini", host: "gemini.google.com" },
  { id: "grok", name: "Grok", host: "grok.com" },
  { id: "deepseek", name: "DeepSeek", host: "chat.deepseek.com" },
];
export function siteFor(url) {
  try { const u = new URL(url); return u.protocol === "https:" && !u.port && SITES.find(s => s.host === u.hostname); } catch { return undefined; }
}
