import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-car-door');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try {
 browser=await chromium.launch({args:['--enable-gpu']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()?.errorText));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&govHandles()?.ready&&document.getElementById('loading').classList.contains('hide'));
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.screenshot({path:path.join(out,'live-overview.png')});
 const layout=await page.evaluate(()=>{
  const q=CarDoor.state,d=q.d;
  scene.updateMatrixWorld(true);const sill=new THREE.Box3().setFromObject(carGrp.getObjectByName('carSill'));
  return {d,contact:q.contact,sill:carGrp.getObjectByName('carSill').userData,transmission:q.transmission.spec,
   sillHallGap:HALL_SILL_SHAFT_Z-sill.max.z,sillFloorGap:sill.max.y-(carGrp.position.y+d.floor),
   calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 });console.log('LAYOUT',JSON.stringify(layout));
 assert.ok(Math.abs(layout.d.bottom-layout.sill.topY-.005)<1e-9);
 assert.equal(layout.sill.grooveZ,layout.d.doorZ);
 assert.ok(Math.abs(layout.sillHallGap-.03)<1e-6);assert.ok(Math.abs(layout.sillFloorGap)<1e-6);
 const releaseSweep=await page.evaluate(()=>{
  const q=CarDoor.state,rows=[];q.coupledFloor=curFloor;
  for(let i=0;i<=100;i++){
   q.release=i/100;CarDoor.pose();carGrp.updateWorldMatrix(true,true);
   const nose=q.lockTooth.getWorldPosition(new THREE.Vector3());
   const rim=q.keeper.localToWorld(new THREE.Vector3(0,q.lockSpec.strikeY,0));
   rows.push({i,panelX:carDoorR.position.x,hook:hatchDoors[curFloor].hook.rotation.z,noseClearance:nose.y-rim.y});
  }
  q.release=0;CarDoor.pose();q.coupledFloor=-1;return rows;
 });
 assert.ok(releaseSweep.every(v=>v.panelX===layout.d.cx));assert.ok(releaseSweep.slice(0,46).every(v=>v.hook===0));
 assert.ok(releaseSweep[0].noseClearance<0);assert.ok(releaseSweep[100].noseClearance>.004);
 // 101 poses: hall displacement, non-driven floors, transmission ratios, shoe support.
 const sweep=await page.evaluate(()=>{
  const q=CarDoor.state,d=q.d,results=[];q.coupledFloor=curFloor;q.release=1;
  for(let i=0;i<=100;i++){
   carDoorR.position.x=d.cx+d.stroke*i/100;CarDoor.pose();
   const h=hatchDoors[curFloor],t=q.transmission;
   carGrp.updateWorldMatrix(true,true);
   const pads=q.shoes.map(o=>new THREE.Box3().setFromObject(o));
   const roller=q.hallTreads[curFloor];const centre=roller.geometry.boundingBox.getCenter(new THREE.Vector3());roller.localToWorld(centre);
   const upperX=q.contact.upper.p.x+carGrp.position.x+d.stroke*i/100;
   results.push({i,car:carDoorR.position.x-d.cx,hall:h.right.position.x-h.right.userData.cx,
    left:carDoorL.position.x+carDoorR.position.x,drive:[t.reduction.rotation.z,t.motorPulley.rotation.z,t.guide.rotation.z],ropeTravel:t.travel,
    pickupGap:centre.x-q.contact.lower.r-pads[0].max.x,reactionGap:pads[1].min.x-upperX-q.contact.upper.r,
    rollerWithinPad:centre.y>=pads[0].min.y&&centre.y<=pads[0].max.y,
    shaftClearance:S.SHAFT_W/2-(t.endX+t.spec.endR+.003),
    shoeSupport:d.sillW/2-(carDoorR.position.x+d.width*.28+.025),
    otherFloors:hatchDoors.every((h,f)=>f===curFloor||h.right.position.x===h.right.userData.cx),
    gate:q.gateClosed,locked:q.locked});
  }
  carDoorR.position.x=d.cx;q.release=0;CarDoor.pose();q.coupledFloor=-1;
  return results;
 });
 for(const v of sweep){assert.ok(Math.abs(v.car-v.hall)<1e-9);assert.equal(v.left,0);assert.equal(v.otherFloors,true);assert.equal(v.locked,false);assert.ok(Math.abs(v.drive[0]*layout.transmission.drumR+v.ropeTravel)<1e-8);assert.ok(Math.abs(v.drive[1]*layout.transmission.motorR-v.drive[0]*layout.transmission.wheelR)<1e-8);assert.ok(Math.abs(v.drive[2]*layout.transmission.guideR+v.ropeTravel)<1e-8);
  assert.ok(Math.abs(v.pickupGap)<1e-7);assert.ok(Math.abs(v.reactionGap)<1e-7);assert.equal(v.rollerWithinPad,true);assert.ok(v.shaftClearance>.025);assert.ok(v.shoeSupport>0);
 }
 const transport=await page.evaluate(()=>{
  const q=CarDoor.state;carGrp.updateWorldMatrix(true,true);const p=q.shoes.map(o=>new THREE.Box3().setFromObject(o));
  return {left:Math.min(q.contact.upper.p.x-q.contact.upper.r,q.contact.lower.p.x-q.contact.lower.r)-p[0].max.x,
   right:p[1].min.x-Math.max(q.contact.upper.p.x+q.contact.upper.r,q.contact.lower.p.x+q.contact.lower.r)};
 });assert.ok(transport.left>=.006-1e-7);assert.ok(transport.right>=.006-1e-7);
 const blocked=await page.evaluate(()=>{carGrp.position.y+=.30;const can=CarDoor.canOpen();openDoors();const opened=doorOpen;carGrp.position.y-=.30;return {can,opened};});
 assert.deepEqual(blocked,{can:false,opened:false});
 await page.evaluate(()=>openDoors());
 await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN&&!CarDoor.state.busy);
 await page.evaluate(()=>{clearTimeout(autoTimer);closeDoors();});
 await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE&&!doorOpen&&CarDoor.state.locked);
 const closed=await page.evaluate(()=>({locked:CarDoor.state.locked,gate:CarDoor.state.gateClosed,cls:CarDoor.state.sensors[0].userData.active,hook:hatchDoors[curFloor].hook.rotation.z}));
 assert.equal(closed.locked,true);assert.equal(closed.gate,true);assert.equal(closed.cls,true);assert.ok(Math.abs(closed.hook)<1e-10);
 // A stop during release must not let a completion callback replace ESTOP.
 await page.evaluate(()=>{openDoors();document.getElementById('btn-estop').click();});
 const stopped=await page.evaluate(async()=>{const q=CarDoor.state,release=q.release,x=carDoorR.position.x;await new Promise(r=>setTimeout(r,450));return {stable:q.release===release&&carDoorR.position.x===x,state:currentState};});
 assert.deepEqual(stopped,{stable:true,state:'ESTOP'});
 await page.evaluate(()=>document.getElementById('btn-estop').click());
 await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
 await page.evaluate(()=>{clearTimeout(autoTimer);closeDoors();});await page.waitForFunction(()=>!doorOpen);
 // Actual normal travel followed by landing-specific coupling.
 await page.evaluate(()=>moveElevator(1));await page.waitForFunction(()=>curFloor===1&&currentState===ELEVATOR_STATE.DOOR_OPEN);
 const arrived=await page.evaluate(()=>{clearTimeout(autoTimer);return {floor:CarDoor.state.coupledFloor,otherClosed:hatchDoors[0].right.position.x===hatchDoors[0].right.userData.cx};});
 assert.deepEqual(arrived,{floor:1,otherClosed:true});
 // Closing must pause too, and a queued trip must wait for re-locking.
 await page.evaluate(()=>{closeDoors();document.getElementById('btn-estop').click();});
 const closingStopped=await page.evaluate(async()=>{const q=CarDoor.state,release=q.release,x=carDoorR.position.x;await new Promise(r=>setTimeout(r,450));return {stable:q.release===release&&carDoorR.position.x===x,state:currentState};});
 assert.deepEqual(closingStopped,{stable:true,state:'ESTOP'});
 await page.evaluate(()=>{document.getElementById('btn-estop').click();moveElevator(2);});
 await page.waitForFunction(()=>moving);
 const departure=await page.evaluate(()=>({secured:CarDoor.secured(),doorOpen,release:CarDoor.state.release}));
 assert.deepEqual(departure,{secured:true,doorOpen:false,release:0});
 await page.waitForFunction(()=>curFloor===2&&currentState===ELEVATOR_STATE.DOOR_OPEN);
 await page.evaluate(()=>{clearTimeout(autoTimer);closeDoors();});await page.waitForFunction(()=>!doorOpen);
 // Presentation for front/oblique detail QA. Inspection-only scene isolation.
 await page.evaluate(()=>{
  window.doorQAVisibility=scene.children.map(o=>[o,o.visible]);scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
  window.carQAVisibility=carGrp.children.map(o=>[o,o.visible]);
  carGrp.children.forEach(o=>o.visible=['carDoorOperator','carDoorL','carDoorR','carPanelAssembly'].includes(o.name));
  carGrp.getObjectByName('carPanelAssembly').visible=false;
  scene.background=new THREE.Color('#b4bdc3');scene.fog=null;
  document.querySelectorAll('#ui,#hud,.panel,#hint,#loading').forEach(e=>e.style.display='none');
  const p=carGrp.position,d=CarDoor.state.d;
  camera.position.set(0,p.y+d.trackY-.65,p.z+d.doorZ+4.2);controls.target.set(0,p.y-.1,p.z+d.doorZ);controls.update();
 });
 await page.screenshot({path:path.join(out,'front-closed.png')});
 await page.evaluate(()=>{const p=carGrp.position,d=CarDoor.state.d;camera.position.set(1.9,p.y+d.trackY+.7,p.z+d.doorZ+2.5);controls.target.set(0,p.y+d.trackY,p.z+d.doorZ);controls.update();});
 await page.screenshot({path:path.join(out,'operator-oblique.png')});
 await page.evaluate(()=>{const p=carGrp.position,c=CarDoor.state.contact;camera.position.set(c.lower.p.x+.20,p.y+c.cy+.12,p.z+c.z+.85);controls.target.set(c.lower.p.x,p.y+c.cy,p.z+c.z);controls.update();});
 await page.screenshot({path:path.join(out,'clutch-closed.png')});
 await page.evaluate(()=>{
  const q=CarDoor.state,h=hatchDoors[curFloor];q.coupledFloor=curFloor;q.release=1;CarDoor.pose();
  for(const g of [h.left,h.right]){g.visible=true;g.children.forEach(o=>o.visible=o.name.startsWith('FieldInterlock'));}
  const p=carGrp.position,c=q.contact;
  camera.position.set(c.lower.p.x+.48,p.y+c.cy+.14,p.z+c.z-.14);controls.target.set(c.lower.p.x,p.y+c.cy,p.z+c.z);controls.update();
 });
 await page.screenshot({path:path.join(out,'coupled-rollers.png')});
 await page.evaluate(()=>{const q=CarDoor.state,h=hatchDoors[curFloor];h.left.visible=h.right.visible=false;q.release=0;CarDoor.pose();q.coupledFloor=-1;});
 await page.evaluate(()=>openDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
 await page.evaluate(()=>{clearTimeout(autoTimer);const p=carGrp.position,d=CarDoor.state.d;camera.position.set(0,p.y+d.trackY-.4,p.z+d.doorZ+4.2);controls.target.set(0,p.y,p.z+d.doorZ);controls.update();});
 await page.screenshot({path:path.join(out,'front-open.png')});
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>!doorOpen);
 const touchContext=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const touch=await touchContext.newPage();touch.on('pageerror',e=>errors.push(e.message));
 await touch.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await touch.waitForFunction(()=>CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await touch.tap('#btn-open'); // 운행바는 항상 보인다
 await touch.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);await touch.evaluate(()=>clearTimeout(autoTimer));
 await touch.screenshot({path:path.join(out,'touch-open.png')});await touch.tap('#btn-close');
 await touch.waitForFunction(()=>!doorOpen&&CarDoor.secured());await touchContext.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({layout,blocked,closed,transport,stopped,closingStopped,departure,arrived,releaseSweep,sweep,errors},null,2));console.log('PASS: car door linkage, locking, coupling, sill and screenshots.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
