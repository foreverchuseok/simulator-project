import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='.shot-retention-story';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[],report={checks:[]};
const url=process.env.SIMULATOR_URL||'http://127.0.0.1:5502/index.html';let page;
const ready=p=>p.waitForFunction(()=>typeof RetentionDemo!=='undefined'&&HallRetention.devices.length===8&&HallEmergencyGuide.guides.length===8&&hatchDoors.every(h=>h.interlock?.ready&&h.left.getObjectByName('HallDoorPanelFinish'))&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
const aim=p=>p.evaluate(()=>{const d=hatchDoors[1].left.getObjectByName('HallRetentionDevice'),v=d.getWorldPosition(new THREE.Vector3());controls.minDistance=.01;camera.near=.002;camera.updateProjectionMatrix();controls.target.copy(v);camera.position.copy(v).add(new THREE.Vector3(.08,.14,-.52));controls.update();updateManualCameraNear();});
const snap=p=>p.evaluate(()=>({phase:RetentionDemo.state.phase,active:RetentionDemo.active,car:carGrp.position.toArray(),cwt:cwtGrp.position.toArray(),floor:curFloor,carVisible:carGrp.visible,near:camera.near,min:controls.minDistance,controls:controls.enabled,secured:CarDoor.secured()&&DoorBypass.hallSecured(),leaves:hatchDoors.flatMap(h=>[h.left,h.right]).map(l=>({p:l.position.toArray(),q:l.quaternion.toArray(),visible:l.children.map(c=>c.visible)}))}));
const perf=p=>p.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<150;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return{median:a[75],p95:a[142],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};});
function restored(before,after){const strip=o=>{const{phase,active,...rest}=o;return rest;};assert.deepEqual(strip(after),strip(before));assert.equal(after.active,false);}
try{
 if(process.argv.includes('--layout')){
  page=await browser.newPage({viewport:{width:320,height:844},deviceScaleFactor:1,hasTouch:true});await page.goto(url,{waitUntil:'networkidle'});await ready(page);await page.evaluate(()=>RetentionDemo.start(1));await page.click('#retention-demo-pause');
  for(const [width,height] of [[320,844],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(250);await page.screenshot({path:`${out}/layout-${width}.png`});
   const bounds=await page.locator('.retention-part-label').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
   assert.ok(bounds.every(b=>b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=height));const[a,b]=bounds;assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'part labels do not overlap');
  }
  await page.click('#retention-demo-exit');console.log('PASS: paused resize, portrait/landscape framing and labels.');
 }else if(process.argv.includes('--motion-perf')){
  report.motion=[];
  for(const width of [1280,390]){
   const p=await browser.newPage({viewport:{width,height:width===1280?850:844},deviceScaleFactor:1,hasTouch:width!==1280});await p.goto(url,{waitUntil:'networkidle'});await ready(p);await p.evaluate(()=>RetentionDemo.start(1));await p.waitForFunction(()=>RetentionDemo.state.phase==='stagger');
   const sample=await p.evaluate(async()=>{const frames=[];let last=await new Promise(requestAnimationFrame),phase=RetentionDemo.state.phase;while(RetentionDemo.state.phase==='stagger'){const now=await new Promise(requestAnimationFrame);if(RetentionDemo.state.phase===phase)frames.push(now-last);last=now;}frames.sort((a,b)=>a-b);return{phase,samples:frames.length,median:frames[Math.floor(frames.length/2)],p95:frames[Math.floor(frames.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});report.motion.push({width,...sample});await p.evaluate(()=>RetentionDemo.cancel());await p.close();
  }
  fs.writeFileSync(`${out}/motion-performance.json`,JSON.stringify(report.motion,null,2));console.log(report.motion);
 }else if(process.argv.includes('--perf')){
  report.performance=[];
  for(const before of [true,false,false,true]){
   const p=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
   if(before)await p.route('**/js/retention-demo.js*',r=>r.fulfill({contentType:'text/javascript',body:'const RetentionDemo={bind(){},update(){},get active(){return false;}};'}));
   await p.goto(url,{waitUntil:'networkidle'});await ready(p);await aim(p);await p.waitForTimeout(800);report.performance.push({before,...await perf(p)});await p.close();
  }
  fs.writeFileSync(`${out}/performance.json`,JSON.stringify(report.performance,null,2));console.log(report.performance);
 }else{
  page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.stack));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(url,{waitUntil:'networkidle'});await ready(page);await aim(page);await page.waitForTimeout(700);
  const initial=await snap(page);await page.screenshot({path:`${out}/entry.png`});
  const pick=(name,fn)=>page.evaluate(({name,fn})=>{const d=eval(fn),v=d.getWorldPosition(new THREE.Vector3());v.project(camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;for(let dy=-40;dy<=40;dy+=4)for(let dx=-70;dx<=70;dx+=4)if(PartGlow.pickAt(x+dx,y+dy)?.name===name)return{x:x+dx,y:y+dy};return null;},{name,fn});
  const lower="hatchDoors[1].left.getObjectByName('HallRetentionDevice')";
  const hit=await pick('승장문 하부 이탈방지장치',lower);assert.ok(hit,'actual lower device can be picked');await page.mouse.click(hit.x,hit.y);
  assert.deepEqual(await page.evaluate(()=>[RetentionDemo.active,RetentionDemo.state.focus]),[true,'retention']);
  assert.equal(await page.locator('#retention-demo-panel select,#retention-demo-panel input').count(),0);
  // Story probe: door copies (upper = whole leaf, lower = panel below the hanger), hook-lip contact, lower drift.
  const probe=()=>page.evaluate(()=>{const s=RetentionDemo.state,f=s.floor,v=new THREE.Vector3();
   const doors=scene.getObjectByName('RetentionStoryVisuals').children.filter(o=>o.name==='RetentionDamagedDoor');
   return{state:{...s},car:carGrp.position.toArray(),cwt:cwtGrp.position.toArray(),doors:doors.map((d,i)=>{
    const leaf=[hatchDoors[f].left,hatchDoors[f].right][i],upper=d.getObjectByName('RetentionDoorUpper'),lower=d.getObjectByName('RetentionDoorLower');
    const guide=upper.children.find(c=>c.userData?.type==='hall-emergency-guide'),spec=HallEmergencyGuide.guides.find(g=>g.parent===leaf).userData;
    guide.updateWorldMatrix(true,false);const hookZ=guide.localToWorld(v.set(0,spec.tipY,spec.tipZ-spec.thickness/2)).z;
    const lipZ=leaf.getWorldPosition(new THREE.Vector3()).z+spec.rail.lipZ+.0015;
    const dev=d.getObjectByName('HallRetentionDevice');
    return{upperZ:upper.position.z,upperY:upper.position.y,lowerAngle:lower.rotation.x,hookGap:hookZ-lipZ,guide:guide.visible,device:dev.visible,
     retentionDrift:dev.getWorldPosition(new THREE.Vector3()).distanceTo(leaf.getObjectByName('HallRetentionDevice').getWorldPosition(new THREE.Vector3()))};})};});
  const seen=[];
  for(const [phase,value] of [['intro',0],['stagger',.6],['doorFly',.8],['install',.95],['lowerHeld',0],['upperHeld',0],['overload',.6],['result',0]]){
   await page.waitForFunction(({phase,value})=>{const s=RetentionDemo.state;return s.phase===phase&&(phase==='stagger'?s.approach>value:phase==='install'?s.install>value:phase==='doorFly'||phase==='overload'?s.fall>value:true);},{phase,value});
   await page.click('#retention-demo-pause');await page.screenshot({path:`${out}/pc-${phase}.png`});
   const q=await probe();assert.deepEqual(q.car,initial.car);assert.deepEqual(q.cwt,initial.cwt);seen.push(phase);
   if(phase==='intro')assert.ok(q.doors.every(d=>Math.abs(d.hookGap-.0025)<2e-4),'normal hook-lip gap 2.5mm: '+JSON.stringify(q.doors.map(d=>d.hookGap)));
   if(phase==='doorFly')assert.ok(q.doors.every(d=>d.upperZ<-.2&&d.lowerAngle>.5&&!d.guide&&!d.device),'no devices: top and bottom both leave');
   if(phase.endsWith('Held')){
    assert.equal(q.state.escape,0);assert.equal(q.state.fall,0);assert.equal(q.state.topEscape,0);assert.equal(q.state.topPush,1);
    assert.ok(q.doors.every(d=>d.guide&&d.device&&d.lowerAngle===0&&Math.abs(d.hookGap)<2e-4&&d.retentionDrift<1e-4),'hook touches lip, shoe stays: '+JSON.stringify(q.doors));
   }
   if(phase==='overload')assert.ok(q.state.damage>.99&&q.state.topEscape>.99&&q.state.escape>.99&&q.state.fall>.6);
   report.checks.push({phase,doors:q.doors,state:q.state});console.log(phase);await page.click('#retention-demo-pause');
  }
  await page.waitForFunction(()=>!RetentionDemo.active,null,{timeout:90000});restored(initial,await snap(page));
  // Guide entry: the same story, upper hold first.
  await page.evaluate(()=>{const g=HallEmergencyGuide.guides.find(g=>g.userData.floor===1&&g.userData.side===1),p=g.getWorldPosition(new THREE.Vector3());p.y+=.015;controls.minDistance=.01;camera.near=.002;camera.updateProjectionMatrix();controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.6,.32,-.75));controls.update();updateManualCameraNear();});
  await page.waitForTimeout(300);const guideBefore=await snap(page);
  const gh=await pick('승강장문 비상가이드',"HallEmergencyGuide.guides.find(g=>g.userData.floor===1&&g.userData.side===1)");assert.ok(gh,'upper guide can be picked');await page.mouse.click(gh.x,gh.y);
  assert.deepEqual(await page.evaluate(()=>[RetentionDemo.active,RetentionDemo.state.focus,RetentionDemo.state.floor]),[true,'guide',1]);
  await page.screenshot({path:`${out}/guide-intro.png`});await page.evaluate(()=>{gsap.globalTimeline.timeScale(6);});
  const phases=await page.evaluate(()=>new Promise(r=>{const list=[];const t=setInterval(()=>{const p=RetentionDemo.state.phase;if(list.at(-1)!==p)list.push(p);if(!RetentionDemo.active){clearInterval(t);r(list);}},16);}));
  assert.ok(phases.indexOf('upperHeld')>0&&phases.indexOf('upperHeld')<phases.indexOf('lowerHeld'),'guide entry shows the upper hold first: '+phases.join(','));
  assert.ok(!phases.some(p=>/scooter|light/i.test(p)),'no scooter chapters');
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);});restored(guideBefore,await snap(page));await aim(page);
  for(let f=0;f<4;f++){
   assert.equal(await page.evaluate(f=>RetentionDemo.start(f),f),true);
   await page.evaluate(()=>{gsap.globalTimeline.timeScale(6);});await page.waitForFunction(()=>RetentionDemo.state.phase==='doorFly');
   await page.evaluate(()=>{moveElevator(3);openDoors();setInspectionMode(true);});assert.equal(await page.evaluate(()=>moving||insMode),false);
   await page.keyboard.press('Escape');restored(initial,await snap(page));
  }
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);RetentionDemo.start(1);});await page.waitForFunction(()=>RetentionDemo.state.phase==='stagger');
  await page.click('#retention-demo-pause');const frozen=await page.evaluate(()=>({...RetentionDemo.state}));await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>({...RetentionDemo.state})),frozen);await page.click('#retention-demo-pause');
  await page.evaluate(()=>{estop=true;});await page.waitForTimeout(120);const stopped=await page.evaluate(()=>({...RetentionDemo.state}));await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>({...RetentionDemo.state})),stopped);await page.evaluate(()=>{estop=false;InterlockDemo.cancel();});restored(initial,await snap(page));
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await aim(page);await page.waitForTimeout(200);
   const before=await snap(page);
   const hit=await pick('승장문 하부 이탈방지장치',lower);assert.ok(hit);await page.touchscreen.tap(hit.x,hit.y);assert.equal(await page.evaluate(()=>RetentionDemo.active),true);await page.evaluate(()=>{gsap.globalTimeline.timeScale(2.5);});
   for(const phase of ['stagger','kick','lowerHeld','upperHeld','overload','result']){
    await page.waitForFunction(phase=>{const s=RetentionDemo.state;return s.phase===phase&&(phase==='overload'?s.fall>.6:true);},phase);await page.tap('#retention-demo-pause');await page.screenshot({path:`${out}/${width}-${phase}.png`});
    const b=await page.locator('#retention-demo-panel').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=844);await page.tap('#retention-demo-pause');
   }
   await page.tap('#retention-demo-exit');restored(before,await snap(page));
  }
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);RetentionDemo.start(0);});await page.click('#retention-demo-pause');await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
  await page.screenshot({path:`${out}/rotated.png`});assert.ok(await page.evaluate(()=>camera.aspect>2&&RetentionDemo.active));await page.click('#retention-demo-exit');
  assert.equal(await page.evaluate(()=>scene.getObjectByName('RetentionStoryVisuals')!==undefined),false);
  assert.equal(await page.evaluate(()=>scene.getObjectByName('DrunkBear')!==undefined),false,'bear removed from the scene');
  assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,(key,value)=>key==='_gsap'?undefined:value,2));console.log('PASS: lower/guide click entry, drunk kick story, top+bottom escape, hook-lip contact, overload, restoration, all floors, pause/estop, touch.');
 }
}catch(e){console.error(e,errors);if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
