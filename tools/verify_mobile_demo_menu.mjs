// node tools/verify_mobile_demo_menu.mjs — 모바일 「시연」 메뉴 · 단일 탭 무작동 · 두 번 탭 확대 · PC 직접 클릭 검사.
// 브라우저 터치 에뮬레이션 결과다. 실제 휴대폰 조작을 대신하지 않는다.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-mobile-demo-menu');fs.mkdirSync(out,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.mp3':'audio/mpeg','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={};
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
const shot=n=>page.screenshot({path:path.join(out,n+'.png')});
const vis=sel=>page.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';},sel);
const demoOn=()=>page.evaluate(()=>!!(DemoPause.demo||PhotoEyeDemo.active||ARDDemo.active||overspeedActive));
const lookAtGovernor=()=>page.evaluate(()=>{const g=govHandles().wheel.parent,p=new THREE.Vector3();g.getWorldPosition(p);camera.position.set(p.x+1.2,p.y+.6,p.z+1.6);controls.target.copy(p);controls.update();});
// PartGlow 가 맞히는 화면 좌표 한 곳 — 현재 시점에서 격자 탐색.
const findPart=()=>page.evaluate(()=>{for(let y=120;y<innerHeight-120;y+=14)for(let x=20;x<innerWidth-20;x+=14){const p=PartGlow.pickAt(x,y);if(p)return{x,y,name:p.name};}return null;});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(1200);
 // 1) 시연 아이콘
 assert.equal(await vis('#m-demo-fab'),true,'fab visible');assert.equal(await vis('#m-demo-list'),false,'list closed');
 const fab=await page.evaluate(()=>{const b=document.getElementById('m-demo-fab').getBoundingClientRect(),s=document.getElementById('statusbar').getBoundingClientRect();return{w:b.width,h:b.height,right:innerWidth-b.right,top:b.top,statusBottom:s.bottom};});
 report.fab=fab;assert.ok(fab.w<=50&&fab.h<=56&&fab.top>=fab.statusBottom,'fab small and below status '+JSON.stringify(fab));
 await shot('1-base');
 // 2) 단일 탭 무작동
 await lookAtGovernor();await page.waitForTimeout(800);
 const part=await findPart();report.part=part;assert.ok(part,'a pickable part is on screen');
 const camBefore=await page.evaluate(()=>camera.position.toArray());
 await page.touchscreen.tap(part.x,part.y);await page.waitForTimeout(700);
 assert.equal(await vis('#part-menu'),false,'single tap: no part menu');
 assert.equal(await demoOn(),false,'single tap: no demo started');
 const camSingle=await page.evaluate(()=>camera.position.toArray());
 assert.ok(Math.hypot(...camSingle.map((v,i)=>v-camBefore[i]))<1e-3,'single tap: camera unchanged');
 report.singleTap='no menu, no demo, no camera move';
 // 3) 두 번 탭 확대
 await page.touchscreen.tap(part.x,part.y);await page.waitForTimeout(120);await page.touchscreen.tap(part.x,part.y);
 await page.waitForTimeout(1300);
 const camDouble=await page.evaluate(()=>camera.position.toArray()),moved=Math.hypot(...camBefore.map((v,i)=>v-camDouble[i]));
 const dist=await page.evaluate(()=>camera.position.distanceTo(controls.target));
 assert.ok(moved>.1,'double tap moves camera '+moved);assert.equal(await vis('#part-menu'),false,'double tap: still no menu');assert.equal(await demoOn(),false,'double tap: no demo');
 report.doubleTap={moved:+moved.toFixed(3),distance:+dist.toFixed(3)};await shot('2-double-tap');
 await page.evaluate(()=>document.getElementById('overview-home').click());await page.waitForTimeout(1200);
 // 4) 메뉴 열기 · 목록 · 바깥 탭 닫힘 · 시연 시작
 await page.tap('#m-demo-fab');assert.equal(await vis('#m-demo-list'),true,'list open');
 const items=await page.$$eval('#m-demo-list button',bs=>bs.map(b=>b.textContent.trim()));report.items=items;assert.ok(items.length>=12&&items.every(t=>t.length>=2),'readable names');
 const box=await page.evaluate(()=>{const b=document.getElementById('m-demo-list').getBoundingClientRect(),m=document.getElementById('m-bar').getBoundingClientRect();return{top:b.top,bottom:b.bottom,barTop:m.top,right:b.right,w:innerWidth};});
 assert.ok(box.bottom<=box.barTop+.5&&box.right<=box.w+.5,'list fits above bar '+JSON.stringify(box));await shot('3-list');
 await page.touchscreen.tap(60,300);await page.waitForTimeout(200);assert.equal(await vis('#m-demo-list'),false,'outside tap closes list');
 await page.tap('#m-demo-fab');
 const t0=Date.now();await page.tap('#m-demo-list button:has-text("문닫힘 안전장치")');
 assert.equal(await vis('#m-demo-list'),false,'list hidden immediately after choose');
 await page.waitForFunction(()=>PhotoEyeDemo.active,null,{timeout:20000});report.startMs=Date.now()-t0;
 assert.equal(await page.evaluate(()=>MobileHUD.mode),'demo');assert.equal(await vis('#m-demo-fab'),false,'fab hidden in demo');
 await page.waitForTimeout(1500);await shot('4-demo');
 assert.equal(await vis('#demo-pause'),true,'pause visible');await page.tap('#demo-pause');assert.equal(await page.evaluate(()=>DemoPause.paused),true,'paused');
 await page.tap('#demo-pause');assert.equal(await page.evaluate(()=>DemoPause.paused),false,'resumed');
 await page.waitForFunction(()=>!document.getElementById('m-demo-exit').disabled,null,{timeout:20000});
 await page.tap('#m-demo-exit');await page.waitForFunction(()=>!PhotoEyeDemo.active&&MobileHUD.mode==='base',null,{timeout:30000});
 assert.equal(await vis('#m-demo-fab'),true,'fab returns after demo');report.demoFlow='start→hidden→pause→resume→exit→fab back';
 // 두 번째 시연(ARD) — 앞 시연 뒤 잔여 상태 영향을 피하려고 새로 불러온다
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>govHandles()?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&CarDoor.state?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(1500);
 await page.tap('#m-demo-fab');await page.tap('#m-demo-list button:has-text("ARD 자동구출")');
 await page.waitForFunction(()=>ARDDemo.active,null,{timeout:20000});await page.waitForTimeout(800);await shot('5-ard');
 await page.waitForFunction(()=>!document.getElementById('m-demo-exit').disabled,null,{timeout:30000}).catch(()=>{});
 await page.tap('#m-demo-exit').catch(()=>{});
 await page.waitForFunction(()=>!ARDDemo.active,null,{timeout:30000}).catch(async()=>{await page.evaluate(()=>{ARDDemo.halt();ARDDemo.reset();});});
 await page.waitForTimeout(800);
 // 5) 가로 · PC 전환
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(500);
 assert.equal(await vis('#m-demo-fab'),true,'landscape fab');await page.tap('#m-demo-fab');
 const lb=await page.evaluate(()=>{const b=document.getElementById('m-demo-list').getBoundingClientRect();return{top:b.top,bottom:b.bottom,h:innerHeight};});
 assert.ok(lb.top>=0&&lb.bottom<=lb.h+.5,'landscape list inside screen '+JSON.stringify(lb));await shot('6-landscape');await page.tap('#m-demo-fab');
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(600);
 assert.equal(await vis('#m-demo-fab'),false,'PC: no fab');
 // 6) PC 직접 클릭 유지
 await lookAtGovernor();await page.waitForTimeout(800);
 const pc=await findPart();assert.ok(pc,'PC part on screen');
 await page.mouse.click(pc.x,pc.y);await page.waitForTimeout(500);
 const pcResult=await page.evaluate(()=>({menu:!document.getElementById('part-menu').hidden,demo:!!DemoPause.demo||overspeedActive||UCMDemo.state.active}));
 report.pcClick={part:pc.name,...pcResult};assert.ok(pcResult.menu||pcResult.demo,'PC click activates part');
 await shot('7-pc');
 assert.deepEqual(errors,[],'page errors '+errors.join('|'));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));console.log(JSON.stringify(report,null,1));console.log('PASS');
}catch(e){await shot('fail').catch(()=>{});console.error('FAIL',e.message,errors);process.exitCode=1;}finally{await browser.close();server.close();}
