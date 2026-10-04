/* ─────────────────────────────────────────────────────────────
   종단 스위치 작동 + 시연 — 강제감속 · 리미트 · 파이널 리미트 (사용자 2026-10-04)
   ▪ 역할(사용자 표)
     - 강제감속: 종단층 1.5m 앞. 정상 감속이 안 되면 정격속도에서 감속을 시작한다.
     - 리미트: 정상 운행 범위 초과 시 1차 정지. 제어(조작) 회로를 끊어 모터를 멈춘다.
       반대 방향 운전은 가능하고 범위 안으로 돌아오면 자동 복귀한다.
     - 파이널 리미트: 리미트가 실패하면 리미트보다 더 위/아래에서 2차 정지. 모터·브레이크 주전원(동력 회로)을
       직접 끊는다. 양방향 모두 운전 불가이며 수동으로만 복귀한다(자동 복귀 불가).
   ▪ 판정은 연출 타이밍이 아니다. 카는 이 모듈의 ticker 적분으로 움직이고, 스위치 개로는 기존
     refreshTerminalDevices() 의 캠-롤러 접점(sw.contactOpen, 동작비율 0.98 초과)을 그대로 읽는다.
   ▪ 점검(INS) 운전도 같은 isOpen()/blockReason() 을 쓴다(ui.js insTick·insStart).
   ▪ 시연의 '고장'은 교육용 가정이다: 정상 감속 지령 미출력 / 착상 고장 / 리미트 접점 융착(sw.welded).
   ───────────────────────────────────────────────────────────── */
