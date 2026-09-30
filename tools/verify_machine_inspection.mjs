import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-machine-inspection';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850},hasTouch:true});page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',ws=>ws.close());
 await page.goto('http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene.getObjectByName('machineInspectionStation')&&CarDoor.state?.ready&&document.querySelector('#loading.hide'));
 const look=()=>page.evaluate(()=>{leaveCabinView();controls.enableDamping=false;gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);const r=ControlPanel.root;controls.target.copy(r.localToWorld(new THREE.Vector3(0,.68,0)));camera.position.copy(r.localToWorld(new THREE.Vector3(.12,.85,2.2)));camera.fov=38;camera.updateProjectionMatrix();controls.update();});
 const perf=()=>page.evaluate(async()=>{const a=[];let p=await new Promise(requestAnimationFrame);for(let i=0;i<120;i++){const n=await new Promise(requestAnimationFrame);a.push(n-p);p=n;}a.sort((a,b)=>a-b);return {median:a[60],p95:a[114],calls:renderer.info.render.calls};});
 await look();await page.waitForTimeout(300);
 assert.equal(await page.locator('#inspection-action-machine').isVisible(),false);
 assert.equal(await page.evaluate(()=>InspectionStations.toggle('machine')),false);
 await page.screenshot({path:`${out}/closed.png`});
 await page.click('#control-panel-action');await page.waitForFunction(()=>!ControlPanel.busy);
 await page.waitForTimeout(200);assert.equal(await page.locator('#inspection-action-machine').isVisible(),true);
 const door=await page.locator('#control-panel-action').boundingBox(),ins=await page.locator('#inspection-action-machine').boundingBox();assert.ok(door.y+door.height<ins.y);
 await page.screenshot({path:`${out}/open.png`});
 const idle=await perf();
 for(const mobile of [false,true]){
  if(mobile){await page.setViewportSize({width:390,height:844});await look();}
  await page.locator('#inspection-action-machine')[mobile?'tap':'click']();await page.waitForFunction(()=>InspectionStations.ready);
  const before=await page.evaluate(()=>({y:carGrp.position.y,bear:Mascot.root.position.toArray(),camera:camera.position.toArray()}));
  const b=await page.locator('#btn-ins-up').boundingBox();
  if(mobile){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await page.waitForTimeout(800);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
  else{await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(800);await page.mouse.up();}
  const after=await page.evaluate(()=>({y:carGrp.position.y,bear:Mascot.root.position.toArray(),camera:camera.position.toArray(),dir:insDir}));
  assert.ok(after.y>before.y+.1);assert.equal(after.dir,0);assert.deepEqual(after.bear,before.bear);assert.deepEqual(after.camera,before.camera);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>carGrp.position.y),after.y);
  await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-drive.png`});
  if(!mobile){
   await page.evaluate(()=>{insHold=1;insStart(1);ControlPanel.toggle();});
   assert.equal(await page.evaluate(()=>insDir),0);assert.equal(await page.locator('#inspection-drive').isVisible(),false);
   await page.waitForFunction(()=>!ControlPanel.busy);assert.equal(await page.locator('#inspection-action-machine').isVisible(),false);
   await page.click('#control-panel-action');await page.waitForFunction(()=>!ControlPanel.busy);await page.click('#inspection-action-machine');
  }
  const target=await page.evaluate(()=>insNearestFloor());await page.locator('#inspection-return')[mobile?'tap':'click']();
  await page.waitForFunction(()=>InspectionReturn.state.stage==='complete');
  assert.deepEqual(await page.evaluate(()=>({floor:curFloor,source:InspectionReturn.state.source,clicks:InspectionReturn.state.clicks,insMode,moving,doorOpen,mascot:Mascot.inspecting})),{floor:target,source:'machine',clicks:0,insMode:false,moving:false,doorOpen:false,mascot:false});
  await look();
 }
 await page.setViewportSize({width:1200,height:850});await look();
 await page.click('#inspection-action-machine');await page.waitForFunction(()=>InspectionStations.ready);const operating=await perf();
 await page.click('#inspection-return');await page.waitForFunction(()=>moving);await page.click('#btn-estop');
 assert.equal(await page.evaluate(()=>InspectionReturn.busy),false);
 const y=await page.evaluate(()=>carGrp.position.y);await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>carGrp.position.y),y);
 assert.deepEqual(errors,[]);const result={idle,operating,errors};fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
