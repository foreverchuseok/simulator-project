/* ─────────────────────────────────────────────────────────────
   카·균형추 완충기 충돌 시연 (사용자 001601 · 2026-09-29)
   ▪ 피트 카 완충기 위 아이콘을 누르면 카가 최하층을 지나 정격속도로 내려와 우레탄 완충기를 "쿵" 친다.
     타격판(CarUnderbody 의 carBufferStrike)이 완충기를 행정 60mm 만큼 누르고, 먼지가 일어난다.
   ▪ 카가 내려간 만큼 균형추가 올라간다. 그 상태에서 균형추 위에 남는 거리(상부 여유거리)를
     노란 치수와 함께 보여 준다. 여유거리는 시연 시작 때 균형추 위 실제 장애물 높이에서 잰다.
   ▪ 균형추 모드(사용자 2026-09-29): 균형추 완충기 위 아이콘 → 카가 최상층을 지나 정격속도로 올라가고,
     내려온 균형추 밑 100mm 스트라이커(cwtBufferStrike, elevator.js)가 균형추 우레탄 완충기를 60mm 누른다.
     그때 카 상부 가이드슈 위에 남는 카 가이드레일(가이드레일 여유거리)을 노란 치수로 보여 준다.
     기준 0.1 + 0.035v² (m) — 균형추가 완전히 압축된 완충기 위에 있을 때 카가 더 유도되는 레일 길이.
     같은 장면에서 6.5.7.2 상부틈새(가 A·B 수직 0.50m, 다 D 난간 수직 0.30m·C 경사 0.50m·E 내측 수평 0.40m)를
     빛나는 노란 치수로 덧붙인다(좌측 A·C, 중앙/우측 B, 우측 D·E). 레일 장면 뒤에 카 지붕 전체 장면을 한 번 더 보여 준다.
   ▪ 카 모드(2026-10-03): 균형추 모드처럼 여유거리를 종류별로 보인다 — 피트 P(카 최하부, 에이프런·가이드슈·안전기 제외 → 피트 바닥 0.50m),
     Q(에이프런·가이드슈·안전기 → 피트 바닥 0.10m), 균형추 G(균형추 가이드슈 → 균형추 레일 끝 0.1+0.035v²), H(균형추 위 장애물).
   ▪ 치수 라벨은 「기호 이름 수치 ✓/✗」만 짧게, 치수선은 번쩍인다(미달은 빨강). 기준 문구는 라벨에서 뺐다(사용자 지시).
   ▪ 시연 중 상단 가운데 일시정지·재생 버튼. 멈춘 동안 화면을 돌려 볼 수 있다.
   ▪ 형상·재질은 build() 에서 한 번만 만들고 update() 는 위치·배율·불투명도만 바꾼다.
   ───────────────────────────────────────────────────────────── */
