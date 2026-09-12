// Self-hosted verification of the opposed threaded terminals and door travel.
// Run from the repository root: node tools/verify_relay_rope.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-relay-new');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?doorcam=1`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>hatchDoors.length===FLOORS&&hatchDoors.every(h=>h.interlock?.ready));
 const checks=await page.evaluate(()=>{
   const rows=[],check=(name,pass,detail)=>rows.push({name,pass:!!pass,detail});
   for(const [i,h] of hatchDoors.entries()){
     const k=h.link,span=k.pulRX-k.pulLX,ends=h.left.getObjectByName('relayThreadedTerminals');
     check(`floor ${i}: opposed terminals and two access slots`,ends&&h.left.userData.windows.length===2&&h.left.userData.relayTerminalType==='opposed-threaded-studs');
     const leads=[];ends.traverse(o=>{if(o.name==='relayTerminalLead')leads.push(o);});
     const plateZ=k.loZ-0.012,plateCY=(k.upY+k.loY)/2-0.040;
     check(`floor ${i}: leads cross only access slots`,leads.length===2&&leads.every(lead=>{
       const a=lead.geometry.attributes.position;
       for(let j=0;j<a.count;j++){
         if(Math.abs(a.getZ(j)-plateZ)>0.00175)continue;
         const x=a.getX(j),y=a.getY(j)-plateCY;
         if(!h.left.userData.windows.some(w=>x>w.x0&&x<w.x1&&y>w.y0&&y<w.y1))return false;
       }return true;
     }));
     let total0;const fixed=h.interlock.fixed.getWorldPosition(new THREE.Vector3()).toArray();
     for(let step=0;step<=10;step++){
       const t=step/10;for(const d of [h.left,h.right])d.position.x=d.userData.cx+(d.userData.ox-d.userData.cx)*t;
       spinDoorDrive(h);scene.updateMatrixWorld(true);
       const segs=Object.values(k.seg),sum=segs.reduce((v,m)=>v+m.scale.y,0);
       if(total0===undefined)total0=sum;
       check(`floor ${i} opening ${t}: taut positive spans / conserved length`,segs.every(m=>m.visible&&m.scale.y>0)&&Math.abs(sum-total0)<1e-6&&Math.abs(sum-(2*span-2*k.aHalf-(k.bR-k.bL)))<1e-6);
       const edge=m=>[m.position.x-m.scale.y/2,m.position.x+m.scale.y/2];
       const a=edge(k.seg.loL),b=edge(k.seg.loR);
       check(`floor ${i} opening ${t}: lead connections`,leads.every(lead=>{
         const p=lead.localToWorld(new THREE.Vector3(...lead.userData.start));
         const m=lead.parent.name==='relayTerminalUpper'?k.seg.loL:k.seg.loR;
         const tip=m.localToWorld(new THREE.Vector3(0,lead.parent.name==='relayTerminalUpper'?-.5:.5,0));
         return p.distanceTo(tip)<1e-6;
       }));
       check(`floor ${i} opening ${t}: lower endpoints / pulley tangency`,Math.abs(a[1]-(h.left.position.x+k.bL))<1e-6&&Math.abs(b[0]-(h.left.position.x+k.bR))<1e-6&&[k.seg.loL,k.seg.loR].every(m=>m.position.y===k.loY&&m.position.z===k.loZ));
       check(`floor ${i} opening ${t}: closer / fixed interlock preserved`,Math.abs(k.closer.coil.scale.x-(k.closer.anchorX-h.left.position.x-k.closer.lugDX-0.006))<1e-6&&h.interlock.fixed.getWorldPosition(new THREE.Vector3()).toArray().every((v,j)=>v===fixed[j]));
     }
     for(const d of [h.left,h.right])d.position.x=d.userData.cx;spinDoorDrive(h);
   }return rows;
 });
 for(const view of ['closed','half','open','terminal','back','pulley']){
   await page.evaluate(view=>{
     const h=hatchDoors[1],k=h.link,t=view==='open'?1:view==='half'?.5:0;
     for(const d of [h.left,h.right])d.position.x=d.userData.cx+(d.userData.ox-d.userData.cx)*t;spinDoorDrive(h);
     const p=k.pulL.getWorldPosition(new THREE.Vector3());
     controls.enableDamping=false;controls.minDistance=.02;
     if(view==='terminal'||view==='back'){
       const x=h.left.position.x;
       camera.position.set(x+(view==='back'?.12:.07),p.y+.035,p.z+(view==='back'?.43:-.44));controls.target.set(x,p.y-.014,p.z-.02);
     }else if(view==='pulley'){
       camera.position.set(p.x+.04,p.y+.04,p.z-.26);controls.target.copy(p);
     }else{camera.position.set(0,p.y+.12,p.z-2.35);controls.target.set(0,p.y-.01,p.z);}
     controls.update();
   },view);
   await page.screenshot({path:path.join(out,view+'.png')});
 }
 checks.push({name:'runtime errors',pass:errors.length===0,detail:errors});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(checks,null,2));
 console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass)},null,2));if(checks.some(c=>!c.pass))process.exitCode=1;
}finally{await browser?.close();server.close();}
