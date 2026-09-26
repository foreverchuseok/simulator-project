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
  const groundTop=new THREE.Box3().setFromObject(outdoorPresentation.floor).max.y;
  return {detailed:outdoorPresentation.detailed,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,groundGap:Y0-groundTop};
 });
 assert.equal(result.detailed,false);
 assert.ok(Math.abs(result.groundGap-.03)<1e-6,'Outdoor ground stays 30mm below the pit foundation');
 await page.screenshot({animations:'disabled',path:path.join(out,label+'-simple.png')});
 await page.click('[data-menu="dd-view"]');
 await page.click('#c-background');
 await page.waitForFunction(()=>outdoorPresentation.detailed&&outdoorPresentation.sky.visible);
 const detailed=await page.evaluate(()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
  lightingRestored:outdoorPresentation.lighting.every(e=>e.light.intensity===e.original)&&renderer.toneMappingExposure===outdoorPresentation.exposure}));
 assert.equal(detailed.lightingRestored,true);
 await page.screenshot({animations:'disabled',path:path.join(out,label+'-landscape.png')});
 await page.click('#c-background');
 await page.waitForFunction(()=>!outdoorPresentation.detailed&&!outdoorPresentation.sky.visible);
 await page.click('.sheet.open [data-close]');
 // 부품 카메라 프리셋은 없다: 조속기 시점으로 옮긴 뒤 더블클릭으로 다가가고, 「전체 보기」로 돌아온다.
 const settle=()=>page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
 await page.evaluate(()=>{const g=_govWorld();moveCam(g.x+1.05,g.y+0.23,g.z+0.53,g.x-0.02,g.y+0.02,g.z);});await settle();
 const before=await page.evaluate(()=>camera.position.distanceTo(controls.target));
 await page.mouse.dblclick(640,425,{delay:100});await settle();
 assert.ok(await page.evaluate(()=>camera.position.distanceTo(controls.target))<before*.8,'Double click approaches visible geometry');
 await page.screenshot({path:path.join(out,label+'-focus.png')});
 await page.click('#c-shaft');await settle();
 const home=await page.evaluate(()=>{const midY=Y0+TOTAL_H*0.4;return camera.position.distanceTo(new THREE.Vector3(18,midY,21))+controls.target.distanceTo(new THREE.Vector3(0,midY,0));});
 assert.ok(home<1e-3,`Whole view restores the default shaft view: ${home}`);
 await page.screenshot({animations:'disabled',path:path.join(out,label+'-home.png')});
 const restored=await page.evaluate(()=>{
  for(let i=0;i<6;i++){setDetailedBackground(true);setDetailedBackground(false);}
  const actual=new Map();scene.traverse(o=>actual.set(o.uuid,o));
  return {partsUnchanged:viewParts.every(([id,visible])=>actual.get(id)?.visible===visible),state:currentState,near:camera.near,minDistance:controls.minDistance,detail:outdoorPresentation.detailed,
   studioRestored:outdoorPresentation.lighting.every(e=>e.light.intensity===e.studio)&&renderer.toneMappingExposure===outdoorPresentation.simpleExposure};
 });
 assert.equal(restored.partsUnchanged,true);assert.equal(restored.state,'IDLE');assert.equal(restored.near,.1);assert.equal(restored.minDistance,.04);
 assert.equal(restored.studioRestored,true);
 // 원거리 깊이 정밀도와 4cm 근접 관찰을 모두 유지한다.
 const clipping=await page.evaluate(()=>{
  const saved=camera.position.clone(),direction=camera.position.clone().sub(controls.target).normalize();
  const values=[0.04,0.5,10].map(distance=>{
   camera.position.copy(controls.target).addScaledVector(direction,distance);
   controls.update();
   return camera.near;
  });
  camera.position.copy(saved);controls.update();
  return values;
 });
 for(const [i,expected] of [0.002,0.01,0.1].entries())assert.ok(Math.abs(clipping[i]-expected)<1e-6,'Camera clipping follows observation distance');
 const mobile=await browser.newContext({viewport:{width:800,height:1280},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const tablet=await mobile.newPage();tablet.on('pageerror',e=>errors.push(e.message));
 await tablet.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await tablet.waitForFunction(()=>govHandles()?.ready&&document.getElementById('loading').classList.contains('hide'));
 // HUD 배치: 상태 카드·레일·운행바가 화면 안에 있고 서로 겹치지 않으며, 열린 시트도 화면 안이다.
 const hudLayout=async viewport=>tablet.evaluate(vp=>{
  const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.left,y:b.top,r:b.right,b:b.bottom};};
  const boxes={status:r('statusbar'),rail:r('rail'),runbar:r('dd-op')};
  const inside=Object.values(boxes).every(b=>b.x>=0&&b.y>=0&&b.r<=vp.width+1&&b.b<=vp.height+1);
  const hit=(a,b)=>a.x<b.r&&b.x<a.r&&a.y<b.b&&b.y<a.b;
  const overlaps=[['status','rail'],['status','runbar'],['rail','runbar']].filter(([a,b])=>hit(boxes[a],boxes[b])).map(p=>p.join('-'));
  const small=[...document.querySelectorAll('#hud button')].filter(b=>b.offsetParent&&getComputedStyle(b).visibility!=='hidden')
   .map(b=>b.getBoundingClientRect()).filter(b=>b.width<43.5||b.height<43.5).length;
  return {inside,overlaps,small};
 },viewport);
 for(const viewport of [{width:800,height:1280},{width:1280,height:800},{width:412,height:915},{width:915,height:412}]){
  await tablet.setViewportSize(viewport);
  const layout=await hudLayout(viewport);
  assert.ok(layout.inside&&!layout.overlaps.length&&layout.small===0,`HUD layout ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
  await tablet.tap('[data-menu="dd-view"]');
  await tablet.locator('#c-background').scrollIntoViewIfNeeded();await tablet.tap('#c-background');await tablet.tap('#c-background');
  const box=await tablet.locator('#dd-view').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1&&box.y>=0&&box.y+box.height<=viewport.height+1,'settings sheet fits');
  const run=await tablet.locator('#dd-op').boundingBox();assert.ok(box.y+box.height<=run.y+1||box.x>=run.x+run.width||box.x+box.width<=run.x,'sheet stays clear of the run bar');
  await tablet.screenshot({animations:'disabled',path:path.join(out,`${label}-touch-${viewport.width}.png`)});
  await tablet.tap('[data-menu="dd-view"]');
  await tablet.evaluate(()=>{const g=_govWorld();moveCam(g.x+1.05,g.y+0.23,g.z+0.53,g.x-0.02,g.y+0.02,g.z);});await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  const before=await tablet.evaluate(()=>camera.position.distanceTo(controls.target));
  // Real multi-touch must remain a pinch, never a focus or emergency-key click.
  const touchSession=await mobile.newCDPSession(tablet);
  const x=viewport.width/2,y=viewport.height/2;
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-50,y,id:1},{x:x+50,y,id:2}]});
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await tablet.evaluate(()=>gsap.getTweensOf(camera.position).length),0,'Pinch does not start focus');
  assert.equal(await tablet.evaluate(()=>hatchDoors.some(h=>h.keyRatio>0)),false,'Pinch does not turn a key');
  await tablet.evaluate(()=>{const g=_govWorld();moveCam(g.x+1.05,g.y+0.23,g.z+0.53,g.x-0.02,g.y+0.02,g.z);});
  await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  await tablet.touchscreen.tap(viewport.width/2,viewport.height/2);
  await tablet.touchscreen.tap(viewport.width/2,viewport.height/2);
  await tablet.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
  assert.ok(await tablet.evaluate(()=>camera.position.distanceTo(controls.target))<before*.8,'Double tap approaches visible geometry');
  await tablet.screenshot({path:path.join(out,`${label}-focus-touch-${viewport.width}.png`)});
 }
 await mobile.close();assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,label+'-views.json'),JSON.stringify({result,detailed,restored,clipping,errors},null,2));console.log(JSON.stringify({result,detailed,restored,clipping,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
