import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const bundle=await build({entryPoints:[fileURLToPath(new URL('./reply-check-ui.js',import.meta.url))],bundle:true,write:false,format:'iife',globalName:'ui',plugins:[{name:'reply-dom',setup(b){
  b.onResolve({filter:/\/reply-highlights\.js$/},args=>({path:args.path,namespace:'reply'}));
  b.onLoad({filter:/.*/,namespace:'reply'},()=>({contents:'export const lastReply=()=>fixture.reply?{}:null;export const textNodes=()=>({text:fixture.reply});'}));
}}]});
function setup(){
  const element=()=>({children:[],hidden:false,append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;}});
  const fixture={reply:'The study found no difference.',streaming:false};
  const sandbox={fixture,structuredClone,URL,setTimeout,clearTimeout,setInterval,clearInterval,document:{createElement:element,querySelectorAll:()=>fixture.streaming?[{getAttribute:()=> 'Stop generating'}]:[]}};
  vm.runInNewContext(bundle.outputFiles[0].text,sandbox);
  const card=element(),calls=[],notes=[],statuses=[];
  const context={scope:'https://chatgpt.com/c/test',items:[],rules:['Use active voice.']};
  let respond=async()=>({items:[{type:'writing_rule',text:context.rules[0],status:'missing'}]});
  const ui=sandbox.ui.createReplyChecker({card,composer:()=>({}),value:()=>'',write(){},visible:()=>true,status:s=>statuses.push(s),open(){},getContext:()=>context,sendMessage:m=>{calls.push(m);return respond(m);},active:()=>true,notify:n=>notes.push(n)});
  return {fixture,card,calls,context,ui,notes,statuses,respond:fn=>respond=fn};
}
test('quick check evaluates rules on an ordinary existing reply without sending a prompt',async()=>{
  const t=setup();try{
    await t.ui.checkNow();assert.equal(t.calls.length,1);assert.equal(t.calls[0].automatic,false);
    assert.deepEqual(Array.from(t.calls[0].rules),['Use active voice.']);assert.equal(t.card.children[2].hidden,false);
    assert.equal(t.notes.at(-1),'0/1 checks passed');
  }finally{t.ui.reset();}
});
test('quick check blocks streaming and requires explicit confirmation of a larger credit quote',async()=>{
  const t=setup();try{
    t.fixture.streaming=true;await t.ui.checkNow();assert.equal(t.calls.length,0);assert.match(t.statuses.at(-1),/Wait for the reply/);
    t.fixture.streaming=false;t.respond(async()=>({quote:3}));await t.ui.checkNow();
    assert.equal(t.calls[0].acceptedCredits,undefined);assert.equal(t.card.children[1].textContent,'Check reply · 3 credits');
    await t.ui.checkNow();assert.equal(t.calls[1].acceptedCredits,3);
    t.fixture.reply='Changed reply.';await t.ui.checkNow();assert.equal(t.calls[2].acceptedCredits,undefined);
  }finally{t.ui.reset();}
});
test('late results for edited replies cannot show a successful check',async()=>{
  const t=setup();try{
    t.respond(async()=>{t.fixture.reply='New text while checking.';return {items:[{type:'writing_rule',text:'Use active voice.',status:'kept'}]};});
    await t.ui.checkNow();assert.equal(t.notes.includes('1/1 checks passed'),false);assert.equal(t.card.children[0].hidden,true);
  }finally{t.ui.reset();}
});
