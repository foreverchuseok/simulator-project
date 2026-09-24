import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-machine-room-safety';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>scene.getObjectByName('MachineRoomSafetyWiring')?.userData.governorReady&&govHandles()?.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready,{},{timeout:90000});
 const report=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const r=scene.getObjectByName('RopeBrakeInstallation'),w=scene.getObjectByName('MachineRoomSafetyWiring');
  const brake=r.getObjectByName('RopeBrake'),d=mrGrp.userData;
  const angle=Math.atan2(d.defY-d.mainY,d.defCenterZ-d.mainZ)-Math.acos((d.mainR-d.defRadius)/Math.hypot(d.defY-d.mainY,d.defCenterZ-d.mainZ));
  const p1=new THREE.Vector3(0,d.mainY+d.mainR*Math.sin(angle),d.mainZ+d.mainR*Math.cos(angle));
  const p2=new THREE.Vector3(0,d.defY+d.defRadius*Math.sin(angle),d.defCenterZ+d.defRadius*Math.cos(angle));
  const localEnds=[p1,p2].map(p=>brake.worldToLocal(p.clone()));
  const cheeks=[],bearing=[],bridges=[];
  r.traverse(o=>{if(o.name==='BrakeSupportCheek')cheeks.push(new THREE.Box3().setFromObject(o));
   if(o.name==='BrakeBearingShoe')bearing.push(new THREE.Box3().setFromObject(o));
   if(o.name==='BrakeBridge')bridges.push(new THREE.Box3().setFromObject(o));});
  const wireEnds=['GovernorSwitchSupply','RopeBrakeSupply'].map(n=>w.getObjectByName(n).userData.endpoints);
  const wire=w.getObjectByName('RopeBrakeSupply'),wireBridgeHits=[];
  wire.geometry.parameters.path.getPoints(250).forEach((p,i)=>{
   bridges.forEach((b,j)=>{if(b.clone().expandByScalar(.0055).containsPoint(p))wireBridgeHits.push({sample:i,bridge:j});});
  });
  const model=brake.getObjectByName('RopeBrakeModel'),grooves=[];
  const ray=new THREE.Raycaster();
  for(const x of r.userData.model.ropeX)for(const z of [-.10,0,.10]){
   const sample=(xx,sign)=>{
    ray.set(brake.localToWorld(new THREE.Vector3(xx,0,z)),new THREE.Vector3(0,sign,0).transformDirection(brake.matrixWorld));
    return ray.intersectObject(model,true)[0]?.distance;
   };
   grooves.push({x,z,upper:sample(x,1),land:sample(x+.012,1),lower:sample(x,-1)});
  }
  return {brakePosition:brake.position.toArray(),pitch:brake.rotation.x,spec:r.userData.spec,
   tangentError:Math.max(...localEnds.map(p=>Math.abs(p.y))),gap:r.userData.gap,
   cheeks:cheeks.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),
   bearingGaps:bearing.map(b=>b.min.y-r.userData.spec.bedTop),
   bridgeGaps:bridges.map(b=>b.min.y-r.userData.spec.plateTop),
   duct:w.userData,wireEnds,wireBridgeHits,model:r.userData.model,grooves};
 });
 fs.writeFileSync(`${out}/geometry.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await page.evaluate(()=>{
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
  scene.fog=null;wallGrp.visible=false;
  const y=Y0+TOTAL_H;camera.position.set(4,y+3,4);controls.target.set(0,y+.4,-.1);controls.update();
 });
 await page.screenshot({path:`${out}/overview.png`});
 await page.evaluate(()=>{const r=scene.getObjectByName('RopeBrake');const p=r.getWorldPosition(new THREE.Vector3());camera.position.copy(p).add(new THREE.Vector3(1.25,.55,.70));controls.target.copy(p).add(new THREE.Vector3(0,-.2,0));controls.update();});
 await page.screenshot({path:`${out}/brake-side.png`});
 await page.evaluate(()=>{const r=scene.getObjectByName('RopeBrake');const p=r.getWorldPosition(new THREE.Vector3());camera.position.copy(p).add(new THREE.Vector3(-1.1,.7,-.55));controls.target.copy(p).add(new THREE.Vector3(0,-.2,0));controls.update();});
 await page.screenshot({path:`${out}/brake-rear.png`});
 await page.evaluate(()=>{const y=Y0+TOTAL_H;camera.position.set(2.4,y+1.1,.35);controls.target.set(GOV_TENS_X,y+.28,GOV_TENS_Z);controls.update();});
 await page.screenshot({path:`${out}/governor-wire.png`});
 await page.evaluate(()=>{
  const r=scene.getObjectByName('RopeBrakeInstallation'),body=r.getObjectByName('RopeBrake');
  scene.children.forEach(o=>{if(!o.isLight&&o!==mrGrp)o.visible=false;});
  mrGrp.children.forEach(o=>o.visible=o===r);r.children.forEach(o=>o.visible=o===body);
  const p=body.getWorldPosition(new THREE.Vector3());camera.position.copy(body.localToWorld(new THREE.Vector3(.45,.65,.35)));controls.target.copy(p);controls.update();
 });
 await page.screenshot({path:`${out}/blender-detail-top.png`});
 await page.evaluate(()=>{const b=scene.getObjectByName('RopeBrake');const p=b.getWorldPosition(new THREE.Vector3());camera.position.copy(p).add(new THREE.Vector3(.24,-.48,.52));controls.target.copy(p);controls.update();});
 await page.screenshot({path:`${out}/blender-detail-jaws.png`});
 assert.ok(report.tangentError<1e-7);assert.equal(report.gap,.03);
 assert.equal(report.cheeks.length,2);
 assert.ok(report.bearingGaps.every(g=>Math.abs(g)<1e-7));
 assert.ok(report.bridgeGaps.every(g=>Math.abs(g)<1e-7));
 assert.equal(report.duct.height,.022);
 assert.deepEqual(report.wireBridgeHits,[],'Supply cable penetrates bridge');
 assert.equal(report.model.manualHandles,2);assert.equal(report.model.retainedReleaseLevers,2);
 assert.equal(report.grooves.length,15);
 for(const g of report.grooves){
  assert.ok(g.upper>.018&&g.upper<.020,`Groove ${JSON.stringify(g)}`);
  assert.ok(g.land>.014&&g.land<.016);assert.ok(g.lower>.014&&g.lower<.016);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS machine-room safety mounting, rope alignment, wiring anchors and browser load');
}finally{await browser.close();}
