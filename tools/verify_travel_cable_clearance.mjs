import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-tc-clearance';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&CarDoor.state?.ready&&scene.getObjectByName('pitScreenAssembly')?.userData.ready);
 const report=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const original=carGrp.position.y,originalCwt=cwtGrp.position.y,triangles=[];
  const lane=new THREE.Box3(new THREE.Vector3(TC_X-TC_T,-100,TC_CAR_Z-TC_W/2),new THREE.Vector3(TC_CAR_X+TC_T,100,TC_CAR_Z+TC_W/2));
  for(const root of [pitGrp,bufferGrp,railGrp,carGrp])root.traverse(o=>{
   if(!o.isMesh||!o.visible||o.isInstancedMesh)return;
   for(let p=o.parent;p;p=p.parent)if(!p.visible||p.name==='carTravelCable')return;
   const p=o.geometry.attributes.position,idx=o.geometry.index;if(!p)return;
   const n=idx?idx.count:p.count;
   for(let i=0;i<n;i+=3){
    const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));
    const b=new THREE.Box3().setFromPoints(v);
    if(b.intersectsBox(lane))triangles.push({v,box:b,moving:root===carGrp,name:o.name||root.name||'pit component'});
   }
  });
  const collisions=[],positions=travelCable.ribbon.geometry.attributes.position,buffer=positions.array,geo=travelCable.ribbon.geometry;
  const n=travelCableProfile().length,lowest=FLOOR_Y[0]+S.CAR_H/2-.35,highest=FLOOR_Y.at(-1)+S.CAR_H/2+.35;
  let minFloor=Infinity,maxLengthError=0;
  const box=new THREE.Box3(),v=new THREE.Vector3(),tri=new THREE.Triangle();
  for(let step=0;step<=60;step++){
   const y=lowest+(highest-lowest)*step/60;
   carGrp.position.y=y;cwtGrp.position.y=originalCwt+original-y;refreshRopes();
   minFloor=Math.min(minFloor,geo.boundingBox.min.y-travelCable.pitTopY);
   const yc=travelCable.loopBottomY+TC_LOOP_R;
   maxLengthError=Math.max(maxLengthError,Math.abs(travelCable.hangerY+y+TC_CAR_HANGER_LY-2*yc+Math.PI*TC_LOOP_R-travelCable.totalLen));
   for(let i=0;i<TC_SEGS-1;i++){
    box.makeEmpty();for(let k=i*n;k<(i+2)*n;k++)box.expandByPoint(v.fromBufferAttribute(positions,k));
    for(const t of triangles){
     const dy=t.moving?y-original:0;
     if(box.max.y<t.box.min.y+dy||box.min.y>t.box.max.y+dy||box.max.x<t.box.min.x||box.min.x>t.box.max.x)continue;
     tri.set(...t.v);tri.a=tri.a.clone();tri.b=tri.b.clone();tri.c=tri.c.clone();
     tri.a.y+=dy;tri.b.y+=dy;tri.c.y+=dy;
     if(box.intersectsTriangle(tri)){collisions.push({step,name:t.name});break;}
    }
   }
  }
  carGrp.position.y=original;cwtGrp.position.y=originalCwt;refreshRopes();
  const g=scene.getObjectByName('carCableSaddle'),p=g.getWorldPosition(new THREE.Vector3());
  const endpointError=Math.hypot(p.x-TC_SADDLE_R-TC_CAR_X,p.y-(original+TC_CAR_HANGER_LY),p.z-TC_CAR_Z);
  return {sampledPoses:61,candidateTriangles:triangles.length,collisions:collisions.slice(0,15),collisionCount:collisions.length,minFloor,maxLengthError,endpointError,reused:geo===travelCable.ribbon.geometry&&buffer===positions.array};
 });
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.deepEqual(report.collisions,[]);assert.ok(report.minFloor>.10);assert.ok(report.maxLengthError<1e-6);assert.ok(report.endpointError<1e-6);assert.ok(report.reused);
 await page.evaluate(()=>{wallGrp.visible=false;document.getElementById('loading').style.display='none';controls.enableDamping=false;camera.position.set(-.2,1.1,2.8);controls.target.set(-1.25,1.05,TC_CAR_Z);controls.update();renderer.render(scene,camera);});
 await page.screenshot({path:`${out}/pit-installed.png`});
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
