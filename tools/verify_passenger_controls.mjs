import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-passenger-controls';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const errors=[];
const widths=process.argv.includes('--desktop-only')?[1280]:[1280,390,320];
try {
 for(const width of widths) {
  const context=await browser.newContext({viewport:{width,height:850},hasTouch:width<600,isMobile:width<600});
  const page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.stack));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>PassengerControls.keys.length===18&&CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
  await page.evaluate(()=>{controls.enableDamping=false;controls.minDistance=.05;});
  const tap=async(name)=>{
   await page.evaluate(name=>{
    leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    const o=scene.getObjectByName(name);scene.updateMatrixWorld(true);
    const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
    camera.position.copy(p).addScaledVector(normal,.55);controls.target.copy(p);camera.near=.002;camera.updateProjectionMatrix();controls.update();
   },name);
   await page.waitForTimeout(550);
   const pos=await page.evaluate(name=>{
    const o=scene.getObjectByName(name),p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
    const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
    return {x,y,picked:PartGlow.pickAt(x,y)?.objects[0].name};
   },name);
   assert.equal(pos.picked,name,`pick ${width}: ${name}`);
   if(width<600)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);
   assert.equal(await page.locator('#part-menu').evaluate(e=>e.hidden),true);
  };
  if(!process.argv.includes('--safety-only')) {
  // 실물 모든 카 버튼: 선택 즉시 점등, 두 OPB 연동, 도착/개방 후 소등.
  for(const prefix of ['opbFloorButton_','accessibleButton_'])for(const f of [2,3,4,1]) {
   await tap(prefix+f);
   assert.ok(await page.evaluate(f=>PassengerControls.pending.includes(f-1),f));
   assert.equal(await page.evaluate(f=>PassengerControls.keys.filter(k=>k.floor===f-1&&!k.dir).every(k=>k.on),f),true);
   await page.waitForFunction(f=>curFloor===f-1&&currentState===ELEVATOR_STATE.DOOR_OPEN,f);
   await page.waitForFunction(()=>PassengerControls.pending.length===0);
   console.log('CAR',width,prefix+f);
  }
  for(const prefix of ['opb','accessibleButton_']) {
   const close=prefix==='opb'?'opbDoorClose':prefix+'close',open=prefix==='opb'?'opbDoorOpen':prefix+'open';
   await tap(close);await page.waitForFunction(()=>!doorOpen&&!CarDoor.state.busy);
   await tap(open);await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
   await page.evaluate(()=>closeDoors());
   await page.waitForTimeout(200);
   // 이미 맞춘 열림 버튼을 다시 눌러 폐문 중 반전한다.
   if(width<600)await page.touchscreen.tap(width/2,425);else await page.mouse.click(width/2,425);
   await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
  }
  await page.screenshot({path:`${out}/${width}-car-open.png`});
  // 전층 승장 실물 버튼의 방향별 호출.
  for(const [f,dir] of [[1,'up'],[2,'up'],[2,'down'],[3,'up'],[3,'down'],[4,'down']]) {
   const name=await page.evaluate(([f,dir])=>{
    const o=scene.getObjectByName('HallCallButton_'+f).getObjectByName(dir==='up'?'ButtonUp':'ButtonDown');
    o.name=`testHall_${f}_${dir}`;return o.name;
   },[f,dir]);
   await tap(name);
   await page.waitForFunction(f=>curFloor===f-1&&currentState===ELEVATOR_STATE.DOOR_OPEN,f);
   await page.waitForFunction(()=>PassengerControls.pending.length===0);
   console.log('HALL',width,f,dir);
  }
  await page.screenshot({path:`${out}/${width}-hall.png`});
  await page.evaluate(()=>{closeDoors();});await page.waitForFunction(()=>!doorOpen&&!CarDoor.state.busy);
  await page.evaluate(()=>{PassengerControls.request(0);PassengerControls.request(1);PassengerControls.request(2);PassengerControls.request(1);});
  assert.deepEqual(await page.evaluate(()=>PassengerControls.pending),[0,1,2]);
  for(const f of [0,1,2])await page.waitForFunction(f=>curFloor===f&&currentState===ELEVATOR_STATE.DOOR_OPEN,f);
  await page.waitForFunction(()=>PassengerControls.pending.length===0);
  for(const name of ['opbEmergencyCall','accessibleButton_call']) {
   await tap(name);
   assert.equal(await page.evaluate(()=>EmergencyCall.state.phase),'connecting');
   assert.equal(await page.locator('#ec-caption').evaluate(e=>e.hidden),false);
   await page.waitForFunction(()=>EmergencyCall.state.phase==='connected');
   await page.screenshot({path:`${out}/${width}-${name}.png`});
   await tap(name);assert.equal(await page.evaluate(()=>EmergencyCall.state.phase),'idle');
  }
  }
  // 폐문 중 열림은 호출을 보존하되 열린 문으로 출발하지 않는다.
  await page.evaluate(()=>openDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
  await page.evaluate(()=>{window.testDestination=(curFloor+1)%FLOORS;PassengerControls.request(testDestination);});
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_CLOSING);
  await page.evaluate(()=>document.getElementById('btn-open').click());
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>moving),false);
  assert.equal(await page.evaluate(()=>PassengerControls.pending.includes(testDestination)),true);
  // 폐문 중 STOP, 복귀 후 취소된 목적지로 출발하지 않는다.
  await page.evaluate(()=>document.getElementById('btn-close').click());
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_CLOSING);
  await page.evaluate(()=>document.getElementById('btn-estop').click());
  await page.waitForFunction(()=>PassengerControls.pending.length===0);
  assert.equal(await page.evaluate(()=>PassengerControls.request(3)),false);
  await tap('opbEmergencyCall');assert.equal(await page.evaluate(()=>EmergencyCall.state.phase),'connecting');
  await page.evaluate(()=>{EmergencyCall.hangUp();document.getElementById('btn-estop').click();});
  await page.waitForFunction(()=>!CarDoor.state.busy&&!doorOpen);
  await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>moving),false);
  await page.evaluate(()=>setInspectionMode(true));
  assert.equal(await page.evaluate(()=>PassengerControls.request(3)),false);
  await page.evaluate(()=>setInspectionMode(false));
  // 중간 정지 뒤 이전 curFloor와 같은 층을 눌러도 실제 착상까지 복귀한다.
  await page.evaluate(()=>PassengerControls.request((curFloor+1)%FLOORS));await page.waitForFunction(()=>moving);
  await page.waitForTimeout(700);
  await page.evaluate(()=>document.getElementById('btn-estop').click());await page.waitForFunction(()=>PassengerControls.pending.length===0);
  await page.evaluate(()=>{document.getElementById('btn-estop').click();PassengerControls.request(curFloor);});
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
  assert.equal(await page.evaluate(()=>CarDoor.alignedFloor()===curFloor),true);
  // 카탑·피트 역시 기존 메뉴 항목을 거치지 않고 안내와 연결 표시가 시작된다.
  for(const key of ['carTop','pit']) {
   await page.evaluate(key=>{document.getElementById('ec-action-'+key).click();},key);
   assert.equal(await page.evaluate(()=>EmergencyCall.state.phase),'connecting');
   await page.evaluate(()=>EmergencyCall.hangUp());
  }
  console.log('PASS',width);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${process.argv.includes('--safety-only')?'safety':'result'}.json`,JSON.stringify({widths,errors},null,2));
} finally {await browser.close();}
