import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='.shot-inspection-return';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850},hasTouch:true});page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});await page.routeWebSocket('**',ws=>ws.close());
 await page.addInitScript(()=>{window.tones=[];const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const o=original.call(this),set=o.frequency.setValueAtTime.bind(o.frequency);o.frequency.setValueAtTime=(...a)=>{window.tones.push(a[0]);return set(...a);};return o;};});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene.getObjectByName('carInspectionStation')?.userData.ready&&scene.getObjectByName('HallCallButton_1')&&CarDoor.state?.ready&&document.getElementById('loading').classList.contains('hide'));
 await page.waitForTimeout(500);
 const park=async(f,offset=0)=>page.evaluate(([f,offset])=>{clearTimeout(autoTimer);const y=FLOOR_Y[f]+S.CAR_H/2+offset,d=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=d;curFloor=f;refreshRopes();refreshGovernorRope();},[f,offset]);
 const begin=async key=>{await page.evaluate(key=>InspectionStations.toggle(key),key);await page.waitForFunction(()=>InspectionStations.ready);};
 const clickReset=async()=>{const b=await page.locator('#inspection-return').boundingBox();assert.ok(b);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const done=async floor=>{await page.waitForFunction(()=>InspectionReturn.state.stage==='complete');const s=await page.evaluate(()=>({floor:curFloor,insMode,moving,doorOpen,secured:CarDoor.secured(),hall:DoorBypass.hallSecured(),mascot:Mascot.inspecting,state:currentState}));assert.deepEqual(s,{floor,insMode:false,moving:false,doorOpen:false,secured:true,hall:true,mascot:false,state:'IDLE'});};
 const mount=await page.evaluate(()=>{const g=scene.getObjectByName('carInspectionStation'),m=carGrp.getObjectByName('carFrameGrp').userData.inspectionMount;return {p:g.position.toArray(),top:m.topY,normal:new THREE.Vector3(0,0,1).applyQuaternion(g.quaternion).toArray(),scale:g.scale.toArray()};});
 assert.ok(Math.abs(mount.p[1]-mount.top-.002)<1e-6);assert.ok(mount.normal[1]>.999);assert.deepEqual(mount.scale,[1,1,1]);
 await page.evaluate(()=>{const p=scene.getObjectByName('carInspectionStation').getWorldPosition(new THREE.Vector3());controls.enableDamping=false;camera.position.copy(p).add(new THREE.Vector3(.9,.62,1.0));controls.target.copy(p);controls.update();});await page.screenshot({path:`${out}/top-mount.png`});
 // Pit: exactly four twists, no door translation, real long press and beep, 1F return + one cycle.
 await park(0,1.2);await begin('pit');await clickReset();
 await page.evaluate(()=>{window.returnTrace={stages:[],maxDoorDuringKey:0,opened:0};let old='';window.traceTimer=setInterval(()=>{const s=InspectionReturn.state.stage,t=window.returnTrace;if(s!==old){t.stages.push(s);if(s==='open')t.opened++;old=s;}if(s==='key'){t.maxDoorDuringKey=Math.max(t.maxDoorDuringKey,Math.abs(hatchDoors[0].right.position.x-hatchDoors[0].right.userData.cx));}},10);});
 await page.waitForFunction(()=>InspectionReturn.state.clicks===2);await page.screenshot({path:`${out}/pit-key.png`});
 await page.waitForFunction(()=>InspectionReturn.state.stage==='call-hold');const holdStart=Date.now();await page.screenshot({path:`${out}/pit-call.png`});
 await page.waitForFunction(()=>InspectionReturn.state.stage==='beep');assert.ok(Date.now()-holdStart>1500);
 await page.waitForFunction(()=>InspectionReturn.state.stage==='returning');await page.screenshot({path:`${out}/pit-return.png`});
 await page.waitForFunction(()=>InspectionReturn.state.stage==='open');await page.screenshot({path:`${out}/pit-open.png`});await done(0);
 const pit=await page.evaluate(()=>{clearInterval(window.traceTimer);return {trace:window.returnTrace,state:InspectionReturn.state,tones:window.tones};});
 assert.equal(pit.state.clicks,4);assert.equal(pit.trace.maxDoorDuringKey,0);assert.equal(pit.trace.opened,1);assert.ok(pit.tones.some(f=>Math.abs(f-1500)<1));
 console.log('PASS pit',pit.state);
 // Car: nearest floor, no key routine; a 390px touch on reset must also work.
 await page.setViewportSize({width:390,height:844});await park(1,.8);await begin('car');
 await page.screenshot({path:`${out}/mobile-controls.png`});const r=await page.locator('#inspection-return').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390);
 await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await page.waitForFunction(()=>InspectionReturn.state.stage==='returning');assert.equal(await page.evaluate(()=>InspectionReturn.state.clicks),0);
 await page.waitForFunction(()=>InspectionReturn.state.stage==='open');await page.screenshot({path:`${out}/car-open.png`});await done(1);console.log('PASS car nearest');
 // Already aligned: still open and close once, with no floor change.
 await begin('car');await clickReset();await done(1);console.log('PASS aligned');
 // Emergency stop during key action cancels all delayed motion; retry is explicit.
 await begin('pit');await clickReset();await page.waitForFunction(()=>InspectionReturn.state.clicks===1);
 await page.locator('#btn-estop').click();assert.equal(await page.evaluate(()=>InspectionReturn.busy),false);
 const frozen=await page.evaluate(()=>carGrp.position.y);await page.waitForTimeout(3500);assert.equal(await page.evaluate(()=>carGrp.position.y),frozen);assert.equal(await page.evaluate(()=>hatchDoors[0].keyRatio),0);
 await page.locator('#btn-estop').click();await page.evaluate(()=>resetInspections());await page.waitForFunction(()=>!inspectionResetting&&!moving);
 // Emergency stop in return travel cannot later open the doors at a stale target.
 await park(1,1);await begin('car');await clickReset();await page.waitForFunction(()=>moving);await page.locator('#btn-estop').click();
 const stopped=await page.evaluate(()=>carGrp.position.y);await page.waitForTimeout(3500);assert.equal(await page.evaluate(()=>carGrp.position.y),stopped);assert.equal(await page.evaluate(()=>doorOpen),false);
 const result={mount,pit,errors};fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));assert.deepEqual(errors,[]);console.log('PASS cancellation; errors',errors);
}finally{await browser.close();}