const BufferDemo = (() => {
  const T = {
    accel: 0.8,       // 출발 가속도 (m/s²)
    ffGap: 2.2,       // 완충기까지 이보다 멀면 빠르게 감기
    ff: 3,            // 빠르게 감기 배율
    slowGap: 0.3,     // 완충기 이만큼 위부터 느린 동작
    slow: 0.35,       // 충돌·압축 느린 동작 배율
    rebound: 0.008,   // 우레탄 반발 (m)
    holdPit: 2.4,     // 충돌 뒤 피트 관찰 (s)
    holdTop: 4.2,     // 균형추 상부·카 가이드레일 상단 관찰 (s)
    holdRoof: 4.5,    // 균형추 모드: 카 지붕 전체(좌·우 상부틈새) 관찰 (s)
    holdUnder: 4.2,   // 카 모드: 피트 하부틈새 P·Q 관찰 (s)
    dustLife: 2.6,    // 먼지 수명 (s, 느린 동작 반영)
    iconRange: 4.5    // 아이콘이 보이는 카메라 거리 (m)
  };
  const svg = p => `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>')}")`;
  const ICON = svg('<path d="M12 2v7m-3-3 3 3 3-3"/><path d="M6 11h12"/><rect x="8" y="13" width="8" height="5" rx="1.5"/><path d="M5 21h14M10 18v3m4-3v3"/>');
  const ICON_CWT = svg('<rect x="6" y="2" width="12" height="6" rx="1"/><path d="M9 5h6M12 8v3"/><rect x="8" y="12" width="8" height="6" rx="1.5"/><path d="M5 21h14M10 18v3m4-3v3"/>');
  const RESET = svg('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>');
  const DUST_N = 220, CWT_FOV = 68;
  // 모드별 종류별 여유거리 치수. 균형추 모드 = 카 지붕 상부틈새, 카 모드 = 피트 하부틈새 + 균형추 레일.
  const SPAN_IDS = ['A', 'B', 'C', 'D', 'E', 'P', 'Q', 'G'], MODE_SPANS = { cwt: ['A', 'B', 'C', 'D', 'E'], car: ['P', 'Q', 'G'] };
  const STACK = { cwt: ['D', 'E', 'C', 'A', 'B'], car: ['P', 'Q', 'G'] };
  const PIT_FLOOR = () => Y0 + 0.02;   // 피트 마감 바닥 상면 (elevator.js buildPitFoundation 의 pitTopY)
  // dir: 완충기로 다가갈 때 카 이동 방향. 균형추 모드는 카가 올라가고 균형추가 내려와 완충기를 친다.
  const MODES = {
    car: { key: 'car', dir: -1, arrow: '↓', btnId: 'buffer-demo-action', icon: ICON, title: '카 완충기 충돌 시연',
      z: () => CAR_CTR_Z, strike: () => carGrp.getObjectByName('carBufferStrike')?.userData, homeFloor: () => 0 },
    cwt: { key: 'cwt', dir: 1, arrow: '↑', btnId: 'cwt-buffer-demo-action', icon: ICON_CWT, title: '균형추 완충기 충돌 시연',
      z: () => CWT_CENTER_Z, strike: () => cwtGrp.getObjectByName('cwtBufferStrike')?.userData, homeFloor: () => FLOORS - 1 }
  };
  let mode = MODES.car;
  const U = { active: false, stage: 'rest', mode: 'car', dir: -1, v: 0, ts: 1, calls: [] };
  const _p = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _box = new THREE.Box3();
  let btns = {}, dust, dustPos, dustVel, dustT = -1, ring, ringT = -1, clearGrp, overheadGrp, glowMat, pauseBtn, labels = {}, lastNow = 0, lastFloor = -1;
  let coreMat, coreNgMat, glowNgMat, clearCoreMat;
  const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _mid = new THREE.Vector3();

  /* ── 형상(한 번만) ───────────────────────────────────────── */
  function build() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.45, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    dustPos = new Float32Array(DUST_N * 3); dustVel = new Float32Array(DUST_N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
    dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: .08, map: new THREE.CanvasTexture(c), color: 0xcabfa8,
      transparent: true, opacity: 0, depthWrite: false }));
    dust.name = 'bufferImpactDust'; dust.frustumCulled = false; dust.visible = false; dust.renderOrder = 4;
    scene.add(dust);
    ring = new THREE.Mesh(new THREE.RingGeometry(.1, .135, 48), new THREE.MeshBasicMaterial({ color: 0xfff1c9,
      transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.name = 'bufferImpactRing'; ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

    // 여유거리 치수: 반투명 공간 + 세로 치수선 + 양끝 눈금. 단위 형상을 배율로 늘린다.
    // 카 모드는 균형추 위, 균형추 모드는 카 상부 가이드슈 위~카 가이드레일 상단(천장 슬래브 속이라 가림 없이 그린다).
    const yellow = clearCoreMat = new THREE.MeshBasicMaterial({ color: 0xffc53d, depthWrite: false, transparent: true, opacity: .95 });
    clearGrp = new THREE.Group(); clearGrp.name = 'bufferDemoCwtClearance'; clearGrp.visible = false; scene.add(clearGrp);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const volume = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0xffc53d,
      transparent: true, opacity: .09, depthWrite: false }));
    volume.name = 'clearanceVolume'; clearGrp.add(volume);
    volume.add(new THREE.LineSegments(new THREE.EdgesGeometry(unit), new THREE.LineBasicMaterial({ color: 0xffc53d, transparent: true, opacity: .8 })));
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1, 8), yellow); line.name = 'clearanceLine'; clearGrp.add(line);
    const tickGeo = new THREE.BoxGeometry(.16, .008, .008), arrowGeo = new THREE.ConeGeometry(.022, .06, 12);
    for (const k of ['Low', 'High']) {
      const t = new THREE.Mesh(tickGeo, yellow); t.name = 'clearanceTick' + k; clearGrp.add(t);
      const a = new THREE.Mesh(arrowGeo, yellow); a.name = 'clearanceArrow' + k; if (k === 'Low') a.rotation.z = Math.PI; clearGrp.add(a);
    }
    clearGrp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.renderOrder = 5; } });

    // 상부틈새 치수(균형추 모드). 가이드레일 치수와 따로 두고, 단위 형상을 방향에 맞춰 돌린다.
    // 밝은 심선 + 가산 혼합 후광(update() 가 불투명도만 맥동). 가림 없이 그려 난간·슬래브 뒤에서도 보인다.
    overheadGrp = new THREE.Group(); overheadGrp.name = 'bufferDemoOverheadClearance'; overheadGrp.visible = false; scene.add(overheadGrp);
    const core = coreMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0, depthWrite: false, depthTest: false, transparent: true, opacity: 1 });
    glowMat = new THREE.MeshBasicMaterial({ color: 0xffb21e, depthWrite: false, depthTest: false, transparent: true, opacity: .35,
      blending: THREE.AdditiveBlending });
    // 기준 미달 치수는 빨강으로 번쩍인다.
    coreNgMat = new THREE.MeshBasicMaterial({ color: 0xffb4a8, depthWrite: false, depthTest: false, transparent: true, opacity: 1 });
    glowNgMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, depthWrite: false, depthTest: false, transparent: true, opacity: .35,
      blending: THREE.AdditiveBlending });
    const lineGeo = new THREE.CylinderGeometry(.007, .007, 1, 8), haloGeo = new THREE.CylinderGeometry(.024, .024, 1, 12);
    const spanTickGeo = new THREE.BoxGeometry(.16, .01, .01), haloTickGeo = new THREE.BoxGeometry(.19, .034, .034);
    const spanArrowGeo = new THREE.ConeGeometry(.024, .065, 12);
    for (const id of SPAN_IDS) {
      const g = new THREE.Group(); g.name = 'over' + id; overheadGrp.add(g);
      const line = new THREE.Mesh(lineGeo, core); line.name = 'spanLine'; g.add(line);
      const halo = new THREE.Mesh(haloGeo, glowMat); halo.name = 'spanHalo'; g.add(halo);
      for (const k of ['Lo', 'Hi']) {
        const t = new THREE.Mesh(spanTickGeo, core); t.name = 'spanTick' + k; g.add(t);
        t.add(new THREE.Mesh(haloTickGeo, glowMat));
        const a = new THREE.Mesh(spanArrowGeo, core); a.name = 'spanArrow' + k; if (k === 'Lo') a.rotation.z = Math.PI; g.add(a);
      }
    }
    overheadGrp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.renderOrder = o.material === glowMat ? 5 : 6; } });

    // 시연 중 일시정지·재생. 멈춘 동안은 화면을 돌려 볼 수 있고, 재생하면 멈춘 시점 화면으로 돌아와 이어 간다.
    pauseBtn = document.createElement('button'); pauseBtn.id = 'buffer-demo-pause'; pauseBtn.type = 'button'; pauseBtn.hidden = true;
    pauseBtn.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:32;padding:8px 18px;border-radius:999px;border:1px solid #ffd24d;background:#142230ee;color:#ffd24d;font:700 14px/1 sans-serif;cursor:pointer;box-shadow:0 0 14px #ffb21e66';
    pauseBtn.addEventListener('click', () => togglePause());
    document.body.appendChild(pauseBtn);

    for (const [k, color] of [['stroke', '#ffe08a'], ['clear', '#ffd24d'], ...SPAN_IDS.map(id => [id, '#ffd24d'])]) {
      const el = document.createElement('div'); el.className = 'buffer-demo-label'; el.id = 'buffer-demo-' + k; el.hidden = true;
      el.style.cssText = `position:fixed;z-index:31;pointer-events:none;padding:5px 10px;border-radius:7px;background:#142230e8;border:1px solid ${color};color:${color};font:600 13px/1.35 sans-serif;white-space:nowrap;transform:translate(10px,-50%)`;
      document.body.appendChild(el); labels[k] = el;
    }
    for (const m of Object.values(MODES)) {
      const b = btns[m.key] = document.getElementById(m.btnId);
      b.style.setProperty('--part-icon', m.icon);
      b.addEventListener('click', () => {
        if (!U.active) start(m.key);
        else if (U.mode === m.key && (U.stage === 'done' || U.stage === 'halted')) reset();
      });
      // 발광 대상: 같은 Z 의 지지대·받침판·완충체(속도 변경 시 bufferGrp 가 다시 만들어진다).
      PartGlow.bind(b, () => bufferGrp?.children.filter(o => Math.abs(o.position.z - m.z()) < .01), m.key === 'car' ? '카 완충기' : '균형추 완충기');
    }
  }

  /* ── 공용 ──────────────────────────────────────────────── */
  const handle = (m = mode) => bufferGrp?.userData[m.key];
  const strike = (m = mode) => m.strike();
  const isCwt = () => mode.key === 'cwt';
  function later(sec, fn) { const c = gsap.delayedCall(sec, fn); U.calls.push(c); return c; }
  function caption(text, tone = '#eef5fa') {
    let el = document.getElementById('buffer-stage');
    if (!el) {
      el = document.createElement('div'); el.id = 'buffer-stage'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);max-width:min(760px,88vw);padding:12px 20px;background:#142230ed;color:#eef5fa;border:1px solid #66859b;border-radius:9px;font:15px/1.5 sans-serif;z-index:31;pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.hidden = !text; el.style.color = tone; el.textContent = text ? (isCwt() ? '균형추 ' : '') + '완충기 충돌 시연  |  ' + text : '';
  }
  function setIcon(reset) {
    const b = btns[mode.key];
    b.style.setProperty('--part-icon', reset ? RESET : mode.icon);
    b.textContent = reset ? 'RST' : 'BUF';
    b.classList.toggle('active', reset);
    b.setAttribute('aria-label', reset ? mode.title + ' 복귀' : mode.title);
    b.title = b.getAttribute('aria-label');
  }
  function blocked(m) {
    return InterlockDemo.active || UCMDemo.state.active ? '다른 시연이 끝난 뒤 시연'
      : InspectionReturn.busy || HallManual.busy ? '점검 작업이 끝난 뒤 시연'
      : !PitLadder.secured ? '피트 사다리 펼침 — 운행 차단'
      : insMode ? '점검운전 중 — AUT 로 전환 후 시연'
      : DoorBypass.mode !== 'off' ? 'BYPASS 해제 후 시연'
      : overspeedActive || estop ? '다른 고장 복귀(RST) 후 시연'
      : moving ? '운행 정지 후 시연'
      : CarDoor.state?.busy ? '도어 동작이 끝난 뒤 시연'
      : handle(m)?.type !== 'urethane' ? '우레탄 완충기(60 m/min 이하)에서 시연 — 운행 속도를 바꿔 주세요'
      : !strike(m) ? (m.key === 'cwt' ? '균형추 타격부 준비 중' : '카 하부 타격부 준비 중')
      : m.key === 'cwt' && !(railGrp?.userData.carRailTopY && upperShoes().length) ? '카 가이드레일·가이드슈 준비 중' : '';
  }
  const upperShoes = () => (carGrp.userData.guideShoes || []).filter(s => s.userData.isUpper);
  // 급유통(Oiler)은 레일 끝에 부딪혀 부서져도 되는 소모품 → 여유거리는 그 아래 가이드슈 본체 윗면부터 잰다.
  function shoeBodyBox(shoe, out) {
    out.makeEmpty();
    shoe.traverse(o => {
      if (!o.isMesh) return;
      for (let p = o; p && p !== shoe; p = p.parent) if (/^Oiler/.test(p.name)) return;
      out.union(new THREE.Box3().setFromObject(o));
    });
    return out;
  }
  // 균형추 바로 위(평면 투영이 겹치는) 가장 낮은 고정물 하면. 로프·레일은 균형추와 함께 지나가므로 제외.
  function overheadObstacle(top) {
    _box.setFromObject(cwtGrp);
    const fp = _box.clone(), b = new THREE.Box3();
    let y = SHAFT_CEIL_Y, name = 'shaftCeiling';
    scene.traverse(o => {
      if (!o.isMesh || /rope|rail/i.test(o.name) || o === dust || o === ring) return;
      for (let p = o; p; p = p.parent) if (!p.visible || p === cwtGrp || p === carGrp || p === clearGrp || p === overheadGrp) return;
      b.setFromObject(o);
      if (b.min.y > top && b.min.y < y && b.max.x > fp.min.x && b.min.x < fp.max.x && b.max.z > fp.min.z && b.min.z < fp.max.z) { y = b.min.y; name = o.name || o.parent?.name || '?'; }
    });
    return { y, name };
  }
  function displayFloor() {
    const sill = carGrp.position.y - S.CAR_H / 2;
    for (let i = FLOORS - 1; i >= 0; i--) if (sill >= FLOOR_Y[i] - .01) return i;
    return 0;
  }
  // 카 이동 + 균형추 반대 이동 + 로프·시브 + 완충기 압축(카 위치에서 계산, 방향은 U.dir).
  function setCarY(y) {
    const d = y - carGrp.position.y;
    if (d) {
      carGrp.position.y = y; cwtGrp.position.y -= d;
      spinSheaves(d); refreshRopes(); refreshGovernorRope();
      const l = scene.getObjectByName('carLight'); if (l) l.position.y = y + S.CAR_H * .75;
    }
    compress(Math.min(Math.max((y - U.contactY) * U.dir, 0), U.stroke + .004));
    const f = displayFloor();
    if (f !== lastFloor) { lastFloor = f; syncAllIndicators(f + 1, U.stage === 'resetting' ? '' : mode.arrow); }
    updateStatus('v-spd', Math.round(U.v * 60) + ' m/min', U.stage === 'approach' ? '#f85149' : '#f0883e');
  }
  function compress(c) {
    const h = handle(); if (!h?.urethane) return;
    const sy = (h.height - c) / h.height, r = 1 / Math.sqrt(sy);   // 부피 보존 — 눌린 만큼 옆으로 부푼다
    h.urethane.scale.set(r, sy, r);
    U.compression = c;
  }
  function shake(k = 1) {
    const p = camera.position.clone();
    gsap.timeline()
      .to(camera.position, { x: p.x + .03 * k, y: p.y - .025 * k, duration: .04 })
      .to(camera.position, { x: p.x - .022 * k, y: p.y + .018 * k, duration: .05 })
      .to(camera.position, { x: p.x + .012 * k, y: p.y - .01 * k, duration: .06 })
      .to(camera.position, { x: p.x, y: p.y, duration: .1 });
  }
  const CZ = () => mode.z();
  function fovTo(fov, dur) { gsap.to(camera, { fov, duration: dur, ease: 'power2.inOut', onUpdate: () => camera.updateProjectionMatrix() }); }
  /* 피트: 카 뒤쪽(−Z) 아래에서 본다. 앞쪽은 하중검출 스위치 줄이 타격판을 가린다.
     카가 완충기에 올라앉아도 카메라는 플랭크 아래·카 바닥 밑 빈 공간에 남는다.
     균형추 모드: 균형추 앞(+Z)은 노란 피트 스크린(바닥 위 0.2~2.2m)이 가린다 — 균형추 뒤·뒷벽 사이 틈에서 본다. */
  function pitCam(dur) {
    const h = handle();
    fovTo(U.fov0, dur);
    if (isCwt()) _camTo(0.55, h.topY + .16, SHAFT_BACK_Z + .12, 0, h.topY + .06, CZ(), dur, 'power2.inOut');
    else _camTo(0.5, 0.38, CZ() - 0.8, 0, h.topY + .02, CZ(), dur, 'power2.inOut');
  }
  // 옆(+X)에서 플랭크 채널을 따라 본다: 두 웹 사이를 꽉 채운 강재·타격판·눌린 완충기가 한 화면에 든다.
  // 균형추 모드: 균형추 뒤 낮은 곳에서 가까이 — 하부 빔·100mm 스트라이커·눌린 완충기가 한 화면에 든다.
  function sideCam(dur) {
    const h = handle(), z = CZ() + .04;
    fovTo(U.fov0, dur);
    if (isCwt()) _camTo(0.36, h.topY - .02, SHAFT_BACK_Z + .1, 0, h.topY - .01, CZ(), dur, 'power2.inOut');
    else _camTo(0.95, h.topY - .05, z, 0, h.topY + .02, z, dur, 'power2.inOut');
  }
  function topCam(dur) { if (isCwt()) railCam(dur); else cwtCam(dur); }
  // 카 가이드레일 상단: 카 지붕 위·천장 밑 공간에서 우측 레일의 상부 가이드슈~레일 끝을 한 화면에 담는다.
  function railCam(dur) {
    const q = U.clear, c = (q.top + q.obstacle) / 2, x = q.box.max.x;   // 조준을 아래로 내려 치수를 화면 위쪽에 둔다(아래는 자막·운행바 몫)
    fovTo(CWT_FOV, dur);
    const zc = Math.min(CAR_RAIL_Z + 1.25, FRONT_WALL_INNER_Z - .15);
    const drop = camera.aspect < 1 ? .32 : .15;   // 세로 화면은 자막이 높다
    _camTo(x - 1.2, c - .02, zc, x - .04, c - drop, CAR_RAIL_Z, dur, 'power2.inOut');
  }
  // 카 지붕 전체: 카 앞면·승강로 앞벽 사이, 천장 바로 밑에서 좌우 난간과 상부틈새 치수를 한 화면에 담는다.
  function roofCam(dur) {
    const o = U.clear.over, yTop = o.D.from.y, c = carGrp.position;
    // 세로 화면은 좌우 난간(±1.03m)이 들도록 가로 화각 ≈80°에 맞춘다.
    const hf = THREE.MathUtils.degToRad(80);
    fovTo(camera.aspect < 1 ? Math.min(120, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / camera.aspect))) : 74, dur);
    const zc = Math.min(CAR_FRONT_Z + .12, FRONT_WALL_INNER_Z - .08);
    _camTo(c.x, SHAFT_CEIL_Y - .14, zc, c.x, yTop - .42, c.z - .35, dur, 'power2.inOut');
  }
  // 카 아래 피트: P(카 뒤쪽 최하부)와 Q(앞쪽 에이프런 끝)가 앞뒤로 1.4m 떨어져 있다.
  // 가로 화면은 두 선의 중간 깊이에서 +X 옆으로 보고, 세로 화면은 카 뒤(−Z)에서 앞쪽으로 본다.
  function underCam(dur) {
    const u = U.clear.under, q = u.Q.from, pp = u.P.from, zm = (q.z + pp.z) / 2, y = PIT_FLOOR();
    if (camera.aspect < 1) { fovTo(84, dur); _camTo(pp.x + .45, y + .42, pp.z - .85, (q.x + pp.x) / 2, y + .2, zm + .25, dur, 'power2.inOut'); }
    else { fovTo(72, dur); _camTo(1.45, y + .5, zm, (q.x + pp.x) / 2 - .15, y + .24, zm, dur, 'power2.inOut'); }
  }
  // 균형추 위: 승강로 앞벽 안쪽에서 균형추 윗부분과 천장이 한 화면에 들도록 잠시 화각을 넓힌다(피트로 돌아오며 복원).
  function cwtCam(dur) {
    const q = U.clear, lo = q.top - 1.0, hi = q.obstacle + .15, mid = (lo + hi) / 2;   // 아래 여백은 자막·운행바 몫
    const tan = Math.tan(THREE.MathUtils.degToRad(CWT_FOV / 2));
    const dir = new THREE.Vector3(.34, -.12, 1).normalize();
    const dMax = (FRONT_WALL_INNER_Z - .3 - CWT_CENTER_Z) / dir.z;
    const d = Math.min(dMax, Math.max((hi - lo) / (2 * tan), 1.6 / (2 * tan * camera.aspect)) * 1.05);
    fovTo(CWT_FOV, dur);
    _camTo(dir.x * d, mid + dir.y * d, CWT_CENTER_Z + dir.z * d, 0, mid, CWT_CENTER_Z, dur, 'power2.inOut');
  }

  /* ── 효과 ──────────────────────────────────────────────── */
  function burst() {
    const h = handle(), cx = 0, cz = CZ(), top = h.topY;
    for (let i = 0; i < DUST_N; i++) {
      const a = Math.random() * Math.PI * 2, o = i * 3, floor = i % 2;
      const r = floor ? .12 + Math.random() * .22 : .09 + Math.random() * .06;
      const sp = floor ? .35 + Math.random() * .9 : .5 + Math.random() * 1.1;
      dustPos[o] = cx + Math.cos(a) * r; dustPos[o + 1] = floor ? Y0 + .01 + Math.random() * .03 : top - .01 + Math.random() * .03; dustPos[o + 2] = cz + Math.sin(a) * r;
      dustVel[o] = Math.cos(a) * sp; dustVel[o + 1] = floor ? .12 + Math.random() * .5 : .04 + Math.random() * .32; dustVel[o + 2] = Math.sin(a) * sp;
    }
    dust.geometry.attributes.position.needsUpdate = true;
    dust.visible = true; dustT = 0;
    ring.position.set(cx, top + .002, cz); ring.visible = true; ringT = 0;
  }
  function effects(dt) {
    if (dustT >= 0) {
      dustT += dt;
      const k = Math.exp(-2.2 * dt);
      for (let i = 0; i < DUST_N * 3; i += 3) {
        dustPos[i] += dustVel[i] * dt; dustPos[i + 1] += dustVel[i + 1] * dt; dustPos[i + 2] += dustVel[i + 2] * dt;
        dustVel[i] *= k; dustVel[i + 2] *= k; dustVel[i + 1] = dustVel[i + 1] * k - .2 * dt;
        if (dustPos[i + 1] < Y0 + .005) { dustPos[i + 1] = Y0 + .005; dustVel[i + 1] = 0; }
      }
      dust.geometry.attributes.position.needsUpdate = true;
      const f = dustT / T.dustLife;
      dust.material.opacity = f < .03 ? .9 * f / .03 : .9 * Math.pow(Math.max(0, 1 - f), 1.2);
      dust.material.size = .08 + .2 * Math.min(f, 1);
      if (f >= 1) { dustT = -1; dust.visible = false; }
    }
    if (ringT >= 0) {
      ringT += dt;
      const f = ringT / .6;
      ring.scale.setScalar(1 + 2.6 * f); ring.material.opacity = .8 * Math.max(0, 1 - f);
      if (f >= 1) { ringT = -1; ring.visible = false; }
    }
  }
  // 난간·가이드슈·급유통을 뺀 카 반쪽의 가장 높은 설비. 가) 수직거리는 여기서 천장까지다.
  function sideEquipmentTop(sign) {
    const cx = carGrp.position.x, top = { y: -Infinity, x: cx, z: carGrp.position.z };
    carGrp.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      for (let p = o; p; p = p.parent) {
        if (p.name === 'carHandrail' || p.userData?.type === 'carGuideShoe' || (p.name && /^Oiler/.test(p.name))) return;
      }
      const b = new THREE.Box3().setFromObject(o);
      const mid = (b.min.x + b.max.x) / 2 - cx;
      if (sign > 0 ? mid < -0.05 : mid > 0.05) return;
      if (b.max.y > top.y) Object.assign(top, { y: b.max.y, x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 });
    });
    return top;
  }
  // 라벨은 「기호 이름 수치 ✓/✗」만. 기준 문구 대신 치수선이 번쩍인다(사용자 2026-10-03).
  const okMark = ok => `<span style="color:${ok ? '#7ee08f' : '#ff8a7a'}">${ok ? '✓' : '✗'}</span>`;
  function dimText(id, name, gap, ok) {
    return `<b>${id}</b> ${name} <b>${gap.toFixed(2)} m</b> ${okMark(ok)}`;
  }
  // within: E 처럼 「이내」 기준이면 true.
  function makeSpan(id, name, required, from, to, gap, within = false) {
    const ok = within ? gap <= required + 1e-9 : gap >= required;
    return { id, required, gap, ok, from, to, mid: from.clone().add(to).multiplyScalar(0.5), html: dimText(id, name, gap, ok) };
  }
  // 압축이 끝난 카 높이(지금 위치 + shift)에서 6.5.7.2 상부틈새를 잰다. 천장은 슬래브 하면.
  // 난간은 배치 메시로 합쳐져 상자로는 좌우를 가를 수 없다. 좌우 상부 난간(폭/2−0.15, 파이프 38mm, 윗면 +0.919)은 같은 높이다.
  // 우측 난간: D·E (레일 카메라가 이미 보는 +X 쪽), 좌측 난간: C. 가) 수직은 좌·우 반쪽의 실제 최고 설비 위에 둔다.
  function measureOverhead(shift) {
    const ceil = SHAFT_CEIL_Y, pipe = 0.038, half = S.CAR_W / 2 - 0.15 - pipe / 2;
    const xR = carGrp.position.x + half, xL = carGrp.position.x - half;
    const yTop = carGrp.position.y + S.CAR_H / 2 + 0.90 + pipe / 2 + shift;
    const z0 = CAR_RAIL_Z;
    const dGap = ceil - yTop, eGap = 0.4, cGap = Math.hypot(eGap, dGap);
    const left = sideEquipmentTop(-1), right = sideEquipmentTop(1);
    const where = t => Math.abs(t.x - carGrp.position.x) < 0.3 ? '중앙' : t.x < carGrp.position.x ? '좌측' : '우측';
    const at = (x, y, z) => new THREE.Vector3(x, y, z);
    const span = (id, name, required, from, to, gap, within) => makeSpan(id, name, required, from, to, gap, within);
    // 설비 바로 위 선은 로프·부품에 묻히므로 카 중심 쪽으로 0.12m 비켜 그린다. 앞쪽 설비는 지붕 장면 화각 밖이라 뒤로 0.4m 민다.
    const off = t => t.x + (t.x < carGrp.position.x ? 0.12 : -0.12);
    const aZ = Math.min(left.z, carGrp.position.z + 0.25);
    return {
      sides: { A: where(left), B: where(right) },
      A: span('A', `${where(left)} 설비 수직`, 0.5,
        at(off(left), left.y + shift, aZ), at(off(left), ceil, aZ), ceil - (left.y + shift)),
      B: span('B', `${where(right)} 설비 수직`, 0.5,
        at(right.x + 0.12, right.y + shift, right.z + 0.18), at(right.x + 0.12, ceil, right.z + 0.18), ceil - (right.y + shift)),
      C: span('C', '좌측 난간 경사', 0.5,
        at(xL, yTop, z0 - 0.30), at(xL + eGap, ceil, z0 - 0.30), cGap),
      D: span('D', '우측 난간 수직', 0.3,
        at(xR, yTop, z0 - 0.42), at(xR, ceil, z0 - 0.42), dGap),
      E: span('E', '난간 내측 수평', 0.4,
        at(xR, yTop, z0 + 0.32), at(xR - eGap, yTop, z0 + 0.32), eGap, true)
    };
  }
  /* 카 모드: 완충기가 다 눌린 카 높이(지금 + shift, shift<0)에서 피트 하부틈새와 균형추 레일 여유를 잰다.
     P: 에이프런·가이드슈·안전기·타격판·이동케이블을 뺀 카 최하부 → 피트 바닥(0.50m 이상)
     Q: 에이프런·가이드슈·안전기 최하부 → 피트 바닥(0.10m 이상)
     G: 균형추 가이드슈 윗면 → 균형추 가이드레일(8K) 끝(0.1+0.035v² 이상). 균형추는 카와 반대로 -shift 만큼 올라간다.
     보이는 메시만 쓴다(숨긴 최상단 이음부 FP 등은 Box3 에 섞이면 틀린다). */
  function measurePit(shift, vRated) {
    const vis = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    const strikeGrp = carGrp.getObjectByName('carBufferStrike'), cable = carGrp.getObjectByName('carTravelCable');
    const reduced = o => { for (let q = o; q && q !== carGrp; q = q.parent) if (/apron/i.test(q.name) || q.userData?.type === 'carGuideShoe' || q.name === 'carSafetyGear') return true; return false; };
    const under = o => { for (let q = o; q; q = q.parent) if (q === strikeGrp || q === cable) return true; return false; };
    const lowP = { y: Infinity }, lowQ = { y: Infinity }, b = new THREE.Box3();
    carGrp.traverse(o => {
      if (!o.isMesh || !vis(o) || under(o)) return;
      b.setFromObject(o); if (b.isEmpty()) return;
      const t = reduced(o) ? lowQ : lowP;
      if (b.min.y < t.y) Object.assign(t, { y: b.min.y, x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, xMax: b.max.x });
    });
    const floor = PIT_FLOOR(), at = (x, y, z) => new THREE.Vector3(x, y, z);
    let railTop = -Infinity, railX = 0, railZ = CWT_CENTER_Z;
    railGrp.traverse(o => {
      if (!/^GuideRail_8K_Root$/.test(o.name)) return;
      o.traverse(m => {
        if (!m.isMesh || !vis(m)) return;
        b.setFromObject(m);
        if (b.max.y > railTop + 1e-6 || (Math.abs(b.max.y - railTop) < 1e-6 && (b.min.x + b.max.x) / 2 > railX)) { railTop = b.max.y; railX = (b.min.x + b.max.x) / 2; railZ = (b.min.z + b.max.z) / 2; }
      });
    });
    let shoeTop = -Infinity;
    cwtGrp.getObjectByName('GuideShoes')?.traverse(m => { if (m.isMesh && vis(m)) shoeTop = Math.max(shoeTop, b.setFromObject(m).max.y); });
    const rise = -shift, gx = railX - Math.sign(railX || 1) * .06;
    return {
      cwtRailTop: railTop, cwtShoeTop: shoeTop,
      // P 선은 완충기를 관통하지 않게 +X 로 0.38m 비켜 그린다(값은 최하부 높이 그대로).
      P: makeSpan('P', '카 최하부 → 피트', 0.5, at(lowP.x + .38, lowP.y + shift, lowP.z), at(lowP.x + .38, floor, lowP.z), lowP.y + shift - floor),
      // Q 선은 에이프런(가장 낮은 Q 부품)의 +X 끝에 그린다 — 피트 카메라가 판을 옆에서 본다.
      Q: makeSpan('Q', '에이프런·가이드슈 → 피트', 0.1, at(lowQ.xMax - .03, lowQ.y + shift, lowQ.z), at(lowQ.xMax - .03, floor, lowQ.z), lowQ.y + shift - floor),
      G: makeSpan('G', '균형추 레일 여유', .1 + .035 * vRated * vRated, at(gx, shoeTop + rise, railZ), at(gx, railTop, railZ), railTop - (shoeTop + rise))
    };
  }
  function placeSpan(grp, from, to) {
    _dir.copy(to).sub(from);
    const len = _dir.length() || 0.01;
    _mid.copy(from).add(to).multiplyScalar(0.5);
    grp.position.copy(_mid);
    grp.quaternion.setFromUnitVectors(_up, _dir.multiplyScalar(1 / len));
    grp.getObjectByName('spanLine').scale.y = Math.max(len - 0.12, 0.02);
    grp.getObjectByName('spanHalo').scale.y = len;
    grp.getObjectByName('spanTickLo').position.set(0, -len / 2, 0);
    grp.getObjectByName('spanTickHi').position.set(0, len / 2, 0);
    grp.getObjectByName('spanArrowLo').position.set(0, -len / 2 + 0.03, 0);
    grp.getObjectByName('spanArrowHi').position.set(0, len / 2 - 0.03, 0);
  }
  function showClearance() {
    const q = U.clear, h = q.obstacle - q.top, x = q.lineX ?? q.box.max.x - .16, z = q.lineZ ?? q.box.max.z + .03;
    // 균형추 모드: 레일 끝이 천장 슬래브 속이라 치수선·눈금은 가림 없이, 반투명 공간은 레일처럼 슬래브에 가린다.
    clearGrp.traverse(o => { if (o.material) o.material.depthTest = !isCwt() || o.name === 'clearanceVolume' || o.parent?.name === 'clearanceVolume'; });
    const vol = clearGrp.getObjectByName('clearanceVolume');
    vol.scale.set(q.box.max.x - q.box.min.x, h, q.box.max.z - q.box.min.z);
    vol.position.set((q.box.max.x + q.box.min.x) / 2, q.top + h / 2, (q.box.max.z + q.box.min.z) / 2);
    const line = clearGrp.getObjectByName('clearanceLine');
    line.scale.y = Math.max(h - .12, .01); line.position.set(x, q.top + h / 2, z);
    clearGrp.getObjectByName('clearanceTickLow').position.set(x, q.top + .004, z);
    clearGrp.getObjectByName('clearanceTickHigh').position.set(x, q.obstacle - .004, z);
    clearGrp.getObjectByName('clearanceArrowLow').position.set(x, q.top + .03, z);
    clearGrp.getObjectByName('clearanceArrowHigh').position.set(x, q.obstacle - .03, z);
    clearGrp.visible = true;
    const spans = isCwt() ? q.over : q.under, ids = MODE_SPANS[mode.key];
    overheadGrp.visible = !!spans;
    for (const id of SPAN_IDS) {
      const g = overheadGrp.getObjectByName('over' + id), item = spans && ids.includes(id) ? spans[id] : null;
      g.visible = !!item; if (!item) continue;
      placeSpan(g, item.from, item.to);
      g.traverse(o => { if (!o.isMesh) return; o.material = o.material === coreMat || o.material === coreNgMat ? (item.ok ? coreMat : coreNgMat) : (item.ok ? glowMat : glowNgMat); });
      labels[id].innerHTML = item.html; labels[id].style.borderColor = labels[id].style.color = item.ok ? '#ffd24d' : '#ff8a7a';
      U.anchors[id] = item.mid;
    }
    labels.clear.innerHTML = isCwt()
      ? `카 가이드레일 여유 <b>${q.gap.toFixed(2)} m</b> ${okMark(q.gap >= q.required)}`
      : `<b>H</b> 균형추 위 장애물 <b>${q.gap.toFixed(2)} m</b>`;
    U.anchors.clear = new THREE.Vector3(x, q.top + h / 2, z);
  }
  function placeLabel(el, anchor) {
    if (!anchor) { el.hidden = true; return; }
    _p.copy(anchor).project(camera);
    const shown = _p.z > -1 && _p.z < 1 && Math.abs(_p.x) < 1 && Math.abs(_p.y) < 1;
    el.hidden = !shown; if (!shown) return;
    el.style.left = Math.min(innerWidth - el.offsetWidth - 16, (_p.x + 1) * innerWidth / 2) + 'px';
    el.style.top = (1 - _p.y) * innerHeight / 2 + 'px';
  }

  // 넓은 화면: 치수선 중점 옆에 두고, 이미 놓인 라벨(가이드레일 라벨 포함)과 겹치면 아래로 민다. 오른쪽이 모자라면 왼쪽으로 펼친다.
  const _rects = [];
  function layoutOverLabels(show) {
    _rects.length = 0;
    if (!labels.clear.hidden) _rects.push(labels.clear.getBoundingClientRect());
    const items = [];
    for (const id of SPAN_IDS) {
      const el = labels[id], a = show && MODE_SPANS[mode.key].includes(id) ? U.anchors?.[id] : null;
      el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none'; el.style.right = 'auto'; el.style.transform = 'none'; el.style.fontSize = '13px';
      if (!a) { el.hidden = true; continue; }
      _p.copy(a).project(camera);
      if (!(_p.z > -1 && _p.z < 1 && Math.abs(_p.x) < 1 && Math.abs(_p.y) < 1)) { el.hidden = true; continue; }
      el.hidden = false;
      items.push({ el, x: (_p.x + 1) * innerWidth / 2, y: (1 - _p.y) * innerHeight / 2 });
    }
    items.sort((p, q) => p.y - q.y);
    for (const it of items) {
      const w = it.el.offsetWidth, h = it.el.offsetHeight;
      let left = it.x + 14 + w > innerWidth - 12 ? it.x - 14 - w : it.x + 14;
      left = Math.max(8, left);
      let top = Math.max(60, it.y - h / 2);
      for (let k = 0; k < 8; k++) {
        const hit = _rects.find(r => left < r.right + 4 && left + w > r.left - 4 && top < r.bottom + 4 && top + h > r.top - 4);
        if (!hit) break;
        top = hit.bottom + 6;
      }
      it.el.style.left = left + 'px'; it.el.style.top = top + 'px';
      _rects.push({ left, top, right: left + w, bottom: top + h });
    }
  }

  /* ── 운동 ──────────────────────────────────────────────── */
  function tick(time, deltaMs) {
    if (U.paused) return;
    const real = Math.min((deltaMs || 16.7) / 1000, .05), y = carGrp.position.y;
    if (U.stage === 'approach') {
      if (estop) { halt(); return; }
      const gap = (U.contactY - y) * U.dir;
      U.ts = gap > T.ffGap ? T.ff : gap > T.slowGap ? 1 : T.slow;
      const dt = real * U.ts;
      U.v = Math.min(U.vRated, U.v + T.accel * dt);
      MACH.setDrive(U.v / U.vRated * .8);
      const ny = y + U.dir * U.v * dt;
      if ((ny - U.contactY) * U.dir >= 0) { setCarY(U.contactY); impact(); return; }
      setCarY(ny);
    } else if (U.stage === 'compress') {
      const dt = real * U.ts, bottom = U.contactY + U.dir * U.stroke;
      U.v = Math.max(0, U.v - U.decel * dt);
      const ny = y + U.dir * U.v * dt;
      if (U.v <= 0 || (ny - bottom) * U.dir >= 0) { U.v = 0; setCarY(bottom); settle(); return; }
      setCarY(ny);
    }
  }
  function impact() {
    U.stage = 'compress'; U.vImpact = U.v; U.decel = U.v * U.v / (2 * U.stroke);
    MACH.setDrive(0); MACH.bufferImpact(); shake(1); burst();
    caption(isCwt() ? '쿵! 균형추 밑 100mm 스트라이커가 우레탄 완충기를 누릅니다' : '쿵! 카 타격판이 우레탄 완충기를 누릅니다', '#ffd9a8');
    updateStatus('v-dir', isCwt() ? '⚠ 균형추 완충기 충돌' : '⚠ 카 완충기 충돌', '#f85149');
  }
  function settle() {
    U.stage = 'settle';
    gsap.ticker.remove(tick); U.tick = null;
    MACH.motorOff();
    const p = { c: U.stroke }, set = () => setCarY(U.contactY + U.dir * p.c);
    const tl = gsap.timeline({ onComplete: observePit });
    tl.to(p, { c: U.stroke - T.rebound, duration: .5, ease: 'power2.out', onUpdate: set })
      .to(p, { c: U.stroke, duration: .6, ease: 'power2.in', onUpdate: set })
      .call(() => { MACH.brakeSet(); U.ts = 1; });
    U.calls.push(tl);
  }
  function observePit() {
    U.stage = 'observe-pit';
    const g = U.decel / 9.81, cwt = isCwt();
    U.anchors.stroke = true;   // 위치는 update() 가 화면 오른쪽 완충기 옆면으로 잡는다
    labels.stroke.innerHTML = `${cwt ? '균형추 ' : ''}우레탄 완충기 압축 <b>${Math.round(U.compression * 1000)} mm</b><br><span style="font-weight:400;color:#f3e7c2">충돌 ${Math.round(U.vImpact * 60)} m/min · 평균 감속 ${g.toFixed(2)} g</span>`;
    caption(cwt
      ? `완충기가 행정 ${Math.round(U.stroke * 1000)}mm 눌리며 균형추를 받았습니다 — 균형추 하부 빔 밑 100mm 스트라이커가 완충기를 칩니다`
      : `완충기가 행정 ${Math.round(U.stroke * 1000)}mm 눌리며 카를 받았습니다 — 타격판 위는 카 바닥까지 채움 강재라 카가 상하지 않습니다`, '#ffe9b8');
    sideCam(1.4);
    later(T.holdPit, () => {
      if (!cwt) {
        // 카 모드: 먼저 카 아래 피트 하부틈새(P·Q), 그다음 균형추 위(G·H).
        U.stage = 'observe-under'; showClearance(); U.view = 'under'; underCam(1.6);
        const u = U.clear.under;
        caption(`카 아래 피트 틈새 — P ${u.P.gap.toFixed(2)}m ${u.P.ok ? '✓' : '✗'} · Q ${u.Q.gap.toFixed(2)}m ${u.Q.ok ? '✓' : '✗'}`, u.P.ok && u.Q.ok ? '#b8f5c4' : '#ffb4a8');
        later(1.6 + T.holdUnder, observeTop);
        return;
      }
      observeTop();
    });
  }
  function observeTop() {
    const cwt = isCwt();
    {
      U.stage = 'observe-cwt';
      showClearance(); topCam(1.8);
      caption(cwt
        ? `균형추가 내려간 만큼 카가 ${Math.round(U.clear.rise * 1000)}mm 올라갔습니다 — 상부 가이드슈 위에 카 가이드레일이 ${U.clear.gap.toFixed(2)}m 남아 카가 레일을 벗어나지 않습니다`
        : `카가 내려간 만큼 균형추가 ${Math.round(U.clear.rise * 1000)}mm 올라갔습니다 — G 균형추 레일 ${U.clear.under.G.gap.toFixed(2)}m ${U.clear.under.G.ok ? '✓' : '✗'} · H 위 장애물 ${U.clear.gap.toFixed(2)}m`, '#ffe9b8');
      const end = () => { U.view = ''; sideCam(1.6); later(1.6, finish); };
      U.view = 'rail';
      later(1.8 + T.holdTop, () => {
        if (!cwt || !U.clear.over) { end(); return; }
        const o = U.clear.over, ok = ['A', 'B', 'C', 'D'].every(id => o[id].gap >= o[id].required) && o.E.gap <= o.E.required + 1e-9;
        U.view = 'roof'; roofCam(1.6);
        caption(`카 지붕 상부틈새 — ${['A', 'B', 'C', 'D', 'E'].map(id => `${id} ${o[id].gap.toFixed(2)}m ${o[id].ok ? '✓' : '✗'}`).join(' · ')}`, ok ? '#b8f5c4' : '#ffb4a8');
        later(1.6 + T.holdRoof, end);
      });
    }
  }
  function finish() {
    U.stage = 'done';
    setIcon(true); btns[mode.key].disabled = false; controls.enabled = true;
    if (isCwt()) {
      caption(`균형추 완충기 압축 ${Math.round(U.compression * 1000)}mm · 카 가이드레일 여유 ${U.clear.gap.toFixed(2)}m ${U.clear.gap >= U.clear.required ? '✓' : '✗'} — 아이콘 또는 복귀 버튼으로 최상층 복귀`, '#b8f5c4');
      updateStatus('v-dir', '균형추 완충기 위 정지 · 복귀 대기', '#f0883e');
    } else {
      const u = U.clear.under;
      caption(`완충기 압축 ${Math.round(U.compression * 1000)}mm · ${['P', 'Q', 'G'].map(id => `${id} ${u[id].gap.toFixed(2)}m ${u[id].ok ? '✓' : '✗'}`).join(' · ')} · H ${U.clear.gap.toFixed(2)}m — 아이콘 또는 복귀 버튼으로 1층 복귀`, '#b8f5c4');
      updateStatus('v-dir', '카 완충기 위 정지 · 복귀 대기', '#f0883e');
    }
  }
  // 일시정지: GSAP 전체(자막 지연·카메라·반동)를 멈추고 tick·먼지도 멈춘다. 멈춘 동안 화면 회전 허용.
  const pausable = () => U.active && !['done', 'halted', 'resetting', 'rest'].includes(U.stage);
  function togglePause(force) {
    const want = force ?? !U.paused;
    if (want === !!U.paused || (want && !pausable())) return;
    if (want) {
      U.paused = true;
      U.pauseCam = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov };
      gsap.globalTimeline.pause();
      MACH.setDrive(0);
      controls.enabled = true;
    } else {
      U.paused = false;
      controls.enabled = false;
      const s = U.pauseCam; U.pauseCam = null;
      gsap.globalTimeline.resume();
      if (s && !gsap.isTweening(camera.position)) {
        gsap.to(camera.position, { x: s.p.x, y: s.p.y, z: s.p.z, duration: .6, ease: 'power2.inOut' });
        gsap.to(controls.target, { x: s.t.x, y: s.t.y, z: s.t.z, duration: .6, ease: 'power2.inOut' });
      }
      if (U.stage === 'approach') MACH.setDrive(U.v / U.vRated * .8);
    }
    pauseBtn.textContent = U.paused ? '▶ 재생' : '❚❚ 일시정지';
  }
  function halt() {
    togglePause(false);
    U.calls.forEach(c => c.kill()); U.calls = [];
    gsap.ticker.remove(tick); U.tick = null;
    U.v = 0; U.stage = 'halted'; U.ts = 1;
    MACH.motorOff(); MACH.brakeSet();
    setIcon(true); btns[mode.key].disabled = false; controls.enabled = true;
    updateStatus('v-spd', '0 m/min'); updateStatus('v-dir', '■ 비상정지 · 완충기 시연 중단', '#f85149');
    caption(`비상정지로 시연을 멈췄습니다 — 복귀하면 ${mode.homeFloor() + 1}층으로 돌아갑니다`, '#ffb4a8');
  }

  /* ── 시연 흐름 ─────────────────────────────────────────── */
  function start(key = 'car') {
    if (U.active) return;
    const m = MODES[key] || MODES.car;
    const why = blocked(m);
    if (why) { updateStatus('v-dir', why, '#f0883e'); return; }
    if (doorOpen || gsap.isTweening(carDoorL.position)) {
      clearTimeout(autoTimer); updateStatus('v-dir', '완충기 시연 · 문 닫는 중', '#58a6ff');
      closeDoors(() => { if (!U.active && !moving) start(m.key); });
      return;
    }
    if (!CarDoor.secured() || !DoorBypass.hallSecured()) { updateStatus('v-door', '카문·승장문 닫힘 및 잠금 확인 대기', '#f0883e'); return; }
    closeAllMenus(); clearTimeout(autoTimer);
    mode = m;
    const h = handle(), y0 = carGrp.position.y, vRated = targetSpeed / 60;
    scene.updateMatrixWorld(true);
    let contactY, clear;
    if (m.key === 'cwt') {
      // 균형추 타격면이 완충기 상면에 닿는 카 높이(균형추는 카와 반대로 같은 양 움직인다).
      contactY = y0 + (cwtGrp.position.y + strike().faceY - h.topY);
      // shift: 시작 위치부터 실제 이동량(형상 이동), rise: 최상층 정위치를 넘어 올라간 양(표시).
      const shift = contactY + h.stroke - y0, rise = contactY + h.stroke - (FLOOR_Y[FLOORS - 1] + S.CAR_H / 2);
      const railTop = railGrp.userData.carRailTopY, shoes = upperShoes();
      const tops = shoes.map(s => shoeBodyBox(s, new THREE.Box3()).max.y), shoeTop = Math.max(...tops);
      shoeBodyBox(shoes.find(s => /_R_/.test(s.name)) || shoes[0], _box);   // 치수는 화면 오른쪽(+X) 레일에 그린다
      const box = _box.clone().translate(new THREE.Vector3(0, shift, 0));
      clear = { box, top: shoeTop + shift, obstacle: railTop, obstacleName: 'carGuideRailTop', rise, shift, gap: railTop - (shoeTop + shift),
        before: railTop - shoeTop, required: .1 + .035 * vRated * vRated, lineX: box.min.x - .03, lineZ: box.max.z + .03,
        over: measureOverhead(shift) };
    } else {
      _box.setFromObject(cwtGrp);
      contactY = h.topY - strike().faceY;
      const rise = y0 - (contactY - h.stroke), top = _box.max.y, obstacle = overheadObstacle(top);
      clear = { box: _box.clone().translate(new THREE.Vector3(0, rise, 0)), top: top + rise, obstacle: obstacle.y, obstacleName: obstacle.name,
        rise, gap: obstacle.y - (top + rise), before: obstacle.y - top, under: measurePit(contactY - h.stroke - y0, vRated) };
    }
    Object.assign(U, { active: true, stage: 'approach', mode: m.key, dir: m.dir, v: 0, ts: 1, calls: [], paused: false, pauseCam: null, view: '', startY: y0, contactY, stroke: h.stroke,
      fov0: camera.fov, vRated, compression: 0, anchors: {}, clear });
    lastFloor = -1;
    moving = true; currentState = ELEVATOR_STATE.MOVING;   // 다른 운행·도어 명령 차단
    document.body.classList.add('buffer-demo-active');
    btns[m.key].disabled = true;
    _saveCam(); pitCam(1.4);
    caption(m.key === 'cwt' ? '카가 최상층을 지나쳐 정격속도로 올라갑니다 — 내려오는 균형추를 균형추 완충기가 받아 줍니다'
      : '카가 최하층을 지나쳐 정격속도로 내려갑니다 — 카 완충기가 받아 줍니다');
    updateStatus('v-dir', m.key === 'cwt' ? '▲ 균형추 완충기 충돌 시연' : '▼ 완충기 충돌 시연', '#f85149');
    MACH.resume();
    later(1.3, () => { MACH.brakeRelease(); MACH.motorOn(); U.tick = tick; gsap.ticker.add(tick); });
  }
  function reset() {
    if (!U.active || (U.stage !== 'done' && U.stage !== 'halted')) return;
    U.stage = 'resetting'; btns[mode.key].disabled = true;
    U.calls.forEach(c => c.kill()); U.calls = [];
    if (U.tick) { gsap.ticker.remove(U.tick); U.tick = null; }
    clearGrp.visible = false; overheadGrp.visible = false; U.anchors = {}; fovTo(U.fov0, 1.2);
    const home = mode.homeFloor();
    caption(isCwt() ? `복귀 · 카를 내려 균형추를 완충기에서 떼고 ${home + 1}층에 착상합니다` : '복귀 · 카를 올려 완충기에서 떼고 1층에 착상합니다');
    updateStatus('v-dir', '완충기 시연 복귀 중…', '#f0883e');
    _restoreCam(1.2);
    const target = FLOOR_Y[home] + S.CAR_H / 2, p = { y: carGrp.position.y };
    MACH.resume(); MACH.motorOn(); MACH.brakeRelease();
    gsap.to(p, { y: target, duration: Math.max(Math.abs(target - p.y) / .3, 1), delay: .5, ease: 'power1.inOut',
      onUpdate: () => { U.v = .3; MACH.setDrive(.3); setCarY(p.y); },
      onComplete: () => {
        U.v = 0; setCarY(target); compress(0); MACH.motorOff(); MACH.brakeSet();
        moving = false; currentState = ELEVATOR_STATE.IDLE; curFloor = home;
        syncAllIndicators(home + 1, '');
        updateStatus('v-floor', (home + 1) + 'F', '#3fb950'); updateStatus('v-spd', '0 m/min', '#f0883e'); updateStatus('v-dir', '정지 대기', '#8b949e');
        document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.f) === home));
        document.body.classList.remove('buffer-demo-active');
        U.active = false; U.stage = 'rest'; caption('');
        setIcon(false); btns[mode.key].disabled = false;
      } });
  }

  // 렌더 루프 — 효과 진행, 아이콘·치수 라벨 위치만 갱신(형상 생성 없음)
  function update() {
    if (!btns.car) return;
    const now = performance.now(), dt = lastNow ? Math.min((now - lastNow) / 1000, .05) : 0; lastNow = now;
    effects(U.paused ? 0 : dt * (U.active ? U.ts : 1));
    pauseBtn.hidden = !pausable();
    if (innerWidth < 800) Object.assign(pauseBtn.style, { left: '8px', top: '76px', transform: 'none' });
    else Object.assign(pauseBtn.style, { left: '50%', top: '14px', transform: 'translateX(-50%)' });
    if (!pauseBtn.hidden && !pauseBtn.textContent) pauseBtn.textContent = '❚❚ 일시정지';
    // 치수선 번쩍임: 후광·심선·가이드레일 치수가 함께 맥동한다(멈춤 중에는 그대로).
    if ((overheadGrp.visible || clearGrp.visible) && !U.paused) {
      const k = .5 + .5 * Math.sin(now * .011);
      glowMat.opacity = glowNgMat.opacity = .1 + .62 * k;
      coreMat.opacity = coreNgMat.opacity = .5 + .5 * k;
      clearCoreMat.opacity = .45 + .55 * k;
    }
    const free = PartActions.iconsVisible && !InterlockDemo.active && !UCMDemo.state.active && !overspeedActive;
    for (const m of Object.values(MODES)) {
      const hm = handle(m), b = btns[m.key];
      let shown = false;
      if (free && hm && (!U.active || (U.mode === m.key && (U.stage === 'done' || U.stage === 'halted')))) {
        _p.set(0, hm.topY + .18, m.z());
        if (camera.position.distanceToSquared(_p) < T.iconRange * T.iconRange) {
          _p.project(camera);
          shown = _p.z > -1 && _p.z < 1 && Math.abs(_p.x) < .96 && Math.abs(_p.y) < .94;
          if (shown) PartActions.positionButton(b, (_p.x + 1) * innerWidth / 2 - 22, (1 - _p.y) * innerHeight / 2 - 22);
        }
      }
      b.hidden = !shown;
    }
    const h = handle();
    let strokeAnchor = null;
    if (U.active && U.stage !== 'resetting' && U.anchors?.stroke && h && U.view !== 'roof') {
      // 라벨은 기준점 오른쪽으로 펼쳐진다 — 카메라 오른쪽 방향의 완충기 옆면을 기준점으로 쓴다.
      _r.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      strokeAnchor = _a.set(0, h.topY - U.stroke / 2, CZ()).addScaledVector(_r, .13);
    }
    placeLabel(labels.stroke, strokeAnchor);
    const ids = MODE_SPANS[mode.key], showOver = U.active && U.stage !== 'resetting' && !!U.anchors?.[ids[0]];
    placeLabel(labels.clear, U.active && U.stage !== 'resetting' ? U.anchors?.clear : null);
    // 넓은 화면은 치수선 옆에 글자를 벌린다. 좁은 화면은 왼쪽 줄로 모아 겹치지 않게 한다. 가이드레일 라벨은 그대로다.
    if (showOver && innerWidth < 800) {
      // 일시정지 버튼 아래부터 왼쪽 한 줄로 쌓고, 가이드레일 라벨과 겹치면 그 아래로 넘긴다.
      const rail = labels.clear.hidden ? null : labels.clear.getBoundingClientRect();
      let top = 118;
      for (const id of SPAN_IDS) if (!STACK[mode.key].includes(id)) labels[id].hidden = true;
      for (const id of STACK[mode.key]) {
        const el = labels[id];
        el.hidden = false; el.style.right = 'auto'; el.style.left = '8px';
        el.style.whiteSpace = 'normal'; el.style.maxWidth = '64vw'; el.style.transform = 'none'; el.style.fontSize = '11px';
        const h = el.offsetHeight;
        if (rail && top < rail.bottom + 4 && top + h > rail.top - 4) top = rail.bottom + 6;
        el.style.top = top + 'px'; top += h + 4;
      }
    } else {
      layoutOverLabels(showOver);
    }
  }

  return { build, update, start, reset, halt, get active() { return U.active; }, get mode() { return U.mode; }, get state() { return U; }, timing: T };
})();
