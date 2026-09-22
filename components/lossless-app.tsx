"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Verification } from "@/lib/coverage/verify";
import type { Constraint, ConstraintType, Fact } from "@/lib/rewrite/types";
import { targetWords } from "@/lib/rewrite/target";
import { wordCount } from "@/lib/text/sentences";
import { headingRanges, snapToWords, type Range } from "@/lib/ui/segments";
import { omitSource } from "@/lib/ui/exclusions";
import { ModelPicker } from "./model-picker";
import { useDismiss } from "./use-dismiss";
import { UiIcon } from "./ui-icon";
import { Connector } from "./connector";
import { Coverage, ProtectionChoices, type UnitRow, type UnitState, type UnitView } from "./coverage";
import { MarkedText, type TextSelection } from "./marked-text";
import { useRewrite, type RunState } from "./use-rewrite";

interface RegionState {
  status: "extracting" | "ready" | "error";
  facts: Fact[];
  error?: string;
}

interface SourceSnapshot {
  source: string;
  draftSource: string;
  editingSource: boolean;
  constraints: Constraint[];
  excluded: Array<{ id: string; start: number; end: number }>;
  regions: Record<string, RegionState>;
  removed: Set<string>;
  isDemo: boolean;
}

const DEFAULT_INSTRUCTION = "Cut this to ~250 words and make it much tighter.";

/** Deliberately different directions for "Not this". The writer gets the full description. */
const DIRECTIONS = [
  { label: "More technical", feedback: "More technical: precise terminology, dense with the numbers, formal academic register." },
  { label: "More direct", feedback: "More direct: lead with each finding in short declarative sentences; no throat-clearing." },
  { label: "More explanatory", feedback: "More explanatory: say why each finding matters, in plain language with smooth transitions." },
];

const MARK_CLASS: Record<ConstraintType, string> = {
  must_cover: "mk-cover",
  keep_meaning: "mk-meaning",
  keep_wording: "mk-wording",
};

const MARK_LABEL: Record<ConstraintType, string> = {
  keep_wording: "Keep wording",
  keep_meaning: "Keep meaning",
  must_cover: "Must cover",
};

const MARK_COLOR: Record<ConstraintType, string> = {
  keep_wording: "var(--wording)",
  keep_meaning: "var(--meaning)",
  must_cover: "var(--cover)",
};

