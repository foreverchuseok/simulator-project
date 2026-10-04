// 종단 스위치(강제감속·리미트·파이널) 작동·시연 검증 — js/terminal-demo.js, ui.js insTick/insStart.
// ① 스위치 6개 발광 진입 ② 시연 3종(하부·상부) 트립 위치·순서 ③ 비상정지 중단
// ④ 점검 운전: 감속 구간 7.5 m/min · 리미트 정지 · 같은 방향 차단 · 반대 방향 운전 · 융착 시 파이널 래치
// ⑤ 파이널 래치 중 자동 호출 차단 ⑥ 390px 화면 ⑦ 브라우저 오류 0건.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out = 'temporary/terminal'; fs.mkdirSync(out, {recursive: true});
const url = process.env.URL || 'http://127.0.0.1:5500/index.html';
const browser = await chromium.launch({args: ['--enable-gpu', '--use-angle=d3d11']});
const result = {};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
async function open(viewport, mobile) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile});
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(90000); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  await page.routeWebSocket('**', s => s.close());
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => terminalDevices.modelReady && CarDoor.state?.ready);
  return {context, page, errors};
}
// 시연 한 편을 끝까지 돌린다(파이널은 수동 복귀 버튼을 누른다).
async function demo(page, kind, dir, shots, prefix) {
  const before = await page.evaluate(() => ({floor: curFloor, eye: camera.position.toArray()}));
  await page.evaluate(([k, d]) => TerminalDemo.start(k, d), [kind, dir]);
  const seen = new Set();
  for (const t0 = Date.now(); Date.now() - t0 < 90000;) {
    const s = await page.evaluate(() => ({stage: TerminalDemo.state.stage, done: TerminalDemo.state.completed, active: TerminalDemo.active}));
    if (shots.includes(s.stage) && !seen.has(s.stage)) { seen.add(s.stage); await page.waitForTimeout(250); await page.screenshot({path: `${out}/${prefix}-${s.stage}.png`}); }
    if (s.stage === 'manual') await page.click('#terminal-demo-reset');
    if (s.done || !s.active) break;
    await page.waitForTimeout(120);
  }
  const r = await page.evaluate(() => ({...TerminalDemo.state, car: carGrp.position.y, curFloor, latchedAfter: TerminalDemo.latched, welded: terminalDevices.switches.some(s => s.welded)}));
  assert.equal(r.error, ''); assert.equal(r.completed, true, `${kind}${dir} 완료`);
  await page.click('#terminal-demo-end');
  await page.waitForFunction(() => !TerminalDemo.active);
  // 종료 = 시연 전 층·시점으로 원위치, 래치·융착·이동 상태 없음(전체 리셋 불필요)
  r.restored = await page.evaluate(b => ({floor: curFloor === b.floor, off: Math.abs(carGrp.position.y - FLOOR_Y[b.floor] - S.CAR_H / 2) < 1e-6,
    eye: camera.position.distanceTo(new THREE.Vector3(...b.eye)) < 1e-6, idle: !moving && currentState === ELEVATOR_STATE.IDLE, latched: TerminalDemo.latched,
    welded: terminalDevices.switches.some(s => s.welded), ghost: carGrp.getObjectByName('terminalCamAssy') && (() => { let t = false; carGrp.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.opacity === .14)) t = true; }); return t; })()}), before);
  assert.deepEqual(r.restored, {floor: true, off: true, eye: true, idle: true, latched: false, welded: false, ghost: false}, `${kind}${dir} 원위치`);
  return r;
}
try {
  /* ── PC ── */
  {
    const {context, page, errors} = await open({width: 1280, height: 850}, false);
    const r = {};
    // ① 발광 진입: 하부 리미트 앞에서 보면 피트 스위치 버튼이 살아 있고 PartGlow 에 6개가 묶여 있다.
    await page.evaluate(() => { const s = TERMINAL_SWITCHES.find(x => x.name === 'DLS'); camera.position.set(FLS_PIVOT_X + 1.0, s.y + .4, FLS_Z + .9); controls.target.set(FLS_PIVOT_X, s.y, FLS_Z); controls.update(); });
    await page.waitForTimeout(600);
    r.entry = await page.evaluate(() => ({buttons: TERMINAL_SWITCHES.map(s => document.getElementById('terminal-demo-' + s.name)).filter(Boolean).length,
      dlsLive: !document.getElementById('terminal-demo-DLS').hidden, dflLive: !document.getElementById('terminal-demo-DFL').hidden, ulsLive: !document.getElementById('terminal-demo-ULS').hidden}));
    assert.deepEqual(r.entry, {buttons: 6, dlsLive: true, dflLive: true, ulsLive: false});
    // 버튼(발광 행동 핸들러) 클릭 = 그 스위치 종류의 시연 즉시 실행
    await page.evaluate(() => document.getElementById('terminal-demo-DLS').click());
    r.entryStart = await page.evaluate(() => ({active: TerminalDemo.active, kind: TerminalDemo.state.kind, side: TerminalDemo.state.side}));
    assert.deepEqual(r.entryStart, {active: true, kind: 'limit', side: -1});
    // ③ 일시정지 · 비상정지 중단: 고장 가정 해제·가까운 층 정지·시점 복귀
    await page.waitForFunction(() => TerminalDemo.state.stage === 'run');
    await page.waitForTimeout(700);
    // 공통 일시정지: 멈춘 동안 카가 움직이지 않고, 재생하면 이어서 달린다.
    await page.click('#demo-pause'); const y0 = await page.evaluate(() => carGrp.position.y);
    await page.waitForTimeout(1000); const y1 = await page.evaluate(() => carGrp.position.y);
    await page.click('#demo-pause'); await page.waitForTimeout(400); const y2 = await page.evaluate(() => carGrp.position.y);
    r.pause = {frozen: y0 === y1, resumed: Math.abs(y2 - y1) > .05}; assert.deepEqual(r.pause, {frozen: true, resumed: true});
    await page.click('#btn-estop');
    await page.waitForFunction(() => !TerminalDemo.active);
    r.cancel = await page.evaluate(() => ({estop, moving, welded: terminalDevices.switches.some(s => s.welded), latched: TerminalDemo.latched,
      off: Math.min(...FLOOR_Y.map(f => Math.abs(carGrp.position.y - f - S.CAR_H / 2)))}));
    assert.equal(r.cancel.estop, false); assert.equal(r.cancel.moving, false); assert.equal(r.cancel.welded, false); assert.ok(r.cancel.off < 1e-6);

    // ② 시연 3종
    const ev = (x, t) => x.events.find(e => e.type === t);
    r.slowdown = await demo(page, 'slowdown', -1, ['slowHit', 'done'], 'pc-slowdown-bottom');
    near(ev(r.slowdown, 'slowdown').overrun, -1.44, .03, '감속 스위치 개로 = 착상면 1.44m 앞'); assert.ok(ev(r.slowdown, 'slowdown').speed >= 59, '정격속도에서 감속 시작');
    near(ev(r.slowdown, 'level').overrun, 0, .001, '정상 착상'); assert.equal(r.slowdown.curFloor, 0);
    assert.ok(!r.slowdown.events.some(e => /limit|final/.test(e.type)), '감속 시연은 리미트·파이널 미동작');
    r.limit = await demo(page, 'limit', -1, ['limitHit', 'sameDir', 'limitDone'], 'pc-limit-bottom');
    near(ev(r.limit, 'limit').overrun, .159, .01, '리미트 개로 위치'); near(ev(r.limit, 'limitStop').overrun, .16, .015, '리미트 정지 위치');
    assert.equal(ev(r.limit, 'sameDirBlocked').blocked, true); assert.equal(ev(r.limit, 'reverseAllowed').allowed, true);
    assert.ok(ev(r.limit, 'limitReset'), '반대 방향 복귀 중 리미트 자동 복귀'); assert.ok(!ev(r.limit, 'final'), '리미트 시연은 파이널 미동작');
    r.finalTop = await demo(page, 'final', 1, ['welded', 'finalHit', 'manual', 'done'], 'pc-final-top');
    assert.ok(ev(r.finalTop, 'limitWelded'), '리미트 통과(융착)'); near(ev(r.finalTop, 'final').overrun, .339, .01, '파이널 개로 위치');
    assert.equal(ev(r.finalTop, 'sameDirBlocked').blocked, true); assert.equal(ev(r.finalTop, 'reverseBlocked').blocked, true, '파이널은 반대 방향도 차단');
    assert.ok(ev(r.finalTop, 'manualReset')); assert.equal(r.finalTop.latchedAfter, false); assert.equal(r.finalTop.welded, false); assert.equal(r.finalTop.curFloor, 3);
    r.limitTop = await demo(page, 'limit', 1, [], 'pc-limit-top');
    near(ev(r.limitTop, 'limit').overrun, .159, .01, '상부 리미트 개로 위치');
    r.finalBottom = await demo(page, 'final', -1, ['finalHit'], 'pc-final-bottom');
    near(ev(r.finalBottom, 'final').overrun, .339, .01, '하부 파이널 개로 위치');

    // 시연 직후 전체 리셋 없이 자동 호출이 바로 동작한다.
    r.autoAfter = await page.evaluate(() => new Promise(ok => { const to = curFloor === 2 ? 1 : 2; moveElevator(to); const m = moving;
      const t = setInterval(() => { if (!moving && !CarDoor.state.busy && curFloor === to) { clearInterval(t); clearTimeout(autoTimer); closeDoors(() => ok({started: m, arrived: true})); } }, 100); }));
    assert.deepEqual(r.autoAfter, {started: true, arrived: true});
    await page.waitForFunction(() => !doorOpen && !CarDoor.state.busy);
    // ④ 점검 운전 — 60fps 고정 델타로 직접 적분(헤드리스 FPS 영향 제거)
    r.ins = await page.evaluate(() => {
      const set = y => { const d = y - carGrp.position.y; carGrp.position.y = y; cwtGrp.position.y -= d; refreshRopes(); };
      const L = FLOOR_Y[0] + S.CAR_H / 2, o = [];
      setInspectionMode(true); set(FLOOR_Y[1] + S.CAR_H / 2);
      const drive = (dir, n = 4000) => {
        insStart(dir); gsap.ticker.remove(insTick);
        const speeds = [];
        for (let i = 0; i < n && insDir === dir; i++) { insTick(0, 1000 / 60); speeds.push([+(carGrp.position.y - L).toFixed(3), insSpeed]); }
        return speeds;
      };
      const down = drive(-1);
      const fast = down.filter(([y]) => y > 1.6).map(s => s[1]), slow = down.filter(([y]) => y < 1.2).map(s => s[1]);
      o.push({fast: Math.max(...fast), slow: Math.max(...slow), stopOverrun: +(L - carGrp.position.y).toFixed(3), msg: document.getElementById('v-dir')?.textContent});
      const yStop = carGrp.position.y;
      insStart(-1); o.push({sameDirBlocked: insDir === 0 && carGrp.position.y === yStop});
      // 반대 방향은 감속 스위치가 눌려 있어도 정상 점검 속도
      insStart(1); gsap.ticker.remove(insTick); for (let i = 0; i < 120; i++) insTick(0, 1000 / 60);
      o.push({reverseMoved: +(carGrp.position.y - yStop).toFixed(3), reverseSpeed: insSpeed, limitReclosed: !TerminalDemo.isOpen('limit', -1)}); insStop();
      // 리미트 접점 융착 → 파이널 래치
      terminalDevices.switches.find(s => s.name === 'DLS').welded = true;
      const down2 = drive(-1);
      o.push({finalOverrun: +(L - carGrp.position.y).toFixed(3), latched: TerminalDemo.latched});
      const yF = carGrp.position.y; insStart(1); o.push({reverseBlockedWhileLatched: insDir === 0 && carGrp.position.y === yF});
      // ⑤ 래치 중 자동 호출 차단
      setInspectionMode(false, {recover: false}); moveElevator(2); o.push({autoBlocked: !moving}); setInspectionMode(true);
      TerminalDemo.resetFinal(); terminalDevices.switches.find(s => s.name === 'DLS').welded = false; refreshTerminalDevices();
      insStart(-1); o.push({downStillBlocked: insDir === 0});
      insStart(1); gsap.ticker.remove(insTick); for (let i = 0; i < 200 && insDir === 1; i++) insTick(0, 1000 / 60); insStop();
      o.push({afterResetUp: +(carGrp.position.y - yF).toFixed(3)});
      TerminalDemo.clearFaults(); set(L); setInspectionMode(false, {recover: false});
      return o;
    });
    const [a, b, c, d, e, f, g, h] = r.ins;
    assert.equal(a.fast, 15); near(a.slow, 7.5, 1e-9, '감속 구간 점검 속도'); near(a.stopOverrun, .16, .01, 'INS 리미트 정지 위치');
    assert.equal(b.sameDirBlocked, true); assert.ok(c.reverseMoved > .45, '반대 방향 운전'); assert.equal(c.reverseSpeed, 15); assert.equal(c.limitReclosed, true);
    near(d.finalOverrun, .34, .01, 'INS 융착 시 파이널 정지'); assert.equal(d.latched, true); assert.equal(e.reverseBlockedWhileLatched, true);
    assert.equal(f.autoBlocked, true); assert.equal(g.downStillBlocked, true); assert.ok(h.afterResetUp > .4, '수동 복귀 후 반대 방향 이탈');
    assert.deepEqual(errors, []); r.errors = errors; result.pc = r; await context.close();
  }
  /* ── 390px 세로 ── */
  {
    const {context, page, errors} = await open({width: 390, height: 844}, true);
    const r = {};
    r.final = await demo(page, 'final', -1, ['slowHit', 'finalHit', 'manual'], 'mobile-final-bottom');
    assert.deepEqual(errors, []); r.errors = errors; result.mobile = {events: r.final.events}; await context.close();
  }
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ins: result.pc.ins, limit: result.pc.limit.events, final: result.pc.finalTop.events, mobile: result.mobile.events.map(e => e.type)}, null, 1));
} finally { await browser.close(); }
