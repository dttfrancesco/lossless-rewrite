import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./background.js', import.meta.url))],
  bundle: true, write: false, format: 'iife',
  plugins: [{name: 'account-test-services', setup(builder) {
    builder.onResolve({filter: /\/cloud\.js$|\/protection-store\.js$|\/native-check\.js$/}, args => ({path: args.path, namespace: 'test'}));
    builder.onLoad({filter: /.*/, namespace: 'test'}, ({path}) => ({contents:
      path.endsWith('cloud.js') ? 'export const session=()=>fixture.session; export const cloudCall=body=>fixture.cloudCall(body);' :
      path.endsWith('protection-store.js') ? 'export const protectionMessage=async()=>({context:fixture.context}); export const forgetProtectionTab=async()=>{};' :
      'export const nativeCheck=()=>{throw new Error("Unexpected companion call")};'
    }));
  }}],
});

function worker({plan='pro', credits=1, signedIn=true, type='keep_meaning',rules=[],ruleOnly=false}={}) {
  let listener,connectListener;const prefs={};const uiMessages=[];const opened=[],panelOptions=[];
  const calls=[];
  const event={addListener(){}};
  const context={scope:'chat:1',rules,items:ruleOnly?[]:[{id:'passage',type,text:'No control group.',source:{label:'Chat'}}]};
  const fixture={context,session:signedIn?{user:{id:'test'}}:null,cloudCall:async body=>{
    calls.push(body.action);
    if(body.action==='account')return {plan};
    if(body.action==='quote')return {credits};
    return {mode:'jev',items:body.items.map(i=>({status:i.type==='writing_rule'?'uncertain':'kept'}))};
  }};
  const chrome={
    sidePanel:{setPanelBehavior:async()=>{},setOptions:async options=>{panelOptions.push(options);},open:options=>{opened.push(options);return Promise.resolve();}},
    storage:{session:{setAccessLevel(){}},local:{setAccessLevel(){},get:async()=>({cloudCheckConsent:false,...prefs}),set:async v=>Object.assign(prefs,v)}},
    tabs:{onRemoved:event,query:async filter=>[{id:1,windowId:10},{id:2,windowId:20}].filter(t=>!filter.windowId||t.windowId===filter.windowId),sendMessage:async(id,message)=>uiMessages.push({id,message})},
    permissions:{contains:async()=>false,onAdded:event,onRemoved:event},
    scripting:{getRegisteredContentScripts:async()=>[]},
    runtime:{id:'test',onConnect:{addListener(fn){connectListener=fn;}},onMessage:{addListener(fn){listener=fn;}},getURL:path=>'chrome-extension://test/'+path},
  };
  vm.runInNewContext(bundled.outputFiles[0].text,{fixture,chrome,TextEncoder,TextDecoder,URL,crypto:webcrypto});
  const send=(options={})=>new Promise(resolve=>listener({kind:'inline-check',scope:context.scope,items:context.items,rules:context.rules,reply:'No control group.',automatic:true,...options},{id:'test',tab:{id:1},frameId:0,url:'https://chatgpt.com/c/test'},resolve));
  const sender={id:'test',tab:{id:1,windowId:10},frameId:0,url:'https://chatgpt.com/c/test'};
  const ui=(action,extra={})=>new Promise(resolve=>listener({kind:'inline-ui',action,...extra},sender,resolve));
  const panel=()=>{let receive,disconnect;const messages=[];const p={name:'lossless-panel',sender:{id:'test',url:'chrome-extension://test/panel.html'},postMessage:m=>messages.push(m),onMessage:{addListener(fn){receive=fn;}},onDisconnect:{addListener(fn){disconnect=fn;}}};connectListener(p);return {messages,set:(windowId,visible)=>receive({kind:'panel-presence',windowId,visible}),close:()=>disconnect()};};
  return {send,calls,ui,uiMessages,opened,panel,panelOptions,dispatch:(m,s)=>listener(m,s,()=>{})};
}

test('writing-rules shortcut opens immediately and reaches only the visible panel in its window',async()=>{
  const w=worker(),other=w.panel();other.set(20,true);
  const opening=w.ui('open-rules');assert.equal(w.opened.length,1);
  assert.equal((await opening).opened,true);assert.equal(w.panelOptions[0].path,'panel.html');
  assert.equal(other.messages.length,0);
  const p=w.panel();p.set(10,false);assert.equal(p.messages.length,0);
  p.set(10,true);assert.equal(p.messages[0].kind,'open-writing-rules');
  p.set(10,true);assert.equal(p.messages.length,1);
  await w.ui('open-rules');assert.equal(p.messages.length,2);
  assert.deepEqual(w.calls,[]);
});

