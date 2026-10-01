// Same event durations at desktop/mobile viewports and at a slow simulation ticker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-demo-timing';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),results=[],errors=[];
try{
 for(const [name,width,fps] of [['pc',1280,60],['mobile',390,60],['pc-slow-ticker',1280,10]]){
  const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
  page.on('pageerror',e=>errors.push(e.message));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.routeWebSocket('**',ws=>ws.close());
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>govHandles()?.ready&&mrGrp.userData.traction.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&CarDoor.secured());
  await page.evaluate(fps=>{
   gsap.ticker.fps(fps);window.timing={};
   const probe=()=>{
    const s=AscentDemo.state,t=performance.now();
    if(s.stage==='failure'&&!timing.failure)timing.failure=t;
    if(s.view==='drive'&&timing.failure&&!timing.drive)timing.drive=t;
    if(s.stage==='runaway'&&!timing.run)timing.run=t;
    if(s.stage==='detected'&&!timing.detected)timing.detected={t,y:carGrp.position.y,v:s.detectedSpeed};
    if(ovsDemo.stage==='rope-break'&&!timing.rupture)timing.rupture=t;
    if(ovsDemo.stage==='rope-break'&&ovsDemo.breakProgress===1&&!timing.separated)timing.separated=t;
    if(ovsDemo.shot==='shaft'&&timing.separated&&!timing.shaft)timing.shaft=t;
   };
   gsap.ticker.add(probe);AscentDemo.start('normal');
  },fps);
  await page.waitForFunction(()=>window.timing.detected,null,{timeout:45000});
  const ascent=await page.evaluate(()=>({gearSeconds:(timing.drive-timing.failure)/1000,ascentSeconds:(timing.detected.t-timing.run)/1000,y:timing.detected.y,v:timing.detected.v}));
  assert.ok(ascent.gearSeconds>=4.2&&ascent.gearSeconds<4.8,JSON.stringify(ascent));
  assert.ok(ascent.ascentSeconds>=4.05&&ascent.ascentSeconds<4.6,JSON.stringify(ascent));
  await page.evaluate(()=>AscentDemo.reset());await page.waitForFunction(()=>!AscentDemo.active);
  await page.evaluate(()=>{const dy=FLOOR_Y[3]+S.CAR_H/2-carGrp.position.y;carGrp.position.y+=dy;cwtGrp.position.y-=dy;curFloor=3;refreshRopes();startOverspeedFault(document.getElementById('btn-overspeed'));});
  await page.waitForFunction(()=>window.timing.shaft,null,{timeout:25000});
  const rope=await page.evaluate(()=>({ruptureSeconds:(timing.separated-timing.rupture)/1000,holdSeconds:(timing.shaft-timing.separated)/1000}));
  assert.ok(rope.ruptureSeconds>=2.25&&rope.ruptureSeconds<2.8,JSON.stringify(rope));
  assert.ok(rope.holdSeconds>=1.85&&rope.holdSeconds<2.4,JSON.stringify(rope));
  await page.evaluate(()=>resetGovernorFault(document.getElementById('btn-overspeed')));
  await page.waitForFunction(()=>!overspeedActive&&!moving&&currentState===ELEVATOR_STATE.DOOR_OPEN);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>ovsDemo.stage==='rest'&&governorPhase==='rest'&&controls.enabled&&ropeObjs.every(r=>r.carDrop.visible)),true);
  results.push({name,width,fps,...ascent,...rope});console.log(JSON.stringify(results.at(-1)));await page.close();
 }
 assert.ok(Math.abs(results[0].ascentSeconds-results[2].ascentSeconds)<.25,'Low FPS does not halve simulation speed');
 assert.ok(results.every(r=>Math.abs(r.y-results[0].y)<1e-7&&r.v===results[0].v),'Detection distance and speed remain identical');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
