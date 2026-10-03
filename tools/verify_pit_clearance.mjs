import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='temporary/pit-clearance';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const result={};
try {
 const variants=['after',...(fs.existsSync(`${out}/environment-before.js`)&&fs.existsSync(`${out}/buffer-demo-before.js`)?['before']:[]),'mobile'];
 for(const variant of variants) {
  const context=await browser.newContext({viewport:variant==='mobile'?{width:390,height:844}:{width:1280,height:850},deviceScaleFactor:1,hasTouch:variant==='mobile',isMobile:variant==='mobile'});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',s=>s.close());
  const cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(variant==='before')for(const file of ['environment','buffer-demo'])await page.route(`**/js/${file}.js*`,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(`${out}/${file}-before.js`,'utf8')}));
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>CarDoor.state?.ready&&govHandles()?.ready&&carGrp.userData.guideShoes?.length===4&&cwtGrp.userData.model);
  await page.evaluate(()=>{BufferDemo.timing.holdPit=.15;BufferDemo.timing.holdUnder=60;BufferDemo.start();});
  await page.waitForFunction(()=>BufferDemo.state.stage==='observe-under'&&!gsap.isTweening(camera.position));
  await page.click('#buffer-demo-pause');await page.waitForTimeout(200);
  const geometry=await page.evaluate(()=>{
   const u=BufferDemo.state.clear.under;
   return {gaps:Object.fromEntries(['P','Q','R','G'].filter(k=>u[k]).map(k=>[k,u[k].gap])),apron:carGrp.getObjectByName('apronVertical').geometry.parameters.height,
    carBufferTop:bufferGrp.userData.car.topY,cwtBufferTop:bufferGrp.userData.cwt.topY,
    labels:Object.fromEntries(['P','Q','R'].filter(k=>u[k]).map(k=>{const e=document.getElementById('buffer-demo-'+k),r=e.getBoundingClientRect();return [k,{hidden:e.hidden,x:r.x,y:r.y,right:r.right,bottom:r.bottom}];})),
    railHorizontal:carGrp.userData.guideShoes.filter(s=>!s.userData.isUpper).map(s=>{
     // 가이드슈 GLB의 레일 날끝을 기준으로 본체의 최대 수평 외곽 거리를 확인한다(급유통 제외).
     const model=s.children[0],data=model.getObjectByName('GuideShoeRoot').userData;
     const tip=model.localToWorld(new THREE.Vector3(data.railTip,0,0)),box=new THREE.Box3();
     s.traverseVisible(o=>{if(o.isMesh)box.union(new THREE.Box3().setFromObject(o));});
     return Math.max(...[box.min.x,box.max.x].flatMap(x=>[box.min.z,box.max.z].map(z=>Math.hypot(x-tip.x,z-tip.z))));
    })};
  });
  if(variant!=='before'){
   assert.equal(geometry.apron,.75);assert.ok(geometry.gaps.Q>=.1&&geometry.gaps.Q<.11);assert.ok(geometry.gaps.R>=.1);assert.equal(geometry.cwtBufferTop,.35);
   assert.ok(geometry.railHorizontal.every(d=>d<=.15),JSON.stringify(geometry.railHorizontal));
   for(const [id,r] of Object.entries(geometry.labels))assert.ok(!r.hidden&&r.x>=0&&r.y>=0&&r.right<= (variant==='mobile'?390:1280)&&r.bottom<=(variant==='mobile'?844:850),`${id} visible: ${JSON.stringify(r)}`);
  }
  await page.screenshot({path:`${out}/${variant}-under.png`});
  if(variant!=='mobile')await page.evaluate(()=>{camera.fov=72;camera.updateProjectionMatrix();camera.position.set(1.45,.52,.372);controls.target.set(-.345,.26,.372);controls.update();});
  const perf=await page.evaluate(()=>new Promise(resolve=>{const a=[];let prev;function tick(t){if(prev)a.push(t-prev);prev=t;if(a.length<180)requestAnimationFrame(tick);else{a.sort((x,y)=>x-y);resolve({median:a[90],p95:a[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,shadows:renderer.shadowMap.enabled});}}requestAnimationFrame(tick);}));
  assert.deepEqual(errors,[]);result[variant]={geometry,perf,errors};await context.close();
 }
 fs.writeFileSync(`${out}/verification.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
