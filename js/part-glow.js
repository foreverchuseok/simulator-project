/* 기능 부품 발광 + 탭 메뉴 (2026-09-30).
   떠 있는 원형 아이콘 대신 부품 자체가 게임 아이템처럼 테두리가 빛나고, 누르면 메뉴가 열린다.
   · 각 모듈의 .part-action 버튼은 그대로 "행동 핸들러"다. 클릭 로직·사거리 판정(hidden)·패널 위치 기준을 그대로 쓴다.
     화면에서는 CSS 로 숨기고, 이 모듈이 bind(button, 대상, 이름) 로 받은 3D 부품을 빛낸다.
   · 발광은 부품마다 독립 Scene(part.root)을 메인 렌더 직후 autoClear=false 로 덧그린다(부품마다 스텐실 비움) → 메인 깊이 버퍼로 가려지고
     장면 계층·그림자 캐시·다른 모듈의 traverse 를 건드리지 않는다. 셸은 매 프레임 원본 matrixWorld 를 복사한다.
   · 림(앞면, 스텐실 1 기록) → 윤곽(뒷면, 화면공간 폭, 스텐실≠1) 순서라 부품 내부 선 없이 바깥 테두리만 빛난다.
   · 설정 「부품 빛 효과」를 꺼도 탭·호버 강조는 동작한다(항상 빛나는 것만 끈다). */
