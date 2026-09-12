// 안전기(Safety Gear) .glb 생성기 — 현대엘리베이터 카 세이프티 디바이스 스타일
// 참고: temporary/safety_switch_device_elbaksa.mp4 (엘박사 #세프티 스위치, 현대 SAFETY (CAR)),
//       부품설계.pdf 224~225p 하부 프레임 도면, 사용자 스크린샷 2026-09-11 171814/172006.
// 출력: assets/safety_gear.glb  (js/elevator.js buildCarCabin에서 GLTFLoader로 로드)
//
// 실행 방법 (프로젝트 루트에서):
//   npm i -D three@0.128.0        # 앱은 CDN r128 사용, 이 스크립트만 npm three 필요
//   node tools/build_safety_glb.mjs
// (node_modules는 .gitignore 대상. 앱 실행에는 불필요 — 커밋된 .glb만 있으면 됨.)
//
// 애니메이션 계약 (js/ui.js engageDeviceStop, js/elevator.js governorReset/refreshGovernorRope):
//   shaft            수평 작동 샤프트 그룹. rotation.x 로 트립. 원점 (0, baseY, shaftZ).
//   liftL / liftR    좌우 리프트 그룹. position.y 상승으로 웨지가 테이퍼에 파고듦.
//   wedge{L,R}{0,1}  폴리시드 웨지. position.z 가 레일 날(finZ) 쪽으로 이동.
//   spring{L,R}{0,1} U-스프링. scale.y 로 압축.
//   (clamp 노드는 2026-09-12 제거 — 로프는 카 상부 크로스헤드가 문다)
//   위 노드명·피벗·좌표는 바꾸지 않는다. 트립 레버·복귀 스프링 로드는 시각 부품이다.
//   Honeywell 안전 스위치는 이 GLB에 없다 — 실물 위치인 카 상부 크로스헤드에 있고
//   js/elevator.js 의 4-B 상부 크로스헤드 비상정지 연동부가 만든다.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';

// GLTFExporter는 바이너리 조립에 window.FileReader를 쓴다 → Node 폴리필 (Blob은 Node22 전역)
class NodeFileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(r => { this.result = r; this.onloadend && this.onloadend(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend && this.onloadend(); }); }
}
globalThis.window = globalThis.window || {};
globalThis.window.FileReader = NodeFileReader;

// ── 카-로컬 상수 (index.html / config.js / elevator.js 파생값과 일치) ──
const H = 2.355;                       // S.CAR_H
const CAR_BG = 2.625;                  // S.CAR_BG (레일 뒷면 간격)
const baseY = -H / 2 - 0.16;           // -1.3375  플랭크 중심 = 안전기 하우징 중심 Y
const finZ = 0.04;                     // 카 레일 날 중심 Z (car-local)
const shaftZ = -0.15;                  // 수평 작동 샤프트 Z (플랭크 뒤)
const sgX = CAR_BG / 2 - 0.055;        // 1.2575  웨지 중심 X (레일 날 위)
const RAIL_BACK_X = CAR_BG / 2;        // 1.3125  레일 뒷면. 하우징은 이보다 안쪽에 둔다.
const PLANK_BOTTOM_Y = baseY - 0.08;   // -1.4175 플랭크 하단
const STRIKE_PLATE_BOTTOM_Y = PLANK_BOTTOM_Y - 0.008; // 하단 완충 타격 플레이트 밑면 (-1.4255, elevator.js 112행)

// 하우징 외형 (X 범위 1.205~1.306: 플랫폼 측면 채널 1.20 바깥, 레일 뒷면 1.3125 안쪽)
const HOUSE_X_IN = 1.205, HOUSE_X_OUT = 1.306;
const HOUSE_CX = (HOUSE_X_IN + HOUSE_X_OUT) / 2, HOUSE_W = HOUSE_X_OUT - HOUSE_X_IN;
const HOUSE_Z0 = finZ - 0.12, HOUSE_Z1 = finZ + 0.12;        // -0.08 ~ 0.16
const HOUSE_H = 0.25;
const CAP_Y = baseY + 0.135, CAP_T = 0.026;
const BASE_Y = baseY - 0.135, BASE_T = 0.020;
const BLADE_SLOT = [finZ - 0.016, finZ + 0.016];             // 레일 날 통과 슬롯 (Z)

