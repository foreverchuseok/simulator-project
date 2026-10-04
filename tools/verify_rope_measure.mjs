import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='temporary/rope-measure'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const results={};
try {
  for(const mobile of [false,true]) {
    const name=mobile?'mobile':'pc', context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:850},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&!/404|favicon/.test(m.text())) errors.push(m.text());});
    page.setDefaultTimeout(60000); await page.routeWebSocket('**',s=>s.close());
    const cdp=await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await page.goto(process.env.URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>CarDoor.state?.ready&&ropeObjs.length===5&&carGrp.getObjectByName('carRopeHitch'));
    await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
    await page.evaluate(()=>{camera.position.set(.8,wireRopeShape.carTopY+.8,wireRopeShape.carTopZ+1.2);controls.target.set(0,wireRopeShape.carTopY,wireRopeShape.carTopZ);controls.update();});
    await page.waitForFunction(()=>document.getElementById('rope-measure-roof').hidden);
    assert.equal(await page.locator('#rope-measure-machine').count(),0);
    await page.evaluate(()=>{const y=carGrp.position.y+S.CAR_H/2; camera.position.set(.8,y+1.05,CAR_CTR_Z+.9);controls.target.set(0,y+.95,CAR_CTR_Z);controls.update();});
    await page.waitForFunction(()=>!document.getElementById('rope-measure-roof').hidden);
    // 발광 범위 = 바빗 소켓에서 로프를 따라 1m. 로프가 약간 기울어 있으므로 아래 끝을 3D 점으로 비교한다.
    const glow=await page.evaluate(()=>PartGlow.parts.find(p=>p.name==='카 상부 주로프').objects.map((m,i)=>{m.updateMatrixWorld(true);const r=ropeObjs[i],end=new THREE.Vector3(0,-.5,0).applyMatrix4(m.matrixWorld);
      return {length:m.scale.y,socketError:end.distanceTo(new THREE.Vector3(r.hx,carGrp.position.y+S.CAR_H/2+CAR_ROPE_END_DY,CAR_CTR_Z+r.hz)),parent:m.parent?.name||null};}));
    assert.equal(glow.length,5);for(const g of glow){assert.ok(Math.abs(g.length-1)<1e-8);assert.ok(g.socketError<1e-6,`소켓 끝 오차 ${g.socketError}`);assert.equal(g.parent,null);}
    const saved=await page.evaluate(()=>({car:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,eye:camera.position.toArray(),target:controls.target.toArray(),near:camera.near,fov:camera.fov,mascotVisible:Mascot.root.visible}));
    // 실제 주로프 클릭으로 시작해 부품 히트 판정도 확인한다.
    const hit=await page.evaluate(()=>{const v=new THREE.Vector3(0,carGrp.position.y+S.CAR_H/2+.95,CAR_CTR_Z).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
    await page.screenshot({path:`${out}/${name}-entry.png`});
    if(mobile) await page.touchscreen.tap(hit.x,hit.y); else await page.mouse.click(hit.x,hit.y);
    await page.waitForFunction(()=>RopeMeasure.active,null,{timeout:5000});
    await page.screenshot({path:`${out}/${name}-ready.png`});
    await page.evaluate(()=>{
      // 후면 난간 상단 바·중간 바·발끝막이판(elevator.js 난간 치수) 부피에 승곰이·캘리퍼스 꼭짓점이 들어가면 간섭.
      window.ropeWorkerCheck={maxReach:0,maxRoofError:0,frames:0,railHits:0,railHit:null,maxArm:0};
      const p=new THREE.Vector3(),vis=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
      const tick=()=>{if(!RopeMeasure.active)return;const b=scene.getObjectByName('RopeMeasureSeunggom'),cal=scene.getObjectByName('RopeCaliper'),r=window.ropeWorkerCheck;r.frames++;
        const roof=carGrp.position.y+S.CAR_H/2,z0=CAR_CTR_Z-S.CAR_D/2+.18,bars=[[roof+.90,.019,.019,'top'],[roof+.48,.016,.016,'mid'],[roof+.05,.05,.007,'toe']];
        r.maxRoofError=Math.max(r.maxRoofError,Math.abs(b.position.y-roof));
        b.traverse(o=>{if(o.userData.rescueReach!==undefined)r.maxReach=Math.max(r.maxReach,o.userData.rescueReach);});
        if(r.frames%3===0)for(const g of [b,cal])g.traverse(o=>{if(!o.isMesh||!vis(o))return;const a=o.geometry.attributes.position;o.updateMatrixWorld();
          for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(Math.abs(p.x)>1.05)continue;
            for(const [y,hy,hz,n] of bars)if(Math.abs(p.y-y)<hy&&Math.abs(p.z-z0)<hz){r.railHits++;r.railHit=r.railHit||{stage:RopeMeasure.state.stage,bar:n,mesh:o.name||o.parent?.name,y:+(p.y-roof).toFixed(3),z:+(p.z-z0).toFixed(3)};}}});
        requestAnimationFrame(tick);};tick();
    });
    await page.waitForFunction(()=>RopeMeasure.state.stage==='lobby');
    const lobbyMark=await page.evaluate(()=>{const actual=RopeMeasure.markedPoint(3,new THREE.Vector3());const expected=wireRopeShape.path.getPoint(.12);expected.x+=ropeObjs[3].rx;return actual.distanceTo(expected);});
    assert.ok(lobbyMark<1e-8,'시브 표시점은 실제 로프 경로 위에 있어야 한다.');
    await page.screenshot({path:`${out}/${name}-lobby.png`});
    await page.waitForFunction(()=>RopeMeasure.state.stage==='transfer');
    await page.click('#demo-pause');
    const held=await page.evaluate(()=>carGrp.position.y); await page.waitForTimeout(300); assert.equal(await page.evaluate(()=>carGrp.position.y),held);
    await page.click('#demo-pause');
    // 순서: 영점 → ① 마모부(균형추측) → 뒤로 돌아 → ② 비마모부(카측 소켓 위) → 결과.
    for(const stage of ['zero','worn','turn','unworn','result']) {
      await page.waitForFunction(s=>RopeMeasure.state.stage===s,stage);
      if(stage==='zero') await page.waitForFunction(()=>RopeMeasure.state.zeroed);
      else if(stage==='worn') await page.waitForFunction(()=>RopeMeasure.state.readings.length===1);
      else if(stage==='unworn') await page.waitForFunction(()=>RopeMeasure.state.reference!==null);
      else if(stage==='turn') await page.waitForTimeout(1600);
      await page.screenshot({path:`${out}/${name}-${stage}.png`});
      if(stage==='worn'||stage==='unworn'){
        // 캘리퍼스 측정면 사이에 그 로프(4번) 측정 지점이 있고, 측정 중인 하강부만 표본으로 바뀌었다.
        const at=await page.evaluate(s=>{const c=scene.getObjectByName('RopeCaliper'),j=scene.getObjectByName('RopeCaliperMovingJaw'),r=ropeObjs[3];
          const mid=new THREE.Vector3(j.position.x/2,.02,0).applyMatrix4(c.matrixWorld),sample=scene.getObjectByName('RopeInspectionSegment');
          const drop=s==='worn'?r.cwtDrop:r.carDrop,line=s==='worn'?[new THREE.Vector3(r.rx,wireRopeShape.cwtTopY,wireRopeShape.cwtTopZ),new THREE.Vector3(r.hx,cwtGrp.position.y+S.CWT_H/2+CWT_ROPE_END_DY,cwtGrp.position.z+r.hz)]:[new THREE.Vector3(r.rx,wireRopeShape.carTopY,wireRopeShape.carTopZ),new THREE.Vector3(r.hx,carGrp.position.y+S.CAR_H/2+CAR_ROPE_END_DY,CAR_CTR_Z+r.hz)];
          const onLine=new THREE.Line3(...line).closestPointToPoint(mid,true,new THREE.Vector3()).distanceTo(mid);
          return {onLine,jaw:j.position.x*1000,dropHidden:!drop.visible,sample:sample.visible,heightAboveRoof:mid.y-carGrp.position.y-S.CAR_H/2};},stage);
        assert.ok(at.onLine<.002,`${stage}: 측정면 중심–로프 거리 ${at.onLine}`);assert.equal(at.dropHidden,true);assert.equal(at.sample,true);
        assert.ok(Math.abs(at.jaw-(stage==='worn'?11.18:12.25))<.01,`${stage} 측정값 ${at.jaw}`);
        results[name+'_'+stage]=at;
      }
    }
    const story=await page.evaluate(()=>({state:JSON.parse(JSON.stringify(RopeMeasure.state)),worker:window.ropeWorkerCheck,workerVisible:scene.getObjectByName('RopeMeasureSeunggom').visible,car:carGrp.position.y,cwt:cwtGrp.position.y,mark:RopeMeasure.markedPoint(3,new THREE.Vector3()).toArray(),roof:carGrp.position.y+S.CAR_H/2,drop:ropeObjs[3].cwtDrop.visible&&ropeObjs[3].carDrop.visible,door:CarDoor.secured(),panel:document.getElementById('rope-measure-panel').getBoundingClientRect().toJSON()}));
    assert.equal(story.workerVisible,true);assert.ok(story.worker.frames>100);assert.ok(story.worker.maxReach<.005,`손과 캘리퍼스 간극 ${story.worker.maxReach}`);assert.equal(story.worker.railHits,0,'후면 난간 간섭 '+JSON.stringify(story.worker.railHit));assert.ok(story.worker.maxRoofError<1e-8);
    assert.equal(story.state.completed,true); assert.deepEqual(story.state.readings,[11.18]);assert.equal(story.state.reference,12.25);
    assert.ok(Math.abs(story.state.ratio-11.18/12.25*100)<1e-7&&story.state.ratio>=90,'마모부 90% 이상 적합'); assert.ok(Math.abs(story.mark[1]-story.roof-.22)<1e-6);
    assert.ok(Math.abs(story.car+story.cwt-saved.car-saved.cwt)<1e-7);assert.equal(story.drop,true);assert.equal(story.door,true);
    assert.ok(story.panel.x>=0&&story.panel.right<=(mobile?390:1280));
    await page.click('#rope-measure-return');
    async function checkRestored(){const now=await page.evaluate(()=>({car:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,eye:camera.position.toArray(),target:controls.target.toArray(),near:camera.near,fov:camera.fov,mascotVisible:Mascot.root.visible}));assert.deepEqual(now,saved);assert.equal(await page.evaluate(()=>RopeMeasure.active||scene.getObjectByName('RopeMeasureSeunggom').visible),false);}
    await checkRestored();
    // 반복·이동 중 STOP·확대 중 Escape에서 위치·로프 표시·시점 복귀.
    await page.evaluate(()=>RopeMeasure.start());await page.waitForFunction(()=>RopeMeasure.state.stage==='transfer');await page.click('#btn-estop');await checkRestored();
    await page.evaluate(()=>RopeMeasure.start());await page.waitForFunction(()=>RopeMeasure.state.stage==='unworn');await page.keyboard.press('Escape');await checkRestored();
    assert.equal(await page.evaluate(()=>ropeObjs[3].cwtDrop.visible&&ropeObjs[3].carDrop.visible),true);
    assert.deepEqual(errors,[]);results[name]={story,errors};await context.close();
  }
  fs.writeFileSync(`${out}/verification.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
