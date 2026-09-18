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
 const session=await page.context().newCDPSession(page);
 await session.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
 const result=await page.evaluate(()=>{
  const parts=[];scene.traverse(o=>{if(o.isMesh&&!['outdoorGround','outdoorBackground','skyDome'].some(name=>{let p=o;while(p){if(p.name===name)return true;p=p.parent;}return false;}))parts.push([o.uuid,o.visible]);});
  window.viewParts=parts;
  return {detailed:outdoorPresentation.detailed,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 });
 assert.equal(result.detailed,false);
 await page.screenshot({animations:'disabled',path:path.join(out,label+'-simple.png')});
 await page.click('[data-menu="dd-cam"]');
 await page.click('#c-background');
 await page.waitForFunction(()=>outdoorPresentation.detailed&&renderer.info.render.triangles>1500000);
 const detailed=await page.evaluate(()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
  lightingRestored:outdoorPresentation.lighting.every(e=>e.light.intensity===e.original)&&renderer.toneMappingExposure===outdoorPresentation.exposure}));
 assert.equal(detailed.lightingRestored,true);
 await page.screenshot({animations:'disabled',path:path.join(out,label+'-landscape.png')});
 await page.click('#c-background');
 await page.waitForFunction(()=>!outdoorPresentation.detailed&&renderer.info.render.triangles<1000000);
 for(const id of ['c-mr','c-pit','c-car','c-car-top','c-governor','c-shaft']){
  await page.click('#'+id);
  await page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  assert.equal(await page.getAttribute('#'+id,'aria-pressed'),'true');
  await page.screenshot({animations:'disabled',path:path.join(out,label+'-'+id+'.png')});
  if(id==='c-governor') {
   const before=await page.evaluate(()=>camera.position.distanceTo(controls.target));
   await page.mouse.dblclick(640,425,{delay:100});
   await page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
   assert.ok(await page.evaluate(()=>camera.position.distanceTo(controls.target))<before*.8,'Double click approaches visible geometry');
   await page.screenshot({path:path.join(out,label+'-focus.png')});
  }
 }
 const restored=await page.evaluate(()=>{
  for(let i=0;i<6;i++){setDetailedBackground(true);setDetailedBackground(false);}
  const actual=new Map();scene.traverse(o=>actual.set(o.uuid,o));
  return {partsUnchanged:viewParts.every(([id,visible])=>actual.get(id)?.visible===visible),state:currentState,near:camera.near,minDistance:controls.minDistance,detail:outdoorPresentation.detailed,
   studioRestored:outdoorPresentation.lighting.every(e=>e.light.intensity===e.studio)&&renderer.toneMappingExposure===outdoorPresentation.simpleExposure};
 });
 assert.equal(restored.partsUnchanged,true);assert.equal(restored.state,'IDLE');assert.equal(restored.near,.002);assert.equal(restored.minDistance,.04);
 assert.equal(restored.studioRestored,true);
 const mobile=await browser.newContext({viewport:{width:800,height:1280},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const tablet=await mobile.newPage();tablet.on('pageerror',e=>errors.push(e.message));
 await tablet.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await tablet.waitForFunction(()=>govHandles()?.ready&&document.getElementById('loading').classList.contains('hide'));
 await tablet.tap('[data-menu="dd-cam"]');
 for(const viewport of [{width:800,height:1280},{width:1280,height:800},{width:412,height:915}]){
  await tablet.setViewportSize(viewport);
  await tablet.tap('#c-governor');await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  await tablet.locator('#c-background').scrollIntoViewIfNeeded();await tablet.tap('#c-background');await tablet.tap('#c-background');
  const box=await tablet.locator('#dd-cam').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1&&box.y>=0&&box.y+box.height<=viewport.height+1);
  await tablet.screenshot({animations:'disabled',path:path.join(out,`${label}-touch-${viewport.width}.png`)});
  const before=await tablet.evaluate(()=>camera.position.distanceTo(controls.target));
  // Real multi-touch must remain a pinch, never a focus or emergency-key click.
  const touchSession=await mobile.newCDPSession(tablet);
  const x=viewport.width/2,y=viewport.height/2;
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-50,y,id:1},{x:x+50,y,id:2}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await tablet.evaluate(()=>gsap.getTweensOf(camera.position).length),0,'Pinch does not start focus');
  assert.equal(await tablet.evaluate(()=>hatchDoors.some(h=>h.keyRatio>0)),false,'Pinch does not turn a key');
  await tablet.tap('#c-governor');
  await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  await tablet.touchscreen.tap(viewport.width/2,viewport.height/2);
  await tablet.touchscreen.tap(viewport.width/2,viewport.height/2);
  await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  assert.ok(await tablet.evaluate(()=>camera.position.distanceTo(controls.target))<before*.8,'Double tap approaches visible geometry');
  await tablet.screenshot({path:path.join(out,`${label}-focus-touch-${viewport.width}.png`)});
 }
 await mobile.close();assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,label+'-views.json'),JSON.stringify({result,detailed,restored,errors},null,2));console.log(JSON.stringify({result,detailed,restored,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
