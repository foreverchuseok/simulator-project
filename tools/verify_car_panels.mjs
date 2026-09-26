import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof carGrp!=='undefined'&&carGrp?.userData.safetyGear, {timeout:30000});
 const checks=await page.evaluate(()=>{
  const p=scene.getObjectByName('carPanelAssembly'), checks=[];
  const check=(name,pass,detail)=>checks.push({name,pass,detail});
  scene.updateMatrixWorld(true);
  const bounds=o=>new THREE.Box3().setFromObject(o);
  const sill=bounds(scene.getObjectByName('carSill'));
  check('sill horizontal gap',Math.abs(HALL_SILL_SHAFT_Z-sill.max.z-SILL_GAP)<1e-6,HALL_SILL_SHAFT_Z-sill.max.z);
  check('floor and sill flush',Math.abs(sill.max.y-bounds(scene.getObjectByName('carFloorFinish')).max.y)<1e-6);
  check('side / stile clearance',p.userData.sideOuterX<S.CAR_BG/2-0.12,(S.CAR_BG/2-0.12)-p.userData.sideOuterX);
  check('cable / left panel clearance',bounds(scene.getObjectByName('carCableRun')).max.x<bounds(scene.getObjectByName('carWallLeft')).min.x);
  let panes=0; p.traverse(o=>{if(o.userData.type==='car-vision-glass')panes++;});
  check('rear and right glazed only',panes===6,panes);
  check('11 panel sections',Array.from({length:11},(_,i)=>!!p.getObjectByName('carPanel_'+(i+1))).every(Boolean));
  const opb=scene.getObjectByName('carOPB'), load=scene.getObjectByName('carOverloadAssembly');
  check('four floor OPB / display 4',opb.userData.displayFloor===4&&[1,2,3,4].every(f=>opb.getObjectByName('opbFloorButton_'+f))&&!opb.getObjectByName('opbFloorButton_5'));
  // 224~226p A 타입: 포텐셜미터 2개가 플랫폼 측면 채널 밑, 플랭크 양면에 대각으로 놓인다.
  const sensors=load.children.filter(o=>o.userData.type==='car-load-potentiometer');
  const pm1=scene.getObjectByName('carLoadSensor_PM1'), pm2=scene.getObjectByName('carLoadSensor_PM2');
  const local=o=>{const c=bounds(o).getCenter(new THREE.Vector3());return carGrp.worldToLocal(c);};
  check('two potentiometers PM1 / PM2, A type',sensors.length===2&&load.userData.sensorType==='potentiometer'&&load.userData.mountType==='A'&&pm1&&pm2&&!scene.getObjectByName('carLoadSwitch_110'));
  check('diagonal: PM1 left-front, PM2 right-rear',local(pm1).x<0&&local(pm1).z>0.04&&local(pm2).x>0&&local(pm2).z<0.04);
  check('sensors under platform side channels',[pm1,pm2].every(pm=>Math.abs(Math.abs(local(pm.getObjectByName('loadSensorBody')).x)-(S.CAR_W/2-0.02))<1e-6));
  const channelBottom=carGrp.position.y-S.CAR_H/2-0.085;
  check('plunger tops meet channel bottom, press 2~4mm',[pm1,pm2].every(pm=>Math.abs(bounds(pm.getObjectByName('loadSensorPlunger')).max.y-channelBottom)<1e-6&&pm.userData.pressMm>=2&&pm.userData.pressMm<=4));
  check('sensors on plank web faces',[pm1,pm2].every(pm=>{const c=local(pm.getObjectByName('loadSensorBody'));return Math.abs(Math.abs(c.z-0.04)-0.078)<1e-6;}));
  const plankBottom=carGrp.position.y-S.CAR_H/2-0.24;
  check('sensor assemblies between plank bottom and platform',bounds(pm1).min.y>plankBottom&&bounds(pm2).min.y>plankBottom&&bounds(pm1).max.y<=channelBottom+1e-6&&bounds(pm2).max.y<=channelBottom+1e-6);
  const harness=scene.getObjectByName('loadSensorHarness');
  check('sensor harness reaches top box',harness&&bounds(harness).max.y>bounds(scene.getObjectByName('carTopBox')).min.y-0.01);
  check('top box within car width',Math.abs(bounds(scene.getObjectByName('carTopBox')).min.x)<S.CAR_W/2);
  const wcop=scene.getObjectByName('carAccessibleOPB');
  const wcButtons=wcop.children.filter(o=>o.userData.type==='accessible-cop-button');
  const finishY=bounds(scene.getObjectByName('carFloorFinish')).max.y;
  check('accessible buttons at 1050mm',wcButtons.length===7&&wcButtons.every(b=>Math.abs(b.getWorldPosition(new THREE.Vector3()).y-finishY-1.05)<1e-6));
  check('accessible OPB on opaque entry-right wall',wcop.position.x<0&&wcop.getWorldDirection(new THREE.Vector3()).x>0.99&&bounds(wcop).min.z>bounds(scene.getObjectByName('carInteriorHandrail')).max.z);
  check('accessible OPB away from entrance corner',CAR_FRONT_Z-bounds(wcop).max.z>0.4);
  check('seven braille plates',wcop.children.filter(o=>o.name==='accessibleBraillePlate').length===7);
  const y0=carGrp.position.y, c0=cwtGrp.position.y;
  for(const fy of FLOOR_Y){carGrp.position.y=fy+S.CAR_H/2;cwtGrp.position.y=c0-(carGrp.position.y-y0);refreshRopes();scene.updateMatrixWorld(true);check('panel follows floor '+fy,Math.abs(bounds(scene.getObjectByName('carFloorFinish')).max.y-fy-0.004)<1e-6);}
  carGrp.position.y=y0;cwtGrp.position.y=c0;refreshRopes();
  return checks;
 });
 for(const view of (process.argv.includes('--load')?['overload','pm1','pm2','load-wiring']:process.argv.includes('--accessible')?['accessible']:process.argv.includes('--controls')?['opb','top-box','overload','accessible']:['front','rear','context','opb','top-box','overload','accessible'])){
  await page.evaluate(view=>{
   scene.children.forEach(o=>{if(o.userData.panelQaVisible===undefined)o.userData.panelQaVisible=o.visible;o.visible=o.userData.panelQaVisible;});
   if(view!=='context')scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
   const y=carGrp.position.y,z=CAR_CTR_Z;
   controls.enableDamping=false;controls.minDistance=0.1;
   camera.position.set(view==='rear'?4.4:4.8,y+2.4,z+(view==='rear'?-5.2:5.6));
   controls.target.set(0,y+0.25,z);
   if(view==='opb') {camera.position.set(0.70,y+0.06,z-0.90);controls.target.set(0.95,y-0.07,z+S.CAR_D/2-0.06);}
   if(view==='top-box') {camera.position.set(1.7,y+2.8,z+2.4);controls.target.set(-0.75,y+1.7,z+0.70);}
   if(view==='overload') {camera.position.set(1.4,y-S.CAR_H/2-1.1,z+4.2);controls.target.set(0,y-S.CAR_H/2-0.16,z+0.05);}
   if(view==='pm1') {camera.position.set(-0.72,y-S.CAR_H/2-0.42,z+0.78);controls.target.set(-1.18,y-S.CAR_H/2-0.12,z+0.12);}
   if(view==='pm2') {camera.position.set(0.72,y-S.CAR_H/2-0.42,z-0.78);controls.target.set(1.18,y-S.CAR_H/2-0.12,z-0.04);}
   if(view==='load-wiring') {camera.position.set(-3.4,y-S.CAR_H/2-1.6,z+3.2);controls.target.set(-0.8,y-S.CAR_H/2+0.3,z+0.3);}
   if(view==='accessible') {camera.position.set(0.15,y-0.05,z+0.75);controls.target.set(-1.12,y-S.CAR_H/2+1.05,z+0.25);}
   controls.update();
  },view);
  await page.screenshot({path:path.join(root,`.shot-car-panels-${view}.png`)});
 }
 checks.push({name:'runtime errors',pass:errors.length===0,detail:errors});
 console.log(JSON.stringify(checks,null,2));
 if(checks.some(c=>!c.pass))process.exitCode=1;
}finally{await browser?.close();server.close();}
