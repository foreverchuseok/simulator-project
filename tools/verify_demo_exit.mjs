// Live Server: node tools/verify_demo_exit.mjs [--mobile]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const mobile=process.argv.includes('--mobile'),out='.shot-demo-exit';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']}),page=await browser.newPage({viewport:{width:mobile?390:1280,height:850},hasTouch:mobile,isMobile:mobile});
page.setDefaultTimeout(90000);const errors=[],results=[];page.on('pageerror',e=>{errors.push(e.stack);console.error(e.message);});
const press=s=>page.locator(s)[mobile?'tap':'click']();
const cases=[
 ['ucm',()=>UCMDemo.start(document.getElementById('btn-ucm'))],
 ['ascent',()=>AscentDemo.start('normal')],['brake',()=>BrakeDemo.start('dual')],
 ['ard',()=>ARDDemo.start()],['manual',()=>ManualRescueDemo.start()],['photo',()=>PhotoEyeDemo.start()],
 ['terminal',()=>TerminalDemo.start('final',1)],['rope',()=>RopeMeasure.start()],
 ['interlock',()=>InterlockDemo.start(1)],['relay',()=>RelayRopeDemo.start(1)],['retention',()=>RetentionDemo.start(1)],
 ['car-buffer',()=>BufferDemo.start('car')],['cwt-buffer',()=>BufferDemo.start('cwt')],
 ['governor',()=>startOverspeedFault(document.getElementById('btn-overspeed'))]
];
async function check(name,start,paused=false,open=false,until){
 await page.waitForFunction(()=>!DemoExit.active&&!moving&&CarDoor.secured());
 if(open){await page.evaluate(()=>openDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN);}
 await page.evaluate(code=>{eval('('+code+')')();},start.toString());
 await page.waitForFunction(()=>!document.getElementById('demo-exit').hidden);
 if(until)await page.waitForFunction(until,null,{timeout:90000});
 if(paused){
  await page.evaluate(()=>{if(BufferDemo.active)document.getElementById('buffer-demo-pause').click();else if(RetentionDemo.active)document.getElementById('retention-demo-pause').click();else DemoPause.set(true);});
 }
 await page.waitForTimeout(120);
 const t=Date.now();await press('#demo-exit');
 await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&!moving&&!estop&&CarDoor.secured(),null,{timeout:5000});
 const elapsed=Date.now()-t;assert.ok(elapsed<2000,`${name}: cancel took ${elapsed}ms`);
 const state=await page.evaluate(()=>({floor:curFloor,y:carGrp.position.y,sum:carGrp.position.y+cwtGrp.position.y,paused:DemoPause.paused,
  timelinePaused:gsap.globalTimeline.paused(),controls:controls.enabled,door:doorOpen,token:window.exitToken,logo:outdoorPresentation.logoVisible,
  gap:camera.position.distanceTo(new THREE.Vector3(...overviewCameraPose().position)),fsm:currentState,parts:hatchDoors.some(h=>h.manualActive),gear:carGrp.userData.safetyGear.shaft.rotation.x}));
 assert.equal(state.token,'same-page');assert.equal(state.logo,false);assert.equal(state.paused,false);assert.equal(state.timelinePaused,false);
 assert.equal(state.controls,true);assert.equal(state.door,false);assert.equal(state.parts,false);assert.ok(state.gap<.001);assert.ok(Math.abs(state.gear)<1e-5);
 assert.ok(Math.abs(state.sum-initial.sum)<1e-4);assert.equal(state.floor,0);assert.ok(Math.abs(state.y-initial.y)<1e-4);
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>DemoExit.active),false,`${name}: no delayed restart`);
 results.push({name,paused,open,elapsed});console.log('PASS',name,paused?'paused':'running',open?'pending':'',elapsed);
}
let initial;
try{
 await page.routeWebSocket('**',ws=>ws.close());
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&mrGrp.userData.traction.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready)&&document.querySelector('#loading.hide'));
 initial=await page.evaluate(()=>{window.exitToken='same-page';setBranchLogoVisible(false);return{y:carGrp.position.y,sum:carGrp.position.y+cwtGrp.position.y};});
 assert.equal(await page.locator('#demo-exit').isVisible(),false);
 if(process.argv.includes('--late')){
  const late=[['ucm',()=>UCMDemo.state.rise>.005],['ascent',()=>mrGrp.userData.traction.driveBroken],['brake',()=>BrakeDemo.state.stage==='failure'],
   ['ard',()=>ARDDemo.state.stage==='blackout'],['car-buffer',()=>BufferDemo.state.compression>.01],['governor',()=>governorPhase==='tripped']];
  for(const [name,until]of late){await check(name+'-late',cases.find(c=>c[0]===name)[1],true,false,until);}
 }else{
  for(const [name,start]of cases){await check(name,start);await check(name,start,true);}
  for(const name of ['car-buffer','terminal','governor']){const c=cases.find(c=>c[0]===name);await check(name+'-preparing',c[1],false,true);await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>DemoExit.active),false);}
 }
 await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-overview.png`});assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/${mobile?'mobile':'desktop'}${process.argv.includes('--late')?'-late':''}-results.json`,JSON.stringify({results,errors},null,2));console.log('ALL PASS');
}catch(e){await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-failure.png`}).catch(()=>{});console.error(await page.evaluate(()=>({demo:DemoPause.demo,busy:DemoExit.busy,state:currentState,governor:governorPhase,errors:document.body.className})).catch(()=>null));throw e;}
finally{await browser.close();}
