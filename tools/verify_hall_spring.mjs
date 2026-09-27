import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const baseline=process.argv.includes('--baseline'),out='.shot-hall-spring';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={baseline};
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(baseline)await page.route('**/js/elevator.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('temporary/elevator-before-spring-connection.js','utf8')}));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>HallEmergencyGuide.guides.length===8&&CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();refreshGovernorRope();});
 const aim=async(kind='overview')=>page.evaluate(kind=>{
   const h=hatchDoors[0],c=h.link.closer,p=new THREE.Vector3();
   if(kind==='fixed')c.fixedEnd.getWorldPosition(p);
   else if(kind==='moving')h.left.getObjectByName('hallSpringMovingEnd').getWorldPosition(p);
   else p.set(0,FLOOR_Y[0]+S.DOOR_H+.19,h.left.position.z-.02);
   camera.fov=45;camera.updateProjectionMatrix();controls.target.copy(p);
   camera.position.copy(p).add(kind==='overview'?new THREE.Vector3(.20,.18,-1.75):new THREE.Vector3(.075,-.008,-.12));controls.update();
 },kind);
 await aim();await page.waitForTimeout(1000);
 report.performance=await page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return {median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await page.screenshot({path:`${out}/${baseline?'before':'after'}-overview.png`});
 if(!baseline){
  report.checks=await page.evaluate(()=>{
   let maxEndpointGap=0,minLength=Infinity,minPinClearance=Infinity;
   for(const h of hatchDoors){
    const c=h.link.closer,m=h.left.getObjectByName('hallSpringMovingEnd'),f=c.fixedEnd,old=h.left.position.x;
    for(let i=0;i<=100;i++){
     h.left.position.x=h.left.userData.cx+(h.left.userData.ox-h.left.userData.cx)*i/100;spinDoorDrive(h);scene.updateMatrixWorld(true);
     const start=c.coil.localToWorld(new THREE.Vector3(0,m.userData.coilRadius,0)),end=c.coil.localToWorld(new THREE.Vector3(1,m.userData.coilRadius,0));
     const a=m.localToWorld(new THREE.Vector3(c.endRun,m.userData.coilRadius,0)),b=f.localToWorld(new THREE.Vector3(-c.endRun,f.userData.coilRadius,0));
     maxEndpointGap=Math.max(maxEndpointGap,start.distanceTo(a),end.distanceTo(b));minLength=Math.min(minLength,c.coil.scale.x);
    }
    minPinClearance=Math.min(minPinClearance,m.userData.eyeRadius-m.userData.wireRadius-m.userData.pinRadius);
    h.left.position.x=old;spinDoorDrive(h);
   }
   const h=hatchDoors[0];let reference;h.interlock.opposite.traverse(o=>{if(o.isMesh&&/Opposite.*mounting.*extension/i.test(o.name))reference=o;});
   const colors=reference.geometry.getAttribute('color'),gold=reference.material.color.clone(),average=new THREE.Color(0,0,0);
   for(let n=0;n<colors.count;n++){average.r+=colors.getX(n);average.g+=colors.getY(n);average.b+=colors.getZ(n);}
   const unit=colors.normalized?(colors.array instanceof Uint16Array?65535:255):1;average.multiplyScalar(1/(colors.count*unit));gold.multiply(average);
   const clamp=h.right.getObjectByName('relayUpperClamp'),term=h.left.getObjectByName('relayThreadedTerminals');
   const goldSupports=[clamp.children[0],clamp.children[1],term.children[0],term.children[1]].every(o=>o.material.color.getHex()===gold.getHex());
   return {maxEndpointGap,minLength,minPinClearance,goldSupports,goldColor:gold.toArray(),floors:hatchDoors.length};
  });
  assert.ok(report.checks.maxEndpointGap<1e-6);assert.ok(report.checks.minPinClearance>0);assert.ok(report.checks.minLength>.05);assert.ok(report.checks.goldSupports);assert.ok(report.checks.goldColor.every(v=>v>=0&&v<=1));
  for(const kind of ['moving','fixed']){await aim(kind);await page.screenshot({path:`${out}/${kind}-closed.png`});}
  await page.evaluate(()=>{const p=hatchDoors[0].left.getObjectByName('hallSpringMovingEnd').getWorldPosition(new THREE.Vector3());controls.target.copy(p).add(new THREE.Vector3(0,-.020,0));camera.position.copy(p).add(new THREE.Vector3(.10,.012,-.20));controls.update();});
  await page.screenshot({path:`${out}/moving-attachment.png`});
  await page.evaluate(()=>{const h=hatchDoors[0];h.left.position.x=h.left.userData.ox;h.right.position.x=h.right.userData.ox;spinDoorDrive(h);});
  await aim('moving');await page.screenshot({path:`${out}/moving-open.png`});
  await page.setViewportSize({width:390,height:844});await aim('moving');await page.screenshot({path:`${out}/mobile-moving.png`});
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/${baseline?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
