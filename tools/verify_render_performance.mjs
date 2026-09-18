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
 const settings=await page.evaluate(()=>{
  // Record quality without disabling background, shadows or detail.
  const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  window.ropePerfSaved={camera:camera.position.clone(),target:controls.target.clone()};
  window.ropePerfStats=values=>{const s=[...values].sort((a,b)=>a-b);return {samples:s.length,medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.min(s.length-1,Math.floor(s.length*.95))]};};
  window.ropePerfSample=async seconds=>{
   const values=[];let last=await new Promise(requestAnimationFrame),start=last;
   while(last-start<seconds*1000){const now=await new Promise(requestAnimationFrame);values.push(now-last);last=now;}
   return {...ropePerfStats(values),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  };
  return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,camera:camera.position.toArray(),target:controls.target.toArray()};
 });
 const inventory=await page.evaluate(()=>scene.children.map(root=>{let meshes=0;const materials=new Set();root.traverse(o=>{if(o.isMesh){meshes++;for(const m of [].concat(o.material))materials.add(m.uuid);}});return {name:root.name||(root===railGrp?'railGrp':root===mrGrp?'mrGrp':root.type),examples:root.children.slice(0,6).map(o=>o.name||o.type),meshes,materials:materials.size};}).sort((a,b)=>b.meshes-a.meshes));
 const runs=[];
 const detailed=process.argv.includes('--detailed');
 const modes=detailed?['baseline','no-grass','no-shadows','no-background','no-ground','baseline']:['baseline','no-background','no-ground','no-shadows','baseline'];
 for(let repeat=0;repeat<(detailed?3:1);repeat++)for(const mode of modes){
  const result=await page.evaluate(async mode=>{
   const bg=scene.getObjectByName('outdoorBackground'),ground=scene.getObjectByName('outdoorGround');
   const saved=[bg.visible,ground.visible,renderer.shadowMap.enabled];
   const grass=ground.children.filter(o=>o.userData.type==='grass-blade-inst');
   const grassVisibility=grass.map(o=>o.visible);
   if(mode==='no-background')bg.visible=false;
   if(mode==='no-ground')ground.visible=false;
   if(mode==='no-shadows')renderer.shadowMap.enabled=false;
   if(mode==='no-grass')grass.forEach(o=>{o.visible=false;});
   await ropePerfSample(1);const result=await ropePerfSample(4);
   [bg.visible,ground.visible,renderer.shadowMap.enabled]=saved;
   grass.forEach((o,i)=>{o.visible=grassVisibility[i];});return result;
  },mode);runs.push({repeat,mode,...result});console.log(JSON.stringify(runs.at(-1)));
 }
 await page.screenshot({path:path.join(out,label+'-overview.png')});
 await page.evaluate(()=>{const b=railGrp.children.find(o=>o.userData.type==='rail-bracket');const box=new THREE.Box3().setFromObject(b),center=box.getCenter(new THREE.Vector3());controls.enableDamping=false;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.5,1));controls.update();});
 await page.screenshot({path:path.join(out,label+'-bracket.png')});
 const report={settings,inventory,runs,errors};fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(inventory.slice(0,15)));
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
