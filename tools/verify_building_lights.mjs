// 승강로 3로 조명(피트·상부 스위치) + 기계실 일자형 LED 단독 스위치 검증.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-building-lights';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1093,height:661},deviceScaleFactor:1,hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>MachineRoomPower.ready&&CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 await page.evaluate(()=>{controls.enableDamping=false;});
 const perf=()=>page.evaluate(async()=>{const t=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<180;i++){const n=await new Promise(requestAnimationFrame);t.push(n-last);last=n;}t.sort((a,b)=>a-b);return {median:t[90],p95:t[171],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
 const look=(p,t)=>page.evaluate(([p,t])=>{gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);camera.position.set(...p);controls.target.set(...t);controls.update();updateManualCameraNear();},[p,t]);
 const lit=()=>page.evaluate(()=>{const r={shaft:[],mr:null,halos:0};scene.traverse(o=>{if(o.userData?.type==='shaft-led')r.shaft.push(o.userData.lit);if(o.userData?.type==='mr-linear-led')r.mr=o.userData.lit;if(o.name==='lightHalo'&&o.visible)r.halos++;});return {...r,state:BuildingLights.state};});
 const rocker=name=>page.evaluate(n=>shaftCableGrp.getObjectByName(n).getObjectByName('lightRocker').quaternion.toArray(),name);
 const MR=[[1.05,21.05,2.9],[-1.0,19.35,0.55]];
 // 카가 시야를 막지 않도록 피트 시점은 카를 최상층에, 상부 시점은 최하층에 둔다.
 const PIT=[[1.0,2.2,1.0],[-1.6,1.9,-0.1]],TOP=[[1.0,14.9,1.0],[-1.6,14.7,-0.1]],MR_PHONE=[[2.6,21.6,4.2],[-1.0,19.35,0.55]];
 const park=f=>page.evaluate(f=>{const y=FLOOR_Y[f]+S.CAR_H/2,d=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=d;refreshRopes();refreshGovernorRope();},f);

 // 초기: 모두 소등, 등기구 5 + 기계실 1.
 let s=await lit();assert.equal(s.shaft.length,5);assert.deepEqual(s.shaft,[false,false,false,false,false]);assert.equal(s.mr,false);assert.equal(s.halos,0);
 await look(...MR);await page.waitForTimeout(300);
 const perfOff=await perf();await page.screenshot({path:`${out}/mr-off.png`});
 const led=await page.evaluate(()=>{const g=scene.getObjectByName('MachineRoomLinearLED');const b=new THREE.Box3().setFromObject(g.getObjectByName('ledBody'));return {min:b.min.toArray(),max:b.max.toArray(),floor:Y0+TOTAL_H+0.02};});
 assert.ok(Math.abs(led.min[0]-(-1.635))<1e-3,'LED 몸체가 보드면에 밀착');assert.ok(Math.abs(led.max[2]-led.min[2]-.9)<1e-3,'900mm');
 assert.ok(led.min[1]-led.floor>1.73,'가로 이음매(바닥+1.73m) 위 띠');

 // 기계실 스위치: 기계실 등만 켜진다.
 assert.equal(await page.locator('#light-switch-mr').isVisible(),true);
 await page.click('#light-switch-mr');s=await lit();
 assert.equal(s.mr,true);assert.deepEqual(s.shaft,[false,false,false,false,false]);assert.equal(s.halos,1);
 await page.waitForTimeout(200);const perfOn=await perf();await page.screenshot({path:`${out}/mr-on.png`});

 // 피트 3로 스위치: 승강로 등 전체 점등, 기계실 등은 그대로.
 await park(3);await look(...PIT);await page.waitForTimeout(300);
 assert.equal(await page.locator('#light-switch-pit').isVisible(),true);assert.equal(await page.locator('#light-switch-mr').isVisible(),false);
 await page.screenshot({path:`${out}/pit-off.png`});const r0=await rocker('pitLightSwitchBox');
 await page.click('#light-switch-pit');s=await lit();
 assert.deepEqual(s.shaft,[true,true,true,true,true]);assert.equal(s.mr,true);assert.notDeepEqual(await rocker('pitLightSwitchBox'),r0);
 await page.waitForTimeout(200);await page.screenshot({path:`${out}/pit-on.png`});

 // 상부 3로 스위치로 끈다 → 다시 켠다. 피트에서도 끈다.
 await park(0);await look(...TOP);await page.waitForTimeout(300);assert.equal(await page.locator('#light-switch-top').isVisible(),true);
 await page.click('#light-switch-top');s=await lit();assert.deepEqual(s.shaft,[false,false,false,false,false]);assert.equal(s.state.pit,true);
 await page.screenshot({path:`${out}/top-off.png`});
 await page.click('#light-switch-top');s=await lit();assert.deepEqual(s.shaft,[true,true,true,true,true]);
 await page.waitForTimeout(200);await page.screenshot({path:`${out}/top-on.png`});
 await park(3);await look(...PIT);await page.waitForTimeout(300);await page.click('#light-switch-pit');s=await lit();assert.deepEqual(s.shaft,[false,false,false,false,false]);assert.equal(s.mr,true);
 // 3로 진리표: 점등 = 피트 XOR 상부.
 const table=await page.evaluate(()=>{const r=[];for(const [p,t] of [[0,0],[1,0],[0,1],[1,1]]){const st=BuildingLights.state;if(!!st.pit!==!!p)BuildingLights.toggle('pit');if(!!BuildingLights.state.top!==!!t)BuildingLights.toggle('top');r.push(BuildingLights.state.shaft);}return r;});
 assert.deepEqual(table,[false,true,true,false]);

 // 기계실 스위치로만 기계실 등이 꺼진다(승강로 스위치는 영향 없음).
 await page.evaluate(()=>{BuildingLights.toggle('pit');});assert.equal((await lit()).mr,true);
 await look(...MR);await page.waitForTimeout(300);

 // 세로 폰 터치
 await page.setViewportSize({width:390,height:844});await look(...MR_PHONE);await page.waitForTimeout(400);
 assert.equal(await page.locator('#light-switch-mr').isVisible(),true);await page.tap('#light-switch-mr');assert.equal((await lit()).mr,false);
 await page.screenshot({path:`${out}/mobile-mr-off.png`});await page.tap('#light-switch-mr');assert.equal((await lit()).mr,true);
 await look([0.9,2.3,0.7],[-1.6,2.5,0.7]);await page.waitForTimeout(400);await page.tap('#light-switch-pit');
 await page.screenshot({path:`${out}/mobile-pit.png`});
 const result={led,perfOff,perfOn,table,errors};fs.writeFileSync(`${out}/after.json`,JSON.stringify(result,null,2));
 assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
