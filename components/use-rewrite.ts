"use client";

import { useCallback, useRef, useState } from "react";
import type { Verification } from "@/lib/coverage/verify";
import type { RewriteRequest } from "@/lib/rewrite/pipeline";
import type { PipelineEvent, RewriteResult, Stage } from "@/lib/rewrite/types";
import type { Sentence } from "@/lib/text/sentences";

export interface Draft {
  attempt: number;
  text: string;
  sentences: Sentence[];
  words: number;
}

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  stage?: Stage;
  stageIds?: string[];
  draft?: Draft;
  /** The current draft's verification; undefined while it is being checked. */
  verification?: Verification;
  /** Verification of the previous draft, to show what a repair fixed. */
  previous?: Verification;
  result?: RewriteResult;
  error?: string;
}

const IDLE: RunState = { status: "idle" };

export function reduce(state: RunState, event: PipelineEvent): RunState {
  switch (event.type) {
    case "stage":
      return { ...state, stage: event.stage, stageIds: event.ids };
    case "draft":
      return {
        ...state,
        draft: { attempt: event.attempt, text: event.text, sentences: event.sentences, words: event.words },
        previous: state.verification ?? state.previous,
        verification: undefined,
      };
    case "verified":
      return { ...state, verification: event.verification };
    case "done": {
      const final = event.result.final;
      // SSE JSON duplicates `final`; object identity does not survive the wire.
      const finalIndex = event.result.attempts.findLastIndex((a) => a.text === final.text && a.pass === final.pass);
      return {
        ...state,
        status: "done",
        stage: undefined,
        stageIds: undefined,
        result: event.result,
        draft: { attempt: finalIndex, text: final.text, sentences: final.sentences, words: final.words },
        verification: final.verification,
        previous: event.result.attempts.slice(0, finalIndex).find((a) => a.verification.units.some((u) => u.status === "missing" || u.status === "altered") || a.verification.wording.some((w) => !w.kept))?.verification,
      };
    }
    case "error":
      return { ...state, status: "error", stage: undefined, error: event.message };
  }
}

/** Runs the rewrite pipeline on the server and follows its event stream. */
export function useRewrite() {
  const [state, setState] = useState<RunState>(IDLE);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async (request: RewriteRequest, keepDraft = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState((s) => ({ status: "running", draft: keepDraft ? s.draft : undefined, verification: undefined }));
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `The server answered ${response.status}.`);
      }
      if (!response.body) throw new Error("The server returned an empty response.");
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let terminal = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (data) {
            const event = JSON.parse(data.slice(6)) as PipelineEvent;
            if (controller.signal.aborted) return;
            terminal ||= event.type === "done" || event.type === "error";
            setState((s) => reduce(s, event));
          }
        }
      }
      if (!terminal && !controller.signal.aborted) throw new Error("The connection ended before verification finished. Please retry.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((s) => ({ ...s, status: "error", stage: undefined, error: error instanceof Error ? error.message : String(error) }));
    }
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState(IDLE);
  }, []);

  return { state, start, reset };
}
