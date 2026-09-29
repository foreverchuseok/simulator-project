import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-hall-character';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.routeWebSocket('**',ws=>ws.close());
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 const home=await page.evaluate(()=>({p:Mascot.root.position.toArray(),visible:Mascot.root.visible}));
 await page.evaluate(()=>{controls.enableDamping=false;HallManual.select(1);HallManual.observe();HallManual.pick(1);});
 await page.click('#hall-half');
 assert.equal(await page.evaluate(()=>Mascot.inspecting&&Mascot.root.visible&&Mascot.root.position.y===FLOOR_Y[1]),true);
 await page.waitForFunction(()=>HallManual.phase==='holding');
 const contact=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);const foot=new THREE.Box3().setFromObject(Mascot.rig.feet[0]);
  const h=hatchDoors[1],hallZ=HallInspector.keyWorld(1).z-.003,edge=h.right.position.x+h.right.userData.triKey.panelInnerX;
  return {toeOverlap:hallZ-foot.min.z,footCenterX:(foot.min.x+foot.max.x)/2,edge,bodyZ:Mascot.root.position.z,carFront:CAR_CTR_Z+S.CAR_D/2};
 });
 assert.ok(Math.abs(contact.toeOverlap-.003)<1e-6);assert.ok(Math.abs(contact.footCenterX-contact.edge)<1e-6);
 await page.click('#hall-dismiss');
 assert.equal(await page.evaluate(()=>Mascot.inspecting&&Mascot.root.visible),true);
 await page.screenshot({path:`${out}/half.png`});
 // Whole-car vertical sweep while hall-bypass inspection drive is active.
 const sweep=await page.evaluate(()=>{
  DoorBypass.setMode('hall');insHold=1;insStart(1);const start=carGrp.position.y;
  const foot=new THREE.Box3(),box=new THREE.Box3(),hits=new Set();let gap=Infinity;
  for(let i=0;i<220;i++){
   insTick(0,100);HallManual.update();scene.updateMatrixWorld(true);foot.setFromObject(Mascot.rig.feet[0]);
   carGrp.traverse(o=>{if(!o.isMesh)return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if(box.max.x<foot.min.x||box.min.x>foot.max.x||box.max.y<foot.min.y||box.min.y>foot.max.y)return;
    gap=Math.min(gap,foot.min.z-box.max.z);if(box.intersectsBox(foot))hits.add(o.name||o.parent.name||o.type);
   });
  }
  insHold=0;insStop();return {hits:[...hits],gap,travel:carGrp.position.y-start,inspectorY:Mascot.root.position.y,floorY:FLOOR_Y[1]};
 });
 assert.ok(sweep.travel>5);assert.deepEqual(sweep.hits,[]);assert.equal(sweep.inspectorY,sweep.floorY);
 await page.evaluate(()=>HallManual.pick(1));await page.click('#hall-open');await page.waitForFunction(()=>!HallManual.busy);
 await page.click('#hall-dismiss');await page.screenshot({path:`${out}/full.png`});
 const perf=()=>page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<120;i++){const n=await new Promise(requestAnimationFrame);t.push(n-last);last=n;}t.sort((a,b)=>a-b);return {median:t[60],p95:t[114],calls:renderer.info.render.calls};});
 // Same scene/view: compare restored character hidden vs visible, without allocating geometry.
 await page.evaluate(()=>{window.savedInspectorHold=HallInspector.hold;HallInspector.hold=()=>{};Mascot.root.visible=false;});const hidden=await perf();
 await page.evaluate(()=>{HallInspector.hold=window.savedInspectorHold;});const shown=await perf();
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{HallManual.select(2);HallManual.observe();HallManual.pick(2);});await page.tap('#hall-half');await page.waitForFunction(()=>!HallManual.busy);
 assert.equal(await page.evaluate(()=>Mascot.root.position.y===FLOOR_Y[2]&&Mascot.root.visible),true);
 await page.tap('#hall-dismiss');await page.screenshot({path:`${out}/mobile.png`});
 await page.evaluate(()=>HallManual.pick(2));await page.tap('#hall-close');await page.waitForFunction(()=>!HallManual.busy);
 assert.equal(await page.evaluate(()=>Mascot.inspecting&&Mascot.root.position.y===FLOOR_Y[1]),true);
 await page.tap('#hall-reset');await page.waitForFunction(()=>!inspectionResetting&&!moving);
 assert.deepEqual(await page.evaluate(()=>({p:Mascot.root.position.toArray(),visible:Mascot.root.visible})),home);
 assert.equal(await page.evaluate(()=>Mascot.inspecting),false);assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/result.json`,JSON.stringify({contact,sweep,hidden,shown,errors},null,2));console.log({contact,sweep,hidden,shown,errors});
}finally{await browser.close();}
