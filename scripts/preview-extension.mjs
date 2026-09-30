// Local UI harness only. No extension privileges, site access, or native calls.
// Build first. This tests the actual panel bundle, not installation or host integration.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from 'esbuild';
const root = resolve(import.meta.dirname, "../extension/dist");
const protectionFixture = (await build({ entryPoints: [resolve(import.meta.dirname, 'extension-protection-fixture.js')], bundle: true, format: 'iife', write: false })).outputFiles[0].text;
const fixture = `
const listeners=[]; const stored={}; let granted=false;
document.addEventListener('DOMContentLoaded',()=>{const banner=document.createElement('p');banner.textContent='Local UI test: permissions and chat access are simulated.';banner.style.cssText='padding:10px;margin:0;background:#fff0ce;color:#403919;font:14px system-ui';document.body.prepend(banner);});
window.chrome={
 runtime:{connect:()=>({onDisconnect:{addListener(){}},onMessage:{addListener(){}},postMessage(){throw new Error('Native messaging is unavailable in this UI harness.')}}),sendMessage:async m=>m.action==='activate'?{activated:true,available:true,tabId:1}:{error:'UI harness: use copy and paste.'},getURL:path=>'/'+path},
 storage:{session:{get:async key=>({[key]:stored[key]}),set:async items=>{Object.assign(stored,items);for(const fn of listeners)fn(Object.fromEntries(Object.entries(items).map(([k,v])=>[k,{newValue:v}])),'session');}},local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}},
 permissions:{contains:async()=>granted,request:async()=>{granted=true;return true;},remove:async()=>{granted=false;return true;}},tabs:{query:async()=>[{id:1,...(granted?{url:'https://chatgpt.com/'}:{})}],create:async({url})=>window.open(url,'_blank')}
};`;
const allowed = new Map([["/", "panel.html"], ...['icons/mark.svg','plans.html','plans.css','panel.html','panel.js','content.js','panel.css','README.html','reference.html','reference.js','reference.css','pdf.worker.mjs','pdf_viewer.css'].map(f=>['/'+f,f])]);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  if (path === "/chat-fixture.html") { res.setHeader("Content-Type", "text/html"); res.end(await readFile(resolve(import.meta.dirname, "extension-chat-fixture.html"), "utf8")); return; }
  if (path === '/fixture-protections.js') { res.setHeader('Content-Type','text/javascript'); res.end(protectionFixture); return; }
  if (/^\/(standard_fonts|cmaps)\/[a-zA-Z0-9_.-]+$/.test(path)) { try { res.end(await readFile(resolve(root, path.slice(1)))); } catch { res.writeHead(404); res.end(); } return; }
  if (path === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(fixture); return; }
  const file = allowed.get(path); if (!file) { res.writeHead(404); res.end(); return; }
  try {
    let body = await readFile(resolve(root, file), "utf8");
    if (file === "panel.html") body = body.replace('<script type="module"', '<script src="fixture.js"></script><script type="module"');
    if (file === 'reference.html') body = body.replace('<script type="module"', '<script src="fixture-protections.js"></script><script type="module"');
    res.setHeader("Content-Type", /\.m?js$/.test(file) ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "text/html");
    res.setHeader("Cache-Control", "no-store"); res.end(body);
  } catch { res.writeHead(500); res.end("Build the extension first."); }
});
server.listen(4010, "127.0.0.1", () => console.log("Extension UI harness: http://127.0.0.1:4010 (no Chrome privileges)"));
