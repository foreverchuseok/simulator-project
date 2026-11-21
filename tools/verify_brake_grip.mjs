// Live Server: node tools/verify_brake_grip.mjs [--phone --local-files] [--reduced]
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const phone=process.argv.includes('--phone'),reduced=process.argv.includes('--reduced'),tag=phone?'phone':reduced?'reduced':'mobile';
const out=phone?'temporary/brake-grip':'.shot-brake-grip';fs.mkdirSync(out,{recursive:true});
const browser=phone?await chromium.connectOverCDP(process.env.PHONE_CDP_URL||'http://127.0.0.1:9223'):await chromium.launch({args:['--enable-gpu']});
const page=phone?browser.contexts()[0].pages().find(p=>p.url().includes(':5500')):await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:reduced?'reduce':'no-preference'});
page.setDefaultTimeout(90000);const cd=await page.context().newCDPSession(page),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const touch=(type,points=[])=>cd.send('Input.dispatchTouchEvent',{type,touchPoints:points});
const press=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();assert.ok(r,selector);await touch('touchStart',[{x:r.x+r.width/2,y:r.y+r.height/2}]);await touch('touchEnd');};
const snap=()=>page.evaluate(()=>{
 const t=mrGrp.userData.traction,fx=[];t.arms.forEach(a=>a.traverse(o=>{if(o.userData.brakeTeachingFX)fx.push({name:o.name,visible:o.visible,color:o.material.emissive.clone().convertLinearToSRGB().getHex(),opacity:o.material.opacity,width:o.material.userData.gripWidth.value});}));
 return{stage:BrakeDemo.state.stage,mode:BrakeDemo.state.mode,arms:t.arms.map(a=>a.rotation.z),fx,tags:[...document.querySelectorAll('.brake-grip-tag')].map(e=>({text:e.textContent,contact:e.dataset.contact,hidden:e.hidden})),geometries:renderer.info.memory.geometries};
});
const cleanup=async()=>{
 await press('#demo-exit');await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&CarDoor.secured());
 const r=await snap();assert.equal(r.fx.some(o=>o.visible),false);assert.equal(await page.locator('.brake-grip-tag:visible').count(),0);assert.deepEqual(r.arms,[0,0]);
 assert.equal(await page.evaluate(()=>window.brakeGripOriginal.every(([o,m])=>o.material===m)),true,'original GLB materials preserved');
};
try{
 await cd.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(phone&&process.argv.includes('--local-files'))await page.route('http://127.0.0.1:5500/**',r=>{const file=path.resolve('.'+decodeURIComponent(new URL(r.request().url()).pathname)),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};return file.startsWith(process.cwd()+path.sep)&&fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'}):r.continue();});
 for(const name of ['three.min.js','gsap.min.js','OrbitControls.js','GLTFLoader.js']){const f='temporary/background-phone/vendor/'+name;if(fs.existsSync(f))await page.route('https://**/'+name,r=>r.fulfill({body:fs.readFileSync(f),contentType:'text/javascript'}));}
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});await page.bringToFront();
 await page.waitForFunction(()=>mrGrp.userData.traction.ready&&govHandles()?.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready)&&document.querySelector('#loading.hide'));
 await page.evaluate(()=>{window.brakeGripOriginal=[];mrGrp.userData.traction.arms.forEach(a=>a.traverse(o=>{if(o.isMesh)brakeGripOriginal.push([o,o.material]);}));});
 for(const mode of ['dual','single']){
  await press('#m-demo-fab');await press('#m-demo-list [data-demo="brake"] .demo-disclosure');await press(`[data-preview-mode="${mode}"]`);await press('#m-demo-play');
  await page.waitForFunction(()=>BrakeDemo.state.stage==='holding');await page.waitForTimeout(220);await press('#demo-pause');await page.waitForTimeout(180);
  const holding=await snap();assert.deepEqual(holding.arms,[0,0]);assert.ok(holding.fx.every(o=>o.visible));assert.ok(holding.tags.every(t=>t.contact==='held'&&!t.hidden));
  assert.equal(new Set(holding.fx.map(o=>o.color)).size,1);
  await page.waitForTimeout(400);assert.deepEqual((await snap()).fx,holding.fx,'effect pulse freezes with the demo');
  await page.screenshot({path:`${out}/${tag}-${mode}-holding.png`});
  if(!phone)for(const size of [{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);await page.waitForTimeout(180);
   const boxes=await page.locator('.brake-grip-tag:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
   assert.equal(boxes.length,2);assert.ok(boxes.every(r=>r.x>=0&&r.y>=0&&r.right<=size.width&&r.bottom<=size.height));
   assert.ok(boxes[0].right<=boxes[1].left||boxes[1].right<=boxes[0].left||boxes[0].bottom<=boxes[1].top||boxes[1].bottom<=boxes[0].top,'contact badges do not overlap');
   await page.screenshot({path:`${out}/${tag}-${mode}-${size.width}.png`});
  }
  if(!phone){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);}
  await press('#demo-pause');await page.waitForFunction(()=>BrakeDemo.state.stage==='failure');await page.waitForTimeout(500);await press('#demo-pause');await page.waitForTimeout(180);
  const failed=await snap();assert.deepEqual(failed.tags.map(t=>t.contact),mode==='dual'?['lost','held']:['lost','lost']);
  if(mode==='dual'){assert.equal(failed.arms[1],0,'remaining brake is not re-applied');assert.equal(new Set(failed.fx.map(o=>o.color)).size,2);}
  else assert.equal(new Set(failed.fx.map(o=>o.color)).size,1);
  await page.screenshot({path:`${out}/${tag}-${mode}-failure.png`});
  await press('#demo-pause');await page.waitForFunction(()=>['held','paused'].includes(BrakeDemo.state.stage));await page.waitForTimeout(180);
  const end=await snap();assert.deepEqual(end.tags.map(t=>t.contact),mode==='dual'?['lost','held']:['lost','lost']);
  await page.screenshot({path:`${out}/${tag}-${mode}-result.png`});
  await cleanup();results.push({mode,holding,failed,end});console.log('PASS',tag,mode);
 }
 await page.evaluate(()=>BrakeDemo.start('dual'));await page.waitForFunction(()=>BrakeDemo.state.stage==='holding');await page.waitForTimeout(150);await cleanup();
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${tag}-results.json`,JSON.stringify({results,errors},null,2));console.log('ALL PASS',tag);
}catch(e){await page.screenshot({path:`${out}/${tag}-failure.png`}).catch(()=>{});console.error(errors);throw e;}
finally{await page.unrouteAll().catch(()=>{});await cd.send('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});await browser.close();}
