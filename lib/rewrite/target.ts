/**
 * The target length an instruction asks for: "~350 words", "300–350 words", "70% shorter",
 * "cut it in half". Undefined when the instruction names none.
 */
export function targetWords(instruction: string, sourceWords: number): number | undefined {
  const words = instruction.match(/(\d[\d,]*)\s*(?:[-–]\s*(\d[\d,]*)\s*)?words?\b/i);
  if (words) return Number((words[2] ?? words[1]!).replace(/,/g, ""));
  const percent =
    instruction.match(/(\d{1,2})\s*%\s*(?:shorter|less|fewer|smaller)/i) ??
    instruction.match(/\b(?:cut|shorten|reduce|trim)\b[^.]*?\bby\s*(\d{1,2})\s*%/i);
  if (percent) return Math.round(sourceWords * (1 - Number(percent[1]) / 100));
  if (/\b(?:in\s+half|by\s+half|half\s+(?:the\s+)?(?:length|size))\b/i.test(instruction)) return Math.round(sourceWords / 2);
  return undefined;
}
