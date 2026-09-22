/** Exact wording means exact characters, including punctuation and whitespace. */
export function findWording(span: string, text: string): { start: number; end: number } | undefined {
  if (!span.length) return undefined;
  const start = text.indexOf(span);
  return start < 0 ? undefined : { start, end: start + span.length };
}
