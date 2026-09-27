// Same quality before/after; desktop measurements are not tablet performance results.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const label=process.argv[2]||'current';
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('Use an alphanumeric report label');
const root=process.cwd(),out=path.join(root,'.shot-render-performance');fs.mkdirSync(out,{recursive:true});
const baseline=process.argv.includes('--baseline');
const originals=new Map(baseline?['js/car-panels.js','js/car-door.js','js/car-door-transmission.js'].map(f=>[path.join(root,f),execFileSync('git',['show','HEAD:'+f])]):[]);
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(file)]||'application/octet-stream');if(originals.has(file))res.end(originals.get(file));else fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 await page.addInitScript(()=>{let seed=20260918;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof mrGrp!=='undefined'&&govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));

 await page.waitForFunction(()=>CarDoor.state?.ready&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 if(!baseline)await page.waitForFunction(()=>scene.getObjectByName('carIdentificationPlate')?.userData.ready&&scene.getObjectByName('carPassengerSafetyNotice')?.material.map.image?.complete);
 const home=async()=>page.evaluate(()=>{controls.enableDamping=false;const y=carGrp.position.y-S.CAR_H/2;camera.fov=65;camera.updateProjectionMatrix();camera.position.set(.18,y+1.5,CAR_CTR_Z-S.CAR_D/2+.35);controls.target.set(-.08,y+1.35,CAR_CTR_Z+S.CAR_D/2);controls.update();});
 const results=[];
 for(const viewport of [{width:1280,height:850},{width:390,height:844}]) {
  await page.setViewportSize(viewport);await home();await page.waitForTimeout(1500);
  results.push(await page.evaluate(async()=>{const times=[];let last=await new Promise(requestAnimationFrame),start=last;while(last-start<5000){const now=await new Promise(requestAnimationFrame);times.push(now-last);last=now;}times.sort((a,b)=>a-b);return {width:innerWidth,height:innerHeight,dpr:renderer.getPixelRatio(),median:times[Math.floor(times.length/2)],p95:times[Math.floor(times.length*.95)],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}));
  await page.screenshot({path:path.join(out,`${label}-interior-${viewport.width}.png`)});
 }
 let checks;
 if(!baseline){
  checks=await page.evaluate(()=>{
   const q=CarDoor.state,marks=q.transmission.marks;
   const before={x:carDoorR.position.x,release:q.release};let minMarkerY=Infinity,maxStickerDrift=0;
   const stickers=[carDoorL.getObjectByName('carDoorLeanSticker'),carDoorR.getObjectByName('carDoorHandSticker')];
   for(let i=0;i<=100;i++){
    carDoorR.position.x=q.d.cx+q.d.stroke*i/100;q.release=1;CarDoor.pose();carGrp.updateMatrixWorld(true);
    for(const {marker} of marks)minMarkerY=Math.min(minMarkerY,marker.position.y);
    for(const sticker of stickers){const p=carGrp.worldToLocal(sticker.getWorldPosition(new THREE.Vector3()));maxStickerDrift=Math.max(maxStickerDrift,Math.abs(p.x-(sticker.parent.position.x+sticker.position.x)));}
   }
   carDoorR.position.x=before.x;q.release=before.release;CarDoor.pose();
   const plate=scene.getObjectByName('carIdentificationPlate'),poster=scene.getObjectByName('carPassengerSafetyNotice');
   const soffit=scene.getObjectByName('entranceHeaderSoffit');
   const gap=q.d.doorZ-CarDoor.spec.panelT/2-(soffit.position.z+soffit.geometry.parameters.depth/2);
   const box=new THREE.Box3().setFromObject(plate),size=box.getSize(new THREE.Vector3());
   return {number:plate.userData.number,plateWidth:size.x,plateHeight:size.y,posterFacesCabin:poster.getWorldDirection(new THREE.Vector3()).z<-.99,posterOnOppositeReturn:poster.position.x<0,company:!!scene.getObjectByName('opbCompanyName'),minMarkerY,trackY:q.d.trackY,maxStickerDrift,gap};
  });
  assert.equal(checks.number,'0001-001');assert.ok(Math.abs(checks.plateWidth-.210)<1e-5&&Math.abs(checks.plateHeight-.064)<1e-5);
  assert.ok(checks.posterFacesCabin&&checks.posterOnOppositeReturn&&checks.company);
  assert.ok(checks.minMarkerY>checks.trackY,'Motion markers stay outside the passenger compartment');assert.ok(checks.maxStickerDrift<1e-6);assert.ok(checks.gap>.0049);
  await page.setViewportSize({width:1280,height:850});await home();
  await page.screenshot({path:path.join(out,label+'-final.png')});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,label+'-interior.json'),JSON.stringify({results,checks,errors},null,2));console.log(JSON.stringify({results,checks,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
