import type { Sentence } from "../text/sentences";
import type { Verification } from "../coverage/verify";

export type ConstraintType = "keep_wording" | "keep_meaning" | "must_cover";

/** A span of the source document the user marked. Offsets index into the source text. */
export interface Constraint {
  id: string;
  type: ConstraintType;
  start: number;
  end: number;
  text: string;
}

/** One item of the inventory extracted from a Must cover region. */
export interface Fact {
  id: string;
  text: string;
  /** The Must cover constraint it came from. */
  constraintId: string;
  /** Where it comes from in the source document, for highlighting. */
  sources: Array<{ start: number; end: number }>;
}

export interface Attempt {
  /** How this text was produced: the first draft, the user's own edit, a repair, or a tightening pass. */
  pass: "draft" | "edit" | "repair" | "tighten";
  text: string;
  sentences: Sentence[];
  words: number;
  verification: Verification;
  /** Unit and wording ids this attempt was asked to repair. */
  repairing: string[];
  writeMs: number;
}

export interface RewriteResult {
  attempts: Attempt[];
  final: Attempt;
  sourceWords: number;
  /** The length the instruction asked for, if it named one. */
  targetWords?: number;
}

export type Stage = "writing" | "verifying" | "adjudicating" | "repairing" | "tightening";

export type PipelineEvent =
  | { type: "stage"; stage: Stage; attempt: number; ids?: string[] }
  | { type: "draft"; attempt: number; text: string; sentences: Sentence[]; words: number }
  | { type: "verified"; attempt: number; verification: Verification }
  | { type: "done"; result: RewriteResult }
  | { type: "error"; message: string };
