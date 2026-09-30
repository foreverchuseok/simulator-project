import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,process.argv.includes('--mobile')?'.shot-ovs-mobile':'.shot-ovs');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});page=await browser.newPage(process.argv.includes('--mobile')?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:850}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()?.errorText));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.routeWebSocket('**',ws=>ws.close());
 await page.goto(process.argv.includes('--live')?'http://127.0.0.1:5500/index.html':`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4);
 await page.evaluate(keepShadows=>{renderer.setPixelRatio(0.8);renderer.shadowMap.enabled=keepShadows;gsap.ticker.lagSmoothing(0);},process.argv.includes('--shadows'));
 console.log('OVS models loaded');
 {
  await page.evaluate(()=>{const g=_govWorld();moveCam(g.x+1.05,g.y+0.23,g.z+0.53,g.x-0.02,g.y+0.02,g.z);}); // 카메라 프리셋 메뉴는 제거됨 — 같은 조속기 시점
  await page.waitForFunction(()=>gsap.getTweensOf(camera.position).length===0&&gsap.getTweensOf(controls.target).length===0);
 }
 const linkage=await page.evaluate(()=>{
  const sg=carGrp.userData.safetyGear,lk=carGrp.userData.safetyLinkage;let maxPinY=0,minSlotClearance=Infinity,faces=0;
  carGrp.traverse(o=>{if(o.name.startsWith('safetyWedgeFrictionFace'))faces++;});
  for(let i=0;i<=100;i++){
   sg.shaft.rotation.x=SG_TRIP_ROT*i/100;refreshCarSafetyLinkage();scene.updateMatrixWorld(true);
   for(const w of sg.wedges){
    const tag=w.userData.side,index=w.name.endsWith('0')?0:1,lift=sg['lift'+tag];
    const pin=lift.worldToLocal(w.children.find(o=>o.name.startsWith('safetyWedgePullPin')).getWorldPosition(new THREE.Vector3()));
    const f=lift.getObjectByName('safetyWedgeFork'+tag+index).userData;
    maxPinY=Math.max(maxPinY,Math.abs(pin.y-f.pinY));
    minSlotClearance=Math.min(minSlotClearance,f.slotHalf-Math.abs(pin.z-f.slotZ)-f.pinRadius);
   }
  }
  sg.shaft.rotation.x=0;refreshCarSafetyLinkage();return {maxPinY,minSlotClearance,faces};
 });
 assert.equal(linkage.faces,4);assert.ok(linkage.maxPinY<1e-7);assert.ok(linkage.minSlotClearance>0.001);
 console.log('Pin/fork sweep passed',linkage);
 await page.evaluate(()=>{
  const btn=document.getElementById('btn-overspeed');startOverspeedFault(btn);
  if(overspeedActive)throw new Error('OVS must refuse floors below 3');
  const dy=FLOOR_Y[2]+S.CAR_H/2-carGrp.position.y;carGrp.position.y+=dy;cwtGrp.position.y-=dy;curFloor=2;refreshRopes();
  window.ovsSamples=[];window.ovsFrames={};window.ovsLastStage='';
  window.ovsOriginalMaterials=[];carGrp.traverse(o=>{if(o.material)ovsOriginalMaterials.push([o,o.material,o.visible,o.castShadow,o.renderOrder]);});
  window.ovsSounds=[];const sound=MACH.overspeedImpact;MACH.overspeedImpact=kind=>{ovsSounds.push({kind,stage:ovsDemo.stage,shot:ovsDemo.shot});sound(kind);};
  window.ovsProbe=()=>{
   const g=govHandles(),sg=carGrp.userData.safetyGear;
   ovsSamples.push({stage:ovsDemo.stage,shot:ovsDemo.shot,broken:ovsDemo.broken,
     mainVisible:ropeObjs.every(r=>r.carDrop.visible),governorRopes:govRopeSegs.every(r=>r.visible),sparks:!!ovsDemo.sparks?.visible,scissor:renderer.getScissorTest(),
     t:performance.now(),y:carGrp.position.y,cwt:cwtGrp.position.y,wheel:g.wheel.rotation.z,
     ratchet:g.ratchet.rotation.z,clampY:carGrp.position.y+carGrp.userData.govClamp.y,
     p:sg.shaft.rotation.x/SG_TRIP_ROT,ropeLocked:g.ropeLocked||false,
     contact:g.switchLever.userData.contactClosed,safetyContact:carGrp.getObjectByName('safetyLimitSwitch').userData.contactClosed});
   if(ovsDemo.sparks?.visible&&!window.ovsSparkFrame){window.ovsSparkFrame=true;setTimeout(()=>{
     renderer.render(scene,camera);ovsFrames.impact=renderer.domElement.toDataURL('image/png').split(',')[1];
   },120);}
   if(ovsDemo.stage!==ovsLastStage){
     const stage=ovsDemo.stage;ovsLastStage=stage;
     requestAnimationFrame(()=>{
      renderer.render(scene,camera);
      ovsFrames[stage]=renderer.domElement.toDataURL('image/png').split(',')[1];
     });
   }
  };gsap.ticker.add(ovsProbe);
 });
 const press=selector=>process.argv.includes('--mobile')?page.tap(selector):page.click(selector);
 await press('#btn-overspeed');
 assert.equal(await page.evaluate(()=>document.querySelector('.sheet.open')),null,'fault sheet closes while the demo runs');
 console.log('OVS clicked');
 await page.waitForFunction(()=>ovsDemo.stage==='stopped'&&!document.getElementById('btn-overspeed').disabled);
 const data=await page.evaluate(()=>{
  gsap.ticker.remove(ovsProbe);
  const gov=govHandles(),m=gov.mechanism;
  const point=new THREE.Vector3(...m.padPoint).sub(gov.topArm.position).applyAxisAngle(new THREE.Vector3(0,0,1),gov.topArm.rotation.z).add(gov.topArm.position);
  return {samples:ovsSamples,frames:ovsFrames,sounds:ovsSounds,padGap:point.x-m.ropeFaceX,switchAngle:gov.switchLever.rotation.z+m.switchRestAngle,phase:governorPhase,hidden:ovsDemo.hidden.length};
 });
 const stages=[...new Set(data.samples.map(s=>s.stage))];
 const expected=['preparing','rope-break','runaway','machine-room','centrifugal','electrical','pawl','rope-grip','rope-locked','linkage-view','linkage','safety-view','wedges'];
 assert.deepEqual(stages.filter(s=>expected.includes(s)),expected);
 assert.ok(data.samples.every(s=>!s.scissor),'No split-screen rendering');
 assert.ok(data.samples.every(s=>s.governorRopes),'Governor rope remains connected and visible');
 assert.ok(data.samples.filter(s=>s.stage==='runaway').every(s=>s.shot==='shaft'&&s.broken&&!s.mainVisible),'Fall is visible from shaft with broken main ropes');
 assert.ok(data.samples.filter(s=>s.stage==='centrifugal'||s.stage==='rope-grip').every(s=>s.shot==='governor'),'Mechanism gets its own shot');
 assert.ok(data.samples.some(s=>s.shot==='safety'&&s.sparks&&s.p>.9),'Sparks coincide with rail grip');
 assert.deepEqual(data.sounds.map(s=>s.kind),['break','fall','pawl','grip','rail']);
 const coupled=data.samples.filter(s=>s.ropeLocked&&s.p>0&&s.p<1);
 assert.ok(coupled.length>3,'Moving linkage samples');
 const clamp0=coupled[0].clampY,wheel0=coupled[0].wheel;
 assert.ok(coupled.every(s=>Math.abs(s.clampY-clamp0)<1e-5),'Clamped rope stays fixed while car descends');
 assert.ok(coupled.every(s=>Math.abs(s.wheel-wheel0)<1e-8),'Governor stays stopped during wedge lift');
 assert.ok(coupled.some(s=>s.safetyContact===false),'Safety contact opens');
 assert.ok(Math.abs(data.padGap)<1e-7,'Catch shoe touches rope');
 assert.ok(Math.abs(data.switchAngle+75*Math.PI/180)<1e-5,'Downward switch latches at -75 degrees from horizontal');
 assert.ok(data.samples.every(s=>Math.abs(s.y+s.cwt-data.samples[0].y-data.samples[0].cwt)<1e-7),'Counterweight stays coupled');
 for(const [name,png] of Object.entries(data.frames))fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));
 delete data.frames;
 await page.screenshot({path:path.join(out,'stopped.png')});
 const presentation=await page.evaluate(()=>({
   ghost:ovsDemo.hidden.some(([o])=>o.visible)&&ovsDemo.hidden.every(([o])=>(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.opacity>=.2&&m.opacity<.5&&!m.depthWrite)),
   frames:[...document.querySelectorAll('#ovs-summary img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,width:img.getBoundingClientRect().width})),
   summary:!document.getElementById('ovs-summary').hidden,
   fall:ovsSamples.filter(s=>s.stage==='runaway').length
 }));
 assert.equal(presentation.ghost,true,'Car remains visible with ghost materials');
 assert.equal(presentation.summary,true);assert.equal(presentation.frames.length,3);assert.ok(presentation.frames.every(f=>f.loaded&&f.width>100));
 await press('#ovs-exit');
 await page.waitForFunction(()=>governorPhase==='rest'&&!overspeedActive);
 const reset=await page.evaluate(()=>({p:carGrp.userData.safetyGear.shaft.rotation.x,contact:govHandles().switchLever.userData.contactClosed,
  stage:ovsDemo.stage,ropeLocked:govHandles().ropeLocked,safetyContact:carGrp.getObjectByName('safetyLimitSwitch').userData.contactClosed,
  hidden:ovsDemo.hidden.length,shot:ovsDemo.shot,broken:ovsDemo.broken,ropes:ropeObjs.every(r=>r.carDrop.visible),sparks:ovsDemo.sparks.visible,caption:document.getElementById('ovs-stage').hidden}));
 assert.ok(Math.abs(reset.p)<1e-8,'Safety shaft returns to zero');assert.equal(reset.contact,true);assert.equal(reset.hidden,0);assert.equal(reset.shot,null);assert.equal(reset.caption,true);
 assert.equal(reset.broken,false);assert.equal(reset.ropes,true);assert.equal(reset.sparks,false);
 assert.equal(reset.stage,'rest');assert.equal(reset.ropeLocked,false);assert.equal(reset.safetyContact,true);
 assert.equal(await page.locator('#ovs-summary').isVisible(),false);
 assert.equal(await page.evaluate(()=>ovsOriginalMaterials.every(([o,m,v,s,r])=>o.material===m&&o.visible===v&&o.castShadow===s&&o.renderOrder===r)),true,'Original materials, visibility, shadows and draw order restored');
 await page.waitForFunction(()=>!moving&&currentState===ELEVATOR_STATE.DOOR_OPEN);
 const rescue=await page.evaluate(()=>({floor:curFloor,error:Math.abs(carGrp.position.y-FLOOR_Y[curFloor]-S.CAR_H/2),controls:controls.enabled}));
 assert.ok(rescue.error<1e-7,'Rescue lands at a floor');assert.equal(rescue.controls,true);
 // Repeat from the upper floor; reuse effect buffers and confirm the compact exit remains tappable.
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>!CarDoor.state.busy&&CarDoor.secured()&&!doorOpen);
 if(process.argv.includes('--mobile'))await page.setViewportSize({width:320,height:740});
 await page.evaluate(()=>{
   const dy=FLOOR_Y[3]+S.CAR_H/2-carGrp.position.y;carGrp.position.y+=dy;cwtGrp.position.y-=dy;curFloor=3;refreshRopes();
   window.ovsGeometryCount=renderer.info.memory.geometries;
   startOverspeedFault(document.getElementById('btn-overspeed'));
 });
 await page.waitForFunction(()=>ovsDemo.stage==='stopped');await page.screenshot({path:path.join(out,'repeat.png')});
 assert.equal(await page.evaluate(()=>renderer.info.memory.geometries),await page.evaluate(()=>ovsGeometryCount),'Repeat reuses effect geometries');
 await press('#ovs-exit');await page.waitForFunction(()=>!overspeedActive&&!moving&&currentState===ELEVATOR_STATE.DOOR_OPEN);
 assert.equal(await page.evaluate(()=>ovsOriginalMaterials.every(([o,m])=>o.material===m)),true);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({linkage,stages,data,reset,rescue,errors},null,2));
 console.log(JSON.stringify({linkage,stages,padGap:data.padGap,lockedSamples:coupled.length,reset,rescue,errors}));
}catch(e){
 console.log('DIAGNOSTICS',errors,await page?.evaluate(()=>({stage:ovsDemo.stage,phase:governorPhase,active:overspeedActive,
  moving,estop,curFloor,y:carGrp.position.y,caption:document.getElementById('v-dir')?.textContent,
  samples:window.ovsSamples?.slice(-4)})).catch(()=>null));
 await page?.screenshot({path:path.join(out,'failure.png'),timeout:10000}).catch(()=>{});throw e;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
