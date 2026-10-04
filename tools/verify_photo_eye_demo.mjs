// 카문 문닫힘 안전장치(멀티빔) 반전 시연(js/photo-eye-demo.js) 검증.
// 감지 구간 기준(카문 문턱 위 25~1,600 ㎜): 발은 최하단 빔, 손은 1,600 ㎜ 부근 빔을 실제로 끊어 반전하고, 탑승 후에는 끝까지 닫히는지 본다.
// 진입(열린 문=센서 직접, 닫힌 문=카문 메뉴), 비상정지 중단·복귀, PC/390px 터치, 브라우저 오류 0건.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out = 'temporary/photo-eye'; fs.mkdirSync(out, {recursive: true});
const url = process.env.URL || 'http://127.0.0.1:5500/index.html';
const browser = await chromium.launch({args: ['--enable-gpu', '--use-angle=d3d11']});
const result = {};
try {
  for (const variant of ['pc', 'mobile']) {
    const mobile = variant === 'mobile';
    const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 850}, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile});
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(90000); page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
    await page.routeWebSocket('**', s => s.close());
    const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await page.goto(url, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => CarDoor.state?.ready && carGrp.getObjectByName('multiBeamTx')?.userData.ready && FingerGap.entries.length);
    const r = {};

    // 진입 ①: 닫힌 문 — 카 안에서 문을 보면 「카문」 메뉴에 시연 항목이 생긴다.
    await page.evaluate(() => { const p = cabinLookPose(); camera.position.set(...p.position); controls.target.set(...p.target); controls.update(); });
    await page.waitForFunction(() => !document.getElementById('photo-eye-menu-action').hidden, null, {timeout: 5000}).catch(() => {});
    r.closedEntry = await page.evaluate(() => ({menu: !document.getElementById('photo-eye-menu-action').hidden, sensor: !document.getElementById('photo-eye-action').hidden}));
    assert.deepEqual(r.closedEntry, {menu: true, sensor: false});
    // 진입 ②: 열린 문 — 센서 자체(직접 실행).
    await page.evaluate(() => openDoors());
    await page.waitForFunction(() => currentState === ELEVATOR_STATE.DOOR_OPEN);
    await page.evaluate(() => clearTimeout(autoTimer));
    // 좁은 세로 화면의 카 안 정면 시점에선 열린 양쪽 센서가 화면 밖(가로 시야 ±12°) — 승장 쪽에서 출입구 전체를 본다.
    if (mobile) await page.evaluate(() => { const v = new THREE.Vector3(); carGrp.getObjectByName('multiBeamTx').getWorldPosition(v); const fy = FLOOR_Y[curFloor]; camera.position.set(.3, fy + 1.3, v.z + 4.2); controls.target.set(0, fy + 1, v.z); controls.update(); });
    await page.waitForFunction(() => !document.getElementById('photo-eye-action').hidden, null, {timeout: 5000}).catch(() => {});
    r.openEntry = await page.evaluate(() => ({menu: !document.getElementById('photo-eye-menu-action').hidden, sensor: !document.getElementById('photo-eye-action').hidden}));
    assert.deepEqual(r.openEntry, {menu: false, sensor: true});

    // 비상정지 중단 → 승곰이 치우고 문 닫힘·시점 복귀.
    const eye = await page.evaluate(() => camera.position.toArray());
    await page.evaluate(() => document.getElementById('photo-eye-action').click());
    await page.waitForFunction(() => PhotoEyeDemo.state.stage === 'foot');
    await page.click('#btn-estop');
    await page.waitForFunction(() => !PhotoEyeDemo.active && !CarDoor.state.busy && !doorOpen, null, {timeout: 20000});
    r.cancel = await page.evaluate(e => ({estop, eye: camera.position.distanceTo(new THREE.Vector3(...e)), bear: scene.getObjectByName('PhotoEyeSeunggom')?.visible, state: currentState}), eye);
    assert.equal(r.cancel.estop, false); assert.ok(r.cancel.eye < 1e-6); assert.equal(r.cancel.bear, false);

    // 전체 시연: 닫힌 문에서 메뉴 항목으로 시작(문을 먼저 연다).
    await page.evaluate(() => document.getElementById('photo-eye-menu-action').click());
    const shots = {footHit: 'foot', handHit: 'hand', close: 'close'};
    for (const [stageName, file] of Object.entries(shots)) {
      await page.waitForFunction(s => PhotoEyeDemo.state.stage === s, stageName, {timeout: 40000});
      await page.waitForTimeout(stageName === 'close' ? 450 : 120);
      await page.screenshot({path: `${out}/${variant}-${file}.png`});
    }
    await page.waitForFunction(() => PhotoEyeDemo.state.stage === 'done', null, {timeout: 20000});
    await page.waitForTimeout(500); await page.screenshot({path: `${out}/${variant}-done.png`});
    await page.waitForFunction(() => !PhotoEyeDemo.active, null, {timeout: 20000});
    r.story = await page.evaluate(() => ({reversals: PhotoEyeDemo.state.reversals, closedClean: PhotoEyeDemo.state.closedClean, completed: PhotoEyeDemo.state.completed, error: PhotoEyeDemo.state.error,
      door: {doorOpen, busy: CarDoor.state.busy, secured: CarDoor.secured(), state: currentState}, bear: scene.getObjectByName('PhotoEyeSeunggom').visible,
      roofMascot: Mascot.root.position.toArray(), armLength: PhotoEyeDemo.armLength, panel: !document.getElementById('photo-eye-panel').hidden}));
    const s = r.story;
    assert.equal(s.error, ''); assert.equal(s.completed, true); assert.equal(s.closedClean, true);
    assert.deepEqual(s.reversals.map(x => x.kind), ['foot', 'hand']);
    const [foot, hand] = s.reversals, top = b => Math.max(...b.beams), low = b => Math.min(...b.beams);
    assert.ok(top(foot) <= 2, 'foot = lowest beams ' + foot.beams);
    assert.ok(low(hand) > top(foot), JSON.stringify(s.reversals));
    // 빔 n번(1부터) 높이 = 문턱 위 약 (n − 1)×100 + 56 ㎜. 짧은 팔(2026-10-05)로 손은 약 1m — 빔 10~12번(머리가 끊는 13번 이상 금지).
    assert.ok(low(hand) >= 9 && top(hand) <= 12, 'hand = beams near 1 m ' + hand.beams);
    assert.ok(s.armLength === .16, 'short arm ' + s.armLength);
    assert.ok(foot.beams.includes(1), 'foot = lowest beam ' + foot.beams);
    for (const x of s.reversals) assert.ok(x.openFraction > .45, 'reversed before the leaves reach the bear ' + x.openFraction);
    assert.equal(s.door.secured, true); assert.equal(s.bear, false); assert.equal(s.panel, true);
    assert.deepEqual(errors, []);
    r.errors = errors; result[variant] = r; await context.close();
  }
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 1));
} finally { await browser.close(); }
