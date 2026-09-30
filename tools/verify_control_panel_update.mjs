import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const before=process.argv.includes('--before'),out='.shot-control-panel-update';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1,hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5500/index.html?legacyIcons',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>ControlPanel.ready&&HallRetention.devices.length===8&&getComputedStyle(document.getElementById('loading')).opacity==='0',null,{timeout:90000});
 await page.evaluate(()=>{ControlPanel.toggle();controls.enableDamping=false;});
 await page.waitForFunction(()=>!ControlPanel.busy);
 await page.evaluate(()=>{const r=ControlPanel.root;controls.target.copy(r.localToWorld(new THREE.Vector3(0,.77,.025)));camera.position.copy(r.localToWorld(new THREE.Vector3(0,.77,1.05)));camera.fov=35;camera.updateProjectionMatrix();controls.update();});
 await page.waitForTimeout(500);
 const performance=await page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const n=await new Promise(requestAnimationFrame);t.push(n-last);last=n;}t.sort((a,b)=>a-b);return {median:t[90],p95:t[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 await page.screenshot({path:`${out}/${before?'before':'after'}-panel.png`});
 if(!before){
  const layout=await page.evaluate(()=>ControlPanel.root.getObjectByName('ControlPanel').userData.upperLayout);
  assert.ok(layout.cpuX+.105<layout.ioX-layout.ioWidth/2);
  assert.ok(layout.ioX+layout.ioWidth/2<layout.switchX-layout.switchWidth/2);
  await page.evaluate(()=>{const r=ControlPanel.root;camera.position.copy(r.localToWorld(new THREE.Vector3(.32,.89,1.10)));controls.update();});
  await page.screenshot({path:`${out}/panel-oblique.png`});
  await page.evaluate(()=>ControlPanel.toggle());await page.waitForFunction(()=>!ControlPanel.busy);
  assert.equal(await page.evaluate(()=>ControlPanel.root.getObjectByName('CabinetInterior').visible),false);
  await page.evaluate(()=>ControlPanel.toggle());await page.waitForFunction(()=>!ControlPanel.busy);
  // 옛 「부품 아이콘 숨기기」는 설정의 「부품 빛 효과」로 바뀌었다(js/part-glow.js). 빛을 꺼도 행동 버튼은 살아 있다.
  const shownBefore=await page.evaluate(()=>document.getElementById('control-panel-action').hidden);
  await page.click('[data-menu="dd-view"]');await page.click('#part-glow-toggle');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>PartGlow.enabled),false);
  assert.equal(await page.evaluate(()=>document.getElementById('control-panel-action').hidden),shownBefore);
  await page.click('#part-glow-toggle');assert.equal(await page.evaluate(()=>PartGlow.enabled),true);await page.evaluate(()=>closeAllMenus());
  await page.click('#c-shaft');await page.click('#overview-home');await page.waitForTimeout(1500);
  for(const mobile of [false,true]){
   if(mobile)await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>{closeAllMenus();carGrp.position.y=FLOOR_Y[3]+S.CAR_H/2;refreshRopes();const d=HallRetention.devices[0],p=d.getWorldPosition(new THREE.Vector3());controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(.08,.10,-.55));camera.fov=38;camera.updateProjectionMatrix();controls.update();});
   await page.locator('#retention-action-0')[mobile?'tap':'click']();
   assert.match(await page.locator('#emergency-guide-panel').innerText(),/하부 이탈방지장치/);
   await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-retention-guide.png`});
   await page.evaluate(()=>{closeAllMenus();PartGlow.setEnabled(false);});await page.waitForTimeout(400);
   assert.deepEqual(await page.evaluate(()=>PartGlow.parts.filter(p=>p.root.visible).map(p=>p.name)),[]);
   await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-glow-off.png`});
   await page.evaluate(()=>PartGlow.setEnabled(true));assert.ok(await page.locator('#retention-action-0').isVisible());
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify({performance,errors},null,2));console.log({performance,errors});
}finally{await browser.close();}
