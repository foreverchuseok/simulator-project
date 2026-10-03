// node tools/verify_demo_pause.mjs — 모든 시연 공통 일시정지(js/demo-pause.js) 검사. SIM_URL 로 서버 지정(기본 Live Server 5500).
// 각 시연을 새로 불러온 페이지에서 시작 → 「❚❚ 일시정지」 표시 → 누르면 카·균형추·GSAP 시간이 멈춤 → 재생하면 다시 진행.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url = process.env.SIM_URL || 'http://127.0.0.1:5500/index.html';
const out = '.shot-demo-pause'; fs.mkdirSync(out, {recursive: true});
const DEMOS = [
  ['ucm', "UCMDemo.start(document.getElementById('btn-ucm'))", 3500],
  ['ascent', "AscentDemo.start('normal')", 3000],
  ['brake', "BrakeDemo.start('dual')", 3000],
  ['ard', 'ARDDemo.start()', 3000],
  ['manual', 'ManualRescueDemo.start()', 3000],
  ['interlock', 'InterlockDemo.start(1)', 1500],
  ['relay', 'RelayRopeDemo.start(1)', 1500],
  ['governor', "startOverspeedFault(document.getElementById('btn-overspeed'))", 2500]
];
const browser = await chromium.launch({args: ['--enable-gpu']}), report = {};
try {
  for (const [key, startJs, wait] of DEMOS) {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
    await page.goto(url, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => typeof DemoPause !== 'undefined' && govHandles()?.ready && hatchDoors.every(h => h.interlock?.ready) && CarDoor.state?.ready
      && getComputedStyle(document.getElementById('loading')).opacity === '0', null, {timeout: 90000});
    await page.evaluate(js => { eval(js); }, startJs);
    await page.waitForTimeout(wait);
    assert.ok(await page.evaluate(() => !document.getElementById('demo-pause').hidden && DemoPause.demo), `${key}: pause button shown`);
    await page.click('#demo-pause');
    const snap = () => page.evaluate(() => ({ car: carGrp.position.y, cwt: cwtGrp.position.y, t: gsap.globalTimeline.time(), paused: DemoPause.paused }));
    const a = await snap(); await page.waitForTimeout(900); const b = await snap();
    assert.ok(a.paused && b.paused && a.car === b.car && a.cwt === b.cwt && a.t === b.t, `${key}: frozen ${JSON.stringify([a, b])}`);
    await page.screenshot({path: `${out}/${key}-paused.png`});
    await page.click('#demo-pause'); await page.waitForTimeout(900);
    const c = await snap();
    assert.ok(!c.paused && c.t > b.t, `${key}: resumes ${JSON.stringify(c)}`);
    // 비상정지로 해제되는지(조속기 과속 중에는 비상정지 버튼이 막혀 있으므로 제외)
    // 수동 구출처럼 시연 절차가 이미 정지 스위치를 켜 둔 경우는 「새로 누른」 비상정지가 아니므로 제외.
    if (key !== 'governor' && !(await page.evaluate(() => estop))) {
      await page.click('#demo-pause'); await page.evaluate(() => { estop = true; }); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => DemoPause.paused), false, `${key}: estop releases pause`);
    }
    report[key] = { demo: await page.evaluate(() => DemoPause.demo), a, b, c, errors };
    assert.deepEqual(errors, [], `${key}: page errors`);
    console.log(key, 'ok');
    await page.close();
  }
  // 자체 일시정지가 있는 완충기·문 이탈방지 시연에는 공통 버튼이 겹쳐 뜨지 않는다.
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => typeof DemoPause !== 'undefined' && bufferGrp && carGrp.getObjectByName('carBufferStrike') && getComputedStyle(document.getElementById('loading')).opacity === '0', null, {timeout: 90000});
  await page.evaluate(() => BufferDemo.start('car')); await page.waitForTimeout(2500);
  assert.ok(await page.evaluate(() => document.getElementById('demo-pause').hidden && !document.getElementById('buffer-demo-pause').hidden), 'buffer keeps its own pause only');
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log('PASS: common pause on 8 demos (freeze/resume/estop release), no duplicate on buffer demo.');
} finally { await browser.close(); }
