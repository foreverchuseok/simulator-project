// node tools/verify_mobile_hud.mjs — 모바일 HUD(js/mobile-hud.js) 배치·조작·모드 전환·PC 복귀 검사.
// 브라우저 터치 에뮬레이션 결과다. 실제 휴대폰 조작·성능 검증을 대신하지 않는다.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-mobile-hud');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.mp3':'audio/mpeg'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[],report={};
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
const shot=n=>page.screenshot({path:path.join(out,n+'.png')});
const settle=()=>page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
// 보이는 HUD 조작부: 터치 44px 이상, 화면 안, 서로 겹치지 않음(같은 묶음 안의 자식은 제외).
const layout=()=>page.evaluate(()=>{
 const vis=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
 const ids=['statusbar','m-bar','dd-op','pc-manual-controls','walk-panel','walk-stick','inspection-drive','photo-eye-panel','rope-measure-panel','terminal-demo-panel','interlock-demo-panel','relay-demo-panel','ard-panel','manual-rescue-panel'];
 const boxes=ids.map(id=>[id,document.getElementById(id)]).filter(([,e])=>vis(e)).map(([id,e])=>[id,e.getBoundingClientRect()]);
 const bad=[];
 document.querySelectorAll('#m-bar > *, #dd-op button').forEach(e=>{if(!vis(e))return;const b=e.getBoundingClientRect();
  const min=innerWidth<=340||innerHeight<=340?39.5:43.5;if(b.width<min||b.height<min||b.x<-.5||b.y<-.5||b.right>innerWidth+.5||b.bottom>innerHeight+.5)bad.push({id:e.id||e.textContent.trim(),w:b.width|0,h:b.height|0,x:b.x|0,y:b.y|0});});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const[a,A]=boxes[i],[b,B]=boxes[j];
  const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left),oy=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);if(ox>.5&&oy>.5)bad.push({overlap:a+'/'+b});}
 if(document.documentElement.scrollWidth>innerWidth)bad.push({scrollWidth:document.documentElement.scrollWidth});
 return {bad,shown:[...document.querySelectorAll('#m-bar > *')].filter(vis).map(e=>e.id)};
});
const expectBar=async(ids,label)=>{const l=await layout();assert.deepEqual(l.bad,[],label+' layout '+JSON.stringify(l.bad));assert.deepEqual(l.shown,ids,label+' bar buttons');};
const BASE=['m-run','m-ins','m-home','m-cabin','m-walk','m-settings','btn-estop'];
let cdp;const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
const pinch=async(cx,cy,from,to)=>{await touch('touchStart',[[cx-from,cy],[cx+from,cy]]);for(let i=1;i<=8;i++){const d=from+(to-from)*i/8;await touch('touchMove',[[cx-d,cy],[cx+d,cy]]);await page.waitForTimeout(16);}await touch('touchEnd',[]);};
try{
cdp=await context.newCDPSession(page);
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(1200);
 // 1) 화면 크기별 기본 배치 · 운행 띠
 for(const v of [{width:390,height:844},{width:360,height:740},{width:320,height:568},{width:412,height:915},{width:844,height:390},{width:568,height:320}]){
  await page.setViewportSize(v);await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('m-hud')&&MobileHUD.mode),'base');
  await expectBar(BASE,`${v.width}x${v.height} base`);
  assert.equal(await page.locator('#rail').isVisible(),false);assert.equal(await page.locator('#dd-op').isVisible(),false);
  await page.tap('#m-run');assert.equal(await page.locator('#dd-op').isVisible(),true);await expectBar(BASE,`${v.width} run`);
  await shot(`run-${v.width}x${v.height}`);
  await page.tap('#m-settings');await page.waitForTimeout(350);assert.equal(await page.locator('#dd-op').isVisible(),false,'settings closes run strip');
  assert.equal(await page.evaluate(()=>document.getElementById('dd-view').classList.contains('open')),true);
  const sheet=await page.locator('#dd-view').boundingBox(),barBox=await page.locator('#m-bar').boundingBox(),status=await page.locator('#statusbar').boundingBox();
  const apart=(a,b)=>a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1;
  if(!(apart(sheet,status)&&apart(sheet,barBox)))console.error(JSON.stringify({v,sheet,status,barBox}));
  assert.ok(apart(sheet,status)&&apart(sheet,barBox)&&sheet.y>=-.5&&sheet.y+sheet.height<=v.height+.5,'sheet clears status card and bar');
  await shot(`settings-${v.width}x${v.height}`);await page.tap('#m-settings');
 }
 report.viewports=6;
 // 2) 운행: 띠의 층 버튼·도어 → 도착·폐문
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 await page.tap('#m-run');await page.tap('[data-f="2"]');await page.waitForFunction(()=>curFloor===2&&!moving&&doorOpen&&!CarDoor.state.busy);
 await page.tap('#btn-close');await page.waitForFunction(()=>!doorOpen&&CarDoor.secured());
 assert.equal(await page.locator('#dd-op').isVisible(),true,'run strip stays open while operating');report.run=true;
 // 2-1) 수동(점검)운전: 바 버튼으로 전환 → ▲▼ 띠 표시 → 자동 복귀
 await page.tap('#m-run');
 await page.tap('#m-ins');await page.waitForFunction(()=>insMode&&!document.getElementById('pc-manual-controls').hidden);
 assert.equal(await page.locator('#pc-manual-controls').isVisible(),true);assert.equal(await page.getAttribute('#m-ins','aria-pressed'),'true');
 await expectBar(BASE,'ins');await shot('ins-on');
 await page.tap('#m-ins');await page.waitForFunction(()=>!insMode&&!moving);
 assert.equal(await page.locator('#pc-manual-controls').isVisible(),false);report.ins=true;
 // 3) 전체 보기 한 번에 복귀 · 카 정면 토글
 await page.evaluate(()=>{camera.position.set(2,5,3);controls.target.set(0,4,0);controls.update();});
 await page.tap('#m-home');await settle();
 const home=await page.evaluate(()=>{const p=overviewCameraPose();return camera.position.distanceTo(new THREE.Vector3(...p.position))+controls.target.distanceTo(new THREE.Vector3(...p.target));});
 assert.ok(home<1e-3,'one-tap overview '+home);
 await page.tap('#m-cabin');assert.equal(await page.evaluate(()=>!!cabinFollow),true);assert.equal(await page.getAttribute('#m-cabin','aria-pressed'),'true');
 await page.tap('#m-cabin');assert.equal(await page.evaluate(()=>!!cabinFollow),false);report.view=true;
 // 4) 비상정지 라벨 · 화면만 보기
 await page.tap('#btn-estop');assert.equal(await page.evaluate(()=>currentState),'ESTOP');assert.equal(await page.locator('#btn-estop span').textContent(),'정지 해제');
 await page.tap('#btn-estop');assert.equal(await page.locator('#btn-estop span').textContent(),'비상정지');
 await page.tap('#m-settings');await page.waitForTimeout(300);
 {const b=await page.locator('#dd-view').boundingBox(),x=b.x+b.width/2,y=b.y+20;
  await touch('touchStart',[[x,y]]);for(let i=1;i<=6;i++){await touch('touchMove',[[x,y+i*25]]);await page.waitForTimeout(16);}await touch('touchEnd',[]);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.getElementById('dd-view').classList.contains('open')),false,'drag down closes sheet');
  await page.tap('#m-settings');await page.waitForTimeout(300);
  await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y+30]]);await touch('touchEnd',[]);await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.getElementById('dd-view').classList.contains('open')&&!document.getElementById('dd-view').style.transform),true,'short drag snaps back');}
 report.sheetDrag=true;
 const barBefore=await page.locator('#m-bar').boundingBox();
 await page.tap('#m-fullscreen');await page.waitForFunction(()=>!!document.fullscreenElement);await page.waitForTimeout(200);
 const fsBar=await page.locator('#m-bar').boundingBox();
 assert.ok(await page.locator('#m-fs-notice').isVisible()&&fsBar.y<=barBefore.y-80,'bar lifted above browser fullscreen notice');await shot('fullscreen-notice');
 await page.waitForFunction(()=>document.getElementById('m-fs-notice').hidden,null,{timeout:8000});
 assert.ok(Math.abs((await page.locator('#m-bar').boundingBox()).y-barBefore.y)<1,'bar returns after notice');
 await page.tap('#m-fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);report.fullscreenNotice=true;
 await page.tap('#m-clean');
 assert.equal(await page.locator('#m-bar').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 assert.equal(await page.locator('#mobile-visibility').isVisible(),true);await shot('clean');
 await page.tap('#mobile-visibility');assert.equal(await page.locator('#m-bar').evaluate(e=>getComputedStyle(e).visibility),'visible');report.estopClean=true;
 // 5) 승곰이 체험: 방향키·체험 패널·바 분리
 await page.tap('#m-walk');await page.waitForFunction(()=>CharacterWalk.active&&MobileHUD.mode==='walk');await page.waitForTimeout(400);
 await expectBar(['m-walk-home','m-walk-exit','m-settings','btn-estop'],'walk');
 assert.equal(await page.locator('#walk-stick').isVisible(),true);await shot('walk');
 // 두 손가락 벌리면 가까이(거리 감소), 오므리면 멀리. 한 손 조이스틱은 별도 요소.
 const camDist=()=>page.evaluate(()=>camera.position.distanceTo(controls.target));
 const d0=await camDist();await pinch(195,330,40,140);await page.waitForTimeout(150);
 const zIn=await page.evaluate(()=>CharacterWalk.zoom),d1=await camDist();
 await pinch(195,330,140,30);await page.waitForTimeout(150);
 const zOut=await page.evaluate(()=>CharacterWalk.zoom),d2=await camDist();
 assert.ok(zIn<.7&&d1<d0*.8&&zOut>zIn&&d2>d1,'walk pinch zoom '+JSON.stringify({d0,d1,d2,zIn,zOut}));
 report.walkPinch={d0:+d0.toFixed(2),in:+d1.toFixed(2),out:+d2.toFixed(2)};await shot('walk-pinch');
 await page.tap('#m-walk-home');assert.equal(await page.evaluate(()=>CharacterWalk.zoom),1);await page.tap('#m-walk-exit');
 assert.equal(await page.evaluate(()=>camera.fov),50,'fov restored after walk');await page.waitForFunction(()=>!CharacterWalk.active&&MobileHUD.mode==='base');report.walk=true;
 // 6) 시연: 일시정지·시연 종료가 바에 있고, 시연의 클릭 차단 중에도 종료된다
 await page.evaluate(()=>PhotoEyeDemo.start());await page.waitForFunction(()=>PhotoEyeDemo.active&&MobileHUD.mode==='demo');await page.waitForTimeout(2500);
 await expectBar(['demo-pause','m-demo-exit','btn-estop'],'demo');
 assert.equal(await page.locator('#m-demo-exit').isEnabled(),true);
 await page.tap('#demo-pause');assert.equal(await page.evaluate(()=>DemoPause.paused),true);await shot('demo-paused');
 await page.tap('#demo-pause');assert.equal(await page.evaluate(()=>DemoPause.paused),false);
 await page.tap('#m-demo-exit');await page.waitForFunction(()=>!PhotoEyeDemo.active&&MobileHUD.mode==='base');
 assert.equal(await page.locator('#photo-eye-panel').isVisible(),false);await expectBar(BASE,'after demo');report.demoExit=true;
 // 6b) 진한 시연 설명 카드는 모바일에서 반투명
 await page.waitForFunction(()=>!moving&&!CarDoor.state.busy);
 await page.evaluate(()=>ManualRescueDemo.start());await page.waitForFunction(()=>!document.getElementById('manual-rescue-panel').hidden,null,{timeout:30000});await page.waitForTimeout(2500);
 const alpha=await page.evaluate(()=>{const m=getComputedStyle(document.getElementById('manual-rescue-panel')).backgroundColor.match(/[\d.]+/g);return m.length>3?+m[3]:1;});
 assert.ok(alpha<=.45,'translucent demo card '+alpha);await shot('manual-rescue-card');
 await page.tap('#m-demo-exit');await page.waitForFunction(()=>!ManualRescueDemo.active,null,{timeout:90000});report.translucentCard=alpha;
 // 7) 과속 시연: 낙하 중 종료 비활성 → 트립 뒤 고장 복귀가 바에 나타나 정상 복귀
 await page.waitForFunction(()=>!moving&&!CarDoor.state.busy&&!doorOpen);await page.waitForTimeout(500);
 await page.evaluate(()=>startOverspeedFault(document.getElementById('btn-overspeed')));
 await page.waitForFunction(()=>MobileHUD.mode==='demo'&&['rope-break','runaway'].includes(ovsDemo.stage),null,{timeout:60000});
 assert.equal(await page.locator('#m-demo-exit').isDisabled(),true,'no exit while falling');await shot('ovs-falling');
 await page.waitForFunction(()=>!document.getElementById('fault-reset').hidden&&!document.getElementById('fault-reset').disabled,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>document.getElementById('fault-reset').parentNode.id),'m-bar');
 await expectBar(['demo-pause','fault-reset','btn-estop'],'ovs tripped');await shot('ovs-tripped');
 await page.tap('#fault-reset');await page.waitForFunction(()=>!overspeedActive&&MobileHUD.mode==='base',null,{timeout:120000});report.overspeed=true;
 // 8) PC 화면 전환 시 옮긴 노드 복귀 · 다시 모바일
 await page.setViewportSize({width:1280,height:850});await page.waitForTimeout(400);
 const pc=await page.evaluate(()=>({estop:document.getElementById('btn-estop').parentNode.id,pause:document.getElementById('demo-pause').parentNode===document.body,reset:document.getElementById('fault-reset').parentNode.id,bar:document.getElementById('m-bar').hidden,m:document.body.classList.contains('m-hud'),dock:document.getElementById('dd-op').parentNode.id}));
 assert.deepEqual(pc,{estop:'dd-op',pause:true,reset:'hud',bar:true,m:false,dock:'pc-dock'});
 await page.click('#btn-estop');assert.equal(await page.evaluate(()=>estop),true);assert.equal(await page.locator('#btn-estop span').textContent(),'해제');await page.click('#btn-estop');
 await shot('desktop');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>document.getElementById('btn-estop').parentNode.id),'m-bar');await expectBar(BASE,'back to mobile');report.desktopRoundTrip=true;
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({...report,errors}));
}catch(error){console.error(error);await shot('failure');process.exitCode=1;}finally{await browser.close();server.close();}
