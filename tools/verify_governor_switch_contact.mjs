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
  function rotate(p,pivot,angle){const c=Math.cos(angle),s=Math.sin(angle),x=p[0]-pivot[0],y=p[1]-pivot[1];return[pivot[0]+x*c-y*s,pivot[1]+x*s+y*c];}
  function nearestContact(a,b){
   let best={distance:Infinity};
   function pointEdge(p,x,y){const dx=y[0]-x[0],dy=y[1]-x[1],t=Math.max(0,Math.min(1,((p[0]-x[0])*dx+(p[1]-x[1])*dy)/(dx*dx+dy*dy))),q=[x[0]+t*dx,x[1]+t*dy],distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(distance<best.distance)best={distance,point:[(p[0]+q[0])/2,(p[1]+q[1])/2]};}
   for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){pointEdge(a[i],b[j],b[(j+1)%b.length]);pointEdge(b[j],a[i],a[(i+1)%a.length]);}
   return best;
  }
  // Check the contact point against actual exported triangles, including bevels.
  const strikes=[];
  for(const direction of [1,-1]){
   const curve=direction>0?m.switchStrikeDown:m.switchStrikeUp;
   let maxGap=0,count=0;
   for(let i=2;i<curve.angles.length-7;i+=2){
    const travel=i*curve.step,w=curve.phase+direction*travel,angle=governorStrikeRotation(curve,travel);
    g.wheel.rotation.z=w;g.switchLever.rotation.z=angle;g.pendulums.forEach(p=>p.rotation.z=m.pendulum);g.setLinkage(m.pendulum);scene.updateMatrixWorld(true);
    const pivot=g.pendulums[0].position.clone().add(g.wheel.position);
    const head=m.strikeOutline.map(p=>rotate(rotate(p,[pivot.x,pivot.y],m.pendulum),[g.wheel.position.x,g.wheel.position.y],w));
    const arm=m.actuatorOutline.map(p=>rotate(p,m.switchPivot,angle));
    const near=nearestContact(head,arm);
    if(Math.abs(curve.angles[i]-curve.angles[i-1])>1e-8){maxGap=Math.max(maxGap,surfaceDistance(new V(...near.point,m.strikePoint[2])));count++;}
   }
   strikes.push({direction,maxGap,count});
  }
  // Real timeline: no movement before contact, then a visible push, then the latch.
  g.wheel.rotation.z=0;g.pendulums.forEach(p=>p.rotation.z=0);g.setLinkage(0);g.switchLever.rotation.z=0;
  const timeline=governorTrip(1).pause(),sweep=[];
  for(const time of [2.1,2.2,2.4,2.7,3.0,3.3,3.9,6.2]){timeline.time(time);sweep.push({time,wheel:g.wheel.rotation.z,angle:g.switchLever.rotation.z,closed:g.switchLever.userData.contactClosed});}
  timeline.kill();governorPhase='rest';g.ropeLocked=false;g.wheel.rotation.z=0;g.pendulums.forEach(p=>p.rotation.z=0);g.setLinkage(0);g.switchLever.rotation.z=0;g.switchLever.userData.contactClosed=true;g.topArm.rotation.z=0;g.pawl.rotation.z=0;g.ratchet.rotation.z=0;g.spring.scale.y=1;
  return {normalGap,strikeDistance,strikeZ:strikeLocal.z,switchZ:m.switchTip[2],samples,strikes,sweep};
 });
 assert.ok(report.strikeDistance<.0044,`actual striker cube misses GLB actuator: ${report.strikeDistance}`);
 assert.ok(report.normalGap>Math.sqrt(2)*.0044,`normal-speed striker hits actuator: ${report.normalGap}`);
 assert.ok(Math.abs(report.strikeZ-report.switchZ)<1e-7,'striker and switch share depth');
 const contact=report.samples.filter(s=>s.b<-.08001);
 assert.ok(contact.length>20);
 assert.ok(contact.every(s=>s.overlap>0&&Math.abs(s.meshGap)<.00015),JSON.stringify(contact));
 assert.ok(report.strikes.every(s=>s.count>20&&s.maxGap<.00065),JSON.stringify(report.strikes));
 assert.ok(Math.abs(report.sweep[0].angle)<1e-10,'Actuator stays at rest before the square head reaches it');
 assert.ok(report.sweep[2].angle<0&&report.sweep[2].angle>-.2,'First contact pushes the actuator without an instant latch');
 assert.ok(report.sweep[3].closed===false,'Electrical contact opens during physical push');
 assert.ok(Math.abs(report.sweep[6].angle+Math.PI/3)<1e-5,'Down latch still reaches requested horizontal -75 degrees');
 await page.evaluate(()=>{
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');scene.fog=null;wallGrp.visible=false;controls.enableDamping=false;
  const b=govHandles().wheel.parent;
  camera.position.copy(b.localToWorld(new THREE.Vector3(-.20,.42,.25)));
  controls.target.copy(b.localToWorld(new THREE.Vector3(-.095,.235,.035)));controls.update();
 });
 await page.screenshot({path:`${out}/rest.png`});
 await page.evaluate(()=>{const g=govHandles();g.topArm.rotation.z=g.mechanism.releaseArm;g.switchLever.rotation.z=governorSwitchContactAngle(g,g.mechanism.releaseArm);});
 await page.screenshot({path:`${out}/catch-contact.png`});
 for(const direction of [1,-1]){
  await page.evaluate(direction=>{
   const g=govHandles(),curve=direction>0?g.mechanism.switchStrikeDown:g.mechanism.switchStrikeUp,travel=curve.travel*.55;
   g.topArm.rotation.z=0;g.wheel.rotation.z=curve.phase+direction*travel;g.pendulums.forEach(p=>p.rotation.z=g.mechanism.pendulum);g.setLinkage(g.mechanism.pendulum);g.switchLever.rotation.z=governorStrikeRotation(curve,travel);
  },direction);
  await page.screenshot({path:`${out}/${direction>0?'down':'up'}-striker-contact.png`});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 console.log({strikeDistance:report.strikeDistance,contactSamples:contact.length,maxMeshGap:Math.max(...contact.map(s=>Math.abs(s.meshGap))),strikes:report.strikes,errors});
}finally{await browser.close();}
