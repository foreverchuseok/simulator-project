import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-portrait');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async()=>{await page.waitForTimeout(400);const bad=await page.evaluate(()=>{const visible=[...document.querySelectorAll('#hud button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');return visible.flatMap(e=>{const b=e.getBoundingClientRect();return b.width<43.5||b.height<43.5||b.x<0||b.y<0||b.right>innerWidth+1||b.bottom>innerHeight+1?[{id:e.id||e.textContent,x:b.x,y:b.y,w:b.width,h:b.height}]:[]})});assert.deepEqual(bad,[],'Visible controls fit viewport and touch targets');};
try{
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?legacyIcons`,{waitUntil:'networkidle'});await page.waitForFunction(()=>govHandles()?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(7500);
for(const viewport of [{width:390,height:844},{width:360,height:740},{width:320,height:568},{width:412,height:915}]){
 await page.setViewportSize(viewport);await page.waitForTimeout(250);await check();
 await page.tap('[data-menu="dd-view"]');await check();assert.equal(await page.locator('#dd-inst').count(),0);
 await page.screenshot({path:path.join(out,`tools-${viewport.width}.png`)});
 await page.tap('#dd-view [data-close]');
 await page.evaluate(()=>InspectionStations.toggle('car'));await page.waitForFunction(()=>InspectionStations.ready);await check();
 const drive=await page.locator('#inspection-drive').boundingBox();assert.ok(drive.x>=0&&drive.x+drive.width<=viewport.width);assert.equal(await page.locator('#inspection-drive button').count(),3);
 await page.screenshot({path:path.join(out,`mode-${viewport.width}.png`)});await page.evaluate(()=>setInspectionMode(false));
 await page.tap('#mobile-visibility');assert.equal(await page.locator('#dd-op').evaluate(e=>getComputedStyle(e).visibility),'hidden');await check();
 await page.tap('#mobile-visibility');await check();assert.equal(await page.locator('#dd-op').evaluate(e=>getComputedStyle(e).visibility),'visible');
}
// Orientation preserves the three-button panel; the retired global menu stays absent.
await page.evaluate(()=>InspectionStations.toggle('car'));await page.waitForFunction(()=>InspectionStations.ready);
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);assert.equal(await page.locator('#inspection-drive button').count(),3);assert.equal(await page.locator('#dd-inst').count(),0);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.evaluate(()=>setInspectionMode(false));
await page.evaluate(()=>{HallManual.select(1);HallManual.observe();});await page.waitForFunction(()=>!document.getElementById('hall-action-1').hidden);await page.tap('#hall-action-1');assert.equal(await page.locator('#hall-panel').isVisible(),true);await page.screenshot({path:path.join(out,'hall.png')});await page.tap('[data-menu="dd-view"]');assert.equal(await page.locator('#hall-panel').isVisible(),false);await page.tap('[data-menu="dd-view"]');
await page.tap('#btn-estop');assert.equal(await page.evaluate(()=>currentState),'ESTOP');assert.equal(await page.locator('#btn-estop span').textContent(),'RESET');await page.tap('#btn-estop');
await page.tap('[data-f="1"]');await page.waitForFunction(()=>curFloor===1&&!moving);await page.waitForFunction(()=>doorOpen);await page.screenshot({path:path.join(out,'arrived.png')});
await page.tap('#c-shaft');await page.tap('#overview-home');await page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0);await page.screenshot({path:path.join(out,'overview.png')});await page.tap('#mobile-visibility');await page.screenshot({path:path.join(out,'hidden.png')});
assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:4,orientation:true,mode:true,hall:true,hideRestore:true,estop:true,floorArrival:true,errors}));
}catch(error){console.error(await page.evaluate(()=>({state:currentState,ladder:PitLadder.deployed,secured:PitLadder.secured,ucm:UCMDemo.state.stage,status:document.getElementById('v-dir').textContent})));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
