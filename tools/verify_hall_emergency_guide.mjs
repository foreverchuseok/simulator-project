import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-hall-emergency-guide';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];const report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});
 page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>HallEmergencyGuide.guides.length===FLOORS*2&&CarDoor.state?.ready&&govHandles()?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();refreshGovernorRope();});
 const aim=async(side=1,detail=false)=>page.evaluate(({side,detail})=>{
   const guide=HallEmergencyGuide.guides.find(g=>g.userData.floor===0&&g.userData.side===side);
   const p=guide.getWorldPosition(new THREE.Vector3());p.y+=.015;
   camera.fov=45;camera.updateProjectionMatrix();controls.target.copy(p);
   camera.position.copy(p).add(detail?new THREE.Vector3(.13,.075,-.17):new THREE.Vector3(.6,.32,-.75));controls.update();
 },{side,detail});
 report.geometry=await page.evaluate(()=>{
   let minEnd=Infinity,minLipGap=Infinity,minRoofGap=Infinity,minRailGap=Infinity,minRopeGap=Infinity,minPulleyGap=Infinity,minCaptureOverlap=Infinity;
   for(const guide of HallEmergencyGuide.guides){
     const s=guide.userData,g=s.rail,parent=guide.parent,old=parent.position.x;
     for(let i=0;i<=100;i++){
       parent.position.x=parent.userData.cx+(parent.userData.ox-parent.userData.cx)*i/100;
       const x=parent.position.x+guide.position.x;
       minEnd=Math.min(minEnd,g.caseWidth/2-.02-Math.abs(x)-s.width/2);
       const h=hatchDoors[s.floor],pulley=s.side>0?h.endPulley:h.relPulley;
       const radius=Math.max(...pulley.children.map(o=>o.geometry?.parameters.radiusTop||0));
       const dx=Math.abs(pulley.position.x-x)-s.width/2;
       minPulleyGap=Math.min(minPulleyGap,Math.hypot(Math.max(0,dx),s.bottom)-radius);
     }
     parent.position.x=old;
     minLipGap=Math.min(minLipGap,g.plateZ+s.tipZ-s.thickness/2-(g.lipZ+.0015));
     minRoofGap=Math.min(minRoofGap,g.caseTopY-.003-(g.caseCY+s.tipY));
     minRailGap=Math.min(minRailGap,-.008-(g.plateZ+s.tipZ+s.thickness/2));
     minRopeGap=Math.min(minRopeGap,s.bridgeY-s.thickness/2-(.022+.0018));
     minCaptureOverlap=Math.min(minCaptureOverlap,g.caseCY+s.tipY-(g.caseTopY-.014));
   }
   return {count:HallEmergencyGuide.guides.length,minEnd,minLipGap,minRoofGap,minRailGap,minRopeGap,minPulleyGap,minCaptureOverlap,
    meshCount:HallEmergencyGuide.guides[0].children.length,
    sharedGeometry:HallEmergencyGuide.guides[0].children[0].geometry===HallEmergencyGuide.guides[1].children[0].geometry};
 });
 assert.equal(report.geometry.count,8);assert.ok(report.geometry.sharedGeometry);
 for(const [k,v]of Object.entries(report.geometry))if(k.startsWith('min'))assert.ok(v>.0009,`${k}: ${v}`);
 for(const side of [1,-1]){await aim(side);await page.screenshot({path:`${out}/closed-${side}.png`});await aim(side,true);await page.screenshot({path:`${out}/detail-${side}.png`});}
 await page.evaluate(()=>{
   const g=HallEmergencyGuide.guides.find(g=>g.userData.floor===0&&g.userData.side===1);
   const p=g.getWorldPosition(new THREE.Vector3());p.y+=.032;
   camera.position.copy(p).add(new THREE.Vector3(.105,.030,-.018));controls.target.copy(p);controls.update();
 });await page.screenshot({path:`${out}/fold-side.png`});
 await aim();
 await page.waitForFunction(()=>!document.getElementById('guide-action-0-1').hidden);
 await page.click('#guide-action-0-1');assert.ok(await page.locator('#emergency-guide-panel').isVisible());
 await page.screenshot({path:`${out}/desktop-info.png`});await page.keyboard.press('Escape');
 assert.ok(await page.locator('#emergency-guide-panel').isHidden());
 // Same camera and quality; isolate guide rendering cost with only the new meshes toggled.
 report.performance=[];
 for(const visible of [false,true]){
   await page.evaluate(v=>HallEmergencyGuide.guides.forEach(g=>g.visible=v),visible);await page.waitForTimeout(1000);
   const sample=await page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return {median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
   report.performance.push({visible,...sample});
 }
 await page.evaluate(()=>{const h=hatchDoors[0];h.left.position.x=h.left.userData.ox;h.right.position.x=h.right.userData.ox;spinDoorDrive(h);});
 await aim();await page.screenshot({path:`${out}/open.png`});
 await page.evaluate(()=>{const h=hatchDoors[0];h.left.position.x=h.left.userData.cx;h.right.position.x=h.right.userData.cx;spinDoorDrive(h);});
 await page.setViewportSize({width:390,height:844});await aim();await page.tap('#guide-action-0-1');
 assert.ok(await page.locator('#emergency-guide-panel').isVisible());
 const bounds=await page.locator('#emergency-guide-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);
 await page.screenshot({path:`${out}/mobile-info.png`});await page.tap('#emergency-guide-dismiss');
 assert.ok(await page.locator('#emergency-guide-panel').isHidden());
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
