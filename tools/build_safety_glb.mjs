// 안전기(Safety Gear) .glb 생성기 — device_china.mp4 27~43초 물림 장치 기반
// 출력: assets/safety_gear.glb  (js/elevator.js buildCarCabin에서 GLTFLoader로 로드)
//
// 실행 방법 (프로젝트 루트에서):
//   npm i -D three@0.128.0        # 앱은 CDN r128 사용, 이 스크립트만 npm three 필요
//   node tools/build_safety_glb.mjs
// (node_modules는 .gitignore 대상. 앱 실행에는 불필요 — 커밋된 .glb만 있으면 됨.)
//
// three@0.128.0 + GLTFExporter (Node). 카-로컬 좌표로 빌드해 carGrp 원점에 부착.
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

// ── 카-로컬 상수 (index.html / config.js 파생값과 일치) ──
const H = 2.355;                 // S.CAR_H
const CAR_BG = 2.625;            // S.CAR_BG (레일 중심 간격)
const baseY = -H / 2 - 0.16;     // -1.3375  안전기 하우징 중심 Y
const GOV_TENS_X = CAR_BG / 2 + 0.115; // 1.4275  조속기 로프 수직선 X
const finZ = 0.04;               // 카 레일 블레이드 중심 Z (car-local)
const shaftZ = -0.15;            // 수평 작동 샤프트 Z
const sgX = CAR_BG / 2 - 0.055;  // 1.2575  안전기 블록 중심 X (레일 블레이드 위)

// ── 재질 (glTF PBR 호환: MeshStandardMaterial) ──
const M = {
  housing: new THREE.MeshStandardMaterial({ color: 0x4f5d6c, metalness: 0.80, roughness: 0.38 }), // 스틸블루(영상 톤)
  guide:   new THREE.MeshStandardMaterial({ color: 0x3c4652, metalness: 0.82, roughness: 0.32 }),
  wedge:   new THREE.MeshStandardMaterial({ color: 0xeef2f7, metalness: 0.98, roughness: 0.12 }), // 폴리시드 실버
  carrier: new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.86, roughness: 0.28 }),
  chrome:  new THREE.MeshStandardMaterial({ color: 0xf2f5f9, metalness: 1.00, roughness: 0.05 }),
  shaft:   new THREE.MeshStandardMaterial({ color: 0xc2c9d1, metalness: 0.88, roughness: 0.24 }),
  spring:  new THREE.MeshStandardMaterial({ color: 0xa7b6c6, metalness: 0.82, roughness: 0.30 }),
  bolt:    new THREE.MeshStandardMaterial({ color: 0x828a93, metalness: 0.72, roughness: 0.38 }),
  clampM:  new THREE.MeshStandardMaterial({ color: 0xccd2d9, metalness: 0.9,  roughness: 0.20 }),
};

function box(w, h, d, mat, x, y, z, parent, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, axis) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), mat);
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
    // inner 면(핀 쪽, innerSign 방향)은 수직 고정, 바깥면만 테이퍼
    // innerSign>0 이면 +z가 inner. inner쪽 좌표는 항상 zBot/2 기준으로 고정.
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
function coilSpring(radius, wire, height, turns, mat, x, y, z, parent, name) {
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
  if (name) m.name = name;
  parent.add(m);
  return m;
}

const root = new THREE.Group();
root.name = 'SafetyGear';

// ── 수평 작동 샤프트 (조속기 로프 → 좌우 안전기 동시 작동) ──
const shaft = new THREE.Group();
shaft.name = 'shaft';
shaft.position.set(0, baseY, shaftZ);
root.add(shaft);
cyl(0.013, 0.013, CAR_BG - 0.10, M.shaft, 0, 0, 0, shaft, 'x');            // 메인 샤프트
[-1, 1].forEach(s => {
  cyl(0.020, 0.020, 0.030, M.shaft, s * (CAR_BG / 2 - 0.05), 0, 0, shaft, 'x'); // 베어링 칼라
  box(0.022, 0.024, 0.075, M.shaft, s * sgX, 0, 0.037, shaft);              // 크랭크 암 (샤프트→리프트)
});
// 조속기 로프 클램프 암 (우측 단부 → GOV_TENS_X 로 뻗음)
box(0.175, 0.020, 0.26, M.shaft, GOV_TENS_X - 0.0875, 0, -0.10, shaft);
box(0.028, 0.10, 0.028, M.clampM, GOV_TENS_X, 0, -0.22, shaft, 'clamp');
box(0.05, 0.05, 0.05, M.bolt, GOV_TENS_X, 0.02, -0.22, shaft);

