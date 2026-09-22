"use client";

import { useMemo, useRef } from "react";
import { segments, snapToWords, type Range } from "@/lib/ui/segments";

export interface TextSelection {
  start: number;
  end: number;
  /** Viewport rectangle of the selection, for placing a toolbar. */
  rect: DOMRect;
}

/**
 * Plain text rendered as flat spans, one per run of identical marks. Every span carries its
 * character offset, so a DOM selection maps back to offsets in `text`.
 */
export function MarkedText({
  text,
  ranges,
  onSelect,
  onClickOffset,
  className,
}: {
  text: string;
  ranges: Range[];
  onSelect?: (selection: TextSelection | undefined) => void;
  onClickOffset?: (offset: number, keys: string[]) => void;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => segments(text, ranges), [text, ranges]);

  function offsetAt(node: Node, offset: number): number | undefined {
    const container = root.current;
    if (!container) return undefined;
    if (node.nodeType === Node.TEXT_NODE) {
      const span = node.parentElement?.closest<HTMLElement>("[data-offset]");
      if (!span || !container.contains(span)) return undefined;
      return Number(span.dataset.offset) + offset;
    }
    if (node === container) {
      const child = container.children[offset] as HTMLElement | undefined;
      return child?.dataset.offset !== undefined ? Number(child.dataset.offset) : text.length;
    }
    const span = (node as HTMLElement).closest?.<HTMLElement>("[data-offset]");
    if (!span || !container.contains(span)) return undefined;
    return Number(span.dataset.offset) + (offset > 0 ? (span.textContent?.length ?? 0) : 0);
  }

  function handleMouseUp(event: React.MouseEvent | React.KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      onSelect?.(undefined);
      const span = (event.target as HTMLElement).closest<HTMLElement>("[data-offset]");
      if (span && onClickOffset) {
        onClickOffset(Number(span.dataset.offset), (span.dataset.keys ?? "").split(" ").filter(Boolean));
      }
      return;
    }
    const a = offsetAt(selection.anchorNode!, selection.anchorOffset);
    const b = offsetAt(selection.focusNode!, selection.focusOffset);
    if (a === undefined || b === undefined) return onSelect?.(undefined);
    const { start, end } = snapToWords(text, a, b);
    if (end - start < 2) return onSelect?.(undefined);
    onSelect?.({ start, end, rect: selection.getRangeAt(0).getBoundingClientRect() });
  }

  return (
    <div ref={root} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? "Source passages" : undefined} onMouseUp={handleMouseUp} onKeyUp={event => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") handleMouseUp(event); }} className={`whitespace-pre-wrap ${className ?? ""}`}>
      {parts.map((part) => (
        <span
          key={part.start}
          data-offset={part.start}
          data-keys={part.keys.join(" ") || undefined}
          data-focus={part.classes.includes("mk-focus") ? "true" : undefined}
          className={part.classes.join(" ") || undefined}
        >
          {part.text}
        </span>
      ))}
    </div>
  );
}
