import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='.shot-emergency-lighting',before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(60000);
 await page.routeWebSocket('**',ws=>ws.close()); // Live Server의 파일 저장 자동 리로드만 차단.
 if(before)await page.route('**/js/emergency-lighting.js*',route=>route.fulfill({contentType:'text/javascript',body:'const EmergencyLighting={build(){},update(){}};'}));
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&carGrp.getObjectByName('terraceCeiling')?.userData.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 if(!before)await page.waitForFunction(()=>EmergencyLighting.ready);
 const look=async mode=>{await page.evaluate(mode=>{gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);controls.enableDamping=false;
  const p=mode==='top'?[.80,S.CAR_H/2+1.50,.30]:[.30,.15,-.35];
  const t=mode==='top'?[-.72,S.CAR_H/2+.36,.68]:[-.37,S.CAR_H/2-.20,1.02];
  camera.position.copy(carGrp.localToWorld(new THREE.Vector3(...p)));controls.target.copy(carGrp.localToWorld(new THREE.Vector3(...t)));controls.update();updateManualCameraNear();},mode);await page.waitForTimeout(500);};
 const perf=()=>page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const n=await new Promise(requestAnimationFrame);a.push(n-last);last=n;}a.sort((a,b)=>a-b);return {median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await look('top');report.topOff=await perf();await page.screenshot({path:`${out}/${before?'before':'after'}-top-off.png`});
 if(!before){
  const state=()=>page.evaluate(()=>({on:EmergencyLighting.on,lamps:EmergencyLighting.lamps.map(l=>({lit:l.userData.lit,position:l.getWorldPosition(new THREE.Vector3()).toArray(),parent:l.parent.name,leds:l.getObjectByName('LampLEDs').children.map(m=>m.material.emissiveIntensity)})),normal:BuildingLights.state}));
  report.off=await state();assert.equal(report.off.on,false);assert.equal(report.off.lamps.length,2);assert.ok(report.off.lamps.every(l=>!l.lit&&l.leds.every(v=>v===0)));
  const button=page.locator('#emergency-light-action');assert.equal(await button.isVisible(),true);await button.click();report.on=await state();assert.equal(report.on.on,true);assert.ok(report.on.lamps.every(l=>l.lit&&l.leds.every(v=>v>=3)));assert.deepEqual(report.on.normal,report.off.normal);
  report.topOn=await perf();await page.screenshot({path:`${out}/after-top-on.png`});
  report.geometry=await page.evaluate(()=>{scene.updateMatrixWorld(true);const box=o=>{const b=new THREE.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray()};};
   const power=EmergencyLighting.power,roof=carGrp.getObjectByName('roofDeck'),top=carGrp.getObjectByName('carTopBoxTop'),phone=carGrp.getObjectByName('emergencyCall_carTop');
   const cabin=EmergencyLighting.lamps[1],cabinPoint=cabin.getWorldPosition(new THREE.Vector3());
   const ray=new THREE.Raycaster(cabinPoint.clone().add(new THREE.Vector3(0,-.03,0)),new THREE.Vector3(0,1,0));
   const hit=ray.intersectObject(carGrp.getObjectByName('terraceCeiling'),true)[0];
   return {power:box(power.getObjectByName('EmergencyPowerUnit')),roof:box(roof),topLamp:box(EmergencyLighting.lamps[0].getObjectByName('EmergencyRoundLamp')),top:box(top),phone:box(phone),cabinMountGap:hit?hit.point.y-cabinPoint.y:null,spec:EmergencyLighting.lamps[0].getObjectByName('EmergencyRoundLamp').userData};});
  assert.equal(report.geometry.spec.ledCount,12);assert.ok(report.geometry.power.min[1]>=report.geometry.roof.max[1]-.0001);assert.ok(report.geometry.topLamp.min[1]>=report.geometry.top.max[1]-.0001);
  assert.ok(report.geometry.topLamp.min[2]>report.geometry.phone.max[2],'상부 원형등과 비상통화장치 간극');
  assert.ok(report.geometry.cabinMountGap>=0&&report.geometry.cabinMountGap<.002,'카내 원형등 천장 밀착');
  await look('inside');assert.equal(await button.isVisible(),false);report.insideOn=await perf();await page.screenshot({path:`${out}/inside-on.png`});
  await page.evaluate(()=>EmergencyLighting.toggle());report.insideOff=await perf();await page.screenshot({path:`${out}/inside-off.png`});
  // 모델 세부: 카상부 두 제품을 위에서 가까이 확인한다.
  for(const [kind,name] of [['power','power-detail'],['lamp','lamp-detail']]){
   await page.evaluate(kind=>{const g=kind==='power'?EmergencyLighting.power:EmergencyLighting.lamps[0];const t=g.getWorldPosition(new THREE.Vector3());controls.target.copy(t);camera.position.copy(t).add(new THREE.Vector3(.20,.42,.13));controls.update();updateManualCameraNear();},kind);
   await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}.png`});
  }
  await look('inside');
  // 실제 도어 개폐·층 운행 중 장착 위치/상태 추종.
  await page.evaluate(()=>openDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE&&!doorOpen);
  const localBefore=await page.evaluate(()=>EmergencyLighting.lamps.map(l=>carGrp.worldToLocal(l.getWorldPosition(new THREE.Vector3())).toArray()));
  await page.locator('#fbtns button').filter({hasText:'2F'}).click();await page.waitForFunction(()=>curFloor===1&&currentState===ELEVATOR_STATE.DOOR_OPEN);
  const localAfter=await page.evaluate(()=>EmergencyLighting.lamps.map(l=>carGrp.worldToLocal(l.getWorldPosition(new THREE.Vector3())).toArray()));
  localBefore.forEach((a,i)=>a.forEach((v,j)=>assert.ok(Math.abs(v-localAfter[i][j])<1e-6)));report.travel=true;
  await page.setViewportSize({width:390,height:844});await look('top');await page.tap('#emergency-light-action');assert.equal((await state()).on,true);
  await page.screenshot({path:`${out}/mobile-top-on.png`});await page.tap('#emergency-light-action');assert.equal((await state()).on,false);
  await page.evaluate(()=>PartActions.setIconsVisible(false));assert.equal(await button.isVisible(),false);await page.evaluate(()=>PartActions.setIconsVisible(true));await page.waitForTimeout(100);assert.equal(await button.isVisible(),true);
  await page.tap('#emergency-light-action');await look('inside');await page.screenshot({path:`${out}/mobile-inside-on.png`});
 }else{await look('inside');report.insideOff=await perf();}
 report.errors=errors;assert.deepEqual(errors,[]);
}finally{await browser.close();fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));console.log('verify_emergency_lighting OK');
