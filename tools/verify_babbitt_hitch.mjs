// 주로프 5본 바빗 히치(카·균형추) — 로프 끝 ↔ 소켓 정렬, 7홀 배치, 빔 관통 간극, 운행 추종, 근접 스크린샷.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-babbitt-hitch');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&ropeObjs.length===5&&cwtGrp.userData.model&&document.getElementById('loading').classList.contains('hide'));
 const check=()=>page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const v=new THREE.Vector3(),top=new THREE.Vector3(),bot=new THREE.Vector3();
  const endpoints=m=>{m.updateMatrixWorld(true);top.set(0,.5,0);bot.set(0,-.5,0);m.localToWorld(top);m.localToWorld(bot);return [top.clone(),bot.clone()];};
  const socketTop=(grp,i)=>{const h=grp.userData.hitch,[x,z]=h.holes[i-1];return grp.localToWorld(new THREE.Vector3(x,h.ropeEndY,z));};
  const car=carGrp.getObjectByName('carRopeHitch'),cwt=cwtGrp.getObjectByName('cwtRopeHitch');
  let carErr=0,cwtErr=0,sheaveErr=0,maxLean=0;const shape=wireRopeShape;
  ropeObjs.forEach((r,i)=>{
   const [ct,cb]=endpoints(r.carDrop),[wt,wb]=endpoints(r.cwtDrop);
   carErr=Math.max(carErr,cb.distanceTo(socketTop(car,i+1)));
   cwtErr=Math.max(cwtErr,wb.distanceTo(socketTop(cwt,i+1)));
   sheaveErr=Math.max(sheaveErr,ct.distanceTo(v.set(r.rx,shape.carTopY,shape.carTopZ)),wt.distanceTo(v.set(r.rx,shape.cwtTopY,shape.cwtTopZ)));
   maxLean=Math.max(maxLean,Math.atan2(Math.hypot(ct.x-cb.x,ct.z-cb.z),ct.y-cb.y)*180/Math.PI);
  });
  // 로드가 크로스헤드 C채널 웹(카 로컬 |z| 0.083~0.097)을 침범하지 않는지
  let webClear=Infinity;
  const ch=car.userData.hitch;for(const [,z] of ch.holes)webClear=Math.min(webClear,.083-Math.abs(z)-ch.rodR);
  // 스프링 영역과 다른 카 부품 간섭(히치 자신·크로스헤드 제외)
  const springBox=new THREE.Box3();for(const [x,z] of ch.holes)springBox.union(new THREE.Box3(car.localToWorld(new THREE.Vector3(x-ch.springR,ch.springBot,z-ch.springR)),car.localToWorld(new THREE.Vector3(x+ch.springR,ch.springTop,z+ch.springR))));
  const hits=[];carGrp.traverse(o=>{if(!o.isMesh||!o.visible)return;let p=o;while(p&&p!==car)p=p.parent;if(p===car)return;
   // 정적 배치·긴 배선은 AABB 가 커서 정점 단위로 본다.
   const pos=o.geometry.attributes.position;let n=0;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);o.localToWorld(v);if(springBox.containsPoint(v))n++;}
   if(n)hits.push((o.name||o.geometry.type)+':'+n);});
  const md=cwtGrp.userData.model,cwtBlkTop=S.CWT_H/2-md.topBeamH-md.hitchGap; // counterweight.glb 웨이트 최상단
  const hitchMeshes=[car,cwt].map(g=>{let n=0;g.traverse(o=>{if(o.isMesh)n++;});return n;});
  return {hitchMeshes,carErr,cwtErr,sheaveErr,maxLean,webClear,springHits:hits,cwtTailGap:cwt.userData.hitch.rodBot-cwtBlkTop,
   carTopZvsCtr:shape.carTopZ-CAR_CTR_Z,cwtTopZvsCwt:shape.cwtTopZ-cwtGrp.position.z,holes:car.userData.hitch.holes};
 });
 const r0=await check();console.log('FLOOR1',JSON.stringify(r0));
 for(const k of ['carErr','cwtErr','sheaveErr'])assert.ok(r0[k]<1e-5,k+' '+r0[k]);
 assert.ok(r0.webClear>0,'rod hits crosshead web');assert.deepEqual(r0.springHits,[]);assert.ok(r0.cwtTailGap>0.005);
 assert.ok(Math.abs(r0.carTopZvsCtr)<1e-6&&Math.abs(r0.cwtTopZvsCwt)<1e-6);
 const shot=async(name,cam,tgt,hide=[])=>{
  await page.evaluate(([cam,tgt,hide])=>{controls.enableDamping=false;hide.forEach(n=>{const o=eval(n);if(o)o.visible=false;});
   camera.position.set(...cam);controls.target.set(...tgt);controls.update();},[cam,tgt,hide]);
  await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);renderer.render(scene,camera);});
  await page.screenshot({path:path.join(out,name+'.png')});
 };
 const p=await page.evaluate(()=>({cy:carGrp.position.y+S.CAR_H/2+.5,cz:CAR_CTR_Z,wy:cwtGrp.position.y+S.CWT_H/2+.1,wz:cwtGrp.position.z}));
 await shot('car-front',[.55,p.cy+.12,p.cz+.75],[0,p.cy-.02,p.cz],['wallGrp']);
 await shot('car-top',[.02,p.cy+.9,p.cz+.05],[0,p.cy-.1,p.cz],['wallGrp']);
 await shot('car-under',[.5,p.cy-.45,p.cz+.6],[0,p.cy-.28,p.cz],['wallGrp']);
 await shot('cwt',[.6,p.wy+.15,p.wz+.8],[0,p.wy,p.wz],['wallGrp']);
 await shot('cwt-top',[.02,p.wy+1.0,p.wz+.05],[0,p.wy,p.wz],['wallGrp']);
 const m=await page.evaluate(()=>{const u=mrGrp.userData;return {y:u.mainY,z:u.mainZ,dy:u.defY,dz:u.defCenterZ};});
 await shot('sheave-car-side',[.9,m.y-.25,m.z+1.1],[0,m.y-.35,m.z+.3],['wallGrp']);
 await shot('sheave-cwt-side',[.9,m.dy-.3,m.dz-1.0],[0,m.dy-.4,m.dz-.2],['wallGrp']);
 for(const target of [3,0]){
  await page.waitForFunction(()=>!moving&&!doorOpen);
  await page.evaluate(t=>moveElevator(t),target);await page.waitForFunction(t=>curFloor===t&&!moving,target);
  const r=await check();console.log('FLOOR',target+1,JSON.stringify({carErr:r.carErr,cwtErr:r.cwtErr,sheaveErr:r.sheaveErr,maxLean:r.maxLean}));
  for(const k of ['carErr','cwtErr','sheaveErr'])assert.ok(r[k]<1e-5,k+' '+r[k]);
  await page.waitForFunction(()=>doorOpen);await page.evaluate(()=>closeDoors());
  await page.waitForFunction(()=>!doorOpen&&currentState===ELEVATOR_STATE.IDLE);
 }
 assert.deepEqual(errors,[]);console.log('OK',JSON.stringify({errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
