/* 연동 로프 가시성 규약 수치 검증 (docs/DOOR-REBUILD.md 연동 로프 계약).
   규약
     (1) 로프 주행면이 행거판 전면보다 뒤에 있다 (local z 가 더 크다 = 승강로 후면 쪽).
     (2) 상·하 가닥 Y 가 행거판 윗변/아랫변 사이(inboard)에 있다.
     (3) 두 가닥 모두 타공창 개구부 Y 범위 안에 든다.
     (4) 같은 가닥의 두 마디가 X 구간에서 겹치지 않는다 (예전 plateEdge 방식 버그).
     (5) 마디 끝점이 텐셔너/클램프 고정단과 일치하고, 그 고정단은 행거판 폭 안에 있다.
   사용: node tools/verify_relay_rope.mjs [포트]   (프로젝트 루트에 정적 서버 필요)
*/
import { chromium } from 'playwright';

const PORT = process.argv[2] || '8777';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html?doorcam=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const R = await page.evaluate(() => {
  const h = hatchDoors[1], k = h.link;
  const HP_HW = 0.190;                       // 행거판 반폭
  const pulY = (k.upY + k.loY) / 2;          // = caseCY
  const plateTop = pulY + 0.040, plateBot = pulY - 0.120;
  const winC = pulY, winHalf = 0.030;        // 타공창 개구부 (buildHangerAssembly 와 동일 원본)
  const HP_PLATE_Z = -(0.035 / 2) + 0.002 - 0.005;

  const span = m => m.visible ? [m.position.x - m.scale.y / 2, m.position.x + m.scale.y / 2] : null;

  const states = [];
  for (const st of ['closed', 'open']) {
    h.left.position.x  = st === 'closed' ? h.left.userData.cx  : h.left.userData.ox;
    h.right.position.x = st === 'closed' ? h.right.userData.cx : h.right.userData.ox;
    spinDoorDrive(h);
    states.push({
      st, L: h.left.position.x, Rx: h.right.position.x,
      upL: span(k.seg.upL), upR: span(k.seg.upR),
      loL: span(k.seg.loL), loR: span(k.seg.loR)
    });
  }
  h.left.position.x = h.left.userData.cx;
  h.right.position.x = h.right.userData.cx;
  spinDoorDrive(h);

  return { upY: k.upY, loY: k.loY, upZ: k.upZ, loZ: k.loZ, ropeR: k.ropeR,
           bL: k.bL, bR: k.bR, aOff: k.aOff, aHalf: k.aHalf,
           pulLX: k.pulLX, pulRX: k.pulRX,
           pulY, plateTop, plateBot, winC, winHalf, HP_PLATE_Z, HP_HW, states };
});

const mm = v => (v * 1000).toFixed(1) + 'mm';
const checks = [];
const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

ok('(1) 로프면이 행거판 뒤',
   R.loZ > R.HP_PLATE_Z && R.upZ > R.HP_PLATE_Z,
   `ropeZ=${mm(R.loZ)} vs plateZ=${mm(R.HP_PLATE_Z)} (여유 ${mm(R.loZ - R.HP_PLATE_Z)})`);

ok('(2) 상부 가닥이 행거판 윗변 아래',
   R.upY < R.plateTop - 0.005,
   `upY=caseCY${(R.upY - R.pulY >= 0 ? '+' : '') + mm(R.upY - R.pulY)}, 윗변까지 여유 ${mm(R.plateTop - R.upY)}`);

ok('(2) 하부 가닥이 행거판 아랫변 위',
   R.loY > R.plateBot + 0.005,
   `아랫변까지 여유 ${mm(R.loY - R.plateBot)}`);

ok('(3) 두 가닥 모두 타공창 안',
   R.upY < R.winC + R.winHalf && R.loY > R.winC - R.winHalf,
   `창 상단 여유 ${mm(R.winC + R.winHalf - R.upY)}, 창 하단 여유 ${mm(R.loY - (R.winC - R.winHalf))}`);

for (const s of R.states) {
  const gap = (a, b) => (a && b) ? b[0] - a[1] : null;
  ok(`(4) ${s.st}: 상부 두 마디 비겹침`, gap(s.upL, s.upR) > 0,
     `간극 ${mm(gap(s.upL, s.upR))} @ 클램프 x=${mm(s.Rx + R.aOff)}`);
  ok(`(4) ${s.st}: 하부 두 마디 비겹침`, gap(s.loL, s.loR) > 0,
     `간극 ${mm(gap(s.loL, s.loR))} @ 텐셔너 x=${mm(s.L)}`);
  ok(`(5) ${s.st}: 하부 끝점 = 텐셔너 고정단`,
     Math.abs(s.loL[1] - (s.L + R.bL)) < 1e-6 && Math.abs(s.loR[0] - (s.L + R.bR)) < 1e-6,
     `loL끝=${mm(s.loL[1])} bL=${mm(s.L + R.bL)} / loR시작=${mm(s.loR[0])} bR=${mm(s.L + R.bR)}`);
  ok(`(5) ${s.st}: 고정단이 행거판 폭 안`,
     Math.abs(R.bL) < R.HP_HW && Math.abs(R.bR) < R.HP_HW &&
     Math.abs(R.aOff) + R.aHalf < R.HP_HW,
     `bL=${mm(R.bL)} bR=${mm(R.bR)} 클램프끝=${mm(R.aOff + R.aHalf)} < ${mm(R.HP_HW)}`);
}

let bad = 0;
for (const c of checks) {
  if (!c.pass) bad++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  —  ${c.detail}`);
}
console.log(`\n풀리 홈 R=${mm(R.ropeR)} / 가닥 간격=${mm(R.upY - R.loY)} / ${checks.length - bad}/${checks.length} 통과`);
await browser.close();
process.exit(bad ? 1 : 0);
