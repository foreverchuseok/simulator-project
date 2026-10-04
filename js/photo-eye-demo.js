/* ─────────────────────────────────────────────────────────────
   카문 문닫힘 안전장치(멀티빔) 반전 시연 — 승곰이 편 (사용자 2026-10-04)
   ▪ 기준: 이 장치(멀티빔 등)는 카문 문턱 위로 최소 25 ㎜와 1,600 ㎜ 사이의 전 구간에 걸쳐 감지할 수 있어야 한다.
   ▪ 닫히는 문 사이로 승곰이가 ①발(감지 구간 하단, 최하단 빔) ②"잠깐만요!" 손(문턱 위 약 1m 빔)을 넣는다.
     2026-10-05 사용자: 팔이 징그럽게 길다 → 관절 ARM 0.16(짧고 귀엽게). 그 팔로는 손이 약 1m 빔까지다.
     두 번 모두 문이 닿기 전에 반전하고, 마지막에 승곰이가 다 들어간 뒤 아무것도 가리지 않을 때만 끝까지 닫힌다.
   ▪ 판정은 연출 타이밍이 아니다. 매 프레임 송광부(multiBeamTx)→수광부(multiBeamRx) 사이 빔 21줄(렌즈 피치 0.1m)을
     실제 광선으로 쏘아 승곰이 메시에 맞으면 '차단'이다. 닫힘 중 차단되면 ARD 시연과 같은 방식으로 폐문을 끊고 다시 연다.
   ▪ 적외선 빔은 원래 보이지 않는다. 화면의 푸른 줄은 교육용 표시다. 센서는 평소 운행 FSM 의 안전 입력이 아니며(visualOnly),
     이 시연 동안만 반전 판정에 쓴다.
   ▪ 진입: 문이 열려 있으면 센서 자체가 빛나고(바로 실행), 닫혀 있으면 카 안 「카문」 메뉴에 항목이 생긴다(문을 먼저 연다).
   ▪ 승곰이는 옥상 원본을 건드리지 않는 복제본(Mascot.createWorker)이며 2배(안전모 꼭대기 약 1.65m)로 키운다.
     안전모(챙 반지름 0.43m)가 빔을 먼저 끊지 않게 빔 평면에서 0.5m 떨어져 서서 손만 내민다.
   ───────────────────────────────────────────────────────────── */
