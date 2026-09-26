import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1400,height:1000},hasTouch:true}),errors=[];
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
  let panes=0; p.traverse(o=>{if(o.userData.type==='car-vision-glass')panes++;});
  check('rear and right glazed only',panes===6,panes);
  check('11 panel sections',Array.from({length:11},(_,i)=>!!p.getObjectByName('carPanel_'+(i+1))).every(Boolean));
  const wcop=scene.getObjectByName('carAccessibleOPB');
  const wcButtons=wcop.children.filter(o=>o.userData.type==='accessible-cop-button');
  const finishY=bounds(scene.getObjectByName('carFloorFinish')).max.y;
  check('accessible buttons at 1050mm',wcButtons.length===7&&wcButtons.every(b=>Math.abs(b.getWorldPosition(new THREE.Vector3()).y-finishY-1.05)<1e-6));
  check('accessible OPB on opaque entry-right wall',wcop.position.x<0&&wcop.getWorldDirection(new THREE.Vector3()).x>0.99&&bounds(wcop).min.z>bounds(scene.getObjectByName('carInteriorHandrail')).max.z);
  check('accessible OPB away from entrance corner',CAR_FRONT_Z-bounds(wcop).max.z>0.4);
  check('seven braille plates',wcop.children.filter(o=>o.name==='accessibleBraillePlate').length===7);
  const hr=scene.getObjectByName('carAccessibleHandrails');
  const grip=hr.children.filter(o=>o.userData.diameter), hb=grip.map(bounds);
  check('handrail entire grip within 800–900mm',hb.every(b=>b.min.y-finishY>=.8-1e-6&&b.max.y-finishY<=.9+1e-6),hb.map(b=>[b.min.y-finishY,b.max.y-finishY]));
  check('handrail diameter 32–38mm',grip.every(o=>o.userData.diameter>=.032&&o.userData.diameter<=.038));
  check('three walls with entrance clear',hr.userData.sides.length===3&&hb.every(b=>b.max.z<CAR_FRONT_Z-.03));
  const gaps=hr.userData.joints.map(([a,b])=>new THREE.Vector3(...hr.getObjectByName(a).userData.end).distanceTo(new THREE.Vector3(...hr.getObjectByName(b).userData.start)));
  check('continuous joints below 30mm',gaps.every(g=>g<.000001),gaps);
  const cop=bounds(wcop), sideRail=bounds(hr.getObjectByName('handrailLeft'));
  check('COP face above rail with finger space',cop.min.y-sideRail.max.y>.04,cop.min.y-sideRail.max.y);
  const y0=carGrp.position.y, c0=cwtGrp.position.y;
  for(const fy of FLOOR_Y){carGrp.position.y=fy+S.CAR_H/2;cwtGrp.position.y=c0-(carGrp.position.y-y0);refreshRopes();scene.updateMatrixWorld(true);check('handrail follows floor '+fy,Math.abs(bounds(hr.getObjectByName('carInteriorHandrail')).getCenter(new THREE.Vector3()).y-fy-0.004-0.85)<1e-6);check('panel follows floor '+fy,Math.abs(bounds(scene.getObjectByName('carFloorFinish')).max.y-fy-0.004)<1e-6);}
  carGrp.position.y=y0;cwtGrp.position.y=c0;refreshRopes();
  return checks;
 });
 for(const view of ['interior','accessible']){
  await page.evaluate(view=>{
   scene.children.forEach(o=>{if(o.userData.panelQaVisible===undefined)o.userData.panelQaVisible=o.visible;o.visible=o.userData.panelQaVisible;});
   if(view!=='context')scene.children.forEach(o=>{if(o!==carGrp&&!o.isLight)o.visible=false;});
   const y=carGrp.position.y,z=CAR_CTR_Z;
   controls.enableDamping=false;controls.minDistance=0.1;
   camera.position.set(view==='rear'?4.4:4.8,y+2.4,z+(view==='rear'?-5.2:5.6));
   controls.target.set(0,y+0.25,z);
   if(view==='accessible') {camera.position.set(0.15,y-0.05,z+0.75);controls.target.set(-1.12,y-S.CAR_H/2+1.05,z+0.25);}
   if(view==='interior'){camera.fov=65;camera.updateProjectionMatrix();camera.position.set(.7,y-S.CAR_H/2+1.45,z+S.CAR_D/2-.15);controls.target.set(-.35,y-S.CAR_H/2+.78,z-S.CAR_D/2+.3);}
   controls.update();
  },view);
  await page.screenshot({path:path.join(root,`.shot-handrail-${view}.png`)});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const y=carGrp.position.y,z=CAR_CTR_Z;camera.fov=70;camera.updateProjectionMatrix();camera.position.set(.55,y-S.CAR_H/2+1.4,z+S.CAR_D/2-.15);controls.target.set(-.25,y-S.CAR_H/2+.85,z-S.CAR_D/2+.2);controls.update();});
 await page.screenshot({path:path.join(root,'.shot-handrail-mobile.png')});
 await page.tap('[data-f="1"]');await page.waitForFunction(()=>curFloor===1&&!moving);await page.waitForFunction(()=>doorOpen&&!CarDoor.state.busy);
 checks.push({name:'touch floor call and door opening',pass:await page.evaluate(()=>curFloor===1&&doorOpen&&!estop)});
 checks.push({name:'runtime errors',pass:errors.length===0,detail:errors});
 console.log(JSON.stringify(checks,null,2));
 if(checks.some(c=>!c.pass))process.exitCode=1;
}finally{await browser?.close();server.close();}
