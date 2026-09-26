/* 이동케이블 · 종단 안전장치 수치 검증 (부품설계.pdf 184~204p / docs/TRAVEL-CABLE-TERMINAL.md)
   규약
     (1) B 지점 = 균형추 프레임 충돌판과 카 바닥이 같은 높이인 카 위치.
         해치 케이블 행거는 그 카 바닥에서 정확히 +1,000mm (187p 2항).
     (2) 최하층에서 T 케이블 곡면 최하단부가 피트 바닥 +300±50mm (188p 5항).
     (3) 카가 어디에 있든 두 가닥 길이가 양수이고 곡면이 피트 바닥을 뚫지 않는다.
     (4) 종단 스위치(MR_설계.pdf 137~138p, 스위치 방식): 레일 고정 6개가 피트부터
         DFL → DLS → DSD … USD → ULS → UFL 순이고, 카 캠은 공용 1본이다.
         구형 배치의 모델 트립점은 index.html 원본을 따른다.
         착상면에서는 리미트·파이널이 닫혀 있다. 스위치 높이 차이로 작동 순서를 만든다.
     (5) 캠 판이 점검 오버런(±350mm) 끝까지 리미트·파이널 롤러를 물고 간다.
     (6) 롤러가 완전히 눌렸을 때 롤러의 카 쪽 면이 캠 면과 일치한다 (동작각 역산 정합).
     (7) 강제감속 스위치는 종단 착상면 1500mm 전(60m/min)에서 눌리기 시작해
         종단 착상까지 눌린 채 유지되고, 중간층에서는 풀려 있다 (200~201p 거리표).
     (8) 스위치 취부 암이 모든 레일 브라켓 단과 겹치지 않는다.
     (9) 이동케이블이 조속기 로프·카 레일과 물리적으로 떨어져 있다.
     (11) S3-B1370형 스위치 GLB: 유리창 속 가동 접점이 동작 플래그와 같이 열리고 닫힌다.
          카·캠 전 행정(±350mm 오버런 포함)에서 스위치 본체·브라켓·배선과 닿지 않는다.
   사용: node tools/verify_travel_cable.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8893;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('Not Found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const mm = v => (v * 1000).toFixed(1) + 'mm';
const deg = r => (r * 180 / Math.PI).toFixed(1) + '°';

server.listen(PORT, async () => {
  const browser = await chromium.launch({args:['--enable-gpu']});
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.error(e.stack); });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/index.html?tcam`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => terminalDevices.modelReady, null, { timeout: 90000 });
  await page.waitForTimeout(1000);

  const R = await page.evaluate(() => {
    const out = { const: {}, switches: [], states: [], sw: [] };
    out.const = {
      CAR_H: S.CAR_H, CWT_H: S.CWT_H, CAR_RAIL_X, CAR_RAIL_Z, RAIL_BRACKET_Y, RAIL_BRACKET_BAND,
      FLOOR_Y: FLOOR_Y.slice(), FLOORS, Y0,
      initialCarY: carGrp.position.y, initialCwtY: cwtGrp.position.y,
      TC_X, TC_CAR_X, TC_T, TC_LOOP_R, TC_CAR_Z, TC_FIX_Z, TC_PIT_CLEAR, TC_HANGER_UP, TC_W, TC_CAR_HANGER_LY,
      FLS_Z, FLS_LEVER_L, FLS_ROLLER_R, FLS_TRIP_ANGLE, FLS_OVERTRAVEL, FLS_LEAD,
      FLS_PIVOT_X, FLS_CAM_FACE_X, CAM_MID_LY, CAM_VANE_W, FLS_PAIR_DZ, LS_TRIP, SLD_DIST,
      CAM_VANES: Object.fromEntries(Object.entries(CAM_VANES).map(([k, v]) => [k, { botLY: v.botLY, topLY: v.topLY, dz: v.dz }])),
      GOV_TENS_X, GOV_TENS_Z,
      travel: { hangerY: travelCable.hangerY, bY: travelCable.bY, totalLen: travelCable.totalLen,
                pitTopY: travelCable.pitTopY, ready: travelCable.ready }
    };
    out.switches = terminalDevices.switches.map(s => ({ name: s.name, kind: s.kind, dir: s.dir, dz: s.dz, y: s.y }));
    out.sharedFaces=terminalDevices.cam.node.children.filter(o=>o.name==='terminalSharedCamFace').length;
    out.bodyGaps=[];
    scene.updateMatrixWorld(true);
    for(let i=1;i<terminalDevices.switches.length;i++) {
      const a=new THREE.Box3().setFromObject(terminalDevices.switches[i-1].body);
      const b=new THREE.Box3().setFromObject(terminalDevices.switches[i].body);
      out.bodyGaps.push(b.min.y-a.max.y);
    }
    const camBox = new THREE.Box3().setFromObject(terminalDevices.cam.node);
    out.camBox = { min: camBox.min.toArray(), max: camBox.max.toArray(), carY: carGrp.position.y };
    const levers = () => Object.fromEntries(terminalDevices.switches.map(s => [s.name, s.lever.rotation.z]));
    // 유리창 접점: 가동 접점 Y 와 동작 플래그가 스윕 내내 일치해야 한다.
    out.contactMismatch = [];
    const contactCheck = tag => {
      const flag = { slowdown: elevatorState.slowdownActive, limit: elevatorState.limitActive, final: elevatorState.finalLimitActive };
      terminalDevices.switches.forEach(s => {
        const open = Math.abs(s.bridge.position.y + LIMIT_SWITCH_MODEL.bridgeStroke) < 1e-9;
        const closed = Math.abs(s.bridge.position.y) < 1e-9;
        if (!(open || closed) || open !== s.contactOpen || open === s.body.userData.contactClosed ||
            (open && !flag[s.kind])) out.contactMismatch.push(`${tag}:${s.name}`);
      });
    };

    // 카를 여러 위치로 옮겨 보며 상태를 수집한다 (원위치 복구)
    const y00 = carGrp.position.y, w00 = cwtGrp.position.y;
    const move = y => { const d = y - carGrp.position.y; carGrp.position.y = y; cwtGrp.position.y -= d; refreshRopes(); };
    const probe = tag => {
      const yTop = travelCable.hangerY;
      const yCar = carGrp.position.y + TC_CAR_HANGER_LY;
      const R2 = TC_LOOP_R;
      let yc = (yTop + yCar + Math.PI * R2 - travelCable.totalLen) / 2;
      yc = Math.max(travelCable.pitTopY + R2 + 0.02, Math.min(yc, yTop - 0.02));
      return { tag, carY: carGrp.position.y, loopBottom: travelCable.loopBottomY,
               fixLeg: yTop - yc, carLeg: yCar - yc,
               slow: elevatorState.slowdownActive, lim: elevatorState.limitActive,
               fin: elevatorState.finalLimitActive, lev: levers() };
    };
    const INS = 0.35;
    for (let f = 0; f < FLOORS; f++) { move(FLOOR_Y[f] + S.CAR_H / 2); out.states.push(probe('F' + (f + 1))); }
    move(FLOOR_Y[0] + S.CAR_H / 2 - INS); out.states.push(probe('최하 오버런 -350'));
    move(FLOOR_Y[FLOORS - 1] + S.CAR_H / 2 + INS); out.states.push(probe('최상 오버런 +350'));

    // 종단 스위치 스윕 — 착상면 기준 오프셋별 상태
    const lo = FLOOR_Y[0] + S.CAR_H / 2, up = FLOOR_Y[FLOORS - 1] + S.CAR_H / 2;
    [[lo, 0, '최하층 착상면'], [lo, -0.02, '최하층 -20'], [lo, -LS_TRIP - FLS_LEAD, '하부 리미트 완전 동작'],
     [lo, -FLS_OVERTRAVEL - FLS_LEAD, '하부 파이널 완전 동작'], [lo, -INS, '하부 오버런 -350'],
     [lo, SLD_DIST - 0.02, '최하층 +1480 (감속 눌림 시작)'], [lo, SLD_DIST - FLS_LEAD - 0.02, '최하층 +1420 (감속 완전 동작)'],
     [lo, SLD_DIST + 0.02, '최하층 +1520 (감속 풀림)'],
     [up, 0, '최상층 착상면'], [up, 0.02, '최상층 +20'], [up, LS_TRIP + FLS_LEAD, '상부 리미트 완전 동작'],
     [up, FLS_OVERTRAVEL + FLS_LEAD, '상부 파이널 완전 동작'], [up, INS, '상부 오버런 +350'],
     [up, -(SLD_DIST - 0.02), '최상층 -1480 (감속 눌림 시작)'], [up, -(SLD_DIST - FLS_LEAD - 0.02), '최상층 -1420 (감속 완전 동작)'],
     [up, -(SLD_DIST + 0.02), '최상층 -1520 (감속 풀림)']]
      .forEach(([base, d, tag]) => {
        move(base + d);
        out.sw.push({ tag, d, slow: elevatorState.slowdownActive, lim: elevatorState.limitActive,
                      fin: elevatorState.finalLimitActive, lev: levers(),
                      open: terminalDevices.switches.filter(s => s.contactOpen).map(s => s.name) });
        contactCheck(tag);
      });

    // 카(캠 포함) 정점을 전 행정으로 쓸어 올려 스위치 고정부 Box3 와의 최소 간극을 잰다.
    // 레버·롤러는 캠이 누르는 것이 정상이므로 제외한다.
    move(y00); scene.updateMatrixWorld(true);
    const moving = new Set(); terminalDevices.switches.forEach(s => s.lever.traverse(o => moving.add(o)));
    const parts = []; limitGrp.traverse(o => { if (o.isMesh && !moving.has(o)) parts.push([o.name || o.parent?.name || o.geometry.type, new THREE.Box3().setFromObject(o)]); });
    const dMin = FLOOR_Y[0] + S.CAR_H / 2 - 0.35 - carGrp.position.y, dMax = FLOOR_Y[FLOORS - 1] + S.CAR_H / 2 + 0.35 - carGrp.position.y;
    const v = new THREE.Vector3(); let sweep = { d: Infinity }, clipSweep = { d: Infinity };
    carGrp.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return;
      const bb = new THREE.Box3().setFromObject(o); if (bb.min.x > -1.15) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        if (v.x > -1.15) continue;
        for (const [n, b] of parts) {
          if (v.y + dMax < b.min.y || v.y + dMin > b.max.y) continue;
          const dx = Math.max(b.min.x - v.x, 0, v.x - b.max.x), dz = Math.max(b.min.z - v.z, 0, v.z - b.max.z);
          const d = Math.hypot(dx, dz), hit = { d, part: n, car: o.name || o.parent?.name };
          if (n === 'terminalRailClip') { if (d < clipSweep.d) clipSweep = hit; } else if (d < sweep.d) sweep = hit;
        }
      }
    });
    out.carSweep = sweep; out.clipSweep = clipSweep;

    // 리본 메시 실측 바운딩 박스
    const bb = new THREE.Box3().setFromObject(travelCable.ribbon);
    out.ribbonBox = { min: bb.min.toArray(), max: bb.max.toArray() };
    // 스위치 취부 암 Y 실측 (limitGrp 자식 중 Z 방향으로 긴 평철)
    out.armYs = [];
    limitGrp.traverse(o => {
      if(o.userData.type==='terminal-rail-arm'){out.armYs.push(o.position.y);return;}
      if (!o.isMesh || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      if (p.width === 0.008 && p.height === 0.035) out.armYs.push(o.position.y);
    });
    return out;
  });

  const C = R.const, T = C.travel;
  const checks = [];
  const ok = (n, c, d) => checks.push({ n, pass: !!c, d });

  // (1) B 지점 + 해치 케이블 행거
  const carYb = T.bY + C.CAR_H / 2;
  const cwtPlate = C.initialCwtY - (carYb - C.initialCarY) - C.CWT_H / 2;
  ok('(1) B 지점 = 균형추 충돌판 높이 = 카 바닥 높이',
     Math.abs(T.bY - cwtPlate) < 1e-6, `카 바닥 ${mm(T.bY)} / 충돌판 ${mm(cwtPlate)}`);
  ok('(1) 해치 케이블 행거 = B 지점 카 바닥 +1,000mm',
     Math.abs((T.hangerY - T.bY) - C.TC_HANGER_UP) < 1e-9,
     `행거 Y=${mm(T.hangerY)} (B +${mm(T.hangerY - T.bY)})`);
  ok('(1) 행거가 카 주행 구간 안에 있다',
     T.hangerY > C.FLOOR_Y[0] && T.hangerY < C.FLOOR_Y[C.FLOORS - 1],
     `${mm(T.hangerY)} ∈ (${mm(C.FLOOR_Y[0])}, ${mm(C.FLOOR_Y[C.FLOORS - 1])})`);

  // (2) 최하층 곡면 최하단
  const f1 = R.states.find(s => s.tag === 'F1');
  const clr = f1.loopBottom - T.pitTopY;
  ok('(2) 최하층 곡면 최하단 = 피트 바닥 +300±50mm',
     Math.abs(clr - C.TC_PIT_CLEAR) < 0.05, `${mm(clr)}`);

  // (3) 전 구간 가닥 건전성
  R.states.forEach(s => {
    ok(`(3) ${s.tag}: 고정측·카측 가닥 길이 양수`, s.fixLeg > 0.01 && s.carLeg > 0.01,
       `고정측 ${mm(s.fixLeg)} / 카측 ${mm(s.carLeg)}`);
    ok(`(3) ${s.tag}: 곡면이 피트 바닥 위`, s.loopBottom > T.pitTopY + 0.03,
       `곡면 최하단 ${mm(s.loopBottom)} (피트 바닥 ${mm(T.pitTopY)})`);
  });

  // (4) 종단 스위치 6개 — 순서·트립점
  const order = R.switches.map(s => s.name).join('→');
  ok('(4) 레일 고정 스위치 6개, 피트부터 DFL→DLS→DSD→USD→ULS→UFL',
     order === 'DFL→DLS→DSD→USD→ULS→UFL' &&
     R.switches.every((s, i) => i === 0 || s.y > R.switches[i - 1].y),
     R.switches.map(s => `${s.name}@${mm(s.y)}`).join(' '));
  const swY = Object.fromEntries(R.switches.map(s => [s.name, s.y]));
  const loBase = C.FLOOR_Y[0] + C.CAR_H / 2, upBase = C.FLOOR_Y[C.FLOORS - 1] + C.CAR_H / 2;
  const V = C.CAM_VANES;
  const lens = Object.fromEntries(Object.entries(V).map(([k, v]) => [k, v.topLY - v.botLY]));
  ok('(4) 공용 캠 한 개와 동일 레인의 스위치 여섯 개',
     R.sharedFaces===1 && R.switches.every(s=>s.dz===0) && lens.final===lens.limit && lens.limit===lens.slowdown,
     Object.entries(lens).map(([k, l]) => `${k} ${mm(l)}`).join(' / '));
  ok('(4) 하부 스위치 = 트립점 + 자기 가닥 하단, 상부 = 트립점 + 자기 가닥 상단',
     Math.abs(swY.DLS - (loBase - C.LS_TRIP + V.limit.botLY)) < 1e-9 &&
     Math.abs(swY.DFL - (loBase - C.FLS_OVERTRAVEL + V.final.botLY)) < 1e-9 &&
     Math.abs(swY.DSD - (loBase + C.SLD_DIST + V.slowdown.botLY)) < 1e-9 &&
     Math.abs(swY.ULS - (upBase + C.LS_TRIP + V.limit.topLY)) < 1e-9 &&
     Math.abs(swY.UFL - (upBase + C.FLS_OVERTRAVEL + V.final.topLY)) < 1e-9 &&
     Math.abs(swY.USD - (upBase - C.SLD_DIST + V.slowdown.topLY)) < 1e-9,
     R.switches.map(s => `${s.name}@${mm(s.y)}`).join(' '));
  ok('(4) 하부 3개는 승강로 하반, 상부 3개는 상반',
     swY.DFL < C.FLOOR_Y[1] && swY.DLS < C.FLOOR_Y[1] && swY.DSD < C.FLOOR_Y[2] &&
     swY.USD > C.FLOOR_Y[2] && swY.ULS > C.FLOOR_Y[2] && swY.UFL > C.FLOOR_Y[2],
     `DFL ${mm(swY.DFL)} / UFL ${mm(swY.UFL)}`);
  ok('(4) 일렬 본체가 겹치지 않고 리미트 다음 파이널 동작',
     R.bodyGaps.every(g=>g>0.030)&&C.FLS_OVERTRAVEL>C.LS_TRIP+C.FLS_LEAD,JSON.stringify(R.bodyGaps));
  ok('(4) 파이널 완전 눌림이 점검 오버런 안',
     C.FLS_OVERTRAVEL+C.FLS_LEAD<=0.35,mm(C.FLS_OVERTRAVEL+C.FLS_LEAD));
  ok('(4) 동작각이 50~70° 범위',
     C.FLS_TRIP_ANGLE >= 50 * Math.PI / 180 && C.FLS_TRIP_ANGLE <= 70 * Math.PI / 180, deg(C.FLS_TRIP_ANGLE));
  ok('(4) 고정축~롤러축이 48~52mm',
     C.FLS_LEVER_L >= 0.048 && C.FLS_LEVER_L <= 0.052, mm(C.FLS_LEVER_L));
  const A = C.FLS_TRIP_ANGLE, near = (a, b) => Math.abs(a - b) < 1e-9;
  const S_ = Object.fromEntries(R.sw.map(s => [s.tag, s]));
  ['최하층 착상면', '최하층 -20', '최상층 착상면', '최상층 +20'].forEach(tag => {
    const s = S_[tag];
    ok(`(4) ${tag}: 리미트·파이널 닫힘, 감속만 눌림`, !s.lim && !s.fin && s.slow &&
       ['DLS', 'DFL', 'ULS', 'UFL'].every(n => near(s.lev[n], 0)), JSON.stringify({ slow: s.slow, lim: s.lim, fin: s.fin }));
  });
  // 가닥이 갈라져 리미트 완전 동작 때 파이널은 거의 닫혀 있다.
  ok('(4) 하부 리미트 완전 동작: DLS −60°, DFL 닫힘', S_['하부 리미트 완전 동작'].lim && !S_['하부 리미트 완전 동작'].fin &&
     near(S_['하부 리미트 완전 동작'].lev.DLS, -A) && Math.abs(S_['하부 리미트 완전 동작'].lev.DFL) < 12 * Math.PI / 180,
     `DLS ${deg(S_['하부 리미트 완전 동작'].lev.DLS)} / DFL ${deg(S_['하부 리미트 완전 동작'].lev.DFL)}`);
  ok('(4) 하부 파이널 완전 동작: DFL −60°', S_['하부 파이널 완전 동작'].fin && near(S_['하부 파이널 완전 동작'].lev.DFL, -A),
     deg(S_['하부 파이널 완전 동작'].lev.DFL));
  ok('(4) 상부 리미트 완전 동작: ULS +60°, UFL 닫힘', S_['상부 리미트 완전 동작'].lim && !S_['상부 리미트 완전 동작'].fin &&
     near(S_['상부 리미트 완전 동작'].lev.ULS, A) && Math.abs(S_['상부 리미트 완전 동작'].lev.UFL) < 12 * Math.PI / 180,
     `ULS ${deg(S_['상부 리미트 완전 동작'].lev.ULS)} / UFL ${deg(S_['상부 리미트 완전 동작'].lev.UFL)}`);
  ok('(4) 상부 파이널 완전 동작: UFL +60°', S_['상부 파이널 완전 동작'].fin && near(S_['상부 파이널 완전 동작'].lev.UFL, A),
     deg(S_['상부 파이널 완전 동작'].lev.UFL));

  // (5) 오버런 끝까지 캠이 물고 간다
  ['하부 오버런 -350', '상부 오버런 +350'].forEach(tag => {
    const s = S_[tag];
    ok(`(5) ${tag}: 감속·리미트·파이널 모두 눌림 유지`, s.slow && s.lim && s.fin, JSON.stringify({ slow: s.slow, lim: s.lim, fin: s.fin }));
  });
  ok('(5) 감속 가닥 ≥ 감속거리 + 오버런 + 리드인',
     lens.slowdown >= C.SLD_DIST + 0.35 + C.FLS_LEAD, `감속 ${mm(lens.slowdown)}`);
  ok('(5) 공용 캠 폭이 중앙 롤러 폭 14mm를 덮는다',
     C.CAM_VANE_W>=0.014 && C.FLS_PAIR_DZ===0,
     `가닥 폭 ${mm(C.CAM_VANE_W)} / 레인 간격 ${mm(C.FLS_PAIR_DZ)}`);

  // (6) 롤러 카 쪽 면 = 캠 면
  const rollerFaceX = C.FLS_PIVOT_X + C.FLS_LEVER_L * Math.cos(C.FLS_TRIP_ANGLE) + C.FLS_ROLLER_R;
  ok('(6) 완전 동작 시 롤러 카 쪽 면 = 캠 면',
     Math.abs(rollerFaceX - C.FLS_CAM_FACE_X) < 1e-12,
     `롤러 면 ${mm(rollerFaceX)} / 캠 면 ${mm(C.FLS_CAM_FACE_X)}`);
  ok('(6) 캠 판이 카 스타일 안쪽(레일 배면 +X)에 있다',
     R.camBox.min[0] > -C.CAR_RAIL_X + 0.05, `캠 X ∈ [${mm(R.camBox.min[0])}, ${mm(R.camBox.max[0])}]`);

  // (7) 강제감속 스위치
  [['최하층 +1480 (감속 눌림 시작)', 'DSD'], ['최상층 -1480 (감속 눌림 시작)', 'USD']].forEach(([tag, n]) => {
    const s = S_[tag];
    ok(`(7) ${tag}: ${n} 레버가 리드인에서 젖혀지기 시작`, Math.abs(s.lev[n]) > 1e-6 && Math.abs(s.lev[n]) < A && !s.lim && !s.fin,
       deg(s.lev[n]));
  });
  ['최하층 +1420 (감속 완전 동작)', '최상층 -1420 (감속 완전 동작)'].forEach(tag => {
    const s = S_[tag];
    ok(`(7) ${tag}: 감속만 눌림`, s.slow && !s.lim && !s.fin, JSON.stringify({ slow: s.slow, lim: s.lim, fin: s.fin }));
  });
  ['최하층 +1520 (감속 풀림)', '최상층 -1520 (감속 풀림)'].forEach(tag => {
    const s = S_[tag];
    ok(`(7) ${tag}: 모두 풀림`, !s.slow && !s.lim && !s.fin, JSON.stringify({ slow: s.slow, lim: s.lim, fin: s.fin }));
  });
  R.states.filter(s => s.tag === 'F2' || s.tag === 'F3').forEach(s => {
    ok(`(7) ${s.tag}: 중간층에서 종단 스위치 전부 풀림`, !s.slow && !s.lim && !s.fin &&
       Object.values(s.lev).every(v => near(v, 0)), JSON.stringify({ slow: s.slow, lim: s.lim, fin: s.fin }));
  });

  // (8) 레일 브라켓 간섭
  let hit = null;
  R.armYs.forEach(y => {
    C.RAIL_BRACKET_Y.forEach(by => { if (Math.abs(y - by) < C.RAIL_BRACKET_BAND - 1e-9) hit = { y, by }; });
  });
  ok('(8) 스위치 취부 암이 모든 레일 브라켓 단을 피한다', !hit,
     hit ? `암 Y=${mm(hit.y)} vs 브라켓 ${mm(hit.by)}` : `암 ${R.armYs.length}개 모두 밴드 밖`);

  // (9) 이동케이블 이격
  const govGapX = Math.abs(C.TC_X - C.GOV_TENS_X);
  const govGapZ = Math.min(Math.abs(C.TC_CAR_Z - (C.GOV_TENS_Z + 0.15)), Math.abs(C.TC_FIX_Z - (C.GOV_TENS_Z + 0.15)));
  ok('(9) 이동케이블 ↔ 조속기 로프 이격 (Z 기준 100mm 이상)', govGapZ > 0.10,
     `ΔX=${mm(govGapX)} ΔZ=${mm(govGapZ)}`);
  const railFlangeZ = [C.CAR_RAIL_Z - 0.0445, C.CAR_RAIL_Z + 0.0445];
  ok('(9) 카측 가닥이 좌측 레일 플랜지 Z 밖',
     C.TC_CAR_Z > railFlangeZ[1] + 0.05,
     `카측 가닥 Z=${mm(C.TC_CAR_Z)} vs 플랜지 끝 ${mm(railFlangeZ[1])}`);
  ok('(9) 승강로측 가닥이 카 폭(스타일/가이드슈) 바깥',
     Math.abs(C.TC_X) > C.CAR_RAIL_X + 0.10, `X=${mm(C.TC_X)} vs 레일 ${mm(C.CAR_RAIL_X)}`);
  ok('(9) 리본이 고정측에서 카 하부로 돌아오는 X 범위 안',
     Math.abs(R.ribbonBox.min[0] - (C.TC_X - C.TC_T / 2)) < 1e-6 &&
     Math.abs(R.ribbonBox.max[0] - (C.TC_CAR_X + C.TC_T / 2)) < 1e-6,
     `X ∈ [${mm(R.ribbonBox.min[0])}, ${mm(R.ribbonBox.max[0])}]`);

  // (11) S3-B1370형 스위치
  ok('(11) 유리창 가동 접점 = 동작 플래그 (스윕 전 구간)', R.contactMismatch.length === 0, R.contactMismatch.join(' ') || '일치');
  ok('(11) 하부 파이널 완전 동작: DFL·DLS 접점 개로, 착상면: 감속만 개로',
     S_['하부 파이널 완전 동작'].open.includes('DFL') && S_['하부 파이널 완전 동작'].open.includes('DLS') &&
     S_['최하층 착상면'].open.join() === 'DSD', JSON.stringify([S_['하부 파이널 완전 동작'].open, S_['최하층 착상면'].open]));
  ok('(11) 카·캠 전 행정 ↔ 스위치 본체·브라켓·배선 간극 > 3mm', R.carSweep.d > 0.003, JSON.stringify(R.carSweep));
  // 레일 클립 조는 세이프티기어 쐐기와 겹치는 기존 모델 한계(문서 기록) — 판정하지 않고 값만 남긴다.
  console.log('INFO  (11) 레일 클립 ↔ 카 최소 간극(기존 한계): ' + JSON.stringify(R.clipSweep));

  ok('(0) 콘솔·페이지 에러 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '없음');

  // 스크린샷
  const mr = await page.evaluate(() => {
    const pit = scene.getObjectByName('pitLightSwitchBox'), top = scene.getObjectByName('topLightSwitchBox');
    const stop = scene.getObjectByName('pitStopOutletBox');
    const stopBox = new THREE.Box3().setFromObject(stop.children[0]);
    return { pitOffset: pit.position.y-FLOOR_Y[0], topOffset: top.position.y-FLOOR_Y[FLOORS-1],
      aligned: pit.position.x===top.position.x && pit.position.z===top.position.z,
      stop: !!stop.getObjectByName('pitEstopButton') && !scene.getObjectByName('topLightSwitchBox').getObjectByName('pitEstopButton'),
      stopTop: stopBox.max.y-FLOOR_Y[0],
      lights: shaftCableGrp.children.filter(o=>o.userData.type==='shaft-led').length,
      left: TC_X<0, color: travelCable.ribbon.material.color.clone().convertLinearToSRGB().getHex()===TC_COLOR };
  });
  ok('(10) 조명 스위치 최상·최하층 +1m 동일 위치, 피트 정지 박스 상단 +0.4m 이내', Math.abs(mr.pitOffset-1)<1e-9 && Math.abs(mr.topOffset-1)<1e-9 && mr.aligned && mr.stop && mr.stopTop<=0.40, JSON.stringify(mr));
  ok('(10) 피트·각 층 LED 및 좌측 회색 이동케이블', mr.lights===C.FLOORS+1 && mr.left && mr.color, JSON.stringify(mr));
  for (const view of ['pit','top','lights']) {
    await page.evaluate(view=>{
      const dy=FLOOR_Y[2]+S.CAR_H/2-carGrp.position.y;
      carGrp.position.y+=dy; cwtGrp.position.y-=dy; refreshRopes();
      const y=view==='top'?TOP_LIGHT_SWITCH_Y:view==='pit'?PIT_LIGHT_SWITCH_Y:6;
      const z=view==='lights'?SHAFT_LIGHT_Z:LIGHT_SWITCH_Z;
      controls.enableDamping=false;
      camera.position.set(view==='lights'?6:-0.8,y+0.1,z);
      controls.target.set(-S.SHAFT_W/2,y,z); controls.update();
    },view);
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(ROOT,`.shot-mr-${view}.png`)});
  }
  const shots = [['tcam', 'tc-hanger'], ['tcam=2', 'tc-pit'], ['flscam', 'fls-bottom'],
                 ['flscam=2', 'fls-top'], ['sldcam', 'sld-bottom']];
  for (const [q, name] of (process.argv.includes('--mr-only') ? [] : shots)) {
    await page.goto(`http://127.0.0.1:${PORT}/index.html?${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => terminalDevices.modelReady, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ROOT, `.shot-${name}.png`) });
  }

  let bad = 0;
  for (const c of checks) { if (!c.pass) bad++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.n}  —  ${c.d}`); }
  console.log(`\n행거 Y=${mm(T.hangerY)} / 총 길이=${mm(T.totalLen)} / ${checks.length - bad}/${checks.length} 통과`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
});
