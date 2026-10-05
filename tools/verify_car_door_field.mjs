import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-car-door-field',before=process.argv.includes('--before'),tag=before?'before':'after';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(before)await page.route('**/*',r=>{const path=new URL(r.request().url()).pathname;
  const file=path==='/index.html'?'index.html':path==='/js/car-door.js'?'car-door.js':path==='/js/car-terrace.js'?'car-terrace.js':null;
  return file?r.fulfill({body:fs.readFileSync(`${out}/before/${file}`),contentType:file.endsWith('.html')?'text/html':'text/javascript'}):r.continue();});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 if(!before)await page.waitForFunction(()=>['multiBeamTx','multiBeamRx'].every(n=>scene.getObjectByName(n)?.userData.ready));
 const checks=before?{}:await page.evaluate(()=>{
  const q=CarDoor.state,d=q.d,tx=scene.getObjectByName('multiBeamTx'),rx=scene.getObjectByName('multiBeamRx');
  const skin=carDoorL.getObjectByName('carDoorSkin');
  const original=carDoorR.position.x,release=q.release;let minGap=Infinity,maxDrift=0,maxZ=-Infinity,minZ=Infinity;
  for(let i=0;i<=100;i++){
   carDoorR.position.x=d.cx+d.stroke*i/100;q.release=i?1:0;CarDoor.pose();scene.updateMatrixWorld(true);
   const a=new THREE.Box3().setFromObject(tx),b=new THREE.Box3().setFromObject(rx);
   minGap=Math.min(minGap,b.min.x-a.max.x);
   for(const [o,sign]of [[tx,-1],[rx,1]]){
    const p=carGrp.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    maxDrift=Math.max(maxDrift,Math.abs(p.x-sign*(CAR_DOOR_PHOTO.gap/2+CAR_DOOR_PHOTO.width/2+d.stroke*i/100)));
    const bounds=new THREE.Box3().setFromObject(o);maxZ=Math.max(maxZ,bounds.max.z-CAR_CTR_Z);minZ=Math.min(minZ,bounds.min.z-CAR_CTR_Z);
   }
  }
  carDoorR.position.x=original;q.release=release;CarDoor.pose();
  return {minGap,maxDrift,maxZ,minZ,doorZ:d.doorZ,roles:[tx.userData.role,rx.userData.role],
   scale:[tx.scale.toArray(),rx.scale.toArray()],materials:skin.material.length,
   interiorPreserved:skin.material[1]===CarTerrace.getMaterials().door,exteriorDifferent:skin.material[0]!==skin.material[1],groups:skin.geometry.groups,
   txMeshes:tx.children[0].children.length,rxMeshes:rx.children[0].children.length};
 });
 if(!before){assert.ok(checks.minGap>=.007999);assert.ok(checks.maxDrift<1e-6);assert.equal(checks.interiorPreserved,true);assert.equal(checks.exteriorDifferent,true);assert.deepEqual(checks.roles,['Tx','Rx']);assert.equal(checks.txMeshes,7);assert.equal(checks.rxMeshes,7);}
 await page.evaluate(()=>{controls.enableDamping=false;controls.minDistance=.02;HallManual.select(0);HallManual.request(1);});
 await page.waitForFunction(()=>HallManual.phase==='holding');
 async function view(name){
  await page.evaluate(name=>{
   leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
   const d=CarDoor.dimensions(),cy=carGrp.position.y,z=CAR_CTR_Z+d.doorZ,fy=FLOOR_Y[curFloor];
   camera.near=.002;camera.fov=50;camera.updateProjectionMatrix();
   camera.position.set(0,fy+1.25,z+2.85);controls.target.set(0,fy+1.12,z);
   if(name==='sensor'){camera.position.set(.14,cy+d.top-.11,z+.34);controls.target.set(0,cy+d.top-.25,z+.026);}
   if(name==='oblique'){camera.position.set(.30,cy+d.top-.28,z+.42);controls.target.set(0,cy+d.top-.44,z+.02);}
   if(name==='interior'){camera.fov=80;camera.updateProjectionMatrix();camera.position.set(.05,fy+1.38,CAR_CTR_Z-S.CAR_D/2+.17);controls.target.set(-.08,fy+1.12,CAR_CTR_Z+S.CAR_D/2);}
   controls.update();
  },name);
  await page.waitForTimeout(600);await page.screenshot({path:`${out}/${tag}-${name}-${page.viewportSize().width}.png`});
 }
 const sample=()=>page.evaluate(async()=>{const a=[];let prev=await new Promise(requestAnimationFrame),start=prev;while(prev-start<3000){const t=await new Promise(requestAnimationFrame);a.push(t-prev);prev=t;}a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await view('front');const front=await sample();await view('sensor');const sensor=await sample();await view('oblique');
 await page.evaluate(()=>{HallManual.resetAll();setInspectionMode(false);});await view('interior');const interior=await sample();
 if(!before){
  await page.setViewportSize({width:390,height:844});await view('interior');
  await page.tap('#m-run');await page.tap('[data-f="1"]');await page.waitForFunction(()=>curFloor===1&&currentState===ELEVATOR_STATE.DOOR_OPEN);
  await page.tap('#btn-close');await page.waitForFunction(()=>CarDoor.secured()&&!doorOpen);
  await page.evaluate(()=>{HallManual.select(1);HallManual.request(1);});await page.waitForFunction(()=>HallManual.phase==='holding');
  await view('front');await view('sensor');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${tag}.json`,JSON.stringify({checks,front,sensor,interior,errors},null,2));console.log(JSON.stringify({checks,front,sensor,interior,errors}));
}finally{await browser.close();}
