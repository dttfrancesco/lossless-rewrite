import {session,cloudCall} from './cloud.js';
const $=id=>document.getElementById(id),status=$('plan-status'),dialog=$('interest-dialog');
let joined=new Set(),selected;
function draw(){for(const button of document.querySelectorAll('[data-plan]')){const name=button.dataset.plan==='plus'?'Plus':'Pro';button.textContent=joined.has(button.dataset.plan)?`${name}: on the list · Manage`:`Notify me about ${name}`;}}
async function refresh(){try{if(await session()){const result=await cloudCall({action:'interest-status'});joined=new Set(result.plans);draw();}}catch(e){status.textContent=e.message;}}
for(const button of document.querySelectorAll('[data-plan]'))button.onclick=async()=>{
  try{
    const current=await session();
    if(!current){await chrome.storage.session.set({losslessPlanReturn:true});location.href='account.html';return;}
    selected=button.dataset.plan;
    $('interest-title').textContent=`${selected==='plus'?'Plus':'Pro'} · coming soon`;
    $('interest-note').textContent=joined.has(selected)?`You joined with ${current.user.email}.`:`Send a launch update to ${current.user.email}?`;
    $('confirm-interest').hidden=joined.has(selected);$('remove-interest').hidden=!joined.has(selected);$('interest-status').textContent='';dialog.showModal();
  }catch(e){status.textContent=e.message;}
};
async function save(interested){
  $('confirm-interest').disabled=$('remove-interest').disabled=true;
  try{const result=await cloudCall({action:'interest',plan:selected,interested});joined=new Set(result.plans);draw();dialog.close();status.textContent=!interested?'Your interest and email were removed from this plan’s list.':result.confirmation==='sent'?'You’re on the list. Check your inbox for a confirmation.':result.confirmation==='already_sent'?'You’re on the list. Your confirmation was already sent.':result.confirmation==='pending'?'You’re on the list. Email confirmation is still pending.':'You’re on the list, but we couldn’t send the confirmation email. Your registration is saved.';}
  catch(e){$('interest-status').textContent=e.message;}
  finally{$('confirm-interest').disabled=$('remove-interest').disabled=false;}
}
$('confirm-interest').onclick=()=>save(true);$('remove-interest').onclick=()=>save(false);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
refresh();
