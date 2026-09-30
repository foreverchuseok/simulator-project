import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const out='.shot-interlock-demo',baseline=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={baseline};let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(baseline)await page.route('**/js/hall-interlock.js*',r=>r.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','HEAD:js/hall-interlock.js'],{encoding:'utf8'})}));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>hatchDoors.every(h=>h.interlock?.ready)&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 const aim=async f=>page.evaluate(f=>{const h=hatchDoors[f],p=h.interlock.fixed.getWorldPosition(new THREE.Vector3());p.x+=.05;p.y+=.005;p.z-=.05;controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.03,.08,-.75));controls.update();},f);
 const perf=()=>page.evaluate(async()=>{const a=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);a.push(now-last);last=now;}a.sort((a,b)=>a-b);return{median:a[60],p95:a[114],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await aim(2);await page.waitForTimeout(600);report.idle=await perf();
 await page.screenshot({path:`${out}/${baseline?'before':'after'}-idle.png`});
 if(!baseline){
  const snapshot=()=>page.evaluate(()=>({floor:InterlockDemo.floor,phase:InterlockDemo.phase,ratio:InterlockDemo.poseState.opening,release:InterlockDemo.poseState.release,contacts:hatchDoors.map(h=>({main:h.interlock.contacts.mainClosed,aux:h.interlock.contacts.auxClosed,mainGap:h.interlock.contacts.mainGap,auxGap:h.interlock.contacts.auxGap,x:h.right.position.x-h.right.userData.cx})),car:carGrp.position.y,carDoor:carDoorR.position.x,ins:insMode}));
  report.initial=await snapshot();assert.ok(report.initial.contacts.every(c=>c.main&&c.aux));
  await page.click('#interlock-action-2');
  await page.waitForFunction(()=>InterlockDemo.phase==='unlock'&&InterlockDemo.poseState.release>.99);
  report.unlock=await snapshot();assert.equal(report.unlock.contacts[2].main,false);assert.equal(report.unlock.contacts[2].aux,true);assert.equal(report.unlock.ratio,0);
  await page.screenshot({path:`out/unlock.png`.replace('out',out)});
  await page.waitForFunction(()=>InterlockDemo.phase==='hold');report.half=await snapshot();
  assert.equal(report.half.ratio,.5);assert.equal(report.half.contacts[2].aux,false);assert.equal(report.half.contacts[2].main,false);
  assert.ok(report.half.contacts.every((c,i)=>i===2||c.x===0&&c.main&&c.aux));assert.equal(report.half.car,report.initial.car);assert.equal(report.half.carDoor,report.initial.carDoor);
  await page.screenshot({path:`${out}/half-open.png`});
  await page.evaluate(()=>{moveElevator(1);openDoors();closeDoors();HallManual.select(0);HallManual.request(.5);setInspectionMode(true);DoorBypass.setMode('hall');UCMDemo.start(document.getElementById('btn-ucm'));});
  assert.equal(await page.evaluate(()=>moving||insMode||HallManual.active||UCMDemo.state.active||DoorBypass.mode!=='off'),false);
  await page.waitForFunction(()=>InterlockDemo.phase==='closing'&&InterlockDemo.poseState.opening===0);report.closedRaised=await snapshot();
  assert.equal(report.closedRaised.contacts[2].aux,true);assert.equal(report.closedRaised.contacts[2].main,false);
  await page.screenshot({path:`${out}/aux-reconnected.png`});
  await page.waitForFunction(()=>!InterlockDemo.active);report.finished=await snapshot();assert.ok(report.finished.contacts.every(c=>c.main&&c.aux&&c.x===0));
  assert.equal(await page.evaluate(()=>controls.enabled),true);
  await page.screenshot({path:`${out}/relatched.png`});
  // At the car's landing the existing car/hall coupling must move both leaves.
  await aim(0);console.log('Starting coupled landing cycle');await page.click('#interlock-action-0');await page.waitForFunction(()=>InterlockDemo.phase==='hold');
  report.coupled=await snapshot();assert.ok(Math.abs(report.coupled.carDoor-report.initial.carDoor-.5*.754)<1e-7);
  await page.click('#btn-estop');const frozen=await snapshot();await page.waitForTimeout(450);assert.deepEqual(await snapshot(),frozen);
  assert.equal(await page.evaluate(()=>InterlockDemo.paused),true);await page.click('#btn-estop');await page.waitForFunction(()=>!InterlockDemo.active);
  assert.equal(await page.evaluate(()=>CarDoor.secured()&&DoorBypass.hallSecured()&&!doorOpen&&currentState===ELEVATOR_STATE.IDLE),true);
  // Touch, cancel and replay, and the global part-icon visibility control.
  await page.setViewportSize({width:390,height:844});await aim(1);await page.tap('#interlock-action-1');
  await page.waitForFunction(()=>InterlockDemo.phase==='unlock'&&InterlockDemo.poseState.release>.99);await page.screenshot({path:`${out}/mobile-unlock.png`});
  const box=await page.locator('#interlock-demo-panel').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);
  await page.tap('#interlock-demo-cancel');assert.equal(await page.evaluate(()=>!InterlockDemo.active&&DoorBypass.hallSecured()),true);
  await page.evaluate(()=>PartGlow.setEnabled(false));assert.equal(await page.locator('#interlock-action-1').isVisible(),true);await page.evaluate(()=>PartGlow.setEnabled(true));
  await aim(1);await page.tap('#interlock-action-1');await page.waitForFunction(()=>InterlockDemo.phase==='hold');await page.screenshot({path:`${out}/mobile-half.png`});await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>!InterlockDemo.active&&DoorBypass.hallSecured()&&controls.enabled),true);
  // Blocked clicks must explain the current state, without changing it.
  await aim(1);await page.tap('#btn-estop');await page.tap('#interlock-action-1');
  assert.match(await page.locator('#interlock-demo-message').innerText(),/비상정지/);
  assert.equal(await page.evaluate(()=>estop&&!InterlockDemo.active),true);
  await page.screenshot({path:`${out}/mobile-blocked.png`});
  await page.tap('#interlock-demo-cancel');assert.equal(await page.locator('#interlock-demo-panel').isVisible(),false);
  await page.tap('#btn-estop');
  await page.evaluate(()=>setInspectionMode(true));await page.tap('#interlock-action-1');
  assert.match(await page.locator('#interlock-demo-message').innerText(),/점검운전/);
  assert.equal(await page.evaluate(()=>insMode&&!InterlockDemo.active),true);
  await page.keyboard.press('Escape');await page.evaluate(()=>setInspectionMode(false));
  await page.tap('#btn-open');await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);
  await page.evaluate(()=>clearTimeout(autoTimer));await page.tap('#interlock-action-1');
  assert.match(await page.locator('#interlock-demo-message').innerText(),/문이 열려/);
  assert.equal(await page.evaluate(()=>doorOpen&&!InterlockDemo.active),true);
  await page.tap('#btn-close');await page.waitForFunction(()=>!doorOpen&&CarDoor.secured());
  await page.tap('#interlock-action-1');await page.waitForFunction(()=>InterlockDemo.phase==='unlock');
  assert.equal(await page.locator('#interlock-demo-message').isVisible(),false);
  assert.equal(await page.locator('.interlock-contacts').isVisible(),true);
  await page.keyboard.press('Escape');report.blockedClicks='estop, inspection, open door, recovery';
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/${baseline?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 if(page){await page.screenshot({path:`${out}/failure.png`});console.error(await page.evaluate(()=>({phase:InterlockDemo.phase,allowed:InterlockDemo.allowed(0),floor:InterlockDemo.floor,estop,doorOpen,secured:CarDoor.secured(),hallSecured:DoorBypass.hallSecured(),buttons:[...document.querySelectorAll('[id^="interlock-action-"]')].map(b=>({id:b.id,hidden:b.hidden,disabled:b.disabled,hit:document.elementFromPoint(b.getBoundingClientRect().x+22,b.getBoundingClientRect().y+22)?.id}))})));}
 console.error(errors);throw error;
}finally{await browser.close();}
