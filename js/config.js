// 전역 도면 제원과 PBR 재질 라이브러리를 정의한다.
/* ==========================================================================
   1. 도면 제원 설정 (N21436 완벽 반영)
   ========================================================================== */
const S = {
  // 승강로 내부
  SHAFT_W: 2.22,
  SHAFT_D: 2.31,
  WALL_T: 0.28,

  // 15인승 카 규격
  CAR_W: 1.80,
  CAR_D: 1.50,
  CAR_H: 2.50,
  CAR_BG: 1.95, // 카 레일간 거리

  // 균형추 규격 (후면 배치)
  CWT_W: 0.92,  // 균형추 레일간 거리 920mm(5K)
  CWT_D: 0.20,
  CWT_H: 1.60,

  // 기계실 및 도어
  MR_H: 2.075,
  TM_W: 0.85,
  TM_D: 0.65,
  TM_H: 0.55,
  DOOR_W: 1.00,
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
  // 포인트 (골드, 점자블록)
  gold: () => new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.5, roughness: 0.3 }),
  tactile: () => new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.9, metalness: 0.1, bumpScale: 0.02 }),
  // 유리
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x90c8e8, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1, ior: 1.5, side: THREE.DoubleSide }),
  // 발광체 (버튼, 층표시기)
  emit: (c, i = 1.0) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i }),
  // 와이어 로프
  rope: () => new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 2 })
};
