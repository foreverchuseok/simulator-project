// Same quality before/after; desktop measurements are not tablet performance results.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const label=process.argv[2]||'current';
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('Use an alphanumeric report label');
const root=process.cwd(),out=path.join(root,'.shot-rope-performance');fs.mkdirSync(out,{recursive:true});
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
 // Warm initial shaders and asset uploads before measured samples.
 await page.evaluate(()=>ropePerfSample(2));
 const runs=[];
 for(let repeat=0;repeat<3;repeat++){
  const idle=await page.evaluate(()=>ropePerfSample(3));
  const orbit=await page.evaluate(async()=>{
   const offset=camera.position.clone().sub(controls.target),start=performance.now();
   const tick=()=>{const a=(performance.now()-start)*0.00025;camera.position.set(controls.target.x+offset.x*Math.cos(a)+offset.z*Math.sin(a),controls.target.y+offset.y,controls.target.z-offset.x*Math.sin(a)+offset.z*Math.cos(a));};
   gsap.ticker.add(tick);const result=await ropePerfSample(3);gsap.ticker.remove(tick);
   camera.position.copy(ropePerfSaved.camera);controls.target.copy(ropePerfSaved.target);controls.update();return result;
  });
  const target=repeat%2===0?3:0;
  await page.evaluate(target=>moveElevator(target),target);
  await page.waitForFunction(()=>moving);
  const moving=await page.evaluate(()=>ropePerfSample(5));
  await page.waitForFunction(target=>curFloor===target&&!moving,target);
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN&&!gsap.isTweening(carDoorL.position));
  await page.evaluate(()=>closeDoors());
  await page.waitForFunction(()=>!doorOpen&&currentState===ELEVATOR_STATE.IDLE&&!gsap.isTweening(carDoorL.position));
  runs.push({repeat,idle,orbit,moving});console.log('RUN',JSON.stringify(runs.at(-1)));
 }
 const rope=await page.evaluate(()=>{
  const cy=carGrp.position.y,wy=cwtGrp.position.y,geometries=ropeObjs.map(r=>r.line.geometry);
  let created=0;const Original=THREE.TubeGeometry;
  THREE.TubeGeometry=class extends Original{constructor(...args){super(...args);created++;}};
  const timings=[];
  try{for(let i=0;i<120;i++){
   const y=FLOOR_Y[0]+S.CAR_H/2+(FLOOR_Y[3]-FLOOR_Y[0])*i/119;
   carGrp.position.y=y;cwtGrp.position.y=wy+cy-y;
   const t=performance.now();refreshRopes();if(i>=20)timings.push(performance.now()-t);
  }}finally{THREE.TubeGeometry=Original;carGrp.position.y=cy;cwtGrp.position.y=wy;refreshRopes();}
  return {...ropePerfStats(timings),tubeGeometriesCreated:created,reused:ropeObjs.every((r,i)=>r.line.geometry===geometries[i])};
 });
 await page.screenshot({path:path.join(out,label+'.png')});
 assert.deepEqual(errors,[]);
 const report={label,settings,runs,rope,errors};fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
 console.log('RESULT',JSON.stringify({label,rope,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
