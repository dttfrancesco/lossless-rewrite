"use client";

import { useLayoutEffect, useState } from "react";

interface Geometry {
  path: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function visibleCenterY(element: HTMLElement, pane: HTMLElement): number | undefined {
  const rect = element.getClientRects()[0] ?? element.getBoundingClientRect();
  const bounds = pane.getBoundingClientRect();
  const y = rect.top + rect.height / 2;
  return y >= bounds.top && y <= bounds.bottom ? y : undefined;
}

/**
 * A line from the selected idea's origin in the source pane to where it survived in the
 * rewrite pane. It follows scrolling and hides when either end is out of view.
 */
export function Connector({ watch }: { watch: unknown }) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const compute = () => {
      const sourcePane = document.querySelector<HTMLElement>('[data-pane="source"]');
      const rewritePane = document.querySelector<HTMLElement>('[data-pane="rewrite"]');
      const from = sourcePane?.querySelector<HTMLElement>("[data-focus]");
      const to = rewritePane?.querySelector<HTMLElement>("[data-focus]");
      if (!sourcePane || !rewritePane || !from || !to) return setGeometry(null);
      const y1 = visibleCenterY(from, sourcePane);
      const y2 = visibleCenterY(to, rewritePane);
      if (y1 === undefined || y2 === undefined) return setGeometry(null);
      const x1 = sourcePane.getBoundingClientRect().right - 6;
      const x2 = rewritePane.getBoundingClientRect().left + 6;
      const bend = Math.max(24, (x2 - x1) * 0.6);
      setGeometry({
        path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        from: { x: x1, y: y1 },
        to: { x: x2, y: y2 },
      });
    };
    // Scroll events come in bursts; draw at most once per frame.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    compute();
    // Scrolling panes into view takes a moment; follow it.
    const settle = window.setInterval(compute, 120);
    const stop = window.setTimeout(() => window.clearInterval(settle), 900);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(settle);
      window.clearTimeout(stop);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [watch]);

  if (!geometry) return null;
  return (
    <svg className="trace-connector pointer-events-none fixed inset-0 z-30 h-full w-full" aria-hidden="true">
      <path d={geometry.path} fill="none" stroke="var(--focus-line)" strokeWidth={2} className="connector" />
      <circle cx={geometry.from.x} cy={geometry.from.y} r={4} fill="var(--focus-line)" />
      <circle cx={geometry.to.x} cy={geometry.to.y} r={4} fill="var(--focus-line)" />
    </svg>
  );
}
