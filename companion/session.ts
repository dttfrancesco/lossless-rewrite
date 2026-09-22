import { createHash } from "node:crypto";
import { z } from "zod";
import { execute, validateEnginePayload } from "./engine";
import { requestSchema, type Request, type Response } from "./protocol";
import type { PipelineEvent } from "../lib/rewrite/types";

type Run = { request: Request; fingerprint: string; sequence: number; status: "running" | "completed" | "failed" | "detached"; result?: unknown; detached: boolean };
type Execute = (operation: Request["operation"], payload: unknown, emit: (event: PipelineEvent) => void) => Promise<unknown>;
const referenceSchema = z.object({ runId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) }).strict();
export class CompanionSession {
  private runs = new Map<string, Run>();
  private busy = false;
  constructor(private readonly send: (response: Response) => void, private readonly engine: Execute = execute) {}
  async receive(raw: unknown) {
    const request = requestSchema.parse(raw);
    const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");
    const previous = this.runs.get(request.requestId);
    if (previous) {
      this.reply(previous, previous.fingerprint === fingerprint ? "status" : "error", previous.fingerprint === fingerprint ? { runId: request.requestId, status: previous.status, result: previous.result } : { code: "ID_CONFLICT", message: "Use a new request ID for changed input." });
      return;
    }
    // Never evict IDs inside a session: retrying an evicted ID could duplicate a paid run.
    if (this.runs.size >= 256) { this.reply({request, sequence: 0}, "error", {code: "SESSION_LIMIT", message: "Session request limit reached. Reconnect without retrying unfinished runs."}); return; }
    const run: Run = { request, fingerprint, sequence: 0, status: "running", detached: false };
    this.runs.set(request.requestId, run);
    let ownsBusy = false;
    try {
      if (request.operation === "cancel" || request.operation === "run.status") {
        const { runId } = referenceSchema.parse(request.payload);
        const target = this.runs.get(runId);
        if (target && (target.request.documentId !== request.documentId || target.request.revision !== request.revision)) throw new Error("Revision mismatch");
        if (request.operation === "cancel" && target?.status === "running") { target.detached = true; target.status = "detached"; }
        run.result = { runId, status: target?.status ?? "unknown", result: target?.result, ...(request.operation === "cancel" ? {detail: "Stopped listening. The current request may finish; provider work is not cancelled."} : {}) };
      } else {
        const inference = ["extract", "check", "rewrite"].includes(request.operation);
        if (inference) {
          validateEnginePayload(request.operation, request.payload);
          if (this.busy) throw new Error("Another request is still running");
          this.busy = ownsBusy = true;
        } else z.object({}).strict().parse(request.payload);
        this.reply(run, "accepted", { runId: request.requestId });
        run.result = await this.engine(request.operation, request.payload, event => {
          if (!run.detached && event.type !== "done") this.reply(run, "event", event);
        });
      }
      if (!run.detached) { run.status = "completed"; this.reply(run, "result", run.result); }
      else run.result = undefined;
    } catch (error) {
      run.status = run.detached ? "detached" : "failed";
      // Provider/CLI exception strings may include request bodies, endpoints or credentials.
      const message = error instanceof z.ZodError ? "Invalid request payload. Check source spans, requirements and pass limits." : "Operation failed. Check local credentials, connection and model configuration; another run may still be active.";
      if (!run.detached) this.reply(run, "error", { code: "OPERATION_FAILED", message });
    } finally {
      if (ownsBusy) this.busy = false;
      // IDs/fingerprints remain, but avoid retaining every source and evidence object.
      run.request = { ...run.request, payload: undefined };
      let retained = 0;
      for (const previous of [...this.runs.values()].reverse()) {
        if (previous.result === undefined) continue;
        retained += Buffer.byteLength(JSON.stringify(previous.result), "utf8");
        if (retained > 8 * 1024 * 1024) previous.result = undefined;
      }
    }
  }
  private reply(run: { request: Request; sequence: number }, type: Response["type"], payload: unknown) {
    this.send({ version: 1, requestId: run.request.requestId, documentId: run.request.documentId, revision: run.request.revision, sequence: ++run.sequence, type, payload });
  }
}
