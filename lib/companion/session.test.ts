import test from "node:test";
import assert from "node:assert/strict";
import { CompanionSession } from "../../companion/session";
import { checkOnly, execute } from "../../companion/engine";
import type { Request, Response } from "../../companion/protocol";
import type { DecisionClient } from "../decision/client";

const request = (operation: Request["operation"], payload: unknown, requestId = "one"): Request => ({version:1, requestId, documentId:"doc", revision:1, operation,payload});
const source = "Delivery costs $5. Returns within 30 days.";
const base = {source, instruction:"Make this shorter, target 1 word.",constraints:[{id:"c1",type:"keep_wording",start:0,end:18,text:"Delivery costs $5."}],facts:[],initialText:source,maxTightens:2,maxRepairs:2};

test("check-only preserves the entire draft and exact raw offsets with no network", async () => {
  const result = await checkOnly(base);
  assert.equal(result.final.text, source);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.final.pass,"edit");
  assert.deepEqual(result.final.verification.wording[0]?.location, {start:0,end:18});
  const changed = await checkOnly({...base,initialText:source.replace("costs", "costs  ")});
  assert.equal(changed.final.verification.wording[0]?.kept,false);
  const empty = await checkOnly({...base,constraints:[]});
  assert.equal(empty.final.verification.units.length + empty.final.verification.wording.length,0);
});

test("check-only semantic evidence uses the shared verifier without generating text", async () => {
  let calls = 0;
  const client = { config:{provider:"jev"}, ask:async () => { calls++; return {answers:{"P1::present":{noul:0.98},"P1::trace":{probabilities:{S1:1}}},ms:3,inputTokens:9}; } } as unknown as DecisionClient;
  const result = await checkOnly({...base,constraints:[{...base.constraints[0],type:"keep_meaning"}]},undefined,client);
  assert.equal(calls,1);
  assert.equal(result.final.verification.units[0]?.status,"kept");
  assert.equal(result.final.text,source);
});

test("uncertain and missing evidence never escalates to a writer, even with legacy writer settings", async () => {
  const previous = process.env.LLM_PROVIDER;
  // Any attempted fallback fails immediately instead of making a paid call.
  process.env.LLM_PROVIDER = "forbidden-in-extension-checks";
  try {
    for (const [score, expected] of [[0.5,"uncertain"],[0.05,"missing"],[0.99,"kept"]] as const) {
      let calls = 0;
      const events: unknown[] = [];
      const client = { config:{provider:"jev"}, ask:async () => { calls++; return {answers:{"P1::present":{noul:score},"P1::trace":{probabilities:{NOT_PRESENT:1}}},ms:3,inputTokens:9}; } } as unknown as DecisionClient;
      const result = await checkOnly({...base,writerModel:"sonnet",constraints:[{...base.constraints[0],type:"keep_meaning"}]},e=>events.push(e),client);
      assert.equal(calls,1);
      assert.equal(result.final.verification.units[0]?.status,expected);
      assert.equal(result.final.verification.units[0]?.decidedBy,"decision");
      assert.equal(result.final.verification.adjudicationMs,0);
      assert.equal(result.final.verification.escalated,0);
      assert.equal(result.final.text,source);
      assert.doesNotMatch(JSON.stringify(events),/adjudicating|repairing|writing/);
    }
    const hello = await execute("hello",{},()=>{});
    assert.equal((hello as {checkMode:string}).checkMode,"decision-only-v1");
    for (const operation of ["extract","rewrite"] as const) await assert.rejects(execute(operation,base,()=>{}),/Unsupported/);
  } finally {
    if (previous === undefined) delete process.env.LLM_PROVIDER; else process.env.LLM_PROVIDER=previous;
  }
});

test("legacy extraction and rewrite requests are rejected before inference", async () => {
  const replies: Response[]=[];
  let calls=0;
  const session=new CompanionSession(r=>replies.push(r),async()=>{calls++;});
  for (const operation of ["extract","rewrite"] as const) await session.receive(request(operation,base,operation));
  assert.equal(calls,0);
  assert.equal(replies.filter(r=>r.type==="error").length,2);
});

test("session validates source before inference and does not leak provider error text", async () => {
  const replies: Response[]=[];
  let calls = 0;
  const session = new CompanionSession(r => replies.push(r), async () => {calls++;throw new Error("sk-secret credential and private document");});
  await session.receive(request("check",{...base,source:"different"}));
  assert.equal(calls,0);
  await session.receive(request("check",base,"two"));
  assert.equal(calls,1);
  assert.equal(replies.at(-1)?.type,"error");
  assert.doesNotMatch(JSON.stringify(replies),/sk-secret|private document/);
});

test("duplicate requests are idempotent; changed input with same ID is rejected", async () => {
  const replies: Response[]=[];
  let calls = 0;
  const session = new CompanionSession(r => replies.push(r),async () => {calls++;return {ok:true};});
  const input = request("check",base);
  await session.receive(input);
  await session.receive(input);
  assert.equal(calls,1);
  assert.equal(replies.at(-1)?.type,"status");
  await session.receive({...input,payload:{...base,instruction:"New"}});
  assert.equal(calls,1);
  assert.equal(replies.at(-1)?.type,"error");
  assert.deepEqual(replies.map(r=>r.sequence),[1,2,3,4]);
});

test("detach cancellation suppresses late success and keeps inference slot until completion", async () => {
  const replies: Response[]=[];
  let finish!: (value: unknown) => void;
  const pending = new Promise(resolve => {finish=resolve;});
  const session = new CompanionSession(r=>replies.push(r),async ()=>pending);
  const running = session.receive(request("check",base));
  await session.receive(request("cancel",{runId:"one"},"cancel"));
  assert.match(JSON.stringify(replies.at(-1)?.payload),/may finish/);
  await session.receive(request("check",base,"another"));
  assert.equal(replies.at(-1)?.type,"error");
  finish({shouldNeverDisplay:true}); await running;
  assert.equal(replies.some(r=>r.requestId==="one" && r.type==="result"),false);
  await session.receive({...request("run.status",{runId:"one"},"stale"),revision:2});
  assert.equal(replies.at(-1)?.type,"error");
});

