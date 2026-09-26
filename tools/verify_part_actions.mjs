import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-part-actions';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:850},hasTouch:mobile});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>govHandles()?.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&PitLadder.secured&&CarDoor.state?.ready&&document.getElementById('loading').classList.contains('hide'));
  const click=async selector=>mobile?page.tap(selector):page.click(selector);
  await click('[data-menu="dd-inst"]');
  assert.equal(await page.locator('#dd-inst #btn-overspeed,#dd-inst #btn-ucm,#btn-pit-ladder,[data-mobile-panel="brake"],#mobile-tools #btn-overspeed').count(),0);
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-menu.png`});
  await page.evaluate(()=>{
   closeAllMenus();const y=FLOOR_Y[2]+S.CAR_H/2,delta=y-carGrp.position.y;
   carGrp.position.y=y;cwtGrp.position.y-=delta;curFloor=2;refreshRopes();refreshGovernorRope();
   controls.enableDamping=false;camera.position.set(-.35,2.1,-.1);controls.target.set(-1.55,1.75,.85);controls.update();
  });
  await page.waitForFunction(()=>!document.getElementById('pit-ladder-action').hidden);
  await click('#pit-ladder-action');await page.waitForFunction(()=>PitLadder.deployed);
  assert.equal(await page.locator('#pit-ladder-action').textContent(),'');
  assert.equal(await page.locator('#pit-ladder-action').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-ladder.png`});
  await click('#pit-ladder-action');await page.waitForFunction(()=>PitLadder.secured);
  await page.evaluate(()=>{
   const b=new THREE.Box3().setFromObject(scene.getObjectByName('RopeBrake'));
   const p=b.getCenter(new THREE.Vector3());controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(2,1.2,2));controls.update();
  });
  await page.waitForFunction(()=>!document.getElementById('rope-brake-action').hidden);
  await click('#rope-brake-action');await click('#rope-brake-panel [data-value="fail"]');
  assert.equal(await page.locator('#ucm-brake').inputValue(),'fail');
  assert.equal(await page.locator('#rope-brake-panel [data-value="fail"]').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-brake.png`});
  await click('#rope-brake-panel [data-value="normal"]');await click('#btn-ucm');
  await page.waitForFunction(()=>UCMDemo.state.stage==='done',{},{timeout:45000});
  assert.equal(await page.locator('#rope-brake-panel').isVisible(),false);
  await click('#fault-reset');await page.waitForFunction(()=>!UCMDemo.state.active&&!moving&&!estop,{},{timeout:30000});
  await page.evaluate(()=>{
   const p=govHandles().wheel.getWorldPosition(new THREE.Vector3());controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(1.8,.9,1.8));controls.update();
  });
  await page.waitForFunction(()=>!document.getElementById('btn-overspeed').hidden);
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-governor.png`});
  await click('#btn-overspeed');await page.waitForFunction(()=>governorPhase==='tripped'&&document.getElementById('btn-overspeed').textContent==='RST',{},{timeout:45000});
  assert.equal(await page.locator('#btn-overspeed').getAttribute('aria-label'),'조속기 복귀');
  await click('#fault-reset');await page.waitForFunction(()=>!overspeedActive&&!moving&&!estop,{},{timeout:30000});
  if(mobile){
   await page.setViewportSize({width:844,height:390});await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('#part-actions #btn-overspeed').count(),1);
  }
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.part-action')].filter(e=>!e.hidden&&e.getClientRects().length).flatMap(e=>{const b=e.getBoundingClientRect();return b.width!==44||b.height!==44||getComputedStyle(e).fontSize!=='0px'?[e.id]:[];})),[]);
  console.log('PASS',mobile?'mobile':'desktop');await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
