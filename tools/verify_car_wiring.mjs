import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const out=path.resolve('.shot-car-wiring');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>console.error(r.url(),r.failure()));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof CarWiring!=='undefined'&&CarDoor.state?.ready&&govHandles()?.ready);
 const report=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const wires=[],roof=[],barriers=[];carGrp.traverse(o=>{
   if(o.userData.type==='car-fixed-wire')wires.push(o);
   if(['roofDeck','roofEdge','roofStiffener','roofStileBracket','roofStileBracketUpright'].includes(o.name))roof.push(o);
   if(o.isMesh&&['opaqueSkin','visionGlass','windowBorder','carPanel_1','carPanel_11','loadSwitchMountShelf'].includes(o.name))barriers.push(o);
  });
  carGrp.getObjectByName('carPlatform').traverse(o=>{if(o.isMesh)barriers.push(o);});
  const intrusions=[],collisions=[],penetrations=[];
  const routes=wires.map(w=>{
   const pts=w.userData.route;
   const orthogonal=pts.slice(1).every((p,i)=>p.filter((v,a)=>Math.abs(v-pts[i][a])>1e-6).length<=1);
   for(let i=1;i<pts.length;i++){
    const a=w.localToWorld(new THREE.Vector3(...pts[i-1])),b=w.localToWorld(new THREE.Vector3(...pts[i]));
    const distance=a.distanceTo(b);if(distance<1e-7)continue;
    for(const [from,to] of [[a,b],[b,a]]){
     const ray=new THREE.Raycaster(from,to.clone().sub(from).normalize(),.00001,distance-.00001);
     for(const hit of ray.intersectObjects(barriers))if(!penetrations.some(p=>p.wire===w.name&&p.mesh===hit.object.name))penetrations.push({wire:w.name,mesh:hit.object.name,p:carGrp.worldToLocal(hit.point).toArray()});
    }
   }
   const curve=w.geometry.parameters.path,n=Math.ceil(curve.getLength()/.008);
   for(let i=0;i<=n;i++){
    const p=curve.getPoint(i/n),world=w.localToWorld(p.clone()),local=carGrp.worldToLocal(world.clone());
    if(local.y>S.CAR_H/2&&local.y<S.CAR_H/2+.2&&Math.abs(local.x)<S.CAR_W/2-.28&&Math.abs(local.z)<S.CAR_D/2-.3)intrusions.push({wire:w.name,p:local.toArray()});
    for(const mesh of roof){
     const v=mesh.worldToLocal(world.clone());mesh.geometry.computeBoundingBox();
     if(mesh.geometry.boundingBox.clone().expandByScalar(w.userData.radius).containsPoint(v)){
      if(!collisions.some(c=>c.wire===w.name&&c.mesh===mesh.name))collisions.push({wire:w.name,mesh:mesh.name,p:local.toArray()});
     }
    }
   }
   return {name:w.name,orthogonal,points:pts.length,length:curve.getLength(),black:w.material.color.getHex()===0x030405};
  });
  const top=carGrp.getObjectByName('carTopBox'),plate=top.getObjectByName('topBoxEntryPlate');
  const entries=Object.entries(top.userData.entries).map(([id,p])=>{
   const matches=wires.filter(w=>new THREE.Vector3(...w.userData.endpoint).distanceTo(new THREE.Vector3(...p))<1e-7);
   const ray=new THREE.Raycaster(carGrp.localToWorld(new THREE.Vector3(p[0],p[1]-.04,p[2])),new THREE.Vector3(0,1,0),0,.08);
   return {id,connections:matches.length,holeClear:ray.intersectObject(plate).length===0};
  });
  const hole=top.userData.entryHole;
  const singleEntry={holes:plate.geometry.parameters.shapes.holes.length,
    guards:top.children.filter(o=>o.userData.type==='car-bundle-entry').length,
    allInside:entries.every(({id})=>{const p=top.userData.entries[id];return Math.hypot(p[0]-hole.center[0],p[2]-hole.center[2])+.004<hole.radius;})};
  // 도어 부품 병합 시 인스턴스의 단위 원본을 합치면 실내에 1m 상자가 생긴다.
  const mounts=['doorMotorCableClips','doorControllerSupplyClips','doorControllerSupplyMounts'].map(name=>{
    const mesh=carGrp.getObjectByName(name);return {name,instanced:!!mesh?.isInstancedMesh,count:mesh?.count||0};
  });
  const cabinBox=new THREE.Box3(new THREE.Vector3(-.65,-.65,-.65),new THREE.Vector3(.65,.65,.65));
  const unexpectedHardware=[];
  carGrp.traverse(o=>{if(!o.isMesh||!o.name.startsWith('carDoorHardware_'))return;
    o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(carGrp.matrixWorld.clone().invert().multiply(o.matrixWorld));
    if(b.intersectsBox(cabinBox))unexpectedHardware.push(o.name);
  });
  return {routes,intrusions:intrusions.slice(0,10),collisions,penetrations,entries,singleEntry,mounts,unexpectedHardware,errors:[]};
 });
 // Capture installed views with the entire car retained; only the shaft is hidden.
 await page.evaluate(()=>{
  scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
  scene.background=new THREE.Color('#81909d');scene.fog=null;
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
 });
 for(const [name,pos,target] of [
  ['roof', [3.1,4.6,3.6],[0,1.35,0]],
  ['roof-rear',[-3.4,4,-3.5],[0,1.3,0]],
  ['top-box',[-.12,1.35,1.55],[-1,1.5,.72]],
  ['underbody', [2.8,-3.6,3.4],[0,-1.35,.15]],
  ['underbody-close',[-1.8,-3.1,-2.5],[0,-1.3,.2]],
  ['side',[-3.7,.3,3.6],[-.7,.1,.55]],
  ['cabin-interior',[.78,.45,-1.05],[-.1,-.05,.6]],
 ]){
  await page.evaluate(({pos,target})=>{camera.position.copy(carGrp.localToWorld(new THREE.Vector3(...pos)));controls.target.copy(carGrp.localToWorld(new THREE.Vector3(...target)));controls.update();},{pos,target});
  await page.screenshot({path:path.join(out,name+'.png')});
 }
 report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 assert.deepEqual(errors,[]);assert.ok(report.routes.every(r=>r.orthogonal&&r.black));
 assert.deepEqual(report.intrusions,[]);assert.deepEqual(report.collisions,[]);assert.deepEqual(report.penetrations,[]);
 assert.equal(report.entries.length,7);assert.ok(report.entries.every(e=>e.connections===1&&e.holeClear));
 assert.deepEqual(report.singleEntry,{holes:1,guards:1,allInside:true});
 assert.ok(report.mounts.every(m=>m.instanced&&m.count>0));assert.deepEqual(report.unexpectedHardware,[]);
 console.log('PASS car wiring');
}finally{await browser.close();}
