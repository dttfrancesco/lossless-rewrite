export function clampPosition(point,width,height) {
  return {x:Math.max(8,Math.min(point.x,Math.max(8,width-52))),y:Math.max(8,Math.min(point.y,Math.max(8,height-52)))};
}
export function panelPosition(point,width,height,panelWidth,panelHeight) {
  const x=Math.max(8,Math.min(point.x+44-panelWidth,width-panelWidth-8));
  const above=point.y-panelHeight-12;
  const y=Math.max(8,Math.min(above>=8?above:point.y+56,height-panelHeight-8));
  return {x,y};
}
export function wheelPosition(point,width,height) {
  const size=Math.min(280,width-16,height-16),radius=size/2;
  const cx=Math.max(radius+8,Math.min(point.x+22,width-radius-8));
  const cy=Math.max(radius+8,Math.min(point.y+22,height-radius-8));
  return {x:cx-radius,y:cy-radius,size,orb:{x:cx-22,y:cy-22}};
}
export function dragOverlay(button,{getPosition,move,save}) {
  let drag,ignoreClick=false;
  const down=e=>{if(e.button!==0)return;const p=getPosition();drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:p,moved:false};button.setPointerCapture(e.pointerId);};
  const update=e=>{if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved){e.preventDefault();move({x:drag.start.x+e.clientX-drag.x,y:drag.start.y+e.clientY-drag.y});}};
  const end=e=>{if(!drag||e.pointerId!==drag.id)return;ignoreClick=drag.moved;if(drag.moved)save(getPosition());drag=undefined;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
  const click=e=>{if(ignoreClick&&e.detail!==0){ignoreClick=false;e.preventDefault();e.stopImmediatePropagation();}};
  const key=e=>{if(!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const p=getPosition();move({x:p.x+(e.key==='ArrowRight'?16:e.key==='ArrowLeft'?-16:0),y:p.y+(e.key==='ArrowDown'?16:e.key==='ArrowUp'?-16:0)});save(getPosition());};
  for(const [type,fn] of [['pointerdown',down],['pointermove',update],['pointerup',end],['pointercancel',end],['click',click],['keydown',key]])button.addEventListener(type,fn,true);
  return ()=>{for(const [type,fn] of [['pointerdown',down],['pointermove',update],['pointerup',end],['pointercancel',end],['click',click],['keydown',key]])button.removeEventListener(type,fn,true);};
}
