import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-cwt-buffer';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&CarDoor.state?.ready&&scene.getObjectByName('pitScreenAssembly')?.userData.ready);
 const upper=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(cwtGrp);
  return {ceilingGap:SHAFT_CEIL_Y-b.max.y,initialY:cwtGrp.position.y};
 });
 assert.ok(upper.ceilingGap>.15);
 await page.evaluate(()=>moveElevator(3));await page.waitForFunction(()=>curFloor===3&&!moving);
 const results=[];
 for(const speed of [60,90]) {
  const result=await page.evaluate(speed=>{
   targetSpeed=speed;updateBuffers();scene.updateMatrixWorld(true);
   let top=-Infinity;
   bufferGrp.children.forEach(o=>{const b=new THREE.Box3().setFromObject(o);if(Math.abs((b.min.z+b.max.z)/2-CWT_CENTER_Z)<.001)top=Math.max(top,b.max.y);});
   const bottom=cwtGrp.position.y-S.CWT_H/2;
   const d=ropeObjs[2].cwtDrop;d.updateMatrixWorld(true);const endpoint=d.localToWorld(new THREE.Vector3(0,-.5,0)); // 중앙 로프 = 중앙 홀
   const ropeError=Math.abs(endpoint.y-(cwtGrp.position.y+S.CWT_H/2+.31));
   wallGrp.visible=false;controls.enableDamping=false;
   camera.position.set(2.3,1.3,CWT_CENTER_Z-3.6);controls.target.set(0,.95,CWT_CENTER_Z);controls.update();
   return {speed,top,bottom,gap:bottom-top,ropeError,cwtY:cwtGrp.position.y};
  },speed);
  assert.ok(result.gap>=.15,JSON.stringify(result));assert.ok(result.ropeError<1e-6);
  results.push(result);
  await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);renderer.render(scene,camera);});
  await page.screenshot({path:`${out}/speed-${speed}.png`});
 }
 assert.equal(results[0].cwtY,results[1].cwtY);
 await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE);
 await page.evaluate(()=>moveElevator(0));await page.waitForFunction(()=>curFloor===0&&!moving);
 assert.ok(Math.abs(await page.evaluate(()=>cwtGrp.position.y)-upper.initialY)<1e-6);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/result.json`,JSON.stringify({upper,results,errors},null,2));
 console.log(JSON.stringify({upper,results,errors}));
}finally{await browser.close();}
