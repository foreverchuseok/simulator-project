import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='.shot-inspection-stations';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850},hasTouch:true});
 await page.routeWebSocket('**',ws=>ws.close());
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene.getObjectByName('carInspectionStation')?.userData.ready&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 assert.equal(await page.locator('[data-menu="dd-inst"],#dd-inst').count(),0);
 assert.equal(await page.locator('#inspection-drive button').count(),3);
 const look=async key=>{
  await page.evaluate(key=>{
   leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);controls.enableDamping=false;
   const n=scene.getObjectByName(key==='car'?'carInspectionStation':'pitInspectionStation'),p=n.getWorldPosition(new THREE.Vector3());
   controls.target.copy(p);camera.position.copy(p).add(key==='car'?new THREE.Vector3(.85,.65,1.15):new THREE.Vector3(1.3,.5,.7));controls.update();updateManualCameraNear();
  },key);await page.waitForTimeout(250);
 };
 const perf=()=>page.evaluate(async()=>{const a=[];let p=await new Promise(requestAnimationFrame);for(let i=0;i<120;i++){const n=await new Promise(requestAnimationFrame);a.push(n-p);p=n;}a.sort((a,b)=>a-b);return {median:a[60],p95:a[114],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 const click=async selector=>{const b=await page.locator(selector).boundingBox();assert.ok(b,selector+' visible');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const hold=async(dir,ms=650)=>{const b=await page.locator(dir>0?'#btn-ins-up':'#btn-ins-dn').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();};
 const y=()=>page.evaluate(()=>carGrp.position.y);
 const home=await page.evaluate(()=>Mascot.root.position.toArray());
 await page.evaluate(()=>{const p=Mascot.root.position;Mascot.root.rotation.y=0;camera.position.set(p.x,p.y+.84,p.z+.85);controls.target.set(p.x,p.y+.64,p.z);controls.enableDamping=false;controls.update();});
 await page.waitForTimeout(200);await page.screenshot({path:`${out}/helmet-logo.png`});
 await look('car');
 const before=await page.evaluate(()=>{const names=['carInspectionStation','carInspectionCable','carInspectionCableClips','MascotHelmetKOELSA'];return names.map(n=>{const o=scene.getObjectByName(n);if(o)o.visible=false;return n;});});
 const perfWithout=await perf();await page.evaluate(names=>names.forEach(n=>{const o=scene.getObjectByName(n);if(o)o.visible=true;}),before);
 const perfInstalled=await perf();await page.screenshot({path:`${out}/car-station.png`});
 await click('#inspection-action-car');await page.waitForFunction(()=>InspectionStations.ready);
 assert.equal(await page.evaluate(()=>insMode),true);
 await page.screenshot({path:`${out}/car-bear.png`});
 const offset=await page.evaluate(()=>Mascot.root.position.y-carGrp.position.y);
 const y0=await y();await hold(1);const y1=await y();assert.ok(y1>y0+.08);await page.waitForTimeout(200);assert.equal(await y(),y1);
 assert.ok(Math.abs(await page.evaluate(()=>Mascot.root.position.y-carGrp.position.y)-offset)<.001);
 await hold(-1);assert.ok(await y()<y1-.08);
 assert.equal(await page.evaluate(()=>HallManual.allowed(0).ok),false);
 // Keyboard release, blur and panel dismissal all stop movement.
 await page.locator('#btn-ins-up').focus();await page.keyboard.down('Space');await page.waitForTimeout(150);await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>insDir),0);
 await page.evaluate(()=>{insHold=1;insStart(1);window.dispatchEvent(new Event('blur'));});assert.equal(await page.evaluate(()=>insDir),0);
 await page.evaluate(()=>{insHold=1;insStart(1);closeAllMenus();});assert.equal(await page.evaluate(()=>insDir),0);assert.equal(await page.locator('#inspection-drive').isVisible(),false);
 await click('#inspection-action-car');assert.equal(await page.locator('#inspection-drive').isVisible(),true);
 const perfOperating=await perf();
 await click('#inspection-return');await page.waitForFunction(()=>InspectionReturn.state.stage==='complete');assert.equal(await page.evaluate(()=>InspectionStations.active),null);assert.deepEqual(await page.evaluate(()=>Mascot.root.position.toArray()),home);
 // Pit bear remains on pit floor while the car moves.
 await look('pit');await click('#inspection-action-pit');await page.waitForFunction(()=>InspectionStations.ready);
 const pitPose=await page.evaluate(()=>Mascot.root.position.toArray());await hold(1);assert.deepEqual(await page.evaluate(()=>Mascot.root.position.toArray()),pitPose);
 await page.screenshot({path:`${out}/pit-bear.png`});
 await page.setViewportSize({width:390,height:844});await look('pit');
 const touch=await page.context().newCDPSession(page);const b=await page.locator('#btn-ins-up').boundingBox();
 const mobileY=await y();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await page.waitForTimeout(350);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(await y()>mobileY);assert.equal(await page.evaluate(()=>insDir),0);
 await page.screenshot({path:`${out}/mobile-pit.png`});
 await page.evaluate(()=>resetInspections());await page.waitForFunction(()=>!inspectionResetting&&!moving);
 assert.equal(await page.evaluate(()=>InspectionStations.active),null);assert.equal(await page.evaluate(()=>insMode),false);
 // Station switching cannot leave two operators/modes active; resize cancels held drive.
 await look('car');await click('#inspection-action-car');await page.waitForFunction(()=>InspectionStations.ready);
 await page.screenshot({path:`${out}/mobile-car.png`});
 await page.evaluate(()=>{insHold=1;insStart(1);window.dispatchEvent(new Event('resize'));});assert.equal(await page.evaluate(()=>insDir),0);
 await page.evaluate(()=>resetInspections());await page.waitForFunction(()=>!inspectionResetting&&!moving);
 // Existing door inspection still owns and returns the same mascot.
 await page.evaluate(()=>{HallManual.select(0);HallManual.request(.5);});await page.waitForFunction(()=>HallManual.phase==='holding');
 assert.equal(await page.evaluate(()=>InspectionStations.toggle('car')),false);
 await page.evaluate(()=>HallManual.close());await page.waitForFunction(()=>!HallManual.active);
 const result={perfWithout,perfInstalled,perfOperating,offset,pitPose,errors};fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));console.log(result);assert.deepEqual(errors,[]);
}finally{await browser.close();}