type Writer = string;
const writerLabel = (value: string) => value === "configured" ? "Your writer" : value.replace("codex-cli/", "Codex / ").replace("claude-cli/", "Claude / ");

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${counter++}`;
const byStart = (a: { start: number }, b: { start: number }) => a.start - b.start;

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 700);
      const eased = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    // Hidden windows get no animation frames; land on the value anyway.
    const settle = window.setTimeout(() => {
      setShown(value);
      from.current = value;
    }, 800);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value]);
  return <>{shown.toLocaleString("en-US")}</>;
}

/** Where a unit ended up in the rewrite: sentence spans, or the exact wording's location. */
function traceSpans(unit: UnitView, run: RunState): Array<{ start: number; end: number }> {
  const verification = run.verification;
  if (!verification || !run.draft) return [];
  if (unit.kind === "keep_wording") {
    const location = verification.wording.find((w) => w.id === unit.id)?.location;
    return location ? [location] : [];
  }
  const result = verification.units.find((r) => r.unit.id === unit.id);
  if (!result || result.status !== "kept") return [];
  return result.sentences.flatMap((id) => {
    const sentence = run.draft!.sentences.find((s) => s.id === id);
    return sentence ? [{ start: sentence.start, end: sentence.end }] : [];
  });
}

function stateOf(unit: UnitView, verification: Verification | undefined): { state: UnitState; reason?: string } {
  if (!verification) return { state: "checking" };
  if (unit.kind === "keep_wording") {
    return { state: verification.wording.find((w) => w.id === unit.id)?.kept ? "kept" : "missing" };
  }
  const result = verification.units.find((r) => r.unit.id === unit.id);
  return result ? { state: result.status, reason: result.reason } : { state: "pending" };
}

function wasProblem(unit: UnitView, verification: Verification | undefined): boolean {
  if (!verification) return false;
  if (unit.kind === "keep_wording") return verification.wording.some((w) => w.id === unit.id && !w.kept);
  return verification.units.some((r) => r.unit.id === unit.id && (r.status === "missing" || r.status === "altered"));
}

export function LosslessApp() {
  const [source, setSource] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [editingSource, setEditingSource] = useState(true);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [excluded, setExcluded] = useState<Array<{ id: string; start: number; end: number }>>([]);
  const [dark, setDark] = useState(false);
  const [morePresets, setMorePresets] = useState(false);
  const [importing, setImporting] = useState(false);
  const [regions, setRegions] = useState<Record<string, RegionState>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
  const [selection, setSelection] = useState<TextSelection>();
  const [marksAt, setMarksAt] = useState<{ ids: string[]; x: number; y: number }>();
  const [focus, setFocus] = useState<string>();
  const [rewriteEdit, setRewriteEdit] = useState<string>();
  const [runSignature, setRunSignature] = useState<string>();
  // "Not this": the direction feedback given so far, whether the picker is open, and its text box.
  const [feedback, setFeedback] = useState<string[]>([]);
  const [steering, setSteering] = useState(false);
  const [steerText, setSteerText] = useState("");
  // Which Claude model writes, and which one wrote the run on screen.
  const [writer, setWriter] = useState<Writer>("configured");
  const [runWriter, setRunWriter] = useState<Writer>("configured");
  const [demoError, setDemoError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const { state: run, start, reset } = useRewrite();
  const sourceFile = useRef<HTMLInputElement>(null);
  const [selectionHint, setSelectionHint] = useState("");
  const undoStack = useRef<SourceSnapshot[]>([]);
  const redoStack = useRef<SourceSnapshot[]>([]);
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });

  function snapshot(): SourceSnapshot {
    return { source, draftSource, editingSource, constraints, excluded, regions, removed, isDemo };
  }

  function checkpoint() {
    undoStack.current = [...undoStack.current.slice(-49), snapshot()];
    redoStack.current = [];
    setHistoryCount({ undo: undoStack.current.length, redo: 0 });
  }

  function restoreHistory(redo = false) {
    if (run.status === "running" || Object.values(regions).some(r => r.status === "extracting")) return;
    const from = redo ? redoStack.current : undoStack.current;
    const to = redo ? undoStack.current : redoStack.current;
    const previous = from.pop();
    if (!previous) return;
    to.push(snapshot());
    setSource(previous.source);
    setDraftSource(previous.draftSource);
    setEditingSource(previous.editingSource);
    setConstraints(previous.constraints);
    setExcluded(previous.excluded);
    setRegions(Object.fromEntries(Object.entries(previous.regions).map(([id, region]) => [id,
      region.status === "extracting" ? { ...region, status: "error", error: "Extract again to finish this selection." } : region,
    ])));
    setRemoved(previous.removed);
    setIsDemo(previous.isDemo);
    setSelection(undefined);
    setMarksAt(undefined);
    setFocus(undefined);
    setDemoError("");
    setSelectionHint("");
    if (previous.source !== source) { reset(); setRewriteEdit(undefined); }
    setHistoryCount({ undo: undoStack.current.length, redo: redoStack.current.length });
  }

  const onHistoryKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    // Text fields retain the browser's own typing undo history.
    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    event.preventDefault();
    restoreHistory(key === "y" || event.shiftKey);
  });
  useEffect(() => {
    window.addEventListener("keydown", onHistoryKey);
    return () => window.removeEventListener("keydown", onHistoryKey);
  }, []);
  useDismiss(morePresets, ".more-presets", () => setMorePresets(false));
  useDismiss(steering, ".style-feedback, .style-trigger", () => setSteering(false));
  useDismiss(Boolean(selection), '[data-protection-actions], .selection-toolbar', () => setSelection(undefined));
  useDismiss(Boolean(marksAt), '.mark-toolbar', () => setMarksAt(undefined));

  function chooseProtection(kind: ConstraintType | "exclude") {
    if (!selection) {
      setSelectionHint("First select the words you want to protect in Source.");
      document.querySelector<HTMLElement>('[aria-label="Source text"], [data-pane="source"] [tabindex]')?.focus();
      return;
    }
    setSelectionHint("");
    if (kind === "exclude") excludeSelection(selection);
    else addMark(kind, selection);
  }

  function selectEditableText(field: HTMLTextAreaElement) {
    if (field.selectionStart === field.selectionEnd) { setSelection(undefined); return; }
    const range = snapToWords(field.value, field.selectionStart, field.selectionEnd);
    if (range.end <= range.start) return;
    setSelection({ ...range, rect: field.getBoundingClientRect() });
    setSelectionHint("");
    setMarksAt(undefined);
  }

  function remapConstraints(text: string) {
    return constraints.flatMap(c => {
      const at = text.indexOf(c.text);
      return at < 0 ? [] : [{ ...c, start: at, end: at + c.text.length }];
    });
  }

  async function importSourceFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md|pdf)$/i.test(file.name) || file.size > 10_000_000) {
      setDemoError("Choose a .txt, .md or .pdf file smaller than 10 MB.");
      return;
    }
    setImporting(true);
    try {
      let text: string;
      if (/\.pdf$/i.test(file.name)) {
        const response = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not read this PDF.");
        text = result.text;
      } else text = await file.text();
      if (text.length > 500_000 || wordCount(text) > 50_000) throw new Error("The source can contain up to 50,000 words (500,000 characters).");
      startOver();
      setDemoError("");
      setDraftSource(text);
    } catch (error) { setDemoError(error instanceof Error ? error.message : "Could not read this file."); }
    finally { setImporting(false); }
  }

  // ------------------------------------------------------------------ units

  const units = useMemo<UnitView[]>(() => {
    const list: UnitView[] = [];
    let n = 0;
    for (const region of constraints.filter((c) => c.type === "must_cover").sort(byStart)) {
      for (const fact of regions[region.id]?.facts ?? []) {
        const key = `${region.id}#${fact.id}`;
        if (removed.has(key)) continue;
        list.push({ id: `F${++n}`, key, kind: "must_cover", text: fact.text, spans: fact.sources, regionId: region.id });
      }
    }
    constraints
      .filter((c) => c.type === "keep_meaning")
      .sort(byStart)
      .forEach((c, i) => list.push({ id: `P${i + 1}`, key: c.id, kind: "keep_meaning", text: c.text, spans: [c] }));
    constraints
      .filter((c) => c.type === "keep_wording")
      .sort(byStart)
      .forEach((c, i) => list.push({ id: `W${i + 1}`, key: c.id, kind: "keep_wording", text: c.text, spans: [c] }));
    return list;
  }, [constraints, regions, removed]);

  const signature = units.map((u) => `${u.id}:${u.text}`).join("|") + JSON.stringify(excluded);
  const stale = run.status !== "idle" && (runSignature !== signature || (editingSource && draftSource !== source));
  const extracting = Object.values(regions).some((r) => r.status === "extracting");
  const focused = units.find((u) => u.key === focus) ?? units[0];
  const activeKey = focused?.key;

  const rows: UnitRow[] = units.map((unit) => {
    const region = unit.regionId ? regions[unit.regionId] : undefined;
    if (region?.status === "extracting") return { ...unit, state: "extracting", paragraphs: [], repaired: false };
    if (!run.draft || stale || rewriteEdit !== undefined) return { ...unit, state: "pending", paragraphs: [], repaired: false };
    const { state, reason } = stateOf(unit, run.verification);
    const spans = traceSpans(unit, run);
    const paragraphs = [
      ...new Set(
        run.draft.sentences
          .filter((s) => spans.some((span) => span.start < s.end && span.end > s.start))
          .map((s) => s.paragraph + 1),
      ),
    ];
    return { ...unit, state, reason, paragraphs, repaired: state === "kept" && wasProblem(unit, run.previous) };
  });
  // Regions still extracting show one placeholder row each.
  for (const region of constraints.filter((c) => c.type === "must_cover")) {
    if (regions[region.id]?.status === "extracting") {
      rows.unshift({ id: "…", key: `${region.id}#pending`, kind: "must_cover", text: `Finding the ideas in “${region.text.slice(0, 60).trim()}…”`, spans: [region], regionId: region.id, state: "extracting", paragraphs: [], repaired: false });
    }
  }

  // ------------------------------------------------------------------ source marks

  function addMark(type: ConstraintType, sel: TextSelection) {
    if ((!editingSource || draftSource === source) && excluded.some(e => e.start < sel.end && e.end > sel.start)) {
      setDemoError("Remove the overlapping Not this mark before protecting this passage.");
      return;
    }
    const currentConstraints = editingSource ? remapConstraints(draftSource) : constraints;
    if (currentConstraints.some(c => c.type === type && c.start === sel.start && c.end === sel.end)) return;
    if (editingSource && wordCount(draftSource) > 50_000) { setDemoError("The source can contain up to 50,000 words."); return; }
    checkpoint();
    if (editingSource && !finishEditingSource(false)) return;
    const mark: Constraint = { id: newId(), type, start: sel.start, end: sel.end, text: (editingSource ? draftSource : source).slice(sel.start, sel.end) };
    setConstraints((cs) => [...cs, mark]);
    setFocus(mark.id);
    setDemoError("");
    setSelection(sel);
    window.getSelection()?.removeAllRanges();
    if (type === "must_cover") void extract(mark);
  }

  function excludeSelection(sel: TextSelection) {
    const currentConstraints = editingSource ? remapConstraints(draftSource) : constraints;
    if (currentConstraints.some(c => c.start < sel.end && c.end > sel.start)) {
      setDemoError("Remove the overlapping protection before excluding this passage.");
      return;
    }
    if (editingSource && wordCount(draftSource) > 50_000) { setDemoError("The source can contain up to 50,000 words."); return; }
    checkpoint();
    if (editingSource && !finishEditingSource(false)) return;
    const currentExcluded = editingSource && draftSource !== source ? [] : excluded;
    const overlaps = currentExcluded.filter(e => e.start <= sel.end && e.end >= sel.start);
    setExcluded([...currentExcluded.filter(e => !overlaps.includes(e)), { id: newId(), start: Math.min(sel.start, ...overlaps.map(e => e.start)), end: Math.max(sel.end, ...overlaps.map(e => e.end)) }]);
    setSelection(undefined);
    window.getSelection()?.removeAllRanges();
    setDemoError("");
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!selection || run.status === "running" || extracting || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.isComposing) return;
      const field = (event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]");
      if (field && field.getAttribute("aria-label") !== "Source text") return;
      const key = event.code.startsWith("Key") ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
      const kind = ({ s: "keep_wording", m: "keep_meaning", c: "must_cover" } as const)[key as "s" | "m" | "c"];
      if (kind || key === "x") { event.preventDefault(); if (kind) addMark(kind, selection); else excludeSelection(selection); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selection, editingSource, draftSource, source, writer, run.status, extracting, excluded, constraints]);

  async function extract(region: Constraint) {
    setRegions((r) => ({ ...r, [region.id]: { status: "extracting", facts: [] } }));
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, model: writer === "configured" ? undefined : writer }),
      });
      const data = (await response.json()) as { facts?: Fact[]; error?: string };
      if (!response.ok || !data.facts) throw new Error(data.error ?? `The server answered ${response.status}.`);
      setRegions((r) => (r[region.id] ? { ...r, [region.id]: { status: "ready", facts: data.facts! } } : r));
    } catch (error) {
      setRegions((r) => (r[region.id] ? { ...r, [region.id]: { status: "error", facts: [], error: String(error) } } : r));
    }
  }

  function removeMark(id: string) {
    checkpoint();
    setConstraints((cs) => cs.filter((c) => c.id !== id));
    setRegions((r) => {
      const { [id]: _, ...rest } = r;
      return rest;
    });
    setMarksAt(undefined);
  }

  function finishEditingSource(record = true) {
    const next = draftSource;
    if (wordCount(next) > 50_000) { setDemoError("The source can contain up to 50,000 words."); return false; }
    if (record) checkpoint();
    setEditingSource(false);
    setSelection(undefined);
    if (next === source) return true;
    // Keep the marks whose text survived the edit; move them to where it now is.
    const moved = remapConstraints(next);
    const delta = new Map(moved.map((c) => [c.id, c.start - constraints.find((o) => o.id === c.id)!.start]));
    setConstraints(moved);
    setRegions((r) =>
      Object.fromEntries(
        Object.entries(r)
          .filter(([id]) => delta.has(id))
          .map(([id, region]) => [
            id,
            { ...region, facts: region.facts.map((f) => ({ ...f, sources: f.sources.map((s) => ({ start: s.start + delta.get(id)!, end: s.end + delta.get(id)! })) })) },
          ]),
      ),
    );
    setSource(next);
    setExcluded([]);
    setIsDemo(false);
    setFeedback([]);
    reset();
    return true;
  }

  async function loadDemo() {
    try {
      setDemoError("");
      const response = await fetch("/api/demo");
      if (!response.ok) throw new Error("Could not load the demo. Please try again.");
      const { text, protections = [], instruction: demoInstruction } = (await response.json()) as { text: string; protections?: string[]; instruction?: string };
      checkpoint();
      setSelection(undefined);
      setMarksAt(undefined);
      setSelectionHint("");
      setIsDemo(true);
      setSource(text);
      setDraftSource(text);
      setEditingSource(false);
      const marks: Constraint[] = protections.flatMap((protection) => {
        const start = text.indexOf(protection);
        return start < 0 ? [] : [{ id: newId(), type: "keep_meaning", text: protection, start, end: start + protection.length }];
      });
      setConstraints(marks);
      setExcluded([]);
      setRegions({});
      setRemoved(new Set());
      setFocus(marks[0]?.id);
      setRewriteEdit(undefined);
      setCopied(false);
      setInstruction(demoInstruction ?? DEFAULT_INSTRUCTION);
      setFeedback([]);
      setSteering(false);
      reset();
    } catch (error) { setDemoError(error instanceof Error ? error.message : String(error)); }
  }

  function startOver() {
    checkpoint();
    setSelection(undefined);
    setMarksAt(undefined);
    setSelectionHint("");
    setIsDemo(false);
    setSource("");
    setDraftSource("");
    setEditingSource(true);
    setConstraints([]);
    setExcluded([]);
    setRegions({});
    setRemoved(new Set());
    setFocus(undefined);
    setRewriteEdit(undefined);
    setFeedback([]);
    setSteering(false);
    reset();
  }

  // ------------------------------------------------------------------ run

  function rewrite(options: { initialText?: string; repair?: boolean; steer?: string } = {}) {
    const facts: Fact[] = units
      .filter((u) => u.kind === "must_cover")
      .map((u) => ({ id: u.id, text: u.text, constraintId: u.regionId!, sources: u.spans }));
    let trail = feedback;
    if (options.steer && run.draft) {
      trail = [...feedback, options.steer];
      setFeedback(trail);
    } else if (!options.initialText) {
      // A plain Rewrite starts a new direction search.
      trail = [];
      setFeedback([]);
    }
    setCopied(false);
    setRunSignature(signature);
    setRunWriter(writer);
    setRewriteEdit(undefined);
    setSteering(false);
    setSteerText("");
    void start(
      {
        source: omitSource(source, excluded),
        instruction,
        constraints,
        facts,
        initialText: options.initialText,
        steer: options.steer && run.draft ? { previous: run.draft.text, feedback: trail } : undefined,
        writerModel: writer === "configured" ? undefined : writer,
        maxRepairs: options.initialText && !options.repair ? 0 : 1,
        maxTightens: options.initialText ? 0 : 1,
      },
      options.initialText !== undefined,
    );
  }

  const running = run.status === "running";
  useEffect(() => {
    if (!running) return;
    const began = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const sourceWords = wordCount(source);
  const target = targetWords(instruction, sourceWords);
  const inventoryIncomplete = constraints.some((c) => c.type === "must_cover" && (regions[c.id]?.status !== "ready" || !units.some((u) => u.regionId === c.id)));
  const canRewrite = Boolean(omitSource(source, excluded).trim() && instruction.trim()) && !editingSource && !extracting && !inventoryIncomplete && !running;

  // ------------------------------------------------------------------ focus and highlights

  const sourceRanges = useMemo<Range[]>(() => {
    const ranges: Range[] = [...headingRanges(source)];
    // During tracing, only the selected idea is tinted. Other protection marks remain
    // clickable, but cannot look like a second active idea on the source side.
    const tracing = focused && run.draft;
    for (const c of constraints) ranges.push({ start: c.start, end: c.end, className: tracing ? "" : MARK_CLASS[c.type], key: c.id });
    for (const span of tracing ? focused.spans : []) ranges.push({ start: span.start, end: span.end, className: "mk-focus" });
    for (const span of excluded) ranges.push({ ...span, className: "mk-excluded", key: span.id });
    return ranges;
  }, [source, constraints, focused, excluded, run.draft]);

  const rewriteText = run.draft?.text ?? "";
  const focusTrace = useMemo(() => (focused ? traceSpans(focused, run) : []), [focused, run]);
  const focusTraceKey = focusTrace.map((span) => `${span.start}:${span.end}`).join("|");
  const rewriteRanges = useMemo<Range[]>(() => {
    const ranges: Range[] = [...headingRanges(rewriteText)];
    for (const s of run.draft?.sentences ?? []) ranges.push({ start: s.start, end: s.end, className: "sent", key: s.id });
    for (const span of focusTrace) ranges.push({ start: span.start, end: span.end, className: "mk-focus" });
    return ranges;
  }, [rewriteText, run.draft, focusTrace]);

  // Bring both ends of the selected idea into view, scrolling each pane but not the page.
  useEffect(() => {
    if (!activeKey) return;
    for (const name of ["source", "rewrite"]) {
      const pane = document.querySelector<HTMLElement>(`[data-pane="${name}"]`);
      const target = pane?.querySelector<HTMLElement>("[data-focus]");
      if (!pane || !target) continue;
      const paneRect = pane.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const top = pane.scrollTop + rect.top - paneRect.top - Math.max(0, (pane.clientHeight - rect.height) / 2);
      pane.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [activeKey, run.draft?.text, focusTraceKey, editingSource, rewriteEdit]);

  function onRewriteClick(_offset: number, keys: string[]) {
    const sentenceId = keys.find((k) => /^S\d+$/.test(k));
    if (!sentenceId || !run.verification) return;
    const unitId = run.verification.units.find((r) => r.status === "kept" && r.sentences.includes(sentenceId))?.unit.id;
    const unit = units.find((u) => u.id === unitId);
    if (unit) setFocus(unit.key);
  }

  function onSourceClick(offset: number, keys: string[]) {
    const marks = keys.filter((k) => constraints.some((c) => c.id === k));
    const fact = units.find((u) => u.kind === "must_cover" && u.spans.some((s) => s.start <= offset && offset < s.end));
    const other = units.find((u) => u.kind !== "must_cover" && marks.includes(u.key));
    const selected = other ?? fact;
    if (selected) setFocus(selected.key);
    if (marks.length && !running) {
      const span = document.querySelector<HTMLElement>(`[data-pane="source"] [data-offset="${offset}"]`);
      const rect = span?.getBoundingClientRect();
      if (rect) setMarksAt({ ids: marks, x: rect.left + rect.width / 2, y: rect.top });
    } else {
      setMarksAt(undefined);
    }
  }

  // ------------------------------------------------------------------ status line

  const verification = run.verification;
  const keptCount = rows.filter((r) => r.state === "kept").length;
  const unitCount = rows.filter((r) => r.state !== "extracting").length;

  let status = "";
  if (running) {
    const ids = run.stageIds ?? [];
    switch (run.stage) {
      case "writing":
        status = feedback.length
          ? `${writerLabel(runWriter)} is finding a new direction…`
          : `${writerLabel(runWriter)} is writing…`;
        break;
      case "verifying":
        status = `Jev is checking ${units.length} required ${units.length === 1 ? "idea" : "ideas"}…`;
        break;
      case "adjudicating":
        status = `Getting a second opinion on ${ids.join(", ")}…`;
        break;
      case "repairing": {
        const parts = ids.map((id) => {
          const row = rows.find((r) => r.id === id);
          return row?.state === "altered" ? `${id} changed` : `${id} lost`;
        });
        status = `${parts.join(", ")} — repairing…`;
        break;
      }
      case "tightening":
        status = target ? `Every idea kept. Tightening to ~${target} words…` : "Tightening…";
        break;
      default:
        status = "Starting…";
    }
  } else if (run.status === "error") {
    status = `Something went wrong: ${run.error}`;
  } else if (rewriteEdit !== undefined) {
    status = "Editing · check again to verify your changes.";
  } else if (run.status === "done" && verification && !stale) {
    const lost = rows.filter((r) => r.state === "missing" || r.state === "altered").map((r) => r.id);
    const unsure = rows.filter((r) => r.state === "uncertain").map((r) => r.id);
    const words = run.draft?.words ?? 0;
    status = unitCount === 0 ? "Rewrite complete. No requirements selected; preservation was not checked." : lost.length
      ? `${keptCount} of ${unitCount} kept — ${lost.join(", ")} could not be repaired.`
      : unsure.length
        ? `${keptCount} of ${unitCount} kept — ${unsure.join(", ")} unsure.`
        : target && words > target * 1.15
          ? `All ${unitCount} required ideas kept. They need more room than ~${target} words.`
          : `All ${unitCount} required ${unitCount === 1 ? "idea" : "ideas"} kept.`;
  } else if (stale) {
    status = "The marks changed since the last rewrite. Rewrite again to re-check.";
  }

  const rewriteWords = run.draft?.words;
  const shorter = rewriteWords !== undefined && sourceWords ? Math.round(100 * (1 - rewriteWords / sourceWords)) : undefined;

  // ------------------------------------------------------------------ view

  return (
    // Fills the window when there is room; on short screens the page scrolls instead of squashing the panes.
    <div className={`app-shell${dark ? " dark-theme" : ""}`}>
      <header className="app-header">
        <h1 className="brand-name"><UiIcon name="brand"/>lossless rewrite<span aria-hidden="true">.</span></h1>
        <div className="ml-auto flex items-center gap-2">
          <a href="#protected-details" className="header-nav">How it works</a>
          <button type="button" onClick={loadDemo} disabled={running} className="header-nav">Examples</button>
          <a href="https://github.com/dttfrancesco/lossless-rewrite#readme" className="header-nav" target="_blank" rel="noreferrer">Docs</a>
          <button type="button" className="theme-toggle" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark(!dark)}><UiIcon name="sun"/></button>
          <button type="button" onClick={loadDemo} disabled={running} className="secondary-button">
            Try the example
          </button>
          <a href="/demo" className="demo-link"><span aria-hidden="true">▶</span> Watch demo <small aria-hidden="true">↗</small></a>
        </div>
      </header>
      <section className="editor-intro">
        <div><h2>Rewrite text. <em>Check key details.</em></h2>
        <p className="intro-description">Make your text shorter or clearer. Keep the details that matter.</p></div>
      </section>
      {demoError && <p role="alert" className="px-6" style={{ color: "var(--missing)" }}>{demoError}</p>}
      <div className="workspace">



      <main className="editor-panes">
        {/* ---------------------------------------------------------- source */}
        <section className="flex min-h-0 flex-col rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          <div className="source-heading-bar flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
            <h2 className="text-[14px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              <UiIcon name="document"/> Source
            </h2>
            <span className="source-word-count text-[14px] tabular-nums" style={{ color: "var(--muted)" }}>
              {wordCount(editingSource ? draftSource : source).toLocaleString("en-US")} words
            </span>
            <div className="ml-auto pane-actions">
              {!source && !draftSource && <button type="button" className="secondary-button" onClick={loadDemo}><UiIcon name="sparkles"/> Use demo</button>}
              {!editingSource && !constraints.some((c) => c.type === "must_cover") && <button type="button" className="text-[14px] font-medium mr-2" style={{ color: "var(--cover)" }} disabled={running} onClick={() => addMark("must_cover", { start: 0, end: source.length, rect: new DOMRect() })}>Find key ideas</button>}
              {editingSource && draftSource.trim() ? (
                <button
                  type="button"
                  onClick={() => finishEditingSource()}
                  disabled={!draftSource.trim()}
                  className="rounded-md px-2.5 py-1 text-[14px] font-medium disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Use this text
                </button>
              ) : !editingSource ? (
                <button
                  type="button"
                  onClick={() => (setDraftSource(source), setEditingSource(true), setSelection(undefined), setMarksAt(undefined), setFocus(undefined))}
                  disabled={running || extracting}
                  className="rounded-md px-2.5 py-1 text-[14px] disabled:opacity-40"
                  style={{ color: "var(--muted)" }}
                >
                  Edit text
                </button>
              ) : null}
            </div>
          </div>
          <div data-pane="source" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 font-serif text-[16.5px] leading-[1.7]" onDragOver={(e) => { if (!running && !extracting) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (!running && !extracting) void importSourceFile(e.dataTransfer.files[0]); }}>
            {editingSource ? (
              <textarea
                value={draftSource}
                onChange={(e) => { setDraftSource(e.target.value); setSelection(undefined); }}
                onSelect={(e) => selectEditableText(e.currentTarget)}
                onMouseUp={(e) => selectEditableText(e.currentTarget)}
                onKeyUp={(e) => { if (!e.altKey && e.key !== "Escape") selectEditableText(e.currentTarget); }}
                aria-describedby="source-help"
                placeholder="Paste the text you want to rewrite, or load the demo."
                aria-label="Source text"
                maxLength={500000}
                className="h-full min-h-[240px] w-full resize-none bg-transparent outline-none"
                autoFocus
              />
            ) : (
              <MarkedText text={source} ranges={sourceRanges} onSelect={running || extracting ? undefined : (s) => (setSelection(s), setSelectionHint(""), setMarksAt(undefined))} onClickOffset={onSourceClick} />
            )}
          </div>
          {editingSource && !draftSource && <button type="button" className="file-drop" disabled={importing} onClick={() => sourceFile.current?.click()}><UiIcon name="upload"/><span>{importing ? "Reading file…" : "Or drop a file here"}</span><small>.txt · .md · .pdf</small></button>}
          <input ref={sourceFile} type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" hidden onChange={(e) => { void importSourceFile(e.target.files?.[0]); e.target.value = ""; }}/>
          <p id="source-help" className="source-help">Select text, then choose a protection. You can combine protections on overlapping text.</p>
          <div className="source-bottom"><span>{wordCount(editingSource ? draftSource : source).toLocaleString("en-US")} / 50,000 words</span><div className="source-history"><button type="button" title="Undo protection or source change (Ctrl+Z / ⌘Z)" aria-label="Undo source change" disabled={!historyCount.undo || running || extracting} onClick={() => restoreHistory()}>↶ Undo</button><button type="button" title="Redo (Ctrl+Shift+Z / ⌘⇧Z)" aria-label="Redo source change" disabled={!historyCount.redo || running || extracting} onClick={() => restoreHistory(true)}>↷ Redo</button><button type="button" disabled={running || extracting} onClick={startOver}><UiIcon name="trash"/> Clear</button></div></div>
        </section>

        {/* ---------------------------------------------------------- rewrite */}
        <section className="flex min-h-0 flex-col rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
            <h2 className="text-[14px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              <UiIcon name="sparkles"/> Rewrite
            </h2>
            {rewriteWords !== undefined && (
              <span className="text-[14px] tabular-nums" style={{ color: "var(--muted)" }}>
                <AnimatedNumber value={rewriteWords} /> words
                {shorter !== undefined && shorter > 0 && (
                  <>
                    {" · "}
                    <b style={{ color: "var(--ink)" }}>{shorter}% shorter</b>
                  </>
                )}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {rewriteEdit !== undefined ? (
                <>
                  <button type="button" onClick={() => setRewriteEdit(undefined)} className="rounded-md px-2.5 py-1 text-[14px]" style={{ color: "var(--muted)" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => rewrite({ initialText: rewriteEdit })} className="rounded-md border px-2.5 py-1 text-[14px] font-medium" style={{ borderColor: "var(--line)" }}>
                    Check
                  </button>
                  <button
                    type="button"
                    onClick={() => rewrite({ initialText: rewriteEdit, repair: true })}
                    className="rounded-md px-2.5 py-1 text-[14px] font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                  >
                    Check &amp; repair
                  </button>
                </>
              ) : (
                run.draft &&
                !running && (
                  <>
                    <button type="button" className="rounded-md px-2 py-1 text-[14px]" onClick={async () => { try { await navigator.clipboard.writeText(run.draft!.text); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy"}</button>
                    <button type="button" onClick={() => (setRewriteEdit(run.draft!.text), setFocus(undefined))} className="rounded-md px-2.5 py-1 text-[14px]" style={{ color: "var(--muted)" }}>
                      Edit text
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteering((s) => !s)}
                      className="style-trigger rounded-md border px-2.5 py-1 text-[14px] font-medium"
                      style={{ borderColor: "var(--line)", background: steering ? "var(--focus-bg)" : undefined }}
                      aria-expanded={steering}
                    >
                      Change style
                    </button>
                  </>
                )
              )}
            </div>
          </div>
          <div data-pane="rewrite" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 font-serif text-[16.5px] leading-[1.7]">
            {rewriteEdit !== undefined ? (
              <textarea aria-label="Edit rewrite" value={rewriteEdit} onChange={(e) => setRewriteEdit(e.target.value)} className="h-full min-h-[240px] w-full resize-none bg-transparent outline-none" autoFocus />
            ) : run.draft ? (
              <div key={run.draft.text} className="fade-text">
                <MarkedText text={rewriteText} ranges={rewriteRanges} onClickOffset={onRewriteClick} />
              </div>
            ) : running ? (
              <div className="space-y-3 pt-1" aria-label="Writing">
                {[92, 100, 96, 70, 0, 100, 88, 94, 60].map((w, i) => (
                  <div key={i} className={w ? "shimmer h-3.5 rounded" : "h-2"} style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <div className="rewrite-empty font-sans">
                <div className="empty-document"><UiIcon name="lines"/><UiIcon name="sparkles"/></div>
                <h3>Your rewrite appears here.</h3>
                <p>Select text in Source. Click a protection button.<br />Then choose Rewrite below.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ not this */}
      {steering && run.draft && !running && (
        <form
          onSubmit={(e) => (e.preventDefault(), steerText.trim() && rewrite({ steer: steerText.trim() }))}
          className="style-feedback flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <span className="text-[13px] font-medium">Which way?</span>
          {DIRECTIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => rewrite({ steer: d.feedback })}
              className="rounded-full border px-3 py-1 text-[14px]"
              style={{ borderColor: "var(--line)" }}
            >
              {d.label}
            </button>
          ))}
          <input
            value={steerText}
            onChange={(e) => setSteerText(e.target.value)}
            placeholder="or say it: closer, but less dry"
            className="min-w-[12rem] flex-1 bg-transparent px-1 py-1 text-[13px] outline-none"
            aria-label="Direction feedback"
            autoFocus
          />
          <button
            type="submit"
            disabled={!steerText.trim()}
            className="rounded-lg px-3 py-1 text-[14px] font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Try again
          </button>
          {feedback.length > 0 && (
            <span className="w-full text-[14px]" style={{ color: "var(--muted)" }}>
              So far: {feedback.map((f) => f.split(":")[0]).join(" → ")}. Every version keeps the marked ideas.
            </span>
          )}
        </form>
      )}

      {/* ------------------------------------------------------------ coverage */}
      <section id="protected-details" className="coverage-panel flex min-h-[9rem] flex-col rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-[14px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            <UiIcon name="shield"/> Protected details
          </h2>
          <span className="w-full text-[14px] leading-relaxed" style={{ color: run.status === "error" ? "var(--missing)" : run.stage === "repairing" ? "var(--missing)" : "var(--muted)" }} aria-live="polite">
            {status || (extracting ? "Finding the key ideas…" : inventoryIncomplete ? "Extract ideas from this section, or remove its mark." : units.length ? "Select a detail to see where it appears." : "Choose what the rewrite must keep.")}
          </span>
          {Object.values(regions).some((r) => r.status === "error") && (
            <span className="text-[14px]" style={{ color: "var(--missing)" }}>
              Could not extract ideas from a region.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => constraints.filter((c) => regions[c.id]?.status === "error").forEach((c) => void extract(c))}
              >
                Retry
              </button>
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectionHint && <p className="selection-help" role="status">{selectionHint}</p>}
          {selection && <p className="selection-help" role="status">{wordCount((editingSource ? draftSource : source).slice(selection.start, selection.end))} words selected. Choose what to keep:</p>}
          <ProtectionChoices selected={Boolean(selection)} compact={rows.length > 0 && !selection} disabled={running || extracting} onChoose={chooseProtection}/>
          <Coverage
            rows={rows}
            focus={activeKey}
            onFocus={setFocus}
            onRemoveFact={(key) => { checkpoint(); setRemoved((r) => new Set([...r, key])); }}
            canRemove={!running && !extracting}
          />
          {excluded.length > 0 && <div className="excluded-list">{excluded.map(e => <div key={e.id}><span><b>Not this</b> {source.slice(e.start, e.end)}</span><button type="button" disabled={running || extracting} onClick={() => { checkpoint(); setExcluded(excluded.filter(x => x.id !== e.id)); }} aria-label="Remove exclusion">×</button></div>)}</div>}
        </div>
      </section>
      {/* ------------------------------------------------------------ instruction */}
      <form
        onSubmit={(e) => (e.preventDefault(), canRewrite && rewrite())}
        className="composer flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      >
        <label className="instruction-label" htmlFor="rewrite-instruction"><UiIcon name="pen"/>Instruction</label>
        <div className="instruction-field"><textarea
          id="rewrite-instruction"
          rows={2}
          maxLength={500}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="How should it change? e.g. Cut this to ~350 words and make it much tighter."
          className="instruction-input"
          aria-label="Rewrite instruction"
        /><span className="instruction-count">{instruction.length}/500</span></div>
        <div className="instruction-presets">{([
          ["Shorter", "Make this shorter. Keep the meaning and useful context."],
          ["Clearer", "Make this clearer and easier to read. Keep the details unchanged."],
          ["Academic", "Use a precise academic style. Keep the claims and uncertainty unchanged."],
        ] as const).map(([label, text]) => <button key={label} type="button" disabled={running} onClick={() => setInstruction(text)}>{label}</button>)}<div className="more-presets"><button type="button" aria-expanded={morePresets} onClick={() => setMorePresets(!morePresets)}>More <span aria-hidden="true">⌄</span></button>{morePresets && <div className="preset-menu">{["More friendly", "More direct", "More formal"].map(label => <button key={label} type="button" onClick={() => { setInstruction(`${label}. Keep the facts, conditions and uncertainty unchanged.`); setMorePresets(false); }}>{label}</button>)}</div>}</div></div>
        <div className="composer-writer"><span><UiIcon name="writer"/>Writer</span><ModelPicker value={writer} onChange={setWriter} disabled={running || extracting} /></div>
        <button
          type="submit"
          disabled={!canRewrite}
          className="rounded-lg px-4 py-1.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          <UiIcon name="sparkles"/>{running ? `Rewriting · ${elapsed}s` : "Rewrite"}<span aria-hidden="true">→</span>
        </button>
      </form>
      </div>
      {run.draft && <footer className="app-footer">Checks cover selected details, not factual accuracy. Review the result.</footer>}

      {/* ------------------------------------------------------------ floating toolbars */}
      {selection && !editingSource && (
        <div
          className="selection-toolbar fixed z-40 flex -translate-x-1/2 -translate-y-full gap-1 rounded-lg border p-1 shadow-lg"
          style={{ left: selection.rect.left + selection.rect.width / 2, top: selection.rect.top - 8, borderColor: "var(--line)", background: "var(--panel)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {(["keep_wording", "keep_meaning", "must_cover"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addMark(type, selection)}
              className="rounded-md px-2.5 py-1 text-[14px] font-medium hover:brightness-95"
              style={{ color: MARK_COLOR[type], background: `color-mix(in srgb, ${MARK_COLOR[type]} 10%, transparent)` }}
            >
              {MARK_LABEL[type]}
            </button>
          ))}
          <button type="button" className="rounded-md px-2.5 py-1 text-[14px] font-medium" onClick={() => excludeSelection(selection)}>Not this</button>
        </div>
      )}
      {marksAt && !selection && (
        <div
          className="mark-toolbar fixed z-40 flex -translate-x-1/2 -translate-y-full gap-1 rounded-lg border p-1 shadow-lg"
          style={{ left: marksAt.x, top: marksAt.y - 8, borderColor: "var(--line)", background: "var(--panel)" }}
        >
          {marksAt.ids.map((id) => {
            const mark = constraints.find((c) => c.id === id);
            if (!mark) return null;
            return (
              <button key={id} type="button" onClick={() => removeMark(id)} className="rounded-md px-2.5 py-1 text-[14px]" style={{ color: MARK_COLOR[mark.type] }}>
                Remove {MARK_LABEL[mark.type]}
              </button>
            );
          })}
          <button type="button" onClick={() => setMarksAt(undefined)} className="rounded-md px-2 py-1 text-[14px]" style={{ color: "var(--muted)" }} aria-label="Close">
            ×
          </button>
        </div>
      )}

      <Connector watch={`${activeKey}|${run.draft?.text.length}|${focusTrace.length}|${editingSource}|${rewriteEdit !== undefined}`} />
    </div>
  );
}
