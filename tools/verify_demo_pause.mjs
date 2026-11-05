import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright';
const phone=process.argv.includes('--phone'),mobile=phone||process.argv.includes('--mobile'),out='.shot-demo-pause';fs.mkdirSync(out,{recursive:true});
const cases=[
 ['ucm',()=>UCMDemo.start(document.getElementById('btn-ucm')),'demo-pause'],
 ['ascent',()=>AscentDemo.start('normal'),'demo-pause'],
 ['brake',()=>BrakeDemo.start('dual'),'demo-pause'],
 ['ard',()=>ARDDemo.start(),'demo-pause'],
 ['manual',()=>ManualRescueDemo.start(),'demo-pause'],
 ['photo',()=>PhotoEyeDemo.start(),'demo-pause'],
 ['terminal',()=>TerminalDemo.start('final',1),'demo-pause'],
 ['rope',()=>RopeMeasure.start(),'demo-pause'],
 ['interlock',()=>InterlockDemo.start(1),'demo-pause'],
 ['relay',()=>RelayRopeDemo.start(1),'demo-pause'],
 ['retention',()=>RetentionDemo.start(1),'retention-demo-pause'],
 ['car-buffer',()=>BufferDemo.start('car'),'buffer-demo-pause'],
 ['cwt-buffer',()=>BufferDemo.start('cwt'),'buffer-demo-pause'],
 ['governor',()=>startOverspeedFault(document.getElementById('btn-overspeed')),'demo-pause']
];
const browser=phone?await chromium.connectOverCDP('http://127.0.0.1:9222'):await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const context=phone?browser.contexts()[0]:await browser.newContext({viewport:{width:mobile?390:1280,height:850},hasTouch:mobile,isMobile:mobile});
const page=phone?context.pages().find(p=>p.url().includes('localhost:5500')):await context.newPage();page.setDefaultTimeout(90000);const cdp=await context.newCDPSession(page),errors=[],report=[];page.on('pageerror',e=>{errors.push(e.stack);console.log('PAGE ERROR',e.message);});await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
if(phone)await page.route(/^https:\/\//,r=>{const f='temporary/background-phone/vendor/'+new URL(r.request().url()).pathname.split('/').at(-1);return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:'text/javascript'}):r.continue();});
const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
const press=async id=>{const s='#'+id;if(!phone)return page.locator(s)[mobile?'tap':'click']();const r=await page.locator(s).boundingBox();assert.ok(r,id);await touch('touchStart',[[r.x+r.width/2,r.y+r.height/2]]);await page.waitForTimeout(70);await touch('touchEnd');await page.waitForTimeout(100);};
const wake=()=>{if(phone&&process.env.SIM_ADB)execFileSync(process.env.SIM_ADB,['shell','input','keyevent','KEYCODE_WAKEUP'],{stdio:'ignore'});};
const wakeTimer=phone&&process.env.SIM_ADB?setInterval(wake,10000):null;wake();
const close=async()=>{await page.evaluate(()=>DemoExit.cancel());await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&!moving&&!estop&&CarDoor.secured());};
try{
 await page.goto(phone?'http://localhost:5500/index.html':process.env.SIM_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});await page.bringToFront();
 await page.waitForFunction(()=>govHandles()?.ready&&mrGrp.userData.traction.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready)&&document.querySelector('#loading.hide'));
 await page.evaluate(()=>{
  window.pauseView=()=>({p:camera.position.toArray(),t:controls.target.toArray(),q:camera.quaternion.toArray(),fov:camera.fov,zoom:camera.zoom,near:camera.near,far:camera.far,enabled:controls.enabled,rotate:controls.enableRotate,pan:controls.enablePan,dolly:controls.enableZoom,damping:controls.enableDamping,min:controls.minDistance,max:controls.maxDistance,polar:controls.maxPolarAngle});
  window.pauseModel=()=>({car:carGrp.position.y,cwt:cwtGrp.position.y,time:gsap.globalTimeline.time(),ucm:UCMDemo.state.stage,up:AscentDemo.state.stage,brake:BrakeDemo.state.stage,interlock:InterlockDemo.phase,retention:RetentionDemo.state.phase,relay:RelayRopeDemo.state.phase,buffer:BufferDemo.state.stage,
   passenger:[UCMDemo.passengerParts.body.position.toArray(),...UCMDemo.passengerParts.legs.map(o=>o.rotation.toArray())],mascot:[Mascot.root.position.toArray(),Mascot.rig.body.position.toArray(),Mascot.rig.head.rotation.toArray()]});
 });
 const late=[
  ['ucm-moving',cases[0][1],'demo-pause',()=>UCMDemo.state.stage==='moving'],
  ['ascent-runaway',cases[1][1],'demo-pause',()=>AscentDemo.state.stage==='runaway'],
  ['ard-cabin',cases[3][1],'demo-pause',()=>['cabin','rescue'].includes(ARDDemo.state.stage)],
  ['terminal-moving',cases[6][1],'demo-pause',()=>TerminalDemo.state.speed>.1]
 ];
 const selected=process.argv.includes('--late')?late:process.argv.includes('--quick')?cases.filter(c=>['interlock','ard','retention','car-buffer'].includes(c[0])):cases;
 for(const [key,start,id,until] of selected){
  await page.evaluate(code=>{eval('('+code+')')();},start.toString());await page.waitForFunction(id=>{const e=document.getElementById(id);return e&&!e.hidden&&e.getClientRects().length;},id);if(until)await page.waitForFunction(until);await page.waitForTimeout(250);
  await page.evaluate(id=>{document.getElementById(id).addEventListener('click',()=>{window.pauseExpected=pauseView();window.pauseTweens=[...gsap.getTweensOf(camera.position),...gsap.getTweensOf(controls.target)];},{once:true,capture:true});},id);
  await press(id);await page.waitForFunction(()=>DemoPause.paused);const frozen=await page.evaluate(()=>pauseModel());
  assert.equal(await page.evaluate(()=>controls.enabled&&controls.enableRotate&&controls.enablePan&&controls.enableZoom),true,key+': navigation enabled');
  const before=await page.evaluate(()=>pauseView());const v=await page.evaluate(()=>({w:innerWidth,h:innerHeight})),x=v.w*.43,y=v.h*.30;
  if(mobile){
   await touch('touchStart',[[x,y]]);await touch('touchMove',[[x+65,y+25]]);await touch('touchEnd');await page.waitForTimeout(80);
   const rotated=await page.evaluate(()=>pauseView());assert.ok(Math.hypot(...rotated.p.map((n,i)=>n-before.p[i]))>.01,key+': finger rotation');
   await touch('touchStart',[[x-35,y],[x+35,y]]);await touch('touchMove',[[x-30,y+22],[x+90,y+22]]);await touch('touchEnd');
  }else{
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y+30,{steps:5});await page.mouse.up();
   const rotated=await page.evaluate(()=>pauseView());assert.ok(Math.hypot(...rotated.p.map((n,i)=>n-before.p[i]))>.01,key+': mouse rotation');
   await page.mouse.wheel(0,-180);await page.mouse.down({button:'right'});await page.mouse.move(x+40,y+70,{steps:5});await page.mouse.up({button:'right'});
  }
  await page.waitForTimeout(180);const after=await page.evaluate(()=>pauseView()),distance=a=>Math.hypot(...a.p.map((n,i)=>n-a.t[i]));
  assert.ok(Math.abs(distance(after)-distance(before))>.005,key+': zoom changes distance');
  assert.ok(Math.hypot(...after.t.map((n,i)=>n-before.t[i]))>.001,key+': pan changes target');
  assert.deepEqual(await page.evaluate(()=>pauseModel()),frozen,key+': scene and timeline remain frozen while exploring');
  assert.equal(await page.evaluate(()=>pauseTweens.every(t=>!!t.parent)),true,key+': original camera tweens retained');
  if(['interlock','retention','car-buffer'].includes(key))await page.screenshot({path:`${out}/${phone?'phone':mobile?'mobile':'pc'}-${key}-inspect.png`});
  await page.evaluate(id=>document.getElementById(id).addEventListener('click',()=>{window.pauseRestored=pauseView();},{once:true}),id);await press(id);
  const restored=await page.evaluate(()=>({expected:pauseExpected,actual:pauseRestored,paused:DemoPause.paused}));assert.equal(restored.paused,false,key+': resumes');
  for(const k of ['p','t','q'])restored.actual[k].forEach((n,i)=>assert.ok(Math.abs(n-restored.expected[k][i])<1e-6,key+': restored '+k));
  for(const k of ['fov','zoom','near','far','enabled','rotate','pan','dolly','damping','min','max','polar'])assert.equal(restored.actual[k],restored.expected[k],key+': restored '+k);
  await page.waitForTimeout(250);assert.ok(await page.evaluate(t=>gsap.globalTimeline.time()>t,frozen.time),key+': scenario continues');
  // Cancel while freely exploring too: no paused parent timeline, camera settings or input locks may remain.
  if(await page.evaluate(()=>DemoExit.active)&&await page.locator('#'+id).isVisible()){await press(id);await close();}
  else await close();
  assert.equal(await page.evaluate(()=>DemoPause.paused||gsap.globalTimeline.paused()||document.body.classList.contains('demo-inspecting')),false,key+': exit releases inspection');
  assert.equal(await page.evaluate(()=>controls.enabled&&controls.enableRotate&&controls.enableZoom&&controls.enablePan),true,key+': controls usable after exit');
  report.push({key,rotated:true,zoomed:true,panned:true,exactReturn:true});console.log('PASS',key,'freeze / rotate / zoom / pan / exact return / resume / exit');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${phone?'phone':mobile?'mobile':'pc'}${process.argv.includes('--late')?'-late':''}-report.json`,JSON.stringify({report,errors},null,2));console.log('ALL PASS',report.length);
}catch(e){await page.screenshot({path:`${out}/${phone?'phone':mobile?'mobile':'pc'}-failure.png`}).catch(()=>{});console.error('STATE',await page.evaluate(()=>({demo:DemoPause.demo,paused:DemoPause.paused,enabled:controls.enabled,car:carGrp.position.y,stage:document.getElementById('v-dir').textContent})).catch(()=>null));throw e;}
finally{if(wakeTimer)clearInterval(wakeTimer);if(phone)await page.unrouteAll();await browser.close();}
