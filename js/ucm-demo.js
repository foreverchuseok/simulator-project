/* ─────────────────────────────────────────────────────────────
   개문발차(UCM, Unintended Car Movement) 시연 — 로프브레이크 정상 / 미작동 / 미설치
   ▪ 어느 이유로(권상기 브레이크 고장) 문이 열린 채 카가 올라간다. 빈 카는 균형추보다 가벼워 상승한다.
   ▪ 정상: 기계실 로프브레이크가 로프를 "쾅" 물어 카를 세운다. 현장 기준대로 에이프런 2/3가
     드러나기 전(약 +0.38m)에 멈춘다. 타려던 승객은 에이프런에 걸려 넘어지지만(전도) 크게 다치지 않는다.
   ▪ 미작동·미설치: 카가 계속 올라가고 승객이 문틈으로 쏠린다. 장면은 사고 순간 전에
     붉은 화면과 안내 카드로 넘어간다(초등학생이 봐도 거부감 없게, 잔혹 묘사 없음).
   ▪ 캐릭터 「퉁이」는 기계실 마스코트 「승강곰」과 같은 구·타원체 조형이다. build() 에서 한 번만 만들고
     update() 는 변환만 바꾼다. 그림자 캐시를 흔들지 않도록 castShadow 를 끄고 발밑 원형 그림자를 쓴다.
   ▪ 로프브레이크 턱: rope_brake.glb 의 BrakeUpperJaw(홈 5개, 홈 바닥 +19mm) / BrakeLowerJaw(평면 −15mm).
     로프 반지름 6mm → 상부 −13mm, 하부 +9mm 이동이면 로프를 문다(ROPE_BRAKE_MOUNT.jawGap 30mm 기준).
   ───────────────────────────────────────────────────────────── */
