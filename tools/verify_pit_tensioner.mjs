import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const baseline=process.argv.includes('--baseline'),out='.shot-pit-tensioner';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={baseline};
try {
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(baseline)await page.route('**/js/environment.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('temporary/tension-weight/environment-before.js','utf8')}));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof pitGrp!=='undefined'&&pitGrp&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 if(!baseline)await page.waitForFunction(()=>scene.getObjectByName('PitTensionerMount')?.userData.ready);
 const aim=async(side)=>page.evaluate(side=>{
  controls.enableDamping=false;carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();refreshGovernorRope();
  const p=new THREE.Vector3(GOV_TENS_X,Y0+.62,GOV_TENS_Z);
  camera.fov=40;camera.updateProjectionMatrix();controls.target.copy(p);
  camera.position.copy(p).add(new THREE.Vector3(side*1.35,.30,.50));controls.update();
 },side);
 await aim(-1);await page.waitForTimeout(700);
 report.performance=await page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return {median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await page.screenshot({path:`${out}/${baseline?'before':'after'}-guard.png`});
 await aim(1);await page.screenshot({path:`${out}/${baseline?'before':'after'}-open.png`});
 if(!baseline){
  report.geometry=await page.evaluate(()=>{
   scene.updateMatrixWorld(true);
   const mount=scene.getObjectByName('PitTensionerMount'),model=mount.getObjectByName('PitTensioner');
   const bounds=o=>{const b=new THREE.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray()};};
   const b=new THREE.Box3().setFromObject(model),s=PIT_TENSIONER_SPEC;
   const origin=tensionSheaveGrp.getWorldPosition(new THREE.Vector3());
   const before=new THREE.Box3().setFromObject(mount.getObjectByName('ProtectiveGuard'));
   const r=tensionSheaveGrp.rotation.x;tensionSheaveGrp.rotation.x+=.73;scene.updateMatrixWorld(true);
   const after=new THREE.Box3().setFromObject(mount.getObjectByName('ProtectiveGuard'));tensionSheaveGrp.rotation.x=r;
   const sw=mount.getObjectByName('TensionSwitch'),striker=mount.getObjectByName('SwitchStriker');
   const contact=mount.localToWorld(new THREE.Vector3(s.switchCenter[0],s.plungerTop+.0001,s.switchCenter[2]));
   const ray=new THREE.Raycaster(contact,new THREE.Vector3(0,1,0));
   const hit=ray.intersectObject(striker,true)[0];
   const measuredGap=hit?hit.point.y-(contact.y-.0001):null;
   const capRay=new THREE.Raycaster(mount.localToWorld(new THREE.Vector3(s.switchCenter[0],s.strikerBottom+.01,s.switchCenter[2])),new THREE.Vector3(0,-1,0));
   const capHit=capRay.intersectObject(sw,true)[0];
   const capError=capHit?Math.abs(capHit.point.y-(contact.y-.0001)):null;
   // Geometry-only descent to first contact, then restore. No new FSM scenario.
   const fixedBefore=bounds(sw),moving=[mount.getObjectByName('ProtectiveGuard'),mount.getObjectByName('WeightAndYoke'),striker];
   for(const o of moving)o.position.y-=s.strikerBottom-s.plungerTop;
   scene.updateMatrixWorld(true);
   const touchRay=new THREE.Raycaster(contact.clone().add(new THREE.Vector3(0,-.001,0)),new THREE.Vector3(0,1,0));
   const touchHit=touchRay.intersectObject(striker,true)[0];
   const descentContactError=touchHit?Math.abs(touchHit.point.y-(contact.y-.0001)):null;
   const switchStayedFixed=JSON.stringify(bounds(sw))===JSON.stringify(fixedBefore);
   for(const o of moving)o.position.y+=s.strikerBottom-s.plungerTop;
   scene.updateMatrixWorld(true);
   return {measuredGap,capError,descentContactError,switchStayedFixed,switchCenter:s.switchCenter,
    switchBehindGuard:bounds(sw).min[0]>before.max.x,switchWithinGuardDepth:bounds(sw).min[2]>before.min.z&&bounds(sw).max[2]<before.max.z,
    pivot:origin.toArray(),ropePivotError:Math.abs(origin.y-govRopeData.botY)+Math.abs(origin.x-govRopeData.x),floorClearance:b.min.y-(Y0+.02),carClearance:b.min.x-S.CAR_W/2,wallClearance:S.SHAFT_W/2-b.max.x,switchGap:s.strikerBottom-s.plungerTop,guardFixed:before.min.equals(after.min)&&before.max.equals(after.max),guard:bounds(mount.getObjectByName('ProtectiveGuard')),sheave:bounds(tensionSheaveGrp),model:bounds(model),switchVisualOnly:sw.userData.visualOnly};
  });
  const g=report.geometry;assert.ok(g.ropePivotError<1e-6);assert.ok(g.floorClearance>.1);assert.ok(g.carClearance>.1);assert.ok(g.wallClearance>.05);assert.ok(g.switchGap>.01);assert.ok(g.guardFixed);assert.ok(g.switchVisualOnly);
  assert.ok(g.measuredGap!==null&&Math.abs(g.measuredGap-g.switchGap)<1e-6);assert.ok(g.capError!==null&&g.capError<1e-6);
  assert.ok(g.descentContactError!==null&&g.descentContactError<1e-6&&g.switchStayedFixed);
  assert.ok(g.switchBehindGuard&&g.switchWithinGuardDepth&&g.switchCenter[1]>0);
  await page.evaluate(()=>{const s=PIT_TENSIONER_SPEC.switchCenter,p=new THREE.Vector3(GOV_TENS_X+s[0],Y0+.8+s[1],GOV_TENS_Z+s[2]);controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.40,.13,.32));controls.update();});
  await page.screenshot({path:`${out}/switch.png`});
  await page.setViewportSize({width:390,height:844});await aim(1);await page.screenshot({path:`${out}/mobile-open.png`});
  await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready));
  const start=await page.evaluate(()=>{
   carGrp.position.y=FLOOR_Y[0]+S.CAR_H/2;refreshRopes();refreshGovernorRope();
   const result={angle:tensionSheaveGrp.rotation.x,y:carGrp.position.y};moveElevator(1);return result;
  });
  await page.waitForFunction(()=>curFloor===1&&currentState===ELEVATOR_STATE.DOOR_OPEN);
  report.travel=await page.evaluate(start=>{
   clearTimeout(autoTimer);const actual=tensionSheaveGrp.rotation.x-start.angle,expected=-(carGrp.position.y-start.y)/(mrGrp.userData.govR||.15);
   return {floor:curFloor,actual,expected,error:Math.abs(actual-expected)};
  },start);
  assert.ok(report.travel.error<1e-6);await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>!doorOpen&&CarDoor.secured());
 }
 report.errors=errors;assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${baseline?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
