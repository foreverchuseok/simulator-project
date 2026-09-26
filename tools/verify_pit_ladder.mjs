// 측면 접이식 피트 사다리 검증: 승강장 기준 높이, 카 간극, 스위치 운행 차단, 근접 버튼 터치.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const out = '.shot-pit-ladder';
fs.mkdirSync(out, { recursive: true });
const URL = process.env.SIMULATOR_URL || 'http://127.0.0.1:5500/index.html';
const ready = () => typeof HallManual !== 'undefined' && CarDoor.state?.ready && hatchDoors.every(h => h.interlock?.ready)
  && scene.getObjectByName('pitFoldingLadder')?.userData.switchReady && document.getElementById('loading').classList.contains('hide');
const browser = await chromium.launch({ args: ['--enable-gpu'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(ready, null, { timeout: 90000 });

  const initial = await page.evaluate(() => {
    scene.updateMatrixWorld(true);
    const ladder = scene.getObjectByName('pitFoldingLadder'), own = new Set();
    ladder.traverse(o => own.add(o));
    const parts = [];
    ladder.traverse(o => { if (o.isMesh) parts.push([o.name || o.geometry.type, new THREE.Box3().setFromObject(o)]); });
    // 카 전 행정(하부 오버런 포함) 정점 ↔ 사다리 부품 최소 거리.
    const near = []; carGrp.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { const b = new THREE.Box3().setFromObject(o); if (b.min.x < -1.35) near.push(o); } });
    const v = new THREE.Vector3(), y0 = carGrp.position.y; let carClear = { d: Infinity };
    for (let y = FLOOR_Y[0] + S.CAR_H / 2 - 0.35; y <= FLOOR_Y.at(-1) + S.CAR_H / 2 + 0.3; y += 0.01) {
      carGrp.position.y = y; carGrp.updateMatrixWorld(true);
      for (const o of near) {
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
          if (v.y > 3.4 || v.x > -1.3) continue;
          for (const [n, b] of parts) { const d = b.distanceToPoint(v); if (d < carClear.d) carClear = { d, part: n, car: o.name }; }
        }
      }
    }
    carGrp.position.y = y0; carGrp.updateMatrixWorld(true);
    // 정적 부품 간섭(벽·피트 슬래브 제외).
    const hits = new Set();
    scene.traverse(o => {
      if (!o.isMesh || !o.visible || own.has(o)) return;
      for (let p = o; p; p = p.parent) if (p === carGrp || p === cwtGrp) return;
      const b = new THREE.Box3().setFromObject(o); if (b.max.x - b.min.x > 1 || b.max.z - b.min.z > 1) return;
      for (const [n, pb] of parts) if (pb.intersectsBox(b)) hits.add(`${n} ↔ ${o.name || o.parent?.name || o.type}`);
    });
    const box = new THREE.Box3().setFromObject(ladder);
    const frame = ladder.getObjectByName('pitLadderMovingFrame');
    const frameBox = new THREE.Box3().setFromObject(frame);
    return { secured: PitLadder.secured, deployed: PitLadder.deployed, data: ladder.userData, sill: FLOOR_Y[0],
      framePosition: frame.position.toArray(), frameTop: frameBox.max.y, frameBottom: frameBox.min.y,
      carClear, staticHits: [...hits], bounds: [box.min.toArray(), box.max.toArray()] };
  });
  const d = initial.data;
  assert.ok(initial.bounds[0][1] >= -1e-6, 'all mounting parts above pit floor');
  assert.ok(Math.abs(initial.frameBottom - d.stowedFootY) < 1e-6, 'stowed feet float by link drop');
  assert.ok(d.linkLength <= 0.35, `short fold links ${d.linkLength}`);
  assert.equal(initial.secured, true); assert.equal(initial.deployed, false);
  assert.ok(d.effectiveWidth >= 0.28, 'effective width');
  assert.ok(d.stepPitch >= 0.25 && d.stepPitch <= 0.30, 'pitch');
  assert.ok(d.stepDepth >= 0.025 && d.stepDepth <= 0.030, 'rung depth');
  assert.ok(d.railWidth <= 0.035 && d.railDepth <= 0.10, 'handle section');
  assert.equal(d.material, 'aluminium');
  assert.ok(d.doorDistance.farRail + d.railWidth / 2 <= 0.8, 'stowed door distance <=800mm including far edge');
  assert.ok(d.deployedDoorDistance.center <= 0.6, 'deployed door distance <=600mm including far edge');
  assert.ok(Math.abs(initial.frameTop - initial.sill - 1.1 - d.stowedFootY) < 1e-6, 'full height already present when stowed');
  assert.ok(initial.carClear.d > 0.01, `car clearance ${JSON.stringify(initial.carClear)}`);
  // 스위치선이 정지 박스 글랜드에 꽂히는 것만 허용.
  assert.deepEqual(initial.staticHits.filter(h => !/CylinderGeometry ↔ pitStopOutletBox|pitStopOutletBox/.test(h)), []);

  const performance = await page.evaluate(async () => {
    const ladder = scene.getObjectByName('pitFoldingLadder');
    const sample = async visible => {
      ladder.visible = visible;
      const times = []; let calls = 0, triangles = 0, previous = performance.now();
      for (let i = 0; i < 100; i++) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        if (i >= 10) { times.push(now - previous); calls += renderer.info.render.calls; triangles += renderer.info.render.triangles; }
        previous = now;
      }
      times.sort((a, b) => a - b);
      return { medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * 0.95)],
        calls: Math.round(calls / times.length), triangles: Math.round(triangles / times.length) };
    };
    const without = await sample(false), withLadder = await sample(true);
    ladder.visible = true;
    return { without, withLadder };
  });

  const shot = async (name, cam, tgt) => {
    await page.evaluate(([cam, tgt]) => {
      document.querySelectorAll('#hud,#hint,#loading').forEach(e => { e.style.visibility = 'hidden'; });
      controls.enableDamping = false; camera.position.set(...cam); controls.target.set(...tgt); controls.update();
    }, [cam, tgt]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => document.querySelectorAll('#hud,#hint,#loading').forEach(e => { e.style.visibility = ''; }));
  };
  // 최하층 1층 카에서는 펼 수 없다.
  assert.equal(await page.evaluate(() => PitLadder.toggle()), false);
  assert.equal(await page.evaluate(() => {
    const y = carGrp.position.y;
    carGrp.position.y = FLOOR_Y[0] + S.CAR_H / 2 + .60;
    const opened = PitLadder.toggle(); carGrp.position.y = y; return opened;
  }), false, 'partially raised car still blocks full-height ladder');
  await page.evaluate(() => {
    carGrp.position.y = FLOOR_Y[1] + S.CAR_H / 2; cwtGrp.position.y = FLOOR_Y[0] + S.CAR_H / 2; curFloor = 1; refreshRopes();
  });
  await page.evaluate(() => { camera.fov = 65; camera.updateProjectionMatrix(); });
  await shot('folded', [0.60, 2.2, -1.20], [-1.55, 1.50, 0.85]);
  await page.evaluate(() => { camera.fov = 42; camera.updateProjectionMatrix(); });
  await shot('folded-switch', [-1.05, 3.0, 0.35], [-1.53, 2.80, 0.85]);
  await page.evaluate(() => { camera.position.set(-.45, 1.45, .05); controls.target.set(-1.55, 1.0, .85); controls.update(); });
  await page.click('#pit-ladder-action');
  assert.equal(await page.evaluate(() => PitLadder.secured), false, 'contact opens immediately');
  await page.evaluate(() => moveElevator(2));
  assert.equal(await page.evaluate(() => moving), false, 'run blocked during deployment');
  const motion = await page.evaluate(async () => {
    const f = scene.getObjectByName('pitLadderMovingFrame'), samples = [];
    const d = PitLadder.dimensions, ladder = scene.getObjectByName('pitFoldingLadder');
    let maxJointError = 0, maxClipSpread = 0, clipFixed = true;
    const clips = ladder.children.filter(o => o.name === 'pitLadderStorageClip');
    const clipPos = clips.map(c => c.position.clone());
    while (!PitLadder.deployed) {
      scene.updateMatrixWorld(true); samples.push(f.position.toArray());
      clips.forEach((c, i) => {
        maxClipSpread = Math.max(maxClipSpread, Math.abs(c.rotation.y));
        if (c.position.distanceTo(clipPos[i]) > 1e-9 || Math.abs(c.rotation.z) > 1e-9 || c.rotation.y * c.userData.side > 1e-9) clipFixed = false;
      });
      ladder.children.filter(o => o.name === 'pitLadderFoldLink').forEach(link => {
        const end = link.localToWorld(new THREE.Vector3(d.linkLength, 0, 0));
        const socket = f.localToWorld(new THREE.Vector3(d.lx, link.userData.socketY, link.position.z));
        maxJointError = Math.max(maxJointError, end.distanceTo(socket));
      });
      await new Promise(requestAnimationFrame);
    }
    samples.push(f.position.toArray());
    return { samples, maxJointError, maxClipSpread, clipFixed, clipRest: clips.map(c => c.rotation.y) };
  });
  assert.ok(motion.samples.every(p => Math.abs(p[2]) < 1e-9), 'no sideways movement');
  assert.ok(motion.maxJointError < 1e-9, 'folding links stay attached throughout motion');
  assert.ok(motion.clipFixed, 'snap clips stay mounted and only flex outward');
  assert.ok(motion.maxClipSpread > 0.02 && motion.maxClipSpread < 0.15, `snap clip flex ${motion.maxClipSpread}`);
  assert.ok(motion.clipRest.every(r => r === 0), 'snap clips spring back after rail passes');
  await page.waitForFunction(() => PitLadder.deployed && !PitLadder.secured);
  const open = await page.evaluate(() => {
    scene.updateMatrixWorld(true);
    const ladder = scene.getObjectByName('pitFoldingLadder'), own = new Set(); ladder.traverse(o => own.add(o));
    const rungs = []; ladder.traverse(o => { if (o.name === 'pitLadderNonSlipRung') rungs.push(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).y); });
    const ys = [...new Set(rungs.map(y => +y.toFixed(4)))].sort((a, b) => a - b);
    const gaps = ys.slice(1).map((y, i) => +(y - ys[i]).toFixed(4));
    const hits = new Set(), parts = [];
    ladder.traverse(o => { if (o.isMesh) parts.push([o.name || o.geometry.type, new THREE.Box3().setFromObject(o)]); });
    scene.traverse(o => {
      if (!o.isMesh || !o.visible || own.has(o)) return;
      for (let p = o; p; p = p.parent) if (p === carGrp || p === cwtGrp) return;
      const b = new THREE.Box3().setFromObject(o); if (b.max.x - b.min.x > 1 || b.max.z - b.min.z > 1) return;
      for (const [n, pb] of parts) if (pb.intersectsBox(b)) hits.add(`${n} ↔ ${o.name || o.parent?.name || o.type}`);
    });
    const frame = ladder.getObjectByName('pitLadderMovingFrame');
    const box = new THREE.Box3().setFromObject(frame);
    return { contact: ladder.getObjectByName('pitLadderNCswitch').userData.contactClosed,
      plungerX: ladder.getObjectByName('pitLadderPlunger').position.x,
      frameBottom: box.min.y, framePosition: frame.position.toArray(), handleAboveSill: box.max.y - FLOOR_Y[0], gaps, staticHits: [...hits] };
  });
  assert.equal(open.contact, false);
  assert.ok(Math.abs(open.frameBottom) < 1e-6, 'both feet at floor');
  assert.ok(Math.abs(open.handleAboveSill - 1.1) < 1e-6, `handle ${open.handleAboveSill}`);
  assert.ok(Math.abs(open.plungerX - 0.0475) < 1e-6, 'released silver plunger travel');
  assert.ok(open.gaps.every(g => Math.abs(g - 0.28) < 1e-3), `pitch ${open.gaps}`);
  assert.ok(open.framePosition[0] > initial.framePosition[0] + .10, 'pulls away from wall');
  assert.ok(Math.abs(open.framePosition[2]) < 1e-9 && Math.abs(open.framePosition[1]) < 1e-9, 'feet land without sideways drift');
  assert.deepEqual(open.staticHits.filter(h => !/pitStopOutletBox/.test(h)), []);
  await page.evaluate(() => { camera.fov = 65; camera.updateProjectionMatrix(); });
  await shot('deployed', [0.60, 2.2, -1.20], [-1.55, 1.50, 0.85]);
  await page.evaluate(() => { camera.fov = 42; camera.updateProjectionMatrix(); });
  await shot('deployed-switch', [-1.23, 2.85, 0.72], [-1.49, 2.80, 0.98]);
  // 승장에서 열린 문으로 들여다본 진입 시점.
  await page.evaluate(() => { const h = hatchDoors[0], s = CarDoor.dimensions().stroke;
    h.left.position.x = h.left.userData.cx - s; h.right.position.x = h.right.userData.cx + s; });
  await shot('deployed-landing', [0.55, 3.25, 1.75], [-1.5, 2.2, 0.8]);
  await page.evaluate(() => { const h = hatchDoors[0]; h.left.position.x = h.left.userData.cx; h.right.position.x = h.right.userData.cx; });
  await page.evaluate(() => moveElevator(2));
  assert.equal(await page.evaluate(() => moving), false, 'run blocked while deployed');
  await page.evaluate(() => { insMode = true; insStart(1); });
  assert.equal(await page.evaluate(() => moving), false, 'inspection blocked while deployed');
  await page.evaluate(() => { insMode = false; rescueToNearestFloor(); });
  assert.equal(await page.evaluate(() => moving), false, 'rescue blocked while deployed');
  await page.click('[data-menu="dd-inst"]');
  await page.click('#btn-pit-ladder');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => PitLadder.secured), false, 'blocked until clips re-seat');
  await page.waitForFunction(() => !PitLadder.deployed && PitLadder.secured);
  assert.equal(await page.evaluate(() => scene.getObjectByName('pitLadderNCswitch').userData.contactClosed), true);
  assert.ok(await page.evaluate(() => {
    scene.updateMatrixWorld(true);
    const ladder = scene.getObjectByName('pitFoldingLadder');
    const pin = new THREE.Box3().setFromObject(ladder.getObjectByName('pitLadderPlunger'));
    const plate = new THREE.Box3().setFromObject(ladder.getObjectByName('pitLadderSwitchActuator'));
    return Math.abs(pin.max.x - plate.min.x) < 1e-5 && pin.min.y < plate.max.y && pin.max.y > plate.min.y;
  }), 'pressed silver tip touches actuator');
  await page.evaluate(() => moveElevator(2));
  assert.equal(await page.evaluate(() => moving), true, 'run restored after securing ladder');
  await page.waitForFunction(() => !moving, null, { timeout: 20000 });
  assert.deepEqual(errors, []);

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  touch.on('pageerror', e => errors.push(e.message));
  await touch.goto(URL, { waitUntil: 'networkidle' });
  await touch.waitForFunction(ready, null, { timeout: 90000 });
  await touch.evaluate(() => { carGrp.position.y = FLOOR_Y[1] + S.CAR_H / 2; curFloor = 1; });
  await touch.evaluate(() => { controls.enableDamping = false; camera.position.set(-.35, 2.1, -.1); controls.target.set(-1.55, 1.75, .85); controls.update(); });
  await touch.locator('#pit-ladder-action').tap();
  await touch.waitForFunction(() => PitLadder.deployed && !PitLadder.secured);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ initial, open, motion: { samples: motion.samples.length, maxJointError: motion.maxJointError }, performance, errors }, null, 1));
} finally {
  await browser.close();
}