const UCMDemo = (() => {
  const RB = { upperTravel: -0.013, lowerTravel: 0.009 };
  const MOTION = {
    accel: 0.8,        // 브레이크 고장 상승 가속도 (m/s², 불평형 하중)
    trigger: 0.33,     // 문 열림 상태로 착상 구역을 벗어난 것을 검출하는 상승량 (m) → 정지 약 0.45m (에이프런 60%, 2/3 이전)
    response: 0.04,    // 검출 → 로프 파지까지 지연 (s)
    decel: 3.0,        // 로프브레이크 제동 감속도 (m/s²)
    vMax: 1.0,         // 미작동 시 상한 속도 (m/s)
    failEnd: 1.3,      // 미작동 시 화면 전환 뒤 멈추는 상승량 (m)
    startle: 0.015,    // 카 바닥이 이만큼 올라오면 문턱 위로 내민 발을 빼며 놀란다 (m)
    trip: 0.07,        // 카 문턱이 이만큼 올라오면 걸려 앞으로 넘어지기 시작한다 (m)
    fatalAt: 0.8       // 미작동·미설치: 들려 올라가는 모습이 이 높이에 이르면 안내 카드로 전환 (m)
  };
  /* 넘어짐 — 허리를 굽혀 상체가 올라간 카 바닥을 덮친다(다리는 승장에 선 채 수직, 에이프런 면 바깥).
     굽힘각별 "카 안쪽(CAR_FRONT_Z 너머) 정점의 최저 높이" 표를 시연 시작 때 한 번 만들고, 매 프레임
     카 바닥 높이에 맞는 최대 굽힘각을 고른다. 바닥이 계속 올라오면 상체가 떠밀려 올라가고,
     굽힘각이 lift 보다 작아져야 하면(미작동) 몸 전체가 카 바닥에 실려 들린다. */
  const LEAN = { step: .01, max: 1.5, clear: .006, lift: .35, standOff: .26, gravity: 30 }; // lift .35: 정상 정지(≈0.45m)에서는 들리지 않는다
  /* 시간 배율(느린 동작) — 승장에서는 카가 눈에 보이게(약 +0.12m) 올라가고, 기계실로 가는 동안은
     거의 멈춘 듯하다가, 기계실에서 로프가 천천히 흐르다 파지된다. */
  const TS = { landing: .35, landed: .12, transit: .03, machineRoom: .12, failBack: .05, failLanding: .3 };
  let char = null, parts = null, stars = null, btn = null;
  const U = { active: false, stage: 'rest', mode: 'normal', tl: null, tick: null, ts: 0, rise: 0, v: 0,
    baseY: 0, cwtBase: 0, gripAt: -1, stopped: false, jaws: null, walk: 0, t0: 0 };

  /* ── 캐릭터 「퉁이」 ─────────────────────────────────────── */
  function build(parent) {
    const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const SKIN = std(0xffd9b8, .75), HAIR = std(0x4a3222, .8), SHIRT = std(0xff8a3d, .7), SHIRT_HI = std(0xffb27a, .75),
      PANTS = std(0x2f6fd0, .7), SHOE = std(0xf5f6f8, .5), SOLE = std(0x3a4450, .8), EYE = std(0x16110f, .25),
      WHITE = std(0xffffff, .3), CHEEK = std(0xf59a93, .8), MOUTH = std(0x7a2e22, .5), STAR = std(0xffd22e, .35),
      SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false });
    const sphere = new THREE.SphereGeometry(1, 28, 20);
    const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
    const ball = (p, rx, ry, rz, mat, x, y, z) => { const m = add(p, sphere, mat, x, y, z); m.scale.set(rx, ry, rz); return m; };
    const group = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

    char = new THREE.Group(); char.name = 'UCMPassenger'; char.visible = false;
    char.userData = { type: 'ucm-passenger', name: '퉁이' };
    parent.add(char);
    const shadow = add(char, new THREE.CircleGeometry(.24, 28), SHADOW, 0, .003, 0); shadow.rotation.x = -Math.PI / 2;
    shadow.userData.ucmDecal = true;
    const body = group(char, 0, .42, 0);           // 골반 피벗
    const legs = [-1, 1].map(s => {
      const hip = group(body, s * .1, 0, 0);
      ball(hip, .085, .17, .085, PANTS, 0, -.14, 0);
      ball(hip, .07, .09, .07, SKIN, 0, -.29, 0);   // 짧은 종아리
      ball(hip, .085, .05, .12, SHOE, 0, -.375, .035);
      ball(hip, .086, .012, .121, SOLE, 0, -.418, .035);
      return hip;
    });
    ball(body, .25, .13, .22, PANTS, 0, .04, 0);
    ball(body, .26, .3, .23, SHIRT, 0, .25, 0);      // 동글동글한 배
    ball(body, .15, .17, .07, SHIRT_HI, 0, .22, .17);
    const arms = [-1, 1].map(s => {
      const sh = group(body, s * .235, .43, 0);
      ball(sh, .07, .14, .07, SHIRT, 0, -.1, 0);
      ball(sh, .058, .058, .058, SKIN, 0, -.24, 0);
      sh.rotation.z = s * .18;
      return sh;
    });
    const head = group(body, 0, .72, 0);
    ball(head, .22, .205, .2, SKIN, 0, 0, 0);
    const hair = add(head, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * .56), HAIR);
    hair.scale.set(.232, .22, .215); hair.position.set(0, .02, -.012); hair.rotation.x = -.35;
    ball(head, .05, .035, .03, HAIR, .03, .2, .09).rotation.z = .5;   // 앞머리 한 가닥
    for (const s of [-1, 1]) {
      ball(head, .045, .05, .03, SKIN, s * .215, -.01, 0);            // 귀
      ball(head, .03, .038, .016, EYE, s * .075, .02, .185);
      ball(head, .01, .01, .005, WHITE, s * .075 + .01, .035, .2);
      ball(head, .038, .02, .01, CHEEK, s * .13, -.05, .165);
    }
    const mouth = add(head, new THREE.TorusGeometry(.03, .006, 8, 18, Math.PI), MOUTH, 0, -.065, .19);
    mouth.rotation.z = Math.PI;
    // 어지러움 별 3개 (넘어진 뒤 머리 위에서 돈다)
    stars = group(head, 0, .3, 0); stars.visible = false;
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .018 : .042;
      i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: .012, bevelEnabled: false });
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(stars, starGeo, STAR, Math.cos(a) * .2, 0, Math.sin(a) * .2); }
    stars.userData.ucmDecal = true;
    parts = { body, legs, arms, head, mouth };
    char.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    return char;
  }
  function neutral() {
    const p = parts;
    p.body.position.set(0, .42, 0); p.body.rotation.set(0, 0, 0);
    p.legs.forEach(l => l.rotation.set(0, 0, 0));
    p.arms.forEach((a, i) => a.rotation.set(0, 0, (i ? 1 : -1) * .18));
    p.head.rotation.set(0, 0, 0); p.mouth.scale.set(1, 1, 1); p.mouth.rotation.z = Math.PI;
    stars.visible = false;
  }
  /* ★에이프런 관통 방지 — 자세를 잠깐 적용해 실제 정점의 가장 앞(−Z) 값을 재고, 그 자세에서 몸이
     에이프런 면(CAR_FRONT_Z) 바깥에 남는 캐릭터 원점 Z 를 돌려준다. 수치를 손으로 맞추면
     다리를 굽히거나 뻗는 순간 발끝이 에이프런 안으로 들어간다. yLimit 보다 높은 정점(올라간 카 바닥 위,
     문 안쪽 공간)은 따지지 않는다. 걸을 때만 부르며 렌더 루프에서는 쓰지 않는다. */
  const _v = new THREE.Vector3();
  function applyPose(q) {
    const p = parts;
    p.body.position.y = q.bodyY; p.body.rotation.x = q.bodyX;
    q.legs.forEach((x, i) => { p.legs[i].rotation.x = x; });
    q.arms.forEach((a, i) => { p.arms[i].rotation.x = a.x; p.arms[i].rotation.z = a.z; });
  }
  function readPose() {
    const p = parts;
    return { bodyY: p.body.position.y, bodyX: p.body.rotation.x, legs: p.legs.map(l => l.rotation.x),
      arms: p.arms.map(a => ({ x: a.rotation.x, z: a.rotation.z })) };
  }
  function clearZ(q, yLimit, clearance) {
    const saved = readPose(); applyPose(q);
    char.updateMatrixWorld(true);
    let front = Infinity;
    char.traverse(o => {
      if (!o.isMesh) return;
      for (let x = o; x && x !== char; x = x.parent) if (x.userData.ucmDecal) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        _v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        if (_v.y < yLimit && _v.z < front) front = _v.z;
      }
    });
    applyPose(saved); char.updateMatrixWorld(true);
    return char.position.z + (CAR_FRONT_Z + clearance - front);
  }
  // 두 자세 사이를 트윈하는 헬퍼(몸통·다리·팔 동시)
  function toPose(tl, q, at, dur, ease = 'power2.out') {
    const p = parts;
    tl.to(p.body.position, { y: q.bodyY, duration: dur, ease }, at)
      .to(p.body.rotation, { x: q.bodyX, duration: dur, ease }, at);
    q.legs.forEach((x, i) => tl.to(p.legs[i].rotation, { x, duration: dur, ease }, at));
    q.arms.forEach((a, i) => tl.to(p.arms[i].rotation, { x: a.x, z: a.z, duration: dur, ease }, at));
  }
  const POSE = {
    sit:  { bodyY: .2, bodyX: -.12, legs: [-1.0, -.9], arms: [{ x: .7, z: -.5 }, { x: .7, z: .5 }] }      // 엉덩방아
  };

  function leanPose(th) {
    // 상체 θ 굽힘, 다리는 −θ 로 되돌려 수직 유지, 팔은 앞으로 뻗어 카 바닥을 짚는다.
    return { bodyY: .42, bodyX: th, legs: [-th, -th], arms: [{ x: -1.3, z: -.25 }, { x: -1.3, z: .25 }] };
  }
  function buildLeanTable() {
    const saved = readPose(), pos = char.position.clone(), rotY = char.rotation.y, sc = char.scale.x, headX = parts.head.rotation.x;
    char.position.set(0, 0, 0); char.rotation.set(0, Math.PI, 0); char.scale.setScalar(1); parts.head.rotation.x = 0;
    const table = [];
    for (let i = 0; i * LEAN.step <= LEAN.max + 1e-9; i++) {
      applyPose(leanPose(i * LEAN.step)); char.updateMatrixWorld(true);
      let low = Infinity;
      char.traverse(o => {
        if (!o.isMesh) return;
        for (let x = o; x && x !== char; x = x.parent) if (x.userData.ucmDecal) return;
        const a = o.geometry.attributes.position;
        for (let k = 0; k < a.count; k++) {
          _v.fromBufferAttribute(a, k).applyMatrix4(o.matrixWorld);
          if (_v.z < -LEAN.standOff && _v.y < low) low = _v.y;   // 원점에서 앞(−Z)으로 standOff 넘으면 카 안쪽
        }
      });
      table.push(low);
    }
    applyPose(saved); parts.head.rotation.x = headX;
    char.position.copy(pos); char.rotation.set(0, rotY, 0); char.scale.setScalar(sc); char.updateMatrixWorld(true);
    return table;
  }
  // 카 바닥 높이 h(승장 기준)에서 허용되는 최대 굽힘각과, 그래도 모자라면 몸이 들려야 하는 높이.
  function leanFor(h) {
    const need = h + LEAN.clear, T = U.leanTable;
    let i = 0; while (i < T.length && T[i] >= need) i++;
    const th = Math.max(0, i - 1) * LEAN.step;            // 보간하지 않는다 — 표본 사이에서 바닥을 뚫지 않게
    if (th >= LEAN.lift) return { th, lift: 0 };
    const iL = Math.round(LEAN.lift / LEAN.step);
    return { th: LEAN.lift, lift: Math.max(0, need - T[iL]) };
  }
  function applyLean(th) {
    parts.body.rotation.x = th;
    parts.legs.forEach(l => { l.rotation.x = -th; });
  }
  function fallTick(dt) {
    const { th, lift } = leanFor(U.rise);
    U.fallW += LEAN.gravity * dt;
    let next = U.theta + U.fallW * dt;
    if (next >= th) {
      next = th; U.fallW = 0;
      if (!U.landed) { U.landed = true; onLanded(); }
    }
    U.theta = next; applyLean(next);
    char.position.y = FLOOR_Y[U.f] + (next >= th - 1e-9 ? lift : 0);
    if (lift > 0 && U.stage === 'moving' && U.mode !== 'normal') U.stage = 'falling';   // 몸이 카 바닥에 실려 들리기 시작
  }

  // 렌더 루프에서 호출 — 걷기 흔들림과 별 회전만 (형상 생성 없음)
  function update(t) {
    if (!char || !char.visible) return;
    if (U.walk > 0) {
      const w = Math.sin(t * 9) * .5 * U.walk;
      parts.legs[0].rotation.x = w; parts.legs[1].rotation.x = -w;
      parts.arms[0].rotation.x = -w * .8; parts.arms[1].rotation.x = w * .8;
      parts.body.position.y = .42 + Math.abs(Math.sin(t * 9)) * .02 * U.walk;
    }
    if (stars.visible) stars.rotation.y = t * 3;
  }

  /* ── 공용 ──────────────────────────────────────────────── */
  function caption(text, tone = '#eef5fa') {
    let el = document.getElementById('ucm-stage');
    if (!el) {
      el = document.createElement('div'); el.id = 'ucm-stage'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);max-width:min(760px,86vw);padding:12px 20px;background:#142230ed;color:#eef5fa;border:1px solid #66859b;border-radius:9px;font:15px/1.5 sans-serif;z-index:31;pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.hidden = false; el.style.color = tone;
    el.textContent = 'UCM · 개문발차  |  ' + text;
  }
  function overlay(show, html) {
    let el = document.getElementById('ucm-overlay');
    if (!el) {
      el = document.createElement('div'); el.id = 'ucm-overlay'; el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 1.2s ease;background:radial-gradient(circle at 50% 45%,#5c0b0bdd,#140202f2 70%)';
      document.body.appendChild(el);
    }
    if (html) el.innerHTML = html;
    el.style.opacity = show ? '1' : '0';
  }
  const brakeInstall = () => scene.getObjectByName('RopeBrakeInstallation');
  function jaws() {
    if (U.jaws) return U.jaws;
    const up = scene.getObjectByName('BrakeUpperJaw'), lo = scene.getObjectByName('BrakeLowerJaw');
    if (!up || !lo) return null;
    U.jaws = { up, lo, up0: up.position.y, lo0: lo.position.y };
    return U.jaws;
  }
  function setRise(r) {
    const y = U.baseY + r, d = y - carGrp.position.y;
    if (!d) return;
    carGrp.position.y = y; cwtGrp.position.y -= d;
    spinSheaves(d); refreshRopes(); refreshGovernorRope();
    const l = scene.getObjectByName('carLight'); if (l) l.position.y = carGrp.position.y + S.CAR_H * .75;
    updateStatus('v-spd', Math.round(U.v * 60) + ' m/min', '#f85149');
  }
  function landingCam(dur, ease) {
    const L = FLOOR_Y[U.f], z = FRONT_WALL_INNER_Z;
    // 승장 벽이 옆 시야를 막으므로 개구부 정면 약간 오른쪽·낮은 높이에서 본다(오른쪽에 에이프런이 드러남).
    _camTo(0.85, L + 1.1, z + 2.7, 0.1, L + 0.42, z - 0.25, dur, ease);
  }
  // 개문발차 순간: 문턱 높이로 낮춰, 올라가는 카 문턱 밑으로 에이프런이 드러나는 모습을 오른쪽 개구부에서 본다.
  function sillCam(dur) {
    const L = FLOOR_Y[U.f], z = FRONT_WALL_INNER_Z;
    _camTo(1.05, L + 0.78, z + 2.15, 0.12, L + 0.36, z - 0.2, dur, 'power2.inOut');
  }
  /* 기계실: 로프브레이크 옆·뒤 사선(브레이크 로컬 +X·−Z, 로프 높이 약간 위). 정면만 보면 브레이크 뒷면이
     너무 강조된다(사용자 지적). 이 시점은 현수도르래·로프 흐름과 함께, 파지 순간 황동 윗턱 판이
     덮개 아래로 내려와 로프를 누르는 모습이 옆에서 보인다. */
  const MR_VIEW = { cam: [0.54, 0.14, -0.7], target: [0.01, -0.01, 0] };
  function mrCam(dur) {
    const body = scene.getObjectByName('RopeBrake');
    body.updateMatrixWorld(true);
    const c = body.localToWorld(new THREE.Vector3(...MR_VIEW.cam)), t = body.localToWorld(new THREE.Vector3(...MR_VIEW.target));
    _camTo(c.x, c.y, c.z, t.x, t.y, t.z, dur, 'power2.inOut');
  }
  function shake() {
    const p = camera.position.clone();
    gsap.timeline()
      .to(camera.position, { x: p.x + .018, y: p.y - .014, duration: .035 })
      .to(camera.position, { x: p.x - .014, y: p.y + .01, duration: .045 })
      .to(camera.position, { x: p.x + .008, y: p.y - .006, duration: .05 })
      .to(camera.position, { x: p.x, y: p.y, duration: .08 });
  }

  /* ── 카 운동 (시간 배율 U.ts 로 느린 동작) ─────────────────── */
  function motionTick(time, deltaMs) {
    if (U.stopped) return;
    const dt = Math.min((deltaMs || 16.7) / 1000, .05) * U.ts;
    if (!dt) return;
    U.t0 += dt;
    if (!U.startled && U.rise >= MOTION.startle) startle();
    if (!U.falling && U.rise >= MOTION.trip) trip();
    if (U.mode === 'normal' && U.gripAt < 0 && U.rise >= MOTION.trigger) U.gripAt = U.t0 + MOTION.response;
    if (U.gripAt >= 0 && U.t0 >= U.gripAt) {
      if (!U.bang) { U.bang = true; ropeBrakeBang(); }
      U.v = Math.max(0, U.v - MOTION.decel * dt);
    } else {
      U.v = Math.min(MOTION.vMax, U.v + MOTION.accel * dt);
    }
    let r = U.rise + U.v * dt;
    if (U.mode !== 'normal' && r >= MOTION.failEnd) { r = MOTION.failEnd; U.v = 0; }
    U.rise = r; setRise(r);
    if (U.falling) fallTick(dt);
    if (U.mode !== 'normal' && U.returned && !U.fatalShown && U.rise >= MOTION.fatalAt) { U.fatalShown = true; fatal(); }
    MACH.setDrive(Math.min(U.v / MOTION.vMax, 1) * .6);
    if (U.v === 0 && (U.bang || r >= MOTION.failEnd)) { U.stopped = true; onCarStopped(); }
  }
  // 파지 순간 턱을 주황으로 번쩍 — 턱 재질만 한 번 복제해 다른 부품은 빛나지 않는다.
  function flashJaws() {
    const j = jaws(); if (!j) return;
    if (!j.mats) {
      j.mats = [];
      [j.up, j.lo].forEach(n => n.traverse(o => { if (o.isMesh && o.material.emissive) { o.material = o.material.clone(); j.mats.push(o.material); } }));
    }
    const f = { k: 1 };
    gsap.to(f, { k: 0, duration: .9, ease: 'power2.out', onUpdate: () => j.mats.forEach(m => m.emissive.setRGB(f.k, .42 * f.k, .08 * f.k)) });
  }
  function ropeBrakeBang() {
    const j = jaws();
    U.bangView = U.view;   // 검증용: 파지는 기계실 화면에서 일어나야 한다
    if (j) {
      gsap.to(j.up.position, { y: j.up0 + RB.upperTravel, duration: .12, ease: 'power4.in' });
      gsap.to(j.lo.position, { y: j.lo0 + RB.lowerTravel, duration: .12, ease: 'power4.in' });
    }
    gsap.delayedCall(.1, () => { MACH.ropeBrakeBang?.(); shake(); flashJaws(); });
    caption('쾅! 로프브레이크가 로프를 물었습니다 — 카가 멈춥니다', '#ffd9a8');
    updateStatus('v-dir', '로프브레이크 작동 (UCMP)', '#f85149');
  }
  function onCarStopped() {
    MACH.motorOff(); updateStatus('v-spd', '0 m/min', '#f0883e');
    estop = true; moving = false; currentState = ELEVATOR_STATE.ESTOP;
    if (U.mode === 'normal') {
      U.stage = 'gripped';
      updateStatus('v-dir', '⚠ 로프브레이크 동작 · 에러 정지', '#f85149');
      caption('로프가 멈췄습니다 — 카 정지 (에러). 승강장 모습을 확인합니다', '#ffd9a8');
    }
  }

  /* ── 시연 흐름 ─────────────────────────────────────────── */
  function start(button) {
    btn = button;
    if (U.active) return;
    const why = !PitLadder.secured ? '피트 사다리 펼침 — 운행 차단'
      : insMode ? '점검운전 중 — AUT 로 전환 후 시연'
      : DoorBypass.mode !== 'off' ? 'BYPASS 해제 후 시연'
      : (overspeedActive || estop) ? '다른 고장 복귀(RST) 후 시연'
      : moving ? '운행 정지 후 시연'
      : curFloor >= FLOORS - 1 ? '최상층에서는 시연 불가 (상승 공간 부족)'
      : (CarDoor.state?.busy) ? '도어 동작이 끝난 뒤 시연' : '';
    if (why) { updateStatus('v-dir', why, '#f0883e'); return; }
    const mode = document.getElementById('ucm-brake')?.value || 'normal';
    const inst = brakeInstall();
    if (mode !== 'none' && !(inst?.userData.ready && jaws())) { updateStatus('v-dir', '로프브레이크 모델 로딩 중', '#f0883e'); return; }
    Object.assign(U, { active: true, stage: 'boarding', mode, f: curFloor, rise: 0, v: 0, t0: 0, ts: 0, gripAt: -1,
      bang: false, stopped: false, startled: false, falling: false, landed: false, theta: 0, fallW: 0, returned: false, fatalShown: false,
      view: 'landing', bangView: '', riseAtSwitch: 0, calls: [], baseY: carGrp.position.y });
    btn.disabled = true;
    if (inst) inst.visible = mode !== 'none';
    const go = () => { clearTimeout(autoTimer); run(); };
    if (doorOpen && currentState === ELEVATOR_STATE.DOOR_OPEN) go();
    else if (!doorOpen) { openDoors(go); if (!doorOpen) { U.active = false; btn.disabled = false; updateStatus('v-dir', '도어를 열 수 없습니다', '#f0883e'); } }
    else { U.active = false; btn.disabled = false; updateStatus('v-dir', '도어 동작이 끝난 뒤 시연', '#f0883e'); }
  }

  function run() {
    moving = true; currentState = ELEVATOR_STATE.MOVING;   // 다른 운행·도어 명령 차단
    document.body.classList.add('ucm-active');            // 시연 중 떠 있는 사다리 버튼 숨김
    _saveCam();
    const L = FLOOR_Y[U.f], zWall = FRONT_WALL_INNER_Z;
    // 승장 문턱 위 (발 중심). 신발 앞코 = 발 중심 −0.12m → 한 걸음(−0.08m) 내딛으면 에이프런(CAR_FRONT_Z)에 닿는다.
    const standZ = CAR_FRONT_Z + .21;
    neutral();
    U.leanTable ||= buildLeanTable();                     // 굽힘각 표 — 형상이 같으면 한 번만 만든다
    char.position.set(-.38, L, zWall + 1.6); char.rotation.set(0, Math.PI, 0); char.scale.setScalar(.01);
    char.visible = true;
    const brokenText = { normal: '정상', fail: '미작동', none: '미설치' }[U.mode];
    const tl = U.tl = gsap.timeline();
    tl.call(() => { landingCam(1.2); caption(`로프브레이크 ${brokenText} · 문이 열려 있고 승객이 타려고 합니다`); updateStatus('v-dir', '승객 탑승 중', '#58a6ff'); })
      .to(char.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(2)' }, .2)
      .call(() => { U.walk = 1; }, null, .5)
      .to(char.position, { z: standZ, duration: 1.7, ease: 'none' }, .5)
      .call(() => { U.walk = 0; neutral(); }, null, 2.2)
      // 한 발을 카 문턱 위로 내딛는 순간 개문발차 — 승장 화면에서 카가 눈에 보이게 올라간다(startle 은 상승량으로 발동)
      .to(parts.legs[1].rotation, { x: -.55, duration: .3 }, 2.25)
      .call(() => sillCam(.9), null, 2.1)
      .call(() => {
        U.stage = 'moving';
        caption('⚠ 개문발차! 브레이크 고장으로 문이 열린 채 카가 올라갑니다', '#ffb4a8');
        updateStatus('v-dir', '▲ 개문발차 (UCM)', '#f85149');
        MACH.resume(); MACH.brakeRelease(); MACH.motorOn();
        U.ts = TS.landing; U.view = 'landing'; U.tick = motionTick; gsap.ticker.add(motionTick);
      }, null, 2.6)
      ;
  }
  // 이후 흐름은 사건으로 잇는다: 넘어져 상체가 카 바닥에 닿으면(onLanded) → 잠깐 보여 주고 기계실로.
  function later(sec, fn) { const c = gsap.delayedCall(sec, fn); U.calls.push(c); return c; }
  function onLanded() {
    MACH.bump?.();
    caption('승객이 넘어지며 상체가 올라가는 카 바닥을 덮쳤습니다!', '#ffb4a8');
    U.ts = TS.landed;                                       // 넘어진 순간을 잠깐 보여 준다
    later(.8, toMachineRoom);
  }
  function toMachineRoom() {
    U.ts = TS.transit; U.view = 'machine-room'; U.riseAtSwitch = U.rise; mrCam(1.6);
    caption('기계실 · 느린 동작으로 로프가 움직이는 모습을 봅니다');
    later(1.6, () => {
      U.ts = TS.machineRoom;
      caption(U.mode === 'none' ? '기계실 · 로프브레이크가 설치되어 있지 않습니다 — 로프를 잡을 장치가 없습니다'
        : U.mode === 'fail' ? '기계실 · 로프브레이크가 작동하지 않습니다 — 로프가 계속 움직입니다'
        : '기계실 · 문 열림 상태에서 착상 구역을 벗어나는 순간을 감시합니다');
      if (U.mode === 'normal') waitStop(); else later(1.8, failBack);
    });
  }
  // 정지 후 2.2 s 기계실 관람 → 승장으로 돌아가 결과 확인
  function waitStop() {
    if (!U.stopped) { later(.1, waitStop); return; }
    later(2.2, () => {
      U.ts = 1; U.view = 'landing'; landingCam(1.6);
      caption('승장 · 카가 에이프런이 조금 보이는 높이에서 멈췄습니다');
      later(1.5, recover);
    });
  }
  function failBack() {
    U.ts = TS.failBack; U.view = 'landing'; landingCam(1.4);
    caption('승장 · 카가 멈추지 않고 승객을 태운 채 계속 올라갑니다', '#ffb4a8');
    later(1.4, () => { U.ts = TS.failLanding; U.returned = true; });
  }

  // 문턱 위로 내민 발 밑으로 카 바닥이 올라오기 시작하면 깜짝 놀라 발을 뺀다(시간이 아니라 상승량으로 발동).
  // 몸을 먼저 뒤로 빼고 다리는 늦게 내린다 — 반대로 하면 발끝이 올라오는 카 문턱 아래로 들어간다.
  function startle() {
    U.startled = true;
    const p = parts, s = gsap.timeline();
    s.to(char.position, { z: CAR_FRONT_Z + LEAN.standOff, duration: .24, ease: 'power2.out' }, 0)
      .to(p.legs[1].rotation, { x: 0, duration: .24, ease: 'power3.in' }, 0)
      .to(p.arms[0].rotation, { z: -2.2, duration: .3 }, .05)      // "어?" 양팔 번쩍
      .to(p.arms[1].rotation, { z: 2.2, duration: .3 }, .05)
      .to(p.head.rotation, { x: -.25, duration: .3 }, .05)
      .to(p.mouth.scale, { x: .7, y: 1.6, duration: .25 }, .05);
  }

  // 카 문턱이 정강이 높이로 올라오면 걸려 앞으로 넘어진다 — 팔을 앞으로 뻗고 고개를 바로 한다.
  function trip() {
    U.falling = true; U.fallW = 0; U.theta = parts.body.rotation.x;
    gsap.killTweensOf(parts.arms[0].rotation); gsap.killTweensOf(parts.arms[1].rotation); gsap.killTweensOf(parts.head.rotation);
    const reach = leanPose(0).arms;
    reach.forEach((a, i) => gsap.to(parts.arms[i].rotation, { x: a.x, z: a.z, duration: .22 }));
    gsap.to(parts.head.rotation, { x: 0, duration: .18 });
    caption('카 문턱에 걸려 앞으로 넘어집니다', '#ffb4a8');
  }
  // 정상: 카가 멈춘 뒤 몸을 일으켜(상체를 카 바닥에서 떼고) 승장에 주저앉는다 — 경상.
  function recover() {
    const floorTop = carGrp.position.y - S.CAR_H / 2, p = parts;
    const s = gsap.timeline();
    s.call(() => { U.stage = 'stumble'; }, null, 0)
      .to(U, { theta: 0, duration: .6, ease: 'power2.inOut', onUpdate: () => applyLean(U.theta) }, 0)     // 상체를 일으킨다
      .to(p.arms[0].rotation, { x: 0, z: -.3, duration: .5 }, .1)
      .to(p.arms[1].rotation, { x: 0, z: .3, duration: .5 }, .1)
      .to(char.position, { y: FLOOR_Y[U.f], duration: .3 }, 0)
      .call(() => {
        const sitZ = clearZ(POSE.sit, floorTop, .03), t = gsap.timeline({ onComplete: finishNormal });
        t.to(char.position, { z: Math.max(sitZ, char.position.z), duration: .38, ease: 'power1.out' }, 0);   // 뒤로 물러나며
        toPose(t, POSE.sit, 0, .38, 'power1.in');                                                            // 주저앉음
        t.call(() => MACH.bump?.(), null, .36)
          .to(p.body.rotation, { x: POSE.sit.bodyX - .1, duration: .12 }, .38)
          .to(p.body.rotation, { x: POSE.sit.bodyX, duration: .2, ease: 'back.out(2)' }, .5)
          .call(() => { stars.visible = true; p.mouth.scale.set(1, 1, 1); p.mouth.rotation.z = 0; }, null, .45);
      }, null, .65);
  }
  function finishNormal() {
    U.stage = 'done';
    const mm = Math.round(U.rise * 1000), ratio = Math.round(U.rise / 0.75 * 100);
    caption(`✔ 로프브레이크 정상 작동 — 카 +${mm}mm 정지 (에이프런 약 ${ratio}% 노출, 2/3 이전). 승객은 넘어졌지만 카가 멈춰 경상입니다. RST로 복귀`, '#b8f5c4');
    if (btn) { btn.disabled = false; btn.textContent = 'RST'; }
    controls.enabled = true;
  }
  function fatal() {
    U.stage = 'done'; U.falling = false;
    overlay(true, `<div style="max-width:min(560px,86vw);padding:26px 30px;border-radius:16px;background:#1d0606ee;border:2px solid #ff5a4f;color:#ffe9e6;font:16px/1.65 sans-serif;text-align:center;box-shadow:0 10px 40px #000a">
      <div style="font-size:44px;line-height:1">⚠</div>
      <div style="font-size:30px;font-weight:800;color:#ff6a5e;margin:6px 0 10px">사망사고</div>
      <div>로프브레이크가 ${U.mode === 'none' ? '<b>설치되어 있지 않아</b>' : '<b>작동하지 않아</b>'} 문이 열린 채 카가 계속 올라갔습니다.<br>
      타려던 승객이 카 문턱과 승강장 사이에 <b>끼이거나 승강로로 추락</b>하는 사고로 이어집니다.</div>
      <div style="margin-top:12px;font-size:14px;color:#ffc9c2">개문출발 방지장치(로프브레이크)는 문이 열린 채 카가 움직이면<br>에이프런이 2/3 드러나기 전에 카를 세워 이런 사고를 막습니다.</div>
      <div style="margin-top:14px;font-size:13px;color:#e8b3ad">실제 사고 사례를 교육용으로 단순화한 장면입니다 · RST로 복귀</div></div>`);
    caption('사망사고 — 로프브레이크 ' + (U.mode === 'none' ? '미설치' : '미작동'), '#ffb4a8');
    char.visible = false;       // 사고 순간은 화면에 보이지 않는다
    if (btn) { btn.disabled = false; btn.textContent = 'RST'; }
  }

  function reset(button) {
    btn = button || btn;
    if (!U.active || U.stage === 'resetting') return;
    U.stage = 'resetting'; if (btn) btn.disabled = true;
    U.tl?.kill(); U.calls.forEach(c => c.kill()); U.calls = [];
    gsap.killTweensOf(parts.body.rotation); gsap.killTweensOf(char.position); gsap.killTweensOf(U, 'theta');
    U.falling = false; char.position.y = FLOOR_Y[U.f];
    if (U.tick) { gsap.ticker.remove(U.tick); U.tick = null; }
    U.stopped = true; U.walk = 0; U.ts = 0;
    overlay(false); char.visible = false; neutral();
    caption('복귀 · 로프브레이크 수동 해제 → 카 착상 → 도어 닫힘 → 운행 가능');
    updateStatus('v-dir', '개문발차 복귀 중…', '#f0883e');
    const j = jaws();
    if (j) { gsap.to(j.up.position, { y: j.up0, duration: .5 }); gsap.to(j.lo.position, { y: j.lo0, duration: .5 }); }
    const inst = brakeInstall(); if (inst) inst.visible = true;
    _restoreCam(1.2);
    MACH.resume(); MACH.motorOn(); MACH.setDrive(.25);
    const from = U.rise, dur = Math.max(from / .25, .8);
    gsap.to(U, { rise: 0, duration: dur, delay: .5, ease: 'power1.inOut',
      onUpdate: () => { U.v = .25; setRise(U.rise); },
      onComplete: () => {
        U.v = 0; setRise(0); MACH.motorOff(); MACH.brakeSet();
        updateStatus('v-spd', '0 m/min', '#f0883e');
        estop = false;
        closeDoors(() => {
          moving = false; currentState = ELEVATOR_STATE.IDLE; U.active = false; U.stage = 'rest';
          document.body.classList.remove('ucm-active');
          updateStatus('v-dir', '정지 대기', '#8b949e');
          const el = document.getElementById('ucm-stage'); if (el) el.hidden = true;
          if (btn) { btn.disabled = false; btn.textContent = 'UCM'; }
        });
      } });
  }
  function toggle(button) { if (U.active) reset(button); else start(button); }

  return { build, update, start, reset, toggle, get state() { return U; }, get character() { return char; }, motion: MOTION, jawTravel: RB, lean: LEAN, leanFor };
})();
