/** A styled span of text, by character offsets. */
export interface Range {
  start: number;
  end: number;
  className: string;
  /** Carried onto the segments it covers, e.g. a sentence id. */
  key?: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  classes: string[];
  keys: string[];
}

/** Cut `text` at every range boundary so overlapping ranges can be rendered as flat spans. */
export function segments(text: string, ranges: Range[]): Segment[] {
  const clamp = (n: number) => Math.max(0, Math.min(text.length, n));
  const cuts = new Set([0, text.length]);
  for (const range of ranges) {
    cuts.add(clamp(range.start));
    cuts.add(clamp(range.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    if (start === end) continue;
    const active = ranges.filter((range) => range.start <= start && range.end >= end);
    out.push({
      start,
      end,
      text: text.slice(start, end),
      classes: [...new Set(active.map((range) => range.className))],
      keys: [...new Set(active.flatMap((range) => (range.key ? [range.key] : [])))],
    });
  }
  return out;
}

/** Markdown headings: the whole line, and its leading hashes separately so they can be muted. */
export function headingRanges(text: string): Range[] {
  const ranges: Range[] = [];
  for (const match of text.matchAll(/^(#{1,6}\s+).*$/gm)) {
    ranges.push({ start: match.index, end: match.index + match[0].length, className: "md-heading" });
    ranges.push({ start: match.index, end: match.index + match[1]!.length, className: "md-hash" });
  }
  return ranges;
}

/** Grow a selection to whole words and trim surrounding whitespace. */
export function snapToWords(text: string, start: number, end: number): { start: number; end: number } {
  const word = /[\p{L}\p{N}'’%.,-]/u;
  let s = Math.min(start, end);
  let e = Math.max(start, end);
  while (s > 0 && word.test(text[s - 1]!) && word.test(text[s]! ?? "")) s--;
  while (e < text.length && word.test(text[e - 1]! ?? "") && word.test(text[e]!)) e++;
  while (s < e && /\s/.test(text[s]!)) s++;
  while (e > s && /\s/.test(text[e - 1]!)) e--;
  return { start: s, end: e };
}
