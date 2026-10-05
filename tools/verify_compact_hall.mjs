import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-hall-inspector';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(30000);
 await page.routeWebSocket('**',ws=>ws.close());
 await page.goto('http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;HallManual.select(1);HallManual.observe();});
 const performance=await page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const n=await new Promise(requestAnimationFrame);t.push(n-last);last=n;}t.sort((a,b)=>a-b);return {median:t[90],p95:t[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 if(process.argv.includes('--before')){
  fs.writeFileSync(`${out}/before.json`,JSON.stringify({performance,errors},null,2));console.log({performance});
 } else {
 const matrix=await page.evaluate(()=>{const old=carGrp.position.y,rows=[];for(let c=0;c<FLOORS;c++){carGrp.position.y=FLOOR_Y[c]+S.CAR_H/2;rows.push(Array.from({length:FLOORS},(_,f)=>HallManual.allowed(f).ok));}carGrp.position.y=old;return rows;});
 assert.ok(matrix.flat().every(Boolean));
 // Open every floor independently, including distant floors, without moving the car door.
 for(let f=0;f<4;f++){
  await page.evaluate(f=>{HallManual.pick(f);HallManual.request(.5);},f);
  await page.waitForFunction(()=>HallManual.phase==='holding');
 }
 assert.deepEqual(await page.evaluate(()=>hatchDoors.map(h=>h.manualOpen)),[.5,.5,.5,.5]);
 assert.equal(await page.evaluate(()=>insMode&&CarDoor.secured()),true);
 assert.match(await page.locator('#hall-message').textContent(),/카 없음/);
 await page.click('#hall-open');await page.waitForFunction(()=>hatchDoors[3].manualOpen===1&&!HallManual.busy);
 await page.screenshot({path:`${out}/compact-desktop.png`});
 const hold=async(id,ms=350)=>{const b=await page.locator(id).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();};
 const y=await page.evaluate(()=>carGrp.position.y);
 await hold('#hall-up');assert.equal(await page.evaluate(()=>carGrp.position.y),y);
 await page.click('#hall-bypass summary');await page.click('[data-for="bypass-mode"] [data-value="car"]');
 assert.equal(await page.evaluate(()=>DoorBypass.mode),'car');await hold('#hall-up');assert.equal(await page.evaluate(()=>carGrp.position.y),y);
 await page.click('[data-for="bypass-mode"] [data-value="hall"]');
 await hold('#hall-up');assert.ok(await page.evaluate(y=>carGrp.position.y>y,y));
 const stopped=await page.evaluate(()=>carGrp.position.y);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>carGrp.position.y),stopped);
 await hold('#hall-dn');assert.ok(await page.evaluate(y=>carGrp.position.y<y,stopped));
 // Stop on pointer cancellation and on panel dismissal.
 await page.evaluate(()=>{insHold=1;insStart(1);window.dispatchEvent(new Event('pointercancel'));});
 assert.equal(await page.evaluate(()=>moving),false);
 await page.evaluate(()=>{insHold=1;insStart(1);HallManual.dismiss();});assert.equal(await page.evaluate(()=>moving),false);
 await page.evaluate(()=>HallManual.pick(3));await page.click('#hall-close');await page.waitForFunction(()=>!hatchDoors[3].manualActive);
 assert.deepEqual(await page.evaluate(()=>hatchDoors.slice(0,3).map(h=>h.manualOpen)),[.5,.5,.5]);
 await page.click('#hall-reset');await page.waitForFunction(()=>!inspectionResetting&&!moving&&!insMode);
 assert.equal(await page.evaluate(()=>!HallManual.active&&DoorBypass.mode==='off'&&DoorBypass.hallSecured()&&CarDoor.secured()),true);
 // Portrait touch and bounds at 390px and 320px.
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>{HallManual.select(2);HallManual.observe();HallManual.dismiss();});
  await page.tap('#hall-action-2');await page.tap('#hall-half');await page.waitForFunction(()=>HallManual.phase==='holding');
  assert.equal(await page.evaluate(()=>insMode),true);
  const bounds=await page.evaluate(()=>Object.fromEntries(['statusbar','hall-panel'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,right:r.right,width:r.width,bottom:r.bottom}];})));
  // 모바일 개편(js/mobile-hud.js): 상태 카드는 상단 전체 폭, 점검 패널은 그 아래 왼쪽 좁은 열.
  assert.ok(bounds.statusbar.right<=width&&bounds['hall-panel'].width<=160&&bounds['hall-panel'].y>=bounds.statusbar.bottom);
  assert.ok(bounds['hall-panel'].right<=width&&bounds['hall-panel'].bottom<=844);
  await page.screenshot({path:`${out}/compact-${width}.png`});
  await page.tap('#hall-dismiss');assert.equal(await page.locator('#hall-panel').isHidden(),true);
  await page.tap('#hall-action-2');await page.tap('#hall-close');await page.waitForFunction(()=>!HallManual.active);
  await page.tap('#hall-reset');await page.waitForFunction(()=>!inspectionResetting&&!insMode);
 }
 // An already open car door can close without dragging an independently opened hall door.
 await page.evaluate(()=>openDoors());await page.waitForFunction(()=>doorOpen&&!CarDoor.state.busy);
 await page.evaluate(()=>{HallManual.select(curFloor);HallManual.request(.5);});await page.waitForFunction(()=>HallManual.phase==='holding');
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>CarDoor.secured()&&!doorOpen);
 assert.equal(await page.evaluate(()=>hatchDoors[curFloor].manualOpen),.5);
 await page.evaluate(()=>resetInspections());await page.waitForFunction(()=>!inspectionResetting&&!insMode);
 // Normal automatic travel still works after reset.
 await page.evaluate(()=>moveElevator(1));await page.waitForFunction(()=>!moving&&curFloor===1);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/compact.json`,JSON.stringify({performance,matrix,errors},null,2));console.log({performance,matrix,errors});
 }
} finally {await browser.close();}
