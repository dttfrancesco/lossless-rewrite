"use client";
import { UiIcon } from "./ui-icon";

export type UnitKind = "must_cover" | "keep_meaning" | "keep_wording";
export type UnitState = "pending" | "extracting" | "checking" | "kept" | "missing" | "altered" | "uncertain";

export interface UnitView {
  /** Display id: F1…, P1…, W1…. */
  id: string;
  /** Stable key across renumbering. */
  key: string;
  kind: UnitKind;
  text: string;
  /** Where the unit comes from in the source. */
  spans: Array<{ start: number; end: number }>;
  regionId?: string;
}

export interface UnitRow extends UnitView {
  state: UnitState;
  /** Paragraph numbers in the rewrite that carry it. */
  paragraphs: number[];
  reason?: string;
  /** It was missing or altered in the previous draft and is back now. */
  repaired: boolean;
}

const KIND_LABEL: Record<UnitKind, string> = {
  must_cover: "Must cover",
  keep_meaning: "Keep meaning",
  keep_wording: "Keep wording",
};

const KIND_COLOR: Record<UnitKind, string> = {
  must_cover: "var(--cover)",
  keep_meaning: "var(--meaning)",
  keep_wording: "var(--wording)",
};

function StateIcon({ state, repaired }: { state: UnitState; repaired: boolean }) {
  const base = "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold";
  switch (state) {
    case "kept":
      return (
        <span className={`${base} ${repaired ? "flip-in" : ""}`} style={{ background: "var(--kept)", color: "var(--panel)" }} aria-label="kept">
          ✓
        </span>
      );
    case "missing":
      return (
        <span className={`${base} flip-in`} style={{ background: "var(--missing)", color: "var(--panel)" }} aria-label="missing">
          ✕
        </span>
      );
    case "altered":
      return (
        <span className={`${base} flip-in`} style={{ background: "var(--altered)", color: "var(--panel)" }} aria-label="meaning changed">
          ≠
        </span>
      );
    case "uncertain":
      return (
        <span className={base} style={{ background: "var(--uncertain)", color: "var(--panel)" }} aria-label="uncertain">
          ?
        </span>
      );
    case "checking":
    case "extracting":
      return (
        <span
          className={`${base} animate-spin border-2 border-t-transparent`}
          style={{ borderColor: "var(--faint)", borderTopColor: "transparent" }}
          aria-label={state}
        />
      );
    default:
      return <span className={`${base} border`} style={{ borderColor: "var(--line)" }} aria-label="not checked yet" />;
  }
}

export function Coverage({
  rows,
  focus,
  onFocus,
  onRemoveFact,
  canRemove,
}: {
  rows: UnitRow[];
  focus?: string;
  onFocus: (key: string | undefined) => void;
  onRemoveFact: (key: string) => void;
  canRemove: boolean;
}) {
  if (!rows.length) return null;
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 py-2 lg:grid-cols-2">
      {rows.map((row) => {
        const active = focus === row.key;
        return (
          <li key={row.key}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onFocus(row.key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onFocus(row.key))}
              className="group flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-colors"
              style={{ background: active ? "var(--focus-bg)" : undefined }}
              title={row.reason ? `${row.text}\n\n${row.reason}` : row.text}
            >
              <StateIcon state={row.state} repaired={row.repaired} />
              <span className="w-7 shrink-0 font-semibold tabular-nums" style={{ color: KIND_COLOR[row.kind] }}>
                {row.id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2">{row.text}</span>
                {(row.state === "missing" || row.state === "altered" || row.state === "uncertain") && (
                  <span className="mt-0.5 block text-[12px]" style={{ color: row.state === "uncertain" ? "var(--uncertain)" : row.state === "missing" ? "var(--missing)" : "var(--altered)" }}>
                    {row.state === "missing" ? "Missing" : row.state === "altered" ? "Meaning changed" : "Unsure"}
                    {row.reason ? ` — ${row.reason}` : ""}
                  </span>
                )}
                {row.repaired && row.state === "kept" && (
                  <span className="mt-0.5 block text-[12px]" style={{ color: "var(--kept)" }}>
                    Repaired
                  </span>
                )}
              </span>
              <span className="shrink-0 pt-0.5 text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>
                {row.state === "kept" && row.paragraphs.length ? `→ ¶${row.paragraphs.join(", ¶")}` : KIND_LABEL[row.kind]}
              </span>
              {canRemove && row.kind === "must_cover" && (
                <button
                  type="button"
                  onClick={(e) => (e.stopPropagation(), onRemoveFact(row.key))}
                  className="shrink-0 rounded px-1 text-[13px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  style={{ color: "var(--muted)" }}
                  aria-label={`Remove ${row.id}`}
                  title="Don't require this idea"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}


export function ProtectionChoices({ selected, compact, disabled, onChoose }: {
  selected: boolean;
  compact: boolean;
  disabled: boolean;
  onChoose: (kind: UnitKind | "exclude") => void;
}) {
  const choices = [
    { kind: "keep_wording", label: "Keep wording", description: "Keep the exact words.", icon: "quote", card: "wording", key: "S" },
    { kind: "keep_meaning", label: "Keep meaning", description: "Keep the idea; wording can change.", icon: "leaf", card: "meaning", key: "M" },
    { kind: "must_cover", label: "Must cover", description: "Turn a section into a checklist of ideas.", icon: "list", card: "cover", key: "C" },
    { kind: "exclude", label: "Not this", description: "Leave this passage out.", icon: "ban", card: "exclude", key: "X" },
  ] as const;
  return <div className={`coverage-empty protection-choices${compact ? " compact" : ""}`} data-protection-actions>
    {choices.map(choice => <button key={choice.kind} type="button"
      className={`mark-explainer ${choice.card}-card`} disabled={disabled}
      aria-label={choice.label} aria-keyshortcuts={`Alt+${choice.key}`}
      onMouseDown={event => event.preventDefault()} onClick={() => onChoose(choice.kind)}>
      <UiIcon name={choice.icon}/><span><b>{choice.label}</b>{!compact && <span className="choice-description">{choice.description}</span>}</span>
      {!compact && <kbd>Alt+{choice.key}</kbd>}
    </button>)}
    {!compact && <p className="protection-tip"><UiIcon name="bulb"/><span>{selected ? "Selection ready. Click a button above, or hold Alt and press its letter." : "Select text in Source, then click a button above. Repeat for other passages, then Rewrite."}</span></p>}
  </div>;
}
