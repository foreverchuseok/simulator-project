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
 await page.route('**/index.html',route=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const probe=`
    window.railSources=new Map();
    const originalBatch=batchGuideRailFasteners;
    batchGuideRailFasteners=function(source){
      source.traverse(o=>{if(/^GuideRail_(13K|8K)_Root$/.test(o.name))railSources.set(o.name,o.clone(true));});
      originalBatch(source);
    };
    init();`;
  assert.ok(html.includes('    init();'));return route.fulfill({contentType:'text/html',body:html.replace('    init();',probe)});
 });
 const session=await page.context().newCDPSession(page);await session.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide')&&railSources.size===2);
 const result=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);
  const roots=[];railGrp.traverse(o=>{if(railSources.has(o.name))roots.push(o);});
  let maxPositionError=0,maxNormalError=0,maxUVError=0,triangles=0,expectedTriangles=0,meshes=0,sourceMeshes=0,topSegments=0,railBodies=0,sharedPairs=0;
  const p=new THREE.Vector3(),q=new THREE.Vector3(),n=new THREE.Vector3(),m=new THREE.Vector3();
  const references=[];
  for(const current of roots){
   const reference=railSources.get(current.name).clone(true);
   reference.position.copy(current.position);reference.quaternion.copy(current.quaternion);reference.scale.copy(current.scale);
   const body=current.children.find(o=>o.name.startsWith('T_Rail_'));
   if(!body)throw new Error('Missing named rail body');railBodies++;
   const top=body.scale.y!==1;if(top)topSegments++;
   reference.traverse(o=>{if(o.name.startsWith('T_Rail_'))o.scale.copy(body.scale);else if(top&&o.name.startsWith('FP_'))o.visible=false;});
   reference.updateMatrixWorld(true);
   const originals=new Map();reference.traverse(o=>{if(o.isMesh){originals.set(o.name,o);sourceMeshes++;if(o.visible)expectedTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
   for(const actual of current.children){
    if(!actual.isMesh)continue;meshes++;
    const g=actual.geometry;if(actual.visible)triangles+=(g.index?.count||g.attributes.position.count)/3;
    if(actual.name.startsWith('FP_')&&actual.visible===top)throw new Error('Top fishplate visibility');
    const ranges=actual.userData.sourceRanges||[{name:actual.name,start:0,count:g.index?.count||g.attributes.position.count}];
    for(const range of ranges){
     const original=originals.get(range.name);if(!original)throw new Error('Missing source '+range.name);
     if(original.material!==actual.material)throw new Error('Material changed');
     const transform=current.matrixWorld.clone().multiply(original.matrix);
     const aNormal=new THREE.Matrix3().getNormalMatrix(transform),bNormal=new THREE.Matrix3().getNormalMatrix(actual.matrixWorld);
     const src=original.geometry;
     for(let i=0;i<range.count;i++){
      const a=src.index?src.index.getX(i):i,b=g.index?g.index.getX(range.start+i):range.start+i;
      p.fromBufferAttribute(src.attributes.position,a).applyMatrix4(transform);q.fromBufferAttribute(g.attributes.position,b).applyMatrix4(actual.matrixWorld);
      maxPositionError=Math.max(maxPositionError,p.distanceTo(q));
      n.fromBufferAttribute(src.attributes.normal,a).applyMatrix3(aNormal).normalize();m.fromBufferAttribute(g.attributes.normal,b).applyMatrix3(bNormal).normalize();maxNormalError=Math.max(maxNormalError,n.distanceTo(m));
      if(src.attributes.uv)for(const axis of ['X','Y'])maxUVError=Math.max(maxUVError,Math.abs(src.attributes.uv['get'+axis](a)-g.attributes.uv['get'+axis](b)));
     }
    }
   }
   references.push({current,reference});
  }
  for(const kind of railSources.keys()){
   const parts=roots.filter(o=>o.name===kind).map(o=>o.children.find(m=>m.name.startsWith('FP_FastenerBatch_')));
   if(!parts.every(o=>o.geometry===parts[0].geometry&&o.material===parts[0].material))throw new Error('Segment geometry not shared');sharedPairs++;
  }
  window.railBatchReferences=references;
  return {segments:roots.length,topSegments,railBodies,sourceMeshes,meshes,sharedPairs,triangles,expectedTriangles,maxPositionError,maxNormalError,maxUVError};
 });
 assert.equal(result.segments,16);assert.equal(result.topSegments,4);assert.equal(result.railBodies,16);assert.equal(result.sharedPairs,2);
 assert.equal(result.sourceMeshes,416);assert.equal(result.meshes,48);assert.equal(result.triangles,result.expectedTriangles);
 assert.ok(result.maxPositionError<1e-6);assert.ok(result.maxNormalError<1e-6);assert.equal(result.maxUVError,0);
 await page.evaluate(()=>{
  const {current}=railBatchReferences[0],segment=current.parent,column=segment.parent;
  scene.children.forEach(o=>{if(o!==railGrp&&!o.isLight)o.visible=false;});
  railGrp.children.forEach(o=>{o.visible=o===column;});column.children.forEach(o=>{o.visible=o===segment;});
  const plate=current.children.find(o=>o.name.endsWith('_Plate'));
  const center=new THREE.Box3().setFromObject(plate).getCenter(new THREE.Vector3());
  controls.enableDamping=false;controls.minDistance=.1;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.35,.15,-.5));controls.update();
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.screenshot({path:path.join(out,label+'-rail-fasteners-batch.png')});
 await page.evaluate(()=>{const {current,reference}=railBatchReferences[0];current.visible=false;current.parent.add(reference);});
 await page.screenshot({path:path.join(out,label+'-rail-fasteners-source.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,label+'-rail-fasteners.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}