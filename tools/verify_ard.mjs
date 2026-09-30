import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='.shot-ard';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[],report={};
const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.routeWebSocket('**',ws=>ws.close());
const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
const load=async()=>{await page.goto('http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});await page.waitForFunction(()=>MachineRoomPower.ready&&EmergencyLighting.ready&&CarDoor.state?.ready&&carGrp.getObjectByName('terraceCeiling')?.userData.ready);};
const perf=()=>page.evaluate(async()=>{const samples=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);samples.push(now-last);last=now;}samples.sort((a,b)=>a-b);return {median:samples[60],p95:samples[114],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
const machine=()=>page.evaluate(()=>{leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);const p=MachineRoomPower.root.getObjectByName('ARDInstallation').getWorldPosition(new THREE.Vector3());p.y+=.8;camera.position.set(p.x+3,p.y+.3,p.z+1.25);controls.target.copy(p);controls.update();});
const stage=async s=>{await page.waitForFunction(s=>ARDDemo.state.stage===s,s);console.log('stage',s);};
const shot=label=>page.screenshot({path:`${out}/${label}.png`});
const state=()=>page.evaluate(()=>({...ARDDemo.state,y:carGrp.position.y,cwt:cwtGrp.position.y,doorOpen,moving,fsm:currentState,emergency:EmergencyLighting.on,nearest:insNearestFloor(),atFloor:Math.abs(carGrp.position.y-FLOOR_Y[curFloor]-S.CAR_H/2),locked:CarDoor.secured()}));
try{
 await page.route('**/js/ard-demo.js*',route=>route.fulfill({contentType:'text/javascript',body:'const ARDDemo={build(){},update(){},active:false,blocksCommands:false};'}));
 await load();await machine();report.before=await perf();await page.unroute('**/js/ard-demo.js*');await load();await machine();report.after=await perf();
 await shot('icon');assert.equal(await page.locator('#ard-action').isVisible(),true);
 report.guards=await page.evaluate(()=>{setInspectionMode(true);const ins=ARDDemo.start();setInspectionMode(false);DoorBypass.setMode('hall');const bypass=ARDDemo.start();DoorBypass.setMode('off');setInspectionMode(false);estop=true;const safety=ARDDemo.start();estop=false;return {ins,bypass,safety};});assert.deepEqual(report.guards,{ins:false,bypass:false,safety:false});
 // A real click also unlocks sound. Track actual clip playback, not only the requested caption.
 await page.evaluate(()=>{window.ardAudio=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('power_failure')){this.addEventListener('playing',()=>ardAudio.push('playing'),{once:true});this.addEventListener('ended',()=>ardAudio.push('ended'),{once:true});}return original.call(this);};});
 await page.evaluate(()=>{window.ardTrace=[];let last='';gsap.ticker.add(()=>{const s=ARDDemo.state,k=[s.stage,s.cycles,s.countdown].join(':');if(s.active&&k!==last){last=k;ardTrace.push({stage:s.stage,cycle:s.cycles,count:s.countdown,t:performance.now()});}});});
 await page.click('#ard-action');await stage('blackout');report.blackout=await state();await shot('blackout');
 await stage('machine');await page.waitForTimeout(1200);await shot('machine');
 await stage('rescue');await page.waitForTimeout(500);await shot('cabin');
 await stage('open');report.firstOpen=await state();assert.equal(report.firstOpen.cycles,1);assert.ok(report.firstOpen.atFloor<1e-6);assert.equal(report.firstOpen.emergency,true);await shot('open');
 await stage('press');await page.waitForTimeout(400);await shot('press');await stage('exiting');await page.waitForTimeout(1300);await shot('exit');await stage('done');report.done=await state();await shot('done');
 assert.equal(report.done.cycles,2);assert.equal(report.done.locked,true);assert.equal(report.done.emergency,false);assert.equal(report.done.moving,false);
 assert.ok(report.done.reopenGap>.02&&report.done.reopenGap<.25,'폐문 완료 전 반전');assert.equal(report.done.exited,true);
 report.exit=await page.evaluate(()=>({x:Mascot.root.position.x,z:Mascot.root.position.z,hallZ:HallInspector.keyWorld(curFloor).z,cameraZ:camera.position.z,panelWidth:document.getElementById('ard-panel').getBoundingClientRect().width,titleSize:getComputedStyle(document.getElementById('ard-title')).fontSize}));
 assert.ok(report.exit.z>report.exit.hallZ+.5);assert.ok(report.exit.cameraZ>report.exit.z);assert.equal(report.exit.panelWidth,324);assert.equal(report.exit.titleSize,'13px');assert.equal(await page.locator('#ard-reopen').count(),0);
 const trace=await page.evaluate(()=>ardTrace),first=trace.find(t=>t.cycle===1&&t.count===10),last=trace.find(t=>t.cycle===1&&t.stage==='press');report.countdownMs=last.t-first.t;assert.ok(report.countdownMs>3300&&report.countdownMs<3750);
 const y=report.done.y;await page.evaluate(()=>moveElevator(3));await page.waitForTimeout(200);assert.equal((await state()).y,y);
 report.audio=await page.evaluate(()=>ardAudio);assert.deepEqual(report.audio,['playing','ended']);
 await page.click('#ard-restore');await stage('idle');assert.equal(await page.evaluate(()=>controls.enabled),true);
 // Top floor/downward sequence on a portrait touch surface.
 await page.evaluate(()=>{const y=FLOOR_Y[FLOORS-1]+S.CAR_H/2,d=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=d;curFloor=FLOORS-1;spinSheaves(d);refreshRopes();refreshGovernorRope();});
 await page.setViewportSize({width:390,height:844});await machine();await page.waitForTimeout(200);await page.tap('#ard-action');await stage('blackout');report.down=await state();assert.equal(report.down.direction,-1);
 await stage('rescue');await shot('mobile-cabin');await stage('open');await shot('mobile-open');await stage('press');await page.waitForTimeout(400);await shot('mobile-press');await stage('exiting');await page.waitForTimeout(1300);await shot('mobile-exit');await stage('done');await shot('mobile-done');await page.tap('#ard-restore');await stage('idle');
 // Take over a running descent, then STOP and recover without stale callbacks.
 await page.evaluate(()=>moveElevator(0));await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>ARDDemo.start()),true);await stage('depart');assert.equal((await state()).direction,-1);
 await page.waitForTimeout(400);await page.tap('#btn-estop');await stage('halted');const stop=await state();await page.waitForTimeout(500);assert.equal((await state()).y,stop.y);
 await page.tap('#ard-restore');await stage('idle');assert.ok((await state()).atFloor<1e-6);
 // Abort while opening; old callbacks must not restart the sequence.
 await page.evaluate(()=>ARDDemo.start());await stage('opening');await page.evaluate(()=>ARDDemo.halt());await stage('halted');await page.evaluate(()=>ARDDemo.reset());await stage('idle');await page.waitForTimeout(3500);assert.equal((await state()).stage,'idle');assert.equal((await state()).locked,true);
 // Stop while the mascot is crossing the doorway, then recover without closing on it.
 await page.evaluate(()=>{gsap.globalTimeline.timeScale(2);ARDDemo.start();});await stage('exiting');await page.waitForTimeout(500);await page.evaluate(()=>{ARDDemo.halt();gsap.globalTimeline.timeScale(1);});
 const stoppedMascot=await page.evaluate(()=>Mascot.root.position.toArray());await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>Mascot.root.position.toArray()),stoppedMascot);
 await page.evaluate(()=>ARDDemo.reset());await stage('idle');assert.equal(await page.evaluate(()=>Mascot.inspecting),false);assert.equal((await state()).locked,true);report.exitAbort=true;
 report.errors=errors;assert.deepEqual(errors,[]);console.log('verify_ard OK');
}catch(e){report.failure=await state();console.log(report.failure,errors);throw e;}finally{report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
