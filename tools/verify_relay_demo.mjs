import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='.shot-relay-story';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[],report={checks:[],performance:[]};
const url=process.env.SIMULATOR_URL||'http://127.0.0.1:5501/index.html';let page;
const snap=p=>p.evaluate(()=>({phase:RelayRopeDemo.state.phase,active:RelayRopeDemo.active,car:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,secured:CarDoor.secured()&&DoorBypass.hallSecured(),controls:controls.enabled,doors:hatchDoors.map(h=>({x:h.right.position.x-h.right.userData.cx,l:h.left.position.x-h.left.userData.cx,aux:h.interlock.contacts.auxClosed})),actor:scene.getObjectByName('RelayStoryPassenger')?.visible}));
const ready=p=>p.waitForFunction(()=>hatchDoors.every(h=>h.interlock?.ready)&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
const aim=p=>p.evaluate(()=>{const k=hatchDoors[1].link,v=new THREE.Vector3(0,k.upY-.4,k.upZ);k.seg.upL.parent.localToWorld(v);controls.target.copy(v);camera.position.copy(v).add(new THREE.Vector3(0,.4,-3.6));controls.update();});
const perf=p=>p.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<100;i++){const n=await new Promise(requestAnimationFrame);a.push(n-last);last=n;}a.sort((a,b)=>a-b);return {median:a[50],p95:a[95],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
try{
 if(process.argv.includes('--perf')){
  for(const before of [true,false,true,false]){const p=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});if(before)await p.route('**/js/relay-rope-demo.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('temporary/relay-cinematic/before.js','utf8')}));await p.goto(url,{waitUntil:'networkidle'});await ready(p);await aim(p);await p.waitForTimeout(500);report.performance.push({before,...await perf(p)});await p.close();}
  fs.writeFileSync(`${out}/performance.json`,JSON.stringify(report.performance,null,2));console.log(report.performance);
 }else{
  page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(45000);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(url,{waitUntil:'networkidle'});await ready(page);await aim(page);await page.waitForTimeout(600);
  const initial=await snap(page);
  await page.evaluate(()=>{window.relayTrace=[];const trace=()=>{if(RelayRopeDemo.active&&RelayRopeDemo.state.floor===1&&['bend','wear'].includes(RelayRopeDemo.state.phase)){const r=hatchDoors[1].link.seg.upL.parent.getObjectByName('relayFailureOverlay');relayTrace.push(r.children[4].position.toArray());}requestAnimationFrame(trace);};requestAnimationFrame(trace);});
  const hit=await page.evaluate(()=>{const k=hatchDoors[1].link;for(let x=-1.35;x<1.3;x+=.035){const v=new THREE.Vector3(x,k.upY,k.upZ);k.seg.upL.parent.localToWorld(v);v.project(camera);const x1=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;if(PartGlow.pickAt(x1,y)?.name==='2층 연동로프')return {x:x1,y};}return null;});assert.ok(hit);await page.mouse.click(hit.x,hit.y);assert.equal(await page.evaluate(()=>RelayRopeDemo.active),true);assert.equal(await page.locator('#relay-demo-panel select,#relay-demo-panel input').count(),0);
  for(const phase of ['bend','wear','breakOpen','openFail','impact','other','breakClose','puzzled','result']){
   await page.waitForFunction(p=>RelayRopeDemo.state.phase===p,phase);if(['impact','puzzled'].includes(phase))await page.waitForFunction(()=>RelayRopeDemo.state.alarm>.9);await page.evaluate(()=>{gsap.globalTimeline.pause();});await page.screenshot({path:`${out}/pc-${phase}.png`});report.checks.push({phase,...await snap(page)});console.log(phase);
   if(phase==='puzzled'){const q=await snap(page);assert.ok(Math.abs(q.doors[1].x)<1e-8);assert.ok(q.doors[1].l<-.5);assert.equal(q.doors[1].aux,false);}
   await page.evaluate(()=>{gsap.globalTimeline.resume();});
  }
  await page.waitForFunction(()=>!RelayRopeDemo.active);let q=await snap(page);assert.ok(q.secured&&q.controls&&!q.actor);assert.equal(q.car,initial.car);assert.equal(q.cwt,initial.cwt);assert.equal(q.floor,initial.floor);
  assert.ok(await page.evaluate(()=>{const k=hatchDoors[1].link;return relayTrace.some(p=>p[0]<k.pulLX-k.ropeR*.9)&&relayTrace.some(p=>Math.abs(p[1]-k.upY)<1e-5)&&relayTrace.some(p=>Math.abs(p[1]-k.loY)<1e-5);}), 'material point traverses both straights and pulley arc');
  // Every landing, cancellation at fracture, conflicting commands, restoration.
  for(let f=0;f<4;f++){
   assert.ok(await page.evaluate(f=>RelayRopeDemo.start(f),f));await page.evaluate(()=>{gsap.globalTimeline.timeScale(5);});await page.waitForFunction(()=>RelayRopeDemo.state.phase==='breakOpen');
   await page.evaluate(()=>{moveElevator(3);openDoors();setInspectionMode(true);});assert.equal(await page.evaluate(()=>moving||insMode),false);
   await page.keyboard.press('Escape');q=await snap(page);assert.ok(q.secured&&q.controls&&!q.actor);assert.equal(q.car,initial.car);assert.equal(q.cwt,initial.cwt);
  }
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);RelayRopeDemo.start(0);});await page.waitForFunction(()=>RelayRopeDemo.state.phase==='bend');await page.evaluate(()=>{estop=true;});await page.waitForTimeout(100);const stopped=await snap(page);await page.waitForTimeout(300);assert.deepEqual(await snap(page),stopped);await page.evaluate(()=>{estop=false;});await page.click('#relay-demo-exit');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>{RelayRopeDemo.start(2);gsap.globalTimeline.timeScale(2);});
   for(const phase of ['breakOpen','impact','puzzled']){await page.waitForFunction(p=>RelayRopeDemo.state.phase===p,phase);await page.evaluate(()=>{gsap.globalTimeline.pause();});await page.screenshot({path:`${out}/${width}-${phase}.png`});const b=await page.locator('#relay-demo-panel').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y+b.height<=844);await page.evaluate(()=>{gsap.globalTimeline.resume();});}
   await page.tap('#relay-demo-exit');q=await snap(page);assert.ok(q.secured&&!q.actor);assert.equal(q.car,initial.car);
  }
  assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log('PASS: one-click story, all floors, both failures, cancellation, estop, mobile.');
 }
}catch(e){console.error(e,errors);if(page)await page.screenshot({path:`${out}/failure.png`,timeout:5000}).catch(()=>{});throw e;}finally{await browser.close();}
