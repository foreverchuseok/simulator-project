// 균형추 완충기 충돌 시연 검증 (js/buffer-demo.js 균형추 모드 · elevator.js cwtBufferStrike)
// node tools/verify_cwt_buffer_demo.mjs  — Live Server http://127.0.0.1:5500 필요. 결과 .shot-cwt-buffer/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out = '.shot-cwt-buffer'; fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({args: ['--enable-gpu']});
const report = {};
const ready = () => govHandles()?.ready && CarDoor.state?.ready && cwtGrp.userData.model && scene.getObjectByName('cwtBufferStrike')
  && railGrp.userData.carRailTopY && carGrp.userData.guideShoes?.length === 4;
async function open(viewport, mobile = false) {
  const context = await browser.newContext({viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1});
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  await page.routeWebSocket('**', socket => socket.close());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ReadPixels|GPU stall/.test(m.text())) errors.push(m.text()); });
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  await page.goto(`${process.env.SIM_URL || 'http://127.0.0.1:5500'}/index.html?legacyIcons`, {waitUntil: 'networkidle'});
  await page.waitForFunction(ready);
  return {page, errors};
}
const pitView = page => page.evaluate(async () => {
  controls.enableDamping = false;
  camera.position.set(0.45, 0.62, CWT_CENTER_Z + 1.25); controls.target.set(0, 0.42, CWT_CENTER_Z); controls.update();
  for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
});
const fast = page => page.evaluate(() => { BufferDemo.timing.holdPit = 1.8; BufferDemo.timing.holdTop = 3; BufferDemo.timing.holdRoof = 3; });
try {
  const {page, errors} = await open({width: 1280, height: 850});

  // ① 스트라이커: 하부 빔 밑 100mm, 완충기 헤드(부풂 포함)가 타격판 안, 최상층에서 완충기와 떨어져 있음
  report.strike = await page.evaluate(() => {
    const s = cwtGrp.getObjectByName('cwtBufferStrike'), u = s.userData, h = bufferGrp.userData.cwt;
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(s), cw = new THREE.Box3();
    cwtGrp.getObjectByName('counterweightModel').traverse(o => { if (o.isMesh) cw.union(new THREE.Box3().setFromObject(o)); });
    const bulge = .08 / Math.sqrt((h.height - h.stroke) / h.height);
    return { faceY: u.faceY, height: u.height, top: b.max.y, bottom: b.min.y, modelBottom: cw.min.y, cwtY: cwtGrp.position.y,
      halfX: (b.max.x - b.min.x) / 2, halfZ: (b.max.z - b.min.z) / 2, headBulge: bulge, plateHalfX: u.plateHalfX, plateHalfZ: u.plateHalfZ,
      buffer: { type: h.type, topY: h.topY, stroke: h.stroke, height: h.height } };
  });
  const s = report.strike;
  assert.ok(Math.abs(s.height - .1) < 1e-9 && Math.abs(s.top - s.modelBottom) < 1e-6 && Math.abs(s.bottom - (s.cwtY + s.faceY)) < 1e-6, JSON.stringify(s));
  assert.ok(s.headBulge < s.plateHalfX && s.headBulge < s.plateHalfZ + .003, 'head within plate');
  assert.equal(s.buffer.type, 'urethane');

  // ② 1층에서 시연: 아이콘 → 카 상승 → 균형추 스트라이커 충돌 → 60mm 압축 → 카 가이드레일 여유거리 → 복귀(최상층)
  await fast(page); await pitView(page);
  await page.waitForSelector('#cwt-buffer-demo-action:not([hidden])');
  await page.screenshot({path: `${out}/01-icon.png`});
  const before = await page.evaluate(() => {
    scene.updateMatrixWorld(true);
    // 카 평면 위 가장 낮은 고정물(로프·레일 제외) — 카가 올라가 부딪히지 않는지(천장 틈새 표시는 다음 작업)
    const car = new THREE.Box3(); carGrp.traverse(o => { if (o.isMesh && o.visible) car.union(new THREE.Box3().setFromObject(o)); });
    let low = SHAFT_CEIL_Y, lowName = 'ceiling'; const b = new THREE.Box3();
    scene.traverse(o => {
      if (!o.isMesh || /rope|rail/i.test(o.name)) return;
      for (let p = o; p; p = p.parent) if (!p.visible || p === cwtGrp || p === carGrp || p.name === 'bufferDemoCwtClearance') return;
      b.setFromObject(o);
      if (b.min.y > car.max.y + FLOOR_Y[FLOORS - 1] - FLOOR_Y[0] && b.min.y < low && b.max.x > car.min.x && b.min.x < car.max.x && b.max.z > car.min.z && b.min.z < car.max.z) { low = b.min.y; lowName = o.name || o.parent?.name; }
    });
    return { carY: carGrp.position.y, cwtY: cwtGrp.position.y, carTop: car.max.y, overhead: low, overheadName: lowName };
  });
  await page.click('#cwt-buffer-demo-action');
  await page.waitForFunction(() => BufferDemo.state.stage === 'approach' && !gsap.isTweening(camera.position), null, {polling: 50});
  // 일시정지: 카가 멈추고 버튼이 재생으로 바뀐다 → 재생하면 이어 간다
  await page.waitForFunction(() => BufferDemo.state.v > .2, null, {polling: 16});
  await page.click('#buffer-demo-pause');
  const p0 = await page.evaluate(() => ({ y: carGrp.position.y, text: document.getElementById('buffer-demo-pause').textContent, paused: BufferDemo.state.paused }));
  await page.waitForTimeout(700);
  const p1 = await page.evaluate(() => carGrp.position.y);
  assert.ok(p0.paused && /재생/.test(p0.text) && Math.abs(p1 - p0.y) < 1e-9, `paused ${JSON.stringify(p0)} ${p1}`);
  await page.click('#buffer-demo-pause');
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(y => !BufferDemo.state.paused && carGrp.position.y > y, p1), 'resumed');
  await page.waitForFunction(() => BufferDemo.state.stage === 'approach' && (BufferDemo.state.contactY - carGrp.position.y) < .25, null, {polling: 16});
  await page.screenshot({path: `${out}/02-approach.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'compress', null, {polling: 16});
  await page.waitForTimeout(600);
  await page.screenshot({path: `${out}/03-impact.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'observe-pit', null, {polling: 50});
  const atRest = await page.evaluate(() => {
    const u = BufferDemo.state, h = bufferGrp.userData.cwt, f = cwtGrp.getObjectByName('cwtBufferStrike').userData;
    const d = ropeObjs[2].cwtDrop; d.updateMatrixWorld(true);
    const rope = Math.abs(d.localToWorld(new THREE.Vector3(0, -.5, 0)).y - (cwtGrp.position.y + S.CWT_H / 2 + .31));
    scene.updateMatrixWorld(true);
    // 급유통(Oiler 하위)은 부서져도 되는 소모품 → 가이드슈 본체 윗면. 급유통 윗면은 대조용.
    const uppers = carGrp.userData.guideShoes.filter(s => s.userData.isUpper);
    const bodyTop = s => { let y = -Infinity; s.traverse(o => { if (!o.isMesh) return; for (let p = o; p && p !== s; p = p.parent) if (/^Oiler/.test(p.name)) return; y = Math.max(y, new THREE.Box3().setFromObject(o).max.y); }); return y; };
    const shoeTop = Math.max(...uppers.map(bodyTop));
    const oilerTop = Math.max(...uppers.map(s => new THREE.Box3().setFromObject(s.getObjectByName('Oiler')).max.y));
    const car = new THREE.Box3(); carGrp.traverse(o => { if (o.isMesh && o.visible) car.union(new THREE.Box3().setFromObject(o)); });
    return { mode: BufferDemo.mode, vImpact: u.vImpact, decelG: u.decel / 9.81, compression: u.compression, face: cwtGrp.position.y + f.faceY,
      bufferTopNow: h.topY - h.stroke, scaleY: h.urethane.scale.y, carScale: bufferGrp.userData.car.urethane.scale.y, rope, carY: carGrp.position.y,
      cwtY: cwtGrp.position.y, topFloorY: FLOOR_Y[FLOORS - 1] + S.CAR_H / 2, shoeTop, oilerTop, railTop: railGrp.userData.carRailTopY, carTop: car.max.y, clear: { ...u.clear, box: undefined } };
  });
  report.run1 = { before, atRest };
  assert.equal(atRest.mode, 'cwt');
  assert.ok(Math.abs(atRest.vImpact - 1) < 1e-6, 'impact speed');
  assert.ok(Math.abs(atRest.compression - .06) < 1e-6 && Math.abs(atRest.face - atRest.bufferTopNow) < 1e-6, 'compressed face');
  assert.ok(Math.abs(atRest.scaleY - (.19 - .06) / .19) < 1e-6 && atRest.carScale === 1);
  assert.ok(atRest.rope < 1e-6, 'rope end follows cwt');
  assert.ok(Math.abs((atRest.carY - before.carY) - (before.cwtY - atRest.cwtY)) < 1e-6, 'car rise = cwt drop');
  assert.ok(Math.abs(atRest.clear.shift - (atRest.carY - before.carY)) < 1e-6);
  assert.ok(Math.abs(atRest.clear.rise - (atRest.carY - atRest.topFloorY)) < 1e-6, 'overtravel above top floor');
  assert.ok(Math.abs(atRest.clear.gap - (atRest.railTop - atRest.shoeTop)) < 1e-6, 'rail clearance measured from shoe');
  assert.ok(atRest.oilerTop > atRest.shoeTop + .01, `oiler ${atRest.oilerTop} sits above shoe body ${atRest.shoeTop} (excluded)`);
  assert.ok(atRest.clear.gap >= atRest.clear.required, 'rail clearance >= 0.1+0.035v²');
  const over = atRest.clear.over;
  assert.ok(over && over.D.gap >= 0.3 && over.C.gap >= 0.5 && Math.abs(over.E.gap - 0.4) < 1e-9, 'handrail D/C/E');
  assert.ok(over.D.from.x > 0.5 && over.E.from.x > 0.5 && over.C.from.x < -0.5 && over.A.from.x < -0.3 && over.B.from.x > -0.3, 'overhead dims split left/right');
  assert.ok(over.A.gap >= 0.5 && over.B.gap >= 0.5, 'roof vertical A/B >= 0.50');
  assert.ok(Math.abs(over.C.gap - Math.hypot(0.4, over.D.gap)) < 1e-6, 'C is the incline across E');
  assert.ok(atRest.carTop < before.overhead, `car top ${atRest.carTop} below overhead ${before.overhead} ${before.overheadName}`);
  await page.waitForFunction(() => !gsap.isTweening(camera.position), null, {polling: 50});
  await page.waitForTimeout(300);
  await page.screenshot({path: `${out}/04-side-strike.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'observe-cwt', null, {polling: 50});
  await page.waitForFunction(() => !document.getElementById('buffer-demo-clear').hidden && scene.getObjectByName('bufferDemoCwtClearance').visible && scene.getObjectByName('bufferDemoOverheadClearance').visible && !gsap.isTweening(camera.position), null, {polling: 50});
  await page.screenshot({path: `${out}/05-rail-clearance.png`});
  await page.waitForFunction(() => BufferDemo.state.view === 'roof' && !gsap.isTweening(camera.position), null, {polling: 50});
  await page.waitForTimeout(200);
  await page.screenshot({path: `${out}/05b-roof-overhead.png`});
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await page.waitForTimeout(300);
  await page.screenshot({path: `${out}/06-done.png`});
  assert.ok(await page.evaluate(() => !document.getElementById('fault-reset').hidden && document.getElementById('fault-reset').dataset.src === 'cwt-buffer-demo-action'));
  await page.evaluate(() => moveElevator(0)); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => BufferDemo.state.stage === 'done'));
  await page.click('#fault-reset');
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  report.reset1 = await page.evaluate(() => ({ carY: carGrp.position.y, target: FLOOR_Y[FLOORS - 1] + S.CAR_H / 2, scale: bufferGrp.userData.cwt.urethane.scale.toArray(),
    curFloor, moving, estop, pill: document.getElementById('fault-reset').hidden, icon: document.getElementById('cwt-buffer-demo-action').textContent }));
  assert.ok(Math.abs(report.reset1.carY - report.reset1.target) < 1e-6); assert.deepEqual(report.reset1.scale, [1, 1, 1]);
  assert.equal(report.reset1.curFloor, 3); assert.ok(!report.reset1.moving && !report.reset1.estop && report.reset1.pill && report.reset1.icon === 'BUF');

  // ③ 최상층에서 바로 시작(문 열림 → 자동 닫힘) · 상승 중 비상정지 → 정지 버튼으로 최상층 복귀
  await page.evaluate(() => openDoors());
  await page.waitForFunction(() => currentState === ELEVATOR_STATE.DOOR_OPEN || currentState === ELEVATOR_STATE.IDLE, null, {polling: 50});
  await page.evaluate(() => BufferDemo.start('cwt'));
  await page.waitForFunction(() => BufferDemo.state.stage === 'approach' && BufferDemo.state.v > .3, null, {polling: 16});
  await page.click('#btn-estop');
  const halted = await page.evaluate(() => ({ stage: BufferDemo.state.stage, y: carGrp.position.y, estop }));
  assert.equal(halted.stage, 'halted'); assert.ok(!halted.estop);
  await page.click('#btn-estop');
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  assert.equal(await page.evaluate(() => curFloor), 3);

  // ④ 카 모드는 그대로(1층 복귀) · 점검 전체 리셋이 균형추 시연을 복귀시킨다
  await page.evaluate(() => BufferDemo.start('cwt'));
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await page.evaluate(() => resetInspections());
  await page.waitForFunction(() => !BufferDemo.active && !inspectionResetting, null, {polling: 50});
  assert.ok(await page.evaluate(() => bufferGrp.userData.cwt.urethane.scale.y === 1 && !moving));
  await page.evaluate(() => BufferDemo.start('car'));
  await page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50, timeout: 90000});
  report.car = await page.evaluate(() => ({ mode: BufferDemo.mode, comp: BufferDemo.state.compression, gap: BufferDemo.state.clear.gap, cwtScale: bufferGrp.userData.cwt.urethane.scale.y }));
  assert.ok(report.car.mode === 'car' && Math.abs(report.car.comp - .06) < 1e-6 && report.car.cwtScale === 1);
  await page.evaluate(() => BufferDemo.reset());
  await page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  assert.equal(await page.evaluate(() => curFloor), 0);

  // ⑤ 유입식(90 m/min)은 시연하지 않는다
  await page.evaluate(() => { targetSpeed = 90; updateBuffers(); BufferDemo.start('cwt'); });
  assert.ok(!(await page.evaluate(() => BufferDemo.active)));
  await page.evaluate(() => { targetSpeed = 60; updateBuffers(); });
  report.errors = errors; assert.deepEqual(errors, []);
  await page.context().close();

  // ⑥ 390px 세로 터치
  const m = await open({width: 390, height: 844}, true);
  await fast(m.page); await pitView(m.page);
  await m.page.waitForSelector('#cwt-buffer-demo-action:not([hidden])');
  await m.page.tap('#cwt-buffer-demo-action');
  await m.page.waitForFunction(() => BufferDemo.state.stage === 'observe-cwt' && !document.getElementById('buffer-demo-clear').hidden, null, {polling: 50});
  await m.page.waitForTimeout(200);
  await m.page.waitForFunction(() => !gsap.isTweening(camera.position), null, {polling: 50});
  await m.page.screenshot({path: `${out}/07-mobile-rail.png`});
  await m.page.waitForFunction(() => BufferDemo.state.view === 'roof' && !gsap.isTweening(camera.position), null, {polling: 50});
  await m.page.waitForTimeout(200);
  await m.page.screenshot({path: `${out}/07b-mobile-roof.png`});
  await m.page.waitForFunction(() => BufferDemo.state.stage === 'done', null, {polling: 50});
  await m.page.tap('#fault-reset');
  await m.page.waitForFunction(() => !BufferDemo.active, null, {polling: 50});
  report.mobileErrors = m.errors; assert.deepEqual(m.errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  console.log('verify_cwt_buffer_demo: PASS');
} finally { await browser.close(); }
