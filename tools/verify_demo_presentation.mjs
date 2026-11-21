// Live Server: node tools/verify_demo_presentation.mjs [--phone] [--layout-only]
// --phone uses an already connected Android Chrome CDP endpoint (PHONE_CDP_URL).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const phone=process.argv.includes('--phone'),out=process.env.DEMO_PRESENTATION_OUT||'.shot-demo-presentation';fs.mkdirSync(out,{recursive:true});
const browser=phone?await chromium.connectOverCDP(process.env.PHONE_CDP_URL||'http://127.0.0.1:9223'):await chromium.launch({args:['--enable-gpu']});
const page=phone?browser.contexts()[0].pages().find(p=>/https?:\/\/(?:localhost|127\.0\.0\.1):5500\//.test(p.url())):await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
assert.ok(page,'simulator phone tab');page.setDefaultTimeout(90000);
const cd=await page.context().newCDPSession(page),errors=[],checks=[];
const tag=phone?'phone':'mobile';page.on('pageerror',e=>{errors.push(e.stack);console.error(e.message);});
const touch=(type,points=[])=>cd.send('Input.dispatchTouchEvent',{type,touchPoints:points});
const point=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
const press=async selector=>{await touch('touchStart',[await point(selector)]);await touch('touchEnd');};
const exit=async()=>{await press('#demo-exit');await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&CarDoor.secured());await page.locator('#m-demo-guide').waitFor({state:'hidden'});};
const bounds=async()=>{
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight})),box=await page.locator('#m-demo-guide').boundingBox();
 assert.ok(box&&box.height<=70&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+.5&&box.y+box.height<=viewport.height+.5,JSON.stringify({viewport,box}));
 assert.equal(await page.locator('#m-demo-details').count(),0,'no expandable explanation panel');
 assert.equal(await page.locator('.m-demo-source:visible').count(),0,'all original explanation panels hidden');
 const text=await page.locator('.m-guide-summary').evaluate(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,whiteSpace:getComputedStyle(e).whiteSpace}));
 assert.ok(text.text.split('\n').length<=2&&text.scrollHeight<=text.height+1&&text.scrollWidth<=text.width+1,'subtitle fits two lines '+JSON.stringify(text));
 return{viewport,box};
};
try{
 await cd.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(phone&&process.argv.includes('--local-files'))await page.route('http://127.0.0.1:5500/**',r=>{
  const file=path.resolve('.'+decodeURIComponent(new URL(r.request().url()).pathname));
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
  return file.startsWith(process.cwd()+path.sep)&&fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'}):r.continue();
 });
 for(const name of ['three.min.js','gsap.min.js','OrbitControls.js','GLTFLoader.js']){
  const file='temporary/background-phone/vendor/'+name;
  if(fs.existsSync(file))await page.route('https://**/'+name,r=>r.fulfill({body:fs.readFileSync(file),contentType:'text/javascript'}));
 }
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.bringToFront();
 await page.waitForFunction(()=>govHandles()?.ready&&CarDoor.secured()&&mrGrp.userData.traction.ready&&hatchDoors.every(h=>h.interlock?.ready)&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&document.querySelector('#loading.hide'));
 console.log('LOADED',tag);
 const fab=await page.locator('#m-demo-fab').boundingBox();
 await press('#m-demo-fab');
 assert.equal(await page.locator('.demo-skill').count(),13);
 const rail=await page.locator('#m-demo-list').boundingBox(),width=await page.evaluate(()=>innerWidth);
 assert.ok(width-rail.x-rail.width<=15&&rail.width===58,'rail stays on the right');
 assert.deepEqual(await page.locator('#m-demo-fab').boundingBox(),fab,'opening does not move the demo button');
 const style=await page.locator('.demo-skill').evaluateAll(buttons=>buttons.map(b=>({color:getComputedStyle(b).color,fill:getComputedStyle(b).backgroundImage,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height,icon:b.querySelector('svg').getBoundingClientRect().width})));
 assert.equal(new Set(style.map(s=>s.color)).size,1,'uniform icon color');assert.ok(style.every(s=>s.w===46&&s.h===46&&s.icon===31&&s.fill==='none'));
 assert.equal(await page.locator('.demo-name:visible').count(),0);
 const iconSelector=key=>`#m-demo-list [data-demo="${key}"]`+(['door','up','brake','buffer'].includes(key)?' .demo-disclosure':'');
 for(const key of ['gov','door','up','brake','power','hand','eye','limit','rope','lock','link','buffer','shield']){
  await press(iconSelector(key));
  assert.equal(await page.locator('#m-demo-preview strong').textContent(),await page.locator(iconSelector(key)+' .demo-name').textContent());
  assert.equal(await page.locator('#m-demo-play').isVisible(),true);
  for(const mode of await page.locator('#m-demo-preview [data-preview-mode]').all()){
   await press('[data-preview-mode="'+await mode.getAttribute('data-preview-mode')+'"]');
   assert.equal(await page.evaluate(()=>DemoExit.active||moving),false,'condition selection is a preview');
  }
  await press(iconSelector(key));await page.waitForTimeout(150);
  assert.equal(await page.locator('#m-demo-preview').isVisible(),false,'tapping the selected icon again closes the preview');
  assert.equal(await page.locator('#m-demo-list').isVisible(),true,'closing the preview keeps the demo menu open');
  assert.equal(await page.locator(iconSelector(key)).evaluate(e=>e.classList.contains('selected')||e.getAttribute('aria-expanded')==='true'),false,'tapping again clears selection state');
  assert.equal(await page.evaluate(()=>DemoExit.active||moving),false,'repeated icon taps never start a demo');
 }
 await press(iconSelector('shield'));
 assert.equal(await page.locator('#m-demo-preview').isVisible(),true,'tapping a closed icon reopens the preview');
 await page.screenshot({path:`${out}/${tag}-reopened.png`});
 await press(iconSelector('shield'));
 assert.equal(await page.locator('#m-demo-preview').isVisible(),false,'second tap hides the preview again');
 assert.equal(await page.locator('#m-demo-list').isVisible(),true,'list stays open after hiding preview');
 await page.screenshot({path:`${out}/${tag}-toggled-closed.png`});
 await press(iconSelector('rope'));await page.screenshot({path:`${out}/${tag}-preview.png`});
 await press(iconSelector('brake'));await page.screenshot({path:`${out}/${tag}-choices.png`});
 await press('#m-demo-fab');await press('#m-demo-fab');
 assert.equal(await page.locator('#m-demo-preview').isVisible(),false,'reopening clears the selection');
 await page.screenshot({path:`${out}/${tag}-menu.png`});
 await press('#m-demo-fab');
 const cases=[['terminal','limit'],['ucm','door'],['ascent','up'],['brake','brake'],['ard','power'],['manual','hand'],['photo','eye'],['rope','rope'],['interlock','lock'],['relay','link'],['retention','shield'],['car-buffer','buffer','car'],['cwt-buffer','buffer','cwt'],['governor','gov']];
 if(!process.argv.includes('--layout-only'))for(const [name,key,mode] of cases){
  console.log('START',tag,name);
  if(name==='terminal'&&process.argv.includes('--manual-reset'))await page.evaluate(()=>TerminalDemo.start('final',-1));
  else{
   await press('#m-demo-fab');await press(iconSelector(key));
   if(mode)await press(`[data-preview-mode="${mode}"]`);
   assert.equal(await page.evaluate(()=>DemoExit.active||moving),false);await press('#m-demo-play');
   assert.equal(await page.locator('#m-demo-preview').isVisible(),false);
  }
  await page.waitForFunction(()=>DemoExit.active&&!document.getElementById('m-demo-guide').hidden);await page.waitForTimeout(180);
  checks.push({name,...await bounds()});
  if(name==='terminal'&&process.argv.includes('--manual-reset')){
   await page.waitForFunction(()=>TerminalDemo.state.stage==='manual');await page.waitForTimeout(150);
   assert.equal(await page.locator('#m-demo-guide-action').innerText(),'수동 복귀');await press('#m-demo-guide-action');
   await page.waitForFunction(()=>['recover','done'].includes(TerminalDemo.state.stage));await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);});
  }
  if(name==='retention'){
   await page.waitForFunction(()=>RetentionDemo.state.phase==='stagger');await press('#m-demo-guide-action');await page.waitForFunction(()=>DemoPause.paused);
   assert.ok((await page.locator('#m-demo-guide').boundingBox()).y>await page.evaluate(()=>innerHeight-90));
   await page.screenshot({path:`${out}/${tag}-retention.png`});await press('#m-demo-guide-action');assert.equal(await page.evaluate(()=>DemoPause.paused),false);
  }
  if(['photo','rope','car-buffer'].includes(name))await page.screenshot({path:`${out}/${tag}-${name}.png`});
  await exit();console.log('PASS',tag,name);
 }
 if(!phone){
  for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:600,height:960},{width:844,height:390},{width:740,height:360}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(180);await press('#m-demo-fab');
   await press('[data-demo="buffer"] .demo-disclosure');
   const options=await page.locator('#m-demo-preview').boundingBox();assert.ok(options.x>=0&&options.y>=0&&options.x+options.width<=viewport.width&&options.y+options.height<=viewport.height);
   await page.screenshot({path:`${out}/menu-${viewport.width}.png`});await press('#m-demo-fab');
  }
  await page.evaluate(()=>TerminalDemo.start('slowdown',1));await page.waitForFunction(()=>TerminalDemo.state.stage==='run');await page.evaluate(()=>DemoPause.set(true));
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:740,height:360}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(200);checks.push({layout:true,...await bounds()});
  }
  await page.setViewportSize({width:1280,height:850});await page.waitForTimeout(200);
  assert.equal(await page.locator('#m-demo-guide').isVisible(),false);assert.equal(await page.locator('#terminal-demo-panel').isVisible(),true);
  assert.equal(await page.locator('#terminal-demo-panel').evaluate(e=>e.parentElement===document.body),true,'original panel never moved');
  await page.locator('#demo-exit').click();await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy);
  await page.setViewportSize({width:390,height:844});
  for(const key of ['ucm','brake','buffer']){
   await page.evaluate(k=>{gsap.globalTimeline.timeScale(12);if(k==='ucm')UCMDemo.start(document.getElementById('btn-ucm'));else if(k==='brake')BrakeDemo.start('dual');else{BufferDemo.timing.holdPit=.2;BufferDemo.timing.holdUnder=.2;BufferDemo.timing.holdTop=.2;BufferDemo.start('car');}},key);
   await page.waitForFunction(k=>k==='ucm'?UCMDemo.state.stage==='done':k==='brake'?BrakeDemo.state.stage==='held':BufferDemo.state.stage==='done',key);await page.waitForTimeout(200);
   await bounds();await page.screenshot({path:`${out}/result-${key}.png`});await exit();console.log('RESULT PASS',key);
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${tag}-results.json`,JSON.stringify({checks,errors},null,2));console.log('ALL PASS',tag,checks.length);
}catch(e){await page.screenshot({path:`${out}/${tag}-failure.png`}).catch(()=>{});throw e;}
finally{await page.unrouteAll().catch(()=>{});await cd.send('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});await browser.close();}