const PartGlow = (() => {
  const MAX_MESHES = 28, STORE = 'partGlowEnabled';
  const IDLE = new THREE.Color(0xffb20f), HOT = new THREE.Color(0xfff2c8),   // 2026-09-30 사용자: 금색 유지·세기 한 단계 약하게(푸른빛은 반려)
        OFF = new THREE.Color(0x9fb3c4);
  const entries = [], parts = [];
  const time = { value: 0 }, res = { value: new THREE.Vector2(1, 1) };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3(), box = new THREE.Box3();
  const shellCache = new WeakMap();
  let lastNow = 0, enabled = true, frame = 0, hover = null, menuPart = null, menu, tip, pointer = null, lastOpen = { part: null, time: 0 };
  let tapPt = null, hudDismissed = false, zoomedEvent = null, slowCloseHook = null, wasMobileMode = false;
  const activePointers = new Map();
  // 모바일 Tier 1 터치 표시 고리(2026-11-22): 단일 THREE.Points 드로우콜(+1회, 스텐실 0회).
  const MAX_BEACONS = 32, OVERVIEW_DIST = 12;
  const OVERVIEW_REPS = new Map([
    ['과속 조절기', 10], ['로프브레이크', 9], ['권상기 주브레이크', 9], ['제어반', 8],
    ['ARD 자동구출장치', 8], ['카 완충기', 8], ['균형추 완충기', 8], ['카 상부 주로프', 7], ['1층 승장문 비상키', 7], ['피트 사다리', 6]
  ]);
  let beaconScene = null, beaconPts = null, beaconGeo = null, beaconMat = null, beaconCount = 0;
  let beaconPosArr = null, beaconPhaseArr = null, beaconScaleArr = null, beaconHits = [];
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const _bDir = new THREE.Vector3(), _bSize = new THREE.Vector3(), _bProj = new THREE.Vector3(), _bPos = new THREE.Vector3(), _bInv = new THREE.Matrix4();
  // 비콘 기준점(경계상자 윗면)은 부품별로 이 프레임 간격마다 엇갈려 다시 잰다. 그 사이에는 기준 노드의 변환만 따라간다(카 이동 추종).
  const BEACON_BOX_FRAMES = 30;
  try { enabled = localStorage.getItem(STORE) !== '0'; } catch (e) { /* 저장소 없음 */ }

  /* ── 셰이더 ── */
  const hullVS = `
    attribute vec3 smoothN; uniform float uWidth; uniform vec2 uRes;
    void main(){
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec3 nv = normalize(normalMatrix * smoothN);
      vec2 d = (projectionMatrix * vec4(nv, 0.0)).xy * uRes;
      float l = length(d);
      if (l > 1e-6) clip.xy += d / l * uWidth * 2.0 / uRes * clip.w;
      gl_Position = clip;
    }`;
  const hullFS = `
    uniform vec3 uColor; uniform float uAlpha;
    void main(){ gl_FragColor = vec4(uColor, uAlpha); }`;
  const rimVS = `
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const rimFS = `
    uniform vec3 uColor; uniform float uAlpha; uniform float uBase;
    varying vec3 vN; varying vec3 vV;
    void main(){
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
      gl_FragColor = vec4(uColor, (uBase + f) * uAlpha);
    }`;
  const sparkVS = `
    attribute float aPhase; uniform float uTime; uniform float uRise; uniform float uSize; uniform float uAlpha;
    varying float vA;
    void main(){
      float t = fract(uTime * (0.22 + fract(aPhase * 7.13) * 0.18) + aPhase);
      vec3 p = position; p.y += t * uRise;
      vA = sin(t * 3.14159) * (0.55 + 0.45 * sin(uTime * 6.0 + aPhase * 40.0)) * uAlpha;
      gl_PointSize = uSize * (0.6 + 0.4 * sin(t * 3.14159));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const sparkFS = `
    uniform vec3 uColor; varying float vA;
    void main(){
      vec2 p = gl_PointCoord - 0.5; float d = length(p);
      float core = pow(max(0.0, 1.0 - d * 2.0), 3.0);
      float star = max(0.0, 1.0 - abs(p.x) * 14.0) * max(0.0, 1.0 - abs(p.y) * 2.0)
                 + max(0.0, 1.0 - abs(p.y) * 14.0) * max(0.0, 1.0 - abs(p.x) * 2.0);
      float a = (core + star * 0.8) * vA;
      if (a < 0.01) discard;
      gl_FragColor = vec4(mix(uColor, vec3(1.0), core), a);
    }`;
  // 밝은 하늘·벽에서도 금색이 보이도록 일반 혼합을 쓴다(가산 혼합은 흰색으로 날아간다).
  const blend = { transparent: true, depthWrite: false };
  // 모바일 Tier 1 터치 표시 고리 셰이더: 얇은 고정 고리 + 가운데 작은 점 + 퍼지는 고리 1개(평평한 금색 + 어두운 갈색 테두리).
  const beaconVS = `
    attribute float aPhase;
    attribute float aScale;
    uniform float uBaseSize;
    uniform float uDpr;
    varying float vPhase;
    varying float vScale;
    void main(){
      vPhase = aPhase;
      vScale = aScale;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uBaseSize * uDpr * aScale;
    }`;
  const beaconFS = `
    uniform float uTime;
    uniform float uDim;
    uniform float uReduced;
    varying float vPhase;
    varying float vScale;
    void main(){
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p);
      if (d > 0.5) discard;
      float aa = 0.015;
      // 1) 얇은 고정 고리(가운데 비움) + 2) 가운데 작은 점
      float staticDist = abs(d - 0.22);
      float staticGold = 1.0 - smoothstep(0.020, 0.020 + aa, staticDist);
      float staticEdge = 1.0 - smoothstep(0.031, 0.031 + aa, staticDist);
      float dotGold = 1.0 - smoothstep(0.048, 0.048 + aa, d);
      float dotEdge = 1.0 - smoothstep(0.060, 0.060 + aa, d);
      float baseGold = max(staticGold, dotGold);
      float baseRim  = max(staticEdge, dotEdge) * (1.0 - baseGold);
      // 3) 천천히 퍼지며 사라지는 고리 1개 (움직임은 이것 하나만, uReduced에서는 끔)
      float t = fract(uTime * 0.36 + vPhase);
      float ringR = 0.22 + t * 0.24;
      float ringEnv = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.45, 1.0, t));
      float ringDist = abs(d - ringR);
      float ringGold = uReduced > 0.5 ? 0.0 : (1.0 - smoothstep(0.013, 0.013 + aa, ringDist)) * ringEnv;
      float ringEdge = uReduced > 0.5 ? 0.0 : (1.0 - smoothstep(0.022, 0.022 + aa, ringDist)) * ringEnv;
      float ringRim  = max(0.0, ringEdge - ringGold);
      // 평평한 금색 한 톤 + 반투명 어두운 갈색 테두리(흰색 발광·번짐 없음)
      float gA = max(baseGold * 0.94, ringGold * 0.65);
      float rA = max(baseRim * 0.48, ringRim * 0.28) * (1.0 - baseGold);
      float outA = gA + rA * (1.0 - gA);
      float alpha = clamp(outA * uDim, 0.0, 1.0);
      if (alpha < 0.015) discard;
      vec3 gold = vec3(0.98, 0.76, 0.22);
      vec3 rim  = vec3(0.26, 0.16, 0.04);
      vec3 col = (gold * gA + rim * rA * (1.0 - gA)) / max(outA, 1e-4);
      gl_FragColor = vec4(col, alpha);
    }`;
  // 스텐실: 부품 몸체 3 → 안쪽 띠 2 → 바깥 띠 1. GREATER 비교로 각 픽셀을 한 번만 칠해 겹침 농도 얼룩이 없다.
  const band = ref => ({ stencilWrite: true, stencilRef: ref, stencilFunc: THREE.GreaterStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp });

  function makeMaterials() {
    const color = { value: IDLE.clone() };
    const rim = new THREE.ShaderMaterial({ ...blend, vertexShader: rimVS, fragmentShader: rimFS, side: THREE.FrontSide,
      uniforms: { uColor: color, uAlpha: { value: 0 }, uBase: { value: .1 } },
      depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      stencilWrite: true, stencilRef: 3, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    const inner = new THREE.ShaderMaterial({ ...blend, ...band(2), vertexShader: hullVS, fragmentShader: hullFS, side: THREE.BackSide,
      uniforms: { uColor: color, uAlpha: { value: 0 }, uWidth: { value: 3 }, uRes: res } });
    const outer = new THREE.ShaderMaterial({ ...blend, ...band(1), vertexShader: hullVS, fragmentShader: hullFS, side: THREE.BackSide,
      uniforms: { uColor: color, uAlpha: { value: 0 }, uWidth: { value: 7 }, uRes: res } });
    const spark = new THREE.ShaderMaterial({ ...blend, vertexShader: sparkVS, fragmentShader: sparkFS,
      uniforms: { uColor: color, uTime: time, uRise: { value: .1 }, uSize: { value: 12 }, uAlpha: { value: 0 } } });
    return { color, rim, inner, outer, spark };
  }

  /* ── 셸 형상: 원본 position/index 공유 + 위치별 평균 법선(윤곽 틈 방지) ── */
  function shellGeometry(src) {
    let g = shellCache.get(src);
    if (g) return g;
    const pos = src.attributes.position, n = pos.count;
    let nor = src.attributes.normal;
    if (!nor) { const tmp = src.clone(); tmp.computeVertexNormals(); nor = tmp.attributes.normal; }
    const groups = new Map(), smooth = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const key = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(i);
    }
    const seen = [];
    for (const list of groups.values()) {
      let x = 0, y = 0, z = 0;
      seen.length = 0;
      for (const i of list) {
        const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        if (seen.some(s => Math.abs(s[0] - nx) + Math.abs(s[1] - ny) + Math.abs(s[2] - nz) < .02)) continue;
        seen.push([nx, ny, nz]); x += nx; y += ny; z += nz;
      }
      const l = Math.hypot(x, y, z) || 1;
      for (const i of list) { smooth[i * 3] = x / l; smooth[i * 3 + 1] = y / l; smooth[i * 3 + 2] = z / l; }
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    g.setAttribute('normal', nor);
    g.setAttribute('smoothN', new THREE.BufferAttribute(smooth, 3));
    if (src.index) g.setIndex(src.index);
    g.drawRange = src.drawRange;
    if (!src.boundingSphere) src.computeBoundingSphere();
    g.boundingSphere = src.boundingSphere;
    shellCache.set(src, g);
    return g;
  }

  /* ── 등록 ── */
  // resolve: () => Object3D | Object3D[] | null. 같은 대상에 묶인 버튼들은 한 부품 메뉴로 합친다.
  // options.hitTest(raycaster): 가느다란 부품의 선택 여유. 반환 distance에도 공통 가림 판정을 적용한다.
  function bind(button, resolve, name, label, options = {}) {
    if (!button || entries.some(e => e.button === button)) return;
    entries.push({ button, resolve, name, label, ...options, part: null });
  }
  const list = o => (Array.isArray(o) ? o : [o]).filter(Boolean);
  // 대상이 다시 만들어지는 경우(속도 변경 시 완충기 재생성 등)를 위해 주기적으로 다시 확인한다.
  function resolveEntry(e, recheck) {
    if (e.part && !recheck) return e.part;
    let objects;
    try { objects = list(e.resolve()); } catch (err) { objects = []; }
    const key = objects.map(o => o.uuid).join('|');
    if (e.part && e.part.key === key) return e.part;
    if (e.part) { e.part.entries.splice(e.part.entries.indexOf(e), 1); e.part = null; }
    if (!objects.length) return null;
    let part = parts.find(p => p.key === key);
    if (!part) {
      part = { key, objects, name: e.name, entries: [], mats: makeMaterials(), shells: [], meshes: [], sparkle: null,
        root: new THREE.Scene(), built: -1, checked: 0, active: false, glow: 0, center: new THREE.Vector3(), size: 0.1 };
      part.root.visible = false; part.root.autoUpdate = false;   // 부품마다 독립 장면: 스텐실을 비우고 따로 그린다
      parts.push(part);
    }
    part.entries.push(e);
    e.part = part;
    return part;
  }

  function collectMeshes(part) {
    const meshes = [];
    for (const o of part.objects) o.traverse(m => {
      if (m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.geometry?.attributes?.position && !m.userData.noGlow) meshes.push(m);
    });
    return meshes;
  }
  function build(part, meshes) {
    for (const s of part.shells) part.root.remove(s.rim, s.inner, s.outer);
    if (part.sparkle) part.root.remove(part.sparkle);
    part.shells = []; part.meshes = meshes;
    part.built = meshes.length;
    if (!meshes.length) return;
    part.objects[0].updateWorldMatrix(true, true);
    box.makeEmpty();
    const ranked = meshes.map(m => {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      m.getWorldScale(v);
      const r = m.geometry.boundingSphere.radius * Math.max(v.x, v.y, v.z);
      box.expandByObject(m);
      return { m, r };
    }).sort((a, b) => b.r - a.r);
    const size = box.getSize(v).length() || .1, keep = ranked.filter((x, i) => i < MAX_MESHES && (ranked.length <= 16 || x.r > size * .05));
    for (const { m } of keep) {
      const geo = shellGeometry(m.geometry);
      const rim = new THREE.Mesh(geo, part.mats.rim), inner = new THREE.Mesh(geo, part.mats.inner), outer = new THREE.Mesh(geo, part.mats.outer);
      for (const s of [rim, inner, outer]) { s.matrixAutoUpdate = false; s.frustumCulled = false; s.raycast = () => {}; }
      inner.renderOrder = 1; outer.renderOrder = 2;
      // 부품 루트까지의 조상 목록 — 매 프레임 가시 판정을 계층 걷기 없이 한다.
      const chain = [];
      for (let p = m; p; p = p.parent) { chain.push(p); if (part.objects.includes(p)) break; }
      part.shells.push({ src: m, rim, inner, outer, chain });
      part.root.add(rim, inner, outer);
    }
    // 반짝이: 첫 대상 로컬 좌표의 경계상자 둘레에서 떠오른다.
    const anchor = part.objects[0], inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const local = box.clone().applyMatrix4(inv), ls = local.getSize(new THREE.Vector3());
    const count = Math.max(5, Math.min(12, Math.round(size * 10)));
    const pts = new Float32Array(count * 3), phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const edge = i % 2;
      pts[i * 3] = local.min.x + ls.x * (edge ? Math.round(Math.random()) : Math.random());
      pts[i * 3 + 1] = local.min.y + ls.y * Math.random() * .8;
      pts[i * 3 + 2] = local.min.z + ls.z * (edge ? Math.random() : Math.round(Math.random()));
      phase[i] = i / count + Math.random() * .1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    part.sparkle = new THREE.Points(g, part.mats.spark);
    part.sparkle.matrixAutoUpdate = false; part.sparkle.frustumCulled = false; part.sparkle.renderOrder = 3;
    part.mats.spark.uniforms.uRise.value = THREE.MathUtils.clamp(ls.y * .45, .04, .35);
    part.root.add(part.sparkle);
    part.size = size;
  }

  /* ── 상태 ── */
  const bodyHas = c => document.body.classList.contains(c);
  // 모바일(세로·가로 폰 HUD) 일반 화면: 1탭 → 소형 팝업 → 버튼 실행(2026-11-22 Phase 2).
  // 승곰이 체험 중 카 안 버튼은 기존 즉시 동작을 유지한다.
  const isMobileGeneral = () => typeof MobileHUD !== 'undefined' && MobileHUD.isMobile() && !(typeof CharacterWalk !== 'undefined' && CharacterWalk.active);
  const mobileDemoRunning = () => isMobileGeneral() && typeof MobileHUD !== 'undefined' && MobileHUD.mode === 'demo';
  function suppressed(e) {
    if (typeof DemoPause !== 'undefined' && DemoPause.paused) return true;
    if (e.direct && e.button.id.startsWith('ec-action-')) return false;
    if (typeof overspeedActive !== 'undefined' && overspeedActive) return true;
    if (bodyHas('ucm-active') || bodyHas('ard-active') || bodyHas('manual-rescue-active') || bodyHas('photo-eye-active') || bodyHas('rope-measure-active') || bodyHas('terminal-demo-active') || bodyHas('portrait-tools-hidden')) return true;
    if (bodyHas('buffer-demo-active') && !/buffer-demo-action$/.test(e.button.id)) return true;
    return false;
  }
  const liveEntries = part => {
    const mobileRep = isMobileGeneral() && OVERVIEW_REPS.has(part.name);
    return part.entries.filter(e => (!e.button.hidden || mobileRep) && !suppressed(e));
  };
  function worldVisible(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

  function refresh() {
    for (const e of entries) resolveEntry(e, frame % 30 === 0);
    for (const part of parts) {
      const live = liveEntries(part);
      part.active = live.length > 0 && worldVisible(part.objects[0]);
      if (!part.active) continue;
      if (part.built < 0 || (frame - part.checked > 60)) {
        part.checked = frame;
        const meshes = collectMeshes(part);
        if (meshes.length !== part.built) build(part, meshes);
      }
      if (!part.shells.length) part.active = false;
    }
  }

  function syncPart(part, now, ease) {
    const mobileGeneral = isMobileGeneral();
    const lit = hover === part || menuPart === part;
    const live = liveEntries(part), dim = live.every(e => e.button.disabled);
    // 모바일 일반 화면은 선택한 부품 1개만 금색 강조(Phase 2). 기본 화면 드로우콜 증가 없음.
    const target = !part.active || mobileDemoRunning() ? 0 : mobileGeneral ? (menuPart === part ? 1 : 0) : lit ? 1 : enabled ? .72 : 0;
    part.glow += (target - part.glow) * ease;   // 시간 기준(프레임 속도와 무관하게 약 0.2초)
    if (part.glow < .01) { part.root.visible = false; return; }
    part.root.visible = true;
    const pulse = lit ? 1 : .8 + .2 * Math.sin(now * 3.4 + part.key.length);
    const a = part.glow * pulse * (dim ? .45 : 1);
    const m = part.mats;
    const dpr = renderer.getPixelRatio(), breathe = Math.sin(now * 3.4 + part.key.length);
    m.color.value.copy(dim ? OFF : IDLE).lerp(HOT, lit ? .45 : 0);
    m.rim.uniforms.uAlpha.value = a * (lit ? .42 : .22);
    m.inner.uniforms.uAlpha.value = Math.min(1, a * (lit ? 1.1 : .85));
    m.inner.uniforms.uWidth.value = (lit ? 3 : 2) * dpr;
    m.outer.uniforms.uAlpha.value = a * (lit ? .28 : .2);
    m.outer.uniforms.uWidth.value = (lit ? 8 : 5.5 + 1.2 * breathe) * dpr;
    m.spark.uniforms.uAlpha.value = a * (lit ? 1 : .7);
    m.spark.uniforms.uSize.value = (lit ? 15 : 11) * dpr;
    for (const s of part.shells) {
      const shown = s.chain.every(p => p.visible) && s.src.material && [].concat(s.src.material).some(x => x.visible);
      s.rim.visible = s.inner.visible = s.outer.visible = shown;
      if (shown) for (const x of [s.rim, s.inner, s.outer]) x.matrixWorld.copy(s.src.matrixWorld);
    }
    part.sparkle.matrixWorld.copy(part.objects[0].matrixWorld);
  }

  /* ── 선택 ── */
  function pickAt(x, y) {
    const mobile = isMobileGeneral(), pad = mobile ? 22 : 16;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null;
    for (const part of parts) {
      if (!part.active) continue;
      const meshes = part.meshes.filter(m => worldVisible(m));
      let hit = ray.intersectObjects(meshes, false)[0];
      if (!hit) for (const e of liveEntries(part)) {
        const candidate = e.hitTest?.(ray);
        if (candidate && (!hit || candidate.distance < hit.distance)) hit = candidate;
      }
      if (!hit) continue;
      // 부품 안에 든 부품(제어반 ⊃ 점검운전 스위치)은 같은 면을 맞히므로 더 작은 쪽을 고른다.
      const tie = best && Math.abs(hit.distance - best.distance) < 1e-3;
      if (!best || (tie ? part.meshes.length < best.part.meshes.length : hit.distance < best.distance)) best = { part, distance: hit.distance };
    }
    if (best && occluded(best)) best = null;
    if (best) return best.part;
    // 모바일 Tier 1 터치 표시 고리 위를 직접 탭한 경우(24px 여유, 벽 너머는 occluded로 차단).
    if (mobile && beaconHits.length) {
      let bestB = null, bestBD = 24;
      for (const b of beaconHits) {
        if (!b.part.active) continue;
        const d = Math.hypot(x - b.x, y - b.y);
        if (d < bestBD) {
          box.makeEmpty(); b.part.meshes.forEach(m => { if (worldVisible(m)) box.expandByObject(m); });
          if (box.isEmpty()) continue;
          box.clampPoint(camera.position, v);
          const worldDistance = camera.position.distanceTo(v); v.project(camera);
          ray.setFromCamera(ndc.set(v.x, v.y), camera);
          if (occluded({ part: b.part, distance: worldDistance })) continue;
          bestBD = d; bestB = b.part;
        }
      }
      if (bestB) return bestB;
    }
    // 작은 부품은 화면 경계상자 근처(PC 16px, 모바일 22px) 탭도 받는다. 벽 너머 부품은 occluded로 차단한다.
    let near = null, distance = Infinity;
    for (const part of parts) {
      if (!part.active) continue;
      const r = screenRect(part);
      if (!r || r.w > 90 || r.h > 90) continue;
      if (x < r.x - pad || x > r.x + r.w + pad || y < r.y - pad || y > r.y + r.h + pad) continue;
      const d = Math.hypot(x - r.x - r.w / 2, y - r.y - r.h / 2);
      if (d >= distance) continue;
      if (mobile || part.entries.some(e => e.direct)) {
        box.makeEmpty(); part.meshes.forEach(m => { if (worldVisible(m)) box.expandByObject(m); });
        if (box.isEmpty()) continue;
        // 문·벽에 매립된 소형 부품(비상키 등)은 중심이 판 내부일 수 있으므로 카메라 쪽 최근접면으로 가림을 판정한다.
        box.clampPoint(camera.position, v);
        const worldDistance = camera.position.distanceTo(v); v.project(camera);
        ray.setFromCamera(ndc.set(v.x, v.y), camera);
        if (occluded({ part, distance: worldDistance })) continue;
      }
      distance = d; near = part;
    }
    return near;
  }
  function partCenter(part) {
    if (!part) return null;
    box.makeEmpty();
    for (const m of part.meshes) if (worldVisible(m)) box.expandByObject(m);
    return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
  }
  // 벽 너머 부품이 탭되지 않도록 앞을 가리는 불투명 메시를 확인한다.
  let blockers = [], blockersAt = -1e9;
  function occluded(best) {
    if (frame - blockersAt > 90) {
      blockersAt = frame; blockers = [];
      scene.traverseVisible(o => {
        if (!o.isMesh) return;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!mat || !mat.visible || mat.transparent || mat.opacity < 1) return;
        blockers.push(o);
      });
    }
    const own = new Set(best.part.meshes);
    ray.far = best.distance - .02;
    const hit = ray.intersectObjects(blockers, false).some(h => !own.has(h.object) && worldVisible(h.object));
    ray.far = Infinity;
    return hit;
  }
  function screenRect(part) {
    box.makeEmpty();
    for (const m of part.meshes) if (worldVisible(m)) box.expandByObject(m);
    if (box.isEmpty()) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      if (v.z < -1 || v.z > 1) return null;
      const sx = (v.x + 1) * innerWidth / 2, sy = (1 - v.y) * innerHeight / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ── 메뉴 ── */
  const labelOf = e => e.label?.(e.button) || e.button.getAttribute('aria-label') || e.button.title || e.name;
  // 실제 누름 버튼·스위치·문/사다리 조작은 PC에서 즉시 반응하고, 모바일 일반 화면에서는 팝업 확인을 거친다.
  const operatingButtons = new Set(['control-panel-action', 'distribution-box-action', 'emergency-light-action', 'pit-ladder-action']);
  const isOperatingControl = e => operatingButtons.has(e.button.id) || /^(passenger-|ec-action-|light-switch-|inspection-action-|hall-action-)/.test(e.button.id);
  // MobileHUD.demoChoices / demoSummary 키 연결(조건 목록·실행 함수는 MobileHUD 원본만 공유).
  const ENTRY_DEMO_KEY = {
    'btn-overspeed': 'gov', 'rope-brake-action': 'door', 'ascent-action': 'up',
    'brake-compare-action': 'brake', 'ard-action': 'power', 'manual-rescue-action': 'hand',
    'photo-eye-action': 'eye', 'photo-eye-menu-action': 'eye', 'rope-measure-roof': 'rope',
    'buffer-demo-action': 'buffer', 'cwt-buffer-demo-action': 'buffer'
  };
  const PLAY_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  function entryDemoKey(e) {
    const id = e.button.id || '';
    if (ENTRY_DEMO_KEY[id]) return ENTRY_DEMO_KEY[id];
    if (id.startsWith('terminal-demo-')) return 'limit';
    if (id.startsWith('interlock-action-')) return 'lock';
    if (id.startsWith('relay-rope-action-')) return 'link';
    if (id.startsWith('guide-action-') || id.startsWith('retention-action-')) return 'shield';
    return null;
  }
  function isDemoResettingOrActive(key) {
    if (key === 'door') return typeof UCMDemo !== 'undefined' && UCMDemo.state.active;
    if (key === 'up') return typeof AscentDemo !== 'undefined' && AscentDemo.active;
    if (key === 'brake') return typeof BrakeDemo !== 'undefined' && BrakeDemo.active;
    if (key === 'buffer') return typeof BufferDemo !== 'undefined' && BufferDemo.active;
    return false;
  }
  function activate(part, point) {
    const live = liveEntries(part);
    if (!live.length) return;
    const mobile = isMobileGeneral();
    if (!mobile) {
      const now = performance.now();
      // PC 두 번 탭(카메라 확대)의 두 번째 탭은 방금 연 메뉴를 다시 닫지 않는다.
      if (lastOpen.part === part && now - lastOpen.time < 450) return;
      lastOpen = { part, time: now };
      if (live.length === 1 && isOperatingControl(live[0]) && !live[0].button.disabled) {
        closeMenu(); live[0].button.click(); return;
      }
    }
    openMenu(part, live, mobile ? point : null);
  }
  function openMobileItems(part, live, items) {
    const choicesMap = typeof MobileHUD !== 'undefined' ? MobileHUD.demoChoices : null;
    const summaryMap = typeof MobileHUD !== 'undefined' ? MobileHUD.demoSummary : null;
    const choiceEntries = choicesMap ? live.map(e => ({ e, key: entryDemoKey(e) })).filter(x => x.key && choicesMap[x.key] && !isDemoResettingOrActive(x.key)) : [];
    const nodes = [];
    if (choiceEntries.length && choiceEntries.length === live.length) {
      let activeIdx = 0, startFn = null;
      const desc = document.createElement('p'); desc.className = 'pm-desc';
      const modes = document.createElement('div'); modes.className = 'pm-modes'; modes.setAttribute('aria-label', '시연 조건');
      const play = document.createElement('button'); play.type = 'button'; play.className = 'part-menu-item pm-play';
      play.innerHTML = PLAY_SVG + '<span>재생</span>';
      const selectDemo = idx => {
        activeIdx = idx;
        const { e, key } = choiceEntries[idx];
        const options = choicesMap[key].options;
        const defIdx = key === 'buffer' && e.button.id === 'cwt-buffer-demo-action' ? Math.max(0, options.findIndex(([m]) => m === 'cwt')) : 0;
        const summary = summaryMap?.[key] || '';
        desc.textContent = summary; desc.hidden = !summary;
        modes.replaceChildren();
        startFn = options[defIdx][2];
        play.disabled = e.button.disabled;
        const updatePlayLabel = modeLabel => play.setAttribute('aria-label', part.name + ' · ' + modeLabel + ' 시연 재생');
        updatePlayLabel(options[defIdx][1]);
        options.forEach(([mode, label, fn], i) => {
          const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.partMode = mode;
          btn.textContent = label; btn.setAttribute('aria-pressed', String(i === defIdx));
          btn.addEventListener('click', () => {
            startFn = fn; updatePlayLabel(label);
            modes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          });
          modes.append(btn);
        });
      };
      if (choiceEntries.length > 1) {
        const tabs = document.createElement('div'); tabs.className = 'pm-tabs'; tabs.setAttribute('aria-label', '시연 선택');
        choiceEntries.forEach(({ e, key }, i) => {
          const tab = document.createElement('button'); tab.type = 'button'; tab.dataset.partTab = key;
          tab.textContent = labelOf(e).replace(/\s*시연\s*설정$/, '');
          tab.setAttribute('aria-pressed', String(i === 0));
          tab.addEventListener('click', () => {
            selectDemo(i);
            tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === tab)));
            placeMenu();
          });
          tabs.append(tab);
        });
        nodes.push(tabs);
      }
      play.addEventListener('click', () => { const fn = startFn; closeMenu(); if (fn) fn(); });
      selectDemo(0);
      nodes.push(desc, modes, play);
      items.replaceChildren(...nodes);
      return;
    }
    const singleKey = live.length === 1 ? entryDemoKey(live[0]) : null;
    if (singleKey) {
      const e = live[0], summary = summaryMap?.[singleKey] || '';
      if (summary) {
        const desc = document.createElement('p'); desc.className = 'pm-desc'; desc.textContent = summary;
        nodes.push(desc);
      }
      const play = document.createElement('button'); play.type = 'button'; play.className = 'part-menu-item pm-play';
      play.disabled = e.button.disabled;
      const lbl = labelOf(e);
      const isReset = /복귀/.test(lbl);
      play.innerHTML = isReset ? `<span>${lbl}</span>` : PLAY_SVG + '<span>재생</span>';
      play.setAttribute('aria-label', isReset ? lbl : `${part.name} 시연 재생`);
      play.addEventListener('click', () => { closeMenu(); e.button.click(); });
      nodes.push(play);
      items.replaceChildren(...nodes);
      return;
    }
    items.replaceChildren(...live.map(e => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'part-menu-item'; b.disabled = e.button.disabled;
      b.style.setProperty('--part-icon', getComputedStyle(e.button).getPropertyValue('--part-icon') || e.button.style.getPropertyValue('--part-icon'));
      b.textContent = labelOf(e);
      if (e.button.classList.contains('active') || e.button.getAttribute('aria-pressed') === 'true') b.classList.add('on');
      b.addEventListener('click', () => { closeMenu(); e.button.click(); });
      return b;
    }));
  }
  function openMenu(part, live, point) {
    if (typeof closeAllMenus === 'function') closeAllMenus();
    menuPart = part;
    tapPt = point ? { x: point.x, y: point.y } : null;
    const mobile = isMobileGeneral();
    if (mobile) menu.dataset.mobile = 'true'; else delete menu.dataset.mobile;
    menu.querySelector('strong').textContent = part.name;
    const items = menu.querySelector('.part-menu-items');
    if (mobile) {
      openMobileItems(part, live, items);
    } else {
      items.replaceChildren(...live.map(e => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'part-menu-item'; b.disabled = e.button.disabled;
        b.style.setProperty('--part-icon', getComputedStyle(e.button).getPropertyValue('--part-icon') || e.button.style.getPropertyValue('--part-icon'));
        b.textContent = labelOf(e);
        if (e.button.classList.contains('active') || e.button.getAttribute('aria-pressed') === 'true') b.classList.add('on');
        b.addEventListener('click', () => { closeMenu(); e.button.click(); });
        return b;
      }));
    }
    menu.hidden = false;
    placeMenu();
    if (!mobile) menu.querySelector('.part-menu-item:not(:disabled)')?.focus({ preventScroll: true });
  }
  function closeMenu() { if (menu) menu.hidden = true; menuPart = null; tapPt = null; }
  function placeMenu() {
    if (!menuPart) return;
    box.makeEmpty();
    for (const m of menuPart.meshes) if (worldVisible(m)) box.expandByObject(m);
    if (box.isEmpty()) { closeMenu(); return; }
    const mobile = isMobileGeneral();
    if (!mobile) {
      box.getCenter(v); v.y = box.max.y; v.project(camera);
      if (v.z < -1 || v.z > 1) { closeMenu(); return; }
      const x = (v.x + 1) * innerWidth / 2, y = (1 - v.y) * innerHeight / 2;
      menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, x - menu.offsetWidth / 2)) + 'px';
      menu.style.top = Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, y - menu.offsetHeight - 14)) + 'px';
      return;
    }
    const r = screenRect(menuPart);
    if (!r) {
      box.getCenter(v); v.project(camera);
      if (v.z < -1 || v.z > 1) { closeMenu(); return; }
    }
    const w = menu.offsetWidth || 180, h = menu.offsetHeight || 110;
    const statusRect = document.getElementById('statusbar')?.getBoundingClientRect();
    const barRect = document.getElementById('m-bar')?.getBoundingClientRect();
    const portrait = barRect && barRect.width > barRect.height;
    const minX = 8, maxX = Math.max(minX, (portrait || !barRect || !barRect.width ? innerWidth : barRect.left) - w - 8);
    const statusBottom = statusRect && statusRect.height ? statusRect.bottom + 8 : 8;
    const minY = portrait ? statusBottom : 8;
    const maxY = Math.max(minY, (portrait && barRect ? barRect.top : innerHeight) - h - 8);
    const clamp = (lx, ly) => {
      lx = Math.max(minX, Math.min(maxX, lx));
      ly = Math.max(minY, Math.min(maxY, ly));
      if (!portrait && statusRect && statusRect.width && lx < statusRect.right + 6 && ly < statusRect.bottom + 6) {
        ly = Math.min(maxY, statusRect.bottom + 8);
      }
      lx = Math.max(8, Math.min(innerWidth - w - 8, lx));
      ly = Math.max(8, Math.min(innerHeight - h - 8, ly));
      return { x: Math.round(lx), y: Math.round(ly) };
    };
    const hitsTap = c => tapPt && tapPt.x >= c.x - 10 && tapPt.x <= c.x + w + 10 && tapPt.y >= c.y - 10 && tapPt.y <= c.y + h + 10;
    const cx = r ? r.x + r.w / 2 : (v.x + 1) * innerWidth / 2;
    const cy = r ? r.y + r.h / 2 : (1 - v.y) * innerHeight / 2;
    const candidates = [
      clamp(cx - w / 2, (r ? r.y : cy) - h - 12),
      clamp(cx - w / 2, (r ? r.y + r.h : cy) + 12),
      clamp((r ? r.x : cx) - w - 12, cy - h / 2),
      clamp((r ? r.x + r.w : cx) + 12, cy - h / 2),
      clamp((tapPt ? tapPt.x : cx) > innerWidth / 2 ? minX : maxX, (tapPt ? tapPt.y : cy) > innerHeight / 2 ? minY : maxY)
    ];
    const chosen = candidates.find(c => !hitsTap(c)) || candidates[0];
    menu.style.left = chosen.x + 'px';
    menu.style.top = chosen.y + 'px';
  }

  function initBeacons() {
    beaconPosArr = new Float32Array(MAX_BEACONS * 3);
    beaconPhaseArr = new Float32Array(MAX_BEACONS);
    beaconScaleArr = new Float32Array(MAX_BEACONS);
    beaconGeo = new THREE.BufferGeometry();
    beaconGeo.setAttribute('position', new THREE.BufferAttribute(beaconPosArr, 3).setUsage(THREE.DynamicDrawUsage));
    beaconGeo.setAttribute('aPhase', new THREE.BufferAttribute(beaconPhaseArr, 1).setUsage(THREE.DynamicDrawUsage));
    beaconGeo.setAttribute('aScale', new THREE.BufferAttribute(beaconScaleArr, 1).setUsage(THREE.DynamicDrawUsage));
    beaconGeo.setDrawRange(0, 0);
    beaconMat = new THREE.ShaderMaterial({
      vertexShader: beaconVS, fragmentShader: beaconFS,
      uniforms: { uTime: time, uBaseSize: { value: 34 }, uDpr: { value: 1 }, uDim: { value: 1 }, uReduced: { value: 0 } },
      transparent: true, depthTest: true, depthWrite: false
    });
    beaconPts = new THREE.Points(beaconGeo, beaconMat);
    beaconPts.frustumCulled = false; beaconPts.matrixAutoUpdate = false;
    beaconScene = new THREE.Scene(); beaconScene.autoUpdate = false;
    beaconScene.add(beaconPts);
  }
  // 경계상자 윗면(매립 소형 부품은 중심)을 첫 대상의 로컬 좌표로 저장해 두고, 매 프레임은 행렬 곱 한 번으로 월드 위치(_bPos)를 얻는다.
  function beaconAnchor(part) {
    const ref = part.objects[0];
    if (part.bRef !== ref || part.bMeshes !== part.meshes || !(frame < part.bNext)) {
      const first = part.bRef === undefined;
      part.bRef = ref; part.bMeshes = part.meshes;
      part.bNext = frame + (first ? 1 + parts.indexOf(part) % BEACON_BOX_FRAMES : BEACON_BOX_FRAMES);
      box.makeEmpty();
      for (const m of part.meshes) if (worldVisible(m)) box.expandByObject(m);
      if (box.isEmpty()) { part.bLocal = null; return false; }
      box.getCenter(_bPos);
      box.getSize(_bSize);
      part.bSz = _bSize.length() || 0.1;
      if (part.bSz >= 0.15) _bPos.y = box.max.y + Math.min(0.06, part.bSz * 0.08);
      // 크기 0으로 숨긴 노드처럼 역행렬이 없으면 월드 좌표를 그대로 둔다(다음 재측정까지 고정).
      part.bFixed = ref.matrixWorld.determinant() === 0;
      part.bLocal = (part.bLocal || new THREE.Vector3()).copy(_bPos);
      if (!part.bFixed) part.bLocal.applyMatrix4(_bInv.copy(ref.matrixWorld).invert());
    }
    if (!part.bLocal) return false;
    _bPos.copy(part.bLocal);
    if (!part.bFixed) _bPos.applyMatrix4(ref.matrixWorld);
    return true;
  }
  // 값이 바뀐 프레임에만 GPU 버퍼를 다시 올린다.
  let beaconDirty = false;
  function setBeacon(arr, i, v) { v = Math.fround(v); if (arr[i] !== v) { arr[i] = v; beaconDirty = true; } }
  function updateBeacons(mobile) {
    const prevCount = beaconCount;
    beaconCount = 0; beaconHits = [];
    if (!beaconGeo || !mobile || !enabled || mobileDemoRunning()) {
      if (beaconGeo) beaconGeo.setDrawRange(0, 0);
      return;
    }
    const camDist = camera.position.distanceTo(controls.target);
    const farView = camDist > OVERVIEW_DIST;
    const minSep = farView ? 42 : 36;
    const cands = [];
    for (const part of parts) {
      if (!part.active) continue;
      const repPrio = OVERVIEW_REPS.get(part.name) || 0;
      if (farView && !repPrio && part !== menuPart) continue;
      const live = liveEntries(part);
      if (!live.length || live.every(e => e.button.disabled)) continue;
      if (!beaconAnchor(part)) continue;
      // 기준점에서 카메라 쪽으로 약간 띄워 자체 메시에 가리지 않으면서 벽 뒤는 깊이 버퍼로 자연 가림.
      const sz = part.bSz;
      _bDir.copy(camera.position).sub(_bPos);
      const dist = _bDir.length();
      if (dist < 0.05) continue;
      const nudge = sz < 0.15 ? 0.09 : THREE.MathUtils.clamp(Math.min(sz * 0.15, dist * 0.025), 0.055, 0.14);
      _bPos.addScaledVector(_bDir, nudge / dist);
      _bProj.copy(_bPos).project(camera);
      if (_bProj.z < -1 || _bProj.z > 1 || Math.abs(_bProj.x) > 0.94 || Math.abs(_bProj.y) > 0.90) continue;
      const sx = (_bProj.x + 1) * innerWidth / 2, sy = (1 - _bProj.y) * innerHeight / 2;
      // 선택된 부품은 Tier 2 발광을 쓰므로 표시 고리는 그리지 않되, 같은 자리 재탭(확대·닫기)용 히트 좌표는 유지한다.
      if (part === menuPart) { beaconHits.push({ part, x: sx, y: sy }); continue; }
      cands.push({ part, x: _bPos.x, y: _bPos.y, z: _bPos.z, sx, sy, dist, prio: repPrio, sz });
    }
    // 원거리는 대표 우선순위, 근거리는 대표 + 카메라 최단거리 순으로 겹침 억제.
    cands.sort((a, b) => farView ? (b.prio - a.prio || a.dist - b.dist) : (b.prio - a.prio || a.dist - b.dist));
    const maxAllowed = farView ? 8 : MAX_BEACONS;
    for (const c of cands) {
      if (beaconCount >= maxAllowed) break;
      if (beaconHits.some(h => Math.hypot(h.x - c.sx, h.y - c.sy) < minSep)) continue;
      const i = beaconCount++;
      setBeacon(beaconPosArr, i * 3, c.x); setBeacon(beaconPosArr, i * 3 + 1, c.y); setBeacon(beaconPosArr, i * 3 + 2, c.z);
      setBeacon(beaconPhaseArr, i, (c.part.name.length * 0.27 + i * 0.19) % 1);
      setBeacon(beaconScaleArr, i, farView ? 0.88 : THREE.MathUtils.clamp(0.84 + Math.min(0.24, c.sz * 0.15), 0.84, 1.08));
      beaconHits.push({ part: c.part, x: c.sx, y: c.sy });
    }
    if (beaconCount > 0) {
      if (beaconDirty || beaconCount !== prevCount) {
        beaconGeo.attributes.position.needsUpdate = true;
        beaconGeo.attributes.aPhase.needsUpdate = true;
        beaconGeo.attributes.aScale.needsUpdate = true;
        beaconDirty = false;
      }
      beaconMat.uniforms.uDpr.value = renderer.getPixelRatio();
      beaconMat.uniforms.uDim.value = menuPart ? 0.32 : 1.0;
      beaconMat.uniforms.uReduced.value = reducedMotion.matches ? 1.0 : 0.0;
    }
    beaconGeo.setDrawRange(0, beaconCount);
  }
  function setEnabled(value) {
    enabled = !!value;
    try { localStorage.setItem(STORE, enabled ? '1' : '0'); } catch (e) { /* 저장소 없음 */ }
    const b = document.getElementById('part-glow-toggle');
    if (b) { b.classList.toggle('active', enabled); b.setAttribute('aria-pressed', String(enabled)); }
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = `
      #part-menu{position:fixed;z-index:115;min-width:190px;max-width:calc(100vw - 16px);padding:8px;border-radius:14px;color:var(--ui-text,#fff);font-family:var(--ui-font,sans-serif);box-sizing:border-box;border:1px solid #ffd76a8c;box-shadow:0 0 0 1px #0004,0 6px 22px #0006,0 0 18px #ffc23d33}
      #part-menu[hidden],#part-tip[hidden]{display:none}
      #part-menu .part-panel-head{padding-left:6px;color:#ffe29a}
      #part-menu .part-panel-head button{width:36px;height:36px}
      .part-menu-items{display:grid;gap:6px;margin-top:2px}
      .part-menu-item{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border:1px solid #ffffff26;border-radius:10px;background:#ffffff14;color:inherit;font:600 13px/1.3 var(--ui-font,sans-serif);text-align:left;cursor:pointer}
      .part-menu-item::before{content:'';flex:none;width:20px;height:20px;background:var(--part-icon) center/contain no-repeat}
      .part-menu-item:hover,.part-menu-item:focus-visible{background:#ffc23d2e;border-color:#ffd76a;outline:none}
      .part-menu-item.on{background:#1b70aec2;border-color:#a8e1ff}
      .part-menu-item:disabled{opacity:.5;cursor:progress}
      #part-tip{position:fixed;z-index:116;pointer-events:none;padding:5px 9px;border-radius:8px;background:#0d1a26e6;border:1px solid #ffd76a99;color:#ffe29a;font:600 12px/1.3 var(--ui-font,sans-serif);white-space:nowrap}
      #part-tip small{display:block;color:#cfe0ee;font-weight:500}
      html:not(.legacy-part-icons) #part-actions > .part-action, html:not(.legacy-part-icons) #pit-ladder-action{visibility:hidden!important;pointer-events:none!important}
      html:not(.legacy-part-icons) #part-actions > .part-action::after{display:none!important}`;
    document.head.appendChild(style);
    if (/[?&]legacyIcons\b/.test(location.search)) document.documentElement.classList.add('legacy-part-icons');
    menu = document.createElement('section');
    menu.id = 'part-menu'; menu.className = 'glass'; menu.hidden = true; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<div class="part-panel-head"><strong></strong><button type="button" aria-label="부품 메뉴 닫기">×</button></div><div class="part-menu-items"></div>';
    menu.querySelector('button').addEventListener('click', closeMenu);
    document.body.appendChild(menu);
    tip = document.createElement('div');
    tip.id = 'part-tip'; tip.hidden = true;
    document.body.appendChild(tip);

    const canvas = renderer.domElement;
    let down = null, wasMenuPart = null;
    // window 캡처에서 HUD 메뉴 닫힘 여부와 열려 있던 부품 메뉴를 먼저 기록한다.
    window.addEventListener('pointerdown', e => {
      if (e.button === 0 || e.pointerType !== 'mouse') activePointers.set(e.pointerId, true);
      if (activePointers.size > 1) { down = null; }
      hudDismissed = isMobileGeneral() && !!(document.querySelector('#m-demo.open, .sheet.open') || bodyHas('m-run-open'));
      wasMenuPart = !menu.hidden && !menu.contains(e.target) ? menuPart : null;
    }, true);
    const dropPointer = e => { activePointers.delete(e.pointerId); };
    window.addEventListener('pointerup', dropPointer, true);
    window.addEventListener('pointercancel', dropPointer, true);
    window.addEventListener('blur', () => { activePointers.clear(); down = null; });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    canvas.addEventListener('pointerdown', e => {
      if (activePointers.size > 1 || e.isPrimary === false || hudDismissed) { down = null; return; }
      down = e.button === 0 && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), wasMenuPart } : null;
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY, moved: true };
      const slop = isMobileGeneral() ? 14 : 6;
      if (down && (e.pointerId !== down.id || Math.hypot(e.clientX - down.x, e.clientY - down.y) > slop)) down = null;
    });
    canvas.addEventListener('pointerleave', () => { pointer = null; });
    canvas.addEventListener('pointercancel', () => { down = null; });
    canvas.addEventListener('pointerup', e => {
      const d = down; down = null;
      if (e === zoomedEvent) { zoomedEvent = null; return; }
      const mobile = isMobileGeneral();
      if (!d || e.pointerId !== d.id || performance.now() - d.t > (mobile ? 700 : 450)) return;
      if (typeof controls !== 'undefined' && !controls.enabled) return;
      if (mobileDemoRunning()) return;
      const part = pickAt(e.clientX, e.clientY);
      if (!part) return;
      // 천천히 같은 부품을 재탭하면 팝업만 닫고(pointerdown에서 이미 닫힘) 재오픈하지 않는다.
      if (mobile && d.wasMenuPart === part) { slowCloseHook?.(); return; }
      activate(part, { x: e.clientX, y: e.clientY });
    });
    const toggle = document.getElementById('part-glow-toggle');
    if (toggle) toggle.addEventListener('click', () => setEnabled(!enabled));
    initBeacons();
    setEnabled(enabled);
  }

  function updateHover() {
    if (!pointer) { hover = null; }
    else if (pointer.moved || frame % 15 === 0) {
      pointer.moved = false;
      hover = typeof controls !== 'undefined' && !controls.enabled ? null : pickAt(pointer.x, pointer.y);
    }
    renderer.domElement.style.cursor = hover ? 'pointer' : '';
    if (hover && pointer && hover !== menuPart && !liveEntries(hover).every(e => e.direct)) {
      const live = liveEntries(hover);
      tip.innerHTML = '';
      tip.append(hover.name);
      const sub = document.createElement('small');
      sub.textContent = live.length === 1 ? labelOf(live[0]) : `클릭 · 메뉴 ${live.length}개`;
      tip.append(sub);
      tip.hidden = false;
      tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, pointer.x + 16) + 'px';
      tip.style.top = Math.min(innerHeight - tip.offsetHeight - 8, pointer.y + 18) + 'px';
    } else tip.hidden = true;
  }

  // 메인 renderer.render(scene, camera) 직후에 호출한다.
  function render() {
    if (!menu) return;
    frame++;
    const mobile = isMobileGeneral();
    if (mobile !== wasMobileMode) { wasMobileMode = mobile; closeMenu(); }
    refresh();
    if (menuPart && (!menuPart.active || !liveEntries(menuPart).length || mobileDemoRunning())) closeMenu();
    updateHover();
    placeMenu();
    const now = performance.now() / 1000, ease = 1 - Math.exp(-Math.min(.25, now - (lastNow || now)) * 12);
    lastNow = now;
    const pulse = typeof IdleThrottle !== 'undefined' ? IdleThrottle.pulseTime(now) : now;   // 정지 화면에서는 맥동을 늦춘다
    time.value = pulse;
    renderer.getDrawingBufferSize(res.value);
    const lit = [];
    for (const part of parts) { syncPart(part, pulse, ease || .18); if (part.root.visible) lit.push(part); }
    updateBeacons(mobile);
    if (!lit.length && !beaconCount) return;
    const autoClear = renderer.autoClear, autoReset = renderer.info.autoReset;
    renderer.autoClear = false; renderer.info.autoReset = false;
    if (beaconCount > 0) renderer.render(beaconScene, camera);
    // 부품 속 부품(제어반 ⊃ 점검 스위치)도 테두리가 보이도록 부품마다 스텐실을 비운다.
    for (const part of lit) { renderer.clearStencil(); renderer.render(part.root, camera); }
    renderer.autoClear = autoClear; renderer.info.autoReset = autoReset;
  }

  return { bind, init, render, closeMenu, setEnabled, get enabled() { return enabled; }, palette: { IDLE, HOT },
    get parts() { return parts; }, get menuPart() { return menuPart; }, get beaconCount() { return beaconCount; },
    get beacons() { return beaconHits.map(b => ({ name: b.part.name, x: b.x, y: b.y })); },
    invalidateBlockers() { blockersAt = -1e9; },
    pickAt, activate, partCenter,
    markZoomTap(e) { zoomedEvent = e; closeMenu(); },
    hudWasDismissed() { return hudDismissed; },
    onSlowClose(fn) { slowCloseHook = fn; } };
})();
