import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.shot-comp-chain');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const { server, port } = await startServer();
const url = process.env.SIMULATOR_URL || `http://127.0.0.1:${port}/index.html`;
const browser = await chromium.launch({ args: ['--enable-gpu'] });
const errors = [];

try {
  // ── 1. PC 검증 (1280×850) ──
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(`PC pageerror: ${e.message}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`PC console.error: ${msg.text()}`); });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof CompChain !== 'undefined' && CompChain.ready && CarDoor.state?.ready, {}, { timeout: 60000 });
  await page.waitForTimeout(400);

  const diag1 = await page.evaluate(() => CompChain.diagnostics());
  console.log('DIAG 1F:', JSON.stringify(diag1));
  assert.equal(diag1.ready, true, 'CompChain should be ready');
  assert.equal(diag1.hitchesReady, true, 'All 4 hitches should be mounted');
  assert.ok(diag1.pitFloorClearance > 0.04, `Pit floor clearance too small: ${diag1.pitFloorClearance}`);
  assert.ok(diag1.pitScreenClearance > 0.015, `Pit screen clearance too small: ${diag1.pitScreenClearance}`);

  // 이중체결 기하 계약: 와이어는 빔 관통홀 외에는 프레임 속에 들어가지 않고(느슨·팽팽 모두),
  // 1번 링크는 U-볼트 바닥 봉(X)에 걸리는 YZ 면, 2번 링크는 와이어가 지나는 XY 면이다.
  const geo = await page.evaluate(() => {
    const g = CompChain.glb, out = { hitches: {} };
    const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), v = new THREE.Vector3(), d = new THREE.Vector3();
    for (const [key, h] of Object.entries(CompChain.hitches)) {
      const D = (h.endKind === 'cwt' ? g.cwtBeamD : g.carBeamD) / 2;
      const frameH = h.endKind === 'cwt' ? cwtGrp.userData.model.bottomBeamH : g.carBeamH;
      h.root.updateWorldMatrix(true, true);
      inv.copy(h.root.matrixWorld).invert();
      const r = { slackInside: 0, tautInside: 0, slackInBracket: 0, morph: h.wireMeshes.length };
      for (const mesh of h.wireMeshes) {
        rel.multiplyMatrices(inv, mesh.matrixWorld);
        const pos = mesh.geometry.attributes.position, mp = mesh.geometry.morphAttributes.position[0];
        for (let i = 0; i < pos.count; i++) {
          for (const state of ['slack', 'taut']) {
            v.fromBufferAttribute(pos, i);
            if (state === 'taut') { d.fromBufferAttribute(mp, i); if (mesh.geometry.morphTargetsRelative) v.add(d); else v.copy(d); }
            v.applyMatrix4(rel);
            const inFrame = v.y > 0.0005 && v.y < frameH && Math.abs(v.z) < D - 0.0005;
            const inHole = Math.hypot(v.x, v.y - g.wireHoleUp) <= g.wireHoleR + 0.0006;
            if (inFrame && !inHole) r[state + 'Inside']++;
            if (state === 'slack' && Math.abs(v.x) < 0.048 && v.y < 0 && v.y > -0.0445 && Math.abs(v.z) < 0.044) r.slackInBracket++;
          }
        }
      }
      out.hitches[key] = r;
    }
    const inst = scene.getObjectByName('compChainLinks'), diag = CompChain.diagnostics();
    const N0 = diag.linksNominal, per = diag.linksPerStrand;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), n = new THREE.Vector3();
    const normal = idx => { inst.getMatrixAt(idx, m); m.decompose(p, q, s); return n.set(0, 0, 1).applyQuaternion(q).toArray().map(Math.abs); };
    out.link1Nx = [normal(0)[0], normal(N0 - 1)[0], normal(per)[0], normal(per + N0 - 1)[0]];
    out.link2Nz = [normal(1)[2], normal(N0 - 2)[2], normal(per + 1)[2], normal(per + N0 - 2)[2]];
    // 느슨한 와이어 최하단이 2번 링크 개구 안(1번 링크 아래 굽힘부와 2번 링크 안쪽 바닥 사이)에 있는지
    out.wireInLink2 = {
      top: (g.link1Y - g.linkOuterL / 2 - g.wireR) - g.wireSlackBotY,
      bottom: g.wireSlackBotY - (g.link2Y - g.linkInnerHalf + g.wireR)
    };
    out.link1OnUBolt = Math.abs((g.link1Y + g.linkInnerHalf) - (g.uboltBottomY + g.uboltWireR));
    return out;
  });
  console.log('GEOMETRY:', JSON.stringify(geo));
  for (const [key, r] of Object.entries(geo.hitches)) {
    assert.ok(r.morph > 0, `${key}: SafetyWire morph target missing`);
    assert.equal(r.slackInside, 0, `${key}: slack wire enters frame outside the through-hole`);
    assert.equal(r.tautInside, 0, `${key}: taut wire enters frame outside the through-hole`);
    assert.equal(r.slackInBracket, 0, `${key}: slack wire penetrates the bracket`);
  }
  geo.link1Nx.forEach(v => assert.ok(v > 0.999, `Link 1 must stand in the YZ plane on the U-bolt (|n.x|=${v})`));
  geo.link2Nz.forEach(v => assert.ok(v > 0.999, `Link 2 must lie in the XY plane for the wire (|n.z|=${v})`));
  assert.ok(geo.wireInLink2.top > 0.005 && geo.wireInLink2.bottom > 0.005, `Wire must pass link 2 opening: ${JSON.stringify(geo.wireInLink2)}`);
  assert.ok(geo.link1OnUBolt < 1e-6, 'Link 1 inner top must rest on the U-bolt rod');

  // 근접 캡처 3종: 균형추 하부 체결부, 카 하부 횡빔/체결부, 피트 U-루프
  await page.evaluate(() => {
    const cx = CompChain.spec.chainXOffset;
    const cwtBotY = cwtGrp.position.y - S.CWT_H / 2;
    controls.minDistance = 0.05; camera.near = 0.005; camera.updateProjectionMatrix();
    camera.position.set(cx + 0.56, cwtBotY - 0.07, CWT_CENTER_Z + 0.42);
    controls.target.set(cx, cwtBotY - 0.09, CWT_CENTER_Z);
    controls.update();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'cwt-hitch-closeup.png') });

  await page.evaluate(() => {
    const cx = CompChain.spec.chainXOffset;
    const carBotY = carGrp.position.y - S.CAR_H / 2 - 0.14;
    const zCar = CAR_CTR_Z + CompChain.spec.carBeamZLocal;
    camera.position.set(cx + 0.85, carBotY - 0.18, zCar + 0.65);
    controls.target.set(0.10, carBotY - 0.05, zCar);
    controls.update();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'car-hitch-closeup.png') });

  await page.evaluate(() => {
    // 후면 우측 사선에서 피트 U-루프와 피트 스크린 하단 통과 간극을 장애물 없이 촬영
    camera.position.set(1.55, 0.68, CWT_CENTER_Z - 1.15);
    controls.target.set(0.15, 0.22, CWT_CENTER_Z + 0.22);
    controls.update();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'pit-loop.png') });

  // ── 2. 이중체결(정상) 비교 시연 검증 ──
  await page.evaluate(() => CompChainDemo.start('dual'));
  await page.waitForFunction(() => CompChainDemo.state.stage === 'caught', {}, { timeout: 15000 });
  // 일시정지 동작 확인
  await page.evaluate(() => DemoPause.set(true));
  assert.equal(await page.evaluate(() => DemoPause.paused), true);
  await page.waitForTimeout(150);
  await page.evaluate(() => DemoPause.set(false));
  assert.equal(await page.evaluate(() => DemoPause.paused), false);

  await page.waitForFunction(() => CompChainDemo.state.stage === 'done', {}, { timeout: 15000 });
  await page.waitForTimeout(350);
  const dualCheck = await page.evaluate(() => {
    const h = CompChain.hitches.cwtR, d = CompChain.diagnostics(), inst = scene.getObjectByName('compChainLinks');
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    inst.getMatrixAt(d.linksPerStrand + d.linksNominal - 2, m); p.setFromMatrixPosition(m);
    h.root.updateWorldMatrix(true, false); p.applyMatrix4(h.root.matrixWorld.clone().invert());
    return {
      stage: CompChainDemo.state.stage,
      mode: CompChainDemo.state.mode,
      brkVisible: h.breakBracket.visible,
      wireVisible: h.safetyWire.visible,
      taut: h.wireMeshes[0].morphTargetInfluences[0],
      brokenVisible: CompChain.brokenHitch.visible,
      topLinkY: p.y,
      expectTopLinkY: CompChain.glb.link2CaughtYCwt,
      takeaway: document.getElementById('demo-takeaway')?.dataset.key || '',
      takeawayTone: document.getElementById('demo-takeaway')?.dataset.tone || '',
      compareHidden: document.getElementById('demo-compare-next')?.hidden
    };
  });
  console.log('DUAL CHECK:', JSON.stringify(dualCheck));
  assert.equal(dualCheck.brkVisible, false, 'BreakBracket must detach in dual mode');
  assert.equal(dualCheck.brokenVisible, true, 'Detached bracket + link 1 must hang from link 2');
  assert.equal(dualCheck.wireVisible, true, 'Safety wire must stay visible');
  assert.ok(dualCheck.taut > 0.999, 'Safety wire must be taut (morph target 1)');
  assert.ok(Math.abs(dualCheck.topLinkY - dualCheck.expectTopLinkY) < 0.003, `Link 2 must hang on the taut wire: ${dualCheck.topLinkY} vs ${dualCheck.expectTopLinkY}`);
  assert.equal(dualCheck.takeaway, 'chain:dual');
  assert.equal(dualCheck.takeawayTone, 'safe');
  assert.equal(dualCheck.compareHidden, false, 'Compare opposite button should be visible');
  await page.screenshot({ path: path.join(OUT, 'dual-caught.png') });

  // 반대 모드(미설치 · 사고) 버튼으로 즉시 전환 검증!
  await page.click('#demo-compare-next');
  await page.waitForFunction(() => CompChainDemo.active && CompChainDemo.state.mode === 'single', {}, { timeout: 15000 });
  await page.waitForFunction(() => CompChainDemo.state.stage === 'done', {}, { timeout: 20000 });
  await page.waitForTimeout(350);
  const singleCheck = await page.evaluate(() => ({
    stage: CompChainDemo.state.stage,
    mode: CompChainDemo.state.mode,
    brkVisible: CompChain.hitches.cwtR.breakBracket.visible,
    wireVisible: CompChain.hitches.cwtR.safetyWire.visible,
    sleevesVisible: CompChain.hitches.cwtR.wireSleeves.visible,
    brokenVisible: CompChain.brokenHitch.visible,
    brokenY: CompChain.brokenHitch.matrix.elements[13] - Y0,
    takeaway: document.getElementById('demo-takeaway')?.dataset.key || '',
    takeawayTone: document.getElementById('demo-takeaway')?.dataset.tone || ''
  }));
  console.log('SINGLE CHECK:', JSON.stringify(singleCheck));
  assert.equal(singleCheck.brkVisible, false);
  assert.equal(singleCheck.wireVisible, false);
  assert.equal(singleCheck.sleevesVisible, false, 'No through-hole sleeves when double fixing is not installed');
  assert.equal(singleCheck.brokenVisible, true, 'Detached bracket must fall with the chain end');
  assert.ok(singleCheck.brokenY < 0.5, `Detached bracket must end on the pit pile: ${singleCheck.brokenY}`);
  assert.equal(singleCheck.takeaway, 'chain:single');
  assert.equal(singleCheck.takeawayTone, 'danger');
  await page.screenshot({ path: path.join(OUT, 'single-crash.png') });

  // 취소 복귀 검증
  await page.click('#demo-exit');
  await page.waitForFunction(() => !CompChainDemo.active && !DemoExit.busy, {}, { timeout: 10000 });
  const restored = await page.evaluate(() => ({
    brkVisible: CompChain.hitches.cwtR.breakBracket.visible,
    wireVisible: CompChain.hitches.cwtR.safetyWire.visible,
    taut: CompChain.hitches.cwtR.wireMeshes[0].morphTargetInfluences[0],
    brokenVisible: CompChain.brokenHitch.visible,
    dual: CompChain.dualProtection
  }));
  console.log('RESTORED:', JSON.stringify(restored));
  assert.deepEqual(restored, { brkVisible: true, wireVisible: true, taut: 0, brokenVisible: false, dual: true });

  // 4층 운행 연동 검증 (루프 최하단이 전 행정에서 일정 유지!)
  await page.evaluate(() => moveElevator(3));
  await page.waitForFunction(() => curFloor === 3 && !moving, {}, { timeout: 30000 });
  const diag4 = await page.evaluate(() => CompChain.diagnostics());
  console.log('DIAG 4F:', JSON.stringify(diag4));
  assert.ok(Math.abs(diag4.loopBottom - diag1.loopBottom) < 0.015, `Loop bottom drifted: 1F=${diag1.loopBottom} vs 4F=${diag4.loopBottom}`);
  assert.ok(diag4.pitScreenClearance > 0.015, `Pit screen clearance at 4F too small: ${diag4.pitScreenClearance}`);

  await page.close();

  // ── 3. 모바일 검증 (390×844) ──
  const mPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  mPage.on('pageerror', e => errors.push(`Mobile pageerror: ${e.message}`));
  mPage.on('console', msg => { if (msg.type() === 'error') errors.push(`Mobile console.error: ${msg.text()}`); });
  await mPage.goto(url, { waitUntil: 'networkidle' });
  await mPage.waitForFunction(() => typeof CompChain !== 'undefined' && CompChain.ready && CarDoor.state?.ready, {}, { timeout: 60000 });
  await mPage.waitForTimeout(300);

  await mPage.click('#m-demo-fab');
  await mPage.waitForTimeout(200);
  await mPage.click('li[data-demo="chain"] .demo-skill');
  await mPage.waitForTimeout(250);
  const mobilePreview = await mPage.evaluate(() => ({
    title: document.querySelector('#m-demo-preview strong')?.textContent,
    modes: [...document.querySelectorAll('#m-demo-preview [data-preview-mode]')].map(b => b.textContent)
  }));
  console.log('MOBILE PREVIEW:', JSON.stringify(mobilePreview));
  assert.equal(mobilePreview.title, '균형체인');
  assert.deepEqual(mobilePreview.modes, ['이중체결', '미설치']);
  await mPage.screenshot({ path: path.join(OUT, 'mobile-menu.png') });

  await mPage.click('#m-demo-play');
  await mPage.waitForFunction(() => CompChainDemo.state.stage === 'done', {}, { timeout: 20000 });
  await mPage.waitForTimeout(350);
  const mobileGuide = await mPage.evaluate(() => ({
    guideVisible: !document.getElementById('m-demo-guide')?.hidden,
    takeawayVisible: !document.getElementById('demo-takeaway')?.hidden,
    takeawayKey: document.getElementById('demo-takeaway')?.dataset.key || ''
  }));
  console.log('MOBILE DUAL:', JSON.stringify(mobileGuide));
  assert.equal(mobileGuide.guideVisible, true);
  assert.equal(mobileGuide.takeawayVisible, true);
  assert.equal(mobileGuide.takeawayKey, 'chain:dual');
  await mPage.screenshot({ path: path.join(OUT, 'mobile-dual.png') });
  await mPage.close();

  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  console.log('ALL PASS comp-chain geometry, dual/single demos, pause/exit, 4F travel, mobile UI.');
} finally {
  await browser.close();
  server.close();
}
