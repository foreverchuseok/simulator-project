// ?fps 연속 계측으로 기본 화면·운행·시연 3종을 같은 조건에서 잰다 (2026-11-21 최적화 1단계).
// node tools/measure_fps.mjs [--phone] [--quality=0|1|2|3|auto] [--seconds=60] [--label=before] [--scenarios=idle,travel,gov,brake,limit]
// --phone: USB 디버깅으로 연결한 안드로이드 Chrome(S22 이상 기준). 5500 포트를 이 도구가 직접 열고 adb reverse 한다.
// 헤드리스 결과는 호출·삼각형 비교용이다. 프레임 시간은 실제 기기 값이 아니다.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith(`--${k}=`));return a?a.slice(k.length+3):d;};
const phone=process.argv.includes('--phone'),quality=arg('quality','0'),seconds=+arg('seconds','60'),label=arg('label','current');
const scenarios=arg('scenarios','idle,travel,gov,brake,limit').split(',');
const serial=arg('serial',process.env.ANDROID_SERIAL||'');
const cdpUrl=process.env.PHONE_CDP_URL||'http://127.0.0.1:9223';
const cdpPort=new URL(cdpUrl).port||'9223';
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('label: 영문·숫자·- 만');
const root=process.cwd(),out=path.join(root,'temporary/fps');fs.mkdirSync(out,{recursive:true});
const ADB=process.env.ADB||path.join(root,'temporary/android-tools/platform-tools/adb.exe');
const adb=(...a)=>execFileSync(ADB,serial?['-s',serial,...a]:a,{encoding:'utf8'});
const temperature=()=>{if(!phone)return null;const m=adb('shell','dumpsys','battery').match(/temperature:\s*(\d+)/);return m?+m[1]/10:null;};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
  fs.createReadStream(file).pipe(res);
});
let ownServer=true;
await new Promise((r,j)=>{server.once('error',e=>{if(phone&&e.code==='EADDRINUSE'){ownServer=false;r();}else j(e);}).listen(phone?5500:0,'127.0.0.1',r);});
const extra=arg('extra','');   // 예: --extra=idle=0 (정지 절약 끄고 비교)
const port=ownServer?server.address().port:5500;
const url=`http://127.0.0.1:${port}/index.html?fps&quality=${quality}${extra?'&'+extra:''}`;
let browser,page;const report={label,phone,quality,seconds,url,runs:[],errors:[]};
const file=path.join(out,`${label}-${phone?'phone':'headless'}-q${quality}.json`);
try{
  if(phone){
    adb('reverse','tcp:5500','tcp:5500');adb('forward',`tcp:${cdpPort}`,'localabstract:chrome_devtools_remote');
    report.device=adb('shell','getprop','ro.product.model').trim();
    browser=await chromium.connectOverCDP(cdpUrl);
    page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes(':5500'))||browser.contexts()[0].pages()[0];
  }else{
    browser=await chromium.launch({args:['--enable-gpu']});
    page=await browser.newPage({viewport:{width:384,height:701},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});
  }
  page.setDefaultTimeout((seconds+120)*1000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(phone){
    await page.route('http://127.0.0.1:5500/**',r=>{
      const f=path.resolve(root,'.'+decodeURIComponent(new URL(r.request().url()).pathname));
      return f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()
        ?r.fulfill({body:fs.readFileSync(f),contentType:mime[path.extname(f)]||'application/octet-stream'}):r.continue();
    });
    for(const name of ['three.min.js','gsap.min.js','OrbitControls.js','GLTFLoader.js']){
      const vf=path.join(root,'temporary/background-phone/vendor',name);
      if(fs.existsSync(vf))await page.route('https://**/'+name,r=>r.fulfill({body:fs.readFileSync(vf),contentType:'text/javascript'}));
    }
  }
  await page.goto(url,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>typeof govHandles==='function'&&govHandles()?.ready&&ControlPanel.ready&&carGrp.userData.safetyGear?.wedges.length===4&&hatchDoors.every(h=>h.interlock?.ready)&&document.getElementById('loading').classList.contains('hide'),null,{timeout:120000});
  if(phone)await page.evaluate(()=>navigator.wakeLock?.request('screen').then(l=>{window.__wake=l;},()=>{}));
  await page.waitForTimeout(5000);
  report.env=await page.evaluate(()=>({gpu:(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})(),viewport:[innerWidth,innerHeight],devicePixelRatio,quality:AdaptiveQuality.describe()}));
  const settle=async()=>{
    await page.evaluate(()=>{if(DemoExit.active)DemoExit.cancel();});
    await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&!moving&&currentState===ELEVATOR_STATE.IDLE,null,{timeout:60000}).catch(()=>{});
    await page.evaluate(()=>{const p=overviewCameraPose();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);camera.position.fromArray(p.position);controls.target.fromArray(p.target);controls.update();});
    await page.waitForTimeout(2500);
  };
  for(const name of scenarios){
    await settle();
    const t0=temperature();
    const summary=await page.evaluate(async({name,seconds})=>{
      let stop=()=>{};
      if(name==='travel'){
        // 4층↔1층·중간층을 쉬지 않고 오간다(문 열림 시간 포함).
        const seq=[3,0,2,1];let k=0;
        const id=setInterval(()=>{
          if(moving||CarDoor.state.busy)return;
          if(doorOpen&&currentState===ELEVATOR_STATE.DOOR_OPEN){closeDoors();return;}
          if(currentState===ELEVATOR_STATE.IDLE&&!doorOpen){const f=seq[k++%seq.length];if(f!==curFloor)PassengerControls.request(f);}
        },250);
        stop=()=>clearInterval(id);
      }else if(name==='mr'||name==='mr-active'){
        camera.position.set(2.8,Y0+TOTAL_H+2.6,3.0);controls.target.set(0,Y0+TOTAL_H+.55,-.3);controls.update();
        if(name==='mr-active'){dispatchEvent(new PointerEvent('pointermove'));const id=setInterval(()=>dispatchEvent(new PointerEvent('pointermove')),500);stop=()=>clearInterval(id);}
      }else if(name==='idle-active'){
        dispatchEvent(new PointerEvent('pointermove'));const id=setInterval(()=>dispatchEvent(new PointerEvent('pointermove')),500);stop=()=>clearInterval(id);
      }else if(name!=='idle'){
        // 모바일 시연 목록 → 안내창 → 재생 (사용자와 같은 경로)
        document.getElementById('m-demo-fab').click();
        const sel=`#m-demo-list [data-demo="${name}"]`+(['door','up','brake','buffer'].includes(name)?' .demo-disclosure':'');
        document.querySelector(sel).click();document.getElementById('m-demo-play').click();
      }
      const s=await PerfMonitor.record(seconds,name);stop();return s;
    },{name,seconds});
    const run={scenario:name,temperatureC:[t0,temperature()],...summary};delete run.env;
    report.runs.push(run);fs.writeFileSync(file,JSON.stringify(report,null,1));
    console.log(`${name.padEnd(6)} ${run.fps}fps 간격 ${run.intervalMs.median}/${run.intervalMs.p95}ms CPU ${run.cpuMs.median}/${run.cpuMs.p95} 초당CPU ${run.cpuBusyMsPerSecond} (JS ${run.updateMs.median} 그리기 ${run.drawMs.median} 발광 ${run.glowInsetMs.median} 그림자검사 ${run.shadowCheckMs.median}) 그림자갱신 ${run.shadowUpdates.perSecond}/s 호출 ${run.calls.median}/${run.calls.max} 삼각형 ${run.triangles.median} DPR ${run.dpr} ${run.temperatureC[0]??''}→${run.temperatureC[1]??''}℃`);
  }
  await settle();
  report.qualityAfter=await page.evaluate(()=>AdaptiveQuality.describe());
}finally{
  fs.writeFileSync(file,JSON.stringify(report,null,1));
  if(report.errors.length)console.log('오류:',report.errors.slice(0,5));
  console.log('저장:',path.relative(root,file));
  if(phone){try{await page?.unrouteAll();}catch{}try{await browser?.close();}catch{}}else await browser?.close();
  if(ownServer){server.closeAllConnections?.();await new Promise(r=>server.close(r));}
}
