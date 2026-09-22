export type ExcludedSpan = { start: number; end: number };

/** Blank excluded source characters without changing offsets of protected passages. */
export function omitSource(source: string, excluded: ExcludedSpan[]): string {
  const ordered = [...excluded].sort((a, b) => a.start - b.start);
  let at = 0;
  let result = "";
  for (const span of ordered) {
    if (span.start < at || span.end > source.length || span.end <= span.start) throw new Error("Invalid excluded passage");
    result += source.slice(at, span.start) + source.slice(span.start, span.end).replace(/[^\r\n]/g, " ");
    at = span.end;
  }
  return result + source.slice(at);
}