const PhotoEyeDemo = (() => {
  const SCALE = 2, ARM = .16, PITCH = CAR_DOOR_PHOTO.lensPitch, OPEN_MIN = .3;
  const state = { active: false, stage: 'idle', kind: '', reversals: [], broken: [], closedClean: false, completed: false };
  // 승곰이 자세(빔 평면 기준 z, +는 승장 쪽). gsap 이 이 값만 바꾸고 update() 가 메시에 반영한다.
  // 손 목표 높이(바닥 위). 앞발 중심이 여기 오면 빔 10·11번(약 956·1,056 ㎜)을 끊는다.
  // 빔 평면에서 0.5m — 더 가까우면 안전모가 빔 14번(1,356 ㎜)을 먼저 끊는다.
  const HAND_Y = 1.05, STAND = { foot: .55, hand: .5 };
  const a = { x: .05, z: 1.6, foot: 0, hand: 0, push: 0, wave: 0, lean: 0, look: 0, step: 0, walking: 0, yaw: Math.PI, beams: 0 };
  const v = new THREE.Vector3(), w = new THREE.Vector3(), dirX = new THREE.Vector3(1, 0, 0), ray = new THREE.Raycaster();
  const restA = new THREE.Vector3(), restB = new THREE.Vector3(), raiseB = new THREE.Vector3(), waveB = new THREE.Vector3(), handB = new THREE.Vector3();
  let worker = null, arms = null, bearMeshes = [], tx = null, rx = null, beams = null, glow = null, beamCount = 0;
  let panel, title, caption, chapter, progress, bubble, callout, sensorButton, menuButton;
  let saved = null, jobs = [], epoch = 0, internal = false, pending = {}, flash = [], audio = null;
  const lines = {
    intro: ['카문 문닫힘 안전장치 (멀티빔)', '이 장치(멀티빔 등)는 카문 문턱 위로 최소 25 ㎜와 1,600 ㎜ 사이의 전 구간에 걸쳐 감지할 수 있어야 한다. 양쪽 문 끝의 송광부·수광부가 100 ㎜ 간격 빔 21줄로 출입구를 감시합니다.'],
    foot: ['발 — 감지 구간 하단', '닫히는 문 사이로 발을 내밀면 문턱 바로 위 최하단 빔이 차단됩니다.'],
    footHit: ['하단 빔 차단 → 문 반전', '문짝이 발에 닿기 전에 감지하여 닫힘을 멈추고 다시 엽니다.'],
    hand: ['손 — 위쪽 빔', '손을 넣으면 문턱 위 약 1 m 높이의 빔이 차단됩니다. 어느 높이든 한 줄만 끊겨도 됩니다.'],
    handHit: ['위쪽 빔 차단 → 문 반전', '빔이 한 줄만 차단되어도 닫힘을 멈추고 다시 엽니다.'],
    enter: ['탑승', '승곰이가 출입구를 지나는 동안 빔이 차단되어 있어 문은 열린 상태로 대기합니다.'],
    close: ['감지 구간이 비면 닫힘', '빔 21줄이 모두 다시 수광되어야 문이 끝까지 닫힙니다.'],
    done: ['따라 하지 마세요!', '문닫힘 안전장치가 있어도 닫히는 문에 손·발을 넣으면 위험합니다. 렌즈가 오염되거나 고장 나면 감지하지 못할 수 있습니다. 문을 잡을 때는 열림 버튼을 누르세요.']
  };
  const bubbles = { foot: '얍!', hand: '어, 잠깐만요!', done: '휴, 안전하게 탔다!' };

  const own = t => { jobs.push(t); return t; };
  const alive = id => state.active && id === epoch;
  const wait = (t, id) => new Promise((ok, no) => own(gsap.delayedCall(t, () => alive(id) ? ok() : no('cancel'))));
  const tween = (vars, id) => new Promise((ok, no) => own(gsap.to(a, { ...vars, onComplete: () => alive(id) ? ok() : no('cancel') })));
  function call(fn) { internal = true; try { return fn(); } finally { internal = false; } }
  const openFraction = () => { const q = CarDoor.state; return q?.ready ? (carDoorR.position.x - q.d.cx) / q.d.stroke : 0; };
  const floorY = () => FLOOR_Y[curFloor];
  const beamZ = () => { tx.getWorldPosition(v); return v.z; };

  function reason() {
    if (state.active) return '문닫힘 안전장치 시연이 진행 중입니다.';
    if (!CarDoor.state?.ready || !tx?.userData.ready || !rx?.userData.ready) return '카문 멀티빔 센서를 불러오는 중입니다.';
    if (insMode || DoorBypass.mode !== 'off') return '점검·바이패스를 해제한 자동 모드에서 실행하세요.';
    if (estop || overspeedActive || governorPhase === 'tripped') return '비상정지·고장을 먼저 복귀하세요.';
    if (moving || CarDoor.alignedFloor() !== curFloor) return '카가 층에 정지한 뒤 실행하세요.';
    if (ARDDemo.active || ManualRescueDemo.active || BufferDemo.active || RetentionDemo.active || InterlockDemo.active || UCMDemo.state.active ||
      AscentDemo.active || BrakeDemo.active || RelayRopeDemo.active || InspectionReturn.busy || HallManual.busy || hatchDoors.some(h => h.manualActive) || Mascot.inspecting) return '다른 시연·점검을 마친 뒤 실행하세요.';
    return '';
  }

  /* ── 빔 표시: 줄마다 상자 하나(인스턴스). 끊긴 줄은 밝은 민트색으로 표시한다. ── */
  function buildBeams() {
    beamCount = Math.floor(tx.userData.height / PITCH + 1e-6) + 1;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .48, depthWrite: false, toneMapped: false });
    const halo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .08, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    beams = new THREE.InstancedMesh(geo, core, beamCount); glow = new THREE.InstancedMesh(geo, halo, beamCount);
    for (const m of [beams, glow]) {
      m.name = m === beams ? 'PhotoEyeBeams' : 'PhotoEyeBeamGlow'; m.frustumCulled = false; m.visible = false; m.renderOrder = 6;
      m.raycast = () => {}; m.userData.noGlow = true;
      for (let i = 0; i < beamCount; i++) m.setColorAt(i, new THREE.Color(0x74c9ee));
      scene.add(m);
    }
    flash = new Array(beamCount).fill(0);
  }
  const BLUE = new THREE.Color(0x74c9ee), HOT = new THREE.Color(0xb6f5e5), _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  // 빔 i 의 월드 양 끝(송광부 광학창 → 수광부 광학창). 문짝을 따라 매 프레임 길이가 바뀐다.
  function beamEnds(i, from, to) {
    tx.getWorldPosition(from); rx.getWorldPosition(to);
    const y = from.y + (i - (beamCount - 1) / 2) * PITCH, half = CAR_DOOR_PHOTO.width / 2;
    from.set(from.x + half, y, from.z); to.set(to.x - half, y, from.z);
  }
  // 실제 광선 판정: 줄마다 Tx→Rx 로 쏘아 승곰이 메시에 맞으면 차단.
  function sense() {
    const broken = [];
    if (!worker?.root.visible) return broken;
    worker.root.updateMatrixWorld(true);
    for (let i = 0; i < beamCount; i++) {
      beamEnds(i, v, w);
      const len = w.x - v.x; if (len <= .002) continue;
      ray.set(v, dirX); ray.far = len;
      if (ray.intersectObjects(bearMeshes, false).length) broken.push(i);
    }
    return broken;
  }
  function drawBeams(dt) {
    const show = a.beams > .01; beams.visible = glow.visible = show; if (!show) return;
    for (let i = 0; i < beamCount; i++) {
      beamEnds(i, v, w);
      const len = Math.max(.001, w.x - v.x), cut = state.broken.includes(i);
      if (cut) flash[i] = 1; else flash[i] = Math.max(0, flash[i] - dt * 2.2);
      _c.copy(BLUE).lerp(HOT, flash[i]);
      _s.set(len, .0025, .0025); _m.compose(v.lerp(w, .5), _q, _s); beams.setMatrixAt(i, _m); beams.setColorAt(i, _c);
      _s.set(len, .009 + .004 * flash[i], .009 + .004 * flash[i]); _m.compose(v, _q, _s); glow.setMatrixAt(i, _m); glow.setColorAt(i, _c);
    }
    for (const m of [beams, glow]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    beams.material.opacity = .48 * a.beams; glow.material.opacity = .08 * a.beams;
  }

  /* ── 승곰이 ── */
  function makeBear() {
    worker = Mascot.createWorker('PhotoEyeSeunggom'); arms = Mascot.rescueRig(worker, ARM);
    bearMeshes = []; worker.root.traverse(o => { if (o.isMesh && o.geometry.type !== 'CircleGeometry') bearMeshes.push(o); });
  }
  function poseBear() {
    const r = worker.rig, fy = floorY(), z = beamZ() + a.z;
    worker.inspectionPose(a.x, fy, z, a.foot, null, null, a.yaw);
    worker.root.scale.setScalar(SCALE);
    r.body.rotation.x = a.lean; r.head.rotation.x = -a.look;
    r.legs[0].position.z = a.foot / 2; r.legs[0].scale.z = .075 + a.foot / 2;
    r.feet.forEach((f, i) => { f.position.y = Math.max(0, Math.sin(a.step + i * Math.PI)) * .035 * a.walking; });
    r.waveArm.rotation.set(0, 0, 0); r.holdArm.rotation.set(0, 0, 0);
    worker.root.updateMatrixWorld(true);
    // 쉬는 팔 끝(rescueRig 의 기본 자세와 같은 점) ↔ 들어 올린 손 목표를 섞는다.
    r.body.localToWorld(restA.copy(r.holdArm.position).add(v.set(.025, -.30, .075)));
    r.body.localToWorld(restB.copy(r.waveArm.position).add(v.set(-.025, -.30, .075)));
    // 먼저 승장 쪽(빔 평면 앞 0.2m)에서 손을 높이 든 뒤(push 0) 수평으로 밀어 넣는다(push 1) — 올리는 도중 낮은 빔을 스치지 않게.
    raiseB.set(.12, fy + HAND_Y, beamZ() + .2 - .22 * a.push);
    r.body.localToWorld(waveB.copy(r.waveArm.position).add(v.set(-.16 - .05 * Math.sin(a.step * 3), .26, .12)));
    handB.copy(restB).lerp(raiseB, a.hand).lerp(waveB, a.wave);
    arms.pose(restA, handB);
  }

  /* ── 화면 문구 ── */
  function stage(key, number) {
    state.stage = key; if (number) chapter.textContent = `${number} / 4 · 카문 문닫힘 안전장치`;
    [title.textContent, caption.textContent] = lines[key];
    panel.dataset.hit = String(/Hit$/.test(key)); panel.dataset.warn = String(key === 'done'); panel.hidden = false;
    updateStatus('v-dir', '문닫힘 안전장치 시연 · ' + lines[key][0], key === 'done' ? '#3fb950' : '#55b8d8');
  }
  function say(text, t = 1.3) {
    bubble.textContent = text; bubble.hidden = false;
    own(gsap.fromTo(bubble, { '--s': .5, opacity: 0 }, { '--s': 1, opacity: 1, duration: .18, ease: 'back.out(3)' }));
    own(gsap.to(bubble, { opacity: 0, duration: .25, delay: t, onComplete: () => { bubble.hidden = true; } }));
  }
  function place(el, point, dy) {
    point.project(camera);
    if (point.z > 1) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    el.style.left = `${Math.max(70, Math.min(innerWidth - 70, (point.x + 1) * innerWidth / 2))}px`;
    el.style.top = `${Math.max(70, Math.min(innerHeight - 160, (1 - point.y) * innerHeight / 2 - dy))}px`;
  }
  // 끊긴 빔 높이에서 화면상 출입구 바깥쪽(문짝 위)에 붙인다. 카 안에서 보면 월드 +X(수광부)가 화면 왼쪽이다.
  function placeCallout() {
    const dy = (Number(callout.dataset.y) - (beamCount - 1) / 2) * PITCH, ends = [tx, rx].map(o => { o.getWorldPosition(v); v.y += dy; return v.clone().project(camera); });
    const [l, r] = ends[0].x < ends[1].x ? ends : [ends[1], ends[0]], px = q => (q.x + 1) * innerWidth / 2, w = callout.offsetWidth || 100;
    const left = px(l) - w - 14 > 6 ? px(l) - w - 14 : Math.min(innerWidth - w - 6, px(r) + 14);
    const top = (1 - l.y) * innerHeight / 2 - callout.offsetHeight / 2, limit = (panel.hidden ? innerHeight : panel.getBoundingClientRect().top) - callout.offsetHeight - 12;
    callout.style.left = `${left}px`; callout.style.top = `${Math.max(70, Math.min(limit, top))}px`;
  }
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      [0, .11].forEach(t => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'square'; o.frequency.value = 1760;
        g.gain.setValueAtTime(.0001, now + t); g.gain.linearRampToValueAtTime(.06, now + t + .005); g.gain.exponentialRampToValueAtTime(.0001, now + t + .08);
        o.connect(g); g.connect(audio.destination); o.start(now + t); o.stop(now + t + .09);
      });
    } catch (e) { /* 소리 없이 진행 */ }
  }

  /* ── 문 ── */
  function ensureOpen(id) {
    return new Promise((ok, no) => {
      const tryOpen = () => {
        if (!alive(id)) { no('cancel'); return; }
        if (CarDoor.state.busy && CarDoor.state.operation === 'open') { own(gsap.delayedCall(.1, tryOpen)); return; }
        if (doorOpen && currentState === ELEVATOR_STATE.DOOR_OPEN && !CarDoor.state.busy) { clearTimeout(autoTimer); ok(); return; }
        call(() => openDoors(() => { clearTimeout(autoTimer); alive(id) ? ok() : no('cancel'); }));
      };
      tryOpen();
    });
  }
  // 닫기 시작 → 멀티빔이 감지해 반전하면 resolve('reversed'), 끝까지 닫히면 resolve('closed').
  function closeAndWatch(id) {
    return new Promise((ok, no) => {
      pending = { id, done: r => alive(id) ? ok(r) : no('cancel') };
      call(() => closeDoors(() => { const p = pending; pending = {}; p.done?.('closed'); }));
    });
  }
  function reverse(broken) {
    const q = CarDoor.state, id = pending.id, done = pending.done; pending = {};
    // ARD 시연과 같은 방식: 남은 폐문 타임라인과 완료 콜백을 끊고 그 자리에서 연다.
    const gap = openFraction();
    q.timeline.kill(); q.closeCallbacks = []; q.busy = false; doorOpen = false; currentState = ELEVATOR_STATE.IDLE;
    state.reversals.push({ kind: state.kind, beams: broken.map(i => i + 1), openFraction: +gap.toFixed(3) });
    beep(); updateStatus('v-door', '멀티빔 감지 · 문 반전', '#55b8d8');
    showCallout(broken);
    call(() => openDoors(() => { clearTimeout(autoTimer); if (alive(id)) pending.reopened?.(); }));
    done?.('reversed');
  }
  function showCallout(broken) {
    const lo = Math.min(...broken), hi = Math.max(...broken);
    // 문턱(카 바닥) 위 높이 ㎜ — 빔 i 는 센서 중심에서 (i − 가운데)×피치.
    tx.getWorldPosition(v); const mm = i => Math.round((v.y + (i - (beamCount - 1) / 2) * PITCH - floorY()) * 1000).toLocaleString('ko-KR');
    callout.querySelector('b').textContent = lo === hi ? `빔 ${lo + 1}번 차단` : `빔 ${lo + 1}~${hi + 1}번 차단`;
    callout.querySelector('span').textContent = `문턱 위 ${lo === hi ? mm(lo) : mm(lo) + '~' + mm(hi)} ㎜`;
    callout.dataset.y = String((lo + hi) / 2); callout.hidden = false;
    own(gsap.fromTo(callout, { opacity: 1, '--s': 1.35 }, { '--s': 1, duration: .25, ease: 'back.out(2)' }));
    own(gsap.to(callout, { opacity: 0, delay: 1.7, duration: .3, onComplete: () => { callout.hidden = true; } }));
  }
  const reopened = id => new Promise((ok, no) => {
    if (!CarDoor.state.busy && doorOpen && currentState === ELEVATOR_STATE.DOOR_OPEN) { ok(); return; }
    pending.reopened = () => alive(id) ? ok() : no('cancel');
  });

  /* ── 카메라: 카 안 대각선에서 출입구·승곰이·빔을 한 화면에 ── */
  function aim() {
    const fy = floorY(), z = beamZ(), portrait = camera.aspect < .9;
    camera.fov = portrait ? 82 : 60; camera.updateProjectionMatrix();
    if (portrait) { camera.position.set(-.32, fy + 1.32, z - 2.25); controls.target.set(.04, fy + .78, z + .25); }
    // 카 뒤쪽 대각선: 바닥(발)부터 문 위까지, 아래 안내 패널 위로 한 화면에 든다.
    else { camera.position.set(-.5, fy + 1.2, z - 2.3); controls.target.set(.04, fy + .66, z + .3); }
    controls.update();
  }

  /* ── 시연 순서 ── */
  async function story(id) {
    try {
      Object.assign(a, { x: .05, z: 1.65, foot: 0, hand: 0, push: 0, wave: 0, lean: 0, look: 0, step: 0, walking: 0, yaw: Math.PI, beams: 0 });
      worker.root.visible = true; worker.beginInspection(); aim();
      stage('intro', 1);
      await ensureOpen(id);
      await tween({ beams: 1, duration: .6 }, id);
      await wait(1.6, id);
      // ① 발 → 감지 구간 하단(최하단 빔)
      state.kind = 'foot'; stage('foot', 2);
      await tween({ z: STAND.foot, step: '+=' + Math.PI * 6, walking: 1, duration: 1.1, ease: 'power1.out' }, id); a.walking = 0;
      await wait(.35, id);
      let closing = closeAndWatch(id);
      own(gsap.delayedCall(.42, () => { if (alive(id)) say(bubbles.foot, .9); }));
      own(gsap.to(a, { foot: .26, lean: .05, duration: .16, delay: .4, ease: 'power2.out' }));
      if (await closing !== 'reversed') throw new Error('foot not detected');
      stage('footHit'); await reopened(id);
      await tween({ foot: 0, lean: 0, duration: .25 }, id); await wait(1.1, id);
      // ② 손 → 위쪽 빔(문턱 위 약 1m)
      state.kind = 'hand'; stage('hand', 3);
      // 안전모 챙이 먼저 빔에 닿지 않게 한 걸음 뒤에 서서 손만 내민다.
      await tween({ z: STAND.hand, step: '+=' + Math.PI * 2, walking: 1, duration: .45 }, id); a.walking = 0;
      await tween({ hand: 1, duration: .35, ease: 'power2.out' }, id);
      await wait(.15, id);
      closing = closeAndWatch(id);
      own(gsap.delayedCall(.3, () => { if (alive(id)) say(bubbles.hand, 1.1); }));
      own(gsap.to(a, { push: 1, duration: .2, delay: .38, ease: 'back.out(2)' }));
      if (await closing !== 'reversed') throw new Error('hand not detected');
      stage('handHit'); await reopened(id);
      await tween({ push: 0, duration: .2 }, id); await tween({ hand: 0, look: 0, duration: .3 }, id); await wait(1.0, id);
      // ③ 탑승 → 아무것도 없을 때만 끝까지 닫힘
      state.kind = 'enter'; stage('enter', 4);
      // 카 안에서 보면 월드 −X 가 화면 오른쪽 — 왼쪽 아래 운행 패널에 가리지 않는 쪽에 선다.
      await tween({ z: -.25, x: -.2, step: '+=' + Math.PI * 7, walking: 1, duration: 1.3, ease: 'none' }, id);
      await tween({ z: -.6, x: camera.aspect < .9 ? -.4 : -.7, step: '+=' + Math.PI * 4, duration: .8, ease: 'power1.out' }, id); a.walking = 0;
      state.kind = 'close'; stage('close');
      if (await closeAndWatch(id) !== 'closed') throw new Error('door reversed with no obstacle');
      state.closedClean = true;
      stage('done'); say(bubbles.done, 2.2);
      await tween({ wave: 1, duration: .25 }, id);
      await tween({ step: '+=' + Math.PI * 6, duration: 2.2, ease: 'none' }, id);
      finish(true);
    } catch (e) {
      if (e !== 'cancel') { console.error('[PhotoEyeDemo]', e); state.error = String(e?.message || e); finish(false); }
    }
  }

  function start() {
    const why = reason();
    if (why) { updateStatus('v-dir', why, '#f0883e'); return false; }
    if (!worker) makeBear();
    clearTimeout(autoTimer); closeAllMenus(); leaveCabinView(); PartGlow.closeMenu?.();
    if (CharacterWalk.active) CharacterWalk.exit(false);
    saved = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov, near: camera.near, min: controls.minDistance, enabled: controls.enabled };
    gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    controls.enabled = false; controls.minDistance = .02; camera.near = .01; camera.updateProjectionMatrix();
    epoch++; Object.assign(state, { active: true, stage: 'intro', kind: '', reversals: [], broken: [], closedClean: false, completed: false, error: '' });
    document.body.classList.add('photo-eye-active'); MACH.resume();
    story(epoch);
    return true;
  }
  function stopJobs() { epoch++; jobs.forEach(j => j?.kill?.()); jobs = []; pending = {}; gsap.killTweensOf(a); }
  function finish(completed) {
    if (!state.active) return;
    stopJobs(); state.active = false; state.completed = completed; state.stage = completed ? 'done' : 'idle';
    worker.endInspection(); arms.reset(); worker.root.visible = false; worker.root.scale.setScalar(1);
    a.beams = 0; beams.visible = glow.visible = false; state.broken = [];
    bubble.hidden = callout.hidden = true;
    camera.position.copy(saved.p); controls.target.copy(saved.t); camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix();
    controls.minDistance = saved.min; controls.enabled = saved.enabled; controls.update();
    document.body.classList.remove('photo-eye-active');
    if (!completed) {
      panel.hidden = true;
      // 중단: 승곰이를 치운 뒤 문을 정상적으로 닫는다(문 사이에 남은 것이 없다).
      if (CarDoor.state.busy) CarDoor.state.timeline.kill();
      CarDoor.state.busy = false; currentState = doorOpen ? ELEVATOR_STATE.DOOR_OPEN : ELEVATOR_STATE.IDLE;
      if (!estop && openFraction() > .001) { doorOpen = true; currentState = ELEVATOR_STATE.DOOR_OPEN; closeDoors(); }
      updateStatus('v-dir', '문닫힘 안전장치 시연 종료', '#3fb950');
    } else updateStatus('v-dir', '정상 자동운전 · 정지 대기', '#3fb950');
  }
  // 비상정지·× 버튼: 그 자리에서 끝내고 원래 시점으로 돌아간다.
  function cancel() { finish(false); }

  /* ── 진입 버튼(화면에선 숨긴 행동 핸들러, 부품 발광이 대신 보인다) ── */
  function update() {
    if (!panel) return;
    if (!tx) { tx = carGrp?.getObjectByName('multiBeamTx'); rx = carGrp?.getObjectByName('multiBeamRx'); if (!tx || !rx) return; }
    if (!beams && tx.userData.ready) buildBeams();
    if (!beams) return;
    const now = performance.now() / 1000, dt = Math.min(.1, now - (update.last || now)); update.last = now;
    if (state.active) {
      sensorButton.hidden = menuButton.hidden = true;
      if (estop && !DemoPause.paused) { cancel(); return; }
      poseBear();
      state.broken = sense();
      const q = CarDoor.state;
      if (state.broken.length && q.busy && q.operation === 'close' && pending.done) reverse(state.broken);
      drawBeams(dt);
      if (!bubble.hidden) { worker.rig.head.getWorldPosition(v); v.y += .45; place(bubble, v, 20); }
      if (!callout.hidden) placeCallout();
      progress.style.transform = `scaleX(${['intro', 'foot', 'footHit', 'hand', 'handHit', 'enter', 'close', 'done'].indexOf(state.stage) / 7})`;
      return;
    }
    drawBeams(dt);
    // 문이 열려 있으면 센서 자체가 빛난다(가까이·화면 안). 닫혀 있으면 카 안 「카문」 메뉴 항목으로.
    const fg = FingerGap.entries.find(e => e.kind === 'car'), open = openFraction() > OPEN_MIN;
    tx.getWorldPosition(v); const near = camera.position.distanceToSquared(v) < 25;
    let show = false;
    // 세로 막대라 중심이 화면 밖이어도 위·아래 일부는 보일 수 있다 — 양쪽 센서의 세 점 중 하나라도 화면 안이면 켠다.
    if (PartActions.iconsVisible && open && near && !reason()) for (const s of [tx, rx]) for (const dy of [0, -.7, .7]) {
      if (show) break;
      s.getWorldPosition(v); v.y += dy; v.project(camera);
      show = v.z > -1 && v.z < 1 && Math.abs(v.x) < .96 && Math.abs(v.y) < .94;
    }
    sensorButton.hidden = !show;
    if (show) PartActions.positionButton(sensorButton, (v.x + 1) * innerWidth / 2 - 22, (1 - v.y) * innerHeight / 2 - 22);
    // 손끼임 아이콘 기준점이 좁은 세로 화면 밖으로 나가도 카 안에서 문을 보고 있으면 항목을 둔다(탭은 문틀 띠로 받는다).
    let inCar = false;
    if (fg && !open && PartActions.iconsVisible && !reason()) { fg.parent.localToWorld(w.copy(fg.anchor)); inCar = fg.facing() && camera.position.distanceToSquared(w) < 9; }
    menuButton.hidden = !inCar;
    // 옛 아이콘 모드(?legacyIcons)에서 손끼임 아이콘과 겹쳐 클릭을 가로채지 않게 한 칸 아래에 둔다.
    if (inCar) { w.project(camera); PartActions.positionButton(menuButton, (THREE.MathUtils.clamp(w.x, -.9, .9) + 1) * innerWidth / 2 - 22, (1 - THREE.MathUtils.clamp(w.y, -.9, .9)) * innerHeight / 2 + 34); }
  }

  function build() {
    const style = document.createElement('style'); style.textContent = `
      #photo-eye-panel{position:fixed;z-index:119;left:50%;bottom:20px;transform:translateX(-50%);width:520px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px 18px 10px;border:1px solid #a8dbee;border-radius:16px;background:#f0fafff5;color:#28495d;box-shadow:0 8px 32px #26618125;font:14px/1.55 sans-serif}
      #photo-eye-panel[hidden],.photo-eye-fx[hidden]{display:none}
      #photo-eye-panel strong{display:block;font-size:20px;line-height:1.35;color:#21769a;margin:4px 34px 4px 0;word-break:keep-all}#photo-eye-panel p{margin:0 0 6px;word-break:keep-all}
      #photo-eye-panel small{color:#52788d;font-size:11px}#photo-eye-panel[data-hit=true]{border-color:#a9eadb}#photo-eye-panel[data-hit=true] strong{color:#177e88}
      #photo-eye-panel[data-warn=true]{border-color:#9bcddd}#photo-eye-panel[data-warn=true] strong{color:#246b89}
      #photo-eye-exit{position:absolute;right:4px;top:4px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:#397c9a;font:26px sans-serif;cursor:pointer}
      #photo-eye-panel .pe-track{height:3px;background:#cce8f2;margin-top:8px;overflow:hidden;border-radius:3px}#photo-eye-progress{height:100%;background:#67bedf;transform:scaleX(0);transform-origin:left}
      .photo-eye-fx{position:fixed;z-index:118;left:0;top:0;pointer-events:none;width:max-content;transform:translate(-50%,-50%) scale(var(--s,1))}
      #photo-eye-bubble{padding:8px 14px;border-radius:18px;background:#fff;color:#397c9a;border:3px solid #397c9a;font:900 19px/1.2 sans-serif;box-shadow:0 4px 0 #28688825}
      #photo-eye-bubble::after{content:'';position:absolute;left:50%;bottom:-13px;margin-left:-8px;border:8px solid transparent;border-top-color:#397c9a}
      #photo-eye-callout{transform:scale(var(--s,1));transform-origin:center;padding:6px 11px;border-radius:12px;background:#a9eadb;color:#245b70;border:2px solid #75c9cd;font:700 12px/1.25 sans-serif;box-shadow:0 0 18px #78ccdf40;text-align:center}
      #photo-eye-callout b{display:block;font:900 16px/1.15 sans-serif;color:#197e99}
      body.photo-eye-active .part-action,body.photo-eye-active #hall-panel,body.photo-eye-active #inspection-drive,body.photo-eye-active #part-menu,body.photo-eye-active #part-tip{visibility:hidden!important}
      body.photo-eye-active #fbtns,body.photo-eye-active #btn-open,body.photo-eye-active #btn-close{display:none!important}
      /* 세로 화면: 오른쪽 세로 운행바(STOP 포함)를 비워 둔다. 가로 낮은 화면: 하단 운행바·STOP 위를 피해 오른쪽 위. */
      @media(max-width:600px){#photo-eye-panel{left:12px;right:76px;bottom:12px;transform:none;width:auto;max-width:none;padding:11px 13px 9px;font-size:13px}#photo-eye-panel strong{font-size:17px}#photo-eye-bubble{font-size:16px}}
      @media(max-height:500px) and (min-width:600px){#photo-eye-panel{left:auto;right:12px;top:12px;bottom:auto;transform:none;width:300px;padding:10px 12px;font-size:12px}#photo-eye-panel strong{font-size:16px}}
    `; document.head.appendChild(style);
    panel = document.createElement('section'); panel.id = 'photo-eye-panel'; panel.hidden = true; panel.setAttribute('aria-label', '카문 문닫힘 안전장치(멀티빔) 시연');
    panel.innerHTML = '<small id="photo-eye-chapter"></small><button id="photo-eye-exit" aria-label="시연 종료">×</button><strong></strong><p role="status"></p><small>푸른 줄 = 실제로는 보이지 않는 적외선 빔을 화면에만 표시 · 교육 연출</small><div class="pe-track"><div id="photo-eye-progress"></div></div>';
    document.body.appendChild(panel);
    title = panel.querySelector('strong'); caption = panel.querySelector('p'); chapter = panel.querySelector('#photo-eye-chapter'); progress = panel.querySelector('#photo-eye-progress');
    panel.querySelector('#photo-eye-exit').onclick = () => { if (state.active) cancel(); else panel.hidden = true; };
    const fx = (id, html) => { const e = document.createElement('div'); e.id = id; e.className = 'photo-eye-fx'; e.hidden = true; e.innerHTML = html; e.setAttribute('aria-hidden', 'true'); document.body.appendChild(e); return e; };
    bubble = fx('photo-eye-bubble', ''); callout = fx('photo-eye-callout', '<b></b><span></span>');
    const icon = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><path d="M5 3v18M19 3v18M5 7h14M5 11h14M5 15h14" stroke-dasharray="2 2"/></svg>') + '")';
    const make = (id, label) => {
      const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'part-action'; b.hidden = true;
      b.setAttribute('aria-label', label); b.title = label; b.style.setProperty('--part-icon', icon);
      b.addEventListener('click', start); document.getElementById('part-actions').appendChild(b); return b;
    };
    sensorButton = make('photo-eye-action', '카문 문닫힘 안전장치(멀티빔) 시연');
    menuButton = make('photo-eye-menu-action', '문닫힘 안전장치 시연 (승곰이)');
    PartGlow.bind(sensorButton, () => tx?.userData.ready ? [tx, rx] : null, '카문 멀티빔(문닫힘 안전장치)', () => '승곰이 반전 시연', { direct: true });
    // 닫힌 문: 손끼임 틈새와 같은 대상에 묶어 「카문」 한 메뉴로 합친다.
    PartGlow.bind(menuButton, () => FingerGap.entries.find(e => e.kind === 'car')?.strips, '카문', () => '문닫힘 안전장치 시연 (승곰이)');
    // 시연 중 다른 조작은 막는다. 비상정지·공통 일시정지, 멈춘 동안 화면 둘러보기는 통과.
    for (const type of ['click', 'pointerdown', 'keydown', 'change', 'dblclick']) document.addEventListener(type, e => {
      if (!state.active || panel.contains(e.target) || e.target.closest?.('#btn-estop,#demo-pause') || (DemoPause.paused && e.target.closest?.('canvas'))) return;
      if (type === 'keydown' && e.key === 'Escape') { cancel(); return; }
      if (e.target.closest?.('button,input,select,canvas') || type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('resize', () => requestAnimationFrame(() => { if (state.active) aim(); }));
  }
  return { build, update, start, cancel, get active() { return state.active; }, get blocksCommands() { return state.active && !internal; }, get state() { return state; }, get pose() { return a; }, armLength: ARM };
})();
