import { lastReply, textNodes } from './reply-highlights.js';
import { completionGate, localWording, repairDraft } from './inline-check.js';
import {checkItems} from './writing-rules.js';

export function createReplyChecker({card,composer,value,write,visible,status,open,getContext,sendMessage,active,notify=()=>{},onReady=()=>{}}) {
  const results=document.createElement('div');results.hidden=true;
  const check=document.createElement('button');check.textContent='Check finished reply';check.hidden=true;
  const fix=document.createElement('button');fix.textContent='Fix in chat';fix.hidden=true;card.append(results,check,fix);
  let pending,checked,timer,checking=false,preparing=false,generation=0;
  const streaming=()=>[...document.querySelectorAll('button,[role="button"]')].some(el=>visible(el)&&/^(stop|stop generating|stop response|stop streaming)$/i.test(el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText||''));
  const text=()=>{const el=lastReply();return el?textNodes(el).text:'';};
  function reset(){generation++;pending=checked=undefined;results.hidden=check.hidden=fix.hidden=true;check.textContent='Check finished reply';notify('','');clearInterval(timer);}
  function render(items,note){
    results.replaceChildren();results.hidden=false;
    const title=document.createElement('p');title.textContent=note;results.append(title);
    const details=document.createElement('details');details.className='check-results';const summary=document.createElement('summary');summary.textContent='Review findings';details.append(summary);
    for(const item of items.filter(i=>i.status!=='kept')){
      const row=document.createElement('p');row.className='note';row.textContent=`${item.type==='writing_rule'?'Rule · ':''}${item.status==='unchecked'?'Not checked':item.status==='uncertain'?'Needs review':item.type==='writing_rule'?'Not followed':item.type==='remove'?'Still present':'Missing or changed'}: ${item.text}`;details.append(row);
    }
    if(details.children.length>1)results.append(details);
    const kept=items.filter(i=>i.status==='kept').length;notify(`${kept}/${items.length} checks passed`,kept===items.length?'success':'review');
    fix.hidden=!items.some(i=>['missing','altered','uncertain'].includes(i.status));open();
  }
  async function run(automatic=false){
    if(!pending||checking)return;
    const captured=text(),id=generation,items=pending.items;
    if(streaming()||!captured||captured!==pending.gate?.text)return status('The reply is changing. Wait for it to finish.');
    checking=true;check.disabled=true;notify('Checking…','');
    try{
      const result=await sendMessage({kind:'inline-check',scope:getContext().scope,items,rules:pending.rules,reply:captured,automatic,acceptedCredits:pending.acceptedCredits});
      if(id!==generation||captured!==text()||streaming())return;
      if(result?.manual){notify('Reply ready to check','');return;}
      if(result?.quote){pending.acceptedCredits=result.quote;check.textContent=`Check reply · ${result.quote} credits`;notify(`Check ready · ${result.quote} credits`,'review');return;}
      if(result?.error||!result?.items)throw new Error(result?.error||'Could not check this reply.');
      checked={text:captured,items:result.items};
      const passages=result.items.filter(i=>i.type!=='writing_rule'),rules=result.items.filter(i=>i.type==='writing_rule');
      render(result.items,[passages.length?`${passages.filter(i=>i.status==='kept').length}/${passages.length} passage requirements met`:'',rules.length?`${rules.filter(i=>i.status==='kept').length}/${rules.length} writing rules followed`:''].filter(Boolean).join(' · '));
      status('');check.hidden=true;
    }catch(e){if(id!==generation)return;const fallback=localWording(checkItems(items,pending.rules),captured);checked={text:captured,items:fallback};render(fallback,e.message);status('');}
    finally{checking=false;check.disabled=false;}
  }
  check.onclick=()=>run(false);
  fix.onclick=()=>{
    try{
      if(!checked||text()!==checked.text)throw new Error('The reply changed. Check it again first.');
      const el=composer();if(!el)throw new Error('Open the chat box first.');
      if(value(el).trim())throw new Error('Your draft is not empty. Save it before preparing a fix.');
      write(el,'/lossless '+repairDraft(checked.text,checked.items));status('Fix ready in your chat. Review it and press Send.');
    }catch(e){status(e.message);}
  };
  function watch(baseline,items,rules=[]){
    reset();pending={baseline,items:structuredClone(items),rules:structuredClone(rules),started:Date.now()};const id=generation;
    timer=setInterval(async()=>{
      if(id!==generation||!active())return;
      try{
        const reply=text();
        if(checked&&checked.text!==reply){checked=undefined;results.hidden=fix.hidden=true;pending.attempted=true;pending.gate=undefined;pending.visualized=undefined;notify('Reply changed · check again','review');}
        if(Date.now()-pending.started>180000){clearInterval(timer);return;}
        const isStreaming=streaming();
        pending.gate=completionGate({previous:pending.gate,text:reply,streaming:isStreaming,now:Date.now(),baseline});
        if(!pending.gate.ready||checked||checking)return;
        if(pending.visualized!==reply){onReady(items);pending.visualized=reply;notify('Reply ready to check','');}
        check.hidden=false;open();
        if(pending.gate.automatic&&!pending.attempted){pending.attempted=true;await run(true);}
      }catch(e){reset();status(e.message);}
    },500);
  }
  function navigate(before,after){const a=new URL(before),b=new URL(after);if(pending&&Date.now()-pending.started<30000&&a.origin===b.origin&&['/','/new','/app'].includes(a.pathname))return;reset();}
  async function checkNow() {
    if(checking||preparing)return;
    const current=getContext(),rules=current.rules||[];
    if(!current.items.length&&!rules.length)return status('Mark a passage or add a writing rule first.');
    if(streaming())return status('Wait for the reply to finish, then choose Check reply.');
    const captured=text();if(!captured)return status('No reply found in this chat yet.');
    // Keep an explicit credit quote on a repeated click; changing requirements
    // or text invalidates it. This also checks ordinary (non-Lossless) replies.
    const same=pending&&JSON.stringify([pending.items,pending.rules,pending.gate?.text])===JSON.stringify([current.items,rules,captured]);
    if(!same){watch('',current.items,rules);pending.attempted=true;}
    const id=generation;preparing=true;
    try {
      await new Promise(resolve=>setTimeout(resolve,450));
      if(id!==generation||!active())return;
      if(streaming()||text()!==captured)return status('The reply is changing. Wait for it to finish.');
      pending.gate={...pending.gate,text:captured};check.hidden=false;onReady(current.items);open();
      await run(false);
    } finally {preparing=false;}
  }
  return {watch,reset,text,navigate,checkNow};
}
