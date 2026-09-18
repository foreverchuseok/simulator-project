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
    window.staticBatchSources=[];
    const batchOriginal=batchStaticChildren;
    batchStaticChildren=function(parent,label){
      const children=[...parent.children];batchOriginal(parent,label);
      const removed=children.filter(m=>m.parent!==parent);
      const merged=parent.children.filter(m=>!children.includes(m));
      staticBatchSources.push({parent,label,removed,merged,retained:children.filter(m=>m.parent===parent)});
    };
    init();`;
  assert.ok(html.includes('    init();'));return route.fulfill({contentType:'text/html',body:html.replace('    init();',probe)});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));
 const result=await page.evaluate(()=>{
  let maxPositionError=0,maxNormalError=0,maxUVError=0,triangles=0,retained=true;
  const counts={};
  const actual=new THREE.Vector3(),expected=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  for(const set of staticBatchSources){
   const originals=new Map(set.removed.map(m=>[m.id,m]));
   counts[set.label]??={groups:0,before:0,after:0};const count=counts[set.label];
   count.groups++;count.before+=set.removed.length;count.after+=set.merged.length;
   retained&&=set.retained.every(m=>m.parent===set.parent);
   if(set.removed.some(m=>m.name||Object.keys(m.userData).length))throw new Error('Named part removed');
   let sourceCount=0;
   for(const m of set.removed)sourceCount+=m.geometry.index?.count||m.geometry.attributes.position.count;
   let mergedCount=0;
   for(const m of set.merged){
    const geo=m.geometry;mergedCount+=geo.index.count;
    for(const range of m.userData.sourceRanges){
     const original=originals.get(range.sourceId),g=original.geometry;
     if(original.material!==m.material||original.castShadow!==m.castShadow||original.receiveShadow!==m.receiveShadow)throw new Error('Material/shadow changed');
     normalMatrix.getNormalMatrix(original.matrix);
     for(let i=0;i<range.count;i++){
      const a=g.index?g.index.getX(i):i,b=geo.index.getX(range.start+i);
      expected.fromBufferAttribute(g.attributes.position,a).applyMatrix4(original.matrix);
      actual.fromBufferAttribute(geo.attributes.position,b);
      maxPositionError=Math.max(maxPositionError,actual.distanceTo(expected));
      expected.fromBufferAttribute(g.attributes.normal,a).applyMatrix3(normalMatrix).normalize();
      actual.fromBufferAttribute(geo.attributes.normal,b);maxNormalError=Math.max(maxNormalError,actual.distanceTo(expected));
      if(g.attributes.uv)for(const axis of ['X','Y'])maxUVError=Math.max(maxUVError,Math.abs(g.attributes.uv['get'+axis](a)-geo.attributes.uv['get'+axis](b)));
     }
    }
   }
   if(sourceCount!==mergedCount)throw new Error('Triangle count changed');triangles+=mergedCount/3;
  }
  window.showBatchReference=enabled=>{for(const set of staticBatchSources){for(const m of set.merged)m.visible=!enabled;for(const m of set.removed){if(enabled)set.parent.add(m);else set.parent.remove(m);}}};
  return {counts,maxPositionError,maxNormalError,maxUVError,triangles,retained};
 });
 assert.ok(result.maxPositionError<1e-6);assert.ok(result.maxNormalError<1e-6);assert.equal(result.maxUVError,0);assert.equal(result.retained,true);
 assert.equal(result.counts.sillSupport.groups,20);assert.equal(result.counts.jamb.groups,4);assert.equal(result.counts.carFrame.groups,1);
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
 for(const view of ['car','landing']){
  await page.evaluate(view=>{
   scene.children.forEach(o=>{if(!o.isLight)o.visible=view==='car'?o===carGrp:o===sillSupportGrp;});
   controls.enableDamping=false;controls.minDistance=.1;
   const y=carGrp.position.y;controls.target.set(0,view==='car'?y:FLOOR_Y[0]+1.2,view==='car'?CAR_CTR_Z:FRONT_WALL_INNER_Z);
   camera.position.copy(controls.target).add(new THREE.Vector3(4,view==='car'?2:.5,-5));controls.update();
  },view);
  for(const reference of [false,true]){
   await page.evaluate(reference=>{showBatchReference(reference);renderer.render(scene,camera);},reference);
   await page.screenshot({path:path.join(out,'static-'+view+(reference?'-source':'-batch')+'.png')});
  }
  await page.evaluate(()=>showBatchReference(false));
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'static-geometry.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}