/* 승장 헤더 연동 로프 텐셔너(2열 홈 풀리 + 전산볼트 + 스프링) 근접 검증 스크린샷.
   타공창 안에서 풀리·감김 로프·더블 조절 너트가 실제로 보이는지 확인용.
   사용: node tools/shot_tensioner.mjs [포트]
   전제: 프로젝트 루트에서 정적 서버가 떠 있어야 한다 (python -m http.server). */
import { chromium } from 'playwright';

const PORT = process.argv[2] || '8777';
const OUT = '.shot-relay';

/* 화면 왼쪽 = 월드 +X (반전 주의). 텐셔너는 월드 -X 행거판(left 그룹) 로컬 RB_OFF=-0.020 에 있다. */
const SHOTS = [
  { name: 'tens_front', dx: 0.000, dy: 0.000, dist: 0.150 },  // 정면 근접 (두 창 동시)
  { name: 'tens_pulley', dx: -0.020, dy: 0.000, dist: 0.075 }, // 풀리창 클로즈업
  { name: 'tens_nut', dx: -0.075, dy: -0.012, dist: 0.070 }     // 점검창(더블 너트) 클로즈업
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html?doorcam=1`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.__tens = (dx, dy, dist) => {
    /* 텐셔너 월드 좌표: 행거판 x + RB_OFF, 양단 풀리 y - ROPE_R, 로프 주행면 z */
    const h = hatchDoors[1], k = h.link;
    const p = new THREE.Vector3();
    k.pulL.getWorldPosition(p);
    const tx = h.left.position.x - 0.020 + dx;
    const ty = p.y - k.ropeR + dy;
    const tz = p.z;
    controls.minDistance = 0.02;
    camera.near = 0.01; camera.updateProjectionMatrix();
    camera.position.set(tx, ty + 0.012, tz - dist);
    controls.target.set(tx, ty, tz);
    controls.update();
  };
});

for (const s of SHOTS) {
  await page.evaluate(([dx, dy, d]) => window.__tens(dx, dy, d), [s.dx, s.dy, s.dist]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log('saved', s.name);
}

await browser.close();
