/* ─────────────────────────────────────────────────────────────
   카 완충기 충돌 시연 (사용자 001601 · 2026-09-29)
   ▪ 피트 카 완충기 위 아이콘을 누르면 카가 최하층을 지나 정격속도로 내려와 우레탄 완충기를 "쿵" 친다.
     타격판(CarUnderbody 의 carBufferStrike)이 완충기를 행정 60mm 만큼 누르고, 먼지가 일어난다.
   ▪ 카가 내려간 만큼 균형추가 올라간다. 그 상태에서 균형추 위에 남는 거리(상부 여유거리)를
     노란 치수와 함께 보여 준다. 여유거리는 시연 시작 때 균형추 위 실제 장애물 높이에서 잰다.
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
    holdTop: 4.2,     // 균형추 상부 관찰 (s)
    dustLife: 2.6,    // 먼지 수명 (s, 느린 동작 반영)
    iconRange: 4.5    // 아이콘이 보이는 카메라 거리 (m)
  };
  const svg = p => `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>')}")`;
  const ICON = svg('<path d="M12 2v7m-3-3 3 3 3-3"/><path d="M6 11h12"/><rect x="8" y="13" width="8" height="5" rx="1.5"/><path d="M5 21h14M10 18v3m4-3v3"/>');
  const RESET = svg('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>');
  const DUST_N = 220, CWT_FOV = 68;
  const U = { active: false, stage: 'rest', v: 0, ts: 1, calls: [] };
  const _p = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _box = new THREE.Box3();
  let btn, dust, dustPos, dustVel, dustT = -1, ring, ringT = -1, clearGrp, labels = {}, lastNow = 0, lastFloor = -1;

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

    // 균형추 상부 여유거리 치수: 반투명 공간 + 세로 치수선 + 양끝 눈금. 단위 형상을 배율로 늘린다.
    const yellow = new THREE.MeshBasicMaterial({ color: 0xffc53d, depthWrite: false, transparent: true, opacity: .95 });
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

    for (const [k, color] of [['stroke', '#ffe08a'], ['clear', '#ffd24d']]) {
      const el = document.createElement('div'); el.className = 'buffer-demo-label'; el.id = 'buffer-demo-' + k; el.hidden = true;
      el.style.cssText = `position:fixed;z-index:31;pointer-events:none;padding:5px 10px;border-radius:7px;background:#142230e8;border:1px solid ${color};color:${color};font:600 13px/1.35 sans-serif;white-space:nowrap;transform:translate(10px,-50%)`;
      document.body.appendChild(el); labels[k] = el;
    }
    btn = document.getElementById('buffer-demo-action');
    btn.style.setProperty('--part-icon', ICON);
    btn.addEventListener('click', () => { if (!U.active) start(); else if (U.stage === 'done' || U.stage === 'halted') reset(); });
  }

  /* ── 공용 ──────────────────────────────────────────────── */
  const handle = () => bufferGrp?.userData.car;
  const strike = () => carGrp.getObjectByName('carBufferStrike')?.userData;
  function later(sec, fn) { const c = gsap.delayedCall(sec, fn); U.calls.push(c); return c; }
  function caption(text, tone = '#eef5fa') {
    let el = document.getElementById('buffer-stage');
    if (!el) {
      el = document.createElement('div'); el.id = 'buffer-stage'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);max-width:min(760px,88vw);padding:12px 20px;background:#142230ed;color:#eef5fa;border:1px solid #66859b;border-radius:9px;font:15px/1.5 sans-serif;z-index:31;pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.hidden = !text; el.style.color = tone; el.textContent = text ? '완충기 충돌 시연  |  ' + text : '';
  }
  function setIcon(reset) {
    btn.style.setProperty('--part-icon', reset ? RESET : ICON);
    btn.textContent = reset ? 'RST' : 'BUF';
    btn.classList.toggle('active', reset);
    btn.setAttribute('aria-label', reset ? '완충기 충돌 시연 복귀' : '카 완충기 충돌 시연');
    btn.title = btn.getAttribute('aria-label');
  }
  function blocked() {
    return InterlockDemo.active || UCMDemo.state.active ? '다른 시연이 끝난 뒤 시연'
      : InspectionReturn.busy || HallManual.busy ? '점검 작업이 끝난 뒤 시연'
      : !PitLadder.secured ? '피트 사다리 펼침 — 운행 차단'
      : insMode ? '점검운전 중 — AUT 로 전환 후 시연'
      : DoorBypass.mode !== 'off' ? 'BYPASS 해제 후 시연'
      : overspeedActive || estop ? '다른 고장 복귀(RST) 후 시연'
      : moving ? '운행 정지 후 시연'
      : CarDoor.state?.busy ? '도어 동작이 끝난 뒤 시연'
      : handle()?.type !== 'urethane' ? '우레탄 완충기(60 m/min 이하)에서 시연 — 운행 속도를 바꿔 주세요'
      : !strike() ? '카 하부 타격부 준비 중' : '';
  }
  // 균형추 바로 위(평면 투영이 겹치는) 가장 낮은 고정물 하면. 로프·레일은 균형추와 함께 지나가므로 제외.
  function overheadObstacle(top) {
    _box.setFromObject(cwtGrp);
    const fp = _box.clone(), b = new THREE.Box3();
    let y = SHAFT_CEIL_Y, name = 'shaftCeiling';
    scene.traverse(o => {
      if (!o.isMesh || /rope|rail/i.test(o.name) || o === dust || o === ring) return;
      for (let p = o; p; p = p.parent) if (!p.visible || p === cwtGrp || p === carGrp || p === clearGrp) return;
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
  // 카 이동 + 균형추 반대 이동 + 로프·시브 + 완충기 압축(카 위치에서 계산).
  function setCarY(y) {
    const d = y - carGrp.position.y;
    if (d) {
      carGrp.position.y = y; cwtGrp.position.y -= d;
      spinSheaves(d); refreshRopes(); refreshGovernorRope();
      const l = scene.getObjectByName('carLight'); if (l) l.position.y = y + S.CAR_H * .75;
    }
    compress(Math.min(Math.max(U.contactY - y, 0), U.stroke + .004));
    const f = displayFloor();
    if (f !== lastFloor) { lastFloor = f; syncAllIndicators(f + 1, U.stage === 'resetting' ? '' : '↓'); }
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
  const CZ = () => CAR_CTR_Z;
  function fovTo(fov, dur) { gsap.to(camera, { fov, duration: dur, ease: 'power2.inOut', onUpdate: () => camera.updateProjectionMatrix() }); }
  /* 피트: 카 뒤쪽(−Z) 아래에서 본다. 앞쪽은 하중검출 스위치 줄이 타격판을 가린다.
     카가 완충기에 올라앉아도 카메라는 플랭크 아래·카 바닥 밑 빈 공간에 남는다. */
  function pitCam(dur) {
    const h = handle();
    fovTo(U.fov0, dur);
    _camTo(0.5, 0.38, CZ() - 0.8, 0, h.topY + .02, CZ(), dur, 'power2.inOut');
  }
  // 옆(+X)에서 플랭크 채널을 따라 본다: 두 웹 사이를 꽉 채운 강재·타격판·눌린 완충기가 한 화면에 든다.
  function sideCam(dur) {
    const h = handle(), z = CZ() + .04;
    fovTo(U.fov0, dur);
    _camTo(0.95, h.topY - .05, z, 0, h.topY + .02, z, dur, 'power2.inOut');
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
  function showClearance() {
    const q = U.clear, h = q.obstacle - q.top, x = q.box.max.x - .16, z = q.box.max.z + .03;
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
    labels.clear.innerHTML = `균형추 상부 여유거리 <b>${q.gap.toFixed(2)} m</b><br><span style="font-weight:400;color:#f3e7c2">균형추 +${Math.round(q.rise * 1000)} mm 상승</span>`;
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

  /* ── 운동 ──────────────────────────────────────────────── */
  function tick(time, deltaMs) {
    const real = Math.min((deltaMs || 16.7) / 1000, .05), y = carGrp.position.y;
    if (U.stage === 'approach') {
      if (estop) { halt(); return; }
      const gap = y - U.contactY;
      U.ts = gap > T.ffGap ? T.ff : gap > T.slowGap ? 1 : T.slow;
      const dt = real * U.ts;
      U.v = Math.min(U.vRated, U.v + T.accel * dt);
      MACH.setDrive(U.v / U.vRated * .8);
      const ny = y - U.v * dt;
      if (ny <= U.contactY) { setCarY(U.contactY); impact(); return; }
      setCarY(ny);
    } else if (U.stage === 'compress') {
      const dt = real * U.ts, bottom = U.contactY - U.stroke;
      U.v = Math.max(0, U.v - U.decel * dt);
      const ny = y - U.v * dt;
      if (U.v <= 0 || ny <= bottom) { U.v = 0; setCarY(bottom); settle(); return; }
      setCarY(ny);
    }
  }
  function impact() {
    U.stage = 'compress'; U.vImpact = U.v; U.decel = U.v * U.v / (2 * U.stroke);
    MACH.setDrive(0); MACH.bufferImpact(); shake(1); burst();
    caption('쿵! 카 타격판이 우레탄 완충기를 누릅니다', '#ffd9a8');
    updateStatus('v-dir', '⚠ 카 완충기 충돌', '#f85149');
  }
  function settle() {
    U.stage = 'settle';
    gsap.ticker.remove(tick); U.tick = null;
    MACH.motorOff();
    const p = { c: U.stroke }, set = () => setCarY(U.contactY - p.c);
    const tl = gsap.timeline({ onComplete: observePit });
    tl.to(p, { c: U.stroke - T.rebound, duration: .5, ease: 'power2.out', onUpdate: set })
      .to(p, { c: U.stroke, duration: .6, ease: 'power2.in', onUpdate: set })
      .call(() => { MACH.brakeSet(); U.ts = 1; });
    U.calls.push(tl);
  }
  function observePit() {
    U.stage = 'observe-pit';
    const g = U.decel / 9.81;
    U.anchors.stroke = true;   // 위치는 update() 가 화면 오른쪽 완충기 옆면으로 잡는다
    labels.stroke.innerHTML = `우레탄 완충기 압축 <b>${Math.round(U.compression * 1000)} mm</b><br><span style="font-weight:400;color:#f3e7c2">충돌 ${Math.round(U.vImpact * 60)} m/min · 평균 감속 ${g.toFixed(2)} g</span>`;
    caption(`완충기가 행정 ${Math.round(U.stroke * 1000)}mm 눌리며 카를 받았습니다 — 타격판 위는 카 바닥까지 채움 강재라 카가 상하지 않습니다`, '#ffe9b8');
    sideCam(1.4);
    later(T.holdPit, () => {
      U.stage = 'observe-cwt';
      showClearance(); cwtCam(1.8);
      caption(`카가 내려간 만큼 균형추가 ${Math.round(U.clear.rise * 1000)}mm 올라갔습니다 — 위에 ${U.clear.gap.toFixed(2)}m 여유거리가 남습니다`, '#ffe9b8');
      later(1.8 + T.holdTop, () => { sideCam(1.6); later(1.6, finish); });
    });
  }
  function finish() {
    U.stage = 'done';
    setIcon(true); btn.disabled = false; controls.enabled = true;
    caption(`완충기 압축 ${Math.round(U.compression * 1000)}mm · 균형추 상부 여유 ${U.clear.gap.toFixed(2)}m. 아이콘 또는 복귀 버튼으로 1층 복귀`, '#b8f5c4');
    updateStatus('v-dir', '카 완충기 위 정지 · 복귀 대기', '#f0883e');
  }
  function halt() {
    U.calls.forEach(c => c.kill()); U.calls = [];
    gsap.ticker.remove(tick); U.tick = null;
    U.v = 0; U.stage = 'halted'; U.ts = 1;
    MACH.motorOff(); MACH.brakeSet();
    setIcon(true); btn.disabled = false; controls.enabled = true;
    updateStatus('v-spd', '0 m/min'); updateStatus('v-dir', '■ 비상정지 · 완충기 시연 중단', '#f85149');
    caption('비상정지로 시연을 멈췄습니다 — 복귀하면 1층으로 돌아갑니다', '#ffb4a8');
  }

  /* ── 시연 흐름 ─────────────────────────────────────────── */
  function start() {
    if (U.active) return;
    const why = blocked();
    if (why) { updateStatus('v-dir', why, '#f0883e'); return; }
    if (doorOpen || gsap.isTweening(carDoorL.position)) {
      clearTimeout(autoTimer); updateStatus('v-dir', '완충기 시연 · 문 닫는 중', '#58a6ff');
      closeDoors(() => { if (!U.active && !moving) start(); });
      return;
    }
    if (!CarDoor.secured() || !DoorBypass.hallSecured()) { updateStatus('v-door', '카문·승장문 닫힘 및 잠금 확인 대기', '#f0883e'); return; }
    closeAllMenus(); clearTimeout(autoTimer);
    const h = handle();
    scene.updateMatrixWorld(true);
    _box.setFromObject(cwtGrp);
    const contactY = h.topY - strike().faceY, finalY = contactY - h.stroke, rise = carGrp.position.y - finalY;
    const top = _box.max.y, obstacle = overheadObstacle(top);
    Object.assign(U, { active: true, stage: 'approach', v: 0, ts: 1, calls: [], startY: carGrp.position.y, contactY, stroke: h.stroke, fov0: camera.fov,
      vRated: targetSpeed / 60, compression: 0, anchors: {},
      clear: { box: _box.clone().translate(new THREE.Vector3(0, rise, 0)), top: top + rise, obstacle: obstacle.y, obstacleName: obstacle.name,
        rise, gap: obstacle.y - (top + rise), before: obstacle.y - top } });
    lastFloor = -1;
    moving = true; currentState = ELEVATOR_STATE.MOVING;   // 다른 운행·도어 명령 차단
    document.body.classList.add('buffer-demo-active');
    btn.disabled = true;
    _saveCam(); pitCam(1.4);
    caption('카가 최하층을 지나쳐 정격속도로 내려갑니다 — 카 완충기가 받아 줍니다');
    updateStatus('v-dir', '▼ 완충기 충돌 시연', '#f85149');
    MACH.resume();
    later(1.3, () => { MACH.brakeRelease(); MACH.motorOn(); U.tick = tick; gsap.ticker.add(tick); });
  }
  function reset() {
    if (!U.active || (U.stage !== 'done' && U.stage !== 'halted')) return;
    U.stage = 'resetting'; btn.disabled = true;
    U.calls.forEach(c => c.kill()); U.calls = [];
    if (U.tick) { gsap.ticker.remove(U.tick); U.tick = null; }
    clearGrp.visible = false; U.anchors = {}; fovTo(U.fov0, 1.2);
    caption('복귀 · 카를 올려 완충기에서 떼고 1층에 착상합니다');
    updateStatus('v-dir', '완충기 시연 복귀 중…', '#f0883e');
    _restoreCam(1.2);
    const target = FLOOR_Y[0] + S.CAR_H / 2, p = { y: carGrp.position.y };
    MACH.resume(); MACH.motorOn(); MACH.brakeRelease();
    gsap.to(p, { y: target, duration: Math.max(Math.abs(target - p.y) / .3, 1), delay: .5, ease: 'power1.inOut',
      onUpdate: () => { U.v = .3; MACH.setDrive(.3); setCarY(p.y); },
      onComplete: () => {
        U.v = 0; setCarY(target); compress(0); MACH.motorOff(); MACH.brakeSet();
        moving = false; currentState = ELEVATOR_STATE.IDLE; curFloor = 0;
        syncAllIndicators(1, '');
        updateStatus('v-floor', '1F', '#3fb950'); updateStatus('v-spd', '0 m/min', '#f0883e'); updateStatus('v-dir', '정지 대기', '#8b949e');
        document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.f) === 0));
        document.body.classList.remove('buffer-demo-active');
        U.active = false; U.stage = 'rest'; caption('');
        setIcon(false); btn.disabled = false;
      } });
  }

  // 렌더 루프 — 효과 진행, 아이콘·치수 라벨 위치만 갱신(형상 생성 없음)
  function update() {
    if (!btn) return;
    const now = performance.now(), dt = lastNow ? Math.min((now - lastNow) / 1000, .05) : 0; lastNow = now;
    effects(dt * (U.active ? U.ts : 1));
    const h = handle();
    const showIcon = PartActions.iconsVisible && !!h && !InterlockDemo.active && !UCMDemo.state.active && !overspeedActive
      && (!U.active || U.stage === 'done' || U.stage === 'halted');
    let shown = false;
    if (showIcon) {
      _p.set(0, h.topY + .18, CZ());
      if (camera.position.distanceToSquared(_p) < T.iconRange * T.iconRange) {
        _p.project(camera);
        shown = _p.z > -1 && _p.z < 1 && Math.abs(_p.x) < .96 && Math.abs(_p.y) < .94;
        if (shown) PartActions.positionButton(btn, (_p.x + 1) * innerWidth / 2 - 22, (1 - _p.y) * innerHeight / 2 - 22);
      }
    }
    btn.hidden = !shown;
    let strokeAnchor = null;
    if (U.active && U.stage !== 'resetting' && U.anchors?.stroke && h) {
      // 라벨은 기준점 오른쪽으로 펼쳐진다 — 카메라 오른쪽 방향의 완충기 옆면을 기준점으로 쓴다.
      _r.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      strokeAnchor = _a.set(0, h.topY - U.stroke / 2, CZ()).addScaledVector(_r, .13);
    }
    placeLabel(labels.stroke, strokeAnchor);
    placeLabel(labels.clear, U.active && U.stage !== 'resetting' ? U.anchors?.clear : null);
  }

  return { build, update, start, reset, halt, get active() { return U.active; }, get state() { return U; }, timing: T };
})();
