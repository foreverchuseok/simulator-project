import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-manual-rescue');fs.mkdirSync(out,{recursive:true});
const speed=process.argv.includes('--fast')?3:1;
const mobile=process.argv.includes('--mobile'),width=process.argv.includes('--narrow')?320:390;
const server=http.createServer((req,res)=>{
  const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
  browser=await chromium.launch({args:['--enable-gpu']});const page=await browser.newPage(mobile?{viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1280,height:850}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>scene.getObjectByName('IntercomHandset')&&scene.getObjectByName('ReleaseLeverHung')?.userData.ready&&mrGrp.userData.traction?.ready&&CarDoor.state?.ready&&document.getElementById('loading').classList.contains('hide'));
  console.log('READY');await page.evaluate(speed=>{gsap.globalTimeline.timeScale(speed);},speed);
  await page.evaluate(()=>{
    window.rescueBefore={car:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,bear:Mascot.root.position.toArray(),bearScale:Mascot.root.scale.toArray(),passenger:UCMDemo.character.visible,camera:camera.position.toArray(),target:controls.target.toArray(),controlOpen:ControlPanel.open,powerOpen:MachineRoomPower.open,selector:scene.getObjectByName('ManualModeSelector').quaternion.toArray(),breaker:scene.getObjectByName('MainBreakerToggle').quaternion.toArray()};
    window.rescueSamples=[];window.rescueProbe=()=>{
      if(!ManualRescueDemo.active)return;const s=ManualRescueDemo.state,q=CarDoor.state,h=hatchDoors[s.floor],tr=mrGrp.userData.traction;
      const p=ManualRescueDemo.handlePivot;
      const spec=scene.getObjectByName('TurningHandleHung').userData.manualRescue;
      let hubGap=0,handleAngle=p?.rotation.z??0;
      if(p){const hub=new THREE.Vector3(...spec.handleHub);scene.getObjectByName('TurningHandleHung').localToWorld(hub);const axis=new THREE.Vector3(...tr.contract.manualRescue.shaftCenter);tr.worm.parent.localToWorld(axis);hubGap=hub.distanceTo(axis);}
      const stroke=carDoorR.position.x-q.d.cx;
      const reach=ManualRescueDemo.actors?.flatMap(a=>[a.worker.rig.holdArm,a.worker.rig.waveArm].map(arm=>arm.userData.rescueReach||0));
      rescueSamples.push({t:performance.now(),stage:s.stage,manual:s.manual,stop:s.stopPressed,stopZ:scene.getObjectByName('EmergencyStopButton').position.z,walking:ManualRescueDemo.actors?.some(a=>a.walking),alarm:!document.getElementById('manual-rescue-alarm').hidden,levelLabel:!document.getElementById('manual-rescue-level').hidden,voice:!!activeAnnouncement&&!activeAnnouncement.paused,powerOff:s.powerOff,reach,car:carGrp.position.y,cwt:cwtGrp.position.y,estop,state:currentState,doorOpen,carStroke:stroke,hallStroke:h.right.position.x-h.right.userData.cx,release:q.release,key:h.keyRatio,brake:s.brakeReleased,mechanicalBrake:tr.brakeOpen,handle:s.handleAttached,handleAngle,worm:tr.worm.rotation.z,hubGap,level:s.level,call:s.call,ard:ARDDemo.active,passenger:UCMDemo.character.visible,friend:!!ManualRescueDemo.friend?.root.visible});
    };gsap.ticker.add(rescueProbe);
    const l=scene.getObjectByName('ReleaseLeverHung'),h=scene.getObjectByName('TurningHandleHung');
    const p=l.getWorldPosition(new THREE.Vector3()).add(h.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);p.y-=.2;
    camera.position.copy(p).add(new THREE.Vector3(1.35,.25,.30));controls.target.copy(p);controls.enableDamping=false;controls.update();
  });
  await page.waitForFunction(()=>!document.getElementById('manual-rescue-action').hidden);
  await page.screenshot({path:path.join(out,`${mobile?width:'pc'}-tools.png`)});
  const pick=await page.evaluate(()=>{const h=scene.getObjectByName('TurningHandleHung'),s=h.userData.manualRescue,p=new THREE.Vector3(0,(s.handleHub[1]+s.handleGrip[1])/2,0);h.localToWorld(p);p.project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  if(mobile)await page.touchscreen.tap(pick.x,pick.y);else await page.mouse.click(pick.x,pick.y);
  // 2026-10-03부터 부품 항목이 하나면 탭 즉시 실행된다(메뉴 없음). 메뉴가 뜬 경우에만 항목을 누른다.
  await page.waitForTimeout(400);
  if(!await page.evaluate(()=>ManualRescueDemo.active))await page.getByRole('button',{name:'수동 구출 시연',exact:true}).click();
  for(const stage of ['trapped','control-manual','control-stop','power-off','handle-mount','handle-seated','lever-mount','brake-release','winding','level-approach','level','intercom','key-turn','opening','exit','done']){
    await page.waitForFunction(stage=>ManualRescueDemo.state.stage===stage,stage);
    if(stage==='control-manual')await page.waitForFunction(()=>ManualRescueDemo.state.manual);
    if(stage==='control-stop')await page.waitForFunction(()=>ManualRescueDemo.state.stopPressed);
    if(stage==='power-off')await page.waitForFunction(()=>ManualRescueDemo.state.powerOff);
    if(stage==='trapped'){
      await page.screenshot({path:path.join(out,`${mobile?width:'pc'}-blackout.png`)});
      await page.waitForFunction(()=>!document.getElementById('manual-rescue-level').hidden);
    }
    await page.waitForTimeout((stage==='intercom'?1200:stage==='winding'?1000:stage==='opening'?1000:['control-manual','control-stop','power-off','handle-mount','lever-mount'].includes(stage)?80:200)/speed);
    await page.screenshot({path:path.join(out,`${mobile?width:'pc'}-${stage}.png`)});
    if(stage==='winding'){
      const crew=await page.evaluate(()=>{
        const actors=ManualRescueDemo.actors;
        const directions=actors.map(a=>new THREE.Vector3(0,0,1).applyQuaternion(a.worker.root.quaternion));
        const tr=mrGrp.userData.traction,c=tr.contract,spec=scene.getObjectByName('TurningHandleHung').userData.manualRescue;
        const forkGaps=['ManualReleaseLeverOther','ReleaseLeverHung'].map((name,i)=>{
          const tip=scene.getObjectByName(name).localToWorld(new THREE.Vector3(...spec.leverSeat));
          const pin=new THREE.Vector3(...c.manualRescue.releaseLugs[i]).sub(new THREE.Vector3(c.wheelX+(i===0?-1:1)*c.brakeArmX,c.brakePivotY,c.drumZ));
          return tip.distanceTo(tr.arms[i].localToWorld(pin));
        });
        return {scales:actors.map(a=>a.worker.root.scale.x),facing:directions[0].dot(directions[1]),forkGaps};
      });
      console.log('CREW',crew);
      assert.ok(crew.scales.every(s=>Math.abs(s-1.6)<1e-9),'Both workers 1.6x (2026-10-05: short arms must reach the 0.354 m crank)');
      assert.ok(crew.facing<-.99,'Brake operator faces the coil from opposite side to handle operator');
      assert.ok(crew.forkGaps.every(d=>d<1e-5),'Both lever forks stay seated on coil-side pins (10 micrometre transform tolerance)');
      const visible=await page.evaluate(()=>{
        scene.updateMatrixWorld(true);
        const h=scene.getObjectByName('TurningHandleHung'),spec=h.userData.manualRescue,p=new THREE.Vector3(...spec.handleHub);h.localToWorld(p);p.project(camera);
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);
        const hits=ray.intersectObjects(scene.children,true).filter(i=>{for(let o=i.object;o;o=o.parent)if(!o.visible)return false;return !i.object.material?.transparent;});
        let shaft=false;for(let o=hits[0]?.object;o;o=o.parent)if(o===h||o===mrGrp.userData.traction.worm)shaft=true;
        const axis=new THREE.Vector3(1,0,0).transformDirection(h.matrixWorld);
        return {shaft,first:hits[0]?.object.name,axis:axis.toArray(),p:p.toArray()};
      });console.log('HANDLE VIEW',visible);assert.equal(visible.shaft,true,'Encoder shaft and mounted handle stay in view without worker/wall occlusion');assert.ok(Math.abs(visible.axis[2]-1)<1e-6);
    }
    console.log('STAGE',stage,await page.evaluate(()=>({camera:camera.position.toArray(),bear:Mascot.root.position.toArray(),friend:ManualRescueDemo.friend.root.position.toArray(),gap:document.getElementById('manual-rescue-gap').textContent})));
  }
  const samples=await page.evaluate(()=>rescueSamples);fs.writeFileSync(path.join(out,`${mobile?width:'pc'}-samples.json`),JSON.stringify(samples));
  const ride=samples.filter(s=>s.stage==='riding');assert.ok(ride.at(-1).car-ride[0].car>.7,'Visible travel precedes sudden fault');
  const target=await page.evaluate(()=>ManualRescueDemo.state.targetY);
  assert.ok(samples.filter(s=>s.stage==='trapped').every(s=>Math.abs(target-s.car-.60)<1e-6),'Fault stops 60cm below landing');
  assert.ok(samples.some(s=>s.stage==='trapped'&&s.alarm&&s.voice),'Impact has blackout warning and spoken power failure');
  assert.ok(samples.some(s=>s.stage==='trapped'&&!s.alarm&&s.levelLabel),'Bright view reveals level difference after blackout');
  assert.ok(samples.every(s=>!s.walking),'Crew transfers use cuts rather than walking');
  const press=samples.filter(s=>s.stage==='control-stop');assert.ok(press.at(-1).stopZ<press[0].stopZ-.004,'Red STOP visibly depresses');
  assert.ok(samples.filter(s=>s.stage==='trapped').every(s=>s.carStroke===0&&s.hallStroke===0&&!s.level&&s.estop&&!s.ard));
  assert.ok(samples.every(s=>!s.ard&&s.estop),'System remains faulted; no ARD/autonomous drive');
  const movement=samples.filter(s=>['winding','level-approach'].includes(s.stage));
  assert.ok(movement.every(s=>s.brake&&s.handle&&s.mechanicalBrake),'Brake open before rotation');
  assert.ok(movement.every(s=>s.manual&&s.stop&&s.powerOff),'Manual mode, STOP and power isolation precede winding');
  console.log('TOOL REACH',Math.max(...movement.flatMap(s=>s.reach)));
  const byStage={};for(const x of samples)for(const d of x.reach||[])byStage[x.stage]=Math.max(byStage[x.stage]||0,d);console.log('REACH BY STAGE',JSON.stringify(byStage));
  assert.ok(samples.every(s=>(s.reach||[]).every(d=>d<.001)),'Hands stay on carried and mounted tools without stretching arm segments');
  assert.ok(samples.filter(s=>!s.brake&&!s.level&&s.handle).every(s=>Math.abs(s.handleAngle)<1e-8));
  assert.ok(movement.every(s=>s.hubGap<1e-6),'Handle hub stays on encoder shaft');
  const first=movement[0];assert.ok(movement.every(s=>Math.abs(s.car+s.cwt-first.car-first.cwt)<1e-6));
  assert.ok(movement.at(-1).car-first.car>.57);
  assert.ok((movement.at(-1).t-first.t)*speed>6500,'Winding is visible for seven seconds');
  assert.ok(movement.every(s=>Math.abs((s.handleAngle-first.handleAngle)-(s.worm-first.worm))<1e-6),'Handle turns about same world Z axis/angle as worm');
  const opening=samples.filter(s=>s.stage==='opening');assert.ok(opening.some(s=>s.carStroke>.2));assert.ok(opening.every(s=>s.level&&!s.brake&&Math.abs(s.carStroke-s.hallStroke)<1e-6),'Manual landing door couples car door at level');
  assert.ok(samples.filter(s=>['key-turn','opening','exit','done'].includes(s.stage)).every(s=>s.call&&s.friend));
  await page.evaluate(()=>{moveElevator(3);openDoors();closeDoors();});assert.equal(await page.evaluate(()=>ManualRescueDemo.state.stage),'done');
  if(mobile)await page.tap('#manual-rescue-exit');else await page.click('#manual-rescue-exit');
  console.log('EXIT CLICKED');
  await page.waitForFunction(()=>!ManualRescueDemo.active&&!moving&&CarDoor.secured());
  const restored=await page.evaluate(()=>({car:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,bear:Mascot.root.position.toArray(),bearScale:Mascot.root.scale.toArray(),passenger:UCMDemo.character.visible,camera:camera.position.toArray(),target:controls.target.toArray(),estop,doorOpen,friend:ManualRescueDemo.friend.root.visible,phone:scene.getObjectByName('IntercomHandset').parent.name}));
  const before=await page.evaluate(()=>rescueBefore);for(const k of ['car','cwt','floor','bear','bearScale','passenger'])assert.deepEqual(restored[k],before[k]);assert.equal(restored.estop,false);assert.equal(restored.friend,false);
  console.log('RESTORED');
  // Cancellation exercises each owned tween/tool/door stage. No leftover callbacks may restart it.
  const restoredControls=await page.evaluate(()=>({controlOpen:ControlPanel.open,powerOpen:MachineRoomPower.open,selector:scene.getObjectByName('ManualModeSelector').quaternion.toArray(),breaker:scene.getObjectByName('MainBreakerToggle').quaternion.toArray()}));
  for(const k of Object.keys(restoredControls))assert.deepEqual(restoredControls[k],before[k]);
  assert.equal(await page.evaluate(()=>document.getElementById('manual-rescue-alarm').hidden&&document.getElementById('manual-rescue-level').hidden&&!activeAnnouncement),true,'Fault overlays and announcement reset');
  assert.ok(Math.abs(await page.evaluate(()=>scene.getObjectByName('EmergencyStopButton').position.z)-samples[0].stopZ)<1e-8,'Front STOP returns to its saved position');
  // Full sequence above uses real time; cancellation checks only need stage transitions.
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(8);});
  for(const phase of process.argv.includes('--quick')?[]:['trapped','control-manual','control-stop','power-off','handle-mount','lever-mount','brake-release','winding','phone-approach','intercom','key-turn','opening']){
    assert.equal(await page.evaluate(()=>ManualRescueDemo.start()),true);
    await page.waitForFunction(phase=>ManualRescueDemo.state.stage===phase,phase);
    await page.evaluate(()=>ManualRescueDemo.reset());await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>!ManualRescueDemo.active&&!estop&&!moving&&CarDoor.secured()&&!ManualRescueDemo.friend.root.visible),true);
    assert.equal(await page.evaluate(()=>ManualRescueDemo.actors.every(a=>a.worker.rig.feet.every(f=>f.position.y===0&&f.position.z===0))&&!scene.children.some(o=>o.name.endsWith('Step')&&o.visible)),true,'Walking feet and work platforms reset');
  }
  await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>ManualRescueDemo.state.stage),'idle');
  await page.evaluate(()=>{gsap.globalTimeline.timeScale(1);});
  if(!process.argv.includes('--quick')){
    await page.evaluate(()=>openDoors());await page.waitForFunction(()=>doorOpen&&!CarDoor.state.busy);
    assert.equal(await page.evaluate(()=>ManualRescueDemo.start()),true);await page.waitForFunction(()=>ManualRescueDemo.state.stage==='trapped');
    await page.evaluate(()=>ManualRescueDemo.reset());await page.waitForFunction(()=>doorOpen&&!CarDoor.state.busy);
    await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>CarDoor.secured());
  }
  assert.equal(await page.evaluate(()=>ManualRescueDemo.start()),true);
  await page.evaluate(()=>resetInspections());await page.waitForFunction(()=>!inspectionResetting&&!ManualRescueDemo.active&&!moving&&CarDoor.secured());
  assert.equal(await page.evaluate(()=>!estop&&!Mascot.inspecting&&!ManualRescueDemo.friend.root.visible),true);
  assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify({mobile,width,samples:samples.length,restored,errors}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
