// Live Server: PC / --mobile / --narrow. Actual phone performance is a separate check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const width=process.argv.includes('--narrow')?320:process.argv.includes('--mobile')?390:1280;
const out=`.shot-ascent-bear-${width}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],results=[];
const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1,hasTouch:width<600,isMobile:width<600});
const press=s=>page.locator(s)[width<600?'tap':'click']();
const until=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:90000});
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
try{
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.routeWebSocket('**',ws=>ws.close());
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await until(()=>govHandles()?.ready&&mrGrp.userData.traction.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready));
 await page.evaluate(()=>{
  gsap.ticker.lagSmoothing(0);window.ascentSounds=[];
  for(const key of ['ropeBrakeBang','bufferImpact']){const fn=MACH[key];MACH[key]=(...args)=>{ascentSounds.push({key,stage:AscentDemo.state.stage,mode:AscentDemo.state.mode,
   up:scene.getObjectByName('BrakeUpperJaw').position.y,lo:scene.getObjectByName('BrakeLowerJaw').position.y,contact:govHandles().switchLever.userData.contactClosed});return fn(...args);};}
  window.ascentInitial={up:scene.getObjectByName('BrakeUpperJaw').position.y,lo:scene.getObjectByName('BrakeLowerJaw').position.y,y:carGrp.position.y,cwt:cwtGrp.position.y,bearParent:Mascot.root.parent.uuid,bearPosition:Mascot.root.position.toArray(),bearScale:Mascot.root.scale.toArray(),bearVisible:Mascot.root.visible};
  window.ascentMonitor={sumError:0,maxLift:0,minLift:0,drumError:0,wedge:0};
  gsap.ticker.add(()=>{if(!AscentDemo.active)return;const s=AscentDemo.state,m=ascentMonitor;
    m.sumError=Math.max(m.sumError,Math.abs(carGrp.position.y+cwtGrp.position.y-ascentInitial.y-ascentInitial.cwt));
    if(s.stage==='passenger'){m.maxLift=Math.max(m.maxLift,s.lift);m.minLift=Math.min(m.minLift,s.lift);}
    m.wedge=Math.max(m.wedge,Math.abs(carGrp.userData.safetyGear.shaft.rotation.x));
    if(mrGrp.userData.traction.driveBroken){m.drum??=mrGrp.userData.traction.worm.rotation.z;m.drumError=Math.max(m.drumError,Math.abs(m.drum-mrGrp.userData.traction.worm.rotation.z));}else m.drum=undefined;
  });
 });
 async function showIcons(){await page.evaluate(()=>{const body=scene.getObjectByName('RopeBrake');controls.enableDamping=false;controls.target.copy(body.getWorldPosition(new THREE.Vector3()));camera.position.copy(body.localToWorld(new THREE.Vector3(.8,.4,-1.1)));controls.update();});await until(()=>!document.getElementById('ascent-action').hidden);}
 for(const mode of ['normal','none']){
  await showIcons();await shot(`${mode}-icons`);
  const icons=await page.evaluate(()=>['rope-brake-action','ascent-action'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
  assert.ok(icons[1].x>=icons[0].x+icons[0].w+4,'two separate icons');
  await press('#ascent-action');await press(`[data-ascent-mode="${mode}"]`);await press('#btn-ascent');
  await until(()=>AscentDemo.state.stage==='failure');await shot(`${mode}-failure`);
  await until(()=>AscentDemo.state.view==='drive');await page.waitForTimeout(850);await shot(`${mode}-drive-shock`);
  await until(()=>AscentDemo.state.stage==='runaway');await page.waitForTimeout(3900);await shot(`${mode}-bear-ascent`);
  await until(()=>AscentDemo.state.view==='governor');
  const ascentSeconds=await page.evaluate(()=>(performance.now()-AscentDemo.state.runStart)/1000);
  assert.ok(ascentSeconds>3.9&&ascentSeconds<4.9,`1.3x ascent playback: ${ascentSeconds}s`);
  await page.waitForTimeout(420);await shot(`${mode}-governor`);
  await until(()=>AscentDemo.state.stage==='switch');await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>AscentDemo.state.view),'governor');await shot(`${mode}-switch`);
  await until(()=>AscentDemo.state.view==='brake');await page.waitForTimeout(430);await shot(`${mode}-brake`);
  await until(()=>AscentDemo.state.stage==='stopped');await shot(`${mode}-stop`);
  await until(()=>AscentDemo.state.stage==='passenger');await page.waitForTimeout(mode==='none'?950:400);await shot(`${mode}-passenger`);
  await until(()=>AscentDemo.state.stage==='done');await shot(`${mode}-result`);
  const r=await page.evaluate(()=>({mode:AscentDemo.state.mode,detected:AscentDemo.state.detectedSpeed,threshold:AscentDemo.state.tripSpeed,
    slip:AscentDemo.state.gripY===null?null:AscentDemo.state.stopY-AscentDemo.state.gripY,y:carGrp.position.y,contactY:AscentDemo.state.contactY,stroke:bufferGrp.userData.cwt.stroke||0,
    switch:govHandles().switchLever.rotation.z,switchAngle:govHandles().switchLever.rotation.z+govHandles().mechanism.switchRestAngle,closed:govHandles().switchLever.userData.contactClosed,ropeLocked:govHandles().ropeLocked,
    detectedY:AscentDemo.state.detectedY,third:FLOOR_Y[2]+S.CAR_H/2,fourth:FLOOR_Y[3]+S.CAR_H/2,jump:AscentDemo.state.jumpHeight,injured:AscentDemo.state.injured,
    bear:Mascot.root.name,bearVisible:Mascot.root.visible,inspecting:Mascot.inspecting,
    estop,moving,doorOpen,locked:CarDoor.secured(),monitor:{...ascentMonitor},sounds:ascentSounds.filter(s=>s.mode===AscentDemo.state.mode)}));
  assert.ok(r.detectedY>r.third&&r.detectedY<r.fourth);assert.equal(r.bear,'MachineRoomMascot');assert.equal(r.bearVisible&&r.inspecting,true);assert.equal(r.injured,mode==='none');assert.ok(mode==='none'?r.jump>1:r.jump<.4);
  assert.equal(r.detected,r.threshold);assert.ok(Math.abs(r.switchAngle-75*Math.PI/180)<1e-5);assert.equal(r.closed,false);assert.equal(r.ropeLocked,false);assert.equal(r.doorOpen,false);assert.equal(r.locked,true);assert.equal(r.estop,true);assert.equal(r.moving,false);
  assert.ok(r.monitor.sumError<1e-8);assert.ok(r.monitor.drumError<1e-8);assert.equal(r.monitor.wedge,0);assert.ok(r.monitor.maxLift>=.19);assert.ok(r.monitor.minLift>=0);
  if(mode==='normal'){assert.ok(Math.abs(r.slip-.085)<1e-8);assert.equal(r.sounds.length,1);assert.equal(r.sounds[0].key,'ropeBrakeBang');assert.equal(r.sounds[0].contact,false);
    const jaws=await page.evaluate(()=>({up:scene.getObjectByName('BrakeUpperJaw').position.y-ascentInitial.up,lo:scene.getObjectByName('BrakeLowerJaw').position.y-ascentInitial.lo}));assert.ok(Math.abs(jaws.up+.013)<1e-9&&Math.abs(jaws.lo-.009)<1e-9);
  }else{assert.ok(Math.abs(r.y-r.contactY-r.stroke)<1e-8);assert.equal(r.sounds.length,1);assert.equal(r.sounds[0].key,'bufferImpact');}
  r.ascentSeconds=ascentSeconds;results.push(r);console.log('RESULT',JSON.stringify(r));await press('#fault-reset');await until(()=>!AscentDemo.active);
  assert.equal(await page.evaluate(()=>!overspeedActive&&!moving&&!estop&&currentState===ELEVATOR_STATE.IDLE&&govHandles().switchLever.userData.contactClosed&&scene.getObjectByName('RopeBrakeInstallation').visible&&!UCMDemo.character.visible&&CarDoor.secured()),true);
  assert.equal(await page.evaluate(()=>!Mascot.inspecting&&Mascot.root.parent.uuid===ascentInitial.bearParent&&JSON.stringify(Mascot.root.position.toArray())===JSON.stringify(ascentInitial.bearPosition)&&JSON.stringify(Mascot.root.scale.toArray())===JSON.stringify(ascentInitial.bearScale)&&Mascot.root.visible===ascentInitial.bearVisible),true);
 }
 // Cancel across every ownership boundary; no callback may restart a stopped demonstration.
 for(const stage of process.argv.includes('--quick')?[]:['preparing','failure','switch','closing','passenger']){
  await page.evaluate(stage=>{window.ascentAborted=false;const watch=()=>{if(AscentDemo.state.stage===stage){gsap.ticker.remove(watch);AscentDemo.reset();window.ascentAborted=true;}};gsap.ticker.add(watch);AscentDemo.start('normal');},stage);
  await until(()=>window.ascentAborted&&!AscentDemo.active);await page.waitForTimeout(250);
  const restored=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,initial:ascentInitial,moving,estop,active:overspeedActive,controls:controls.enabled,character:UCMDemo.character.visible,phase:governorPhase,drive:mrGrp.userData.traction.driveBroken}));
  assert.ok(Math.abs(restored.y-restored.initial.y)<1e-9&&Math.abs(restored.cwt-restored.initial.cwt)<1e-9);
  assert.equal(restored.moving||restored.estop||restored.active||restored.character||restored.drive,false);assert.equal(restored.controls,true);assert.equal(restored.phase,'rest');console.log('CANCEL',stage,'OK');
 }
 await page.evaluate(()=>AscentDemo.start('normal'));await until(()=>AscentDemo.state.stage==='runaway');await press('#btn-estop');await until(()=>!AscentDemo.active);
 await page.evaluate(()=>moveElevator(1));await until(()=>curFloor===1&&!moving);
 if(width===1280&&!process.argv.includes('--quick')){
  await until(()=>currentState===ELEVATOR_STATE.IDLE&&CarDoor.secured());
  await page.evaluate(()=>{const s=document.getElementById('speed-select');s.value='90';s.dispatchEvent(new Event('change'));});
  for(const mode of ['normal','none']){
   const before=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,cam:camera.position.toArray(),floor:curFloor}));
   await page.evaluate(mode=>AscentDemo.start(mode),mode);await until(()=>AscentDemo.state.stage==='done');
   assert.ok(Math.abs(await page.evaluate(()=>AscentDemo.state.detectedSpeed)-1.95)<1e-9);
   const gap=await page.evaluate(()=>{scene.updateMatrixWorld(true);return new THREE.Box3().setFromObject(Mascot.root).min.y-new THREE.Box3().setFromObject(carGrp.getObjectByName('carFloorFinish')).max.y;});assert.ok(gap>=-.001,`passenger floor gap ${gap}`);
   await press('#ucm-exit');await until(()=>!AscentDemo.active);
   const after=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,cam:camera.position.toArray(),floor:curFloor}));
   assert.ok(Math.abs(after.y-before.y)<1e-9&&Math.abs(after.cwt-before.cwt)<1e-9);assert.equal(after.floor,before.floor);after.cam.forEach((v,i)=>assert.ok(Math.abs(v-before.cam[i])<1e-5));
   console.log('90 m/min + non-first-floor restore',mode,'OK',gap);
  }
  await page.evaluate(()=>{AscentDemo.start();moveElevator(2);openDoors();setInspectionMode(true);});
  assert.equal(await page.evaluate(()=>insMode||doorOpen),false);
  await until(()=>AscentDemo.state.stage==='detected');await page.evaluate(()=>resetInspections());await until(()=>!inspectionResetting&&!AscentDemo.active&&!overspeedActive);
  console.log('Inspection reset OK');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({width,results,errors},null,2));console.log('verify_ascent OK',width);
}catch(e){await shot('failure');console.error('STATE',await page.evaluate(()=>({state:AscentDemo.state,moving,estop,phase:governorPhase,errors:document.getElementById('v-dir').textContent})));throw e;}
finally{await browser.close();}
