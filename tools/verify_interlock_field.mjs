import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'.shot-interlock-field');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404).end();return;
  }
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const errors=[];
try{
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>hatchDoors.length===4&&hatchDoors.every(h=>h.interlock?.ready));
  console.log('Loaded four field interlocks.');
  await page.evaluate(()=>{
    camera.near=0.002;camera.updateProjectionMatrix();controls.minDistance=0.005;
    // Use the normal scene lighting; avoid hiding model issues with a special exposure.
    document.querySelectorAll('#ui,#hud,.panel,#hint,#loading').forEach(e=>e.style.display='none');
  });
  const inspect=()=>{
    HallInterlock.updateAll(hatchDoors);scene.updateMatrixWorld(true);
    return hatchDoors.map(h=>{
      const s=h.interlock;
      const wp=o=>o.getWorldPosition(new THREE.Vector3()).toArray();
      const lip=s.moving.getObjectByName('hallLatchKeeperLip');
      const pocket=s.opposite.getObjectByName('hallLatchPocket');
      return {spec:h.latch,lip:wp(lip),pocket:wp(pocket),fixed:wp(s.fixed),opposite:wp(s.opposite),
        moving:wp(s.moving),springLength:s.spring.scale.y*s.springRest,
        stockLength:s.stock.scale.y,angle:h.hook.rotation.z,
        pinSlot:h.right.userData.triKey.drivePin.getWorldPosition(new THREE.Vector3())
          .distanceTo(s.foot.getWorldPosition(new THREE.Vector3())),
        colors:s.opposite.getObjectByName('hallLatchBar').geometry.hasAttribute('color')};
    });
  };
  const closed=await page.evaluate(inspect);
  for(const c of closed){
    assert.ok(Math.abs(c.pocket[1]-c.lip[1]-0.008)<1e-6,'Closed tooth engagement');
    assert.ok(Math.abs(c.pocket[2]-c.lip[2])<1e-6,'Latch plane');
    assert.equal(c.spec.keeperParent,'oppositeDoor');
    assert.ok(c.pinSlot<0.008,'Cam pin sits in the link-foot slot');
  }
  const aim=async(offset,detail=false)=>{
    await page.evaluate(({offset,detail})=>{
      const h=hatchDoors[1];
      const target=detail?h.interlock.opposite.getObjectByName('hallLatchPocket').getWorldPosition(new THREE.Vector3()):
        h.interlock.fixed.localToWorld(new THREE.Vector3(0.060,-0.015,-0.015));
      camera.position.copy(target).add(new THREE.Vector3(...offset));
      controls.target.copy(target);controls.update();
    },{offset,detail});
    await page.waitForTimeout(250);
  };
  await aim([0.08,0.10,-0.52]);
  await page.screenshot({path:path.join(out,'closed-overview.png')});
  await aim([0.02,0.075,-0.15],true);
  await page.screenshot({path:path.join(out,'closed-latch.png')});
  await page.evaluate(()=>{
    const p=hatchDoors[1].right.userData.triKey.drivePin.getWorldPosition(new THREE.Vector3());
    camera.position.copy(p).add(new THREE.Vector3(-0.10,0.05,-0.22));
    controls.target.copy(p);controls.update();
  });
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,'key-link.png')});
  await page.evaluate(()=>{
    for(const h of hatchDoors) h.hook.rotation.z=-h.latch.liftRad;
  });
  const lifted=await page.evaluate(inspect);
  for(let i=0;i<lifted.length;i++){
    assert.ok(Math.abs(lifted[i].lip[1]-lifted[i].pocket[1]-0.004)<1e-6,'Open tooth clearance');
    assert.ok(lifted[i].springLength<closed[i].springLength-0.003,'Spring actually compresses');
    assert.equal(lifted[i].stockLength,closed[i].stockLength,'Rigid link length');
  }
  await page.screenshot({path:path.join(out,'lifted-latch.png')});
  const through=await page.evaluate(()=>{
    const s=hatchDoors[1].interlock;
    const pocket=s.opposite.getObjectByName('hallLatchPocket');
    const origin=pocket.getWorldPosition(new THREE.Vector3());origin.y+=0.010;
    const r=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,0.04);
    return r.intersectObject(s.opposite.getObjectByName('hallLatchBar'),false).length;
  });
  assert.equal(through,0,'Rectangular pocket really passes through the plate');
  const socketHits=await page.evaluate(()=>{
    const s=hatchDoors[1].interlock;
    const walls=['Clear_socket-side_wall','Terminal_spine'].map(n=>s.fixed.getObjectByName(n));
    return [-0.021,0.021].map(y=>{
      const p=s.fixed.localToWorld(new THREE.Vector3(-0.050,y,-0.017));
      return new THREE.Raycaster(p,new THREE.Vector3(1,0,0),0,0.070).intersectObjects(walls,false).length;
    });
  });
  assert.deepEqual(socketHits,[0,0],'Auxiliary pins have actual socket bores');
  const clashes=await page.evaluate(()=>{
    const h=hatchDoors[1],s=h.interlock;
    const fixed=[],moving=[];
    s.fixed.traverse(o=>{if(o.isMesh)fixed.push(o);});
    for(const group of [s.moving,s.opposite]) group.traverse(o=>{if(o.isMesh)moving.push(o);});
    const result=[];
    const ray=new THREE.Raycaster();
    const v0=new THREE.Vector3(),v1=new THREE.Vector3(),dir=new THREE.Vector3();
    function edgeCrosses(a,b){
      const pos=a.geometry.attributes.position,idx=a.geometry.index;
      const count=idx?idx.count:pos.count;
      const materials=Array.isArray(b.material)?b.material:[b.material];
      const sides=materials.map(m=>m.side);
      materials.forEach(m=>{m.side=THREE.DoubleSide;});
      try{
        for(let i=0;i<count;i+=3)for(let j=0;j<3;j++){
          const ai=idx?idx.getX(i+j):i+j,bi=idx?idx.getX(i+(j+1)%3):i+(j+1)%3;
          v0.fromBufferAttribute(pos,ai).applyMatrix4(a.matrixWorld);
          v1.fromBufferAttribute(pos,bi).applyMatrix4(a.matrixWorld);
          dir.copy(v1).sub(v0);const length=dir.length();
          if(length<1e-7)continue;
          ray.set(v0,dir.divideScalar(length));ray.near=1e-6;ray.far=length-1e-6;
          if(ray.intersectObject(b,false).length)return true;
        }
        return false;
      }finally{materials.forEach((m,i)=>{m.side=sides[i];});}
    }
    for(const distance of [0,0.004,0.010,0.03,0.10,0.30,0.754]){
      h.left.position.x=h.left.userData.cx-distance;
      h.right.position.x=h.right.userData.cx+distance;
      HallInterlock.update(h);scene.updateMatrixWorld(true);
      for(const a of fixed)for(const b of moving){
        // Pins deliberately enter their sockets through holes; bounding boxes
        // cannot represent those holes. The slotted sheet is checked by rays.
        if(b.name.startsWith('Auxiliary_contact_pin')||b.name==='hallLatchBar')continue;
        const bb=new THREE.Box3().setFromObject(a).intersect(new THREE.Box3().setFromObject(b));
        if(bb.isEmpty())continue;
        const d=bb.getSize(new THREE.Vector3());
        if(Math.min(d.x,d.y,d.z)<=0.001)continue;
        // A rotating concave stamped plate has a greatly inflated AABB.
        if(b.name==='hallLatchKeeperArm'&&!edgeCrosses(a,b)&&!edgeCrosses(b,a))continue;
        result.push({distance,a:a.name,b:b.name,mm:d.multiplyScalar(1000).toArray()});
      }
    }
    h.left.position.x=h.left.userData.cx;h.right.position.x=h.right.userData.cx;
    return result;
  });
  fs.writeFileSync(path.join(out,'clashes.json'),JSON.stringify(clashes,null,2));
  assert.deepEqual(clashes,[],'Fixed-switch / moving-part sweep');
  await page.evaluate(()=>{
    for(const h of hatchDoors){
      h.left.position.x-=0.18;h.right.position.x+=0.18;spinDoorDrive(h);
    }
  });
  const open=await page.evaluate(inspect);
  open.forEach((o,i)=>{
    assert.deepEqual(o.fixed,closed[i].fixed,'Switch remains header-fixed');
    assert.ok(Math.abs(o.pocket[0]-closed[i].pocket[0]+0.18)<1e-6,'Keeper follows opposite door');
    assert.ok(Math.abs(o.moving[0]-closed[i].moving[0]-0.18)<1e-6,'Hook follows its door');
  });
  await aim([0.08,0.12,-0.95]);
  await page.screenshot({path:path.join(out,'doors-separated.png')});
  await page.evaluate(()=>{
    hatchDoors.forEach((h,i)=>{
      h.left.position.x=h.left.userData.cx;h.right.position.x=h.right.userData.cx;
      setEmergencyKey(i,1);spinDoorDrive(h);
    });
  });
  const key=await page.evaluate(inspect);
  key.forEach(k=>assert.ok(Math.abs(k.lip[1]-k.pocket[1]-0.004)<1e-6,'Emergency-key release'));
  await page.evaluate(()=>hatchDoors.forEach((h,i)=>setEmergencyKey(i,0)));
  const reset=await page.evaluate(inspect);
  reset.forEach((r,i)=>assert.deepEqual(r.lip,closed[i].lip,'Reset docks tooth'));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({closed,lifted,open,key,errors},null,2));
  console.log('PASS: GLB colours, four floors, 8 mm engagement, 4 mm release, through slot, spring compression, rigid link, opposite-door keeper, emergency key/reset.');
  console.log(out);
}catch(e){console.error('Browser diagnostics:',errors);throw e;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
