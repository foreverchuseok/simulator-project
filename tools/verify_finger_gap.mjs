// 양쪽 문틀 틈새: 상시 70% 반투명 표시·설명 전용 아이콘·개폐 시 문틀 고정·PC/390px 터치.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='.shot-finger-gap';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>hatchDoors.every(h=>h.interlock?.ready)&&CarDoor.state?.ready&&FingerGap.entries.length===FLOORS+1&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.waitForTimeout(800);
 // Measured from rendered meshes, not from the FingerGap inputs.
 report.gaps=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);const b=new THREE.Box3(),res=[];
  const boxes=(test)=>{const a=[];scene.traverse(o=>{if(!o.isMesh||!o.visible||o.name==='fingerGapStrip')return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);if(test(o,b))a.push({n:o.name,min:b.min.clone(),max:b.max.clone()});});return a;};
  hatchDoors.forEach((h,f)=>{
   const y=h.fingerGap.floorY+1;
   const panels=boxes((o,b)=>/^HallDoorPanel/.test(o.name)&&b.min.y<y&&b.max.y>y&&Math.abs(b.min.y-h.fingerGap.floorY)<.1);
   const face=Math.max(...panels.map(p=>p.max.z));
   // Anything in front of the panel over the jamb edge band (x 0.75..0.762) below 1.6m.
   const jamb=boxes((o,b)=>b.min.y<y&&b.max.y>y&&b.max.x>0.751&&b.min.x<0.761&&b.min.z>face-1e-4&&b.min.z<face+.05&&(b.max.x-b.min.x)<3);
   const jambBack=Math.min(...jamb.map(j=>j.min.z));
   const L=panels.filter(p=>p.min.x+p.max.x<0),R=panels.filter(p=>p.min.x+p.max.x>0);
   res.push({floor:f+1,jambGap:+(jambBack-face).toFixed(4),centerGap:+(Math.min(...R.map(p=>p.min.x))-Math.max(...L.map(p=>p.max.x))).toFixed(4),
     panelOuter:+Math.max(...R.map(p=>p.max.x)).toFixed(4),jambParts:jamb.map(j=>j.n)});
  });
  const d=CarDoor.dimensions();const fold=carGrp.getObjectByName('carPanelAssembly').getObjectByName('entranceJambFold');
  fold.geometry.computeBoundingBox();const fb=fold.geometry.boundingBox.clone().applyMatrix4(fold.matrixWorld);
  const skin=carDoorR.getObjectByName('carDoorSkin');skin.geometry.computeBoundingBox();const sb=skin.geometry.boundingBox.clone().applyMatrix4(skin.matrixWorld);
  const skinL=carDoorL.getObjectByName('carDoorSkin');skinL.geometry.computeBoundingBox();const sl=skinL.geometry.boundingBox.clone().applyMatrix4(skinL.matrixWorld);
  res.push({floor:'car',jambGap:+(sb.min.z-fb.max.z).toFixed(4),centerGap:+(sb.min.x-sl.max.x).toFixed(4)});
  return res;
 });
 for(const g of report.gaps){assert.ok(g.jambGap>0&&g.jambGap<=0.0050001,`jamb ${g.floor} ${g.jambGap}`);assert.ok(g.centerGap>0&&g.centerGap<=0.0050001,`center ${g.floor} ${g.centerGap}`);}
 const lobby=(f,w=1280)=>page.evaluate(([f])=>{const q=hatchDoors[f].fingerGap;leaveCabinView?.();controls.target.set(.25,q.floorY+1.0,q.faceZ);camera.position.set(-.2,q.floorY+1.45,q.faceZ+2.1);controls.update();},[f]);
 const car=await page.evaluate(()=>{for(let f=0;f<FLOORS;f++)if(Math.abs(carGrp.position.y-(FLOOR_Y[f]+S.CAR_H/2))<.05)return f;return 0;});
 const other=(car+1)%FLOORS_N();
 await lobby(other);await page.waitForTimeout(400);
 assert.equal(await page.locator(`#finger-gap-hall-${other}`).isVisible(),true);
 assert.equal(await page.locator('#finger-gap-car').isVisible(),false);
 const stripsState=()=>page.evaluate(()=>FingerGap.entries.map(e=>e.strips.map(s=>({position:s.getWorldPosition(new THREE.Vector3()).toArray(),visible:s.visible,opacity:s.material.opacity,edgeOpacity:s.children[0].material.opacity}))));
 report.initialStrips=await stripsState();
 for(const strips of report.initialStrips){assert.equal(strips.length,2);for(const s of strips){assert.equal(s.visible,true);assert.equal(s.opacity,.35);assert.equal(s.edgeOpacity,.63);assert.ok(Math.abs(s.position[0])>.7);}}
 assert.equal(await page.locator(`#finger-gap-hall-${other}`).textContent(),'');
 assert.equal(await page.locator('#finger-gap-panel').isVisible(),false);
 report.performance=await page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return {median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await page.screenshot({path:`${out}/lobby-icon.png`});
 await page.click(`#finger-gap-hall-${other}`);
 const state=()=>page.evaluate(()=>({active:FingerGap.active?.kind+':'+FingerGap.active?.floor,shown:FingerGap.entries.map(e=>e.strips.filter(s=>s.visible).length),
   heights:FingerGap.entries[0].strips.map(s=>{const b=new THREE.Box3().setFromObject(s);return +(b.max.y-b.min.y).toFixed(4);})}));
 report.hallOpen=await state();
 assert.deepEqual(report.hallOpen.shown,Array(FLOORS_N()+1).fill(2));
 assert.deepEqual(await stripsState(),report.initialStrips);
 assert.ok(report.hallOpen.heights.every(h=>Math.abs(h-1.6)<1e-3));
 assert.equal(await page.locator('#finger-gap-panel').isVisible(),true);
 await page.waitForTimeout(300);await page.screenshot({path:`${out}/lobby-open.png`});
 // Close-up on the jamb seam.
 await page.evaluate(([f])=>{const q=hatchDoors[f].fingerGap;controls.target.set(-q.edgeX+.02,q.floorY+1.2,q.faceZ);camera.position.set(-q.edgeX+.45,q.floorY+1.45,q.faceZ+.75);controls.update();},[other]);
 await page.waitForTimeout(400);assert.equal((await state()).active,`hall:${other}`);await page.screenshot({path:`${out}/jamb-closeup.png`});
 await lobby(other);await page.waitForTimeout(300);
 await page.click('#finger-gap-dismiss');assert.deepEqual((await state()).shown,Array(FLOORS_N()+1).fill(2));
 // Car: inside the cab looking at the door.
 await page.evaluate(()=>{const p=new THREE.Vector3(-.3,.25,-.6);carGrp.localToWorld(p);camera.position.copy(p);const t=new THREE.Vector3(.2,-.2,1.2);carGrp.localToWorld(t);controls.target.copy(t);controls.update();});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#finger-gap-car').isVisible(),true);
 await page.screenshot({path:`${out}/car-idle.png`});
 await page.click('#finger-gap-car');report.carOpen=await state();assert.equal(report.carOpen.active,'car:-1');
 await page.waitForTimeout(300);await page.screenshot({path:`${out}/car-open.png`});
 // Door travel: the side strips stay at the jambs; there is no centre strip.
 await page.evaluate(()=>openDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
 report.stripsWhenOpen=await stripsState();
 assert.deepEqual(report.stripsWhenOpen,report.initialStrips);
 await page.screenshot({path:`${out}/car-open-doors.png`});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>FingerGap.active),null);
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE&&!doorOpen);
 // Hiding icons leaves the permanent jamb strips visible.
 await page.evaluate(()=>PartActions.setIconsVisible(false));await page.waitForTimeout(200);
 assert.equal(await page.locator('#finger-gap-car').isVisible(),false);assert.deepEqual((await state()).shown,Array(FLOORS_N()+1).fill(2));await page.evaluate(()=>PartActions.setIconsVisible(true));
 // 390px touch.
 await page.setViewportSize({width:390,height:844});await page.evaluate(([f])=>{const q=hatchDoors[f].fingerGap;controls.target.set(-.35,q.floorY+1.0,q.faceZ);camera.position.set(-.3,q.floorY+1.45,q.faceZ+2.3);controls.update();},[other]);await page.waitForTimeout(400);
 await page.tap(`#finger-gap-hall-${other}`);await page.waitForTimeout(300);
 const box=await page.locator('#finger-gap-panel').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,JSON.stringify(box));
 await page.screenshot({path:`${out}/mobile-open.png`});
 await page.tap(`#finger-gap-hall-${other}`);assert.equal(await page.evaluate(()=>FingerGap.active),null);
 function FLOORS_N(){return report.gaps.length-1;}
}finally{await browser.close();}
report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,1));console.log(JSON.stringify(report,null,1));
assert.equal(errors.length,0);console.log('verify_finger_gap OK');
