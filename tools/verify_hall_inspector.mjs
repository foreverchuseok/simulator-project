import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const before=process.argv.includes('--before'),out='.shot-hall-inspector';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;HallManual.select(1);HallManual.observe();});
 const perf=()=>page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const n=await new Promise(requestAnimationFrame);t.push(n-last);last=n;}t.sort((a,b)=>a-b);return {median:t[90],p95:t[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 const performance=await perf();await page.screenshot({path:`${out}/${before?'before':'after'}-idle.png`});
 if(before){fs.writeFileSync(`${out}/before.json`,JSON.stringify({performance,errors},null,2));console.log({performance});}
 else {
  const matrix=await page.evaluate(()=>{
   const old=carGrp.position.y,rows=[];
   for(let c=0;c<FLOORS;c++){carGrp.position.y=FLOOR_Y[c]+S.CAR_H/2;rows.push(Array.from({length:FLOORS},(_,f)=>HallManual.allowed(f).ok));}
   carGrp.position.y=old;return rows;
  });assert.deepEqual(matrix,[[true,true,false,false],[true,true,true,false],[true,false,true,true],[true,false,false,true]]);
  const home=await page.evaluate(()=>({p:Mascot.root.position.toArray(),r:Mascot.root.rotation.y,v:Mascot.root.visible}));
  const atHome=()=>page.evaluate(h=>{const r=Mascot.root;return !Mascot.inspecting&&r.position.toArray().every((v,i)=>Math.abs(v-h.p[i])<1e-9)&&Math.abs(r.rotation.y-h.r)<1e-9&&r.visible===h.v&&Mascot.rig.feet[0].position.z===0&&Mascot.rig.wrench.visible&&!HallInspector.tool.visible;},home);
  await page.click('#hall-action-1');await page.click('#hall-half');
  await page.waitForFunction(()=>HallManual.phase==='unlocking'&&HallManual.poseState.key>.2);
  await page.screenshot({path:`${out}/key-unlocking.png`});
  await page.waitForFunction(()=>HallManual.phase==='holding');
  const held=await page.evaluate(()=>{scene.updateMatrixWorld(true);const h=hatchDoors[1],foot=new THREE.Box3().setFromObject(Mascot.rig.feet[0]);return {ratio:h.manualOpen,carClosed:CarDoor.secured(),footMaxX:foot.max.x,edge:h.right.position.x+h.right.userData.triKey.panelInnerX,footMinZ:foot.min.z,hallZ:HallInspector.keyWorld(1).z-.003};});
  assert.equal(held.ratio,.5);assert.equal(held.carClosed,true);assert.ok(Math.abs(held.footMaxX-held.edge)<1e-5);assert.ok(held.footMinZ<held.hallZ);
  await page.click('#hall-dismiss');await page.screenshot({path:`${out}/half-held.png`});
  const holdingPerformance=await perf();
  await page.evaluate(()=>{moveElevator(2);});assert.equal(await page.evaluate(()=>moving),false);
  await page.evaluate(()=>HallManual.pick(1));await page.click('#hall-open');await page.waitForFunction(()=>HallManual.phase==='holding'&&hatchDoors[1].manualOpen===1);
  await page.click('#hall-dismiss');await page.screenshot({path:`${out}/full-held.png`});
  await page.evaluate(()=>{HallManual.pick(1);HallManual.close();});await page.waitForFunction(()=>!HallManual.active);
  assert.equal(await page.evaluate(()=>DoorBypass.hallSecured()&&hatchDoors[1].keyRatio===0&&!hatchDoors[1].manualActive),true);assert.equal(await atHome(),true);
  // Same-floor reverse coupling must move both leaves by the same displacement.
  await page.evaluate(()=>{HallManual.select(0);HallManual.observe();HallManual.request(.5);});await page.waitForFunction(()=>HallManual.phase==='holding');
  const coupled=await page.evaluate(()=>({car:carDoorR.position.x-CarDoor.dimensions().cx,hall:hatchDoors[0].right.position.x-hatchDoors[0].right.userData.cx,release:CarDoor.state.release}));
  assert.ok(Math.abs(coupled.car-coupled.hall)<1e-8);assert.ok(coupled.car>0);assert.equal(coupled.release,1);
  await page.screenshot({path:`${out}/same-floor-half.png`});
  await page.evaluate(()=>closeDoors());await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>hatchDoors[0].manualOpen),.5);
  await page.evaluate(()=>{HallManual.close();});await page.waitForFunction(()=>!HallManual.active);
  assert.equal(await page.evaluate(()=>CarDoor.secured()&&!doorOpen&&DoorBypass.hallSecured()),true);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{HallManual.select(1);HallManual.observe();});await page.tap('#hall-action-1');
  await page.tap('#hall-half');await page.waitForFunction(()=>HallManual.phase==='holding');
  await page.screenshot({path:`${out}/mobile-panel.png`});await page.tap('#hall-dismiss');await page.screenshot({path:`${out}/mobile-half.png`});
  // Touch close: reopen the floor icon, tap "발 빼고 닫기", then relock and send the bear home.
  await page.tap('#hall-action-1');assert.equal(await page.locator('#hall-close').isEnabled(),true);await page.tap('#hall-close');
  await page.waitForFunction(()=>!HallManual.active);
  const touchClosed=await page.evaluate(()=>DoorBypass.hallSecured()&&hatchDoors[1].manualOpen===0&&hatchDoors[1].keyRatio===0&&CarDoor.secured());
  assert.equal(touchClosed,true);assert.equal(await atHome(),true);await page.screenshot({path:`${out}/mobile-closed.png`});
  fs.writeFileSync(`${out}/after.json`,JSON.stringify({matrix,held,coupled,performance,holdingPerformance,errors},null,2));assert.deepEqual(errors,[]);console.log({matrix,held,coupled,performance,holdingPerformance,errors});
 }
}finally{await browser.close();}