// ── 좌우 안전기 블록 ──
[['L', -1], ['R', 1]].forEach(([tag, s]) => {
  const bx = s * sgX;

  // 하우징 (정적): 아웃보드 백플레이트 + 상단캡 + 정적 테이퍼 가이드(전/후)
  box(0.024, 0.26, 0.21, M.housing, bx + s * 0.072, baseY, finZ, root);      // 백플레이트(벽측)
  box(0.17, 0.026, 0.21, M.housing, bx, baseY + 0.135, finZ, root);         // 상단 캡
  box(0.17, 0.020, 0.21, M.guide, bx, baseY - 0.135, finZ, root);          // 하단 플레이트
  // 정적 테이퍼 가이드 블록 (전/후) — 웨지 바깥면과 맞물리는 경사
  [-1, 1].forEach(zs => {
    wedge(0.11, 0.20, 0.028, 0.060, M.guide, bx, baseY, finZ + zs * 0.058, -zs, root);
  });
  // 사이드 볼트 디테일
  [-0.085, 0.085].forEach(zb => box(0.03, 0.03, 0.03, M.bolt, bx + s * 0.072, baseY + 0.10, finZ + zb, root));

  // 리프트 그룹 (상승) — 웨지 2개 + 캐리어 + 리프트 로드
  const lift = new THREE.Group();
  lift.name = (tag === 'L') ? 'liftL' : 'liftR';
  root.add(lift);
  // 폴리시드 트윈 웨지 (핀 전/후면 그립) — 상단이 하우징 밖으로 살짝 올라와 잘 보이도록
  wedge(0.105, 0.185, 0.032, 0.015, M.wedge, bx, baseY + 0.008, finZ - 0.030,  1, lift, 'wedge' + tag + '0');
  wedge(0.105, 0.185, 0.032, 0.015, M.wedge, bx, baseY + 0.008, finZ + 0.030, -1, lift, 'wedge' + tag + '1');
  // 웨지 캐리어 요크 (상단 연결)
  box(0.11, 0.024, 0.15, M.carrier, bx, baseY + 0.105, finZ, lift);
  // 리프트 로드 (요크→샤프트 크랭크)
  cyl(0.010, 0.010, 0.14, M.chrome, bx, baseY + 0.16, finZ + 0.037, lift);

  // U-스프링 (웨지 상단 압축 스프링) — 전/후
  coilSpring(0.026, 0.007, 0.085, 4, M.spring, bx, baseY + 0.075, finZ - 0.058, root, 'spring' + tag + '0');
  coilSpring(0.026, 0.007, 0.085, 4, M.spring, bx, baseY + 0.075, finZ + 0.058, root, 'spring' + tag + '1');

  // 폴리시드 가이드 로드 2개 (하우징 관통, 세로)
  [-0.088, 0.088].forEach(zr => cyl(0.010, 0.010, 0.30, M.chrome, bx, baseY, finZ + zr, root));

  // 하부 가이드 슈 (레일 유지)
  box(0.13, 0.075, 0.10, M.guide, bx, baseY - 0.175, finZ, root);
  box(0.04, 0.075, 0.05, M.housing, bx - s * 0.04, baseY - 0.175, finZ, root);
});

// ── 익스포트 ──
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (result) => {
    if (!(result instanceof ArrayBuffer)) { console.error('EXPORT: expected ArrayBuffer, got', typeof result); process.exit(1); }
    const buf = Buffer.from(result); // ArrayBuffer → Buffer
    const out = 'C:/Users/goodm/Desktop/simmul/assets/safety_gear.glb';
    writeFileSync(out, buf);
    console.log('WROTE', out, buf.length, 'bytes');
  },
  { binary: true, onlyVisible: true }
);