// 트립 레버 (샤프트 양단 바깥, 육각 보스 + 골드 판)
const LEVER_X = CAR_BG / 2 - 0.05 + 0.021;   // 1.2835  (크랭크·베어링 보스 바깥, 우측 클램프 암 1.34 안쪽)
const LEVER_T = 0.010, LEVER_LEN = 0.12, LEVER_W = 0.055;
const LEVER_PIN_DY = -0.10;                  // 복귀 스프링 로드 핀 (샤프트 기준 아래)

// 복귀 스프링 로드 (Z 방향, 레버 핀 → 타격 플레이트 밑 브라켓)
const ROD_Y = baseY + LEVER_PIN_DY;          // -1.4375  (타격 플레이트 밑면 -1.4335 아래 여유)
const ROD_Z0 = shaftZ, ROD_Z1 = 0.02, ROD_R = 0.006;
const BRACKET_Z = -0.030;

// ── 재질 (glTF PBR 호환: MeshStandardMaterial) ──
const M = {
  paint:   new THREE.MeshStandardMaterial({ color: 0x66817b, metalness: 0.30, roughness: 0.62 }), // 현대 민트그레이 도장 (장면 조명이 밝아 어둡게 잡음)
  paintDk: new THREE.MeshStandardMaterial({ color: 0x4f6660, metalness: 0.30, roughness: 0.64 }),
  guide:   new THREE.MeshStandardMaterial({ color: 0x3c4652, metalness: 0.82, roughness: 0.32 }),
  wedge:   new THREE.MeshStandardMaterial({ color: 0xeef2f7, metalness: 0.98, roughness: 0.12 }), // 폴리시드 실버
  carrier: new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.86, roughness: 0.28 }),
  chrome:  new THREE.MeshStandardMaterial({ color: 0xf2f5f9, metalness: 1.00, roughness: 0.05 }),
  shaft:   new THREE.MeshStandardMaterial({ color: 0xc2c9d1, metalness: 0.88, roughness: 0.24 }),
  spring:  new THREE.MeshStandardMaterial({ color: 0xa7b6c6, metalness: 0.82, roughness: 0.30 }),
  spring2: new THREE.MeshStandardMaterial({ color: 0x2a2f34, metalness: 0.60, roughness: 0.55 }), // 복귀 스프링 (흑색)
  bolt:    new THREE.MeshStandardMaterial({ color: 0x828a93, metalness: 0.72, roughness: 0.38 }),
  gold:    new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.85, roughness: 0.35 }), // 아연 황색 크로메이트 레버
  yellow:  new THREE.MeshStandardMaterial({ color: 0xe6c21a, metalness: 0.05, roughness: 0.65 }), // 케이블 그랜드·명판
};

