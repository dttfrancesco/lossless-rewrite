import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { frame, FrameDecoder } from "../../companion/transport";
import type { Response } from "../../companion/protocol";

const repo = process.cwd();
const loader = pathToFileURL(join(repo,"node_modules","tsx","dist","loader.mjs")).href;
const origin = `chrome-extension://${"a".repeat(32)}/`;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "lossless companion test "));
  mkdirSync(join(root,"companion"));
  writeFileSync(join(root,"package.json"),'{"type":"module"}');
  for (const name of ["protocol.ts","transport.ts","engine.ts","session.ts","host.ts","setup.ts"]) copyFileSync(join(repo,"companion",name),join(root,"companion",name));
  symlinkSync(join(repo,"node_modules"),join(root,"node_modules"),"junction");
  symlinkSync(join(repo,"lib"),join(root,"lib"),"junction");
  return root;
}
function removeFixture(root: string) {
  // Only remove our resolved temp fixture, never follow the junction into the checkout.
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  rmSync(join(root,"lib")); rmSync(join(root,"node_modules"));
  rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
async function exercise(executable: string, args: string[], cwd: string) {
  const child = spawn(executable,args,{cwd,stdio:["pipe","pipe","pipe"],windowsHide:true,env:{...process.env,LLM_PROVIDER:"codex-cli",LLM_MODEL:"default"}});
  let stderr = "";
  child.stderr.on("data", data=>{stderr += data.toString();});
  const replies: Response[]=[];
  const waiting = new Map<string,{resolve:(value:Response)=>void;reject:(reason:Error)=>void}>();
  const decoder = new FrameDecoder(raw=>{
    const reply = raw as Response; replies.push(reply);
    if(reply.type === "result" || reply.type === "error") {const receiver = waiting.get(reply.requestId);waiting.delete(reply.requestId);receiver?.resolve(reply);}
  });
  child.stdout.on("data", data=>decoder.push(data));
  child.on("error",error=>{for(const promise of waiting.values())promise.reject(error);});
  child.on("exit",code=>{for(const promise of waiting.values())promise.reject(new Error(`Host exited ${code}: ${stderr}`));});
  async function call(operation:string,payload:unknown,id:string) {
    const result = new Promise<Response>((resolve,reject)=>waiting.set(id,{resolve,reject}));
    child.stdin.write(frame({version:1,requestId:id,documentId:"doc",revision:1,operation,payload}));
    return result;
  }
  const timeout = setTimeout(()=>child.kill(),15_000);
  try {
    const hello = await call("hello",{},"hello"); assert.equal(hello.type,"result");
    assert.equal((hello.payload as {protocolVersion:number}).protocolVersion,1);
    const models = await call("models.list",{},"models"); assert.equal(models.type,"result");
    assert.ok((models.payload as {providers:unknown[]}).providers.length >= 7);
    const source = "Keep THIS sentence.";
    const check = await call("check",{source,instruction:"Shorten to one word",constraints:[{id:"c1",type:"keep_wording",start:0,end:source.length,text:source}],facts:[],initialText:source,maxTightens:2},"check");
    assert.equal(check.type,"result");
    const final = (check.payload as {final:{text:string;verification:{wording:{kept:boolean}[]}}}).final;
    assert.equal(final.text,source); assert.equal(final.verification.wording[0]?.kept,true);
    assert.equal(stderr,"");
    assert.ok(replies.some(r=>r.type==="event"));
  } finally {
    clearTimeout(timeout);
    const exited = new Promise<void>(resolve=>child.once("exit",()=>resolve()));
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) {
      const fallback = setTimeout(()=>child.kill(),2000);
      await exited;
      clearTimeout(fallback);
    }
  }
}

test("actual source-run host speaks framed hello/models/check in isolated temp checkout", {timeout:20_000}, async()=>{
  const root = fixture();
  try {
    writeFileSync(join(root,"companion","local-config.json"),JSON.stringify({allowedOrigins:[origin]}));
    await exercise(process.execPath,["--import",loader,join(root,"companion","host.ts"),origin],root);
    const denied = spawnSync(process.execPath,["--import",loader,join(root,"companion","host.ts"),"https://chatgpt.com/"],{cwd:root,encoding:"utf8",windowsHide:true});
    assert.equal(denied.status,1); assert.equal(denied.stdout,""); assert.match(denied.stderr,/not allowed/);
  } finally {removeFixture(root);}
});

test("generated native launcher builds and relays binary frames with spaces in its path", {timeout:30_000},async t=>{
  if(process.platform==="win32" && !existsSync(join(process.env.WINDIR ?? "C:\\Windows","Microsoft.NET","Framework64","v4.0.30319","csc.exe"))) {t.skip("Windows .NET compiler unavailable; source-run host tested separately");return;}
  const root = fixture();
  try {
    const setup = spawnSync(process.execPath,["--import",loader,join(root,"companion","setup.ts"),"--extension-id","a".repeat(32)],{cwd:root,encoding:"utf8",windowsHide:true});
    assert.equal(setup.status,0,setup.stderr);
    const local = join(root,"companion","local");
    if(process.platform==="win32") {
      const compile = spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",join(local,"build-launcher.ps1")],{cwd:root,encoding:"utf8",windowsHide:true});
      assert.equal(compile.status,0,compile.stdout + compile.stderr);
    }
    await exercise(join(local,process.platform==="win32"?"lossless-host.exe":"lossless-host"),[origin],root);
  } finally {removeFixture(root);}
});
