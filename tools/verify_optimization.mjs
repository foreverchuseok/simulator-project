// Same browser, viewport, camera, assets and quality. A phone viewport is not a real phone.
// node tools/verify_optimization.mjs [--reference temporary/optimization/before]
// Reference directory contains environment.js, elevator.js and car-panels.js saved before editing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd(),out=path.join(root,'temporary/optimization');
fs.mkdirSync(out,{recursive:true});
const referenceArg=process.argv.indexOf('--reference');
const reference=referenceArg<0?null:process.argv[referenceArg+1];
const sources=['environment.js','elevator.js','car-panels.js'];
if(referenceArg>=0){assert.ok(reference,'Missing reference directory');for(const f of sources)assert.ok(fs.existsSync(path.join(reference,f)),f);}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});
const report={runs:[],errors:[]};
try {
  for(const mobile of [false,true])for(let repeat=0;repeat<2;repeat++)for(const version of reference?['before','after']:['after']){
    const tag=`${mobile?'390':'1280'}-${repeat}-${version}`;
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:850},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage();page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.errors.push(`${tag}: ${e.message}`));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(`${tag}: ${m.text()}`);});
    await page.addInitScript(()=>{let seed=20261005;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
    if(version==='before')for(const f of sources)await page.route(`**/js/${f}*`,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(reference,f),'utf8')}));
    const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await page.routeWebSocket('**',ws=>ws.close());
    await page.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>govHandles()?.ready&&ControlPanel.ready&&carGrp.userData.safetyGear?.wedges.length===4&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
    const settings=await page.evaluate(()=>{
      const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      window.perfStats=values=>{const s=[...values].sort((a,b)=>a-b);return {samples:s.length,medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.floor(s.length*.95)]};};
      window.perfSample=async(count,tick)=>{
        const times=[];let last=await new Promise(requestAnimationFrame);
        for(let i=0;i<count;i++){tick?.(i/count);const now=await new Promise(requestAnimationFrame);times.push(now-last);last=now;}
        return {...perfStats(times),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};
      };
      window.perfCamera={p:camera.position.clone(),t:controls.target.clone()};
      return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,camera:camera.position.toArray(),target:controls.target.toArray()};
    });
    await page.evaluate(()=>perfSample(60));
    const idle=await page.evaluate(()=>perfSample(120));
    if(repeat===0)await page.screenshot({path:path.join(out,`${tag}-overview.png`)});
    const orbit=await page.evaluate(async()=>{
      const offset=perfCamera.p.clone().sub(perfCamera.t);
      const result=await perfSample(120,t=>{const a=t*.6;camera.position.set(perfCamera.t.x+offset.x*Math.cos(a)+offset.z*Math.sin(a),perfCamera.p.y,perfCamera.t.z-offset.x*Math.sin(a)+offset.z*Math.cos(a));});
      camera.position.copy(perfCamera.p);controls.target.copy(perfCamera.t);controls.update();return result;
    });
    // Actual controls: touch on the narrow viewport, mouse on desktop.
    if(mobile&&await page.locator('#m-run').isVisible())await page.locator('#m-run').tap();   // 모바일 층 버튼은 「운행」 띠 안(js/mobile-hud.js)
    await page.locator('#fbtns [data-f="3"]')[mobile?'tap':'click']();
    await page.waitForFunction(()=>moving);
    const travel=await page.evaluate(()=>perfSample(120));
    await page.waitForFunction(()=>curFloor===3&&!moving&&currentState===ELEVATOR_STATE.DOOR_OPEN&&!CarDoor.state.busy);
    await page.evaluate(()=>closeDoors());
    await page.waitForFunction(()=>!doorOpen&&currentState===ELEVATOR_STATE.IDLE&&!CarDoor.state.busy);
    const secured=await page.evaluate(()=>CarDoor.secured()&&DoorBypass.hallSecured());assert.ok(secured,tag+' door recovery');
    const shadowCheck=await page.evaluate(()=>{
      const times=[];for(let i=0;i<140;i++){const t=performance.now();scene.onBeforeRender(renderer,scene,camera,null);if(i>=20)times.push(performance.now()-t);}return perfStats(times);
    });
    const run={tag,mobile,repeat,version,settings,idle,orbit,travel,shadowCheck,secured};
    report.runs.push(run);fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(run));await context.close();
  }
  if(reference)for(const before of report.runs.filter(r=>r.version==='before')){
    const after=report.runs.find(r=>r.mobile===before.mobile&&r.repeat===before.repeat&&r.version==='after');
    assert.deepEqual(after.settings,before.settings,'Before/after quality or camera differs');
    assert.equal(after.idle.triangles,before.idle.triangles,'Static detail must be preserved');
    assert.ok(after.idle.calls<=before.idle.calls,'Static draw calls increased');
  }
  assert.deepEqual(report.errors,[]);
}finally{fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
