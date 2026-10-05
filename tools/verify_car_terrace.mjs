// Run against Live Server; verifies the finish envelope and captures actual cabin views.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-terrace';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,hasTouch:true});
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>CarDoor.state?.ready&&scene.getObjectByName('terraceCeiling')?.userData.ready&&document.getElementById('loading').classList.contains('hide'));
  const checks=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    const ceiling=scene.getObjectByName('terraceCeiling'),bounds=new THREE.Box3().setFromObject(ceiling),floor=scene.getObjectByName('carFloorFinish');
    const floorBox=new THREE.Box3().setFromObject(floor),q=CarDoor.state,d=q.d;
    const oldX=carDoorR.position.x,oldRelease=q.release;
    let minRunningGap=Infinity,maxDrift=0;
    const inlays=[];for(const g of [carDoorL,carDoorR])g.traverse(o=>{if(o.isMesh&&o.material===CarTerrace.getMaterials().gold)inlays.push(o);});
    for(let i=0;i<=100;i++){
      carDoorR.position.x=d.cx+d.stroke*i/100;q.release=1;CarDoor.pose();carGrp.updateMatrixWorld(true);
      for(const o of inlays){
        const p=carGrp.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
        maxDrift=Math.max(maxDrift,Math.abs(p.x-o.parent.position.x-o.position.x));
        o.geometry.computeBoundingBox();
        minRunningGap=Math.min(minRunningGap,p.z+o.geometry.boundingBox.min.z-(S.CAR_D/2-.055+.0325));
      }
    }
    carDoorR.position.x=oldX;q.release=oldRelease;CarDoor.pose();
    let panes=0;scene.getObjectByName('carPanelAssembly').traverse(o=>{if(o.userData.type==='car-vision-glass')panes++;});
    return {ceilingHeight:bounds.min.y-floorBox.max.y,ceilingRoofGap:carGrp.position.y+S.CAR_H/2-.025-bounds.max.y,
      ceilingFront:bounds.max.z-CAR_CTR_Z,doorBack:d.doorZ-CarDoor.spec.panelT/2,
      inlays:inlays.length,maxDrift,minRunningGap,panes,
      ceilingMeshes:ceiling.getObjectByName('TerraceCeiling').children.length,
      theme:scene.getObjectByName('carTerraceInterior').userData.theme};
  });
  assert.equal(checks.theme,'TERRACE');assert.equal(checks.panes,6);assert.equal(checks.inlays,2); // two strips batched per leaf
  assert.ok(checks.ceilingHeight>2.19&&checks.ceilingRoofGap>-.00001);
  assert.ok(checks.ceilingFront<checks.doorBack-.02);
  assert.ok(checks.minRunningGap>.0048&&checks.maxDrift<1e-6);
  async function view(name) {
    await page.evaluate(name=>{
      leaveCabinView();controls.enableDamping=false;controls.minDistance=.04;
      const f=carGrp.position.y-S.CAR_H/2,z=CAR_CTR_Z;
      camera.near=.002;camera.fov=80;camera.updateProjectionMatrix();
      camera.position.set(.05,f+1.38,z-S.CAR_D/2+.17);controls.target.set(-.08,f+1.12,z+S.CAR_D/2);
      if(name==='ceiling'){camera.fov=85;camera.updateProjectionMatrix();camera.position.set(.05,f+1.2,z-.7);controls.target.set(0,f+2.30,z+.1);}
      if(name==='glass'){camera.position.set(-.1,f+1.4,z+S.CAR_D/2-.3);controls.target.set(.05,f+1.08,z-S.CAR_D/2);}
      controls.update();
    },name);
    await page.waitForTimeout(600);await page.screenshot({path:`${out}/${name}.png`});
  }
  await view('front');await view('ceiling');await view('glass');
  await page.setViewportSize({width:390,height:844});await view('mobile');
  await page.evaluate(()=>{targetSpeed=240;gsap.ticker.lagSmoothing(0);});
  await page.tap('#m-run');await page.tap('[data-f="1"]');await page.waitForFunction(()=>curFloor===1&&!moving&&doorOpen&&!CarDoor.state.busy);
  assert.ok(await page.evaluate(()=>!estop&&scene.getObjectByName('terraceCeiling').userData.ready));
  await page.screenshot({path:`${out}/mobile-open.png`});
  await page.setViewportSize({width:1440,height:1000});await view('front-open');
  await page.click('#btn-close');await page.waitForFunction(()=>!doorOpen&&!CarDoor.state.busy&&CarDoor.secured());
  assert.ok(await page.evaluate(()=>Math.abs(carDoorR.position.x-CarDoor.state.d.cx)<1e-6));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/report.json`,JSON.stringify({checks,touchCallAndDoorOpen:true,doorClosedAndLocked:true,errors},null,2));
  console.log(JSON.stringify({checks,touchCallAndDoorOpen:true,doorClosedAndLocked:true,errors}));
} finally {await browser.close();}
