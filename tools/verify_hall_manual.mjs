import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-hall-manual';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
const url=process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html';
async function ready(page){
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof HallManual!=='undefined'&&CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&document.getElementById('loading').classList.contains('hide'),{},{timeout:90000});
}
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});await ready(page);
 await page.click('[data-menu="dd-inst"]');await page.click('#hall-toggle');await page.selectOption('#hall-floor','1');
 await page.click('#hall-key');await page.click('#hall-open');await page.click('#hall-observe');
 assert.equal(await page.evaluate(()=>hatchDoors[1].manualOpen),1);
 assert.equal(await page.evaluate(()=>HallManual.key()),false);
 const blocked=await page.evaluate(()=>{moveElevator(2);const automatic=moving;setInspectionMode(true);insStart(1);return {automatic,inspection:moving,car:CarDoor.secured(),others:hatchDoors.filter((h,i)=>i!==1).every(h=>h.right.position.x===h.right.userData.cx)};});
 assert.deepEqual(blocked,{automatic:false,inspection:false,car:true,others:true});
 await page.selectOption('#bypass-mode','hall');
 const passes=await page.evaluate(()=>{
  const results=[];
  for(const ratio of [.4,1]) for(const dir of [1,-1]) {
   HallManual.open(ratio);
   const cy=FLOOR_Y[1]+S.CAR_H/2, start=cy-dir*1.7,delta=start-carGrp.position.y;
   carGrp.position.y=start;cwtGrp.position.y-=delta;refreshRopes();refreshGovernorRope();
   const h=hatchDoors[1],x=h.right.position.x,left=h.left.position.x,cameraBefore=camera.position.toArray(),target=controls.target.toArray();
   insStart(dir);gsap.ticker.remove(insTick);
   const rejected=!HallManual.open(0)&&!HallManual.select(2)&&!HallManual.key();
   for(let i=0;i<140;i++){insTick(0,100);CarDoor.pose();}
   results.push({ratio,dir,rejected,passed:dir*(carGrp.position.y-cy)>1.7,held:h.right.position.x===x&&h.left.position.x===left,carClosed:DoorBypass.carClosedMonitor(),cameraHeld:JSON.stringify(camera.position.toArray())===JSON.stringify(cameraBefore)&&JSON.stringify(controls.target.toArray())===JSON.stringify(target)});
   insStop();
  }
  return results;
 });
 passes.forEach(p=>['rejected','passed','held','carClosed','cameraHeld'].forEach(k=>assert.equal(p[k],true,JSON.stringify(p))));
 await page.evaluate(()=>{HallManual.observe();insStart(-1);});await page.waitForFunction(()=>DoorBypass.active);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>moving||DoorBypass.active),false);
 await page.waitForFunction(()=>DoorBypass.audioState.gain===0);
 await page.evaluate(()=>insStart(1));await page.waitForFunction(()=>moving);
 await page.evaluate(()=>{CarDoor.state.locked=false;});await page.waitForFunction(()=>!moving);
 assert.equal(await page.evaluate(()=>{insStart(1);return moving;}),false);
 await page.evaluate(()=>{CarDoor.state.locked=true;insStart(-1);});await page.waitForFunction(()=>DoorBypass.active);
 const emergency=await page.evaluate(()=>{document.getElementById('btn-estop').click();return {moving,estop,active:DoorBypass.active,gain:DoorBypass.audioState.gain,insDir,errors:[]};});
 assert.equal(emergency.moving||emergency.active,false,JSON.stringify(emergency));
 await page.waitForFunction(()=>DoorBypass.audioState.gain===0);
 await page.evaluate(()=>document.getElementById('btn-estop').click());
 // View the apron as the car rises above the selected landing sill.
 await page.evaluate(()=>{const y=FLOOR_Y[1]+S.CAR_H/2+1,delta=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=delta;refreshRopes();refreshGovernorRope();HallManual.observe();});
 await page.screenshot({path:`${out}/desktop-open.png`});
 await page.click('#hall-close');await page.click('#hall-key');await page.selectOption('#bypass-mode','off');
 assert.equal(await page.evaluate(()=>DoorBypass.hallSecured()&&!hatchDoors[1].manualActive),true);
 await page.click('#btn-aut');await page.waitForFunction(()=>!moving&&!CarDoor.state.busy,{},{timeout:30000});
 await page.evaluate(()=>{clearTimeout(autoTimer);openDoors();});await page.waitForFunction(()=>doorOpen&&!CarDoor.state.busy);
 assert.equal(await page.evaluate(()=>Math.abs(hatchDoors[curFloor].right.position.x-CarDoor.dimensions().ox)<.001),true);
 await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>CarDoor.secured());
 const dest=await page.evaluate(()=>curFloor===0?1:0);await page.evaluate(f=>moveElevator(f),dest);await page.waitForFunction(f=>curFloor===f&&!moving,dest,{timeout:30000});
 const touch=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});const tp=await touch.newPage();await ready(tp);
 await tp.tap('[data-menu="dd-inst"]');await tp.tap('#hall-toggle');await tp.selectOption('#hall-floor','1');await tp.tap('#hall-key');await tp.tap('#hall-open');await tp.tap('#hall-observe');
 await tp.selectOption('#bypass-mode','hall');
 const bounds=await tp.locator('#hall-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=412);
 const up=await tp.locator('#btn-ins-up').boundingBox();
 const cdp=await touch.newCDPSession(tp);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:up.x+up.width/2,y:up.y+up.height/2}]});await tp.waitForFunction(()=>moving&&DoorBypass.active);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tp.waitForFunction(()=>!moving&&!DoorBypass.active);
 await tp.screenshot({path:`${out}/touch-open.png`});
 await tp.tap('#hall-close');await tp.tap('#hall-key');assert.equal(await tp.evaluate(()=>DoorBypass.hallSecured()),true);
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/result.json`,JSON.stringify({passes,errors,touch:true,actualMobile:false},null,2));console.log('PASS',JSON.stringify({passes,errors}));
} finally {await browser.close();}
