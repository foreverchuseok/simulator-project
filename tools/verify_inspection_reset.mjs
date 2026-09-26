import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-inspection-reset';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:850},hasTouch:mobile,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>CarDoor.state?.ready&&PitLadder.secured&&hatchDoors.every(h=>h.interlock?.ready)&&document.getElementById('loading').classList.contains('hide'));
  await page.evaluate(()=>{
   for(const f of [0,1,3]){HallManual.select(f);HallManual.key();HallManual.open(.93);}
   HallManual.select(2);document.getElementById('hall-panel').hidden=false;
   const y=FLOOR_Y[1]+S.CAR_H/2+.35,delta=y-carGrp.position.y;
   carGrp.position.y=y;cwtGrp.position.y-=delta;refreshRopes();refreshGovernorRope();
   DoorBypass.setMode('hall');PitLadder.toggle();
  });
  const beforeCamera=await page.evaluate(()=>camera.position.toArray());
  if(mobile)await page.tap('#hall-reset');else await page.click('#hall-reset');
  await page.waitForFunction(()=>!inspectionResetting&&document.getElementById('v-dir').textContent.includes('리셋 완료'),{},{timeout:30000});
  const state=await page.evaluate(()=>({hall:DoorBypass.hallSecured(),manual:hatchDoors.some(h=>h.manualActive||h.manualOpen||h.keyRatio),car:CarDoor.secured(),ladder:PitLadder.secured,bypass:DoorBypass.mode,insMode,estop,moving,selected:HallManual.selected,floor:curFloor,aligned:CarDoor.alignedFloor(),camera:camera.position.toArray()}));
  assert.deepEqual({...state,camera:null},{hall:true,manual:false,car:true,ladder:true,bypass:'off',insMode:false,estop:false,moving:false,selected:2,floor:1,aligned:1,camera:null});
  assert.deepEqual(state.camera,beforeCamera);
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-reset.png`});
  // Repeat reset while inspection drive is held, including emergency stop UI cleanup.
  await page.evaluate(()=>{setInspectionMode(true);insHold=1;insStart(1);});
  await page.waitForFunction(()=>moving);
  await page.evaluate(()=>document.getElementById('btn-estop').click());
  if(mobile)await page.tap('#hall-reset');else await page.click('#hall-reset');
  await page.waitForFunction(()=>!inspectionResetting,{},{timeout:30000});
  assert.equal(await page.evaluate(()=>!estop&&!insMode&&!moving&&insHold===0&&CarDoor.secured()&&document.getElementById('btn-estop').getAttribute('aria-pressed')==='false'),true);
  // Menu reset is reachable on the portrait dock and the desktop sheet.
  await page.click('#hall-dismiss');await page.click('[data-menu="dd-inst"]');
  assert.equal(await page.locator('#inspection-reset').isVisible(),true);
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-menu.png`});
  await page.click('#inspection-reset');await page.waitForFunction(()=>!inspectionResetting);
  await page.evaluate(()=>moveElevator(2));await page.waitForFunction(()=>!moving&&curFloor===2,{},{timeout:30000});
  if(!mobile){
   await page.waitForFunction(()=>!CarDoor.state.busy);
   assert.equal(await page.evaluate(()=>{UCMDemo.start(document.getElementById('btn-ucm'));const started=UCMDemo.state.active;resetInspections();return started;}),true);
   await page.waitForFunction(()=>!inspectionResetting&&!UCMDemo.state.active,{},{timeout:30000});
   assert.equal(await page.evaluate(()=>CarDoor.secured()&&!doorOpen&&!moving&&!estop),true);
   assert.equal(await page.evaluate(()=>{startOverspeedFault(document.getElementById('btn-overspeed'));const started=overspeedActive;resetInspections();return started;}),true);
   await page.waitForFunction(()=>!inspectionResetting&&!overspeedActive,{},{timeout:60000});
   assert.equal(await page.evaluate(()=>CarDoor.secured()&&!doorOpen&&!moving&&!estop),true);
  }
  console.log('PASS',mobile?'touch portrait':'desktop',state);
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
