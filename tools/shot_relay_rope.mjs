/* 승장 헤더 연동 로프 검증 스크린샷.
   행거판 앞에 로프가 한 가닥도 안 보이는지 / 타공창 안에서만 텐셔너가 보이는지 확인용.
   사용: node tools/shot_relay_rope.mjs [포트]
   전제: 프로젝트 루트에서 정적 서버가 떠 있어야 한다 (python -m http.server). */
import { chromium } from 'playwright';

const PORT = process.argv[2] || '8777';
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const OUT = '.shot-relay';

/* [카메라 프리셋] 이름 → 카메라 위치·타겟을 계산하는 페이지 내 표현식.
   화면 왼쪽 = 월드 +X (반전 주의). 우측 행거판(타공창)이 월드 -X 다. */
const SHOTS = [
  { name: 'relay_header_full', q: 'doorcam=1', cam: null },
  {
    name: 'relay_plate_minusX', q: 'doorcam=1',
    cam: `window.__look(window.__hd[1].left.position.x, 0.34)`
  },
  {
    name: 'relay_plate_plusX', q: 'doorcam=1',
    cam: `window.__look(window.__hd[1].right.position.x, 0.34)`
  },
  {
    name: 'relay_pulley_left', q: 'doorcam=1',
    cam: `window.__look(window.__hd[1].link.pulLX, 0.24)`
  }
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

for (const s of SHOTS) {
  await page.goto(`${BASE}?${s.q}`, { waitUntil: 'networkidle' });
  // 헤더 핸들을 전역으로 끌어올린다 (hatchDoors 는 elevator.js 클로저 안)
  await page.evaluate(() => {
    window.__hd = hatchDoors;
    /* 로프 주행면의 월드 좌표를 풀리 노드에서 직접 뽑는다.
       link.upY / pulLX 는 hcGrp 로컬 값이라 층 높이·트랙 Z 가 빠져 있다. */
    window.__look = (worldX, dist) => {
      const p = new THREE.Vector3();
      hatchDoors[1].link.pulL.getWorldPosition(p);
      camera.position.set(worldX + 0.02, p.y + 0.10, p.z - dist);
      controls.target.set(worldX, p.y, p.z + 0.02);
      controls.minDistance = 0.02;
      controls.update();
    };
  });
  if (s.cam) await page.evaluate(s.cam);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log('saved', s.name);
}

await browser.close();