const TerminalDemo = (() => {
  const A_RUN = .8, A_FORCED = .4, A_STOP = .6, A_CUT = 1.2, A_POWER = 2.0;   // m/s²
  const V_CREEP = .1, V_RETURN = 15 / 60;   // m/s — 저속 6 m/min, 복귀는 점검 속도 15 m/min(ui.js INSPECT_SPEED)
  const KIND = { slowdown: '강제감속', limit: '리미트', final: '파이널 리미트' };
  const SIDE = { '-1': '하부', '1': '상부' };
  const state = { active: false, kind: '', side: 0, stage: 'idle', latched: false, latchSide: 0, speed: 0, events: [], completed: false, error: '' };
  let drive = null, jobs = [], epoch = 0, saved = null, waitReset = null, ghosts = [];
  let panel, chapter, title, caption, speedEl, lampsEl, circuitEl, resetBtn, endBtn, tags = [], buttons = [];
  const v = new THREE.Vector3(), aimT = new THREE.Vector3(), subject = new THREE.Vector3();

  /* ── 스위치 상태 (INS·자동·시연 공용) ── */
  const sw = (kind, dir) => terminalDevices.switches.find(s => s.kind === kind && s.dir === dir);
  const isOpen = (kind, dir) => !!sw(kind, dir)?.contactOpen;
  const sideName = dir => SIDE[String(dir)] || '';
  const arrow = dir => dir > 0 ? '▲' : '▼';
  // dir 방향으로 운전할 수 없는 이유(없으면 ''). 반대 방향은 리미트가 열려 있어도 허용한다.
  function blockReason(dir) {
    if (state.latched) return `■ ${sideName(state.latchSide)} 파이널 리미트 동작 — 주전원 차단 · 수동 복귀 전 운전 불가`;
    if (isOpen('final', dir)) return `■ ${sideName(dir)} 파이널 리미트 개로 — ${arrow(dir)} 운전 불가`;
    if (isOpen('limit', dir)) return `■ ${sideName(dir)} 리미트 개로 — ${arrow(dir)} 운전 불가 · 반대 방향(${arrow(-dir)})만 운전`;
    return '';
  }
  function latchFinal(dir) { state.latched = true; state.latchSide = dir; }
  // 수동 복귀(주전원 재투입). 점검 전체 리셋도 이 경로를 쓴다.
  function resetFinal() { state.latched = false; state.latchSide = 0; }
  function clearFaults() { terminalDevices.switches.forEach(s => { s.welded = false; }); resetFinal(); refreshTerminalDevices(); }

  /* ── 카 이동 ── */
  function setCar(y) {
    const d = y - carGrp.position.y; carGrp.position.y = y; cwtGrp.position.y -= d;
    spinSheaves(d); refreshRopes(); refreshGovernorRope();
    const l = scene.getObjectByName('carLight'); if (l) l.position.y = y + S.CAR_H * .75;
  }
  const landingY = f => FLOOR_Y[f] + S.CAR_H / 2;
  const rated = () => targetSpeed / 60;
  // 프레임 적분. drive.profile() → [목표 속도, 가감속도], drive.until() → 끝(참이면 resolve).
  function tick(time, deltaMs) {
    if (!drive || !state.active || DemoPause.paused) return;
    const dt = Math.min((deltaMs || 16.7) / 1000, .05), d = drive;
    const [vt, a] = d.profile();
    d.speed = d.speed < vt ? Math.min(vt, d.speed + a * dt) : Math.max(vt, d.speed - a * dt);
    setCar(carGrp.position.y + d.dir * d.speed * dt);
    state.speed = d.speed;
    MACH.setDrive(Math.min(1, d.speed / rated()));
    syncAllIndicators(insDisplayFloor(), d.speed > .001 ? (d.dir > 0 ? '↑' : '↓') : '');
    updateStatus('v-spd', (d.speed * 60).toFixed(d.speed < .5 ? 1 : 0) + ' m/min', '#f0883e');
    aim(false);
    const r = d.until(); if (r) { drive = null; d.resolve(r); }
  }
  const run = (id, dir, speed, profile, until) => new Promise((ok, no) => {
    if (!alive(id)) { no('cancel'); return; }
    drive = { dir, speed, profile, until, resolve: r => alive(id) ? ok(r) : no('cancel') };
  });
  const own = t => { jobs.push(t); return t; };
  const alive = id => state.active && id === epoch;
  const wait = (t, id) => new Promise((ok, no) => own(gsap.delayedCall(t, () => alive(id) ? ok() : no('cancel'))));
  const overrun = (L, dir) => (carGrp.position.y - L) * dir;   // 종단 착상면을 지난 거리(+), 앞이면 −
  const log = (type, L, dir) => state.events.push({ type, overrun: +overrun(L, dir).toFixed(3), speed: +(state.speed * 60).toFixed(1) });

  /* ── 시연 문구 ── */
  const copy = {
    intro: {
      slowdown: ['강제감속 스위치', '가정: 제어반의 정상 감속 지령이 나오지 않는다. 카는 정격속도 그대로 종단층으로 향한다. 종단층 1.5 m 앞의 강제감속 스위치가 감속을 시작시킨다.'],
      limit: ['리미트 스위치 (1차)', '가정: 정상 감속 지령과 착상 장치가 고장 났다. 강제감속으로 속도는 줄지만 종단층에 서지 못하고 지나친다. 리미트 스위치가 제어 회로를 끊어 1차로 멈춘다.'],
      final: ['파이널 리미트 스위치 (2차)', '가정: 감속·착상 고장에 더해 리미트 스위치 접점까지 붙어 버렸다(융착). 리미트를 넘어간 카를 파이널 리미트가 주전원을 직접 끊어 2차로 멈춘다.']
    },
    run: ['정격속도 운행', '종단층으로 정격속도 운행 중이다. 정상이면 이미 감속했어야 하는 구간이다.'],
    slowHit: ['강제감속 스위치 개로 → 감속 시작', '캠이 강제감속 스위치를 눌렀다. 정격속도에서 저속으로 감속한다.'],
    level: ['저속 진입 → 착상', '저속으로 종단층에 다가가 정상 착상한다. 리미트·파이널 스위치는 닿지 않는다.'],
    pass: ['종단층 통과', '착상 장치 고장으로 종단층을 지나친다. 저속으로 계속 진행한다.'],
    limitHit: ['리미트 스위치 개로 → 정지 (1차)', '제어(조작) 회로가 끊어져 모터가 멈추고 브레이크가 잡힌다.'],
    sameDir: ['같은 방향 지령 → 무시', '리미트가 열려 있는 동안 그 방향으로는 운전할 수 없다.'],
    reverse: ['반대 방향 지령 → 운전 가능', '리미트는 반대 방향 운전을 막지 않는다. 범위 안으로 돌아오면 리미트 접점이 자동 복귀한다.'],
    limitDone: ['리미트 자동 복귀 · 착상', '정상 범위로 돌아오자 리미트 접점이 다시 닫혔다. 별도 조작 없이 운행이 가능하다.'],
    welded: ['리미트 통과 (접점 융착)', '리미트 롤러는 눌렸지만 접점이 붙어 회로가 끊기지 않는다. 카가 리미트를 넘어간다.'],
    finalHit: ['파이널 리미트 개로 → 정지 (2차)', '모터와 브레이크의 주전원(동력 회로)을 직접 차단한다. 브레이크가 잡혀 카가 멈춘다.'],
    locked: ['양방향 모두 운전 불가', '파이널 리미트는 자동 복귀하지 않는다. 같은 방향은 물론 반대 방향 지령도 받지 않는다.'],
    manual: ['수동 복귀 대기', '원인(리미트 접점 융착)을 확인·조치한 뒤 수동으로 복귀해야 한다. 아래 「수동 복귀」를 누르세요.'],
    recover: ['수동 복귀 → 점검 운전으로 이탈', '주전원을 다시 넣고 점검 운전(15 m/min)으로 반대 방향으로 빼낸다. 리미트·파이널 접점이 차례로 닫힌다.'],
    done: {
      slowdown: ['완료 · 강제감속', '강제감속 스위치는 정상 감속이 안 될 때 종단층 앞에서 속도를 줄이는 장치다.'],
      limit: ['완료 · 리미트 (1차 · 제어 회로 · 자동 복귀)', '리미트는 정상 운행 범위를 넘으면 1차로 멈추고, 반대 방향으로 운전하면 자동 복귀한다.'],
      final: ['완료 · 파이널 리미트 (2차 · 주전원 · 수동 복귀)', '파이널 리미트는 리미트가 실패할 때 주전원을 차단하는 2차 안전장치이며 수동으로만 복귀한다.']
    }
  };
  function stage(key, n) {
    state.stage = key;
    const c = copy[key], [h, p] = c[state.kind] || c;
    if (n) chapter.textContent = `${sideName(state.side)} 종단 스위치 · ${KIND[state.kind]} 시연 · ${n}`;
    title.textContent = h; caption.textContent = p;
    panel.dataset.tone = /Hit$|locked|manual/.test(key) ? 'stop' : /done|limitDone/.test(key) ? 'ok' : '';
    updateStatus('v-dir', h, panel.dataset.tone === 'stop' ? '#f85149' : '#55b8d8');
  }
  function flashCommand(text, ok) {
    const el = panel.querySelector('.td-cmd'); el.textContent = text; el.dataset.ok = String(ok); el.hidden = false;
    own(gsap.fromTo(el, { x: ok ? 0 : -8 }, { x: 0, duration: .4, ease: ok ? 'power1.out' : 'elastic.out(1,.25)' }));
  }

  /* ── 시연 순서 ── */
  async function story(id) {
    const { kind, side: dir } = state, tf = dir < 0 ? 0 : FLOORS - 1, L = landingY(tf);
    try {
      if (kind === 'final') sw('limit', dir).welded = true;
      stage('intro', 1); await wait(3.2, id);
      // ① 정격속도 → 강제감속 스위치가 열릴 때까지(정상 감속 지령 없음)
      stage('run', 2);
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn(); moving = true; currentState = ELEVATOR_STATE.MOVING;
      await run(id, dir, 0, () => [rated(), A_RUN], () => isOpen('slowdown', dir));
      log('slowdown', L, dir); stage('slowHit');
      if (kind === 'slowdown') {
        // ② 강제감속 → 저속 → 착상(착상 장치 정상)
        await run(id, dir, state.speed, () => {
          const d = -overrun(L, dir);
          return [d > 0 ? Math.min(V_CREEP, Math.sqrt(2 * A_STOP * d)) : 0, state.speed > V_CREEP + .005 ? A_FORCED : A_STOP];
        }, () => { if (state.speed < V_CREEP + .005 && state.stage === 'slowHit') stage('level'); return -overrun(L, dir) <= .0005 && state.speed < .003; });
        setCar(L); stopMotor(); log('level', L, dir);
      } else {
        // ② 강제감속 → 저속 그대로 착상면 통과(착상 고장) → 리미트(또는 융착 시 파이널)까지
        const target = kind === 'limit' ? 'limit' : 'final';
        await run(id, dir, state.speed, () => [V_CREEP, A_FORCED], () => {
          if (state.stage === 'slowHit' && overrun(L, dir) > 0) stage('pass');
          if (kind === 'final' && state.stage === 'pass' && sw('limit', dir).ratio > .98) { stage('welded'); log('limitWelded', L, dir); }
          return isOpen(target, dir);
        });
        log(target, L, dir);
        if (target === 'limit') {
          stage('limitHit'); MACH.motorOff();
          await run(id, dir, state.speed, () => [0, A_CUT], () => state.speed <= 0);
          stopMotor(); log('limitStop', L, dir); await wait(1.6, id);
          stage('sameDir', 3); flashCommand(`${arrow(dir)} ${dir > 0 ? '상승' : '하강'} 지령 → 무시 (${blockReason(dir).split(' — ')[0].replace('■ ', '')})`, false);
          state.events.push({ type: 'sameDirBlocked', blocked: !!blockReason(dir) }); await wait(2.6, id);
          stage('reverse', 4); flashCommand(`${arrow(-dir)} ${dir > 0 ? '하강' : '상승'} 지령 → 운전`, true);
          state.events.push({ type: 'reverseAllowed', allowed: !blockReason(-dir) });
          await returnToLanding(id, L, dir, V_CREEP * 2.5, () => { if (!isOpen('limit', dir) && state.stage === 'reverse') { log('limitReset', L, dir); stage('limitDone'); } });
        } else {
          stage('finalHit'); latchFinal(dir); MACH.motorOff();
          await run(id, dir, state.speed, () => [0, A_POWER], () => state.speed <= 0);
          stopMotor(); log('finalStop', L, dir); await wait(1.6, id);
          stage('locked', 3);
          flashCommand(`${arrow(dir)} 같은 방향 지령 → 무시`, false); state.events.push({ type: 'sameDirBlocked', blocked: !!blockReason(dir) }); await wait(1.8, id);
          flashCommand(`${arrow(-dir)} 반대 방향 지령 → 무시 (주전원 차단)`, false); state.events.push({ type: 'reverseBlocked', blocked: !!blockReason(-dir) }); await wait(2.2, id);
          stage('manual', 4); resetBtn.hidden = false; resetBtn.focus({ preventScroll: true });
          await new Promise((ok, no) => { waitReset = () => alive(id) ? ok() : no('cancel'); });
          resetBtn.hidden = true; resetFinal(); sw('limit', dir).welded = false; refreshTerminalDevices();
          state.events.push({ type: 'manualReset' });
          stage('recover', 5); flashCommand(`점검 운전 ${arrow(-dir)} 15 m/min`, true);
          await returnToLanding(id, L, dir, V_RETURN, () => {});
        }
      }
      curFloor = tf; syncAllIndicators(tf + 1, ''); updateStatus('v-floor', (tf + 1) + 'F', '#3fb950');
      document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.f) === tf));
      await wait(kind === 'limit' ? 1.2 : .6, id);
      stage('done'); state.completed = true; endBtn.hidden = false;
      updateStatus('v-dir', '종단 스위치 시연 완료 · 정지 대기', '#3fb950');
    } catch (e) {
      if (e !== 'cancel') { console.error('[TerminalDemo]', e); state.error = String(e?.message || e); cancel(); }
    }
  }
  // 반대 방향으로 종단 착상면까지(감속 착상).
  async function returnToLanding(id, L, dir, vmax, onStep) {
    MACH.brakeRelease(); MACH.motorOn(); moving = true; currentState = ELEVATOR_STATE.MOVING;
    await run(id, -dir, 0, () => {
      const d = overrun(L, dir);
      return [d > 0 ? Math.min(vmax, Math.sqrt(2 * A_STOP * d)) : 0, A_STOP];
    }, () => { onStep(); return overrun(L, dir) <= .0005 && state.speed < .003; });
    setCar(L); refreshTerminalDevices(); onStep(); stopMotor();
  }
  function stopMotor() {
    state.speed = 0; moving = false; currentState = ELEVATOR_STATE.IDLE;
    MACH.motorOff(); MACH.brakeSet(); updateStatus('v-spd', '0 m/min', '#f0883e');
    syncAllIndicators(insDisplayFloor(), '');
  }

  /* ── 카 반투명: 스위치는 레일 뒤(카 측면과 벽 사이)에 있어 카 쪽에서만 보인다. 캠(terminalCamAssy)만 불투명 유지 ── */
  function ghostCar(on) {
    if (!on) { ghosts.forEach(([o, m, g]) => { o.material = m; [].concat(g).forEach(x => x.dispose()); }); ghosts = []; return; }
    if (ghosts.length) return;
    const cam = carGrp.getObjectByName('terminalCamAssy');
    carGrp.traverse(o => {
      if (!o.isMesh || !o.material) return;
      for (let p = o; p && p !== carGrp; p = p.parent) if (p === cam) return;
      const clone = m => { const c = m.clone(); c.transparent = true; c.opacity = Math.min(m.opacity ?? 1, .14); c.depthWrite = false; return c; };
      const g = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      ghosts.push([o, o.material, g]); o.material = g;
    });
  }

  /* ── 카메라: 카 안쪽(반투명)에서 스위치 열을 비스듬히 — 레버·롤러와 유리창 면이 함께 보인다. 캠 끝을 따라간다 ── */
  function aim(snap) {
    const dir = state.side, list = ['slowdown', 'limit', 'final'].map(k => sw(k, dir));
    const ys = list.map(s => s.y), lo = Math.min(...ys), hi = Math.max(...ys);
    const camEnd = carGrp.position.y + (dir < 0 ? TERMINAL_CAM.botLY : TERMINAL_CAM.topLY);
    const portrait = camera.aspect < .9;
    // 캠 끝(먼저 스위치를 밟는 쪽)을 따라가되 스위치 열 밖으로는 나가지 않는다.
    const ty = THREE.MathUtils.clamp(camEnd - dir * .15, lo + .25, hi - .1);
    // 피사체(스위치·캠 끝)는 하단 안내판 위쪽에 오도록 시선은 그보다 조금 아래를 본다.
    aimT.set(FLS_PIVOT_X + .02, ty, FLS_Z);
    if (snap) subject.copy(aimT); else subject.lerp(aimT, .08);
    controls.target.set(subject.x, subject.y - (portrait ? .42 : .3), subject.z);
    camera.position.set(subject.x + (portrait ? 1.0 : 1.2), subject.y + .25, subject.z + (portrait ? 1.15 : 1.0));
    camera.lookAt(controls.target);
  }

  /* ── 패널 ── */
  function lampState(s) {
    if (s.contactOpen) return ['open', '개로'];
    if (s.welded && s.ratio > .98) return ['weld', '눌림 · 접점 융착'];
    return s.ratio > .02 ? ['press', '롤러 눌림'] : ['closed', '닫힘'];
  }
  function updatePanel() {
    const dir = state.side;
    speedEl.textContent = (state.speed * 60).toFixed(state.speed < .5 ? 1 : 0);
    lampsEl.innerHTML = ['slowdown', 'limit', 'final'].map(k => {
      const s = sw(k, dir), [cls, text] = lampState(s);
      return `<div class="td-lamp" data-s="${cls}"><i></i><b>${KIND[k]}</b><span>${s.name} · ${text}</span></div>`;
    }).join('');
    const ctl = isOpen('limit', dir) || isOpen('final', dir) || state.latched, pwr = isOpen('final', dir) || state.latched;
    circuitEl.innerHTML = `<span data-on="${!ctl}">제어 회로 ${ctl ? '차단' : '정상'}</span><span data-on="${!pwr}">주전원 · 브레이크 ${pwr ? '차단 · 체결' : '투입'}</span>`;
    // 스위치 옆 이름표
    ['slowdown', 'limit', 'final'].forEach((k, i) => {
      const s = sw(k, dir), tag = tags[i], [cls] = lampState(s);
      s.body.getWorldPosition(v); v.project(camera);
      tag.hidden = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
      if (tag.hidden) return;
      tag.dataset.s = cls; tag.textContent = `${KIND[k]} ${s.name}`;
      tag.style.left = `${(v.x + 1) * innerWidth / 2 + 16}px`; tag.style.top = `${(1 - v.y) * innerHeight / 2 - 12}px`;
    });
  }

  /* ── 시작·종료 ── */
  function reason() {
    if (state.active) return '종단 스위치 시연 중입니다.';
    if (!terminalDevices.modelReady || !terminalDevices.cam) return '종단 스위치를 불러오는 중입니다.';
    if (insMode || DoorBypass.mode !== 'off') return '점검·바이패스를 해제한 자동 모드에서 실행하세요.';
    if (moving || estop || overspeedActive || governorPhase === 'tripped') return '카 정지·비상정지 해제 후 실행하세요.';
    if (!PitLadder.secured) return '피트 사다리를 접은 뒤 실행하세요.';
    if (ARDDemo.active || ManualRescueDemo.active || BufferDemo.active || RetentionDemo.active || InterlockDemo.active || UCMDemo.state.active || PhotoEyeDemo.active || RopeMeasure.active ||
      AscentDemo.active || BrakeDemo.active || RelayRopeDemo.active || InspectionReturn.busy || HallManual.busy || hatchDoors.some(h => h.manualActive) || Mascot.inspecting || CharacterWalk.active) return '다른 시연·점검을 마친 뒤 실행하세요.';
    return '';
  }
  function start(kind, dir) {
    const why = reason();
    if (why) { updateStatus('v-dir', why, '#f0883e'); return false; }
    // 문이 열려 있으면 먼저 닫는다.
    if (doorOpen || CarDoor.state.busy) { clearTimeout(autoTimer); closeDoors(() => setTimeout(() => start(kind, dir), 200)); return true; }
    if (!CarDoor.secured() || !DoorBypass.hallSecured()) { updateStatus('v-dir', '카문·승장문 닫힘 확인 후 실행하세요.', '#f0883e'); return false; }
    clearTimeout(autoTimer); closeAllMenus(); leaveCabinView(); PartGlow.closeMenu?.();
    saved = { floor: insNearestFloor(), p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov, near: camera.near, min: controls.minDistance, enabled: controls.enabled };
    gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    controls.enabled = false; controls.minDistance = .05; camera.near = .02; camera.fov = camera.aspect < .9 ? 66 : 52; camera.updateProjectionMatrix();
    epoch++; clearFaults();
    Object.assign(state, { active: true, kind, side: dir, stage: 'intro', speed: 0, events: [], completed: false, error: '' });
    // 종단층 바로 앞 층에 세우고 시작한다(정격속도까지 가속할 거리 확보).
    const sf = dir < 0 ? 1 : FLOORS - 2; setCar(landingY(sf)); curFloor = sf; syncAllIndicators(sf + 1, '');
    resetBtn.hidden = endBtn.hidden = true; panel.querySelector('.td-cmd').hidden = true; panel.hidden = false;
    document.body.classList.add('terminal-demo-active'); tags.forEach(t => t.hidden = false); ghostCar(true);
    aim(true); gsap.ticker.add(tick);
    story(epoch);
    return true;
  }
  function finish() {
    epoch++; jobs.forEach(j => j?.kill?.()); jobs = []; drive = null; waitReset = null; gsap.ticker.remove(tick);
    if (DemoPause.paused) DemoPause.set(false);
    state.active = false; panel.hidden = true; tags.forEach(t => t.hidden = true); ghostCar(false);
    camera.position.copy(saved.p); controls.target.copy(saved.t); camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix();
    controls.minDistance = saved.min; controls.enabled = saved.enabled; controls.update();
    document.body.classList.remove('terminal-demo-active');
  }
  // 종료(완료 후 「종료 · 원위치」·×·Esc·비상정지): 고장 가정·래치를 지우고 시연 전 층·시점으로 되돌린다.
  // 점검 전체 리셋 없이 바로 다시 운행할 수 있는 상태로 끝낸다.
  function cancel() {
    if (!state.active) return;
    const f = saved.floor;
    finish(); clearFaults();
    setCar(landingY(f)); refreshTerminalDevices(); curFloor = f;
    moving = false; currentState = ELEVATOR_STATE.IDLE; MACH.motorOff(); MACH.brakeSet(); state.speed = 0;
    syncAllIndicators(f + 1, ''); updateStatus('v-floor', (f + 1) + 'F', '#3fb950'); updateStatus('v-spd', '0 m/min', '#f0883e');
    document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.f) === f));
    updateStatus('v-dir', `종단 스위치 시연 종료 · ${f + 1}층 원위치`, '#3fb950');
  }

  /* ── 진입: 스위치 6개가 빛나고 누르면 바로 해당 시연 ── */
  function update() {
    if (!panel) return;
    if (state.active) { buttons.forEach(b => b.hidden = true); if (estop && !DemoPause.paused) cancel(); else updatePanel(); return; }
    const why = reason();
    buttons.forEach(b => {
      const s = terminalDevices.switches.find(x => x.name === b.dataset.sw);
      if (!s || why) { b.hidden = true; return; }
      s.body.getWorldPosition(v); const near = camera.position.distanceToSquared(v) < 64;
      v.project(camera);
      b.hidden = !near || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
      if (!b.hidden) PartActions.positionButton(b, (v.x + 1) * innerWidth / 2 - 22, (1 - v.y) * innerHeight / 2 - 22);
    });
  }
  function build() {
    const style = document.createElement('style'); style.textContent = `
      #terminal-demo-panel{position:fixed;z-index:121;left:50%;bottom:16px;transform:translateX(-50%);width:540px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:13px 18px 12px;background:#f1f8fdf5;color:#253f52;border:1px solid #9ec8dd;border-radius:16px;box-shadow:0 8px 30px #1d4a6630;font:14px/1.5 sans-serif}
      #terminal-demo-panel[data-tone=stop]{border-color:#e7a4a0;background:#fff6f5f5}#terminal-demo-panel[data-tone=ok]{border-color:#9fd7b5}
      #terminal-demo-panel[hidden],#terminal-demo-panel [hidden],.td-tag[hidden]{display:none!important}
      #terminal-demo-panel small{font-size:11px;color:#5d7f95}#terminal-demo-panel strong{display:block;margin:3px 30px 4px 0;font-size:18px;color:#1d6f8f}
      #terminal-demo-panel[data-tone=stop] strong{color:#c2412f}#terminal-demo-panel p{margin:0 0 8px;word-break:keep-all}
      .td-row{display:flex;gap:10px;align-items:stretch}.td-speed{min-width:92px;padding:6px 8px;border-radius:10px;background:#20384a;color:#e8f6ff;text-align:center}
      .td-speed b{display:block;font:800 26px/1.1 monospace}.td-speed span{font-size:11px;color:#9fc3d8}
      .td-lamps{flex:1;display:grid;gap:3px}.td-lamp{display:flex;align-items:center;gap:7px;padding:2px 8px;border-radius:7px;background:#e4eff6;font-size:12px}
      .td-lamp i{width:10px;height:10px;border-radius:50%;background:#3fb950;box-shadow:0 0 6px #3fb95080;flex:none}.td-lamp b{min-width:84px}
      .td-lamp[data-s=press] i{background:#e3b341}.td-lamp[data-s=open]{background:#fde3e0}.td-lamp[data-s=open] i{background:#f85149;box-shadow:0 0 8px #f85149}
      .td-lamp[data-s=weld]{background:#ececec}.td-lamp[data-s=weld] i{background:#8b949e;box-shadow:none}
      .td-circuit{display:flex;gap:6px;margin-top:7px;font-size:12px}.td-circuit span{padding:2px 8px;border-radius:7px;background:#dff3e5;color:#1f6f3c}.td-circuit span[data-on=false]{background:#fde3e0;color:#b03a2e;font-weight:700}
      .td-cmd{margin-top:7px;padding:5px 9px;border-radius:8px;font-weight:700;font-size:13px;background:#dff3e5;color:#1f6f3c}.td-cmd[data-ok=false]{background:#fde3e0;color:#b03a2e}
      #terminal-demo-exit{position:absolute;right:4px;top:4px;width:44px;height:44px;border:0;background:transparent;color:#3c7896;font-size:26px;cursor:pointer}
      .td-btn{min-height:42px;margin-top:8px;margin-right:6px;padding:7px 16px;border:0;border-radius:9px;background:#246f91;color:#fff;font-weight:700;cursor:pointer}#terminal-demo-reset{background:#c2412f}
      .td-tag{position:fixed;z-index:118;pointer-events:none;padding:2px 7px;border-radius:7px;background:#e8fbefe8;color:#1f6f3c;border:1px solid #8fd3a6;font:700 11px/1.3 sans-serif;white-space:nowrap}
      .td-tag[data-s=press]{background:#fff6dbe8;color:#8a6110;border-color:#e3b341}.td-tag[data-s=open]{background:#ffe6e3f0;color:#b03a2e;border-color:#f85149}.td-tag[data-s=weld]{background:#eeeeeee8;color:#555;border-color:#999}
      body.terminal-demo-active .part-action,body.terminal-demo-active #part-menu,body.terminal-demo-active #part-tip{visibility:hidden!important}
      body.terminal-demo-active #fbtns,body.terminal-demo-active #btn-open,body.terminal-demo-active #btn-close{display:none!important}
      @media(max-width:600px){#terminal-demo-panel{left:10px;right:72px;bottom:10px;transform:none;width:auto;max-width:none;padding:10px 12px;font-size:12px;max-height:46vh;overflow:auto}#terminal-demo-panel strong{font-size:15px}.td-row{flex-direction:column;gap:6px}.td-speed{display:flex;gap:8px;align-items:baseline;justify-content:center}.td-speed b{font-size:20px}}
      @media(max-height:500px) and (min-width:600px){#terminal-demo-panel{left:auto;right:12px;top:10px;bottom:auto;transform:none;width:330px;max-height:80vh;overflow:auto;font-size:12px}}
    `; document.head.appendChild(style);
    panel = document.createElement('section'); panel.id = 'terminal-demo-panel'; panel.hidden = true; panel.setAttribute('aria-label', '종단 스위치 시연');
    panel.innerHTML = '<small></small><button id="terminal-demo-exit" aria-label="시연 종료">×</button><strong></strong><p role="status"></p>' +
      '<div class="td-row"><div class="td-speed"><b>0</b><span>m/min</span></div><div class="td-lamps"></div></div><div class="td-circuit"></div><div class="td-cmd" hidden></div>' +
      '<button class="td-btn" id="terminal-demo-reset" hidden>수동 복귀 (주전원 재투입)</button><button class="td-btn" id="terminal-demo-end" hidden>종료 · 원위치</button>';
    document.body.appendChild(panel);
    [chapter, title, caption] = ['small', 'strong', 'p'].map(s => panel.querySelector(s));
    speedEl = panel.querySelector('.td-speed b'); lampsEl = panel.querySelector('.td-lamps'); circuitEl = panel.querySelector('.td-circuit');
    resetBtn = panel.querySelector('#terminal-demo-reset'); endBtn = panel.querySelector('#terminal-demo-end');
    resetBtn.onclick = () => waitReset?.();
    endBtn.onclick = panel.querySelector('#terminal-demo-exit').onclick = cancel;
    tags = [0, 1, 2].map(() => { const t = document.createElement('div'); t.className = 'td-tag'; t.hidden = true; document.body.appendChild(t); return t; });
    // 스위치 6개(피트 DFL·DLS·DSD … 상부 USD·ULS·UFL) — 각자 자기 종류 시연을 바로 실행한다.
    TERMINAL_SWITCHES.forEach(spec => {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'terminal-demo-' + spec.name; b.className = 'part-action'; b.hidden = true; b.dataset.sw = spec.name;
      b.setAttribute('aria-label', `${spec.label} 스위치 — ${KIND[spec.kind]} 시연`);
      b.onclick = () => start(spec.kind, spec.dir);
      document.getElementById('part-actions').appendChild(b); buttons.push(b);
      const s = () => terminalDevices.switches.find(x => x.name === spec.name);
      PartGlow.bind(b, () => s()?.body.children.length ? [s().body, s().lever] : null, `${spec.label} 스위치 (${spec.name})`, () => `${KIND[spec.kind]} 시연`, { direct: true });
    });
    for (const type of ['click', 'pointerdown', 'keydown', 'change', 'dblclick']) document.addEventListener(type, e => {
      if (!state.active || panel.contains(e.target) || e.target.closest?.('#btn-estop,#demo-pause') || (DemoPause.paused && e.target.closest?.('canvas'))) return;
      if (type === 'keydown' && e.key === 'Escape') { e.preventDefault(); cancel(); return; }
      if (e.target.closest?.('button,input,select,canvas') || type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('resize', () => { if (state.active) { camera.fov = camera.aspect < .9 ? 66 : 52; camera.updateProjectionMatrix(); aim(true); } });
  }
  return {
    build, update, start, cancel, isOpen, blockReason, latchFinal, resetFinal, clearFaults,
    get active() { return state.active; }, get blocksCommands() { return state.active; }, get latched() { return state.latched; }, get state() { return state; }
  };
})();
