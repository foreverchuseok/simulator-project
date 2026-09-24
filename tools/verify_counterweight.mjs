// 균형추 GLB(counterweight.glb) + 카 상부 슈 상자형 오일통 — 레일 간섭·슈 홈·오일통 펠트 접촉·카↔균형추 간극·스크린샷.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-counterweight');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],consoleErrors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});const page=await browser.newPage({viewport:{width:1100,height:850}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&cwtGrp.userData.model&&carGrp.userData.guideShoes?.length===4&&document.getElementById('loading').classList.contains('hide'));
 const r=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const md=cwtGrp.userData.model,v=new THREE.Vector3(),cz=cwtGrp.position.z;
  const verts=(obj,fn)=>obj.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);o.localToWorld(v);fn(v,o);}});
  const model=cwtGrp.getObjectByName('counterweightModel');
  // 8K 레일 날: |x| ∈ [tip, tip+26mm], |z-cz| ≤ 4.5mm (guide_rail.py 제원)
  const bladeHalf=.0045;let inBlade=[],maxFrameX=0,minShoeSlot=Infinity,feltGap=Infinity;
  verts(model,(p,o)=>{
   const ax=Math.abs(p.x),dz=Math.abs(p.z-cz);
   if(ax>md.railTipX+1e-4&&ax<md.railTipX+.026&&dz<bladeHalf-1e-4)inBlade.push(o.name);
   if(/^Frame/.test(o.name))maxFrameX=Math.max(maxFrameX,ax);
   if(o.name==='GuideShoes'&&ax>md.railTipX)minShoeSlot=Math.min(minShoeSlot,dz);
   if(/OilerFelt/.test(o.name))feltGap=Math.min(feltGap,Math.abs(ax-md.railTipX));
  });
  const names=[];model.traverse(o=>{if(o.isMesh)names.push(o.name);});
  // 카 상부 슈 오일통: 다른 카 부품 정점이 오일통 몸통 AABB 안에 있는지
  const hits=[];let carOilers=0;
  for(const shoe of carGrp.userData.guideShoes.filter(s=>s.userData.isUpper)){
   const oil=shoe.getObjectByName('OilerBody');carOilers++;
   const box=new THREE.Box3().setFromObject(oil).expandByScalar(-.001);
   carGrp.traverse(o=>{if(!o.isMesh||!o.visible)return;let q=o;while(q&&q!==shoe)q=q.parent;if(q===shoe)return;
    const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);o.localToWorld(v);if(box.containsPoint(v)){hits.push(o.name||o.geometry.type);break;}}});
  }
  const carBack=new THREE.Box3().setFromObject(carGrp).min.z,cwtFront=new THREE.Box3().setFromObject(model).max.z;
  return {spec:md,meshes:names.length,names,inBlade:[...new Set(inBlade)],railClear:md.railTipX-maxFrameX,
   shoeSlotHalf:minShoeSlot,feltGap,carOilers,carOilerHits:[...new Set(hits)],carToCwtGap:carBack-cwtFront};
 });
 console.log(JSON.stringify(r));
 assert.deepEqual(r.inBlade,[]);assert.ok(r.railClear>.01,'frame near rail');
 assert.ok(r.shoeSlotHalf>.0045&&r.shoeSlotHalf<.006,'shoe slot');assert.ok(r.feltGap<.002,'felt off rail');
 assert.equal(r.carOilers,2);assert.deepEqual(r.carOilerHits,[]);assert.ok(r.carToCwtGap>.02,'car hits cwt');
 const shot=async(name,cam,tgt)=>{
  await page.evaluate(([cam,tgt])=>{controls.enableDamping=false;wallGrp.visible=false;camera.position.set(...cam);controls.target.set(...tgt);controls.update();},[cam,tgt]);
  await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);renderer.render(scene,camera);});
  await page.screenshot({path:path.join(out,name+'.png')});
 };
 const p=await page.evaluate(()=>({y:cwtGrp.position.y,z:cwtGrp.position.z,h:S.CWT_H/2,cy:carGrp.position.y+S.CAR_H/2+.43,cz:CAR_CTR_Z,bx:S.CAR_BG/2}));
 await shot('cwt-front',[1.1,p.y+.7,p.z+1.7],[0,p.y,p.z]);
 await shot('cwt-shoe-side',[1.3,p.y-p.h+.35,p.z+.5],[.63,p.y-p.h+.1,p.z]);
 await shot('cwt-top-shoe',[1.25,p.y+p.h+.2,p.z+.45],[.63,p.y+p.h-.03,p.z]);
 await shot('cwt-top-right',[.35,p.y+p.h+.25,p.z+.55],[.6,p.y+p.h,p.z]);
 await shot('cwt-bottom-left',[-.35,p.y-p.h+.2,p.z+.55],[-.6,p.y-p.h+.07,p.z]);
 await shot('cwt-numbers',[-.35,p.y+.25,p.z+.6],[-.57,p.y+.2,p.z]);
 await shot('car-oiler',[-p.bx+.45,p.cy+.35,p.cz+.45],[-p.bx+.06,p.cy+.1,p.cz+.04]);
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors.filter(e=>/Counterweight|counterweight|guide/i.test(e)),[]);
 console.log('OK',JSON.stringify({errors,consoleErrors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
