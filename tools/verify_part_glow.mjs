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
      const k=Math.max(1,.9/camera.aspect);camera.position.copy(p).sub(t).multiplyScalar(k).add(t);controls.target.copy(t);controls.update();};});  // 세로 화면은 moveCam 처럼 같은 방향으로 물러난다
  const tap=async(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  const clickSel=async s=>mobile?page.tap(s):page.click(s);
  const frames=n=>page.evaluate(n=>new Promise(r=>{let i=0;const f=()=>++i>=n?r():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
  // 부품 화면 중심(가시 메시 경계상자) — 발광 대상이 활성이어야 한다.
  const center=name=>page.evaluate(n=>{const p=PartGlow.parts.find(x=>x.name===n&&x.active);if(!p)return null;const b=new THREE.Box3();p.meshes.forEach(m=>{let v=true;for(let o=m;o;o=o.parent)if(!o.visible)v=false;if(v)b.expandByObject(m);});
    const c=b.getCenter(new THREE.Vector3()).project(camera);return {x:(c.x+1)*innerWidth/2,y:(1-c.y)*innerHeight/2};},name);
  const menuText=()=>page.evaluate(()=>document.getElementById('part-menu').hidden?null:document.getElementById('part-menu').textContent);
  const machineRoom=()=>page.evaluate(()=>{const p=govHandles().wheel.getWorldPosition(new THREE.Vector3());__cam(p.clone().add(new THREE.Vector3(4,2.5,4)),p.clone().add(new THREE.Vector3(0,-.5,0)));});

  // 1) 떠 있는 원형 아이콘은 화면에 없다.
  await machineRoom();
  await page.waitForFunction(ns=>ns.every(n=>PartGlow.parts.some(p=>p.name===n&&p.active&&p.root.visible)),(mobile?['조속기','로프브레이크']:['조속기','제어반','로프브레이크','권상기 주브레이크']),{timeout:45000}).catch(()=>{});
  const floating=await page.evaluate(()=>[...document.querySelectorAll('#part-actions > .part-action,#pit-ladder-action')].filter(b=>!b.hidden&&getComputedStyle(b).visibility!=='hidden').map(b=>b.id));
  assert.deepEqual(floating,[],'떠 있는 아이콘이 보인다');
  // 2) 기계실 부품이 빛난다.
  const lit=await page.evaluate(()=>PartGlow.parts.filter(p=>p.active&&p.root.visible).map(p=>p.name));
  for(const n of mobile?['조속기','로프브레이크']:['조속기','제어반','로프브레이크','권상기 주브레이크'])assert.ok(lit.includes(n),`${n} 발광 없음: ${lit} / 오류: ${errors.slice(0,3).join(" | ")}`);
  await page.screenshot({path:`${out}/${tag}-machine-room.png`});

  // 3) 제어반 탭 → 메뉴 → 문 열기(기존 ControlPanel.toggle 경로).
  // 제어반 정면(로컬 +Z 가 문) 시점.
  await page.evaluate(()=>{const r=ControlPanel.root;__cam(r.localToWorld(new THREE.Vector3(.3,1.1,2.2)),r.localToWorld(new THREE.Vector3(0,.7,0)));});
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='제어반'&&p.active&&p.root.visible),{},{timeout:45000});
  let c=await center('제어반');assert.ok(c,'제어반 중심');
  await tap(c.x,c.y);await frames(4);
  assert.match(await menuText()||'',/제어반 문 열기/);
  await page.screenshot({path:`${out}/${tag}-control-menu.png`});
  await clickSel('#part-menu .part-menu-item');
  await page.waitForFunction(()=>ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});
  assert.equal(await menuText(),null,'항목 실행 후 메뉴가 닫혀야 한다');
  // 제어반 안의 점검운전 스위치(부품 속 부품)는 바깥 제어반보다 우선 선택된다.
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='제어반 점검운전 스위치'&&p.active),{},{timeout:45000});
  const sw=await center('제어반 점검운전 스위치');
  assert.equal(await page.evaluate(([x,y])=>PartGlow.pickAt(x,y)?.name,[sw.x,sw.y]),'제어반 점검운전 스위치');
  await frames(6);c=await center('제어반');await tap(c.x,c.y);await frames(4);
  assert.match(await menuText()||'',/제어반 문 닫기/);
  await clickSel('#part-menu .part-menu-item');
  await page.waitForFunction(()=>!ControlPanel.open&&!ControlPanel.busy,{},{timeout:10000});

  // 4) 로프브레이크: 두 행동(개문발차·상승과속)이 한 메뉴로 묶인다 → 개문발차 설정 패널.
  await page.evaluate(()=>{const b=new THREE.Box3().setFromObject(scene.getObjectByName('RopeBrake'));const p=b.getCenter(new THREE.Vector3());__cam(p.clone().add(new THREE.Vector3(2,1.2,2)),p);});
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='로프브레이크'&&p.active),{},{timeout:45000});c=await center('로프브레이크');await tap(c.x,c.y);await frames(4);
  const rb=await menuText();assert.match(rb||'',/개문발차/);assert.match(rb||'',/상승과속/);
  await page.locator('#part-menu .part-menu-item',{hasText:'개문발차'})[mobile?'tap':'click']();
  await page.waitForFunction(()=>!document.getElementById('rope-brake-panel').hidden);
  await page.screenshot({path:`${out}/${tag}-rope-brake-panel.png`});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('rope-brake-panel').hidden);

  // 5) 데스크톱 호버: 툴팁·포인터 커서·강조.
  if(!mobile){
   c=await center('조속기');await page.mouse.move(c.x,c.y);await frames(12);
   const h=await page.evaluate(()=>({tip:document.getElementById('part-tip').hidden?null:document.getElementById('part-tip').textContent,cursor:renderer.domElement.style.cursor}));
   assert.match(h.tip||'',/조속기/);assert.equal(h.cursor,'pointer');
   await page.screenshot({path:`${out}/${tag}-governor-hover.png`});
   await page.mouse.move(4,400);await frames(4);
  }

  // 6) 승장 비상키: 자체 패널(aria-controls)은 메뉴 없이 바로 연다.
  await page.evaluate(()=>{const y=FLOOR_Y[1];__cam(new THREE.Vector3(.4,y+1.8,FRONT_WALL_INNER_Z+2.2),new THREE.Vector3(0,y+1.6,FRONT_WALL_INNER_Z));});
  await page.waitForFunction(()=>PartGlow.parts.some(p=>p.name==='2층 승장문 비상키'&&p.active),{},{timeout:45000}).catch(()=>{});c=await center('2층 승장문 비상키');assert.ok(c,'2층 비상키 발광 없음');
  await tap(c.x,c.y);await page.waitForFunction(()=>!document.getElementById('hall-panel').hidden,{},{timeout:5000});
  assert.equal(await menuText(),null);
  await page.screenshot({path:`${out}/${tag}-hall-key.png`});
  await page.evaluate(()=>closeAllMenus());

  // 7) 설정 「부품 빛 효과」 끄기 → 빛 없음, 탭 메뉴는 유지 → 새로고침 후에도 유지 → 다시 켜기.
  await machineRoom();await frames(10);
  await clickSel('[data-menu="dd-view"]');await clickSel('#part-glow-toggle');
  assert.equal(await page.evaluate(()=>PartGlow.enabled),false);
  assert.equal(await page.locator('#part-glow-toggle').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>closeAllMenus());await page.waitForFunction(()=>PartGlow.parts.every(p=>!p.root.visible),{},{timeout:30000}).catch(()=>{});
  assert.deepEqual(await page.evaluate(()=>PartGlow.parts.filter(p=>p.root.visible).map(p=>p.name)),[],'끄기 후에도 빛난다');
  await page.screenshot({path:`${out}/${tag}-glow-off.png`});
  c=await center('조속기');await tap(c.x,c.y);await frames(4);
  assert.match(await menuText()||'',/조속기/,'빛을 꺼도 탭 메뉴는 열려야 한다');
  await page.evaluate(()=>PartGlow.closeMenu());
  await page.reload({waitUntil:'networkidle'});await ready();
  assert.equal(await page.evaluate(()=>PartGlow.enabled),false,'새로고침 후 설정 유지');
  await page.evaluate(()=>PartGlow.setEnabled(true));
  await context.close();
 }
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log('verify_part_glow OK');
