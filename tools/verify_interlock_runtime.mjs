import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const channel=process.env.BROWSER_CHANNEL||'chrome';
const out='.shot-interlock-runtime';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel,args:['--enable-gpu']});
const errors=[],expectedErrors=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.setDefaultTimeout(30000);
 page.on('crash',()=>errors.push('Browser page crashed'));
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error')(/Interlock QA (setup|frame) failure/.test(m.text())?expectedErrors:errors).push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/?legacyIcons',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 const environment=await page.evaluate(()=>{
  const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  window.runtimeQA={frames:[],longTasks:[],contextLosses:0,started:0};
  renderer.domElement.addEventListener('webglcontextlost',()=>runtimeQA.contextLosses++);
  new PerformanceObserver(list=>{for(const e of list.getEntries())runtimeQA.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
  let last=performance.now();const tick=t=>{if(runtimeQA.started)runtimeQA.frames.push(t-last);last=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  return {browser:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 });
 const runs=[];
 for(const floor of process.argv.includes('--fault-only')?[]:[0,2]){
  await page.evaluate(f=>{const p=hatchDoors[f].interlock.fixed.getWorldPosition(new THREE.Vector3());controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.03,.08,-.75));controls.update();},floor);
  await page.waitForTimeout(400);
  await page.evaluate(()=>{runtimeQA.frames=[];runtimeQA.longTasks=[];runtimeQA.started=performance.now();});
  await page.click(`#interlock-action-${floor}`);
  await page.waitForFunction(()=>InterlockDemo.active);
  await page.waitForFunction(()=>InterlockDemo.phase==='hold');
  await page.screenshot({path:`${out}/${channel}-${floor}-hold.png`});
  await page.waitForFunction(()=>!InterlockDemo.active);
  runs.push(await page.evaluate(()=>{
   runtimeQA.started=0;const frames=runtimeQA.frames.sort((a,b)=>a-b);
   return {samples:frames.length,median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1),longTasks:runtimeQA.longTasks,contextLosses:runtimeQA.contextLosses,controlsEnabled:controls.enabled,secured:CarDoor.secured()&&DoorBypass.hallSecured(),programs:renderer.info.programs.length,memory:renderer.info.memory};
  }));
  console.log(JSON.stringify({floor,...runs.at(-1)}));
  assert.equal(runs.at(-1).contextLosses,0);assert.equal(runs.at(-1).controlsEnabled,true);assert.equal(runs.at(-1).secured,true);
 }
 // A setup exception used to leave controls disabled and the render loop failing.
 const rollback=await page.evaluate(()=>{
  const h=hatchDoors[0],saved=[];
  for(const root of [h.interlock.fixed,h.interlock.moving,h.interlock.opposite])root.traverse(o=>{if(o.isMesh)saved.push([o,o.material]);});
  const mat=h.interlock.contacts.bridge.material,clone=mat.clone;
  let started;try{mat.clone=()=>{throw new Error('Interlock QA setup failure');};started=InterlockDemo.start(0);}finally{mat.clone=clone;}
  return {started,active:InterlockDemo.active,controlsEnabled:controls.enabled,manualActive:!!h.manualActive,doorOpen,materialsRestored:saved.every(([o,m])=>o.material===m),frame:renderer.info.render.frame};
 });
 assert.deepEqual({...rollback,frame:0},{started:false,active:false,controlsEnabled:true,manualActive:false,doorOpen:false,materialsRestored:true,frame:0});
 await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>renderer.info.render.frame)>rollback.frame);
 assert.equal(expectedErrors.length,1);
 await page.evaluate(()=>InterlockDemo.start(0));await page.waitForFunction(()=>InterlockDemo.phase==='hold');
 await page.evaluate(()=>{const original=camera.position.lerpVectors;camera.position.lerpVectors=function(...args){this.lerpVectors=original;throw new Error('Interlock QA frame failure');};});
 await page.waitForFunction(()=>!InterlockDemo.active);
 assert.equal(await page.evaluate(()=>controls.enabled&&!InterlockDemo.active&&CarDoor.secured()&&DoorBypass.hallSecured()),true);
 assert.equal(expectedErrors.length,2);
 // Simulate an older cached loader while keeping the new entry point.
 const {execFileSync}=await import('node:child_process');
 await page.route('**/js/hall-interlock.js*',r=>r.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','HEAD:js/hall-interlock.js'],{encoding:'utf8'})}));
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 const stale=await page.evaluate(()=>({started:InterlockDemo.start(0),active:InterlockDemo.active,controlsEnabled:controls.enabled,doorOpen,frame:renderer.info.render.frame,message:document.getElementById('interlock-demo-message').textContent}));
 assert.equal(stale.started,false);assert.equal(stale.active,false);assert.equal(stale.controlsEnabled,true);assert.equal(stale.doorOpen,false);assert.match(stale.message,/새로고침/);
 await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>renderer.info.render.frame)>stale.frame);
 await page.screenshot({path:`${out}/${channel}-stale-loader.png`});
 const report={environment,runs,rollback,stale,expectedErrors,errors};fs.writeFileSync(`${out}/${channel}${process.argv.includes('--fault-only')?'-faults':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(errors,[]);
}catch(e){console.error(errors);throw e;}finally{await browser.close();}
