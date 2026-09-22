export interface Sentence {
  /** `S1`, `S2`, … in document order. */
  id: string;
  text: string;
  /** Character offsets into the original text, for highlighting. */
  start: number;
  end: number;
  /** Zero-based paragraph index; headings count as their own paragraph. */
  paragraph: number;
}

// A segment ending in one of these is not a sentence end ("e.g. the", "Smith et al. found").
const ABBREVIATION_END =
  /\b(?:e\.g|i\.e|et al|cf|vs|etc|approx|ca|Fig|Figs|Eq|Eqs|Sec|Secs|Tab|No|Nos|Dr|Mr|Mrs|Ms|Prof|St|Jr|Sr|Inc|Ltd|Co|Corp|U\.S|U\.K)\.$/i;

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Paragraph blocks with their offsets: split on blank lines, and give each Markdown heading its own block. */
function paragraphs(text: string): Array<{ start: number; text: string }> {
  const blocks: Array<{ start: number; text: string }> = [];
  for (const match of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g)) {
    let offset = match.index;
    let pending = "";
    let pendingStart = offset;
    for (const line of match[0].split("\n")) {
      if (/^\s*#{1,6}\s/.test(line)) {
        if (pending.trim()) blocks.push({ start: pendingStart, text: pending });
        blocks.push({ start: offset, text: line });
        pending = "";
        pendingStart = offset + line.length + 1;
      } else {
        if (!pending) pendingStart = offset;
        pending += (pending ? "\n" : "") + line;
      }
      offset += line.length + 1;
    }
    if (pending.trim()) blocks.push({ start: pendingStart, text: pending });
  }
  return blocks;
}

export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  paragraphs(text).forEach((block, paragraph) => {
    let previous: Sentence | undefined;
    for (const segment of segmenter.segment(block.text)) {
      const trimmed = segment.segment.trim();
      if (!trimmed) continue;
      const start = block.start + segment.index + segment.segment.indexOf(trimmed);
      const end = start + trimmed.length;
      if (previous && ABBREVIATION_END.test(previous.text)) {
        previous.text = text.slice(previous.start, end);
        previous.end = end;
        continue;
      }
      previous = { id: `S${sentences.length + 1}`, text: trimmed, start, end, paragraph };
      sentences.push(previous);
    }
  });
  return sentences;
}

export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