function box(w, h, d, mat, x, y, z, parent, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, axis, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  parent.add(m);
  return m;
}
// Z방향으로 테이퍼진 웨지: 바닥 zBot, 상단 zTop 두께, X폭 wx, 높이 wy.
// 핀측(inner) 면은 수직 유지, 바깥면만 테이퍼(위로 갈수록 얇아짐 → 상승 시 핀에 파고듦).
function wedge(wx, wy, zBot, zTop, mat, x, y, z, innerSign, parent, name) {
  const g = new THREE.BoxGeometry(wx, wy, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vy = pos.getY(i);
    const top = vy > 0;
    const thick = top ? zTop : zBot;
    let vz = pos.getZ(i) * thick; // ±thick/2
    if (Math.sign(pos.getZ(i)) === innerSign) vz = innerSign * (zBot / 2);
    pos.setZ(i, vz);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}
// 코일 스프링 (헬릭스 TubeGeometry) — 축은 Y. scale.y로 압축 표현.
function coilSpring(radius, wire, height, turns, mat, x, y, z, parent, name, axis) {
  const pts = [];
  const seg = Math.ceil(turns * 40);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.0);
  const geo = new THREE.TubeGeometry(curve, seg, wire, 10, false);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

const root = new THREE.Group();
root.name = 'SafetyGear';

/* ─────────────────────────────────────────────────────────────
   수평 작동 샤프트 (조속기 로프 → 좌우 안전기 동시 작동) — 계약 노드
   ───────────────────────────────────────────────────────────── */
const shaft = new THREE.Group();
shaft.name = 'shaft';
shaft.position.set(0, baseY, shaftZ);
root.add(shaft);
cyl(0.013, 0.013, CAR_BG - 0.10, M.shaft, 0, 0, 0, shaft, 'x');                // 메인 샤프트
[-1, 1].forEach(s => {
  cyl(0.024, 0.024, 0.030, M.gold, s * (CAR_BG / 2 - 0.05), 0, 0, shaft, 'x', 6); // 육각 단부 (레버 결합)
  // 크랭크 암: 샤프트 → 리프트 로드 상단 핀 (Y +0.20, Z +0.227) 대각 연결
  const armLen = Math.hypot(0.20, 0.227);
  const arm = box(0.022, armLen, 0.024, M.shaft, s * sgX, 0.10, 0.1135, shaft);
  arm.rotation.x = Math.atan2(0.227, 0.20);
  cyl(0.008, 0.008, 0.040, M.chrome, s * sgX, 0.20, 0.227, shaft, 'x');           // 크랭크-로드 핀

  // 골드 트립 레버 (육각 보스 + 아래로 늘어진 판 + 라운드 노즈) — 현장 영상의 SAFETY (CAR) 레버
  const lx = s * LEVER_X;
  cyl(0.028, 0.028, LEVER_T + 0.004, M.gold, lx, 0, 0, shaft, 'x', 6);            // 육각 보스
  box(LEVER_T, LEVER_LEN, LEVER_W, M.gold, lx, -LEVER_LEN / 2 + 0.005, 0, shaft);  // 레버 판
  cyl(LEVER_W / 2, LEVER_W / 2, LEVER_T, M.gold, lx, -LEVER_LEN + 0.005, 0, shaft, 'x'); // 라운드 노즈
  cyl(0.006, 0.006, 0.026, M.chrome, lx, LEVER_PIN_DY, 0, shaft, 'x');             // 스프링 로드 핀
  box(0.014, 0.022, 0.022, M.gold, lx, LEVER_PIN_DY, 0, shaft);                    // 클레비스 블록
});
/* 조속기 로프 클램프는 이 블록에 없다(2026-09-12). 실물처럼 카 상부 크로스헤드
   트립 레버의 후방 크랭크가 로프를 물며, js/elevator.js §4-B 가 만든다.
   같은 로프를 상·하 두 군데서 무는 모순을 없애려고 하부 클램프 암을 걷어냈다. */

/* ─────────────────────────────────────────────────────────────
   좌우 안전기 블록
   ───────────────────────────────────────────────────────────── */
[['L', -1], ['R', 1]].forEach(([tag, s]) => {
  const bx = s * sgX;
  const hx = s * HOUSE_CX;

  // ── 하우징 (정적, 민트그레이 도장): 상판·하판은 레일 날 슬롯을 비우고 세 조각으로 ──
  const slotZ0 = BLADE_SLOT[0], slotZ1 = BLADE_SLOT[1];
  const bridgeW = 1.245 - HOUSE_X_IN;                 // 날 끝(1.2505) 안쪽 브리지
  [[CAP_Y, CAP_T], [BASE_Y, BASE_T]].forEach(([py, pt]) => {
    box(HOUSE_W, pt, slotZ0 - HOUSE_Z0, M.paint, hx, py, (HOUSE_Z0 + slotZ0) / 2, root);
    box(HOUSE_W, pt, HOUSE_Z1 - slotZ1, M.paint, hx, py, (slotZ1 + HOUSE_Z1) / 2, root);
    box(bridgeW, pt, slotZ1 - slotZ0, M.paint, s * (HOUSE_X_IN + bridgeW / 2), py, finZ, root);
  });
  // 전·후 조(jaw) 블록 (웨지 바깥쪽 벽)
  box(HOUSE_W, HOUSE_H, 0.034, M.paint, hx, baseY, HOUSE_Z0 + 0.017, root);
  box(HOUSE_W, HOUSE_H, 0.034, M.paint, hx, baseY, HOUSE_Z1 - 0.017, root);
  // 레일측(아웃보드) 벽 — 웨지 Z 구간은 비워 날이 지나간다
  box(0.010, HOUSE_H, (finZ - 0.046) - HOUSE_Z0, M.paintDk, s * (HOUSE_X_OUT - 0.005), baseY, (HOUSE_Z0 + finZ - 0.046) / 2, root);
  box(0.010, HOUSE_H, HOUSE_Z1 - (finZ + 0.046), M.paintDk, s * (HOUSE_X_OUT - 0.005), baseY, (finZ + 0.046 + HOUSE_Z1) / 2, root);
  // 상판 체결 육각 볼트 4개
  [[-0.045, HOUSE_Z0 + 0.03], [0.045, HOUSE_Z0 + 0.03], [-0.045, HOUSE_Z1 - 0.03], [0.045, HOUSE_Z1 - 0.03]].forEach(([dx, z]) => {
    cyl(0.008, 0.008, 0.010, M.bolt, hx + dx, CAP_Y + CAP_T / 2 + 0.005, z, root, undefined, 6);
  });
  // 황색 명판 (SAFETY (CAR) 바코드 라벨) — 전면 조 블록 앞면
  box(0.070, 0.028, 0.0015, M.yellow, hx, baseY + 0.06, HOUSE_Z0 - 0.0008, root);

  // 정적 테이퍼 가이드 블록 (전/후) — 웨지 바깥면과 맞물리는 경사
  [-1, 1].forEach(zs => {
    wedge(0.10, 0.20, 0.028, 0.060, M.guide, bx, baseY, finZ + zs * 0.058, -zs, root);
  });

  // ── 리프트 그룹 (상승) — 웨지 2개 + 캐리어 + 리프트 로드 — 계약 노드 ──
  const lift = new THREE.Group();
  lift.name = (tag === 'L') ? 'liftL' : 'liftR';
  root.add(lift);
  wedge(0.105, 0.185, 0.032, 0.015, M.wedge, bx, baseY + 0.008, finZ - 0.030,  1, lift, 'wedge' + tag + '0');
  wedge(0.105, 0.185, 0.032, 0.015, M.wedge, bx, baseY + 0.008, finZ + 0.030, -1, lift, 'wedge' + tag + '1');
  box(0.10, 0.024, 0.15, M.carrier, bx, baseY + 0.105, finZ, lift);                  // 웨지 캐리어 요크
  cyl(0.010, 0.010, 0.11, M.chrome, bx, baseY + 0.16, finZ + 0.037, lift);           // 리프트 로드 (요크 → 크랭크 핀)

  // U-스프링 (웨지 상단 압축 스프링) — 전/후 — 계약 노드
  coilSpring(0.026, 0.007, 0.085, 4, M.spring, bx, baseY + 0.075, finZ - 0.058, root, 'spring' + tag + '0');
  coilSpring(0.026, 0.007, 0.085, 4, M.spring, bx, baseY + 0.075, finZ + 0.058, root, 'spring' + tag + '1');

  // ── 복귀 스프링 로드 (레버 핀 → 타격 플레이트 밑 브라켓, Z 방향) ──
  const lx = s * LEVER_X;
  cyl(ROD_R, ROD_R, ROD_Z1 - ROD_Z0, M.chrome, lx, ROD_Y, (ROD_Z0 + ROD_Z1) / 2, root, 'z');
  // 브라켓: 타격 플레이트 밑면에서 내려오는 판, 로드 관통
  box(0.060, STRIKE_PLATE_BOTTOM_Y - (ROD_Y - 0.030), 0.006, M.paint, lx, (STRIKE_PLATE_BOTTOM_Y + ROD_Y - 0.030) / 2, BRACKET_Z, root);
  // 스프링 (브라켓 ↔ 조정 너트), 와셔, 더블 너트
  coilSpring(0.016, 0.0028, 0.082, 7, M.spring2, lx, ROD_Y, -0.074, root, undefined, 'z');
  cyl(0.020, 0.020, 0.003, M.bolt, lx, ROD_Y, -0.1165, root, 'z');
  cyl(0.011, 0.011, 0.008, M.bolt, lx, ROD_Y, -0.124, root, 'z', 6);
  cyl(0.011, 0.011, 0.008, M.bolt, lx, ROD_Y, -0.134, root, 'z', 6);
  cyl(0.011, 0.011, 0.008, M.bolt, lx, ROD_Y, -0.020, root, 'z', 6);
  cyl(0.011, 0.011, 0.008, M.bolt, lx, ROD_Y, -0.010, root, 'z', 6);

  /* 안전 스위치는 이 블록에 없다. 실물은 카 상부 크로스헤드 빔 앞면(캠 플레이트 옆)에 있고
     js/elevator.js 4-B 상부 크로스헤드 비상정지 연동부가 만든다 (docs/safety_switch_device/frames.md). */
});

// ── 익스포트 ──
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (result) => {
    if (!(result instanceof ArrayBuffer)) { console.error('EXPORT: expected ArrayBuffer, got', typeof result); process.exit(1); }
    const buf = Buffer.from(result); // ArrayBuffer → Buffer
    const out = new URL('../assets/safety_gear.glb', import.meta.url);
    writeFileSync(out, buf);
    console.log('WROTE', out.pathname, buf.length, 'bytes');
  },
  { binary: true, onlyVisible: true }
);
