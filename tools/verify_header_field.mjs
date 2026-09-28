import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const before=process.argv.includes('--before'),out='.shot-header-field';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={before};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&HallEmergencyGuide.guides.length===8&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;controls.minDistance=.02;carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();refreshGovernorRope();});
 const aim=async(view)=>page.evaluate(view=>{
  const h=hatchDoors[0],y=(h.link.upY+h.link.loY)/2+FLOOR_Y[0],z=h.left.position.z;
  const p=new THREE.Vector3(0,y-.04,z);
  let offset=new THREE.Vector3(.08,.18,-1.8);
  if(view==='side'){p.x=h.right.position.x+.28;p.y=y;offset.set(.22,.065,-.04);}
  if(view==='inside'){p.x=h.right.position.x+.215;p.y=y-.004;p.z=z+.0055;offset.set(.22,.013,-.008);}
  if(view==='plate'){p.x=h.right.position.x;offset.set(.04,.05,-.6);}
  if(view==='end'){p.x=h.link.pulRX;offset.set(-.16,.15,-.38);}
  camera.near=view==='inside'?.001:.01;camera.fov=45;camera.updateProjectionMatrix();controls.target.copy(p);camera.position.copy(p).add(offset);controls.update();
 },view);
 await aim('front');await page.waitForTimeout(700);
 report.performance=await page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return{median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 for(const view of ['front','plate','side','inside','end']){await aim(view);await page.screenshot({path:`${out}/${before?'before':'after'}-${view}.png`});}
 if(!before){
  report.geometry=await page.evaluate(()=>{
   let rollers=0,minEnd=Infinity,minBack=Infinity,minRope=Infinity,minPulley=Infinity,maxSpringGap=0,maxContactError=0,maxSpinError=0;
   for(const h of hatchDoors)for(const d of [h.left,h.right]){
    const old=d.position.x,rs=d.userData.trackRollers||[];rollers+=rs.length;
    for(let i=0;i<=100;i++){
     d.position.x=d.userData.cx+(d.userData.ox-d.userData.cx)*i/100;spinDoorDrive(h);
     for(const r of rs){const s=r.userData;
      minEnd=Math.min(minEnd,s.halfRail-Math.abs(d.position.x+r.position.x)-s.radius);
      minBack=Math.min(minBack,s.webFace-(r.position.z+s.depth/2));
      minRope=Math.min(minRope,r.position.z-s.depth/2-(h.link.ropeZ+.0018));
      for(const p of [h.relPulley,h.endPulley])minPulley=Math.min(minPulley,Math.hypot(d.position.x+r.position.x-p.position.x,r.position.y-p.position.y)-s.radius-.030);
      maxContactError=Math.max(maxContactError,Math.abs(r.position.y-s.radius-s.railSurface));
      maxSpinError=Math.max(maxSpinError,Math.abs(r.rotation.z+(d.position.x-d.userData.cx)/s.radius));
     }
     if(d===h.right){scene.updateMatrixWorld(true);const c=h.link.closer.opposite,m=d.getObjectByName('hallSpringOppositeMovingEnd');
      const radius=m.userData.coilRadius;
      maxSpringGap=Math.max(maxSpringGap,c.coil.localToWorld(new THREE.Vector3(0,radius,0)).distanceTo(c.fixedEnd.localToWorld(new THREE.Vector3(c.endRun,radius,0))),c.coil.localToWorld(new THREE.Vector3(1,radius,0)).distanceTo(m.localToWorld(new THREE.Vector3(-c.endRun,radius,0))));
     }
    }d.position.x=old;spinDoorDrive(h);
   }return{rollers,minEnd,minBack,minRope,minPulley,maxSpringGap,maxContactError,maxSpinError};
  });
  assert.equal(report.geometry.rollers,16);for(const key of ['minEnd','minBack','minRope','minPulley'])assert.ok(report.geometry[key]>.0005,key);
  assert.ok(report.geometry.maxSpringGap<1e-7);assert.ok(report.geometry.maxContactError<1e-7);assert.ok(report.geometry.maxSpinError<1e-7);
 }
 await page.evaluate(()=>{const h=hatchDoors[0];for(const d of [h.left,h.right])d.position.x=d.userData.ox;spinDoorDrive(h);});
 await aim('front');await page.screenshot({path:`${out}/${before?'before':'after'}-open.png`});
 await page.evaluate(()=>{const h=hatchDoors[0];for(const d of [h.left,h.right])d.position.x=d.userData.cx;spinDoorDrive(h);});
 await page.setViewportSize({width:390,height:844});await aim('plate');await page.screenshot({path:`${out}/${before?'before':'after'}-mobile.png`});
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
