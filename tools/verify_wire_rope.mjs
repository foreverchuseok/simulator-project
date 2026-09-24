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
  // 시브 감김 호는 5본 공유 정적 튜브, 카·균형추 하강부만 로프별로 갱신된다.
  const cy0=carGrp.position.y,wy0=cwtGrp.position.y,wz0=cwtGrp.position.z;
  const geometry=ropeObjs[0].line.geometry,position=geometry.attributes.position,version=position.version;
  const s=wireRopeShape,top=new THREE.Vector3(),bot=new THREE.Vector3();
  let maxEndError=0,maxTopError=0,staticArc=true,reused=true,poses=0;
  try{
   for(let k=0;k<=24;k++){
    const y=FLOOR_Y[0]+S.CAR_H/2-.35+(FLOOR_Y.at(-1)-FLOOR_Y[0]+.7)*k/24;
    carGrp.position.y=y;cwtGrp.position.y=wy0+cy0-y;
    refreshRopes();scene.updateMatrixWorld(true);poses++;
    staticArc&&=position.version===version;
    for(const r of ropeObjs){
     reused&&=r.line.geometry===geometry;
     for(const [d,ey,ez,ty,tz] of [[r.carDrop,y+S.CAR_H/2+CAR_ROPE_END_DY,CAR_CTR_Z,s.carTopY,s.carTopZ],
                                   [r.cwtDrop,cwtGrp.position.y+S.CWT_H/2+CWT_ROPE_END_DY,cwtGrp.position.z,s.cwtTopY,s.cwtTopZ]]){
      top.set(0,.5,0);bot.set(0,-.5,0);d.localToWorld(top);d.localToWorld(bot);
      maxEndError=Math.max(maxEndError,bot.distanceTo(new THREE.Vector3(r.hx,ey,ez+r.hz)));
      maxTopError=Math.max(maxTopError,top.distanceTo(new THREE.Vector3(r.rx,ty,tz)));
     }
    }
   }
  }finally{carGrp.position.y=cy0;cwtGrp.position.y=wy0;cwtGrp.position.z=wz0;refreshRopes();}
  const uv=ropeObjs[0].carDrop.geometry.attributes.uv,uvVersion=uv.version;refreshRopes();const stationaryUploadSkipped=uv.version===uvVersion;
  return {poses,ropes:ropeObjs.length,maxEndError,maxTopError,staticArc,reused,stationaryUploadSkipped};
 });
 assert.equal(result.ropes,5);assert.equal(result.poses,25);
 assert.ok(result.maxEndError<1e-6,JSON.stringify(result));assert.ok(result.maxTopError<1e-6,JSON.stringify(result));
 for(const key of ['staticArc','reused','stationaryUploadSkipped'])assert.equal(result[key],true,key);
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
