import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-wire-rope');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});const page=await browser.newPage({viewport:{width:1280,height:850}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&ropeObjs.length===5&&document.getElementById('loading').classList.contains('hide'));
 const result=await page.evaluate(()=>{
  // Frozen pre-optimization construction is the geometric regression reference.
  function legacy(r,cy,wy){
   const Rm=r.mainR,Rd=r.defR,dz=r.defCenterZ-r.mainZ,dy=r.defY-r.mainY,D=Math.hypot(dz,dy);
   let a=Math.atan2(dy,dz)-Math.acos((Rm-Rd)/D);if(a<0)a+=Math.PI*2;
   const pts=[new THREE.Vector3(r.rx,cy,CAR_CTR_Z)];
   const arc=(z,y,R,a0,a1,n)=>{for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n;pts.push(new THREE.Vector3(r.rx,y+R*Math.sin(t),z+R*Math.cos(t)));}};
   arc(r.mainZ,r.mainY,Rm,0,a,22);arc(r.defCenterZ,r.defY,Rd,a,Math.PI,12);
   pts.push(new THREE.Vector3(r.rx,wy,cwtGrp.position.z));
   const curve=new THREE.CurvePath();for(let i=0;i<pts.length-1;i++)curve.add(new THREE.LineCurve3(pts[i],pts[i+1]));
   return new THREE.TubeGeometry(curve,96,r.ropeR,7,false);
  }
  const cy0=carGrp.position.y,wy0=cwtGrp.position.y,wz0=cwtGrp.position.z;
  const geometry=ropeObjs[0].line.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index,uv=geometry.attributes.uv;
  let maxPositionError=0,maxNormalError=0,topology=true,bounds=true,reused=true;
  const vertex=new THREE.Vector3();let poses=0;
  try{
   for(let k=0;k<=24;k++){
    const y=FLOOR_Y[0]+S.CAR_H/2-.35+(FLOOR_Y.at(-1)-FLOOR_Y[0]+.7)*k/24;
    carGrp.position.y=y;cwtGrp.position.y=wy0+cy0-y;
    refreshRopes();scene.updateMatrixWorld(true);poses++;
    reused&&=geometry.attributes.position===position&&geometry.attributes.normal===normal&&geometry.index===index&&geometry.attributes.uv===uv;
    for(const r of ropeObjs){
     reused&&=r.line.geometry===geometry;
     const expected=legacy(r,y+S.CAR_H/2+.68,cwtGrp.position.y+S.CWT_H/2+.31);
     const a=expected.attributes.position,b=expected.attributes.normal;
     topology&&=a.count===position.count&&expected.index.count===index.count;
     for(let i=0;i<position.count;i++){
      vertex.fromBufferAttribute(position,i);
      bounds&&=geometry.boundingBox.containsPoint(vertex)&&vertex.distanceTo(geometry.boundingSphere.center)<=geometry.boundingSphere.radius+1e-6;
      r.line.localToWorld(vertex);
      maxPositionError=Math.max(maxPositionError,Math.abs(vertex.x-a.getX(i)),Math.abs(vertex.y-a.getY(i)),Math.abs(vertex.z-a.getZ(i)));
      maxNormalError=Math.max(maxNormalError,Math.abs(normal.getX(i)-b.getX(i)),Math.abs(normal.getY(i)-b.getY(i)),Math.abs(normal.getZ(i)-b.getZ(i)));
     }
     for(let i=0;i<index.count;i++)topology&&=index.array[i]===expected.index.array[i];
     for(let i=0;i<uv.array.length;i++)topology&&=uv.array[i]===expected.attributes.uv.array[i];
     expected.dispose();
    }
   }
  }finally{carGrp.position.y=cy0;cwtGrp.position.y=wy0;cwtGrp.position.z=wz0;refreshRopes();}
  const version=position.version;refreshRopes();const stationaryUploadSkipped=position.version===version;
  return {poses,ropes:ropeObjs.length,maxPositionError,maxNormalError,topology,bounds,reused,stationaryUploadSkipped};
 });
 assert.equal(result.ropes,5);assert.equal(result.poses,25);
 assert.ok(result.maxPositionError<2e-6,JSON.stringify(result));assert.ok(result.maxNormalError<2e-6,JSON.stringify(result));
 for(const key of ['topology','bounds','reused','stationaryUploadSkipped'])assert.equal(result[key],true,key);
 console.log('GEOMETRY',JSON.stringify(result));
 for(const target of [3,0]){
  await page.waitForFunction(()=>!moving&&!doorOpen&&!gsap.isTweening(carDoorL.position));
  await page.evaluate(target=>moveElevator(target),target);
  await page.waitForFunction(target=>curFloor===target&&!moving,target);
  const coupled=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,geometries:new Set(ropeObjs.map(r=>r.line.geometry.uuid)).size}));
  assert.equal(coupled.geometries,1);
  await page.waitForFunction(()=>doorOpen&&!gsap.isTweening(carDoorL.position));
  await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>!doorOpen&&currentState===ELEVATOR_STATE.IDLE&&!gsap.isTweening(carDoorL.position));
 }
 await page.evaluate(()=>{const ud=mrGrp.userData;controls.enableDamping=false;controls.target.set(0,ud.mainY,ud.mainZ);camera.position.set(3,ud.mainY+1.5,ud.mainZ+3);controls.update();});
 await page.screenshot({path:path.join(out,'sheaves.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
