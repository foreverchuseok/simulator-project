// UCM 중단 경계: 개문 콜백, 놀람 자세, 카메라 전환, 턱 접촉 직전, 승객 회복.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser = await chromium.launch({args:['--enable-gpu']});
const out = '.shot-ucm-recovery'; fs.mkdirSync(out,{recursive:true});
const report = {}, errors = [];
try {
  const page = await browser.newPage({viewport:{width:390,height:800},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.SIMULATOR_URL || 'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&document.getElementById('loading').classList.contains('hide'));
  await page.evaluate(()=>{
    gsap.ticker.lagSmoothing(0);
    window.ucmBangs=0; const original=MACH.ropeBrakeBang;
    MACH.ropeBrakeBang=(...args)=>{ucmBangs++;return original(...args);};
  });
  for (const edge of ['opening','startle','camera','contact','recover']) {
    const saved = await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,p:camera.position.toArray(),t:controls.target.toArray(),near:camera.near,min:controls.minDistance,damp:controls.enableDamping}));
    await page.evaluate(edge=>{
      window.ucmAborted=false;window.ucmBangs=0;
      const watch=()=>{
        const u=UCMDemo.state;
        const ready=edge==='opening'?currentState===ELEVATOR_STATE.DOOR_OPENING
          :edge==='startle'?u.startled&&!u.falling
          :edge==='camera'?u.view==='machine-room'
          :edge==='contact'?u.closing:u.stage==='stumble';
        if(ready){gsap.ticker.remove(watch);UCMDemo.reset();window.ucmAborted=true;}
      };
      document.getElementById('ucm-brake').value='normal';
      UCMDemo.start(document.getElementById('btn-ucm'));
      if(edge==='opening') {
        moveElevator(curFloor+1);document.getElementById('btn-close').click();
        if(CarDoor.state.operation!=='open')throw new Error('UCM opening was interrupted by a normal command');
      }
      gsap.ticker.add(watch);
    },edge);
    await page.waitForFunction(()=>window.ucmAborted,null,{timeout:40000});
    await page.waitForFunction(()=>!UCMDemo.state.active&&!moving&&!doorOpen&&!estop,null,{timeout:20000});
    await page.waitForTimeout(600);
    const state=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,p:camera.position.toArray(),t:controls.target.toArray(),near:camera.near,min:controls.minDistance,damp:controls.enableDamping,
      stage:UCMDemo.state.stage,enabled:controls.enabled,bangs:ucmBangs,locked:CarDoor.secured(),char:UCMDemo.character.visible,
      summary:document.getElementById('ucm-summary').hidden,exit:document.getElementById('ucm-exit').hidden,dust:scene.getObjectByName('UCMGripDust').visible,
      impact:Number(getComputedStyle(document.getElementById('ucm-impact')).opacity),transform:getComputedStyle(renderer.domElement).transform,
      upper:UCMDemo.state.jaws.up.position.y-UCMDemo.state.jaws.up0,lower:UCMDemo.state.jaws.lo.position.y-UCMDemo.state.jaws.lo0,
      pose:UCMDemo.character.children.map(n=>[...n.position.toArray(),...n.rotation.toArray().slice(0,3)])}));
    for(const k of ['y','cwt','near','min'])assert.ok(Math.abs(state[k]-saved[k])<1e-6,`${edge}: restore ${k}`);
    for(const k of ['p','t'])state[k].forEach((n,i)=>assert.ok(Math.abs(n-saved[k][i])<1e-5,`${edge}: restore ${k}`));
    assert.equal(state.damp,saved.damp);assert.equal(state.enabled,true);assert.equal(state.locked,true);
    assert.equal(state.char,false);assert.equal(state.summary,true);assert.equal(state.exit,true);assert.equal(state.dust,false);
    assert.equal(state.impact,0);assert.equal(state.transform,'none');assert.equal(state.upper,0);assert.equal(state.lower,0);
    if(edge!=='recover')assert.equal(state.bangs,0,`${edge}: no delayed impact after cancel`);
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(()=>UCMDemo.character.children.map(n=>[...n.position.toArray(),...n.rotation.toArray().slice(0,3)])),state.pose,'no pending pose callbacks');
    report[edge]=state;
  }
  // Reduced motion suppresses shake while preserving event text and physical jaw travel.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>UCMDemo.start(document.getElementById('btn-ucm')));
  await page.waitForFunction(()=>UCMDemo.state.bang,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>renderer.domElement.getAnimations().filter(a=>a.playState==='running').length),0);
  await page.locator('#ucm-exit').tap();
  await page.waitForFunction(()=>!UCMDemo.state.active,null,{timeout:20000});
  report.reducedMotion=true;
  await page.evaluate(()=>UCMDemo.start(document.getElementById('btn-ucm')));
  await page.waitForFunction(()=>UCMDemo.state.stage==='moving');
  await page.locator('#btn-estop').tap();
  await page.waitForFunction(()=>!UCMDemo.state.active&&!moving&&!estop&&!doorOpen,null,{timeout:20000});
  report.stopButton=true;
  assert.deepEqual(errors,[]);console.log('verify_ucm_recovery OK');
} finally {report.errors=errors;fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
