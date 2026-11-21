// 기본 시점에서 어느 조립체가 그리기 호출을 쓰는지 나눈다 (2026-11-21 최적화 4단계 근거).
// node tools/inspect_draw_calls.mjs [--desktop]   → temporary/fps/draw-calls-<mobile|desktop>.json
// 호출 수 = 카메라 절두체 안의 보이는 메시 × 재질 그룹. 그림자 = castShadow 메시(그림자 갱신 프레임마다 추가).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const desktop=process.argv.includes('--desktop');
const root=process.cwd(),out=path.join(root,'temporary/fps');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});
try{
  const page=await browser.newPage(desktop?{viewport:{width:1280,height:850}}:{viewport:{width:384,height:701},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});
  page.setDefaultTimeout(120000);
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?fps`,{waitUntil:'load'});
  await page.waitForFunction(()=>govHandles()?.ready&&ControlPanel.ready&&carGrp.userData.safetyGear?.wedges.length===4&&hatchDoors.every(h=>h.interlock?.ready)&&document.getElementById('loading').classList.contains('hide'));
  await page.waitForTimeout(3000);
  const result=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    const label=o=>{const chain=[];for(let p=o;p&&p!==scene;p=p.parent)chain.unshift(p.name||p.type);return chain;};
    const groups=new Map();let total=0,shadow=0;
    // js/screen-cull.js 와 같은 기준: 경계구 지름 2장치픽셀 미만은 메인 목록에서 빠진다.
    const size=renderer.getDrawingBufferSize(new THREE.Vector2()),limit=2/(size.y*camera.projectionMatrix.elements[5]),fwd=camera.getWorldDirection(new THREE.Vector3()),sph=new THREE.Sphere();
    const culled=o=>{if(ScreenCull.off||!o.isMesh||!o.frustumCulled||o.isInstancedMesh||o.isSkinnedMesh)return false;o.geometry.boundingSphere||o.geometry.computeBoundingSphere();sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);const z=sph.center.clone().sub(camera.position).dot(fwd);return z>0&&sph.radius<limit*z;};
    scene.traverse(o=>{
      if(!(o.isMesh||o.isLine||o.isPoints)||!visible(o)||culled(o))return;
      const mats=[].concat(o.material).filter(m=>m.visible!==false);
      const calls=Array.isArray(o.material)?o.geometry.groups.filter(g=>o.material[g.materialIndex]?.visible!==false).length:(mats.length?1:0);
      if(!calls)return;
      const chain=label(o),key=chain.slice(0,2).join(' / '),key3=chain.slice(0,3).join(' / ');
      const inView=!o.frustumCulled||frustum.intersectsObject(o);
      const g=groups.get(key)||{key,calls:0,meshes:0,shadowCasters:0,tris:0,materials:new Set(),sub:new Map()};
      if(inView){g.calls+=calls;g.meshes++;total+=calls;const idx=o.geometry.index;g.tris+=Math.round((idx?idx.count:o.geometry.attributes.position.count)/3);}
      if(o.castShadow){g.shadowCasters+=calls;shadow+=calls;}
      mats.forEach(m=>g.materials.add(m.uuid));
      if(inView)g.sub.set(key3,(g.sub.get(key3)||0)+calls);
      groups.set(key,g);
    });
    const list=[...groups.values()].map(g=>({key:g.key,calls:g.calls,meshes:g.meshes,shadowCasters:g.shadowCasters,triangles:g.tris,materials:g.materials.size,top:[...g.sub].sort((a,b)=>b[1]-a[1]).slice(0,6)})).sort((a,b)=>b.calls-a.calls);
    renderer.info.reset();renderer.render(scene,camera);
    return {estimatedCalls:total,shadowCasterCalls:shadow,measuredCalls:renderer.info.render.calls,camera:camera.position.toArray().map(v=>+v.toFixed(2)),groups:list};
  });
  const file=path.join(out,`draw-calls-${desktop?'desktop':'mobile'}.json`);
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  console.log(`추정 ${result.estimatedCalls} · 실측 ${result.measuredCalls} · 그림자 캐스터 ${result.shadowCasterCalls}`);
  for(const g of result.groups.slice(0,25))console.log(String(g.calls).padStart(5),String(g.shadowCasters).padStart(5),String(g.materials).padStart(4),g.key,'  ←',g.top.slice(0,3).map(([k,v])=>k.split(' / ').at(-1)+':'+v).join(', '));
  console.log('저장:',path.relative(root,file));
}finally{await browser.close();await new Promise(r=>server.close(r));}
