import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPosition,panelPosition,wheelPosition} from './overlay-layout.js';
test('drag positions and popovers stay inside narrow and resized viewports',()=>{
 for(const [width,height] of [[360,640],[1920,911],[320,280]]) {
  for(const point of [{x:-80,y:-50},{x:9000,y:9000},{x:width/2,y:height/2}]) {
   const p=clampPosition(point,width,height);assert.ok(p.x>=8&&p.x+44<=width-8);assert.ok(p.y>=8&&p.y+44<=height-8);
   const w=Math.min(340,width-16),h=Math.min(540,height-24),panel=panelPosition(p,width,height,w,h);
   assert.ok(panel.x>=8&&panel.x+w<=width-8);assert.ok(panel.y>=8&&panel.y+h<=height-8);
  }
 }
});
test('the open wheel and widget share a centre, including near screen edges',()=>{
 for(const [width,height] of [[360,640],[1920,911],[320,280]])for(const point of [{x:8,y:8},{x:width-52,y:height-52},{x:width/2,y:height/2}]){
  const p=wheelPosition(point,width,height);
  assert.equal(p.orb.x+22,p.x+p.size/2);assert.equal(p.orb.y+22,p.y+p.size/2);
  assert.ok(p.x>=8&&p.x+p.size<=width-8);assert.ok(p.y>=8&&p.y+p.size<=height-8);
 }
});
