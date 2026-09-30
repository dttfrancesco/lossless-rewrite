import {cloud,signIn,session,cloudCall} from './cloud.js';
const $=id=>document.getElementById(id);
async function refresh(){
  $('manage-billing').hidden=true;
  try{const current=await session();$('sign-in').hidden=Boolean(current);$('sign-out').hidden=!current;
    $('account-email').hidden=!current;$('account-email').textContent=current?`Signed in as ${current.user.email}`:'';
    $('sign-in-note').hidden=Boolean(current);$('check-settings').hidden=true;
    if(!current){$('account-status').textContent='Not signed in';return;}
    const account=await cloudCall({action:'account'});$('account-status').textContent=account.owner?`Private access · all features · no monthly plan limit. ${account.used} credits used this month.`:`Free · ${account.used} of ${account.allowance} check credits used this month`;
    $('check-mode').textContent=account.plan==='free'?'Meaning checks are ready. Choose Check finished reply after sending with Lossless.':'Meaning checks run automatically after your Lossless replies.';
    $('check-settings').hidden=false;
    $('manage-billing').hidden=!account.billingAvailable||account.plan==='free';
  }catch(e){$('account-status').textContent=e.message;}
}
$('sign-in').onclick=async()=>{try{$('sign-in').disabled=true;await signIn();await refresh();const next=await chrome.storage.session.get('losslessPlanReturn');if(next.losslessPlanReturn){await chrome.storage.session.remove('losslessPlanReturn');location.href='plans.html';}}catch(e){$('account-status').textContent=e.message;}finally{$('sign-in').disabled=false;}};
$('sign-out').onclick=async()=>{try{$('sign-out').disabled=true;const result=await cloud.auth.signOut({scope:'local'});if(result.error)throw result.error;await refresh();}catch(e){$('account-status').textContent=e.message;}finally{$('sign-out').disabled=false;}};
$('manage-billing').onclick=async()=>{try{const result=await cloudCall({action:'portal'});await chrome.tabs.create({url:result.url});}catch(e){$('account-status').textContent=e.message;}};
refresh();
