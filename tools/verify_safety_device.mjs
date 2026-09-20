import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-safety-device');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:800}});
 console.log('browser ready');page.setDefaultTimeout(45000);
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>carGrp?.userData.safetyGear?.shaft&&carGrp.userData.guideShoes?.length===4);
 console.log('model ready');
 await page.evaluate(()=>{gsap.ticker.lagSmoothing(0);controls.minDistance=0.02;controls.maxPolarAngle=Math.PI;controls.enableDamping=false;renderer.setPixelRatio(1);});
 const data=await page.evaluate(()=>{
  const lk=carGrp.userData.safetyLinkage,sg=carGrp.userData.safetyGear,d=lk.dimensions;
  const cam=carGrp.getObjectByName('safetySwitchCamProfile'),roller=carGrp.getObjectByName('safetySwitchRoller');
  const border=cam.geometry.parameters.shapes.getPoints(120);
  const reports=[];let bars=0;carGrp.traverse(o=>{if(o.name==='safetyCrossRod')bars++;});
  for(let i=0;i<=100;i++){
   const p=i/100;sg.shaft.rotation.x=SG_TRIP_ROT*p;refreshCarSafetyLinkage();scene.updateMatrixWorld(true);
   const q=lk.pose(p),length=Math.hypot(q.ix-q.ox,q.iy-q.oy);
   const input=carGrp.getObjectByName('safetyGovernorLever');const output=carGrp.getObjectByName('safetySwitchCam');
   const errs=lk.followers.map(f=>{
    const g=f.tag==='R'?input:output,sign=f.tag==='R'?1:-1;
    const pin=carGrp.worldToLocal(g.localToWorld(new THREE.Vector3(sign*d.outputR,0,0.054)));
    return {tag:f.tag,y:Math.abs(pin.y-(f.py+f.lift.position.y)),x:Math.abs(pin.x-f.px),z:Math.abs(pin.z-f.z)};
   });
   const railHalf=carGrp.getObjectByName('SafetyGear').userData.railHalfWidth;
   const gaps=sg.wedges.map(w=>{
    w.geometry.computeBoundingBox();const b=w.geometry.boundingBox;
    return w.userData.railFace<0?d.railZ-railHalf-(w.position.z+b.max.z):(w.position.z+b.min.z)-(d.railZ+railHalf);
   });
   const upperGap=Math.min(...[sg.liftL,sg.liftR].map(l=>d.capTopY-0.026-(new THREE.Box3().setFromObject(l).max.y-carGrp.position.y)));
   const rp=cam.worldToLocal(roller.getWorldPosition(new THREE.Vector3()));
   let edgeDistance=Infinity,inside=false;
   for(let j=0,k=border.length-1;j<border.length;k=j++){
    const a=border[k],b=border[j],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((rp.x-a.x)*dx+(rp.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    edgeDistance=Math.min(edgeDistance,Math.hypot(rp.x-a.x-t*dx,rp.y-a.y-t*dy));
    if((a.y>rp.y)!==(b.y>rp.y)&&rp.x<(b.x-a.x)*(rp.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
   }
   const spring=carGrp.getObjectByName('safetyReturnSpring');
   reports.push({p,length,gaps,upperGap,liftR:sg.liftR.position.y,liftL:sg.liftL.position.y,errs,spring:carGrp.getObjectByName('safetyReturnSpring').scale.x,
    rollerGap:(inside?-edgeDistance:edgeDistance)-roller.geometry.parameters.radiusTop,
    armAngle:lk.swArm.rotation.z,springCoilGap:spring.userData.restLength*spring.scale.x/spring.userData.turns-spring.userData.wireDiameter,
    finite:sg.wedges.every(w=>Number.isFinite(w.position.z)),clamp:carGrp.userData.govClamp.y});
  }
  sg.shaft.rotation.x=0;refreshCarSafetyLinkage();
  const top=carGrp.getObjectByName('carTopBox'),wire=carGrp.getObjectByName('safetySwitchHarness');
  const end=new THREE.Vector3(...top.userData.entries.safety);
  const shoeClearances=carGrp.userData.guideShoes.map(mount=>{
   const model=mount.children[0],meta=model.getObjectByName('GuideShoeRoot').userData,meshes=[];
   model.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
   const ray=new THREE.Raycaster(),hits=[];
   for(let i=0;i<9;i++)for(let j=0;j<9;j++){
    const origin=model.localToWorld(new THREE.Vector3(0.035+(meta.railTip-0.035-0.00005)*i/8,-0.03,(-1+j/4)*(meta.railHalfWidth-0.00005)));
    ray.set(origin,new THREE.Vector3(0,1,0).transformDirection(model.matrixWorld));ray.far=0.30;
    ray.intersectObjects(meshes,false).forEach(h=>hits.push(h.object.name));
   }
   return {name:mount.name,hits:[...new Set(hits)]};
  });
  return {bars,shaftChildren:sg.shaft.children.length,reports,rodLength:lk.rodLength,pivotX:d.pivotX,wedges:sg.wedges.length,
   shoeClearances,
   harnessError:end.distanceTo(new THREE.Vector3(...wire.userData.endpoint)),
   lowerShoes:carGrp.userData.guideShoes.filter(s=>!s.userData.isUpper).map(s=>s.getObjectByName('GuideShoeRoot').userData.lowerDesign),
   springMeshes:sg.springs.reduce((n,s)=>{s.traverse(o=>{if(o.isMesh)n++;});return n;},0),
   switchX:carGrp.getObjectByName('safetyLimitSwitch').children[0].position.x,govX:carGrp.userData.govClamp.x};
 });
 assert.equal(data.bars,1);assert.equal(data.shaftChildren,0);assert.ok(data.switchX<0&&data.govX>0);
 assert.equal(data.wedges,4);assert.equal(data.springMeshes,0);assert.ok(data.harnessError<1e-8);
 for(const shoe of data.shoeClearances)assert.deepEqual(shoe.hits,[],JSON.stringify(shoe));
 assert.deepEqual(data.lowerShoes,['enclosed-yellow-zinc','enclosed-yellow-zinc']);
 for(const r of data.reports)for(const gap of r.gaps)assert.ok(gap>=-1e-7,JSON.stringify(r));
 for(const r of data.reports)assert.ok(r.upperGap>0.001,JSON.stringify(r));
 for(const gap of data.reports.at(-1).gaps)assert.ok(Math.abs(gap)<1e-7);
 assert.ok(Math.abs(data.reports[0].rollerGap)<0.0005,JSON.stringify(data.reports[0]));
 for(const r of data.reports){assert.ok(r.rollerGap>=-0.0005,JSON.stringify(r));assert.ok(r.springCoilGap>0,JSON.stringify(r));}
 assert.ok(Math.abs(data.reports.at(-1).armAngle+Math.PI/2)<1e-8);
 for(const r of data.reports){assert.ok(Math.abs(r.length-data.rodLength)<1e-9);assert.ok(r.finite);assert.ok(r.spring>0);for(const e of r.errs){assert.ok(e.y<1e-7,JSON.stringify(e));assert.ok(e.z<1e-7);assert.ok(e.x<0.008);}}
 const travel=await page.evaluate(()=>{
  const y0=carGrp.position.y,cwt0=cwtGrp.position.y;
  const wire=carGrp.getObjectByName('safetySwitchHarness'),p0=wire.getWorldPosition(new THREE.Vector3());
  moveElevator(1);const t=gsap.getTweensOf(carGrp.position)[0];if(!t)throw Error('No movement tween');
  t.pause().progress(0.5);const halfway=carGrp.position.y;t.progress(1);
  const p1=wire.getWorldPosition(new THREE.Vector3());
  return {distance:carGrp.position.y-y0,halfway:halfway-y0,wireDistance:p1.y-p0.y,cwtDistance:cwtGrp.position.y-cwt0,arrived:curFloor===1&&!moving};
 });
 assert.ok(travel.arrived&&travel.halfway>0);assert.ok(Math.abs(travel.distance-travel.wireDistance)<1e-8);
 assert.ok(Math.abs(travel.distance+travel.cwtDistance)<1e-8);
 const focus=async(name,p,offset,target)=>{
  await page.evaluate(({p,offset,target})=>{
   const sg=carGrp.userData.safetyGear;sg.shaft.rotation.x=SG_TRIP_ROT*p;refreshCarSafetyLinkage();refreshGovernorRope();
   const t=carGrp.localToWorld(new THREE.Vector3(...target));controls.target.copy(t);camera.position.copy(t).add(new THREE.Vector3(...offset));controls.update();
  },{p,offset,target});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,name+'.png')});
 };
 await focus('rear-rest',0,[0,-0.8,-3.3],[0,-1.34,-0.08]);
 await focus('rear-trip',1,[0,-0.8,-3.3],[0,-1.34,-0.08]);
 await focus('switch-rest',0,[0.18,-0.12,-0.46],[-1.14,-1.34,-0.09]);
 await focus('switch-trip',1,[0.18,-0.12,-0.46],[-1.14,-1.34,-0.09]);
 await focus('governor-link',0,[0.42,-0.18,-0.62],[1.26,-1.31,-0.18]);
 await focus('wedge-link',1,[-0.42,-0.15,-0.30],[1.23,-1.34,0.03]);
 await focus('underframe-installed',0,[2.5,-1.7,-3.3],[0,-1.20,0]);
 // 도면 비교용: 가이드레일·승강로를 숨긴 하부 사선 뷰. 앱의 실제 표시에는 영향 없다.
 await page.evaluate(()=>{
  scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
  scene.background=new THREE.Color(0xe3e8ea);
  // 피트 바닥 카메라 제한 위에서 설계도와 같은 하부 사선으로 확인한다.
  carGrp.position.y+=4;
 });
 await focus('underframe-reference',0,[2.5,-2.9,-3.3],[0,-1.25,0.05]);
 await focus('harness-to-top-box',0,[-2.4,0.5,2.7],[-0.9,0,0.25]);
 const drawing=await page.evaluate(()=>{
  const y=carGrp.position.y,ortho=new THREE.OrthographicCamera(-2.25,2.25,1.40625,-1.40625,0.01,30);
  const target=carGrp.localToWorld(new THREE.Vector3(0,-S.CAR_H/2,0.05));
  ortho.position.copy(target).add(new THREE.Vector3(3,-4,-4));ortho.lookAt(target);
  // 카 하부만 보이도록 잘라낸 검증용 도면 뷰.
  renderer.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),y-S.CAR_H/2+0.38)];
  renderer.render(scene,ortho);const png=renderer.domElement.toDataURL('image/png').split(',')[1];
  renderer.clippingPlanes=[];return png;
 });
 fs.writeFileSync(path.join(out,'underframe-design.png'),Buffer.from(drawing,'base64'));
 await focus('lower-guide-shoe',0,[-0.25,-0.05,-0.30],[1.22,-1.57,0.04]);
 await page.evaluate(()=>{
   const keep=new Set(['carSafetyGear','carSafetyLinkage','CarGuideShoe_L_Lower','CarGuideShoe_R_Lower']);
   carGrp.traverse(o=>{if(o.isMesh||o.isLine){let p=o,retain=false;while(p&&p!==carGrp){if(keep.has(p.name))retain=true;p=p.parent;}if(!retain)o.visible=false;}});
 });
 await focus('mechanism-cutaway',1,[-0.35,-0.16,-0.55],[1.24,-1.32,-0.02]);
 await focus('paired-wedges-rest',0,[-0.48,-0.10,-0.28],[1.24,-1.34,0.04]);
 await focus('paired-wedges-trip',1,[-0.48,-0.10,-0.28],[1.24,-1.34,0.04]);
 const dynamic=await page.evaluate(async()=>{
  const sg=carGrp.userData.safetyGear;sg.shaft.rotation.x=0;refreshCarSafetyLinkage();
  const y0=carGrp.position.y+carGrp.userData.govClamp.y,button=document.createElement('button');const samples=[];
  const sample=()=>samples.push(carGrp.position.y+carGrp.userData.govClamp.y-y0);
  gsap.ticker.add(sample);engageDeviceStop(1,button);await new Promise(r=>setTimeout(r,1050));gsap.ticker.remove(sample);
  const trip={angle:sg.shaft.rotation.x,liftL:sg.liftL.position.y,liftR:sg.liftR.position.y,closed:carGrp.getObjectByName('safetyLimitSwitch').userData.contactClosed};
  const govTrip=governorTrip(1);if(!govTrip)throw Error('Governor trip unavailable');govTrip.progress(1);
  await new Promise((resolve,reject)=>{const reset=governorReset(resolve);if(!reset)reject(Error('Governor reset unavailable'));else reset.progress(1);});
  return {maxClampYError:Math.max(...samples.map(Math.abs)),trip,rest:{angle:sg.shaft.rotation.x,liftL:sg.liftL.position.y,liftR:sg.liftR.position.y,closed:carGrp.getObjectByName('safetyLimitSwitch').userData.contactClosed}};
 });
 assert.ok(dynamic.maxClampYError<1e-5,JSON.stringify(dynamic));assert.ok(dynamic.trip.liftL>0.015&&dynamic.trip.liftR>0.015);assert.equal(dynamic.trip.closed,false);assert.ok(Math.abs(dynamic.rest.liftL)<1e-8);assert.ok(Math.abs(dynamic.rest.liftR)<1e-8);assert.equal(dynamic.rest.closed,true);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({data,travel,dynamic,errors},null,2));
 console.log(JSON.stringify({bars:data.bars,shaftChildren:data.shaftChildren,states:data.reports.length,dynamic,errors}));
}finally{await browser?.close();server.close();}
