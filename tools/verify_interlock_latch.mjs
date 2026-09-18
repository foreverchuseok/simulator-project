/* 승장 인터록 래치 수치 검증 — Keeper 사각 턱이 Hook 네모 포켓에 실제로 물렸는지.
   사용: node tools/verify_interlock_latch.mjs [포트] [층인덱스]
   전제: 정적 서버 (python -m http.server 8777).

   ★ Box3.setFromObject 는 회전한 메시의 AABB 를 다시 감싸므로 수 mm 씩 부풀어난다.
     그래서 걸림 깊이는 마커 노드(hallLatchPocket / hallLatchKeeperLip)의
     월드 좌표로 잰다. */
import { chromium } from 'playwright';

const PORT = process.argv[2] || '8777';
const FI   = Number(process.argv[3] || 1);
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await page.goto(`${BASE}?doorcam=1`, { waitUntil: 'networkidle' });
/* networkidle 은 GLB 부착까지 기다려 주지 않는다 — 마커가 없어 죽는 경합이 났다. */
await page.waitForFunction(fi => hatchDoors?.[fi]?.interlock?.ready === true, FI, { timeout: 30000 });

const data = await page.evaluate((fi) => {
  const h = hatchDoors[fi];
  const find = (root, n) => { let o = null; root.traverse(x => { if (!o && x.name === n) o = x; }); return o; };
  const wp = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray(); };
  /* 걸쇠(고정측)는 헤더 그룹에, Keeper(문측)는 우측 행거판에 있다.
     층마다 같은 이름이 있으므로 Keeper 턱과 Y 가 가장 가까운 걸쇠를 고른다. */
  const lip = find(h.right, 'hallLatchKeeperLip');
  const lipY = wp(lip)[1];
  let pocket = null, bar = null, best = 1e9;
  scene.traverse(x => {
    if (x.name !== 'hallLatchPocket') return;
    const d = Math.abs(wp(x)[1] - lipY);
    if (d < best) { best = d; pocket = x; }
  });
  scene.traverse(x => {
    if (x.name === 'hallLatchBar' && !bar) {
      const d = Math.abs(wp(x)[1] - lipY);
      if (d < 0.10) bar = x;
    }
  });

  h.hook.rotation.z = 0; scene.updateMatrixWorld(true);
  const pClosed = wp(pocket), lClosed = wp(lip);
  h.hook.rotation.z = -h.latch.liftRad; scene.updateMatrixWorld(true);
  const lOpen = wp(lip);
  h.hook.rotation.z = 0; scene.updateMatrixWorld(true);

  const bb = new THREE.Box3().setFromObject(bar);

  /* ── 관통 검사 ──
     고정 걸쇠(행거 케이스)와 문과 함께 움직이는 부품이 겹치면
     문이 열릴 때 서로를 뚫고 지나간다. 예전 형상이 딱 이 상태였다.
     Keeper 레버는 회전 메시라 AABB 가 크게 잡히므로 제외하고,
     사각 턱이 네모 안에 들어가는 겹침(의도된 물림)도 제외한다. */
  const hookGrp = bar.parent;
  const hookParts = [], movParts = [];
  hookGrp.traverse(o => { if (o.isMesh) hookParts.push(o); });
  h.right.traverse(o => {
    if (!o.isMesh) return;
    if (o.name === 'hallLatchKeeperArm') return;         // 물리는 쪽 — 겹쳐야 정상
    movParts.push(o);
  });
  const clashes = [];
  for (const a of hookParts) {
    const ab = new THREE.Box3().setFromObject(a);
    for (const c of movParts) {
      const cb = new THREE.Box3().setFromObject(c);
      if (!ab.intersectsBox(cb)) continue;
      const it = ab.clone().intersect(cb);
      const d = [it.max.x - it.min.x, it.max.y - it.min.y, it.max.z - it.min.z];
      if (Math.min(...d) > 0.0008) {
        clashes.push({ hook: a.name || a.geometry.type, mov: c.name || c.geometry.type,
                       ov: d.map(v => +(v * 1000).toFixed(1)),
                       at: [+it.min.x.toFixed(4), +it.min.y.toFixed(4), +it.min.z.toFixed(4)] });
      }
    }
  }
  return { spec: h.latch, pClosed, lClosed, lOpen, barZ: [bb.min.z, bb.max.z], clashes };
}, FI);

const { spec, pClosed, lClosed, lOpen } = data;
const mm = v => (v * 1000).toFixed(2).padStart(8) + 'mm';
const engage = pClosed[1] - lClosed[1];       // 걸쇠 상면 − 턱 하단
const clear  = lOpen[1] - pClosed[1];         // 해정 후 턱 하단 − 걸쇠 상면
const lift   = lOpen[1] - lClosed[1];

console.log(`[${FI}층 인덱스] 승장 인터록 래치`);
console.log('  걸쇠 네모 포켓 입구 (월드)   ', pClosed.map(v => v.toFixed(4)).join(', '));
console.log('  Keeper 사각 턱 하단 (닫힘)   ', lClosed.map(v => v.toFixed(4)).join(', '));
console.log('  Keeper 사각 턱 하단 (해정)   ', lOpen.map(v => v.toFixed(4)).join(', '));
console.log('  걸쇠 바 Z 구간               ', data.barZ.map(v => v.toFixed(4)).join(' ~ '));
console.log('');
const checks = [
  ['걸림 깊이 8±1mm (178p)',   engage,               v => Math.abs(v - 0.008) <= 0.001],
  ['해정 틈 4±1mm (179p)',     clear,                v => Math.abs(v - 0.004) <= 0.0015],
  ['해정 리프트',              lift,                 v => v >= 0.011],
  ['개방측 여유 4~5mm (178p)', spec.gap,             v => v >= 0.004 && v <= 0.005],
  ['착석측 여유',              spec.seat,            v => v > 0 && v <= 0.001],
  ['턱↔포켓 X 중심 일치',      Math.abs(lClosed[0] - pClosed[0]), v => v <= 0.0025],
  ['턱↔포켓 Z 동일 평면',      Math.abs(lClosed[2] - pClosed[2]), v => v <= 0.0005]
];
let bad = 0;
if (data.clashes.length) {
  console.log(`  FAIL  고정 걸쇠 ↔ 문측 부품 관통 ${data.clashes.length}건`);
  data.clashes.slice(0, 8).forEach(c =>
    console.log(`          ${c.hook} × ${c.mov}  겹침 ${c.ov.join(' x ')}mm  @ ${c.at.join(', ')}`));
  bad++;
} else {
  console.log('  OK    고정 걸쇠 ↔ 문측 부품 관통 없음');
}
for (const [n, v, ok] of checks) {
  const good = ok(v);
  if (!good) bad++;
  console.log(`  ${good ? 'OK  ' : 'FAIL'}  ${n.padEnd(26)} ${mm(v)}`);
}
console.log(`  해정 회전각 ${(spec.liftRad * 180 / Math.PI).toFixed(2)}°`);
console.log(bad ? `\n${bad}건 불합격` : '\n전 항목 합격');
await browser.close();
process.exit(bad ? 1 : 0);
