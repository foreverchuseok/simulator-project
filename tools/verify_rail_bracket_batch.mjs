// Same quality before/after; desktop measurements are not tablet performance results.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const label=process.argv[2]||'current';
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('Use an alphanumeric report label');
const root=process.cwd(),out=path.join(root,'.shot-render-performance');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 await page.addInitScript(()=>{let seed=20260918;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));
 const result=await page.evaluate(async()=>{
  const gltf=await new Promise((resolve,reject)=>new THREE.GLTFLoader().load('models/gltf/rail_bracket.glb',resolve,undefined,reject));
  gltf.scene.updateMatrixWorld(true);
  const source=new Map();gltf.scene.traverse(o=>{if(o.isMesh)source.set(o.name,o);});
  const brackets=railGrp.children.filter(o=>o.userData.type==='rail-bracket');
  let maxPositionError=0,maxNormalError=0,maxUVError=0,triangles=0,sourceTriangles=0;
  const point=new THREE.Vector3(),normal=new THREE.Vector3();
  source.forEach(o=>sourceTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3);
  for(const bracket of brackets){
   bracket.updateMatrixWorld(true);
   for(const mesh of bracket.children){
    const geo=mesh.geometry;triangles+=geo.index.count/3;
    for(const range of mesh.userData.sourceRanges){
     const original=source.get(range.name),g=original.geometry;
     if(original.material.name!==mesh.material.name)throw new Error('Material mismatch');
     const transform=bracket.matrixWorld.clone().multiply(original.matrixWorld);
     const normalMatrix=new THREE.Matrix3().getNormalMatrix(original.matrixWorld);
     for(let i=0;i<range.count;i++){
      const a=g.index?g.index.getX(i):i,b=geo.index.getX(range.start+i);
      point.fromBufferAttribute(g.attributes.position,a).applyMatrix4(transform);
      const actual=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,b).applyMatrix4(mesh.matrixWorld);
      maxPositionError=Math.max(maxPositionError,point.distanceTo(actual));
      normal.fromBufferAttribute(g.attributes.normal,a).applyMatrix3(normalMatrix).normalize();
      maxNormalError=Math.max(maxNormalError,normal.distanceTo(new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,b)));
      for(const axis of ['X','Y'])maxUVError=Math.max(maxUVError,Math.abs(g.attributes.uv['get'+axis](a)-geo.attributes.uv['get'+axis](b)));
     }
    }
   }
  }
  window.bracketReference=gltf.scene;window.bracketActual=brackets[0];return {brackets:brackets.length,meshes:brackets.map(b=>b.children.length),maxPositionError,maxNormalError,maxUVError,triangles,expectedTriangles:sourceTriangles*brackets.length};
 });
 await page.evaluate(()=>{
  scene.children.forEach(o=>{if(o!==railGrp&&!o.isLight)o.visible=false;});
  railGrp.children.forEach(o=>o.visible=o===bracketActual);
  const center=new THREE.Box3().setFromObject(bracketActual).getCenter(new THREE.Vector3());
  controls.enableDamping=false;controls.minDistance=.1;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.6,.3,.6));controls.update();
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.screenshot({path:path.join(out,'batch-detail.png')});
 await page.evaluate(()=>{
  bracketActual.visible=false;bracketReference.position.copy(bracketActual.position);bracketReference.rotation.copy(bracketActual.rotation);
  bracketReference.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});railGrp.add(bracketReference);
 });
 await page.screenshot({path:path.join(out,'source-detail.png')});
 assert.equal(result.brackets,6);assert.ok(result.meshes.every(n=>n===5));
 assert.ok(result.maxPositionError<1e-6);assert.ok(result.maxNormalError<1e-6);assert.equal(result.maxUVError,0);assert.equal(result.triangles,result.expectedTriangles);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}