// 개문발차(UCM) 시연 검증: 로프브레이크 정상 → 에이프런 2/3 이전 정지·턱 파지·승객 전도·복귀,
// 미작동/미설치 → 계속 상승·사망사고 카드·복귀. 단계별 스크린샷은 .shot-ucm/.
// 사용: Live Server(5500) 실행 후 node tools/verify_ucm.mjs [normal|fail|none ...]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const width = Number(process.env.UCM_WIDTH || 1280);
const out = width === 1280 ? '.shot-ucm' : `.shot-ucm-${width}`;
fs.mkdirSync(out, { recursive: true });
const URL = process.env.SIMULATOR_URL || 'http://127.0.0.1:5500/index.html';
const modes = process.argv.slice(2).filter(a => ['normal', 'fail', 'none'].includes(a));
const ready = () => typeof UCMDemo !== 'undefined' && CarDoor.state?.ready && hatchDoors.every(h => h.interlock?.ready)
  && scene.getObjectByName('RopeBrakeInstallation')?.userData.ready && document.getElementById('loading').classList.contains('hide');
const browser = await chromium.launch({ args: ['--enable-gpu'] });
const errors = [];
const results = {};
try {
  const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch:width < 600, isMobile:width < 600 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    gsap.ticker.lagSmoothing(0); document.querySelectorAll('#hint').forEach(e => e.style.visibility = 'hidden');
    window.ucmAudio = [];
    for (const key of ['ucmBrakeFailure','ropeBrakeBang']) {
      const original = MACH[key];
      MACH[key] = (...args) => {
        const u = UCMDemo.state, j = u.jaws;
        ucmAudio.push({key,mode:u.mode,rise:u.rise,v:u.v,view:u.view,bang:u.bang,
          up:j?.up.position.y-j?.up0,lo:j?.lo.position.y-j?.lo0});
        return original(...args);
      };
    }
  });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const until = (fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

  for (const mode of modes.length ? modes : ['normal', 'fail']) {
    const floorY = await page.evaluate(() => carGrp.position.y);
    await page.evaluate(() => {
      const body=scene.getObjectByName('RopeBrake');
      controls.enableDamping=false;controls.target.copy(body.getWorldPosition(new THREE.Vector3()));
      camera.position.copy(body.localToWorld(new THREE.Vector3(.8,.4,-1.1)));controls.update();
    });
    const click = selector => page.locator(selector)[width < 600 ? 'tap' : 'click']();
    await click('#rope-brake-action');
    await click(`#rope-brake-panel [data-value="${mode}"]`);
    await click('#btn-ucm');
    // 매 프레임: 카 바닥 아래 에이프런 높이 구간(바닥 −0.75m ~ 바닥)의 캐릭터 정점이 에이프런 면(CAR_FRONT_Z)을 넘는 최대량
    await page.evaluate(() => {
      const v = new THREE.Vector3(), mon = window.__ucmMon = { pen: 0, gap: Infinity, floorGap: Infinity, at: '' };
      mon.fn = () => {
        const c = UCMDemo.character; if (!c.visible) return;
        const top = carGrp.position.y - S.CAR_H / 2, bottom = top - 0.75;
        if (top - FLOOR_Y[UCMDemo.state.f] < 0.02) return;       // 카가 아직 착상면이면 에이프런이 승장 바닥 아래
        c.updateMatrixWorld(true);
        c.traverse(o => {
          if (!o.isMesh || !o.visible) return;
          for (let x = o; x && x !== c; x = x.parent) if (x.userData.ucmDecal) return;
          const a = o.geometry.attributes.position;
          for (let i = 0; i < a.count; i++) {
            v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
            if (v.z < CAR_FRONT_Z && v.y >= top - 0.001) mon.floorGap = Math.min(mon.floorGap, v.y - top); // 카 바닥 위 정점
            if (v.y <= bottom || v.y >= top) continue;
            const d = CAR_FRONT_Z - v.z;
            if (d > mon.pen) { mon.pen = d; mon.at = UCMDemo.state.stage; }
            mon.gap = Math.min(mon.gap, -d);
          }
        });
      };
      gsap.ticker.add(mon.fn);
    });
    await until(() => UCMDemo.state.stage === 'boarding' && UCMDemo.character.visible);
    await page.waitForTimeout(2200); await shot(`${mode}-1-boarding`);
    await until(() => UCMDemo.state.stage === 'moving');
    await shot(`${mode}-1b-failure`);
    // 승장 화면: 카가 올라가며 승객이 걸려 넘어지고, 상체가 올라간 카 바닥을 덮친 뒤 기계실로 간다.
    await until(() => UCMDemo.state.landed || UCMDemo.state.view !== 'landing');
    await page.waitForTimeout(300); await shot(`${mode}-2-departure`);
    await until(() => UCMDemo.state.view === 'machine-room');
    const sw = await page.evaluate(() => ({ rise: UCMDemo.state.riseAtSwitch, startled: UCMDemo.state.startled, landed: UCMDemo.state.landed, theta: UCMDemo.state.theta, trigger: UCMDemo.motion.trigger }));
    results[mode + 'Landing'] = sw;
    assert.ok(sw.startled && sw.landed && sw.theta > 0.8 && sw.rise >= 0.15 && sw.rise < sw.trigger,
      `passenger falls onto the rising car floor before the machine-room view: ${JSON.stringify(sw)}`);
    if (mode === 'normal') {
      await page.waitForTimeout(660); if (!(await page.evaluate(() => UCMDemo.state.bang))) await shot(`${mode}-3a-rope-moving`);
      await until(() => UCMDemo.state.bang);
      await page.waitForTimeout(40); await shot(`${mode}-3-bang`);
      assert.equal(await page.evaluate(() => UCMDemo.state.bangView), 'machine-room', 'grip is seen on the machine-room view');
      await until(() => UCMDemo.state.stage === 'stumble');
      await page.waitForTimeout(200); await shot(`${mode}-3b-stumble`);
      await until(() => UCMDemo.state.stage === 'done');
      await page.waitForTimeout(900); await shot(`${mode}-4-result`);
      const r = await page.evaluate(() => {
        const up = scene.getObjectByName('BrakeUpperJaw'), lo = scene.getObjectByName('BrakeLowerJaw'), j = UCMDemo.state.jaws;
        return { rise: UCMDemo.state.rise, upperTravel: up.position.y - j.up0, lowerTravel: lo.position.y - j.lo0,
          estop, moving, doorOpen, btn: document.getElementById('btn-ucm').textContent, stars: UCMDemo.character.visible };
      });
      results[mode] = r;
      assert.ok(r.rise > 0.28 && r.rise < 0.75 * 2 / 3, `stops before 2/3 apron: ${r.rise}`);
      assert.ok(Math.abs(r.upperTravel + 0.013) < 1e-6 && Math.abs(r.lowerTravel - 0.009) < 1e-6, 'jaws grip rope');
      assert.equal(r.estop, true); assert.equal(r.doorOpen, true); assert.equal(r.btn, 'RST');
      assert.equal(await page.locator('#ucm-summary').isVisible(), true);
      assert.equal(await page.locator('#ucm-summary img').count(), 3);
      assert.equal(await page.locator('#ucm-summary img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)), true);
      assert.equal(await page.evaluate(() => ['ucm-exit','ucm-summary'].every(id => {
        const b=document.getElementById(id).getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;
      })), true, 'summary and exit remain inside the viewport');
    } else {
      await page.waitForTimeout(1500); await shot(`${mode}-3-machine-room`);
      await until(() => UCMDemo.state.returned);
      await page.waitForTimeout(450); await shot(`${mode}-3b-before-card`);
      await until(() => UCMDemo.state.stage === 'done');
      await page.waitForTimeout(1600); await shot(`${mode}-4-fatal`);
      const r = await page.evaluate(() => ({ rise: UCMDemo.state.rise, overlay: getComputedStyle(document.getElementById('ucm-overlay')).opacity,
        brakeVisible: scene.getObjectByName('RopeBrakeInstallation').visible, jawUp: scene.getObjectByName('BrakeUpperJaw').position.y - UCMDemo.state.jaws.up0 }));
      results[mode] = r;
      assert.ok(r.rise > 0.75, `car keeps rising past apron: ${r.rise}`);
      assert.equal(r.overlay, '1');
      assert.equal(r.brakeVisible, mode !== 'none');
      assert.ok(Math.abs(r.jawUp) < 1e-9, 'jaws stay open');
    }
    const mon = await page.evaluate(() => { gsap.ticker.remove(window.__ucmMon.fn); const { pen, gap, floorGap, at } = window.__ucmMon; return { pen, gap, floorGap, at }; });
    results[mode + 'Apron'] = mon;
    assert.ok(mon.pen < 0.001, `character never passes through the apron: ${JSON.stringify(mon)}`);
    assert.ok(mon.floorGap >= -0.001 && mon.floorGap < 0.015, `upper body rests on the car floor without sinking: ${JSON.stringify(mon)}`);
    // 복귀
    await page.locator('#ucm-exit')[width < 600 ? 'tap' : 'click']();
    await until(() => !UCMDemo.state.active && !moving && !doorOpen && !estop, null, 60000);
    const back = await page.evaluate(() => ({ y: carGrp.position.y, btn: document.getElementById('btn-ucm').textContent,
      jawUp: scene.getObjectByName('BrakeUpperJaw').position.y - UCMDemo.state.jaws.up0, brake: scene.getObjectByName('RopeBrakeInstallation').visible,
      charVisible: UCMDemo.character.visible, overlay: getComputedStyle(document.getElementById('ucm-overlay') || document.body).opacity }));
    results[mode + 'Reset'] = back;
    assert.ok(Math.abs(back.y - floorY) < 1e-6, 'car back at floor level');
    assert.equal(back.btn, 'UCM'); assert.ok(Math.abs(back.jawUp) < 1e-9); assert.equal(back.brake, true); assert.equal(back.charVisible, false);
    assert.equal(await page.locator('#ucm-exit').isVisible(), false);
    assert.equal(await page.evaluate(() => scene.getObjectByName('UCMGripDust').visible), false);
    await page.waitForTimeout(1500);
  }
  // 복귀 후 정상 운행 회귀
  await page.evaluate(() => moveElevator(1));
  await until(() => moving, null, 10000);
  await until(() => !moving && curFloor === 1, null, 60000);
  assert.deepEqual(errors, []);
  const audio = await page.evaluate(() => ucmAudio);
  for (const event of audio.filter(e => e.key === 'ropeBrakeBang')) {
    assert.equal(event.mode, 'normal'); assert.equal(event.view, 'machine-room'); assert.equal(event.bang, true);
    assert.ok(Math.abs(event.up + .013) < 1e-6 && Math.abs(event.lo - .009) < 1e-6, 'impact sound starts at jaw contact');
    assert.ok(event.v > 0, 'braking begins after contact');
  }
  assert.equal(audio.filter(e => e.key === 'ucmBrakeFailure').length, (modes.length ? modes : ['normal','fail']).length);
  assert.equal(audio.filter(e => e.key === 'ropeBrakeBang').length, (modes.length ? modes : ['normal','fail']).filter(m => m === 'normal').length);
  results.audio = audio;
  if (width === 320) {
    await page.waitForFunction(() => !CarDoor.state.busy);
    await page.evaluate(() => { document.getElementById('ucm-brake').value='normal'; UCMDemo.start(document.getElementById('btn-ucm')); });
    await until(() => UCMDemo.state.stage === 'moving');
    await page.locator('#btn-estop').tap();
    await until(() => !UCMDemo.state.active && !moving && !estop && !doorOpen);
    assert.equal(await page.evaluate(() => CarDoor.secured()), true);
    results.stopButton = true;
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({ results, errors }, null, 1));
} finally {
  await browser.close();
}
