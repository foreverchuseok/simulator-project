import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='temporary/desktop-hud';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1280,height:850},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];
// 캡처 파일 저장으로 Live Server가 검증 중 페이지를 재시작하지 않도록 한다.
await page.routeWebSocket('**', socket=>socket.close());
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
const url=process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html';
const ready=async()=>{await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>CarDoor.state?.ready&&govHandles()?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(1500);};
const reset=async()=>{
 const token=await page.evaluate(()=>window.__resetProbe=String(Math.random()));
 await Promise.all([page.waitForEvent('domcontentloaded'),page.click('#pc-reset')]);
 await page.waitForFunction(()=>CarDoor.state?.ready&&govHandles()?.ready&&document.querySelector('#loading.hide'));
 assert.notEqual(await page.evaluate(()=>window.__resetProbe),token);
 assert.deepEqual(await page.evaluate(()=>({floor:curFloor,moving,estop,insMode,overspeedActive,walking:!!CharacterWalk.active,query:location.search})),{floor:0,moving:false,estop:false,insMode:false,overspeedActive:false,walking:false,query:''});
};
const measure=()=>page.evaluate(()=>new Promise(resolve=>{const samples=[];let previous;function frame(t){if(previous)samples.push(t-previous);previous=t;if(samples.length<180)requestAnimationFrame(frame);else{samples.sort((a,b)=>a-b);resolve({median:samples[90],p95:samples[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,shadows:renderer.shadowMap.enabled});}}requestAnimationFrame(frame);}));
try{
 await ready();const after=await measure();
 assert.equal(await page.locator('#pc-dock').isVisible(),true);
 assert.equal(await page.locator('#pc-dock #fbtns').count(),1);
 for(const id of ['c-shaft','pc-settings-source']){await page.click('#'+id);await page.screenshot({path:`${out}/${id}.png`});await page.keyboard.press('Escape');}
 await page.click('#c-shaft');await page.click('#c-cabin');await page.click('#c-shaft');await page.click('#overview-home');
 await page.click('#btn-estop');assert.equal(await page.evaluate(()=>estop),true);await page.click('#btn-estop');
 await page.click('[data-f="1"]');await page.waitForFunction(()=>curFloor===1&&!moving&&doorOpen);
 await page.click('#pc-mode [data-ins="on"]');await page.waitForFunction(()=>insMode);
 const up=page.locator('#pc-manual-controls [data-ins-dir="1"]');await up.focus();await page.keyboard.down(' ');await page.waitForFunction(()=>insDir===1);await page.waitForTimeout(400);await page.keyboard.up(' ');assert.equal(await page.evaluate(()=>insDir),0);
 const pos=await up.boundingBox();await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();await page.waitForFunction(()=>insDir===1);await page.mouse.move(600,300);await page.mouse.up();assert.equal(await page.evaluate(()=>insDir),0);
 await page.screenshot({path:`${out}/manual.png`});
 await reset();
 await page.keyboard.press('Escape');
 await page.click('#walk-toggle');assert.equal(await page.evaluate(()=>!!CharacterWalk.active),true);await page.click('#walk-exit');
 for(const size of [{width:901,height:560},{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:1280,height:850}]){
  await page.setViewportSize(size);await page.waitForTimeout(300);
  const desktop=size.width>=901&&size.height>=560;
  assert.equal(await page.locator('#pc-dock').isVisible(),desktop,JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight,body:document.body.className,hidden:document.getElementById('pc-dock').hidden,errors:[]}))));
  assert.equal(await page.locator('#pc-dock #fbtns').count(),desktop?1:0);
  const bad=await page.evaluate(()=>[...document.querySelectorAll('#pc-dock button,#statusbar,#dd-op button,#rail button,#walk-toggle')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').flatMap(e=>{const r=e.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1?[e.id||e.textContent]:[]}));assert.deepEqual(bad,[]);
  await page.screenshot({path:`${out}/${size.width}x${size.height}.png`});
 }
 await page.click('[data-f="3"]');await page.waitForFunction(()=>moving);await reset();
 await page.click('#btn-estop');await reset();
 await page.click('#walk-toggle');await reset();
 await page.evaluate(()=>{document.body.classList.add('relay-story');document.getElementById('hud').inert=true;});
 await page.screenshot({path:`${out}/reset-hidden-hud.png`});await reset();
 assert.equal(await page.locator('#dd-reset').count(),0);
 // Same scene/camera/GPU with the desktop presentation disabled for baseline.
 await page.route('**/js/desktop-hud.js*',route=>route.fulfill({contentType:'text/javascript',body:'const DesktopHUD={init(){}};'}));
 await ready();const before=await measure();
 assert.deepEqual(errors,[]);
 const result={checks:['menus','camera','estop','floor arrival','keyboard/pointer hold release','full reset from inspection/moving/estop/character/hidden and inert HUD','character entry/exit','six responsive sizes'],before,after,errors};
 fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){console.error(errors);await page.screenshot({path:`${out}/failure.png`});throw error;}finally{await browser.close();}
