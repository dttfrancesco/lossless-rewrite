import {validateRules} from './writing-rules.js';
import {isRulesShortcut,shortcutLabels} from './shortcuts.js';
export function setupWritingRules(){
  const q=id=>document.getElementById(id),dialog=q('rules-dialog');
  async function message(action,value){const result=await chrome.runtime.sendMessage({kind:'writing-rules',action,value});if(result?.error)throw new Error(result.error);return result;}
  const open=async()=>{if(dialog.open)return;dialog.showModal();q('rules-status').textContent='';try{const value=await message('get');q('rules-enabled').checked=value.enabled;q('rules-auto').checked=value.autoLearn!==false;q('rules-text').value=value.rules.join('\n');}catch(e){q('rules-status').textContent=e.message;}};
  q('writing-rules').onclick=open;
  q('writing-rules').title=`Open writing rules (${shortcutLabels().rules})`;
  document.addEventListener('keydown',e=>{if(!e.defaultPrevented && isRulesShortcut(e)){e.preventDefault();open();}});
  q('rules-save').onclick=async()=>{try{const value=validateRules({enabled:q('rules-enabled').checked,autoLearn:q('rules-auto').checked,rules:q('rules-text').value.split('\n').map(s=>s.trim()).filter(Boolean)});await message('save',value);q('rules-status').textContent=value.enabled?'Saved. These rules apply to your next Lossless sends in all chats.':'Saved. Writing rules are turned off.';}catch(e){q('rules-status').textContent=e.message;}};
  q('rules-starter').onclick=()=>{const examples=['Prefer active voice when the actor is known.','Remove repetition without dropping distinct claims or qualifications.','Use familiar words where they preserve the technical meaning.'];const current=q('rules-text').value.split('\n').map(s=>s.trim()).filter(Boolean);q('rules-text').value=[...new Set([...current,...examples])].join('\n');q('rules-status').textContent='Review the suggested rules, then save.';};
  q('rules-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  return {open};
}
