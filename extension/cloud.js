import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, CHECK_URL } from './cloud-config.js';
import { registeredCallback, callbackCode } from './auth-callback.js';
const storage={getItem:async key=>(await chrome.storage.local.get(key))[key]??null,setItem:async(key,value)=>chrome.storage.local.set({[key]:value}),removeItem:async key=>chrome.storage.local.remove(key)};
export const cloud=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage,storageKey:'lossless-auth',flowType:'pkce',detectSessionInUrl:false,autoRefreshToken:false,persistSession:true}});
export async function session(){
  let {data:{session}}=await cloud.auth.getSession();
  if(session&&session.expires_at*1000<Date.now()+60000){const next=await cloud.auth.refreshSession();if(next.error)throw next.error;session=next.data.session;}
  return session;
}
export async function cloudCall(body){
  const current=await session();if(!current)throw new Error('Sign in to use included checks.');
  const response=await fetch(CHECK_URL,{method:'POST',headers:{Authorization:`Bearer ${current.access_token}`,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');return result;
}
export async function signIn(){
  if(!await chrome.permissions.request({permissions:['identity']}))throw new Error('Google sign-in needs Chrome’s identity permission.');
  const redirectTo=registeredCallback(chrome.identity.getRedirectURL('lossless'));
  const {data,error}=await cloud.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true}});if(error)throw error;
  const callback=await chrome.identity.launchWebAuthFlow({url:data.url,interactive:true});
  const code=callbackCode(callback,redirectTo);
  const result=await cloud.auth.exchangeCodeForSession(code);if(result.error)throw result.error;
}
