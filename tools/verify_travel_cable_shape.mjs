import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]);
  const file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(8896,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({args:['--enable-gpu']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:8896/index.html?tcam',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>travelCable.ready && carGrp.userData.safetyGear);
  await page.waitForFunction(()=>document.getElementById('loading').classList.contains('hide'));
  await page.evaluate(()=>document.getElementById('loading').style.display='none');
  const result=await page.evaluate(()=>{
    const checks=[]; const check=(name,pass,detail)=>checks.push({name,pass,detail});
    const original=carGrp.position.y, originalCwt=cwtGrp.position.y;
    const move=y=>{const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;refreshRopes();scene.updateMatrixWorld(true);};
    for(const y of [...FLOOR_Y.map(y=>y+S.CAR_H/2),FLOOR_Y[0]+S.CAR_H/2-0.35,FLOOR_Y.at(-1)+S.CAR_H/2+0.35]){
      move(y);
      const yc=travelCable.loopBottomY+TC_LOOP_R;
      const length=travelCable.hangerY-yc+Math.PI*TC_LOOP_R+y+TC_CAR_HANGER_LY-yc;
      check('length / pit / positive legs',Math.abs(length-travelCable.totalLen)<1e-6&&travelCable.loopBottomY>Y0+0.02&&travelCable.hangerY>yc&&y+TC_CAR_HANGER_LY>yc,{y,bottom:travelCable.loopBottomY});
      const p=travelCable.ribbon.geometry.attributes.position;
      check('finite ribbon',Array.from(p.array).every(Number.isFinite),y);
      const bb=new THREE.Box3().setFromObject(travelCable.ribbon);
      let underCar=true;
      for(let i=0;i<p.count;i++)if(p.getX(i)>-S.CAR_W/2&&p.getY(i)>y-S.CAR_H/2-.30)underCar=false;
      check('wall clearance / car-side leg stays below platform',bb.min.x>-S.SHAFT_W/2&&underCar,{min:bb.min.toArray(),max:bb.max.toArray()});
    }
    move(original);cwtGrp.position.y=originalCwt;refreshRopes();
    for(const name of ['fixedCableRun','carCableRun']){
      const m=scene.getObjectByName(name), bb=new THREE.Box3().setFromObject(m);
      check(name+' finite / wall clearance',Array.from(m.geometry.attributes.position.array).every(Number.isFinite)&&bb.min.x>-S.SHAFT_W/2,{min:bb.min.toArray(),max:bb.max.toArray()});
    }
    check('pit 300mm',Math.abs(travelCable.loopBottomY-(Y0+0.02)-TC_PIT_CLEAR)<1e-6,travelCable.loopBottomY);
    check('rounded thin flat profile',TC_W/TC_T>8&&travelCableProfile().length>8,{w:TC_W,t:TC_T});
    const junction=scene.getObjectByName('carCableJunction');
    const pos=junction.getWorldPosition(new THREE.Vector3());move(original+1);
    check('car junction follows car',Math.abs(junction.getWorldPosition(new THREE.Vector3()).y-pos.y-1)<1e-6,true);
    move(original);cwtGrp.position.y=originalCwt;refreshRopes();
    check('existing six terminal switches retained',terminalDevices.switches.length===6,terminalDevices.switches.length);
    return checks;
  });
  await page.evaluate(()=>{scene.children.forEach(o=>o.userData.tcQaVisible=o.visible);});
  for(const view of (process.argv.includes('--detail')?['under','side','hanger']:['loop','under','side','hanger','overall'])){
    await page.evaluate(view=>{
      scene.children.forEach(o=>{o.visible=o.userData.tcQaVisible;});
      if(['under','side','hanger'].includes(view)) scene.children.forEach(o=>{
        if(o!==carGrp&&o!==travelCableGrp&&!o.isLight)o.visible=false;
      });
      controls.enableDamping=false; controls.minDistance=0.1;
      const y=FLOOR_Y[1]+S.CAR_H/2;
      const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;refreshRopes();
      let target,cam;
      if(view==='loop') {wallGrp.visible=false;target=[(TC_X+TC_CAR_X)/2,travelCable.loopBottomY+0.18,TC_CAR_Z];cam=[TC_X+0.65,target[1]+0.20,target[2]+1.2];}
      if(view==='under'){target=[TC_SIDE_X,y+TC_CAR_HANGER_LY+0.15,TC_CAR_Z];cam=[TC_SIDE_X-0.75,target[1]-0.40,target[2]+0.50];}
      if(view==='side'){target=[TC_SIDE_X,y+0.55,TC_CAR_Z];cam=[-3.2,y+0.5,TC_CAR_Z+0.7];}
      if(view==='hanger'){carGrp.visible=false;target=[TC_X-.045,travelCable.hangerY+0.05,TC_FIX_Z];cam=[TC_X+.40,target[1]+0.05,target[2]+0.65];}
      if(view==='overall'){target=[-1.3,6,0];cam=[5,7,5];}
      camera.position.set(...cam);controls.target.set(...target);controls.update();
    },view);
    await page.evaluate(()=>renderer.render(scene,camera));
    await page.screenshot({path:path.join(root,`.shot-tc-real-${view}.png`)});
  }
  result.push({name:'page errors',pass:errors.length===0,detail:errors});
  fs.writeFileSync(path.join(root,'.shot-tc-real-checks.json'),JSON.stringify(result,null,2));
  result.forEach(c=>console.log(`${c.pass?'PASS':'FAIL'} ${c.name}: ${JSON.stringify(c.detail)}`));
  if(result.some(c=>!c.pass))process.exitCode=1;
}finally{await browser?.close();server.close();}
