/* 승장 인터록 Keeper(사각 턱) ↔ Hook(네모 포켓) 체결 검증 스크린샷.
   사용: node tools/shot_interlock.mjs [포트] [층인덱스]
   전제: 프로젝트 루트에서 정적 서버 (python -m http.server 8777). */
import { chromium } from 'playwright';

const PORT = process.argv[2] || '8777';
const FI   = Number(process.argv[3] || 1);
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const OUT  = '.shot-interlock';

const SHOTS = [
  { name: 'latch_front',  d: [0.000, 0.006, -0.055] }, // 승강로 정면 초근접
  { name: 'latch_up',     d: [0.010, 0.038, -0.045] }, // 위에서 — ★네모 포켓과 도킹된 사각 턱
  { name: 'latch_plusX',  d: [0.055, 0.012, -0.040] }, // 개방측(+X, 화면 왼쪽)에서 — 4.5mm 여유
  { name: 'latch_minusX', d: [-0.050, 0.014, -0.040] },// 착석측(-X)에서 — Z 단차 확인
  { name: 'latch_far',    d: [0.16, 0.11, -0.34] }     // 인터록 전체
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto(`${BASE}?doorcam=1`, { waitUntil: 'networkidle' });
await page.evaluate((fi) => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  document.body.querySelectorAll('div').forEach(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') e.style.display = 'none';
  });
  camera.near = 0.003; camera.updateProjectionMatrix();
  controls.minDistance = 0.005;
  renderer.toneMappingExposure = 0.60;   // 근접에서 하얗게 날아가는 것 방지
  const wp = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
  let lip = null;
  hatchDoors[fi].right.traverse(x => { if (!lip && x.name === 'hallLatchKeeperLip') lip = x; });
  const lipY = wp(lip).y;
  let best = 1e9;
  window.__T = wp(lip);
  scene.traverse(x => {
    if (x.name !== 'hallLatchPocket') return;
    const v = wp(x); const d = Math.abs(v.y - lipY);
    if (d < best) { best = d; window.__T = v; }
  });
  window.__aim = (dx, dy, dz) => {
    camera.position.set(window.__T.x + dx, window.__T.y + dy, window.__T.z + dz);
    controls.target.copy(window.__T);
    controls.update();
  };
}, FI);

for (const s of SHOTS) {
  await page.evaluate(([x, y, z]) => window.__aim(x, y, z), s.d);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log('saved', s.name);
}

/* 해정(도어 개방) 상태 — 턱이 네모 창 위로 완전히 빠졌는지 */
await page.evaluate((fi) => {
  hatchDoors[fi].hook.rotation.z = -hatchDoors[fi].latch.liftRad;
  scene.updateMatrixWorld(true);
}, FI);
for (const s of [SHOTS[0], SHOTS[1], SHOTS[2]]) {
  await page.evaluate(([x, y, z]) => window.__aim(x, y, z), s.d);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}_open.png` });
  console.log('saved', s.name + '_open');
}

await browser.close();
