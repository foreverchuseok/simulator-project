// Geared traction machine (traction_machine.glb): mount contract, rope grooves,
// worm/wheel meshing, 25:1 spin coupling, dual brake (2 sets), cut-away toggle,
// extended sheave guard vs ropes / rope brake, deflector sheave GLB, wiring to the panel.
// Needs a static server: SIMULATOR_URL (default Live Server 127.0.0.1:5500).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-traction-machine';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>mrGrp?.userData?.traction?.ready&&govHandles()?.ready&&
   scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&deflectorSheaveGrp?.userData.contract&&
   scene.getObjectByName('MachineRoomSafetyWiring')?.userData.tractionReady,{},{timeout:120000});
 const r=await page.evaluate(()=>{
  const u=mrGrp.userData,t=u.traction,c=t.contract,TM=TRACTION_MACHINE_MOUNT;
  const tm=scene.getObjectByName('TractionMachine');scene.updateMatrixWorld(true);
  const local=p=>tm.worldToLocal(p.clone());
  const meshes=(root,filter)=>{const a=[];root.traverse(o=>{if(o.isMesh&&(!filter||filter(o)))a.push(o);});return a;};
  const rotor=scene.getObjectByName('SheaveRotor'),worm=scene.getObjectByName('WormRotor');
  const ray=new THREE.Raycaster();
  // 1) rope grooves: ray down each rope X onto the sheave top
  const grooves=ROPE_GROOVE_X.map(x=>{
   ray.set(tm.localToWorld(new THREE.Vector3(x,1,0)),new THREE.Vector3(0,-1,0));
   const h=ray.intersectObjects(meshes(rotor),false)[0];return h?local(h.point).y:null;});
  // 2) worm/wheel meshing along the pitch line (y = wheel pitch radius) at three face positions
  const bronze=meshes(rotor,o=>o.material.name==='TM_WheelBronze');
  const thread=meshes(worm,o=>o.material.name==='TM_BrightSteel');
  const intervals=(objs,p0,dir,len)=>{ray.set(p0,dir);ray.far=len;
   const d=ray.intersectObjects(objs,false).map(h=>h.distance).sort((a,b)=>a-b);const iv=[];
   for(let i=0;i+1<d.length;i+=2)iv.push([d[i],d[i+1]]);return iv;};
  const rw=c.wormY-(c.wormY-c.module*c.wheelTeeth/2);          // pitch radius of the wheel
  const pitchY=c.module*c.wheelTeeth/2, mesh=[];
  const save=mainSheaveGrp.rotation.z;
  for(let k=0;k<12;k++){
   const th=k*2*Math.PI/c.wheelTeeth/12;
   mainSheaveGrp.rotation.z=th;t.worm.rotation.z=t.wormPerSheave*th;scene.updateMatrixWorld(true);
   for(const dx of [-.02,0,.02]){
    const p0=tm.localToWorld(new THREE.Vector3(c.wheelX+dx,pitchY,-.10)),dir=new THREE.Vector3(0,0,1).transformDirection(tm.matrixWorld);
    const a=intervals(bronze,p0,dir,.2),b=intervals(thread,p0,dir,.2);let overlap=0;
    for(const [a0,a1] of a)for(const [b0,b1] of b)overlap=Math.max(overlap,Math.min(a1,b1)-Math.max(a0,b0));
    mesh.push({k,dx,teeth:a.length,ridges:b.length,overlapMm:+(overlap*1000).toFixed(2)});
   }
  }
  mainSheaveGrp.rotation.z=save;t.worm.rotation.z=t.wormPerSheave*save;
  // 3) spin coupling through the real ui.js entry point
  const m0=mainSheaveGrp.rotation.z;spinSheaves(.37);
  const spin={sheave:mainSheaveGrp.rotation.z-m0,expected:-.37/u.mainR,worm:t.worm.rotation.z,
   wormExpected:t.wormPerSheave*mainSheaveGrp.rotation.z};
  spinSheaves(-.37);
  // 4) clearances from real vertices in machine-local space (rotated AABBs are too coarse)
  const verts=(root,keep=()=>true)=>{const pts=[];root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.attributes.position;
   for(let i=0;i<g.count;i++){const p=local(o.localToWorld(new THREE.Vector3().fromBufferAttribute(g,i)));if(keep(p))pts.push(p);}});return pts;};
  const bounds=pts=>pts.reduce((b,p)=>(b.min.min(p),b.max.max(p),b),{min:new THREE.Vector3(1e9,1e9,1e9),max:new THREE.Vector3(-1e9,-1e9,-1e9)});
  const inside=(pts,b,pad)=>pts.filter(p=>p.x>b.min.x-pad&&p.x<b.max.x+pad&&p.y>b.min.y-pad&&p.y<b.max.y+pad&&p.z>b.min.z-pad&&p.z<b.max.z+pad).length;
  const sheave=bounds(verts(rotor,p=>p.x>-.11));                    // sheave only (wheel/shaft excluded)
  const guardPts=verts(scene.getObjectByName('SheaveGuard'));
  const armR=bounds(verts(scene.getObjectByName('BrakeArmR'))),motor=bounds(verts(scene.getObjectByName('Motor')));
  const brakeInst=bounds(verts(scene.getObjectByName('RopeBrakeInstallation')));
  const ropeR=.006,ropeTop=sheave.max.y;   // guard must stay outside the rope layer on the sheave
  // distance from guard material over the rope band to the rope centre line: car drop, wrap, tangent run
  const g=c.guard,R=u.mainR,T=g.ropeTanA,p1=[R*Math.cos(T),R*Math.sin(T)],dir=[-Math.sin(T),Math.cos(T)];
  const p2=[c.deflectorDZ+c.deflectorR*Math.cos(T),c.deflectorDY+c.deflectorR*Math.sin(T)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
  const ropeDist=p=>{const z=p.z,y=p.y,a=Math.atan2(y,z);
   const d1=y<=0?Math.abs(z-R):Infinity, d2=(a>=0&&a<=T)?Math.abs(Math.hypot(z,y)-R):Infinity;
   const s=Math.max(0,Math.min(L,(z-p1[0])*dir[0]+(y-p1[1])*dir[1]));
   return Math.min(d1,d2,Math.hypot(z-(p1[0]+dir[0]*s),y-(p1[1]+dir[1]*s)));};
  const guardRopeMin=Math.min(...guardPts.filter(p=>Math.abs(p.x)<.075).map(ropeDist));
  // tunnel end vs rope brake body (cover half-length 161 mm along the rope)
  const rb=local(scene.getObjectByName('RopeBrake').getWorldPosition(new THREE.Vector3()));
  const brakeAlong=(rb.z-p1[0])*dir[0]+(rb.y-p1[1])*dir[1];
  const tunnelToBrake=brakeAlong-.161-g.tail;
  // deflector sheave GLB: grooves at the rope X positions, same design contract
  const dc=deflectorSheaveGrp.userData.contract,defMeshes=meshes(deflectorSheaveGrp);
  const defGrooves=ROPE_GROOVE_X.map(x=>{ray.set(new THREE.Vector3(x,u.defY+1,u.defCenterZ),new THREE.Vector3(0,-1,0));ray.far=2;
   const h=ray.intersectObjects(defMeshes,false)[0];return h?h.point.y-u.defY:null;});
  // wiring: three conduits from the GLB exits into the floor duct branch
  const wiring=scene.getObjectByName('MachineRoomSafetyWiring');
  const runs=['DualBrakeSupply','MotorPowerSupply','EncoderSignal'].map(n=>{const m=wiring.getObjectByName(n);return m?m.userData.endpoints:null;});
  const exits=Object.values(c.cableExits).map(e=>tm.localToWorld(new THREE.Vector3(...e)).toArray());
  return {contract:{mainR:u.mainR,sheaveR:c.sheaveR,ropeX:c.ropeX,wormPerSheave:c.wormPerSheave,TM},
   grooves,grooveBottomR:c.grooveBottomR,mesh,spin,
   sheaveMinX:sheave.min.x,pedestalMaxX:TM.baseX[1],sheaveBottom:sheave.min.y,bedTop:TM.baseTop-.2,
   guardInArmR:inside(guardPts,armR,.004),guardRopeMin,ropeOuter:u.mainR+ropeR,tunnelToBrake,
   dual:c.dualBrake,defGrooves,defGrooveBottom:dc.grooveBottomR,defR:dc.sheaveR,runs,exits,floorY:Y0+TOTAL_H+.02,
   motorMinZ:motor.min.z,sheaveMaxZ:sheave.max.z,
   wormMinZ:bounds(verts(worm)).min.z,ropeBrakeMaxZ:brakeInst.max.z};
 });
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(r,null,1));
 // 5) brake follows MACH release/set; cut-away via the real button
 const brake=await page.evaluate(async()=>{
  const t=mrGrp.userData.traction;MACH.brakeRelease();await new Promise(r=>setTimeout(r,400));
  const open=t.arms.map(a=>a.rotation.z);MACH.brakeSet();await new Promise(r=>setTimeout(r,400));
  return {open,closed:t.arms.map(a=>a.rotation.z)};});
 const cut=await page.evaluate(async()=>{
  const t=mrGrp.userData.traction,b=document.getElementById('tm-cutaway');b.click();
  await new Promise(r=>setTimeout(r,1300));
  const on={pieces:t.cutPieces.map(p=>p.visible),oil:t.oil.visible,pressed:b.getAttribute('aria-pressed')};
  b.click();await new Promise(r=>setTimeout(r,1300));
  const off={pieces:t.cutPieces.map(p=>p.visible&&Math.abs(p.position.x-p.userData.homeX)<1e-6),oil:t.oil.visible};
  return {on,off};});
 console.log(JSON.stringify({grooves:r.grooves,spin:r.spin,brake,cut,
   worstMesh:Math.max(...r.mesh.map(m=>m.overlapMm)),teeth:Math.min(...r.mesh.map(m=>m.teeth))}));
 // screenshots: overview, cut-away, sight glass
 await page.evaluate(()=>{document.querySelectorAll('#ui,#hud,#hint,#loading,.panel,.ui-hint').forEach(e=>e.style.display='none');
  scene.fog=null;controls.minDistance=.05;camera.near=.01;camera.updateProjectionMatrix();});
 const shot=async(name,p,tg,cutOn)=>{await page.evaluate(([p,tg,cutOn])=>{setTractionCutaway(cutOn,true);const u=mrGrp.userData;
  camera.position.set(p[0],u.mainY+p[1],u.mainZ+p[2]);controls.target.set(tg[0],u.mainY+tg[1],u.mainZ+tg[2]);controls.update();},[p,tg,cutOn]);
  await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}.png`});};
 await shot('overview',[1.9,.9,1.7],[-.2,0,.1],false);
 await shot('cutaway',[-1.25,.35,.3],[-.33,.03,.02],true);
 await shot('mesh-closeup',[-.75,.2,0],[-.33,.2,0],true);
 await shot('sight-glass',[-.75,-.1,-.2],[-.43,-.17,-.2],false);
 await shot('brake-motor',[.55,.7,1.15],[-.33,.25,.4],false);
 await shot('dual-brake',[-.2,.95,1.1],[-.33,.45,.33],false);
 await shot('guard-side',[1.9,.55,-.25],[-.1,.05,-.3],false);
 await shot('wiring',[-1.2,1.3,1.6],[-.7,-.6,.5],false);
 await shot('deflector',[1.1,.3,-1.0],[0,-.3,-1.0],false);

 const c=r.contract;
 assert.equal(c.mainR,c.sheaveR,'mainR must equal the GLB sheave radius');
 assert.deepEqual(c.ropeX,[-.06,-.03,0,.03,.06]);
 assert.equal(c.wormPerSheave,-25,'2-start worm on a 50-tooth wheel');
 for(const y of r.grooves)assert.ok(Math.abs(y-r.grooveBottomR)<.0015,`groove bottom ${y}`);
 for(const m of r.mesh){assert.ok(m.teeth>=3&&m.ridges>=5,JSON.stringify(m));assert.ok(m.overlapMm<=.3,`worm/wheel overlap ${JSON.stringify(m)}`);}
 assert.ok(Math.abs(r.spin.sheave-r.spin.expected)<1e-9);assert.ok(Math.abs(r.spin.worm-r.spin.wormExpected)<1e-9);
 assert.ok(r.sheaveMinX>r.pedestalMaxX+.015,'sheave must hang clear of the pedestal');
 assert.ok(r.sheaveBottom>r.bedTop+.10,'sheave above the machine bed');
 assert.equal(r.guardInArmR,0,'brake arm clear of the sheave guard (4 mm)');
 assert.ok(r.guardRopeMin>.006+.025,`guard (skirt/wrap/tunnel) clears the ropes: ${r.guardRopeMin}`);
 assert.ok(r.tunnelToBrake>.04,`guard tunnel stops before the rope brake: ${r.tunnelToBrake}`);
 assert.equal(r.dual.sets,2,'dual brake: every mechanical part in 2 sets (검사기준 12.4.2.1)');
 assert.equal(r.dual.springSet,.116,'TM30B 11 kW spring setting 116 mm');
 assert.ok(r.dual.armNutGap>=.003,'arm to fixing nut gap >= 3 mm');
 assert.equal(r.defR,.144);
 for(const y of r.defGrooves)assert.ok(y!==null&&Math.abs(y-r.defGrooveBottom)<.0015,`deflector groove ${y}`);
 r.runs.forEach((ends,i)=>{assert.ok(ends,'conduit missing');
  assert.ok(Math.hypot(...ends[0].map((v,k)=>v-r.exits[i][k]))<1e-6,'conduit starts at the GLB exit');
  assert.ok(Math.abs(ends[1][0]+.77)<1e-6&&ends[1][1]<r.floorY+.02,'conduit ends in the floor duct branch');});
 assert.ok(r.motorMinZ>r.sheaveMaxZ,'motor ahead of the sheave / car rope');
 assert.ok(r.wormMinZ>r.ropeBrakeMaxZ+.05,'crank end clear of the rope brake');
 assert.ok(brake.open[0]>.01&&brake.open[1]<-.01,'arms swing outward on release');
 assert.deepEqual(brake.closed.map(v=>Math.abs(v)<1e-9),[true,true]);
 assert.deepEqual(cut.on,{pieces:[false,false],oil:true,pressed:'true'});
 assert.deepEqual(cut.off,{pieces:[true,true],oil:false});
 assert.deepEqual(errors,[]);
 console.log('PASS traction machine contract, grooves, worm mesh, 25:1 coupling, dual brake, cut-away, guard, deflector, wiring');
}finally{await browser.close();}
