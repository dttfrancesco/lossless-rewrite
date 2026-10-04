// Small launcher; opening the wheel never submits text or starts a paid check.
import {wheelPosition} from './overlay-layout.js';
export const radialStyles = `
.dock{position:relative;width:44px;height:44px;margin-left:auto}.orb{position:relative;border:0!important;border-radius:50%!important;width:44px;height:44px;padding:10px!important;background:#202322!important;color:white!important;box-shadow:0 2px 9px #0002}.orb{touch-action:none;cursor:grab}.orb:active{cursor:grabbing}.orb:hover{background:#353a37!important}.orb svg{width:24px;height:24px;display:block}.orb-badge{position:absolute;right:-3px;top:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:10px;background:#fff;color:#202322;border:1px solid #cbd1cc;font:600 11px/15px system-ui}.orb-badge[data-tone=success]{background:#c5ead5;color:#174b33}.orb-badge[data-tone=review]{background:#ffe4a6;color:#4b3100}
.dock-close{position:absolute;right:-9px;top:-17px;width:22px;height:22px;border-radius:50%;padding:0!important;background:#fff;font-size:17px;line-height:18px;box-shadow:0 1px 5px #0001}.wheel{position:fixed;width:280px;height:280px;border:1px solid #dce1dc;border-radius:50%;background:#fffffffa;box-shadow:0 5px 24px #0002}.wheel:before{content:"Lossless";position:absolute;inset:110px 0 auto;text-align:center;font:600 13px/60px system-ui;color:#525b56;pointer-events:none}.wheel button{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:50%;width:68px;height:68px;padding:5px;border:1px solid #dce1dc;background:#fff;font-size:11px;font-weight:600;line-height:1.2;box-shadow:0 2px 6px #0001}.wheel button:hover{background:#f4f6f4}.wheel button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.wheel [aria-pressed=true]{color:#174b33;background:#edf8f1;border-color:#8cbda1}.wheel #radial-reply[aria-pressed=true]{background:#edf3ff;color:#173c68;border-color:#97b4db}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
`;
export function createRadialMenu(root,{highlights,selections,pdf,sidebar,check,rules,close,hide}) {
  const dock=document.createElement('div');dock.className='dock';
  dock.innerHTML=`<div class="wheel" id="lossless-wheel" role="group" aria-label="Lossless controls" hidden>
    <button id="radial-check" aria-label="Check reply against selections and writing rules" title="Check the latest finished reply against your selections and writing rules"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6M4 21h16"/></svg><span>Check reply</span></button>
    <button id="radial-rules" aria-label="Edit writing rules" title="View, edit or turn off your writing rules"><svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h9M4 19h7m4-2 2 2 4-5"/></svg><span>Writing rules</span></button>
    <button id="radial-selections" aria-label="Selections and checks" title="Selections and check results"><svg viewBox="0 0 24 24"><path d="m3 6 2 2 4-4M12 6h9M3 13h18M3 20h18"/></svg><span>Selections</span></button>
    <button id="radial-pdf" aria-label="Open PDF reference" title="Open a PDF beside your chat"><svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5zM14 3v5h5M12 11v7m-3-3 3 3 3-3"/></svg><span>PDF</span></button>
    <button id="radial-sidebar" aria-label="Open Lossless sidebar" title="Open the sidebar"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18"/></svg><span>Sidebar</span></button>
    <button id="radial-highlights" aria-label="Highlight settings" title="Show or hide highlights in the source and reply"><svg viewBox="0 0 24 24"><path d="m4 15 10-10 5 5-10 10H4zm7-7 5 5M3 23h18"/></svg><span>Highlights</span></button>
    </div><button class="orb" aria-label="Open Lossless controls" aria-expanded="false" aria-controls="lossless-wheel" title="Lossless Rewrite"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 18v28h28M29 18h17M29 31h12" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="orb-badge" hidden></span></button><button class="dock-close" aria-label="Hide Lossless overlay" title="Hide overlay">×</button><span class="sr-only" role="status" id="quiet-status"></span>`;
  root.append(dock);
  const orb=dock.querySelector('.orb'),wheel=dock.querySelector('.wheel'),badge=dock.querySelector('.orb-badge');
  let layoutArgs,center;
  function collapse(){wheel.hidden=true;center=undefined;orb.style.position='';orb.style.left='';orb.style.top='';dock.querySelector('.dock-close').hidden=false;orb.setAttribute('aria-expanded','false');}
  function layout(point,width,height){
    layoutArgs=[point,width,height];const p=wheelPosition(point,width,height);
    wheel.style.left=`${p.x}px`;wheel.style.top=`${p.y}px`;wheel.style.transformOrigin='top left';wheel.style.transform=`scale(${p.size/280})`;
    if(!wheel.hidden){center=p.orb;orb.style.position='fixed';orb.style.left=`${center.x}px`;orb.style.top=`${center.y}px`;dock.querySelector('.dock-close').hidden=true;}
  }
  orb.onclick=()=>{const show=wheel.hidden;close();wheel.hidden=!show;orb.setAttribute('aria-expanded',String(show));if(layoutArgs)layout(...layoutArgs);};
  dock.querySelector('#radial-check').onclick=()=>{collapse();check();};
  dock.querySelector('#radial-rules').onclick=()=>{collapse();rules();};
  dock.querySelector('#radial-highlights').onclick=()=>{collapse();highlights();};
  dock.querySelector('.dock-close').onclick=hide;
  [...wheel.querySelectorAll('button')].forEach((button,i)=>{const angle=(-90+i*60)*Math.PI/180;button.style.left=`${106+100*Math.cos(angle)}px`;button.style.top=`${106+100*Math.sin(angle)}px`;});
  dock.querySelector('#radial-selections').onclick=()=>{collapse();selections();};
  dock.querySelector('#radial-sidebar').onclick=()=>{collapse();sidebar();};
  dock.querySelector('#radial-pdf').onclick=()=>{collapse();pdf();};
  return {orb,collapse,layout,get position(){return center;},hide(value){dock.hidden=value;},update({count,sourceEnabled,replyEnabled,note,tone}){
    badge.hidden=!count&&!note;badge.textContent=tone==='success'?'✓':tone==='review'?'!':count||'·';badge.dataset.tone=tone||'';
    orb.title=(note||`Lossless · ${count} selected`)+' · Drag to move (or Alt + arrow keys)';orb.setAttribute('aria-label',`Lossless controls. ${note||`${count} selected passages`}`);
    const live=dock.querySelector('#quiet-status');if(live.textContent!==note)live.textContent=note||'';
  }};
}
