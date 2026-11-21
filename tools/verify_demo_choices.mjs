// Live Server: node tools/verify_demo_choices.mjs [--mobile]
import assert from 'node:assert/strict';import fs from 'node:fs';import {chromium} from 'playwright';
const mobile=process.argv.includes('--mobile'),out='.shot-demo-choices';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--enable-gpu']}),p=await b.newPage({viewport:{width:mobile?390:1280,height:850},hasTouch:mobile,isMobile:mobile});
p.setDefaultTimeout(90000);const errors=[],results=[];p.on('pageerror',e=>{errors.push(e.stack);console.error(e.message);});
const press=s=>p.locator(s)[mobile?'tap':'click']();
try{
 await p.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>govHandles()?.ready&&mrGrp.userData.traction.ready&&CarDoor.secured()&&hatchDoors.every(h=>h.interlock?.ready)&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&document.querySelector('#loading.hide'));
 await press('#m-demo-fab');
 assert.equal(await p.locator('#m-demo-list > li').count(),13);
 assert.equal(await p.locator('#m-demo-list [role="tab"], #demo-panel-risk').count(),0);
 assert.equal(await p.locator('#m-demo-list [data-demo="gov"]').textContent(),'과속 조절기');
 assert.equal(await p.evaluate(()=>DemoExit.active||moving),false);
 await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-compact.png`});
 await press('#m-demo-fab');
 if(!mobile){const style=await p.locator('#btn-estop').evaluate(e=>({image:getComputedStyle(e).backgroundImage,shadow:getComputedStyle(e).boxShadow}));assert.equal(style.image,'none');assert.equal(style.shadow,'none');}
 for(const [key,modes,module]of [['door',['normal','none'],'UCMDemo'],['up',['normal','none'],'AscentDemo'],['brake',['dual','single'],'BrakeDemo']]){
  for(const mode of modes){
   await p.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&CarDoor.secured());
   await press('#m-demo-fab');await press(`#m-demo-list [data-demo="${key}"] ${mobile?'.demo-disclosure':'.demo-name'}`);
   const list=p.locator(mobile?'#m-demo-preview':`#demo-options-${key}`);assert.equal(await list.isVisible(),true);assert.equal(await list.locator(mobile?'.demo-preview-modes button':'button').count(),2);
   assert.equal(await p.evaluate(()=>DemoExit.active),false,'heading never starts a demo');
   await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-${key}-${mode}.png`});
   await press(mobile?`#m-demo-preview [data-preview-mode="${mode}"]`:`#demo-options-${key} [data-demo-mode="${mode}"]`);
   if(mobile){assert.equal(await p.evaluate(()=>DemoExit.active),false,'condition selection does not start a demo');await press('#m-demo-play');}
   await p.waitForFunction(()=>DemoExit.active&&!document.getElementById('demo-exit').hidden);
   const selected=await p.evaluate(name=>name==='UCMDemo'?UCMDemo.state.mode:name==='AscentDemo'?AscentDemo.state.mode:BrakeDemo.state.mode,module);
   assert.equal(selected,mode);assert.equal(await p.locator('#m-demo-list').isVisible(),false);
   if(key==='door')assert.equal(await p.locator('#ucm-brake').inputValue(),mode);
   if(key==='up')assert.equal(await p.locator(`[data-ascent-mode="${mode}"]`).getAttribute('aria-pressed'),'true');
   if(key==='brake')assert.equal(await p.locator(`[data-brake-mode="${mode}"]`).getAttribute('aria-pressed'),'true');
   await press('#demo-exit');await p.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&CarDoor.secured());results.push({key,mode});console.log('PASS',key,mode);
  }
 }
 await press('#m-demo-fab');
 for(const key of ['door','up','brake'])assert.equal(await p.locator(`#demo-options-${key}`).isVisible(),!mobile,'mobile pairs start folded; PC pairs remain visible');
 if(mobile)for(const size of [{width:320,height:568},{width:844,height:390}]){
  await p.setViewportSize(size);await p.waitForTimeout(350);
  if(await p.locator('#m-demo-list').isVisible())await press('#m-demo-fab');
  await press('#m-demo-fab');
  await press('#m-demo-list [data-demo="up"] .demo-disclosure');
  const box=await p.locator('#m-demo-list').boundingBox(),option=await p.locator('#m-demo-preview').boundingBox();
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+.5&&box.y+box.height<=size.height+.5,JSON.stringify({size,box}));
  assert.ok(option.x+option.width<=box.x&&option.y>=0&&option.y+option.height<=size.height+.5,'preview fits left of the right icon rail');
  await p.screenshot({path:`${out}/mobile-${size.width}x${size.height}.png`});
 }
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/${mobile?'mobile':'desktop'}-results.json`,JSON.stringify({results,errors},null,2));console.log('ALL PASS');
}catch(e){await p.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-failure.png`}).catch(()=>{});throw e;}finally{await b.close();}
