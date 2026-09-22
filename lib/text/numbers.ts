/**
 * Numbers mentioned in text, compared by value: "1,426" and "1426" match, "12 percent" and
 * "12%" match, and "twelve" matches 12. Signs are ignored, because rewrites legitimately turn
 * "−1.2 days" into "1.2 fewer days".
 */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
// "one" is left out: "one of", "one-off" and "one another" are rarely quantities.

// Digits glued to a preceding letter are identifiers, not quantities: "/v2/batch", "S3", "Q8".
const DIGITS = /(?<![\p{L}\d.])\d[\d,]*(?:\.\d+)?|(?<![\p{L}\d.])\.\d+/gu;
const WORDS = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "gi");
const THOUSANDS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

export function numbersIn(text: string): number[] {
  const values: number[] = [];
  for (const [raw] of text.matchAll(DIGITS)) {
    // "1,426" is one number; "3,4" (a list without spaces) is two.
    const parts = THOUSANDS.test(raw) ? [raw.replaceAll(",", "")] : raw.split(",");
    for (const part of parts) {
      if (part === "") continue;
      const value = Number.parseFloat(part);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  for (const [, word] of text.matchAll(WORDS)) {
    const value = NUMBER_WORDS[word!.toLowerCase()];
    if (value !== undefined) values.push(value);
  }
  return values;
}

/** Numbers in `required` that `text` never mentions. */
export function missingNumbers(required: string, text: string): number[] {
  const available = new Set(numbersIn(text));
  return [...new Set(numbersIn(required))].filter((value) => !available.has(value));
}

/** Numbers in `text` that appear nowhere in `source`, such as 12 turning into 10. */
export function unsupportedNumbers(source: string, text: string): number[] {
  const known = new Set(numbersIn(source));
  return [...new Set(numbersIn(text))].filter((value) => !known.has(value));
}