test('signed-in private account checks automatically even with old consent set to false', async()=>{
  const w=worker();
  assert.equal((await w.send()).mode,'jev');
  assert.deepEqual(w.calls,['account','quote','check']);
});

test('removals reach hosted checks and are never silently accepted by a local-only check',async()=>{
 const w=worker({type:'remove'});assert.equal((await w.send()).items[0].type,'remove');
 assert.deepEqual(w.calls,['account','quote','check']);
 const local=worker({type:'remove',signedIn:false});assert.match((await local.send()).error,/removals/);assert.deepEqual(local.calls,[]);
});

test('rule-only checks call Jev, preserve uncertainty, and reject a changed rule snapshot',async()=>{
 const w=worker({rules:['Use active voice.'],ruleOnly:true});const result=await w.send();
 assert.equal(result.items[0].type,'writing_rule');assert.equal(result.items[0].status,'uncertain');assert.deepEqual(w.calls,['account','quote','check']);
 assert.match((await w.send({rules:['Use passive voice.']})).error,/rules changed/);
 const out=worker({rules:['Use active voice.'],ruleOnly:true,signedIn:false});assert.match((await out.send()).error,/not been checked/);assert.deepEqual(out.calls,[]);
 assert.equal(w.dispatch({kind:'writing-rules',action:'save',value:{enabled:true,rules:['Bad rule.']}},{id:'test',tab:{id:1},frameId:0,url:'https://chatgpt.com/c/test'}),undefined);
});
test('Free still requires a manual check and larger requests require confirmation', async()=>{
  const free=worker({plan:'free'});
  assert.equal((await free.send()).manual,true);
  assert.deepEqual(free.calls,['account']);
  assert.equal((await free.send({automatic:false})).mode,'jev');
  const large=worker({credits:3});
  assert.equal((await large.send()).quote,3);
  assert.deepEqual(large.calls,['account','quote']);
  assert.equal((await large.send({acceptedCredits:3})).mode,'jev');
});
test('signed-out meaning checks do not call cloud; exact wording remains local', async()=>{
  const out=worker({signedIn:false});
  assert.match((await out.send()).error,/Sign in/);
  assert.deepEqual(out.calls,[]);
  const wording=worker({type:'keep_wording'});
  assert.equal((await wording.send()).mode,'local');
  assert.deepEqual(wording.calls,[]);
});

test('highlight preference persists without a model call and panel visibility is per window',async()=>{
 const w=worker();assert.equal((await w.ui('get')).enabled,true);
 await w.ui('highlights',{enabled:false});assert.equal((await w.ui('get')).enabled,false);assert.deepEqual(w.calls,[]);
 const p=w.panel();p.set(20,true);assert.equal((await w.ui('get')).panelOpen,false);
 p.set(10,true);assert.equal((await w.ui('get')).panelOpen,true);
 p.close();assert.equal((await w.ui('get')).panelOpen,false);
 assert.equal((await w.ui('highlights',{enabled:'yes'})).error,'Invalid highlight preference.');
});
test('sidebar opening stays in the explicit click handler; foreign pages cannot use controls',async()=>{
 const w=worker();const pending=w.ui('open-panel');assert.equal(w.opened.length,1);assert.equal((await pending).opened,true);
 assert.equal(w.dispatch({kind:'inline-ui',action:'open-panel'},{id:'other',tab:{id:9},frameId:0,url:'https://chatgpt.com/'}),undefined);
 assert.equal(w.dispatch({kind:'inline-ui',action:'open-panel'},{id:'test',tab:{id:9},frameId:0,url:'https://evil.example/'}),undefined);
 assert.equal(w.opened.length,1);
});

test('source/reply toggles and overlay placement persist independently',async()=>{
 const w=worker();await w.ui('highlights',{scope:'source',enabled:false});
 let state=await w.ui('get');assert.equal(state.sourceEnabled,false);assert.equal(state.replyEnabled,true);
 await w.ui('highlights',{scope:'reply',enabled:false});state=await w.ui('get');assert.equal(state.sourceEnabled,false);assert.equal(state.replyEnabled,false);
 await w.ui('highlights',{scope:'source',enabled:true});assert.equal((await w.ui('get')).replyEnabled,false);
 await w.ui('position',{position:{x:40,y:70}});assert.equal((await w.ui('get')).position.x,40);
 assert.match((await w.ui('position',{position:{x:NaN,y:0}})).error,/Invalid/);
 assert.match((await w.ui('highlights',{scope:'other',enabled:true})).error,/Invalid/);assert.deepEqual(w.calls,[]);
});
