import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-car-lock';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&document.getElementById('loading').classList.contains('hide'));
 const upperLock=await page.evaluate(()=>{
  const q=CarDoor.state,L=q.lockSpec,rows=[];carDoorR.position.x=q.d.cx;
  for(let i=0;i<=100;i++){
   q.release=i/100;CarDoor.pose();scene.updateMatrixWorld(true);
   const tip=q.keeper.worldToLocal(q.lockTooth.getWorldPosition(new THREE.Vector3()));
   const contact=q.keeper.worldToLocal(q.carHook.localToWorld(new THREE.Vector3(L.contactX,L.contactY,L.contactZ)));
   let strikeIntrusions=0,roofClearance=Infinity;
   const hook=q.lockHookMesh,a=hook.geometry.attributes.position;
   for(let j=0;j<a.count;j++){
    const p=q.keeper.worldToLocal(hook.localToWorld(new THREE.Vector3().fromBufferAttribute(a,j)));
    if(p.y>L.strikeY-.003&&p.y<L.strikeY&&p.x>-.373&&p.x<-.149&&Math.abs(p.z-L.hookT/2)<.015){
     if(p.x<L.slotL||p.x>L.slotR||Math.abs(p.z-L.hookT/2)>L.slotHalfZ)strikeIntrusions++;
    }
   }
   const ins=q.lockMovingInsulator,b=ins.geometry.attributes.position;
   for(let j=0;j<b.count;j++){
    const p=q.keeper.worldToLocal(ins.localToWorld(new THREE.Vector3().fromBufferAttribute(b,j)));
    if(Math.abs(p.x-L.caseX)<L.caseW/2)roofClearance=Math.min(roofClearance,L.caseY+L.caseH/2-.0015-p.y);
   }
   rows.push({i,tipClearance:tip.y-L.strikeY,contactGap:contact.y-L.contactY,strikeIntrusions,roofClearance});
  }
  q.release=0;CarDoor.pose();scene.updateMatrixWorld(true);
  const hits=x=>{
   const origin=q.keeper.localToWorld(new THREE.Vector3(x,L.strikeY+.020,L.hookT/2));
   return new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.05).intersectObject(q.lockStrike).length;
  };
  return {rows,slotHits:hits((L.slotL+L.slotR)/2),solidHits:hits(L.slotL-.012),pivotOffset:q.carHook.position.x-q.leftRest};
 });
 assert.equal(upperLock.slotHits,0);assert.ok(upperLock.solidHits>0);
 assert.ok(Math.abs(upperLock.pivotOffset+.018)<1e-8);
 assert.ok(Math.abs(upperLock.rows[0].contactGap)<1e-7);assert.ok(upperLock.rows[100].contactGap>.060);
 assert.ok(upperLock.rows[0].tipClearance<-.015);assert.ok(upperLock.rows[100].tipClearance>.030);
 assert.ok(upperLock.rows.every(r=>r.strikeIntrusions===0&&r.roofClearance>.002));
 const result=await page.evaluate(()=>{
  const q=CarDoor.state,d=q.d,sill=carGrp.getObjectByName('carSill'),shoes=[],failures=[];
  carGrp.traverse(o=>{if(o.userData.type==='car-door-guide-shoe')shoes.push(o);});
  const wires=[q.releaseWire,...q.edgeTails.map(t=>t.mesh)],buffers=wires.map(w=>w.geometry.attributes.position.array);
  const solids=[];sill.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();solids.push(o);}});
  let minFloorClearance=Infinity,minSideClearance=Infinity,maxWireGap=0,created=0;
  const Original=THREE.TubeGeometry;THREE.TubeGeometry=class extends Original{constructor(...args){super(...args);created++;}};
  try {for(let i=0;i<=100;i++){
   q.release=i/100;carDoorR.position.x=d.cx+d.stroke*i/100;CarDoor.pose();scene.updateMatrixWorld(true);
   for(const shoe of shoes){
    const b=new THREE.Box3().setFromObject(shoe),local=carGrp.worldToLocal(b.getCenter(new THREE.Vector3()));
    minFloorClearance=Math.min(minFloorClearance,b.min.y-(carGrp.position.y+d.floor-.010));
    minSideClearance=Math.min(minSideClearance,.005-Math.abs(local.z-d.guideZ)-q.spec.shoeT/2);
    if(Math.max(Math.abs(b.min.x),Math.abs(b.max.x))>d.sillW/2)failures.push('shoe leaves sill '+i);
   }
   const tip=q.releaseLever.localToWorld(q.releaseTip.clone()),end=q.releaseWire.localToWorld(q.releaseWirePoints[0].clone());
   maxWireGap=Math.max(maxWireGap,tip.distanceTo(end));
   for(const {mesh} of q.edgeTails){
    const curve=mesh.geometry.parameters.path;
    for(let j=0;j<=160;j++){
     const p=mesh.localToWorld(curve.getPoint(j/160));
     for(const solid of solids){const v=solid.worldToLocal(p.clone());if(solid.geometry.boundingBox.clone().expandByScalar(q.spec.edgeWireR).containsPoint(v)){failures.push('flex touches sill '+i);break;}}
    }
   }
  }} finally {THREE.TubeGeometry=Original;q.release=0;carDoorR.position.x=d.cx;CarDoor.pose();}
  return {shoes:shoes.length,minFloorClearance,minSideClearance,maxWireGap,created,reused:wires.every((w,i)=>w.geometry.attributes.position.array===buffers[i]),failures:[...new Set(failures)]};
 });
 console.log(JSON.stringify(result));
 assert.equal(result.shoes,4);assert.ok(result.minFloorClearance>.0018);assert.ok(result.minSideClearance>.0014);
 assert.ok(result.maxWireGap<1e-7);assert.equal(result.created,0);assert.equal(result.reused,true);assert.deepEqual(result.failures,[]);
 await page.evaluate(()=>{
  scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
  scene.background=new THREE.Color('#aab4bd');scene.fog=null;
  document.querySelectorAll('#ui,#hud,.panel,#hint,#loading').forEach(e=>e.style.display='none');
  carGrp.children.forEach(o=>o.visible=['carDoorOperator','carDoorL','carDoorR','carPanelAssembly','carUnderbody'].includes(o.name));
 });
 async function shot(name,pos,target){await page.evaluate(({pos,target})=>{camera.position.copy(carGrp.localToWorld(new THREE.Vector3(...pos)));controls.target.copy(carGrp.localToWorld(new THREE.Vector3(...target)));controls.update();},{pos,target});await page.screenshot({path:out+'/'+name+'.png'});}
 const d=await page.evaluate(()=>CarDoor.dimensions());
 await shot('front',[0,0,d.doorZ+3.8],[0,0,d.doorZ]);
 await shot('shoe',[.52,d.floor+.15,d.doorZ+.32],[.61,d.floor+.015,d.doorZ]);
 await shot('lock',[.46,d.trackY+.20,d.doorZ+.76],[.15,d.trackY+.12,d.doorZ+.04]);
 await page.evaluate(()=>{CarDoor.state.release=1;CarDoor.pose();});
 await shot('lock-released',[.46,d.trackY+.20,d.doorZ+.76],[.15,d.trackY+.12,d.doorZ+.04]);
 await page.evaluate(()=>{carDoorR.position.x=CarDoor.dimensions().ox;CarDoor.pose();});
 await shot('open',[0,0,d.doorZ+4.4],[0,0,d.doorZ]);
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({upperLock,result,errors},null,2));
 console.log('PASS car lock, release wire, guide shoes and lower flex clearance.');
} finally {await browser.close();}
