import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const before=process.argv.includes('--before'),out='.shot-hall-retention';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={before};
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.left.getObjectByName('HallDoorPanelFinish'))&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 if(!before)await page.waitForFunction(()=>HallRetention.devices.length===8);
 await page.evaluate(()=>{controls.enableDamping=false;carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();refreshGovernorRope();});
 const aim=async(close=false)=>page.evaluate(close=>{
  const h=hatchDoors[0],p=h.right.getObjectByName('HallDoorPanelFinish').getWorldPosition(new THREE.Vector3());
  p.y=FLOOR_Y[0]+.018;p.z-=.020;if(!close)p.x=0;
  camera.fov=close?38:42;camera.near=.002;camera.updateProjectionMatrix();controls.minDistance=.01;
  controls.target.copy(p);camera.position.copy(p).add(close?new THREE.Vector3(.05,.12,-.38):new THREE.Vector3(.25,.25,-1.25));controls.update();
 },close);
 await aim();await page.waitForTimeout(700);
 report.performance=await page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);t.push(now-last);last=now;}t.sort((a,b)=>a-b);return {median:t[90],p95:t[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await page.screenshot({path:`${out}/${before?'before':'after'}-overview.png`});
 await aim(true);await page.screenshot({path:`${out}/${before?'before':'after'}-detail.png`});
 if(!before){
  report.geometry=await page.evaluate(()=>{
   scene.updateMatrixWorld(true);let minEnd=Infinity,minFloor=Infinity,minSide=Infinity,minShoeReveal=Infinity,maxDrift=0,minBetween=Infinity,minPanelGap=Infinity,maxTopError=0;
   for(const h of hatchDoors)for(const leaf of [h.left,h.right]){
    const device=leaf.getObjectByName('HallRetentionDevice'),shoes=leaf.children.filter(o=>o.userData.type==='hall-door-shoe'),old=leaf.position.x;
    const s=device.userData,blade=device.getObjectByName('RetentionBlade'),panel=leaf.getObjectByName('HallDoorPanelFinish');
    const panelBox=new THREE.Box3().setFromObject(panel);minPanelGap=Math.min(minPanelGap,panelBox.min.y-leaf.position.y);
    maxTopError=Math.max(maxTopError,Math.abs(panelBox.max.y-leaf.position.y-s.panelTop));
    const b=new THREE.Box3().setFromObject(blade);minFloor=Math.min(minFloor,b.min.y-(leaf.position.y-s.grooveDepth+.0025));
    minSide=Math.min(minSide,(s.grooveWidth-(b.max.z-b.min.z))/2);
    for(const shoe of shoes){const sb=new THREE.Box3().setFromObject(shoe);minShoeReveal=Math.min(minShoeReveal,Math.min(sb.max.y,panelBox.min.y)-leaf.position.y);}
    minBetween=Math.min(minBetween,...shoes.map(o=>Math.abs(o.position.x-device.position.x)-s.plateW/2-o.geometry.parameters.width/2));
    for(let i=0;i<=100;i++){
     leaf.position.x=leaf.userData.cx+(leaf.userData.ox-leaf.userData.cx)*i/100;scene.updateMatrixWorld(true);
     const p=device.getWorldPosition(new THREE.Vector3());maxDrift=Math.max(maxDrift,Math.abs(p.x-leaf.position.x-device.position.x));
     for(const part of [blade,...shoes]){const bb=new THREE.Box3().setFromObject(part);minEnd=Math.min(minEnd,s.runLength/2-Math.max(Math.abs(bb.min.x),Math.abs(bb.max.x)));}
    }
    leaf.position.x=old;
   }
   scene.updateMatrixWorld(true);return {count:HallRetention.devices.length,minEnd,minFloor,minSide,minShoeReveal,maxDrift,minBetween,minPanelGap,maxTopError};
  });
  const g=report.geometry;assert.equal(g.count,8);assert.ok(g.minEnd>.019&&g.minFloor>.001&&g.minSide>.0009);
  assert.ok(g.minShoeReveal>.0089&&g.minPanelGap>.0089&&g.minPanelGap<.0091&&g.maxTopError<1e-5);
  assert.ok(g.minBetween>.05&&g.maxDrift<1e-6);
  await page.evaluate(()=>{
    const h=hatchDoors[0],shoe=h.right.children.find(o=>o.userData.type==='hall-door-shoe'),p=shoe.getWorldPosition(new THREE.Vector3());
    p.y=FLOOR_Y[0]+.007;camera.fov=38;camera.updateProjectionMatrix();controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.012,.015,-.18));controls.update();
  });
  await page.screenshot({path:`${out}/ordinary-shoe.png`});
  await page.evaluate(()=>{const h=hatchDoors[0];h.left.position.x=h.left.userData.ox;h.right.position.x=h.right.userData.ox;spinDoorDrive(h);});
  await aim(true);await page.screenshot({path:`${out}/open.png`});
  await page.setViewportSize({width:390,height:844});await aim(true);await page.screenshot({path:`${out}/mobile.png`});
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
