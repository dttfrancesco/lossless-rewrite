"use client";

import { useEffect, useEffectEvent } from "react";

/** Keep clicks inside a popup (and its trigger) intact; dismiss everywhere else. */
export function useDismiss(open: boolean, inside: string, onDismiss: () => void) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) {
      if (event.target instanceof Element && !event.target.closest(inside)) dismiss();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open, inside]);
}
