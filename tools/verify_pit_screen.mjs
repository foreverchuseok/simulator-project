import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-pit-screen';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene?.getObjectByName('pitScreenAssembly')?.userData.ready&&govHandles()?.ready&&CarDoor.state?.ready,{},{timeout:90000});
 const report=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const guard=scene.getObjectByName('pitScreenAssembly'),spec=guard.userData.spec;
  const bounds=o=>new THREE.Box3().setFromObject(o);
  const b=bounds(guard),panel=bounds(guard.getObjectByName('PitScreenPanelLeft'));
  const nearCar=[];let carGap=Infinity,cwtGap=Infinity,triangles=0,meshes=0;
  const world=new THREE.Vector3();
  // Lowest car position: check actual vertices within the guard's X/Y extent,
  // including the platform, rear wiring and fittings, not just nominal S.CAR_D.
  carGrp.traverse(o=>{
   if(!o.isMesh||!o.geometry.attributes.position||o.isInstancedMesh)return;
   const a=o.geometry.attributes.position;let min=Infinity;
   for(let i=0;i<a.count;i++){
    world.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
    if(world.x>=b.min.x&&world.x<=b.max.x&&world.y<=b.max.y&&world.y>=b.min.y) min=Math.min(min,world.z);
   }
   if(Number.isFinite(min)){carGap=Math.min(carGap,min-b.max.z);if(min-b.max.z<.03)nearCar.push({name:o.name,gap:min-b.max.z});}
  });
  // Sweep each fixed guard triangle against each moving counterweight mesh's
  // full-travel bounding box. This also catches side arms contacting shoes.
  const travel=FLOOR_Y.at(-1)-FLOOR_Y[0],movingBoxes=[];
  cwtGrp.traverse(o=>{if(o.isMesh){const box=bounds(o);box.min.y-=travel;movingBoxes.push(box);}});
  const intersections=[];
  guard.traverse(o=>{
   if(!o.isMesh)return;meshes++;const a=o.geometry.attributes.position,idx=o.geometry.index;
   const n=idx?idx.count:a.count;triangles+=n/3;
   for(let i=0;i<n;i+=3){
    const t=new THREE.Box3();
    for(let j=0;j<3;j++)t.expandByPoint(new THREE.Vector3().fromBufferAttribute(a,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));
    for(const box of movingBoxes){
     if(t.intersectsBox(box)){intersections.push(o.name);break;}
     if(t.max.x>=box.min.x&&t.min.x<=box.max.x&&t.max.y>=box.min.y&&t.min.y<=box.max.y)cwtGap=Math.min(cwtGap,t.min.z-box.max.z);
    }
   }
  });
  return {spec,meshes,triangles,floorClearance:panel.min.y-Y0,finishedFloorClearance:panel.min.y-(Y0+.02),carGap,cwtGap,nearCar,intersections:[...new Set(intersections)],bounds:{min:b.min.toArray(),max:b.max.toArray()}};
 });
 fs.writeFileSync(`${out}/geometry.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await page.evaluate(()=>{
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
  scene.background=new THREE.Color('#96a5b3');scene.fog=null;
  camera.position.set(3.6,2.8,2.8);controls.target.set(0,1.05,CWT_CENTER_Z+.15);controls.update();
  carGrp.visible=false;wallGrp.visible=false;
 });
 await page.screenshot({path:`${out}/installed-front.png`});
 await page.evaluate(()=>{
  camera.position.set(-2.5,1.9,CWT_CENTER_Z-2.6);controls.target.set(0,1.15,CWT_CENTER_Z);controls.update();
 });
 await page.screenshot({path:`${out}/installed-rear.png`});
 await page.evaluate(()=>{
  const g=scene.getObjectByName('pitScreenAssembly');
  scene.children.forEach(o=>{if(!o.isLight&&o!==pitGrp)o.visible=false;});
  pitGrp.children.forEach(o=>o.visible=o===g);
  camera.position.set(2.2,1.8,CWT_CENTER_Z+2.8);controls.target.set(0,1.2,CWT_CENTER_Z+.15);controls.update();
 });
 await page.screenshot({path:`${out}/sheet-detail.png`});
 assert.ok(report.floorClearance>=.1&&report.floorClearance<=.3);
 assert.ok(report.carGap>.005,`Car gap ${report.carGap}`);
 assert.deepEqual(report.intersections,[]);
 assert.equal(report.meshes,4);assert.equal(report.spec.sheetThickness,.0015);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene.getObjectByName('pitScreenAssembly')?.userData.ready&&CarDoor.state?.ready);
 const start=await page.evaluate(()=>scene.getObjectByName('pitScreenAssembly').matrixWorld.elements.slice());
 await page.evaluate(()=>moveElevator(3));
 await page.waitForFunction(()=>curFloor===3&&!moving,{},{timeout:90000});
 assert.deepEqual(await page.evaluate(()=>scene.getObjectByName('pitScreenAssembly').matrixWorld.elements.slice()),start);
 await page.evaluate(()=>{
  wallGrp.visible=false;
  camera.position.set(-2.5,1.9,CWT_CENTER_Z-2.6);controls.target.set(0,1.15,CWT_CENTER_Z);controls.update();
 });
 await page.screenshot({path:`${out}/counterweight-lowest.png`});
 assert.deepEqual(errors,[]);
 console.log('PASS pit screen geometry, full counterweight sweep, Live Server reload; no browser errors.');
} finally {await browser.close();}
