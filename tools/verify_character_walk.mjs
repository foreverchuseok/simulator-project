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
// 바닥만 보이는 시점을 만든 뒤 실제 캔버스 포인터 바인딩으로 목적지를 선택한다.
const destination = async (x,y,z,view) => page.evaluate(([x,y,z,view])=>{
 const p=new THREE.Vector3(x,y,z);camera.position.set(...(view||[x,y+1,z+.2]));camera.lookAt(p);camera.updateMatrixWorld(true);
 const canvas=renderer.domElement,r=canvas.getBoundingClientRect(),args={pointerId:91,pointerType:'mouse',button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true};
 const capture=canvas.setPointerCapture;canvas.setPointerCapture=()=>{};
 try {canvas.dispatchEvent(new PointerEvent('pointerdown',args));canvas.dispatchEvent(new PointerEvent('pointerup',args));}
 finally {canvas.setPointerCapture=capture;}
 return scene.getObjectByName('characterDestination').visible;
},[x,y,z,view]);
const finishRoute=()=>page.evaluate(()=>{let t=performance.now()/1000;CharacterWalk.update(t);for(let i=0;i<1200&&scene.getObjectByName('characterDestination').visible;i++)CharacterWalk.update(t+=.04);return !scene.getObjectByName('characterDestination').visible;});
try {
  const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(process.env.SIMULATOR_URL || 'http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof CharacterWalk !== 'undefined' && CharacterWalk.actors.length === 0 &&
    CarDoor.state?.ready && hatchDoors.every(h => h.interlock?.ready) && document.getElementById('loading').classList.contains('hide'));
  // 모바일은 체험 시작·시작 위치·종료가 하단 바(js/mobile-hud.js)에 있다.
  const MOBILE_IDS = { '#walk-toggle': '#m-walk', '#walk-home': '#m-walk-home', '#walk-exit': '#m-walk-exit' };
  const tap = async selector => mobile ? page.locator(MOBILE_IDS[selector] || selector).tap() : page.locator(selector).click();
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
    const point=await page.evaluate(()=>{camera.updateMatrixWorld(true);const p=CharacterWalk.active.root.position.clone();p.x+=.45;p.z-=.3;p.y+=.005;p.project(camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>scene.getObjectByName('characterDestination').visible);
    await page.waitForFunction(()=>!scene.getObjectByName('characterDestination').visible);
    check('mouse ground click walks to destination',(await state()).p[0]>.35);await tap('#walk-home');
    await page.keyboard.down('d'); await page.waitForTimeout(650); await page.keyboard.up('d');
    check('WASD moves at walking speed', (await state()).p[0] > before.p[0] + .3);
    await page.keyboard.down('w'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const stopped = await state(); await page.waitForTimeout(180);
    check('blur clears held input', Math.abs((await state()).p[2] - stopped.p[2]) < .001);
    await page.keyboard.up('w');
  } else {
    check('mobile directional pad removed', await page.locator('#walk-stick').count() === 0);
    const point=await page.evaluate(()=>{camera.updateMatrixWorld(true);const a=CharacterWalk.active,p=a.root.position.clone();p.x+=.45;p.z-=.3;p.y+=.005;p.project(camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    await page.touchscreen.tap(point.x,point.y);
    await page.waitForFunction(()=>scene.getObjectByName('characterDestination').visible);
    await page.waitForFunction(()=>!scene.getObjectByName('characterDestination').visible);
    check('ground tap walks to destination', (await state()).p[0]>before.p[0]+.35);
    const jitterPoint=await page.evaluate(()=>{camera.updateMatrixWorld(true);const p=CharacterWalk.active.root.position.clone();p.x+=.35;p.z-=.25;p.y+=.005;p.project(camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jitterPoint.x-4,y:jitterPoint.y,id:1}]});
    await page.waitForTimeout(620);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:jitterPoint.x+4,y:jitterPoint.y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>scene.getObjectByName('characterDestination').visible);
    await page.waitForFunction(()=>!scene.getObjectByName('characterDestination').visible);
    check('slow finger tap with 8px drift still walks',true);
    const stopped = await state();
    const c0 = await page.evaluate(() => camera.position.toArray());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width/2, y: 330, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width/2-50, y: 360, id: 1 }] });
    await page.waitForTimeout(200);
    check('drag rotates view without walking', Math.abs((await state()).p[0]-stopped.p[0])<.001 &&
      await page.evaluate(c => Math.abs(camera.position.z - c[2]) > .1, c0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(150);
    check('touch cancel creates no destination', !await page.evaluate(()=>scene.getObjectByName('characterDestination').visible));
  }
  // Reset yaw and location through the user-facing home action.
  await tap('#walk-home');
  const riser=await page.evaluate(()=>{const l=lobbyApproachLayout(),i=APPROACH_STEP_COUNT-2,z=l.lobbyFrontZ+i*APPROACH_STEP_TREAD,high=l.slabY-(i-1)*l.deltaH/APPROACH_STEP_COUNT;return{x:.4,y:high-l.deltaH/APPROACH_STEP_COUNT/2,z,view:[.4,high-.04,z+.7]};});
  check('tap on vertical stair front selects tread',await destination(riser.x,riser.y,riser.z,riser.view));await finishRoute();
  check('stair-front tap walks onto stairs',(await state()).zone==='stairs');await tap('#walk-home');
  const landingY=await page.evaluate(()=>FLOOR_Y[0]);
  check('tap routes from garden up stairs', await destination(0,landingY,2.5));await finishRoute();
  check('tap arrives on landing without teleport', (await state()).zone==='landing'&&Math.abs((await state()).p[2]-2.5)<.04);
  const floorY=await page.evaluate(()=>carGrp.position.y+carGrp.getObjectByName('carPanelAssembly').userData.floorY);
  check('closed door rejects tap into car', !await destination(0,floorY,.15));
  await tap('#walk-call');
  await page.waitForFunction(()=>currentState===ELEVATOR_STATE.DOOR_OPEN&&!CarDoor.state.busy);
  check('open doorway accepts tap into car',await destination(0,floorY,.15));await finishRoute();
  check('tap walks through open doorway', (await state()).zone==='car');
  await tap('#walk-home');await page.evaluate(()=>closeDoors());await page.waitForFunction(()=>currentState===ELEVATOR_STATE.IDLE);
  const rampX=await page.evaluate(()=>{const l=lobbyApproachLayout();return(l.rampX0+l.rampX1)/2;});
  check('tap plans route through ramp',await destination(rampX,landingY,2.5));await finishRoute();check('tap ramp route arrives on landing',(await state()).zone==='landing');
  await tap('#walk-home');
  check('tap plans route around pond',await destination(-14,.055,17));await finishRoute();
  check('tap route avoids pond and reaches far side',Math.hypot((await state()).p[0]+14,(await state()).p[2]-17)<.05);
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
