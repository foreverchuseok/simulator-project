// 기능 부품 발광·탭 메뉴(js/part-glow.js) 검증: 떠 있는 아이콘 숨김, 발광 활성, 호버 툴팁, 탭 메뉴 → 기존 행동 실행,
// 자체 패널 직행(승장 비상키), 설정 「부품 빛 효과」 끄기/새로고침 유지/호버 강조, 콘솔 오류 0.
// 사용: node tools/verify_part_glow.mjs [--desktop-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='.shot-part-glow';fs.mkdirSync(out,{recursive:true});
const URL=process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html';
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});const errors=[];
const modes=process.argv.includes('--desktop-only')?[false]:[false,true];
try{
 for(const mobile of modes){
  const tag=mobile?'390':'1280';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:850},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(`[${tag}] ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`[${tag}] ${m.text()}`);});
  const ready=()=>page.waitForFunction(()=>govHandles()?.ready&&scene.getObjectByName('RopeBrakeInstallation')?.userData.ready&&ControlPanel.ready&&PitLadder.secured&&document.getElementById('loading').classList.contains('hide'),{},{timeout:120000});
  await page.goto(URL,{waitUntil:'networkidle'});await ready();
  await page.evaluate(()=>{try{localStorage.removeItem('partGlowEnabled');}catch(e){}PartGlow.setEnabled(true);controls.enableDamping=false;
    window.__cam=(p,t)=>{gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);if(typeof leaveCabinView==='function')leaveCabinView();
      const k=Math.max(1,.9/camera.aspect);camera.position.copy(p).sub(t).multiplyScalar(k).add(t);controls.target.copy(t);controls.update();
      camera.updateMatrixWorld();};});  // 세로 화면은 moveCam 처럼 같은 방향으로 물러난다. 다음 렌더 전에 화면 중심을 재도 새 시점 기준이 되게 행렬을 바로 갱신한다.
  const tap=async(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  const clickSel=async s=>mobile?page.tap(s):page.click(s);
  const frames=n=>page.evaluate(n=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
  // 부품 화면 중심(가시 메시 경계상자) — 발광 대상이 활성이어야 한다.
  const center=name=>page.evaluate(n=>{const p=PartGlow.parts.find(x=>x.name===n&&x.active);if(!p)return null;const b=new THREE.Box3();p.meshes.forEach(m=>{let v=true;for(let o=m;o;o=o.parent)if(!o.visible)v=false;if(v)b.expandByObject(m);});
    const c=b.getCenter(new THREE.Vector3()).project(camera);return {x:(c.x+1)*innerWidth/2,y:(1-c.y)*innerHeight/2};},name);
  const menuText=()=>page.evaluate(()=>document.getElementById('part-menu').hidden?null:document.getElementById('part-menu').textContent);
  const machineRoom=()=>page.evaluate(()=>{const p=govHandles().wheel.getWorldPosition(new THREE.Vector3());__cam(p.clone().add(new THREE.Vector3(4,2.5,4)),p.clone().add(new THREE.Vector3(0,-.5,0)));});

  // 0) 모바일 전체 보기: 대표 부품 금색 비콘(Tier 1 단일 Points) 1~8개 표시, Tier 2 스텐실 발광 0개.
  if(mobile){
   await frames(8);
   const ov=await page.evaluate(()=>({count:PartGlow.beaconCount,beacons:PartGlow.beacons,lit:PartGlow.parts.filter(p=>p.root.visible).map(p=>p.name)}));
   assert.ok(ov.count>=2&&ov.count<=8,`전체 보기 대표 비콘 수(2~8): ${ov.count} (${ov.beacons.map(b=>b.name)})`);
   assert.deepEqual(ov.lit,[],'전체 보기 Tier 2 발광 없음');
   await page.screenshot({path:`${out}/${tag}-overview-beacons.png`});
   // 비콘 위 직접 탭 → 소형 팝업 열림.
   const firstB=ov.beacons[0];
   await tap(firstB.x,firstB.y);await frames(8);
   assert.match(await menuText()||'',new RegExp(firstB.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'비콘 직접 탭으로 소형 팝업 열림');
   await page.evaluate(()=>PartGlow.closeMenu());
   await page.waitForFunction(()=>PartGlow.parts.every(p=>!p.root.visible),{},{timeout:5000});
  }

  // 1) 떠 있는 원형 아이콘은 화면에 없다.
  await machineRoom();
  await page.waitForFunction((isMob)=>isMob?PartGlow.parts.some(p=>p.name==='과속 조절기'&&p.active)&&PartGlow.beaconCount>0:['과속 조절기','제어반','로프브레이크','권상기 주브레이크'].every(n=>PartGlow.parts.some(p=>p.name===n&&p.active&&p.root.visible)),mobile,{timeout:45000}).catch(()=>{});
  const floating=await page.evaluate(()=>[...document.querySelectorAll('#part-actions > .part-action,#pit-ladder-action')].filter(b=>!b.hidden&&getComputedStyle(b).visibility!=='hidden').map(b=>b.id));
  assert.deepEqual(floating,[],'떠 있는 아이콘이 보인다');
  // 2) PC는 기계실 부품 상시 발광, 모바일은 Tier 1 금색 비콘(스텐실 0) + 선택 부품 1개만 Tier 2 강조.
  const lit=await page.evaluate(()=>PartGlow.parts.filter(p=>p.active&&p.root.visible).map(p=>p.name));
  if(mobile){
   assert.deepEqual(lit,[],'모바일 기본 화면은 Tier 2 대기 발광 없음');
   assert.ok(await page.evaluate(()=>PartGlow.beaconCount)>0,'모바일 기계실 금색 비콘 활성');
  }else{
   for(const n of ['과속 조절기','제어반','로프브레이크','권상기 주브레이크'])assert.ok(lit.includes(n),`${n} 발광 없음: ${lit} / 오류: ${errors.slice(0,3).join(" | ")}`);
  }
  await page.screenshot({path:`${out}/${tag}-machine-room.png`});

  // 3) 제어반 탭: PC는 바로 문 열기, 모바일은 소형 팝업 확인 후 문 열기(선택 부품 1개만 금색 강조).
  await page.evaluate(()=>{const r=ControlPanel.root;__cam(r.localToWorld(new THREE.Vector3(.3,1.1,2.2)),r.localToWorld(new THREE.Vector3(0,.7,0)));});
  await page.waitForFunction((isMob)=>PartGlow.parts.some(p=>p.name==='제어반'&&p.active&&(isMob||p.root.visible)),mobile,{timeout:45000});
  let c=await center('제어반');assert.ok(c,'제어반 중심');
  if(mobile){
   // 20px 드래그는 탭으로 처리하지 않는다(14px 초과 취소).
   const cd=await page.context().newCDPSession(page);
   await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x,y:c.y,id:1}]});
   await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+24,y:c.y,id:1}]});
   await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await frames(4);
   assert.equal(await menuText(),null,'14px 초과 드래그는 팝업을 열지 않는다');
   // 두 손가락 터치(핀치)는 탭 취소.
   await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x,y:c.y,id:1}]});
   await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x,y:c.y,id:1},{x:c.x+40,y:c.y+20,id:2}]});
   await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:c.x,y:c.y,id:1}]});
   await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await frames(4);
   assert.equal(await menuText(),null,'두 손가락 터치는 팝업을 열지 않는다');
   // 1탭 → 소형 팝업만 열리고 문은 즉시 열리지 않는다.
   await tap(c.x,c.y);await frames(10);
   assert.equal(await page.evaluate(()=>ControlPanel.open),false,'모바일 설비 조작은 1탭에 즉시 실행 금지');
   assert.match(await menuText()||'',/제어반/);
   const mobLit=await page.evaluate(()=>PartGlow.parts.filter(p=>p.root.visible).map(p=>p.name));
   assert.deepEqual(mobLit,['제어반'],'선택한 부품 1개만 강조');
   const box=await page.locator('#part-menu').boundingBox();
   assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=390.5&&box.y+box.height<=844.5,'모바일 팝업 화면 경계 유지');
   await page.screenshot({path:`${out}/${tag}-control-popup.png`});
   // 천천히(>700ms) 같은 자리 재탭 → 팝업만 닫힘.
   await page.waitForTimeout(780);await tap(c.x,c.y);await frames(4);
   assert.equal(await menuText(),null,'천천히 재탭하면 팝업만 닫힘');
   assert.equal(await page.evaluate(()=>ControlPanel.open),false);
   // 다시 1탭 → 확인 버튼 탭으로 제어반 문 열기.
   await tap(c.x,c.y);await frames(6);
   await page.locator('#part-menu .part-menu-item').first().tap();
   await page.waitForFunction(()=>ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});
   await page.screenshot({path:`${out}/${tag}-control-opened.png`});
   // 열린 제어반 안 점검운전 스위치가 제어반보다 우선 선택된다.
   await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='제어반 점검운전 스위치'&&p.active),{},{timeout:45000});
   const sw=await center('제어반 점검운전 스위치');
   assert.equal(await page.evaluate(([x,y])=>PartGlow.pickAt(x,y)?.name,[sw.x,sw.y]),'제어반 점검운전 스위치');
   // 제어반 문 닫기(2단계).
   await frames(6);c=await center('제어반');await tap(c.x,c.y);await frames(6);
   await page.locator('#part-menu .part-menu-item').first().tap();
   await page.waitForFunction(()=>!ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});
   // 벽 너머 부품은 occluded로 선택 차단(제어반 뒤 벽 바깥에서 제어반 중심을 찍어도 잡히지 않아야 함).
   const behindWall=await page.evaluate(()=>{const r=ControlPanel.root,p=r.localToWorld(new THREE.Vector3(0,.7,0));__cam(r.localToWorld(new THREE.Vector3(-1.4,1.1,-1.6)),p);return true;});
   assert.ok(behindWall);await frames(6);
   const occludedHit=await page.evaluate(()=>{const p=PartGlow.parts.find(x=>x.name==='제어반');if(!p)return null;const c=PartGlow.partCenter(p);if(!c)return null;c.project(camera);return PartGlow.pickAt((c.x+1)*innerWidth/2,(1-c.y)*innerHeight/2)?.name||null;});
   assert.notEqual(occludedHit,'제어반','벽 너머 부품은 선택되지 않아야 한다');
  }else{
   await tap(c.x,c.y);await frames(4);
   await page.waitForFunction(()=>ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});
   assert.equal(await menuText(),null,'선택지가 하나면 메뉴 없이 바로 실행');
   await page.screenshot({path:`${out}/${tag}-control-direct.png`});
   // 제어반 안의 점검운전 스위치(부품 속 부품)는 바깥 제어반보다 우선 선택된다.
   await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='제어반 점검운전 스위치'&&p.active),{},{timeout:45000});
   const sw=await center('제어반 점검운전 스위치');
   assert.equal(await page.evaluate(([x,y])=>PartGlow.pickAt(x,y)?.name,[sw.x,sw.y]),'제어반 점검운전 스위치');
   await frames(6);c=await center('제어반');await tap(c.x,c.y);await frames(4);
   await page.waitForFunction(()=>!ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});
   assert.equal(await menuText(),null);
  }

  // 4) 로프브레이크: PC는 두 행동 메뉴 → 설정 패널, 모바일은 팝업 안 탭·조건·재생으로 2단계 통일.
  await page.evaluate(()=>{const b=new THREE.Box3().setFromObject(scene.getObjectByName('RopeBrake'));const p=b.getCenter(new THREE.Vector3());__cam(p.clone().add(new THREE.Vector3(2,1.2,2)),p);});
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='로프브레이크'&&p.active),{},{timeout:45000});c=await center('로프브레이크');await tap(c.x,c.y);await frames(6);
  const rb=await menuText();assert.match(rb||'',/개문발차/);assert.match(rb||'',/상승과속/);
  if(mobile){
   assert.equal(await page.locator('#part-menu .pm-modes button').count(),2,'비교 조건 2개 표시');
   await page.locator('#part-menu [data-part-tab="up"]').tap();await frames(3);
   await page.locator('#part-menu [data-part-mode="none"]').tap();await frames(3);
   assert.equal(await page.evaluate(()=>DemoExit.active),false,'조건 선택만으로 시연 미시작');
   await page.screenshot({path:`${out}/${tag}-rope-brake-popup.png`});
   await page.locator('#part-menu .pm-play').tap();
   await page.waitForFunction(()=>AscentDemo.active&&AscentDemo.state.mode==='none',{},{timeout:15000});
   assert.equal(await page.locator('#ascent-panel').isVisible(),false,'별도 PC 설정창 없이 바로 시작');
   await page.locator('#demo-exit').tap();
   await page.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&CarDoor.secured(),{},{timeout:30000});
  }else{
   await page.locator('#part-menu .part-menu-item',{hasText:'개문발차'}).click();
   await page.waitForFunction(()=>!document.getElementById('rope-brake-panel').hidden);
   await page.screenshot({path:`${out}/${tag}-rope-brake-panel.png`});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('rope-brake-panel').hidden);
  }

  // 5) 데스크톱 호버: 툴팁·포인터 커서·강조.
  if(!mobile){
   c=await center('과속 조절기');await page.mouse.move(c.x,c.y);await frames(12);
   const h=await page.evaluate(()=>({tip:document.getElementById('part-tip').hidden?null:document.getElementById('part-tip').textContent,cursor:renderer.domElement.style.cursor}));
   assert.match(h.tip||'',/과속 조절기/);assert.equal(h.cursor,'pointer');
   await page.screenshot({path:`${out}/${tag}-governor-hover.png`});
   await page.mouse.move(4,400);await frames(4);
  }

  // 6) 승장 비상키: PC는 패널 직행, 모바일은 소형 팝업 확인 후 패널 열기 + 작은 부품 22px 여유 탭 확인.
  await page.evaluate(()=>{const y=FLOOR_Y[1];__cam(new THREE.Vector3(.4,y+1.8,FRONT_WALL_INNER_Z+2.2),new THREE.Vector3(0,y+1.6,FRONT_WALL_INNER_Z));});
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='2층 승장문 비상키'&&p.active),{},{timeout:45000}).catch(()=>{});c=await center('2층 승장문 비상키');assert.ok(c,'2층 비상키 활성 없음');
  if(mobile){
   // 부품 중심에서 18px 떨어진 지점도 22px 여유로 선택되어야 한다.
   assert.equal(await page.evaluate(([x,y])=>PartGlow.pickAt(x+18,y)?.name,[c.x,c.y]),'2층 승장문 비상키','모바일 소형 부품 22px 여유 탭');
   await tap(c.x+18,c.y);await frames(6);
   assert.equal(await page.evaluate(()=>document.getElementById('hall-panel').hidden),true,'모바일 1탭에 승장문 점검 패널 즉시 오픈 금지');
   assert.match(await menuText()||'',/2층 승장문 비상키/);
   await page.locator('#part-menu .part-menu-item').first().tap();
   await page.waitForFunction(()=>!document.getElementById('hall-panel').hidden,{},{timeout:5000});
   await page.screenshot({path:`${out}/${tag}-hall-key.png`});
   await page.evaluate(()=>closeAllMenus());
  }else{
   await tap(c.x,c.y);await page.waitForFunction(()=>!document.getElementById('hall-panel').hidden,{},{timeout:5000});
   assert.equal(await menuText(),null);
   await page.screenshot({path:`${out}/${tag}-hall-key.png`});
   await page.evaluate(()=>closeAllMenus());
  }

  // 7) 설정 「부품 빛 효과」 끄기 → 빛 없음, 탭 메뉴는 유지 → 새로고침 후에도 유지 → 다시 켜기.
  if(!mobile){
   await machineRoom();await frames(10);
   await clickSel('[data-menu="dd-view"]');await clickSel('#part-glow-toggle');
   assert.equal(await page.evaluate(()=>PartGlow.enabled),false);
   assert.equal(await page.locator('#part-glow-toggle').getAttribute('aria-pressed'),'false');
   await page.evaluate(()=>closeAllMenus());await page.waitForFunction(()=>PartGlow.parts.every(p=>!p.root.visible),{},{timeout:30000}).catch(()=>{});
   assert.deepEqual(await page.evaluate(()=>PartGlow.parts.filter(p=>p.root.visible).map(p=>p.name)),[],'끄기 후에도 빛난다');
   await page.screenshot({path:`${out}/${tag}-glow-off.png`});
   // 빛을 꺼도 탭은 그대로 동작한다(로프브레이크: 두 항목 메뉴).
   await page.evaluate(()=>{const b=new THREE.Box3().setFromObject(scene.getObjectByName('RopeBrake'));const p=b.getCenter(new THREE.Vector3());__cam(p.clone().add(new THREE.Vector3(2,1.2,2)),p);});await frames(10);
   c=await center('로프브레이크');await tap(c.x,c.y);await frames(4);
   assert.match(await menuText()||'',/개문발차/,'빛을 꺼도 탭 메뉴는 열려야 한다');
   await page.evaluate(()=>PartGlow.closeMenu());
   await page.reload({waitUntil:'networkidle'});await ready();
   assert.equal(await page.evaluate(()=>PartGlow.enabled),false,'새로고침 후 설정 유지');
   await page.evaluate(()=>PartGlow.setEnabled(true));
  }else{
   // 7-M) 모바일: 설정 「부품 빛 효과」 끄기 → Tier 1 비콘 0개, 탭 팝업은 유지 → 다시 켜기 + 설비 일괄 정리(SceneClean) 검증.
   await machineRoom();await frames(8);
   assert.ok(await page.evaluate(()=>PartGlow.beaconCount)>0,'비콘 켜짐');
   await page.evaluate(()=>PartGlow.setEnabled(false));await frames(4);
   assert.equal(await page.evaluate(()=>PartGlow.beaconCount),0,'부품 빛 효과 끄면 비콘 0개');
   await page.evaluate(()=>PartGlow.setEnabled(true));await frames(6);
   assert.ok(await page.evaluate(()=>PartGlow.beaconCount)>0,'다시 켜면 비콘 복원');
   // 설비 일괄 정리(SceneClean): 제어반·분전함 문 열기 + 기계실 조명 켜기 → 「설비 정리」 버튼 표시 → 1탭 원상복구(리로드 없음).
   await page.evaluate(()=>{window.__cleanToken='no-reload';ControlPanel.toggle();MachineRoomPower.toggle();BuildingLights.toggle('mr');});
   await page.waitForFunction(()=>ControlPanel.open&&MachineRoomPower.open&&BuildingLights.state.mr&&!document.getElementById('scene-clean-btn').hidden,{},{timeout:10000});
   await page.screenshot({path:`${out}/${tag}-scene-clean-btn.png`});
   await page.locator('#scene-clean-btn').tap();await frames(6);
   const cleaned=await page.evaluate(()=>({token:window.__cleanToken,cp:ControlPanel.open,db:MachineRoomPower.open,mrLight:BuildingLights.state.mr,dirty:SceneClean.dirty(),btnHidden:document.getElementById('scene-clean-btn').hidden,gap:camera.position.distanceTo(new THREE.Vector3(...overviewCameraPose().position))}));
   assert.equal(cleaned.token,'no-reload','페이지 리로드 없이 설비 정리');
   assert.equal(cleaned.cp,false);assert.equal(cleaned.db,false);assert.equal(cleaned.mrLight,false);
   assert.equal(cleaned.dirty,false);assert.equal(cleaned.btnHidden,true);assert.ok(cleaned.gap<0.05,'전체 보기 카메라 복귀');
  }
  await context.close();
 }
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log('verify_part_glow OK');
