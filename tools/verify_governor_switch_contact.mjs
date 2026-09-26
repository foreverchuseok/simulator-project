import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-governor-switch';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&CarDoor.state?.ready);
 const report=await page.evaluate(()=>{
  const g=govHandles(),m=g.mechanism,body=g.wheel.parent,V=THREE.Vector3;
  // Distance to actual exported GLB triangles, in metres at model scale.
  function surfaceDistance(bodyPoint){
   const world=body.localToWorld(bodyPoint.clone()),q=new V(),t=new THREE.Triangle();let min=Infinity;
   g.switchLever.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,ix=o.geometry.index,n=ix?ix.count:p.count;
    for(let i=0;i<n;i+=3){[t.a,t.b,t.c].forEach((v,j)=>v.fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(o.matrixWorld));t.closestPointToPoint(world,q);min=Math.min(min,q.distanceTo(world));}
   });return min/body.getWorldScale(new V()).x;
  }
  let normalGap=Infinity;
  for(let i=0;i<360;i++){
   g.wheel.rotation.z=i*Math.PI/180;scene.updateMatrixWorld(true);
   const p=g.pendulums[0].localToWorld(new V(...m.strikePoint).sub(g.pendulums[0].position.clone().add(g.wheel.position)));
   normalGap=Math.min(normalGap,surfaceDistance(body.worldToLocal(p)));
  }
  g.pendulums.forEach((p,i)=>p.rotation.z=g.geom.pendRot0[i]+m.pendulum);g.setLinkage(m.pendulum);
  g.wheel.rotation.z=m.switchHitPhase;scene.updateMatrixWorld(true);
  const strike=g.pendulums[0].localToWorld(new V(...m.strikePoint).sub(g.pendulums[0].position.clone().add(g.wheel.position)));
  const strikeLocal=body.worldToLocal(strike);
  const strikeDistance=surfaceDistance(strikeLocal);
  g.wheel.rotation.z=0;g.pendulums.forEach(p=>p.rotation.z=0);g.setLinkage(0);
  const samples=[];
  for(let i=0;i<=60;i++){
   const a=m.releaseArm*i/60,b=governorSwitchContactAngle(g,a);
   g.topArm.rotation.z=a;g.switchLever.rotation.z=b;scene.updateMatrixWorld(true);
   const pad=new V(...m.catchContact).sub(g.topArm.position).applyAxisAngle(new V(0,0,1),a).add(g.topArm.position);
   const roller=new V(...m.switchRoller).sub(new V(...m.switchPivot)).applyAxisAngle(new V(0,0,1),b).add(new V(...m.switchPivot));
   const overlap=Math.min(pad.z+.004,roller.z+m.switchRollerThickness/2)-Math.max(pad.z-.004,roller.z-m.switchRollerThickness/2);
   pad.z=(Math.min(pad.z+.004,roller.z+m.switchRollerThickness/2)+Math.max(pad.z-.004,roller.z-m.switchRollerThickness/2))/2;
   samples.push({a,b,overlap,meshGap:surfaceDistance(pad)-m.catchContactRadius});
  }
  g.topArm.rotation.z=0;g.switchLever.rotation.z=0;scene.updateMatrixWorld(true);
  return {normalGap,strikeDistance,strikeZ:strikeLocal.z,switchZ:m.switchTip[2],samples};
 });
 assert.ok(report.strikeDistance<.0044,`actual striker cube misses GLB actuator: ${report.strikeDistance}`);
 assert.ok(report.normalGap>Math.sqrt(2)*.0044,`normal-speed striker hits actuator: ${report.normalGap}`);
 assert.ok(Math.abs(report.strikeZ-report.switchZ)<1e-7,'striker and switch share depth');
 const contact=report.samples.filter(s=>s.b<-.08001);
 assert.ok(contact.length>20);
 assert.ok(contact.every(s=>s.overlap>0&&Math.abs(s.meshGap)<.00015),JSON.stringify(contact));
 await page.evaluate(()=>{
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');scene.fog=null;wallGrp.visible=false;controls.enableDamping=false;
  const b=govHandles().wheel.parent;
  camera.position.copy(b.localToWorld(new THREE.Vector3(-.20,.42,.25)));
  controls.target.copy(b.localToWorld(new THREE.Vector3(-.095,.235,.035)));controls.update();
 });
 await page.screenshot({path:`${out}/rest.png`});
 await page.evaluate(()=>{const g=govHandles();g.topArm.rotation.z=g.mechanism.releaseArm;g.switchLever.rotation.z=governorSwitchContactAngle(g,g.mechanism.releaseArm);});
 await page.screenshot({path:`${out}/catch-contact.png`});
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 console.log({strikeDistance:report.strikeDistance,contactSamples:contact.length,maxMeshGap:Math.max(...contact.map(s=>Math.abs(s.meshGap))),errors});
}finally{await browser.close();}
