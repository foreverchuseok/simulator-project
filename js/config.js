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
  // 와이어 로프 (선) — 주 로프용. 조속기 로프는 아래 ropeMesh() 실사 메시를 쓴다
  rope: () => new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 2 }),
  // 와이어 로프 (실사 메시) — 아연도금 강선
  ropeMesh: () => new THREE.MeshStandardMaterial({ color: 0x6e747c, metalness: 0.85, roughness: 0.42 }),

  /* ──────────────────────────────────────────────────────────────
     4. 프리미엄 인테리어 그레이드 (Champagne Graphite Titanium & Luxury Marble)
     참조: grok_image_1786678132161.jpg (PVD Fine Vertical Brushed + Nero Marble)
  ────────────────────────────────────────────────────────────── */
  // 샴페인 PVD 하이그로시 티타늄 (수직 브러시 + 클리어코트)
  pvdTitanium: (tint = 0xd8cfc2) => {
    const tex = _getPvdBrushedTexture();
    return new THREE.MeshPhysicalMaterial({
      color: tint,
      map: tex,
      metalness: 0.52,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.55
    });
  },
  // 카 바닥 보더 인레이 대리석
  luxuryMarble: () => {
    const tex = _getLuxuryMarbleTexture();
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex,
      metalness: 0.08,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
  },
  // 천장 코브 간접조명 (3000K 샴페인 웜화이트 발광)
  coveLight: (intensity = 1.8) => {
    return new THREE.MeshStandardMaterial({
      color: 0xfff0db,
      emissive: 0xffdfb0,
      emissiveIntensity: intensity,
      roughness: 0.1
    });
  },
  // 일반 승강기 프리미엄 실버 헤어라인 스테인리스 (밝고 고급스러운 은색)
  silverHairline: (tint = 0xe2e8f0, roughness = 0.32) => {
    const tex = _getSilverHairlineTexture();
    return new THREE.MeshStandardMaterial({
      color: tint,
      map: tex,
      metalness: 0.75,
      roughness: roughness,
      envMapIntensity: 1.3
    });
  }
};

/* ── 절차적 고해상도 PVD 수직 헤어라인 브러시 텍스처 캐시 ── */
let _pvdTextureCache = null;
function _getPvdBrushedTexture() {
  if (_pvdTextureCache) return _pvdTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 베이스 밝은 샴페인
  ctx.fillStyle = '#d6cec2';
  ctx.fillRect(0, 0, 512, 512);

  // 미세 수직 헤어라인 노이즈 스트라이프
  for (let x = 0; x < 512; x++) {
    const v = Math.sin(x * 1.8) * 0.5 + Math.random() * 0.5;
    const lum = Math.floor(v * 22 - 10);
    const r = Math.min(255, Math.max(0, 0xe0 + lum));
    const g = Math.min(255, Math.max(0, 0xd6 + lum - 2));
    const b = Math.min(255, Math.max(0, 0xc6 + lum - 4));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, 512);
  }

  // 부드러운 수직 그라데이션 광택 블렌딩
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, 'rgba(255, 252, 245, 0.28)');
  grad.addColorStop(0.3, 'rgba(210, 198, 180, 0.08)');
  grad.addColorStop(0.7, 'rgba(255, 250, 240, 0.32)');
  grad.addColorStop(1.0, 'rgba(200, 188, 170, 0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  _pvdTextureCache = new THREE.CanvasTexture(canvas);
  _pvdTextureCache.wrapS = THREE.RepeatWrapping;
  _pvdTextureCache.wrapT = THREE.RepeatWrapping;
  return _pvdTextureCache;
}

/* ── 절차적 럭셔리 네로 마르퀴나 대리석 + 보더 인레이 텍스처 캐시 ── */
let _marbleTextureCache = null;
function _getLuxuryMarbleTexture() {
  if (_marbleTextureCache) return _marbleTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 밝은 칼라카타 크림 베이스
  ctx.fillStyle = '#f3eee6';
  ctx.fillRect(0, 0, 512, 512);

  // 미세한 대리석 크랙 & 샴페인 베인 (Veins)
  ctx.strokeStyle = 'rgba(180, 160, 130, 0.28)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let cx = Math.random() * 512, cy = Math.random() * 512;
    ctx.moveTo(cx, cy);
    for (let j = 0; j < 6; j++) {
      cx += (Math.random() - 0.4) * 90;
      cy += (Math.random() - 0.3) * 90;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // 외곽 및 내부 더블 보더 인레이 라인 (샴페인 골드)
  ctx.strokeStyle = '#c4a574';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, 472, 472);

  ctx.strokeStyle = '#e8d5b0';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, 448, 448);

  _marbleTextureCache = new THREE.CanvasTexture(canvas);
  return _marbleTextureCache;
}

/* ── 절차적 고해상도 실버 스테인리스 수직 헤어라인 브러시 텍스처 캐시 ── */
let _silverTextureCache = null;
function _getSilverHairlineTexture() {
  if (_silverTextureCache) return _silverTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 밝고 은은한 프리미엄 실버 베이스
  ctx.fillStyle = '#dce2e8';
  ctx.fillRect(0, 0, 512, 512);

  // 미세 수직 헤어라인 노이즈 스트라이프
  for (let x = 0; x < 512; x++) {
    const v = Math.sin(x * 2.2) * 0.5 + Math.random() * 0.5;
    const lum = Math.floor(v * 24 - 12);
    const r = Math.min(255, Math.max(0, 0xd4 + lum));
    const g = Math.min(255, Math.max(0, 0xda + lum));
    const b = Math.min(255, Math.max(0, 0xe2 + lum));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, 512);
  }

  // 부드러운 수직 메탈릭 광택 하이라이트 블렌딩
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(0.25, 'rgba(200, 210, 225, 0.10)');
  grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.22)');
  grad.addColorStop(1.0, 'rgba(195, 205, 220, 0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  _silverTextureCache = new THREE.CanvasTexture(canvas);
  _silverTextureCache.wrapS = THREE.RepeatWrapping;
  _silverTextureCache.wrapT = THREE.RepeatWrapping;
  return _silverTextureCache;
}
