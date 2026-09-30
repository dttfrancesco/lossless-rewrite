const params=new URLSearchParams(location.hash.slice(1)),id=params.get('id'),token=params.get('token');
// Keep the token out of browser history, server access logs and referrer headers.
history.replaceState(null,'',location.pathname);
const title=document.querySelector('#title'),description=document.querySelector('#description'),button=document.querySelector('#unsubscribe'),status=document.querySelector('#status');
async function call(action){
 const response=await fetch('https://vamiugwyjxhzpbbezurt.supabase.co/functions/v1/lossless-unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,token,action}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Please try again.');return result;
}
function render(result){
 const name=result.plan==='pro'?'Pro':'Plus';
 title.textContent=result.subscribed?`Stop ${name} updates?`:"You're unsubscribed.";
 description.textContent=result.subscribed?`Confirm below to stop emails about Lossless Rewrite ${name}. No sign-in needed.`:`You won't receive further ${name} updates. You can join again from Compare plans in the extension.`;
 button.textContent=`Unsubscribe from ${name} updates`;button.hidden=!result.subscribed;
}
button.onclick=async()=>{button.disabled=true;status.textContent='';try{render(await call('unsubscribe'));}catch{status.textContent='Could not update your preference. Please try again.';}finally{button.disabled=false;}};
if(!id||!token){description.textContent='Open the unsubscribe link at the bottom of your Lossless email.';}else{try{render(await call('status'));}catch(e){description.textContent=e.message;}}
