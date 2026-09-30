import type { RequiredUnit } from "../coverage/questions";
import type { Constraint, Fact } from "./types";

/** Keep meaning selections become units P1…Pn; Keep wording spans W1…Wn. */
export function unitsFor(request: { constraints: Constraint[]; facts: Fact[] }) {
  const keepMeaning: RequiredUnit[] = request.constraints
    .filter((c) => c.type === "keep_meaning")
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({ id: `P${i + 1}`, kind: "keep_meaning", text: c.text }));
  const facts: RequiredUnit[] = request.facts.map((f) => ({ id: f.id, kind: "must_cover", text: f.text }));
  const keepWording = request.constraints
    .filter((c) => c.type === "keep_wording")
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({ id: `W${i + 1}`, text: c.text }));
  return { keepMeaning, facts, keepWording };
}

