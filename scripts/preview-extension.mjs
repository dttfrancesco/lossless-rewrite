// Local UI harness only. No extension privileges, site access, or native calls.
// Build first. This tests the actual panel bundle, not installation or host integration.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../extension/dist");
const fixture = `
const listeners=[]; const stored={};
window.chrome={
 runtime:{connect:()=>({onDisconnect:{addListener(){}},onMessage:{addListener(){}},postMessage(){throw new Error('Native messaging is unavailable in this UI harness.')}}),sendMessage:async()=>({error:'UI harness: use copy and paste.'}),getURL:path=>'/'+path},
 storage:{session:{get:async key=>({[key]:stored[key]}),set:async items=>{Object.assign(stored,items);for(const fn of listeners)fn(Object.fromEntries(Object.entries(items).map(([k,v])=>[k,{newValue:v}])),'session');}},local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}},
 permissions:{contains:async()=>false,request:async()=>false,remove:async()=>true},tabs:{create:async({url})=>window.open(url,'_blank')}
};`;
const allowed = new Map([["/", "panel.html"], ["/panel.html", "panel.html"], ["/panel.js", "panel.js"], ["/panel.css", "panel.css"], ["/README.html", "README.html"]]);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  if (path === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(fixture); return; }
  const file = allowed.get(path); if (!file) { res.writeHead(404); res.end(); return; }
  try {
    let body = await readFile(resolve(root, file), "utf8");
    if (file === "panel.html") body = body.replace('<script type="module"', '<script src="fixture.js"></script><script type="module"');
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    res.setHeader("Cache-Control", "no-store"); res.end(body);
  } catch { res.writeHead(500); res.end("Build the extension first."); }
});
server.listen(4010, "127.0.0.1", () => console.log("Extension UI harness: http://127.0.0.1:4010 (no Chrome privileges)"));
