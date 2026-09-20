import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const out=path.resolve('.shot-car-underbody');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.error(r.url(),r.failure()));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof CarDoor!=='undefined'&&CarDoor.state?.ready&&govHandles()?.ready,{},{timeout:90000});
 const geometry=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);const apron=carGrp.getObjectByName('carApron'),beacon=carGrp.getObjectByName('carBypassBeacon');
  const a=new THREE.Box3().setFromObject(apron),b=new THREE.Box3().setFromObject(beacon),o=new THREE.Box3().setFromObject(carGrp.getObjectByName('carOverloadAssembly'));
  return {apron:apron.userData,beacon:beacon.userData,overloadGap:b.min.z-o.max.z,apronGap:a.min.z-b.max.z,pitClearance:a.min.y-Y0,frontGap:HALL_SILL_SHAFT_Z-a.max.z,shaftSideGap:S.SHAFT_W/2-Math.max(Math.abs(a.min.x),Math.abs(a.max.x))};
 });
 assert.equal(geometry.apron.height,.75);assert.ok(geometry.apron.width>=1.5);assert.ok(geometry.overloadGap>0);assert.ok(geometry.apronGap>0);assert.ok(geometry.pitClearance>.35);assert.ok(geometry.frontGap>.02);assert.ok(geometry.shaftSideGap>0);
 await page.click('[data-menu="dd-inst"]');await page.selectOption('#bypass-mode','hall');
 const blocked=await page.evaluate(()=>{openDoors();moveElevator(2);setInspectionMode(false);return {insMode,mode:DoorBypass.mode,moving,doorOpen};});
 assert.deepEqual(blocked,{insMode:true,mode:'hall',moving:false,doorOpen:false});
 await page.evaluate(()=>{hatchDoors[0].hook.rotation.z=-.2;insStart(1);});
 await page.waitForFunction(()=>DoorBypass.active);
 const signal=await page.evaluate(async()=>{const samples=[];for(let i=0;i<10;i++){samples.push({lit:carGrp.getObjectByName('carBypassBeacon').userData.lit,y:carGrp.position.y,gain:DoorBypass.audioState.gain});await new Promise(r=>setTimeout(r,100));}return {samples,audio:DoorBypass.audioState,rejectBoth:!DoorBypass.setMode('both'),rejectMoving:!DoorBypass.setMode('car')};});
 assert.ok(signal.samples.some(s=>s.lit)&&signal.samples.some(s=>!s.lit));assert.ok(signal.samples.at(-1).y>signal.samples[0].y);assert.equal(signal.audio.context,'running');assert.equal(signal.audio.frequency,880);assert.equal(signal.rejectBoth,true);assert.equal(signal.rejectMoving,true);
 assert.ok(signal.samples.some(s=>s.gain>.02)&&signal.samples.some(s=>s.gain<.001));
 await page.evaluate(()=>insStop());assert.equal(await page.evaluate(()=>DoorBypass.active),false);
 assert.equal(await page.evaluate(()=>DoorBypass.audioState.gain),0);
 await page.evaluate(()=>{hatchDoors[0].hook.rotation.z=0;DoorBypass.setMode('car');CarDoor.state.locked=false;insStart(1);});
 await page.waitForFunction(()=>moving);
 await page.evaluate(()=>{carDoorR.position.x+=.015;});await page.waitForFunction(()=>!moving);
 assert.equal(await page.evaluate(()=>DoorBypass.active),false);
 await page.evaluate(()=>{carDoorR.position.x=CarDoor.dimensions().cx;CarDoor.state.locked=true;insStart(1);});
 await page.waitForFunction(()=>moving);
 // Car bypass must still monitor every landing lock, including another floor.
 await page.evaluate(()=>{hatchDoors[2].hook.rotation.z=-.2;});
 await page.waitForFunction(()=>!moving);
 assert.equal(await page.evaluate(()=>DoorBypass.audioState.gain),0);
 assert.equal(await page.evaluate(()=>{insStart(1);return moving;}),false);
 await page.evaluate(()=>{hatchDoors[2].hook.rotation.z=0;DoorBypass.setMode('hall');insStart(1);});
 await page.waitForFunction(()=>moving);
 await page.evaluate(()=>{CarDoor.state.locked=false;});
 await page.waitForFunction(()=>!moving);
 assert.equal(await page.evaluate(()=>{insStart(1);return moving;}),false);
 await page.evaluate(()=>{CarDoor.state.locked=true;insStart(1);});
 await page.waitForFunction(()=>DoorBypass.active);
 // Dispatch the actual stop handler without pointerup stopping inspection first.
 await page.evaluate(()=>document.getElementById('btn-estop').click());
 const emergency=await page.evaluate(()=>({estop,moving,active:DoorBypass.active,gain:DoorBypass.audioState.gain,lit:carGrp.getObjectByName('carBypassBeacon').userData.lit}));
 assert.deepEqual(emergency,{estop:true,moving:false,active:false,gain:0,lit:false});
 await page.evaluate(()=>{document.getElementById('btn-estop').click();DoorBypass.setMode('off');});
 // Isolate the relevant car assembly for front and underside visual QA.
 await page.evaluate(()=>{
  const delta=FLOOR_Y[1]+S.CAR_H/2-carGrp.position.y;carGrp.position.y+=delta;cwtGrp.position.y-=delta;curFloor=1;
  scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
  scene.background=new THREE.Color('#8798aa');scene.fog=null;
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
  const p=carGrp.position;camera.position.set(2,p.y-2.3,p.z+4.1);controls.target.set(0,p.y-1.7,p.z+.5);controls.update();
 });
 await page.screenshot({path:path.join(out,'apron-installed.png')});
 await page.evaluate(()=>{const b=carGrp.getObjectByName('carBypassBeacon').getWorldPosition(new THREE.Vector3());camera.position.copy(b).add(new THREE.Vector3(.38,-.34,.30));controls.target.copy(b);controls.update();CarUnderbody.flash(true,true);});
 await page.screenshot({path:path.join(out,'beacon-on.png')});
 await page.evaluate(()=>CarUnderbody.flash(false,false));await page.screenshot({path:path.join(out,'beacon-off.png')});
 const touch=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});const tp=await touch.newPage();tp.on('pageerror',e=>errors.push(e.message));
 await tp.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});await tp.waitForFunction(()=>typeof CarDoor!=='undefined'&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await tp.tap('[data-menu="dd-inst"]');await tp.selectOption('#bypass-mode','car');
 assert.equal(await tp.locator('#bypass-status').textContent(),'BYPASS · 카문');
 await tp.screenshot({path:path.join(out,'touch-bypass.png')});await touch.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({geometry,blocked,signal,emergency,contactGuards:true,errors},null,2));console.log('PASS',JSON.stringify({geometry,blocked,audio:signal.audio,emergency,contactGuards:true,errors}));
} finally {await browser.close();}
