// 카 완충기 충돌 시연 검증 (js/buffer-demo.js · car-underbody.js carBufferStrike)
// node tools/verify_buffer_demo.mjs  — Live Server http://127.0.0.1:5500 필요. 결과 .shot-buffer/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out = '.shot-buffer'; fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({args: ['--enable-gpu']});
const report = {};
const ready = () => govHandles()?.ready && CarDoor.state?.ready && cwtGrp.userData.model && scene.getObjectByName('carBufferStrike');
async function open(viewport, mobile = false) {
  const context = await browser.newContext({viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1});
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ReadPixels|GPU stall/.test(m.text())) errors.push(m.text()); });
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  await page.goto('http://127.0.0.1:5500/index.html', {waitUntil: 'networkidle'});
  await page.waitForFunction(ready);
  return {page, errors};
}
const pitView = page => page.evaluate(async () => {
  controls.enableDamping = false;
  camera.position.set(0.5, 0.38, CAR_CTR_Z - 0.8); controls.target.set(0, 0.63, CAR_CTR_Z); controls.update();
  for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
});
const fast = page => page.evaluate(() => { BufferDemo.timing.holdPit = 1.8; BufferDemo.timing.holdTop = 3; });
try {
  const {page, errors} = await open({width: 1280, height: 850});

  // ① 타격부 채움: 서브팬 밑 ~ 플랭크 하면, 두 보강채널 사이, 하중검출 부품과 비간섭, 완충기 헤드 ⊂ 타격판
  report.strike = await page.evaluate(() => {
    const fill = carGrp.getObjectByName('carBufferStrike'), u = fill.userData;
    const plank = carGrp.getObjectByName('carFrameGrp').userData.safetyPlank, pf = carGrp.getObjectByName('carPlatform').userData;
    carGrp.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(carGrp.matrixWorld).invert();
    const batch = fill.children.find(c => c.name.startsWith('staticBatch_carBufferStrike'));
    const a = batch.geometry.attributes.position, boxes = [];
    for (let i = 0; i < a.count; i += 24) {
      const b = new THREE.Box3();
      for (let k = i; k < i + 24; k++) b.expandByPoint(new THREE.Vector3().fromBufferAttribute(a, k));
      boxes.push(b);
    }
    let volume = 0; boxes.forEach(b => { const s = b.getSize(new THREE.Vector3()); volume += s.x * s.y * s.z; });
    const region = (2 * u.halfX) * (u.top - u.bottom) * (u.z[1] - u.z[0]);
    const hits = [];
    carGrp.getObjectByName('carOverloadAssembly').traverse(o => {
      if (!o.isMesh) return;
      const ob = new THREE.Box3().setFromObject(o).applyMatrix4(inv).expandByScalar(-0.0005);
      boxes.forEach(b => { if (b.intersectsBox(ob)) hits.push(o.name); });
    });
    const all = new THREE.Box3(); boxes.forEach(b => all.union(b));
    const h = bufferGrp.userData.car, localBufZ = CAR_CTR_Z - carGrp.position.z;
    return { boxes: boxes.length, cuts: u.cuts, fillRatio: volume / region, hits, faceY: u.faceY,
      top: all.max.y, bottom: all.min.y, minX: all.min.x, maxX: all.max.x, minZ: all.min.z, maxZ: all.max.z,
      panBottomY: pf.panBottomY, plankBottom: plank.y - plank.halfH,
      innerStringer: Math.min(...pf.stringerX.map(Math.abs)) - pf.stringerW / 2,
      webInner: [plank.webZ[0] + plank.webT / 2, plank.webZ[1] - plank.webT / 2],
      headInPlate: 0.09 * 1.25 <= u.plate.halfX && localBufZ - 0.09 >= u.plate.z[0] && localBufZ + 0.09 <= u.plate.z[1],
      buffer: { type: h.type, topY: h.topY, stroke: h.stroke, height: h.height } };
  });
  const s = report.strike;
  assert.ok(Math.abs(s.top - s.panBottomY) < 1e-6 && Math.abs(s.bottom - s.plankBottom) < 1e-6, JSON.stringify(s));
  assert.ok(Math.abs(s.maxX - s.innerStringer) < 1e-6 && Math.abs(s.minX + s.innerStringer) < 1e-6);
  assert.ok(Math.abs(s.minZ - s.webInner[0]) < 1e-6 && Math.abs(s.maxZ - s.webInner[1]) < 1e-6);
  assert.deepEqual(s.hits, []); assert.ok(s.cuts > 0 && s.fillRatio > .85 && s.fillRatio < 1, 'fillRatio ' + s.fillRatio);
  assert.ok(s.headInPlate); assert.equal(s.buffer.type, 'urethane'); assert.equal(s.buffer.stroke, .06);

  // ② 1층에서 시연: 아이콘 클릭 → 충돌 → 60mm 압축 → 균형추 상승·여유거리 → 복귀
  await fast(page); await pitView(page);
  await page.waitForSelector('#buffer-demo-action:not([hidden])');
  await page.screenshot({path: `${out}/01-icon.png`});
  const before = await page.evaluate(() => ({ carY: carGrp.position.y, cwtY: cwtGrp.position.y }));
  await page.click('#buffer-demo-action');
  await page.waitForFunction(() => BufferDemo.state.stage === 'compress', null, {polling: 16});
  await page.waitForTimeout(700);
  await page.screenshot({path: `${out}/02-impact-dust.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'observe-pit', null, {polling: 50});
  const atRest = await page.evaluate(() => {
    const u = BufferDemo.state, h = bufferGrp.userData.car, f = carGrp.getObjectByName('carBufferStrike').userData;
    const d = ropeObjs[2].cwtDrop; d.updateMatrixWorld(true);
    const rope = Math.abs(d.localToWorld(new THREE.Vector3(0, -.5, 0)).y - (cwtGrp.position.y + S.CWT_H / 2 + .31));
    scene.updateMatrixWorld(true);
    // 카 하부가 피트 바닥·피트 설비 아래로 내려가지 않는다(가장 낮은 카 부품)
    let low = Infinity, lowName = '';
    carGrp.traverse(o => { if (!o.isMesh || !o.visible) return; const b = new THREE.Box3().setFromObject(o); if (b.min.y < low) { low = b.min.y; lowName = o.name; } });
    return { vImpact: u.vImpact, decelG: u.decel / 9.81, compression: u.compression, face: carGrp.position.y + f.faceY,
      bufferTopNow: h.topY - h.stroke, scaleY: h.urethane.scale.y, scaleR: h.urethane.scale.x, rope, carY: carGrp.position.y,
      cwtY: cwtGrp.position.y, clear: { ...u.clear, box: undefined }, low, lowName, dustVisible: scene.getObjectByName('bufferImpactDust').visible,
      final: elevatorState.finalLimitActive };
  });
  report.run1 = { before, atRest };
  assert.ok(Math.abs(atRest.vImpact - targetSpeedMs(60)) < 1e-6, 'impact speed');
  assert.ok(Math.abs(atRest.compression - .06) < 1e-6 && Math.abs(atRest.face - atRest.bufferTopNow) < 1e-6);
  assert.ok(Math.abs(atRest.scaleY - (.19 - .06) / .19) < 1e-6 && atRest.scaleR > 1.2);
  assert.ok(atRest.rope < 1e-6);
  assert.ok(Math.abs((before.carY - atRest.carY) - (atRest.cwtY - before.cwtY)) < 1e-6, 'cwt rise = car drop');
  assert.ok(Math.abs(atRest.clear.rise - (before.carY - atRest.carY)) < 1e-6 && atRest.clear.gap > .15);
  assert.ok(atRest.low > 0.02, 'car lowest part above pit floor: ' + atRest.low + ' ' + atRest.lowName);
  await page.waitForTimeout(1600);
  await page.screenshot({path: `${out}/03-side-fill.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'observe-cwt', null, {polling: 50});
  // 고정 대기 대신 상태로 기다린다(헤드리스 프레임 지연 시 gsap 시간이 늘어난다).
  await page.waitForFunction(() => !document.getElementById('buffer-demo-clear').hidden && scene.getObjectByName('bufferDemoCwtClearance').visible
    && !gsap.isTweening(camera.position), null, {polling: 50});
  await page.screenshot({path: `${out}/04-cwt-clearance.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await page.waitForTimeout(300);
  await page.screenshot({path: `${out}/05-done.png`});
  assert.ok(await page.evaluate(() => !document.getElementById('fault-reset').hidden && moving && !estop));
  // 시연 중 다른 운행 명령 무시
  await page.evaluate(() => moveElevator(2)); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => BufferDemo.state.stage === 'done'));
  await page.click('#fault-reset');
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  report.reset1 = await page.evaluate(() => ({ carY: carGrp.position.y, cwtY: cwtGrp.position.y, scale: bufferGrp.userData.car.urethane.scale.toArray(),
    curFloor, moving, estop, state: currentState, fov: camera.fov, controls: controls.enabled, pill: document.getElementById('fault-reset').hidden }));
  assert.ok(Math.abs(report.reset1.carY - before.carY) < 1e-6 && Math.abs(report.reset1.cwtY - before.cwtY) < 1e-6);
  assert.deepEqual(report.reset1.scale, [1, 1, 1]); assert.equal(report.reset1.curFloor, 0);
  assert.ok(!report.reset1.moving && !report.reset1.estop && report.reset1.pill);

  // ③ 3층에서 시작(문 열림 → 자동 닫힘 → 하강·빠르게 감기) 후 복귀하면 1층
  await page.evaluate(() => moveElevator(2));
  await page.waitForFunction(() => curFloor === 2 && currentState === ELEVATOR_STATE.DOOR_OPEN, null, {polling: 50});
  await page.evaluate(() => BufferDemo.start());
  await page.waitForFunction(() => BufferDemo.state.stage === 'approach', null, {polling: 50});
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50, timeout: 90000});
  report.run3 = await page.evaluate(() => ({ vImpact: BufferDemo.state.vImpact, comp: BufferDemo.state.compression, gap: BufferDemo.state.clear.gap }));
  assert.ok(Math.abs(report.run3.comp - .06) < 1e-6 && Math.abs(report.run3.vImpact - 1) < 1e-6);
  await page.evaluate(() => BufferDemo.reset());
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  assert.equal(await page.evaluate(() => curFloor), 0);

  // ④ 하강 중 비상정지 → 그 자리 정지 → 정지 버튼(해제)으로 1층 복귀
  await page.evaluate(() => moveElevator(1));
  await page.waitForFunction(() => curFloor === 1 && currentState === ELEVATOR_STATE.DOOR_OPEN, null, {polling: 50});
  await page.evaluate(() => closeDoors());
  await page.waitForFunction(() => currentState === ELEVATOR_STATE.IDLE, null, {polling: 50});
  await page.evaluate(() => BufferDemo.start());
  await page.waitForFunction(() => BufferDemo.state.stage === 'approach' && BufferDemo.state.v > .5, null, {polling: 16});
  await page.click('#btn-estop');
  const halted = await page.evaluate(() => ({ stage: BufferDemo.state.stage, y: carGrp.position.y, estop }));
  await page.waitForTimeout(400);
  assert.equal(halted.stage, 'halted'); assert.ok(!halted.estop);
  assert.ok(Math.abs(await page.evaluate(() => carGrp.position.y) - halted.y) < 1e-9);
  await page.click('#btn-estop');
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  assert.equal(await page.evaluate(() => curFloor), 0);

  // ⑤ 점검 전체 리셋이 시연을 복귀시킨다
  await page.evaluate(() => BufferDemo.start());
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await page.evaluate(() => resetInspections());
  await page.waitForFunction(() => !BufferDemo.active && !inspectionResetting, null, {polling: 50});
  assert.ok(await page.evaluate(() => bufferGrp.userData.car.urethane.scale.y === 1 && !moving));

  // ⑥ 유입식(90 m/min)은 시연하지 않는다
  await page.evaluate(() => { targetSpeed = 90; updateBuffers(); BufferDemo.start(); });
  assert.ok(!(await page.evaluate(() => BufferDemo.active)));
  await page.evaluate(() => { targetSpeed = 60; updateBuffers(); });
  report.errors = errors; assert.deepEqual(errors, []);
  await page.context().close();

  // ⑦ 390px 세로 터치
  const m = await open({width: 390, height: 844}, true);
  await fast(m.page); await pitView(m.page);
  await m.page.waitForSelector('#buffer-demo-action:not([hidden])');
  await m.page.tap('#buffer-demo-action');
  await m.page.waitForFunction(() => BufferDemo.state.stage === 'observe-cwt' && !gsap.isTweening(camera.position), null, {polling: 50});
  await m.page.screenshot({path: `${out}/06-mobile-cwt.png`});
  await m.page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await m.page.waitForTimeout(300);
  await m.page.screenshot({path: `${out}/07-mobile-done.png`});
  await m.page.tap('#fault-reset');
  await m.page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  report.mobileErrors = m.errors; assert.deepEqual(m.errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  console.log('verify_buffer_demo: PASS');
} finally { await browser.close(); }

function targetSpeedMs(v) { return v / 60; }
