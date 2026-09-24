import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const label=process.argv[2]||'after',out='.shot-governor-design';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready);
 const report=await page.evaluate(()=>{
  const g=govHandles();
  return {mechanism:g.mechanism,pivots:Object.fromEntries(['wheel','pawl','ratchet','topArm','switchLever'].map(k=>[k,g[k].getWorldPosition(new THREE.Vector3()).toArray()]))};
 });
 await page.evaluate(()=>{
  document.querySelectorAll('#ui,#hud,#hint,#loading,.panel').forEach(e=>e.style.display='none');
  scene.fog=null;wallGrp.visible=false;
  const g=govHandles(),body=g.wheel.parent;
  camera.position.copy(body.localToWorld(new THREE.Vector3(-.03,.24,.75)));
  controls.target.copy(body.localToWorld(new THREE.Vector3(-.025,.22,0)));controls.update();
 });
 await page.screenshot({path:`${out}/${label}-front.png`});
 await page.evaluate(()=>{const body=govHandles().wheel.parent;camera.position.copy(body.localToWorld(new THREE.Vector3(-.40,.38,.58)));controls.target.copy(body.localToWorld(new THREE.Vector3(-.045,.235,.02)));controls.update();});
 await page.screenshot({path:`${out}/${label}-oblique.png`});
 await page.evaluate(()=>{const body=govHandles().wheel.parent;camera.position.copy(body.localToWorld(new THREE.Vector3(-.14,.255,.36)));controls.target.copy(body.localToWorld(new THREE.Vector3(-.09,.245,.04)));controls.update();});
 await page.screenshot({path:`${out}/${label}-switch.png`});
 if(label==='after'){
  const before=JSON.parse(fs.readFileSync(`${out}/before.json`));
  for(const k of Object.keys(before.pivots))for(let i=0;i<3;i++)assert.ok(Math.abs(before.pivots[k][i]-report.pivots[k][i])<1e-7,`Pivot changed: ${k}`);
  for(const k of ['strikePoint','switchTip','switchHitPhase','pawl','pendulum','releaseArm','gripArm'])assert.deepEqual(report.mechanism[k],before.mechanism[k],k);
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(`${out}/${label}.json`,JSON.stringify(report,null,2));
 console.log('PASS governor design',label,report);
}finally{await browser.close();}
