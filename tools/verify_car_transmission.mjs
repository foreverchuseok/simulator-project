import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-car-transmission';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&govHandles()?.ready&&document.getElementById('loading').classList.contains('hide'),{},{timeout:90000});
 const report=await page.evaluate(()=>{
  const q=CarDoor.state,t=q.transmission,p=t.spec;carGrp.updateWorldMatrix(true,true);
  const original=t.root.getObjectByName('carDoorLinkageRope').geometry,points=[];
  let guideCrossings=0;
  for(let i=0;i<=3000;i++){const v=t.ropeCurve.getPointAt(i/3000);if(Math.hypot(v.x-t.B.x,v.y-t.B.y)<p.guideR-.005-p.ropeR&&Math.abs(v.z-t.guide.position.z)<.006+p.ropeR)guideCrossings++;}
  for(let i=0;i<=100;i++){
   carDoorR.position.x=q.d.cx+q.d.stroke*i/100;q.release=1;CarDoor.pose();
   const right=t.clamps[1].getWorldPosition(new THREE.Vector3());carGrp.worldToLocal(right);
   const left=t.clamps[0].getWorldPosition(new THREE.Vector3());carGrp.worldToLocal(left);
   points.push({travel:t.travel,right:right.x,left:left.x,ends:t.endX-Math.max(Math.abs(right.x),Math.abs(left.x))-.0375,ratios:[t.reduction.rotation.z*p.drumR+t.travel,t.motorPulley.rotation.z*p.motorR-t.reduction.rotation.z*p.wheelR],finite:t.marks.every(({marker})=>marker.position.toArray().every(Number.isFinite))});
  }
  carDoorR.position.x=q.d.cx;q.release=0;CarDoor.pose();
  return {points,guideCrossings,reused:original===t.root.getObjectByName('carDoorLinkageRope').geometry,removed:!q.root.getObjectByName('operatorDriveLink0')&&!q.root.getObjectByName('driveLinkFixedBracket'),beltLength:t.beltCurve.getLength(),ropeLength:t.ropeCurve.getLength(),shaftClearance:S.SHAFT_W/2-t.endX-p.endR-.003,clutchPlaneGap:(q.d.doorZ+.023)-(t.ropeZ+p.groovePitch+p.ropeR)};
 });
 assert.equal(report.guideCrossings,0);assert.equal(report.removed,true);assert.equal(report.reused,true);assert.ok(report.clutchPlaneGap>.003);assert.ok(report.shaftClearance>.025);
 report.points.forEach((p,i)=>{assert.ok(p.ends>.04);assert.equal(p.finite,true);p.ratios.forEach(v=>assert.ok(Math.abs(v)<1e-8));assert.ok(Math.abs(p.right-(.5+.754*i/100))<1e-6);assert.ok(Math.abs(p.left+p.right)<1e-6);});
 await page.evaluate(()=>{
  scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});scene.background=new THREE.Color('#8395a3');scene.fog=null;
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
  const q=CarDoor.state,y=carGrp.position.y+q.d.trackY,z=carGrp.position.z+q.d.doorZ;
  camera.position.set(-.23,y+.30,z+2.1);controls.target.set(-.23,y+.30,z);controls.update();
 });
 await page.screenshot({path:`${out}/front.png`});
 await page.evaluate(()=>{const q=CarDoor.state,y=carGrp.position.y+q.d.trackY,z=carGrp.position.z+q.d.doorZ;camera.position.set(-1.3,y+.65,z+1.8);controls.target.set(-.3,y+.25,z);controls.update();});
 await page.screenshot({path:`${out}/oblique.png`});
 await page.evaluate(()=>{const q=CarDoor.state,y=carGrp.position.y+q.d.trackY,z=carGrp.position.z+q.d.doorZ;camera.position.set(-.45,y+.9,z-.85);controls.target.set(-.3,y+.35,z-.10);controls.update();});
 await page.screenshot({path:`${out}/rear-motor.png`});
 await page.evaluate(()=>{const q=CarDoor.state;carDoorR.position.x=q.d.ox;q.release=1;CarDoor.pose();const y=carGrp.position.y+q.d.trackY,z=carGrp.position.z+q.d.doorZ;camera.position.set(0,y+.35,z+2.6);controls.target.set(0,y+.20,z);controls.update();});
 await page.screenshot({path:`${out}/open.png`});
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({report,errors},null,2));console.log('PASS',JSON.stringify({...report,points:report.points.length,errors}));
}finally{await browser.close();}
