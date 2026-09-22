import { z } from "zod";
import { wordCount } from "../text/sentences";

const span = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).refine((s) => s.end > s.start, "Span end must follow start");
export const constraintSchema = z.object({
  id: z.string().min(1).max(100), type: z.enum(["keep_wording", "keep_meaning", "must_cover"]),
  start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(500_000).refine((text) => Boolean(text.trim()), "Empty source span"),
}).refine((s) => s.end > s.start && s.end - s.start === s.text.length, "Invalid source span");
export const modelSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_./:-]+$/);
export const rewriteSchema = z.object({
  source: z.string().min(1).max(500_000).refine(text => wordCount(text) <= 50_000, "Source exceeds 50,000 words"), instruction: z.string().trim().min(1).max(4000),
  constraints: z.array(constraintSchema).max(100),
  facts: z.array(z.object({ id: z.string().regex(/^F\d+$/), text: z.string().trim().min(1).max(4000), constraintId: z.string(), sources: z.array(span).min(1).max(100) })).max(200),
  maxRepairs: z.number().int().min(0).max(2).optional(), maxTightens: z.number().int().min(0).max(2).optional(),
  initialText: z.string().min(1).max(100_000).optional(), writerModel: modelSchema.optional(),
  steer: z.object({ previous: z.string().max(100_000), feedback: z.array(z.string().max(4000)).max(30) }).optional(),
}).superRefine((r, ctx) => {
  if (r.constraints.some((c) => r.source.slice(c.start, c.end) !== c.text)) ctx.addIssue({ code: "custom", message: "Marks do not match the source" });
  if (new Set(r.facts.map((f) => f.id)).size !== r.facts.length) ctx.addIssue({ code: "custom", message: "Duplicate finding IDs" });
  for (const c of r.constraints.filter((c) => c.type === "must_cover")) {
    if (!r.facts.some((f) => f.constraintId === c.id)) ctx.addIssue({ code: "custom", message: "A Must cover region has no required ideas. Remove its mark or extract ideas first." });
  }
  for (const f of r.facts) {
    const c = r.constraints.find((c) => c.id === f.constraintId && c.type === "must_cover");
    if (!c || f.sources.some((s) => s.start < c.start || s.end > c.end)) ctx.addIssue({ code: "custom", message: "Finding references an invalid source region" });
  }
});
