import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const out = '.shot-seunggom-walk'; fs.mkdirSync(out, { recursive: true });
const mobile = process.argv.includes('--mobile');
const width = mobile ? (process.argv.includes('--narrow') ? 320 : 390) : 1280;
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11'] });
const errors = [], results = [];
const context = await browser.newContext({ viewport: { width, height: 850 }, hasTouch: mobile, isMobile: mobile });
const page = await context.newPage(); page.setDefaultTimeout(90000);
page.on('pageerror', e => errors.push(e.stack));
const check = (name, result) => { assert.ok(result, name); results.push(name); console.log('PASS', name); };
const state = () => page.evaluate(() => {
  const a = CharacterWalk.active;
  return { p: a.root.position.toArray(), zone: a.zone, floor: a.floor, door: currentState, occupied: CharacterWalk.doorwayOccupied() };
});
// Deterministic controller updates use real keyboard bindings, swept movement and support tests.
// Browser keyboard/touch and simultaneous multi-touch are checked separately below.
const walk = async (x, z) => page.evaluate(([x, z]) => {
  const a = CharacterWalk.active, start = a.root.position.clone();
  let t = performance.now() / 1000; CharacterWalk.update(t);
  for (const [axis, goal, posKey, negKey] of [['x', x, 'KeyD', 'KeyA'], ['z', z, 'KeyS', 'KeyW']]) {
    const delta = goal - a.root.position[axis], code = delta > 0 ? posKey : negKey;
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    const count = Math.ceil(Math.abs(delta) / .017);
    for (let i = 0; i < count; i++) CharacterWalk.update(t += .02);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }
  return { from: start.toArray(), to: a.root.position.toArray(), zone: a.zone };
}, [x, z]);
try {
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(process.env.SIMULATOR_URL || 'http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof CharacterWalk !== 'undefined' && CharacterWalk.actors.length === 0 &&
    CarDoor.state?.ready && hatchDoors.every(h => h.interlock?.ready) && document.getElementById('loading').classList.contains('hide'));
  const tap = async selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
  check('no walker allocated before entering', await page.evaluate(() => !scene.getObjectByName('SeunggomWalker')));
  check('garden animals restored to static batch', await page.evaluate(() => !!scene.getObjectByName('meadowDecor') && !scene.getObjectByName('meadowAnimal_0')));
  await page.evaluate(() => { window.roofHome={p:Mascot.root.position.toArray(),visible:Mascot.root.visible}; });
  await tap('#walk-toggle');
  check('one mascot starts at stair entrance', await page.evaluate(() => CharacterWalk.actors.length===1 &&
    CharacterWalk.active.label==='\uC2B9\uACF0\uC774' && CharacterWalk.active.root.position.x===0 &&
    Math.abs(CharacterWalk.active.root.position.z-(lobbyApproachLayout().lobbyFrontZ+APPROACH_STEP_COUNT*APPROACH_STEP_TREAD+1))<.001));
  check('roof mascot hidden during experience', await page.evaluate(() => !Mascot.root.visible));
  await page.screenshot({path:`${out}/${width}-start.png`});
  const before = await state();
  if (!mobile) {
    await page.keyboard.down('d'); await page.waitForTimeout(650); await page.keyboard.up('d');
    check('WASD moves at walking speed', (await state()).p[0] > before.p[0] + .3);
    await page.keyboard.down('w'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const stopped = await state(); await page.waitForTimeout(180);
    check('blur clears held input', Math.abs((await state()).p[2] - stopped.p[2]) < .001);
    await page.keyboard.up('w');
  } else {
    const pad = await page.locator('#walk-stick').boundingBox(); check('mobile joystick visible', pad?.width > 80);
    const x = pad.x + pad.width / 2, y = pad.y + pad.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 30, y, id: 1 }] });
    await page.waitForTimeout(500);
    const c0 = await page.evaluate(() => camera.position.toArray());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 30, y, id: 1 }, { x: width - 45, y: 430, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 30, y, id: 1 }, { x: width - 95, y: 460, id: 2 }] });
    await page.waitForTimeout(200);
    check('joystick plus camera multi-touch', (await state()).p[0] > before.p[0] + .25 &&
      await page.evaluate(c => Math.abs(camera.position.z - c[2]) > .1, c0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const stopped = await state(); await page.waitForTimeout(150);
    check('touch cancel stops movement', Math.abs((await state()).p[0] - stopped.p[0]) < .001);
  }
  // Reset yaw and location through the user-facing home action.
  await tap('#walk-home');
  await page.screenshot({ path: `${out}/${width}-garden.png` });
  await walk(0, 2.5);
  check('stairs reach first landing at correct height', (await state()).zone === 'landing' && Math.abs((await state()).p[1] - 1.76) < .01);
  await page.screenshot({ path: `${out}/${width}-landing.png` });
  await walk(0, 0);
  check('closed door blocks entry', (await state()).p[2] > 1.7 && (await state()).zone === 'landing');
  await tap('#walk-call'); await page.waitForFunction(() => currentState === ELEVATOR_STATE.DOOR_OPEN);
  await walk(0, 1.35);
  check('doorway occupied', (await state()).occupied);
  await page.evaluate(() => closeDoors()); await page.waitForTimeout(450);
  check('door cannot close on character', (await state()).door === 'DOOR_OPEN' && !await page.evaluate(() => moving));
  await walk(0, .15);
  check('boards cabin', (await state()).zone === 'car' && !(await state()).occupied);
  await page.screenshot({ path: `${out}/${width}-cabin.png` });
  await page.evaluate(() => closeDoors()); await page.waitForFunction(() => currentState === ELEVATOR_STATE.IDLE);
  await walk(0, 2.5); check('closed cabin door blocks exit', (await state()).zone === 'car' && (await state()).p[2] < .8);
  await walk(0, .15);
  for (const f of [1, 2, 3]) {
    await tap(`#walk-floors button:nth-child(${f + 1})`);
    await page.waitForFunction(() => moving);
    await walk(3, 3);
    check(`moving cabin contains character ${f + 1}`, (await state()).zone === 'car' && (await state()).p[0] < 1 && (await state()).p[2] < .8);
    await walk(0, .15);
    check(`rides to floor ${f + 1}`, await page.evaluate(() => Math.abs(CharacterWalk.active.root.position.y -
      (carGrp.position.y + carGrp.getObjectByName('carPanelAssembly').userData.floorY)) < .03));
    await page.waitForFunction(f => curFloor === f && currentState === ELEVATOR_STATE.DOOR_OPEN, f);
    await walk(0, 2.5); check(`exits at floor ${f + 1}`, (await state()).zone === 'landing' && (await state()).floor === f);
    await walk(9, 10);
    const edge = await state();
    check(`floor ${f + 1} prevents side/front fall`, edge.p[0] < 1.7 && edge.p[2] < 3.3 && Math.abs(edge.p[1] - await page.evaluate(f => FLOOR_Y[f], f)) < .01);
    if (f === 3) await page.screenshot({ path: `${out}/${width}-upper-landing.png` });
    await walk(0, 2.5); await tap('#walk-call'); await page.waitForFunction(() => currentState === ELEVATOR_STATE.DOOR_OPEN);
    await walk(0, .15);
  }
  await page.evaluate(() => PassengerControls.request(0));
  await page.waitForFunction(() => curFloor === 0 && currentState === ELEVATOR_STATE.DOOR_OPEN);
  await walk(0, 2.5); await walk(2.3, 2.5); await walk(2.3, 10);
  check('ramp descends to ground', (await state()).zone === 'ground' && Math.abs((await state()).p[1] - .055) < .001);
  await walk(2.3, 2.5); check('ramp ascends to landing', (await state()).zone === 'landing');
  await walk(0, 2.5); await walk(0, 10); check('stairs descend to ground', (await state()).zone === 'ground');
  await walk(0, 40); check('garden boundary prevents escape', (await state()).p[2] < 23);
  await tap('#walk-home'); await walk(-15, 5.2); await walk(-15, 13);
  check('pond blocks entry', (await state()).p[2] < 9.7);
  await tap('#walk-exit');
  check('roof returns and walker hides on exit', await page.evaluate(() => Mascot.root.visible===roofHome.visible && !CharacterWalk.actors[0].root.visible && JSON.stringify(Mascot.root.position.toArray())===JSON.stringify(roofHome.p)));
  check('exit restores orbit controls', await page.evaluate(() => !CharacterWalk.active && controls.enableRotate && controls.enableZoom && controls.enablePan));
  await page.evaluate(() => { openDoors(); }); await page.waitForFunction(() => currentState === ELEVATOR_STATE.DOOR_OPEN);
  await page.evaluate(() => closeDoors()); await page.waitForFunction(() => currentState === ELEVATOR_STATE.IDLE);
  check('normal door operation after exit', true);
  await page.evaluate(() => CharacterWalk.start());
  await page.evaluate(() => moveCam(18, 10, 21, 0, 6, 0));
  check('overview camera exits character mode', await page.evaluate(() => !CharacterWalk.active));
  await page.evaluate(() => {window.walkerId=CharacterWalk.actors[0].root.id;CharacterWalk.start();Mascot.beginInspection();});
  check('inspection hands off without duplicating mascot', await page.evaluate(() => !CharacterWalk.active && Mascot.inspecting && Mascot.root.visible && !CharacterWalk.actors[0].root.visible));
  await page.evaluate(() => {Mascot.endInspection();CharacterWalk.start();});
  check('reentry reuses single walker and resets spawn', await page.evaluate(() => CharacterWalk.actors.length===1 && CharacterWalk.active.root.id===walkerId && CharacterWalk.active.root.position.equals(CharacterWalk.active.home)));
  await page.evaluate(() => {Mascot.setVisible(false);CharacterWalk.exit();});
  check('roof hidden preference survives experience', await page.evaluate(() => !Mascot.isVisible()));
  await page.evaluate(() => {CharacterWalk.start();Mascot.setVisible(true);});
  check('roof toggle does not duplicate active mascot', await page.evaluate(() => !Mascot.root.visible && Mascot.isVisible()));
  await page.evaluate(() => CharacterWalk.exit());
  check('roof visible preference restored on exit', await page.evaluate(() => Mascot.root.visible));
  check('no horizontal mobile overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('no browser errors', errors.length === 0);
  fs.writeFileSync(`${out}/${width}-results.json`, JSON.stringify({ results, errors }, null, 2));
} catch(e) {
  await page.screenshot({ path: `${out}/${width}-failure.png` }).catch(() => {});
  console.error('STATE', await state().catch(() => null), errors); throw e;
} finally { await browser.close(); }
