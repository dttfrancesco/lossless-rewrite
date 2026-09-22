import { completeText } from "../llm";
import type { RequiredUnit } from "../coverage/questions";

const RULES = `Change wording, structure, order and length as much as the instruction asks, but follow these rules:
- Rewrite the whole document, not just the highlighted passages or requirement list. Protected items are minimum constraints within the rewrite, not a content filter. Retain the surrounding context, purpose, explanation and other substantive information to the extent the user's requested transformation allows. Only extract the protected items alone when the user explicitly asks for that.
- Sentences listed under KEEP WORDING must appear word for word.
- Passages listed under KEEP MEANING may be reworded freely but must keep their exact meaning: the same claims, numbers, certainty, scope and conditions.
- Every fact listed under REQUIRED must still be stated somewhere, in any wording, with its numbers, conditions and hedges intact.
- Do not add claims, numbers or conclusions that the document does not support.
- The requirement list is a checklist, not an outline. Organize by the reader's needs: group related findings, lead with the main point and connect evidence naturally. Vary sentence structure; do not turn each checklist item into a separate sentence or print its ID.
Return only the rewritten text: no preamble, no notes, no Markdown fences.`;

const WRITE_SYSTEM = `You are an expert editor. Rewrite the document as the user instructs.\n${RULES}`;

const REPAIR_SYSTEM = `You are an expert editor revising a rewrite that failed some checks. Fix the listed problems, integrating restored information into the appropriate paragraph with natural transitions. Preserve all other information and the document's voice.\n${RULES}`;
const TIGHTEN_SYSTEM = `You are an expert editor compressing a document. Reorganize related claims, remove repetition and shorten phrasing while preserving a readable argument and every required detail. Do not force dense lists or overloaded sentences to hit a word count.\n${RULES}`;

/** "Not this": the version the user turned down and every piece of direction they gave so far. */
export interface Steer {
  previous: string;
  feedback: string[];
}

export interface Brief {
  source: string;
  instruction: string;
  keepWording: Array<{ id: string; text: string }>;
  keepMeaning: RequiredUnit[];
  facts: RequiredUnit[];
  /** Give the writer the Must cover inventory up front. Default true. */
  briefFacts?: boolean;
  steer?: Steer;
  /** Writer model for this run, e.g. `sonnet` or `opus`. Default: LLM_MODEL_WRITE, then LLM_MODEL. */
  model?: string;
}

function steerFor(steer: Steer | undefined): string {
  if (!steer?.feedback.length) return "";
  const trail = steer.feedback.map((f, i) => `${i + 1}. ${f}`).join("\n");
  return [
    "The user read an earlier version and wants a different direction. Their feedback so far, oldest first; the last item matters most:",
    trail,
    `<previous_version>\n${steer.previous}\n</previous_version>`,
    "Write a new version from the document that follows this feedback and reads clearly differently from the previous version. The rules below still apply.",
  ].join("\n");
}

function rulesFor(brief: Brief): string {
  const sections: string[] = [];
  if (brief.keepWording.length) {
    sections.push(`KEEP WORDING:\n${brief.keepWording.map((w) => `- "${w.text}"`).join("\n")}`);
  }
  if (brief.keepMeaning.length) {
    sections.push(`KEEP MEANING:\n${brief.keepMeaning.map((u) => `- ${u.id}: ${u.text}`).join("\n")}`);
  }
  if (brief.facts.length && brief.briefFacts !== false) {
    sections.push(`REQUIRED:\n${brief.facts.map((u) => `- ${u.id}: ${u.text}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

/** Models sometimes wrap the text in fences or add a lead-in line despite the instructions. */
function clean(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, "$1")
    .trim();
}

export async function writeRewrite(brief: Brief): Promise<string> {
  const { data } = await completeText({
    system: WRITE_SYSTEM,
    prompt: [
      `Instruction: ${brief.instruction}`,
      steerFor(brief.steer),
      rulesFor(brief),
      `<document>\n${brief.source}\n</document>`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    purpose: "write",
    model: brief.model,
    effort: "medium",
  });
  return clean(data);
}

export interface Problem {
  id: string;
  kind: "missing" | "altered" | "wording";
  text: string;
  reason?: string;
}

function describe(problem: Problem): string {
  switch (problem.kind) {
    case "missing":
      return `- ${problem.id} is missing${problem.reason ? ` (${problem.reason})` : ""}. It must be stated: ${problem.text}`;
    case "altered":
      return `- ${problem.id} changed meaning${problem.reason ? ` (${problem.reason})` : ""}. It must say: ${problem.text}`;
    case "wording":
      return `- This sentence must appear word for word: "${problem.text}"`;
  }
}

export async function tightenRewrite(brief: Brief, current: string, currentWords: number, target: number): Promise<string> {
  const { data } = await completeText({
    system: TIGHTEN_SYSTEM,
    prompt: [
      `Instruction: ${brief.instruction}`,
      `The current rewrite is ${currentWords} words; the instruction asks for about ${target}. Tighten it to about ${target} words. Remove repetition and wordy phrasing first. Preserve the document's purpose and useful surrounding explanation; do not reduce it to the protected items alone unless explicitly requested. Keep its style. Every item under REQUIRED, KEEP MEANING and KEEP WORDING must still be there.`,
      rulesFor({ ...brief, briefFacts: true }),
      `<document>\n${brief.source}\n</document>`,
      `<current_rewrite>\n${current}\n</current_rewrite>`,
    ].join("\n\n"),
    purpose: "write",
    model: brief.model,
    effort: "medium",
  });
  return clean(data);
}

export async function repairRewrite(brief: Brief, current: string, currentWords: number, problems: Problem[]): Promise<string> {
  const { data } = await completeText({
    system: REPAIR_SYSTEM,
    prompt: [
      `Instruction: ${brief.instruction}`,
      `The current rewrite fails these checks:\n${problems.map(describe).join("\n")}`,
      `Revise the current rewrite to fix exactly these problems: work missing information in naturally, restore changed meaning, and restore exact wording. Keep everything else, including every other required fact, and keep the length close to the current ${currentWords} words.`,
      rulesFor({ ...brief, briefFacts: true }),
      `<document>\n${brief.source}\n</document>`,
      `<current_rewrite>\n${current}\n</current_rewrite>`,
    ].join("\n\n"),
    purpose: "write",
    model: brief.model,
    effort: "medium",
  });
  return clean(data);
}
