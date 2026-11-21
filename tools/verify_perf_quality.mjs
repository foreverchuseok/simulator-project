// 2026-11-21 최적화 1~5단계 검사: ?fps 계측 · 자동 화질 판정 · 정지 프레임 절약 · 소형 컬링 · 인터록 생략 · 캐시 헤더.
// node tools/verify_perf_quality.mjs [--deep]   (--deep: 20초 깊은 정지 12fps 단계까지 확인)
// 헤드리스 화면은 실제 기기 성능이 아니다. S22+ 수치는 tools/measure_fps.mjs --phone 으로 잰다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const deep=process.argv.includes('--deep');
const root=process.cwd(),out=path.join(root,'.shot-perf-quality');fs.mkdirSync(out,{recursive:true});
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const rule=src=>vercel.headers.find(h=>h.source===src)?.headers.find(h=>h.key==='Cache-Control')?.value;
assert.equal(rule('/(models|sound|assets)/(.*)'),'public, max-age=3600','정적 자원 1시간 캐시');
assert.equal(rule('/(js|css)/(.*)'),'public, max-age=0, must-revalidate','코드는 매번 재검증(버전 문자열을 안 올려도 최신)');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});
const report={errors:[]};
const open=async query=>{
  const page=await browser.newPage({viewport:{width:384,height:701},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});
  page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(`${query}: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(`${query}: ${m.text()}`);});
  await page.addInitScript(()=>{let seed=20261121;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?${query}`,{waitUntil:'load'});
  await page.waitForFunction(()=>govHandles()?.ready&&ControlPanel.ready&&carGrp.userData.safetyGear?.wedges.length===4&&hatchDoors.every(h=>h.interlock?.ready)&&document.getElementById('loading').classList.contains('hide'));
  await page.waitForTimeout(1500);
  return page;
};
const overviewCalls=page=>page.evaluate(()=>{const p=overviewCameraPose();camera.position.fromArray(p.position);controls.target.fromArray(p.target);controls.update();renderer.info.reset();renderer.render(scene,camera);return renderer.info.render.calls;});
try{
  /* 소형 컬링 끈 기준 */
  const base=await open('fps&cull=0&idle=0');
  report.callsWithoutCull=await overviewCalls(base);
  await base.close();

  const page=await open('fps');
  /* 1. ?fps 계측 */
  assert.ok(await page.locator('#perf-panel').isVisible(),'?fps 표시');
  const rec=await page.evaluate(()=>{dispatchEvent(new PointerEvent('pointermove'));return PerfMonitor.record(2,'verify');});
  for(const k of ['fps','intervalMs','cpuMs','updateMs','drawMs','shadowCheckMs','shadowUpdates','calls','triangles','cpuBusyMsPerSecond'])assert.ok(k in rec,'기록 항목 '+k);
  assert.ok(rec.frames>5&&rec.calls.median>0,'연속 기록');
  report.record={fps:rec.fps,calls:rec.calls,cpuMs:rec.cpuMs};

  /* 2. 자동 화질: 자동 검사 브라우저는 0단계 고정, 수동 단계·가상 프레임 판정 */
  const q=await page.evaluate(()=>{
    const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow),r={start:AdaptiveQuality.describe()};
    AdaptiveQuality.set(2);renderer.render(scene,camera);r.level2={dpr:renderer.getPixelRatio(),shadow:sun.shadow.map.width};
    AdaptiveQuality.set(0);renderer.render(scene,camera);r.level0={dpr:renderer.getPixelRatio(),shadow:sun.shadow.map.width};
    AdaptiveQuality.set('auto');
    let at=performance.now()+5000;
    const feed=(ms,cpu,seconds)=>{for(let t=0;t<seconds*1000;t+=ms){at+=ms;AdaptiveQuality.feed({interval:ms,update:cpu*.1,draw:cpu*.9,extra:0,throttled:false,at});}};
    feed(70,68,9);r.cpuBound=AdaptiveQuality.level;            // 느려도 CPU 병목 → 그대로
    feed(50,20,7);r.gpuBound=AdaptiveQuality.level;            // GPU 대기 → 1단계
    feed(50,20,7);r.gpuBound2=AdaptiveQuality.level;           // → 2단계
    feed(16,8,13);r.recovered=AdaptiveQuality.level;           // 빠르면 12초 뒤 → 1단계
    feed(50,20,7);r.relapse=AdaptiveQuality.describe();        // 15초 안에 다시 느림 → 2단계 고정
    feed(16,8,13);r.locked=AdaptiveQuality.level;
    feed(16,8,80);r.unlocked=AdaptiveQuality.level;           // 잠금 60초가 지나면 단계마다 12초씩 다시 올린다
    feed(70,68,30);r.cpuBoundStay=AdaptiveQuality.level;       // CPU 병목 화면은 낮춰도 이득이 없어 유지
    AdaptiveQuality.set(0);r.end={dpr:renderer.getPixelRatio()};
    return r;
  });
  report.quality=q;
  assert.deepEqual([q.start.mode,q.start.level,q.start.dpr],['fixed',0,2],'자동 검사는 0단계 고정');
  assert.deepEqual(q.level2,{dpr:1.25,shadow:1024});assert.deepEqual(q.level0,{dpr:2,shadow:2048});
  assert.equal(q.cpuBound,0,'CPU 병목이면 화질을 낮추지 않는다');
  assert.equal(q.gpuBound,1);assert.equal(q.gpuBound2,2);assert.equal(q.recovered,1);
  assert.equal(q.relapse.level,2);assert.equal(q.relapse.ceiling,2);assert.equal(q.locked,2,'되돌아간 단계 위로 60초간 다시 올리지 않는다');
  assert.equal(q.unlocked,0,'잠금이 풀리면 고화질로 돌아온다');assert.equal(q.cpuBoundStay,0);

  /* 3. 정지 프레임 절약 */
  await page.waitForTimeout(2600);
  const idle=await page.evaluate(()=>({mode:IdleThrottle.mode,live:PerfMonitor.live(1000)}));
  assert.equal(idle.mode,1,'1.5초 정지 → 30fps');assert.ok(idle.live.throttledFrames>0);
  await page.mouse.move(100,300);await page.mouse.move(140,320);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>IdleThrottle.mode),0,'입력 즉시 원래 속도');
  await page.evaluate(()=>PassengerControls.request(3));await page.waitForFunction(()=>moving);
  const travel=[];for(let i=0;i<8;i++){await page.waitForTimeout(400);travel.push(await page.evaluate(()=>moving?IdleThrottle.mode:-1));}
  assert.ok(travel.every(m=>m<=0),'운행 중 절약 없음 '+travel);
  await page.waitForFunction(()=>!moving&&currentState===ELEVATOR_STATE.DOOR_OPEN&&!CarDoor.state.busy,null,{timeout:60000});
  await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE&&!CarDoor.state.busy);
  if(deep){await page.waitForTimeout(21500);const d=await page.evaluate(()=>({mode:IdleThrottle.mode,fps:PerfMonitor.live(3000).fps}));report.deep=d;assert.equal(d.mode,2);assert.ok(d.fps<16,'깊은 정지 12fps '+d.fps);}

  /* 4. 소형 컬링: 호출 감소·렌더 후 표시 상태 원복·작은 캐스터 그림자 끔 */
  report.callsWithCull=await overviewCalls(page);
  assert.ok(report.callsWithCull<report.callsWithoutCull*.75,`호출 ${report.callsWithoutCull}→${report.callsWithCull}`);
  const leak=await page.evaluate(()=>{const count=()=>{let n=0;scene.traverse(o=>{if(o.isMesh&&o.visible)n++;});return n;};const a=count();renderer.render(scene,camera);renderer.render(scene,camera);return {before:a,after:count(),culled:ScreenCull.culled};});
  assert.equal(leak.after,leak.before,'컬링 후 표시 상태 원복');assert.ok(leak.culled>0);
  const tiny=await page.evaluate(()=>{let n=0;scene.traverse(o=>{if(o.isMesh&&o.castShadow&&o.frustumCulled&&!o.isInstancedMesh){o.geometry.boundingSphere||o.geometry.computeBoundingSphere();if(o.geometry.boundingSphere.radius*o.matrixWorld.getMaxScaleOnAxis()<.005)n++;}});return n;});
  assert.equal(tiny,0,'지름 1cm 미만 그림자 끔');

  /* 5. 인터록: 정지 중 계산을 건너뛰어도 문·훅이 움직이면 접점이 바로 따라온다 */
  const il=await page.evaluate(async()=>{
    const h=hatchDoors[1],frame=()=>new Promise(r=>setTimeout(r,200)),s=h.interlock.contacts;
    const closed=[s.mainClosed,s.auxClosed];
    h.hook.rotation.z=-h.latch.liftRad;h.right.position.x=h.right.userData.cx+.3;h.left.position.x=h.left.userData.cx-.3;await frame();
    const open=[s.mainClosed,s.auxClosed];
    h.hook.rotation.z=0;h.right.position.x=h.right.userData.cx;h.left.position.x=h.left.userData.cx;await frame();
    return {closed,open,restored:[s.mainClosed,s.auxClosed]};
  });
  report.interlock=il;
  assert.deepEqual(il.closed,[true,true]);assert.deepEqual(il.open,[false,false]);assert.deepEqual(il.restored,[true,true]);

  await page.screenshot({path:path.join(out,'overview.png')});
  assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify(report));
  console.log('통과');
}finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(r=>server.close(r));
}
