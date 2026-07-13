// 전역 도면 제원과 PBR 재질 라이브러리를 정의한다.
/* ==========================================================================
   1. 도면 제원 설정 (N21436 완벽 반영)
   ========================================================================== */

/* ──────────────────────────────────────────────────────────────────────────
   ★ 카 깊이(세로) 확장 노브 — 폭·높이 불변, 오직 깊이(Z, 전후)만 배율 ★
   1.0 = 기준(원본 1350 × 1.5 = 2025mm). 이 값 하나만 바꾸면
   전면(승장·도어)은 고정된 채 카가 후방으로만 깊어지고, 그에 맞춰
   기계실 슬래브·주도르래·체대·편향도르래·균형추(위치/레일/완충기)·
   카 가이드레일·랜딩센서·피트까지 index.html 파생상수로 자동 연동된다.
   (연동 원리: index.html의 CAR_FRONT_Z 고정 앵커 + CAR_CTR_Z / CWT_CENTER_Z /
    SHAFT_BACK_Z 파생. 세로 높이 확장 노브 V_SCALE 과는 독립적이다.)
   ────────────────────────────────────────────────────────────────────────── */
const CAR_D_BASE = 2.025;        // 기준 카 깊이 (불변)
const CAR_DEPTH_SCALE = 1.25;    // ← 여기만 조절 (1.0=기준, 1.25=+25%)

const S = {
  // 승강로 내부 (폭·깊이 1.5배 확장, 높이 유지)
  // SHAFT_D 는 "전면 기준" 공칭 깊이. 카 깊이 확장 시 실제 승강로 후면은
  // index.html SHAFT_BACK_Z 로만 뒤로 늘어난다(전면·로비·외부는 불변).
  SHAFT_W: 3.33,
  SHAFT_D: 3.465,
  WALL_T: 0.28,

  // 12인승 카 규격 — 폭·높이 유지, 깊이만 CAR_DEPTH_SCALE 배율
  CAR_W: 2.40,
  CAR_D: CAR_D_BASE * CAR_DEPTH_SCALE,
  CAR_H: 2.355,
  CAR_BG: 2.625, // 카 레일 중심 간 거리 (원본 1.75 × 1.5)

  // 균형추 규격 (후면 배치)
  CWT_W: 1.38,  // 균형추 레일간 거리 (원본 0.92 × 1.5)
  CWT_D: 0.20,
  CWT_H: 1.60,

  // 기계실 및 도어
  MR_H: 2.075,
  TM_W: 0.85,
  TM_D: 0.65,
  TM_H: 0.55,
  DOOR_W: 1.50,
  DOOR_H: 2.10
};

/* ==========================================================================
   3. PBR 재질 라이브러리
   ========================================================================== */
const M = {
  // 스테인리스 헤어라인 (metalness를 0.3으로 낙추어 검게 타는 현상 방지)
  ss: (c = 0xd8e0e8) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.6 }),
  // 자동차 도장 느낌 (기계부품, 빔)
  paint: (c = 0xf1c40f) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.1, roughness: 0.5, clearcoat: 0.8 }),
  // 콘크리트 및 바닥재
  conc: (c = 0xd5dadf) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0.0 }),
  marble: () => new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.2, metalness: 0.1 }),
  floor: () => new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8, metalness: 0.1 }),
  // 포인트 (골드, 점형블록)
  gold: () => new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.5, roughness: 0.3 }),
  tactile: () => new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.92, metalness: 0.05 }),
  // 유리
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x90c8e8, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1, ior: 1.5, side: THREE.DoubleSide }),
  // 발광체 (버튼, 층표시기)
  emit: (c, i = 1.0) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i }),
  // 와이어 로프
  rope: () => new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 2 })
};
