// Live Server integration, visual captures and recovery. Touch emulation is not a real phone test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const width=process.argv.includes('--narrow')?320:process.argv.includes('--mobile')?390:1280;
const out=`.shot-brake-room-${width}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),errors=[],results=[];
const reduced=process.argv.includes('--reduced');
const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600,reducedMotion:reduced?'reduce':'no-preference'});
const until=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:90000});
const press=s=>page.locator(s)[width<600?'tap':'click']();
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
try{
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.routeWebSocket('**',ws=>ws.close());
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});
 await until(()=>mrGrp.userData.traction.ready&&govHandles()?.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready));
 await page.evaluate(()=>{
  gsap.ticker.lagSmoothing(0);
  window.brakeInitial={y:carGrp.position.y,cwt:cwtGrp.position.y,bear:Mascot.root.position.toArray(),parent:Mascot.root.parent.uuid,scale:Mascot.root.scale.toArray(),visible:Mascot.root.visible,guard:scene.getObjectByName('SheaveGuard').position.toArray(),guardVisible:scene.getObjectByName('SheaveGuard').visible};
  window.brakeMonitor={sumError:0,wormError:0,rightArm:0,bearShown:false,brokenGear:false,jawMotion:0,coveredMotion:false,carView:false};
  const jaw=scene.getObjectByName('BrakeUpperJaw'),jaw0=jaw.position.y;
  gsap.ticker.add(()=>{if(!BrakeDemo.active||BrakeDemo.state.stage==='resetting')return;
   const t=mrGrp.userData.traction,m=brakeMonitor;
   m.sumError=Math.max(m.sumError,Math.abs(carGrp.position.y+cwtGrp.position.y-brakeInitial.y-brakeInitial.cwt));
   m.wormError=Math.max(m.wormError,Math.abs(t.worm.rotation.z-t.wormPerSheave*mainSheaveGrp.rotation.z));m.brokenGear ||=!!t.driveBroken;
   if(BrakeDemo.state.mode==='dual')m.rightArm=Math.max(m.rightArm,Math.abs(t.arms[1].rotation.z));
   m.bearShown ||=Mascot.root.visible;m.carView ||=BrakeDemo.state.view==='car';
   if(['settling','runaway','danger'].includes(BrakeDemo.state.stage))m.coveredMotion ||=scene.getObjectByName('SheaveGuard').visible;
   m.jawMotion=Math.max(m.jawMotion,Math.abs(jaw.position.y-jaw0));
  });
 });
 async function icons(){await page.evaluate(()=>{const t=mrGrp.userData.traction;controls.enableDamping=false;controls.target.copy(t.model.localToWorld(new THREE.Vector3(t.contract.wheelX,t.contract.dualBrake.springY,t.contract.drumZ)));camera.position.copy(controls.target).add(new THREE.Vector3(-.85,1.0,1.3));controls.update();});await until(()=>!document.getElementById('brake-compare-action').hidden);}
 async function restored(){
  await until(()=>!BrakeDemo.active);await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,initial:brakeInitial,bear:Mascot.root.position.toArray(),parent:Mascot.root.parent.uuid,scale:Mascot.root.scale.toArray(),visible:Mascot.root.visible,dual:mrGrp.userData.traction.compare.dual.every(o=>o.visible),single:mrGrp.userData.traction.compare.single.some(o=>o.visible),arms:mrGrp.userData.traction.arms.map(a=>a.rotation.z),moving,estop,overspeedActive,controls:controls.enabled,inspection:Mascot.inspecting,guard:scene.getObjectByName('SheaveGuard').position.toArray(),guardVisible:scene.getObjectByName('SheaveGuard').visible,ending:document.getElementById('brake-compare-ending').hidden}));
  assert.ok(Math.abs(r.y-r.initial.y)<1e-8&&Math.abs(r.cwt-r.initial.cwt)<1e-8);assert.deepEqual(r.bear,r.initial.bear);assert.deepEqual(r.scale,r.initial.scale);assert.equal(r.parent,r.initial.parent);assert.equal(r.visible,r.initial.visible);
  assert.equal(r.dual,true);assert.equal(r.single||r.moving||r.estop||r.overspeedActive||r.inspection,false);assert.equal(r.controls,true);assert.deepEqual(r.arms,[0,0]);
  assert.deepEqual(r.guard,r.initial.guard);assert.equal(r.guardVisible,r.initial.guardVisible);assert.equal(r.ending,true);
 }
 for(const mode of ['dual','single']){
  await icons();await shot(`${mode}-icon`);await press('#brake-compare-action');await press(`[data-brake-mode="${mode}"]`);await shot(`${mode}-panel`);await press('#btn-brake-compare');
  await until(()=>BrakeDemo.state.stage==='holding');await page.waitForTimeout(850);await shot(`${mode}-holding`);
  const holding=await page.evaluate(()=>({arms:mrGrp.userData.traction.arms.map(a=>a.rotation.z),single:mrGrp.userData.traction.compare.single.every(o=>o.visible),dual:mrGrp.userData.traction.compare.dual.every(o=>o.visible)}));
  assert.deepEqual(holding.arms,[0,0]);assert.equal(holding.single,mode==='single');assert.equal(holding.dual,mode==='dual');
  await until(()=>BrakeDemo.state.stage==='failure');await page.waitForTimeout(700);await shot(`${mode}-failure`);
  const frame=await page.evaluate(()=>{
   const t=mrGrp.userData.traction,parts=BrakeDemo.state.mode==='single'?t.compare.singleSpring:t.compare.dualSpringL;
   const b=new THREE.Box3();parts.forEach(o=>b.union(new THREE.Box3().setFromObject(o)));
   const points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(new THREE.Vector3(x,y,z).project(camera).toArray());
   return {points,wallGap:camera.position.x-(-S.SHAFT_W/2+MR_LINING_T)};
  });
  assert.ok(frame.wallGap>.05,'brake camera remains inside wall');assert.ok(frame.points.every(p=>Math.abs(p[0])<.99&&Math.abs(p[1])<.99),'broken spring stays in frame');
  await until(()=>BrakeDemo.state.stage==='uncovering');await page.waitForTimeout(450);await shot(`${mode}-guard-lift`);
  await until(()=>['settling','runaway'].includes(BrakeDemo.state.stage));
  const motion0=await page.evaluate(()=>({angle:mainSheaveGrp.rotation.z,uv:getWireRopeMat().map.offset.x}));
  await page.waitForTimeout(350);await shot(`${mode}-sheave-motion`);
  const motion1=await page.evaluate(()=>({angle:mainSheaveGrp.rotation.z,uv:getWireRopeMat().map.offset.x,guard:scene.getObjectByName('SheaveGuard').visible}));
  assert.ok(Math.abs(motion1.angle-motion0.angle)>.005);assert.ok(Math.abs(motion1.uv-motion0.uv)>.001);assert.equal(motion1.guard,false);
  if(mode==='single'){
   await until(()=>BrakeDemo.state.stage==='danger');const a=await page.evaluate(()=>mainSheaveGrp.rotation.z);await page.waitForTimeout(650);await shot('single-danger-running');
   assert.ok(Math.abs(await page.evaluate(()=>mainSheaveGrp.rotation.z)-a)>.2,'sheave continues through warning');
   if(reduced)assert.equal(await page.evaluate(()=>renderer.domElement.getAnimations().length),0);
  }
  await until(()=>['held','paused'].includes(BrakeDemo.state.stage));await shot(`${mode}-result`);
  const r=await page.evaluate(()=>({mode:BrakeDemo.state.mode,rise:BrakeDemo.state.rise,v:BrakeDemo.state.v,stage:BrakeDemo.state.stage,arms:mrGrp.userData.traction.arms.map(a=>a.rotation.z),monitor:{...brakeMonitor},caption:document.getElementById('brake-compare-ending').textContent,switchClosed:govHandles().switchLever.userData.contactClosed,angle:mainSheaveGrp.rotation.z}));
  assert.equal(r.monitor.brokenGear||r.monitor.bearShown||r.monitor.coveredMotion||r.monitor.carView,false);assert.ok(r.monitor.sumError<1e-8&&r.monitor.wormError<1e-8);assert.equal(r.monitor.rightArm,0);assert.equal(r.monitor.jawMotion,0);assert.equal(r.switchClosed,true);
  if(mode==='dual'){assert.ok(Math.abs(r.rise-.045)<1e-8);assert.equal(r.v,0);assert.ok(r.arms[0]>.01);assert.equal(r.arms[1],0);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>mainSheaveGrp.rotation.z),r.angle);}else{assert.ok(Math.abs(r.rise-1.8)<1e-8);assert.ok(r.v>0);assert.match(r.caption,/실제 제동된 상태가 아닙니다/);assert.ok(r.arms[0]>.01&&r.arms[1]<-.01);}
  results.push(r);console.log('RESULT',JSON.stringify(r));await press('#fault-reset');await restored();
 }
 if(!process.argv.includes('--quick')){
  for(const [mode,stage] of [['dual','preparing'],['single','holding'],['dual','failure'],['dual','uncovering'],['dual','settling'],['single','danger']]){
   await page.evaluate(({mode,stage})=>{window.brakeAborted=false;const watch=()=>{if(BrakeDemo.state.stage===stage){gsap.ticker.remove(watch);BrakeDemo.reset();brakeAborted=true;}};gsap.ticker.add(watch);BrakeDemo.start(mode);},{mode,stage});
   await until(()=>window.brakeAborted);await restored();console.log('CANCEL',mode,stage,'OK');
  }
 }
 await page.evaluate(()=>BrakeDemo.start('single'));await until(()=>BrakeDemo.state.stage==='runaway');await press('#btn-estop');await restored();
 await page.evaluate(()=>{BrakeDemo.start('dual');moveElevator(2);openDoors();setInspectionMode(true);});
 assert.equal(await page.evaluate(()=>insMode||doorOpen),false);await until(()=>BrakeDemo.state.stage==='failure');await page.evaluate(()=>resetInspections());await until(()=>!inspectionResetting);await restored();
 await page.evaluate(()=>moveElevator(1));await until(()=>curFloor===1&&!moving);await until(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);await page.evaluate(()=>closeDoors());await until(()=>currentState===ELEVATOR_STATE.IDLE&&CarDoor.secured());
 const fromFloor=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor}));
 await page.evaluate(()=>BrakeDemo.start('single'));await until(()=>BrakeDemo.state.stage==='paused');await press('#ucm-exit');await until(()=>!BrakeDemo.active);
 const after=await page.evaluate(()=>({y:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor}));assert.deepEqual(after,fromFloor);
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({width,reduced,results,errors},null,2));console.log('PASS brake comparison',width);
}catch(e){await shot('failure');console.error('STATE',await page.evaluate(()=>({state:BrakeDemo.state,status:document.getElementById('v-dir').textContent})).catch(()=>null),errors);throw e;}
finally{await browser.close();}
