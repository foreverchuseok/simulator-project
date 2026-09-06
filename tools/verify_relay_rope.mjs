/* 연동 로프 가시성 규약 수치 검증 (docs/DOOR-REBUILD.md 연동 로프 계약).
   규약
     (1) 본선 주행면이 행거판 전면보다 뒤에 있다 (local z 가 더 크다 = 승강로 후면 쪽).
     (2) 상·하 가닥 Y 가 행거판 윗변/아랫변 사이(inboard)에 있다.
     (3) 타공창 계약 — 구멍 3개 (가운데 풀리 + 좌·우 고정):
         · 상부 가닥은 어느 창에도 걸리면 안 된다.
         · 하부 가닥은 가운데 풀리창 안으로 들어와야 한다.
         · 전산볼트/스프링 고정 구멍은 풀리창 좌·우에 따로 있다.
     (4) 같은 가닥의 두 마디가 X 구간에서 겹치지 않는다.
     (5) 본선 끝점이 풀리 뒤 접선과 일치하고, 그 점은 행거판 폭 안에 있다.
     (6) ★그려진 메쉬의 Y·Z 가 k.loY / k.loZ 와 정확히 같다.
     (7) 하부 가닥 우측 끝점이 텐셔너 풀리 화면오른쪽 뒤 접선과 일치한다.
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
  const HP_PLATE_Z = -(0.035 / 2) + 0.002 - 0.005;
  /* 타공창·텐셔너 제원은 buildHangerAssembly 가 userData 에 남긴 값을 그대로 읽는다
     (하드코딩하면 창을 옮겼을 때 검증이 같이 안 따라온다). 좌표는 행거판 로컬. */
  const win = h.left.userData.windows, tens = h.left.userData.tens;
  const toLocalY = wy => wy - (pulY - 0.040);

  const span = m => m.visible ? [m.position.x - m.scale.y / 2, m.position.x + m.scale.y / 2] : null;
  const at = m => ({ y: m.position.y, z: m.position.z });

  const states = [];
  for (const st of ['closed', 'open']) {
    h.left.position.x  = st === 'closed' ? h.left.userData.cx  : h.left.userData.ox;
    h.right.position.x = st === 'closed' ? h.right.userData.cx : h.right.userData.ox;
    spinDoorDrive(h);
    states.push({
      st, L: h.left.position.x, Rx: h.right.position.x,
      upL: span(k.seg.upL), upR: span(k.seg.upR),
      loL: span(k.seg.loL), loR: span(k.seg.loR),
      loLat: at(k.seg.loL), loRat: at(k.seg.loR)
    });
  }
  h.left.position.x = h.left.userData.cx;
  h.right.position.x = h.right.userData.cx;
  spinDoorDrive(h);

  return { upY: k.upY, loY: k.loY, upZ: k.upZ, loZ: k.loZ, ropeR: k.ropeR,
           bL: k.bL, bR: k.bR, aOff: k.aOff, aHalf: k.aHalf,
           pulLX: k.pulLX, pulRX: k.pulRX,
           pulY, plateTop, plateBot, HP_PLATE_Z, HP_HW, win, tens,
           upLocalY: toLocalY(k.upY), loLocalY: toLocalY(k.loY), states };
});

const mm = v => (v * 1000).toFixed(1) + 'mm';
const checks = [];
const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });
const inWin = (w, y) => y > w.y0 && y < w.y1;

ok('(1) 로프면이 행거판 뒤',
   R.loZ > R.HP_PLATE_Z && R.upZ > R.HP_PLATE_Z,
   `ropeZ=${mm(R.loZ)} vs plateZ=${mm(R.HP_PLATE_Z)} (여유 ${mm(R.loZ - R.HP_PLATE_Z)})`);

ok('(2) 상부 가닥이 행거판 윗변 아래',
   R.upY < R.plateTop - 0.005,
   `upY=caseCY+${mm(R.upY - R.pulY)}, 윗변까지 여유 ${mm(R.plateTop - R.upY)}`);

ok('(2) 하부 가닥이 행거판 아랫변 위',
   R.loY > R.plateBot + 0.005,
   `아랫변까지 여유 ${mm(R.loY - R.plateBot)}`);

// (3) 분할 타공창 계약
const exposed = R.win.filter(w => inWin(w, R.upLocalY));
ok('(3) 상부 가닥이 어느 창에도 안 걸림',
   exposed.length === 0,
   `상부 가닥 로컬Y=${mm(R.upLocalY)}, 창 윗변 최대 ${mm(Math.max(...R.win.map(w => w.y1)))}`);

const pulWin = R.win.find(w => Math.abs((w.x0 + w.x1) / 2 - R.tens.rbOff) < 1e-4);
ok('(3) 하부 가닥이 풀리 타공창 안',
   pulWin && inWin(pulWin, R.loLocalY),
   pulWin ? `하부 가닥 로컬Y=${mm(R.loLocalY)} ∈ [${mm(pulWin.y0)}, ${mm(pulWin.y1)}]` : '풀리창 없음');

ok('(3) 타공창이 3개다 (풀리 + 좌·우 고정)',
   R.win.length === 3,
   `창 ${R.win.length}개`);

const rodWin = R.win.find(w => R.tens.rodX > w.x0 && R.tens.rodX < w.x1);
const sprWin = R.win.find(w => R.tens.sprX > w.x0 && R.tens.sprX < w.x1);
ok('(3) 오른쪽 고정 구멍이 따로 있다',
   rodWin && pulWin && rodWin !== pulWin,
   `rodX=${mm(R.tens.rodX)}`);
ok('(3) 왼쪽 고정 구멍이 따로 있다',
   sprWin && pulWin && sprWin !== pulWin,
   `sprX=${mm(R.tens.sprX)}`);

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
  ok(`(6) ${s.st}: 하부 두 마디가 양단 풀리 홈 평면 위`,
     Math.abs(s.loLat.y - R.loY) < 1e-9 && Math.abs(s.loRat.y - R.loY) < 1e-9 &&
     Math.abs(s.loLat.z - R.loZ) < 1e-9 && Math.abs(s.loRat.z - R.loZ) < 1e-9,
     `loL(y=${mm(s.loLat.y - R.loY)}, z=${mm(s.loLat.z - R.loZ)}) / loR(y=${mm(s.loRat.y - R.loY)}, z=${mm(s.loRat.z - R.loZ)}) 편차`);
  ok(`(7) ${s.st}: 하부 우측 끝점 = 풀리 뒤 접선`,
     Math.abs((s.loL[1] - s.L) - R.tens.rbOff) < 1e-6,
     `끝점 로컬x=${mm(s.loL[1] - s.L)} vs RB_OFF=${mm(R.tens.rbOff)}`);
}

let bad = 0;
for (const c of checks) {
  if (!c.pass) bad++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  —  ${c.detail}`);
}
console.log(`\n풀리 홈 R=${mm(R.ropeR)} / 가닥 간격=${mm(R.upY - R.loY)} / ${checks.length - bad}/${checks.length} 통과`);
await browser.close();
process.exit(bad ? 1 : 0);
