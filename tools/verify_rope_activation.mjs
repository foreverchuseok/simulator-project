import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='temporary/rope-measure', results={};fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
try {
  for(const mobile of [false,true]) {
    const name=mobile?'mobile':'pc',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:850},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',s=>s.close());
    const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await page.goto(process.env.URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
    const views=[];
    for(const view of ['raised','wide']) {
      await page.evaluate(view=>{const y=carGrp.position.y+S.CAR_H/2;camera.position.set(view==='wide'?4:.8,y+(view==='wide'?2:3),CAR_CTR_Z+(view==='wide'?-5:.9));controls.target.set(0,y+.95,CAR_CTR_Z);controls.update();},view);
      await page.waitForFunction(()=>!document.getElementById('rope-measure-roof').hidden);
      await page.waitForTimeout(550);
      const hit=await page.evaluate(()=>{const v=new THREE.Vector3(0,carGrp.position.y+S.CAR_H/2+.95,CAR_CTR_Z).project(camera);const x=(v.x+1)*innerWidth/2+7,y=(1-v.y)*innerHeight/2;return {x,y,part:PartGlow.pickAt(x,y)?.name};});
      assert.equal(hit.part,'카 상부 주로프');
      if(!mobile)await page.mouse.move(hit.x,hit.y);
      await page.screenshot({path:`${out}/${name}-activation-${view}.png`});
      if(mobile)await page.touchscreen.tap(hit.x,hit.y);else await page.mouse.click(hit.x,hit.y);
      await page.waitForFunction(()=>RopeMeasure.active&&scene.getObjectByName('RopeMeasureSeunggom').visible);
      await page.click('#rope-measure-exit');await page.waitForFunction(()=>!RopeMeasure.active);views.push(view);
    }
    // 다른 시연/운행 제한은 유지한다. 가시 로프라도 비상정지 중에는 시작되지 않는다.
    await page.evaluate(()=>{estop=true;});await page.waitForFunction(()=>document.getElementById('rope-measure-roof').hidden);
    assert.equal(await page.evaluate(()=>RopeMeasure.start()),false);await page.evaluate(()=>{estop=false;});
    // 로프가 벽 뒤에 가려진 전면 시점은 클릭 여유로 뚫고 선택하지 않는다.
    await page.evaluate(()=>{const roof=carGrp.position.y+S.CAR_H/2;camera.position.set(4,roof+2,CAR_CTR_Z+5);controls.target.set(0,roof+.95,CAR_CTR_Z);controls.update();});
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>{const p=new THREE.Vector3(0,carGrp.position.y+S.CAR_H/2+.95,CAR_CTR_Z).project(camera);return PartGlow.pickAt((p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2)?.name==='카 상부 주로프';}),false);
    await page.evaluate(()=>{camera.position.set(.8,wireRopeShape.carTopY+.8,wireRopeShape.carTopZ+1.2);controls.target.set(0,wireRopeShape.carTopY,wireRopeShape.carTopZ);controls.update();});
    await page.waitForFunction(()=>document.getElementById('rope-measure-roof').hidden);
    assert.deepEqual(errors,[]);results[name]={views,offsetPixels:7,blockedDuringEstop:true,wallOcclusion:true,machineViewHidden:true,errors};await context.close();
  }
  fs.writeFileSync(`${out}/activation.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
