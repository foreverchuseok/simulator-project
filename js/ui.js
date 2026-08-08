// 엘리베이터 상태 제어와 UI 이벤트 로직을 정의한다.

    /* ─────────────────────────────────────────────────────────────
       기계 구동음 엔진 (Web Audio) — 브레이크 개방·구동·가감속·체결을
       카의 실제 운동 속도(0~1)에 프레임 단위로 동기시켜 "핀트"를 맞춘다.
       (기존 extracted_move.wav 통짜 블롭 루프 재생을 대체)
    ───────────────────────────────────────────────────────────── */
    const MACH = (() => {
      let ctx = null, motor = null, running = false, noiseBuf = null;
      function ac() {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          ctx = new AC();
          noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.0), ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      }
      function resume() { try { ac(); } catch (e) { console.log(e); } }

      // 구동 모터 드론 시작 — 정지 상태(게인 0)에서 대기, setDrive로 램프업
      function motorOn() {
        const c = ac();
        if (running) return; running = true;
        const now = c.currentTime;
        const master = c.createGain(); master.gain.value = 0.0001; master.connect(c.destination);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7; lp.connect(master);
        const base = 34;
        const oscA = c.createOscillator(); oscA.type = 'sawtooth'; oscA.frequency.value = base;
        const oscB = c.createOscillator(); oscB.type = 'sawtooth'; oscB.frequency.value = base * 2.01;
        const oscC = c.createOscillator(); oscC.type = 'triangle'; oscC.frequency.value = base * 4;
        const gLow = c.createGain(); gLow.gain.value = 0.5;
        oscA.connect(gLow); oscB.connect(gLow); oscC.connect(gLow); gLow.connect(lp);
        const whine = c.createOscillator(); whine.type = 'sine'; whine.frequency.value = 140;
        const gWhine = c.createGain(); gWhine.gain.value = 0.06; whine.connect(gWhine); gWhine.connect(lp);
        const noise = c.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 0.8;
        const gN = c.createGain(); gN.gain.value = 0.04; noise.connect(bp); bp.connect(gN); gN.connect(lp);
        oscA.start(now); oscB.start(now); oscC.start(now); whine.start(now); noise.start(now);
        motor = { c, master, lp, oscA, oscB, oscC, whine, noise, base };
        setDrive(0);
      }

      // 카 속도(0~1)에 맞춰 게인·피치·필터 실시간 변조 → 가속/감속과 소리가 일치
      function setDrive(v) {
        if (!motor) return;
        v = Math.max(0, Math.min(1, v));
        const t = motor.c.currentTime, tc = 0.05, f = motor.base * (1 + 0.55 * v);
        motor.master.gain.setTargetAtTime(0.0001 + 0.20 * v, t, tc);
        motor.oscA.frequency.setTargetAtTime(f, t, tc);
        motor.oscB.frequency.setTargetAtTime(f * 2.01, t, tc);
        motor.oscC.frequency.setTargetAtTime(f * 4, t, tc);
        motor.whine.frequency.setTargetAtTime(120 + 300 * v, t, tc);
        motor.lp.frequency.setTargetAtTime(300 + 1500 * v, t, tc);
      }

      function motorOff() {
        if (!motor) return;
        const m = motor, t = m.c.currentTime;
        m.master.gain.setTargetAtTime(0.0001, t, 0.08);
        const stopAt = t + 0.5;
        [m.oscA, m.oscB, m.oscC, m.whine, m.noise].forEach(n => { try { n.stop(stopAt); } catch (e) {} });
        motor = null; running = false;
      }

      // 브레이크 개방 — 솔레노이드 클랙 + 짧은 공기 해방음
      function brakeRelease() { const c = ac(), t = c.currentTime; clack(c, t, 900, 0.05, 0.5); hiss(c, t + 0.02, 0.16, 0.10, 1200); }
      // 브레이크 체결 — 묵직한 쿵 + 클랙
      function brakeSet() { const c = ac(), t = c.currentTime; thump(c, t, 58, 0.18, 0.5); clack(c, t + 0.03, 520, 0.06, 0.45); }

      function clack(c, t, freq, dur, amp) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
        const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t); src.stop(t + dur + 0.02);
      }
      function hiss(c, t, dur, amp, hp) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); src.stop(t + dur + 0.02);
      }
      function thump(c, t, freq, dur, amp) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
      }
      return { resume, motorOn, motorOff, setDrive, brakeRelease, brakeSet };
    })();

    const snd = {
      doorOpen: new Audio('sound/door_open.wav'),
      doorClose: new Audio('sound/door_close.wav'),
      doorVoice: new Audio('sound/door_closing_voice.mp3'),
      chime: new Audio('sound/chime.wav'),
      departUp: new Audio('sound/depart_up.mp3'),
      departDown: new Audio('sound/depart_down.mp3'),
      floor: [
        new Audio('sound/floor_1.mp3'),
        new Audio('sound/floor_2.mp3'),
        new Audio('sound/floor_3.mp3'),
        new Audio('sound/floor_4.mp3')
      ]
    };
    snd.doorOpen.volume = 0.5;
    snd.doorClose.volume = 0.5;

    function updateStatus(id, txt, col) { const e = document.getElementById(id); if (e) { e.textContent = txt; if (col) e.style.color = col; } console.log("Current FSM State:", currentState); }

    function openDoors(cb) {
      if (gsap.isTweening(carDoorL.position) || moving || estop) return;
      currentState = ELEVATOR_STATE.DOOR_OPENING;
      doorOpen = true; updateStatus('v-door', '열리는 중', '#f0883e'); clearTimeout(autoTimer);
      currentState = ELEVATOR_STATE.DOOR_OPEN;
      const h = hatchDoors[curFloor];
      // 인터록 해정: 클러치가 적층 롤러를 물고 록 레버를 젖힘 → 접점 분리 → 도어 개방
      if (h && h.hook) gsap.to(h.hook.rotation, { z: -0.28, duration: 0.28, ease: 'power1.out' });
      // 삼각키 레버 시각 연동(소폭) — 비상해제 표현은 최소
      if (h && h.triKey) gsap.to(h.triKey.rotation, { z: -0.08, duration: 0.28, ease: 'power1.out' });
      snd.doorOpen.currentTime = 0; snd.doorOpen.play();
      gsap.to(carDoorL.position, { x: carDoorL.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22 });
      gsap.to(carDoorR.position, {
        x: carDoorR.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22,
        onUpdate: () => spinDoorDrive(h),
        onComplete: () => {
          updateStatus('v-door', '완전 개방', '#3fb950'); if (cb) cb();
          autoTimer = setTimeout(() => { if (doorOpen && !moving) closeDoors(); }, 3500);
        }
      });
      if (h) { gsap.to(h.left.position, { x: h.left.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22 }); gsap.to(h.right.position, { x: h.right.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22 }); }
    }

    function closeDoors(cb) {
      if (!doorOpen) { if (cb) cb(); return; }
      currentState = ELEVATOR_STATE.DOOR_CLOSING;
      clearTimeout(autoTimer); updateStatus('v-door', '닫히는 중', '#f0883e');
      const h = hatchDoors[curFloor];
      snd.doorVoice.currentTime = 0; snd.doorVoice.play().catch(e=>console.log(e));
      snd.doorClose.currentTime = 0; snd.doorClose.play().catch(e=>console.log(e));
      gsap.to(carDoorL.position, { x: carDoorL.userData.cx, duration: 0.95, ease: 'power2.inOut' });
      gsap.to(carDoorR.position, {
        x: carDoorR.userData.cx, duration: 0.95, ease: 'power2.inOut',
        onUpdate: () => spinDoorDrive(h),
        onComplete: () => {
          doorOpen = false; updateStatus('v-door', '닫힘', '#3fb950'); if (cb) cb();
          currentState = ELEVATOR_STATE.IDLE;
          // 인터록 재잠금: 후크 복귀 → 접점 브리지 삽입 (회로 폐성)
          if (h && h.hook) gsap.to(h.hook.rotation, { z: 0, duration: 0.25, ease: 'power1.in' });
          if (h && h.triKey) gsap.to(h.triKey.rotation, { z: 0, duration: 0.25, ease: 'power1.in' });
        }
      });
      if (h) { gsap.to(h.left.position, { x: h.left.userData.cx, duration: 0.95, ease: 'power2.inOut' }); gsap.to(h.right.position, { x: h.right.userData.cx, duration: 0.95, ease: 'power2.inOut' }); }
    }

    function rotateGovernorTension(deltaY) {
      if (!deltaY) return;
      const govR = (mrGrp && mrGrp.userData && mrGrp.userData.govR) || 0.14;
      if (governorWheelGrp) governorWheelGrp.rotation.z -= deltaY / govR;
      if (tensionSheaveGrp) tensionSheaveGrp.rotation.x += deltaY / 0.15;
    }

    /* ─────────────────────────────────────────────────────────────
       돌상/돌하 (Overspeed) 고장 주입 — 조속기 트립 시퀀스 연동
       카 폭주 가속 → 정격 130% 검출 → governorTrip() → 카 급정지 →
       governorReset() → 최근접 층 구출 운전
    ───────────────────────────────────────────────────────────── */
    let overspeedActive = false;

    /* ── 카메라 연출 헬퍼 (조속기 → 디바이스 추종) ──────────────────
       classic script라 camera/controls/scene/carGrp/governorWheelGrp는 전역 공유. */
    let _camSaved = null;
    function _saveCam() {
      _camSaved = { p: camera.position.clone(), t: controls.target.clone(), damp: controls.enableDamping, minD: controls.minDistance };
      controls.enabled = false; controls.enableDamping = false; controls.minDistance = 0.05;
    }
    function _restoreCam(dur = 1.5) {
      if (!_camSaved) return;
      const s = _camSaved; _camSaved = null;
      gsap.to(camera.position, { x: s.p.x, y: s.p.y, z: s.p.z, duration: dur, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: s.t.x, y: s.t.y, z: s.t.z, duration: dur, ease: 'power2.inOut',
        onComplete: () => { controls.enableDamping = s.damp; controls.minDistance = s.minD; controls.enabled = true; } });
    }
    function _camTo(px, py, pz, tx, ty, tz, dur = 1.3, ease = 'power2.inOut', onDone) {
      gsap.to(camera.position, { x: px, y: py, z: pz, duration: dur, ease });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: dur, ease, onComplete: onDone });
    }
    function _govWorld() { const v = new THREE.Vector3(); (governorWheelGrp || mrGrp).getWorldPosition(v); return v; }
    function _deviceWorld() { return carGrp.localToWorld(new THREE.Vector3(1.2575, -S.CAR_H / 2 - 0.16, 0.04)); }

    function startOverspeedFault(btn) {
      const gov = mrGrp.userData.governor;
      if (!gov || moving || doorOpen || estop || gsap.isTweening(carDoorL.position)) return;

      // 낙하 과속 시연은 3층 이상에서만 (아래로 떨어지며 속도가 붙을 거리 필요). 1·2층 불가.
      if (curFloor < 2) {
        updateStatus('v-dir', '⚠ 3층 이상에서만 시연 (낙하 거리 부족)', '#f0883e');
        return;
      }

      const spinDir = 1;                              // 하강 폭주 (휠 rotation.z 증가)
      const ty = FLOOR_Y[0] + S.CAR_H / 2, cy = carGrp.position.y; // 최하층 방향으로 낙하(도중 트립)

      overspeedActive = true; moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', '▼▼ 돌하 (과속 낙하)', '#f85149');
      btn.disabled = true;
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn();

      // 카메라: 조속기 클로즈업으로 이동 — 폭주 회전·진자 개방·트립을 관람
      _saveCam();
      const gv = _govWorld();
      _camTo(gv.x + 0.30, gv.y + 0.12, gv.z + 0.76, gv.x, gv.y - 0.02, gv.z, 1.2);

      // 폭주 낙하 — 완만한 가속 물리 적분(gsap.ticker). 정격 50%로 하강 시작 →
      // 약 1.3~1.5개 층(≈5m) 미끄러지며 가속 → 정격 130%(트립 임계) 도달 시 조속기 작동.
      // (gsap.to power2.in은 가속이 급해 반 층 만에 트립됐던 문제를 물리 적분으로 대체)
      const vTrip = targetSpeed * 1.3;        // 트립 임계 (m/min)
      const vTripMs = vTrip / 60;             // m/s
      const yFloor1 = ty;                     // 최하층 카 정위치 Y (과주 방지 안전 트립 기준)
      let v = (targetSpeed * 0.5) / 60;       // 초기 하강 속도 (정격 50%, m/s)
      const ACCEL = 0.14;                     // 폭주 가속도 (m/s²)
      let tripped = false;
      const fallTick = (time, deltaMs) => {
        const dt = Math.min((deltaMs || 16.7) / 1000, 0.05);
        v += ACCEL * dt;
        const deltaY = -v * dt;
        carGrp.position.y += deltaY;
        rotateGovernorTension(deltaY);
        cwtGrp.position.y -= deltaY;
        refreshRopes(); refreshGovernorRope();
        let curF = 1;
        for (let i = FLOORS - 1; i >= 0; i--) { if (carGrp.position.y >= FLOOR_Y[i]) { curF = i + 1; break; } }
        syncAllIndicators(curF, '↓');
        const vmm = v * 60; // m/min
        MACH.setDrive(Math.min(vmm / vTrip, 1)); // 폭주 가속에 구동음 연동
        updateStatus('v-spd', Math.round(vmm) + ' m/min', '#f85149');
        // 진자 원심 개방 — 정격 90%부터 속도 비례로 벌어짐 (트립 최대각의 80%까지)
        const open = Math.min(Math.max((vmm - targetSpeed * 0.9) / (vTrip - targetSpeed * 0.9), 0), 1)
          * gov.pose.trip.pendulum * 0.8;
        gov.pendulums[0].rotation.z = gov.geom.pendRot0[0] + open;
        gov.pendulums[1].rotation.z = gov.geom.pendRot0[1] + open;
        // 트립: 정격 130% 도달(또는 최하층 근접 시 과주 방지)
        if (!tripped && (v >= vTripMs || carGrp.position.y <= yFloor1 + 0.25)) {
          tripped = true; gsap.ticker.remove(fallTick); onGovernorOverspeed(spinDir, btn);
        }
      };
      gsap.ticker.add(fallTick);
    }

    function onGovernorOverspeed(spinDir, btn) {
      estop = true; moving = false;
      MACH.motorOff();
      currentState = ELEVATOR_STATE.ESTOP;
      updateStatus('v-dir', '⚠ 과속 검출 — 조속기 트립', '#f85149');

      // ① 조속기 트립 (카메라는 조속기에 머물러 트립을 관람) — 로프 고정 순간 카 급정지·물림
      const tripTl = governorTrip(spinDir, () => engageDeviceStop(spinDir, btn));

      // ② 트립 관람 후 디바이스(세이프티 기어)로 카메라 이동 → 물린 결과 클로즈업 → 복귀
      const govDone = tripTl ? tripTl.duration() : 1.2;
      gsap.delayedCall(govDone + 0.15, () => {
        updateStatus('v-dir', '■ 세이프티 기어 물림 (레일 파지)', '#f85149');
        const d = _deviceWorld();
        _camTo(d.x + 0.30, d.y - 0.14, d.z + 0.54, d.x - 0.04, d.y + 0.05, d.z - 0.05, 1.2, 'power2.inOut',
          () => { gsap.delayedCall(2.2, () => _restoreCam(1.6)); });
      });
    }

    // 로프 고정 순간: 카 짧은 미끄럼 후 급정지 + 세이프티 웨지 상승·핀 파지·스프링 압축
    function engageDeviceStop(spinDir, btn) {
      let prevY = carGrp.position.y;
      const sg = carGrp.userData.safetyGear;
      const stopTween = gsap.to(carGrp.position, {
        y: carGrp.position.y - 0.22, duration: 0.45, ease: 'power3.out',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevY; prevY = carGrp.position.y;
          cwtGrp.position.y -= deltaY;
          const p = stopTween.progress(); // 0 ~ 1
          if (sg && sg.shaft) {
            sg.shaft.rotation.x = -0.35 * p;            // 조속기 로프 견인 → 작동 샤프트 회전
            sg.liftL.position.y = 0.05 * p;             // 리프트 그룹 상승 → 웨지가 테이퍼로 파고듦
            sg.liftR.position.y = 0.05 * p;
            (sg.springs || []).forEach(spr => { spr.scale.y = 1 - 0.32 * p; });   // U-스프링 압축
            (sg.wedges || []).forEach(w => {            // 웨지가 레일 핀 쪽(Z)으로 파지
              const gd = Math.sign(0.04 - w.userData.z0);
              w.position.z = w.userData.z0 + gd * 0.010 * p;
            });
          }
          refreshRopes(); refreshGovernorRope();
        },
        onComplete: () => {
          MACH.brakeSet(); // 세이프티 기어 쐐기 걸림 → 급정지 클랭
          updateStatus('v-spd', '0 m/min', '#f0883e');
          btn.disabled = false; btn.textContent = 'RST';
        }
      });
    }

    function resetGovernorFault(btn) {
      btn.disabled = true;
      _restoreCam(1.0); // 디바이스 클로즈업 중 즉시 복귀 눌러도 카메라 원위치
      updateStatus('v-dir', '조속기 복귀 중…', '#f0883e');
      governorReset(() => {
        estop = false; overspeedActive = false;
        btn.disabled = false; btn.textContent = 'OVS';
        rescueToNearestFloor();
      });
    }

    // 구출 운전 — 최근접 층까지 서행 이동 후 도어 개방
    function rescueToNearestFloor() {
      let nf = 0, best = Infinity;
      FLOOR_Y.forEach((fy, i) => {
        const d = Math.abs(carGrp.position.y - (fy + S.CAR_H / 2));
        if (d < best) { best = d; nf = i; }
      });
      const ty = FLOOR_Y[nf] + S.CAR_H / 2;
      moving = true; currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', '구출 운전 (서행)', '#f0883e');
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn(); MACH.setDrive(0.28); // 서행 구동음
      let prevY = carGrp.position.y;
      gsap.to(carGrp.position, {
        y: ty, duration: Math.max(Math.abs(ty - carGrp.position.y) / 0.4, 0.6), ease: 'power1.inOut',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevY; prevY = carGrp.position.y;
          rotateGovernorTension(deltaY);
          cwtGrp.position.y -= deltaY;
          refreshRopes(); refreshGovernorRope();
        },
        onComplete: () => {
          moving = false; currentState = ELEVATOR_STATE.IDLE;
          MACH.motorOff(); MACH.brakeSet();
          curFloor = nf;
          syncAllIndicators(nf + 1, '');
          updateStatus('v-floor', (nf + 1) + 'F', '#3fb950');
          updateStatus('v-dir', '정지 대기', '#8b949e');
          updateStatus('v-spd', '0 m/min', '#f0883e');
          document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.f) === nf));
          setTimeout(() => openDoors(), 300);
        }
      });
    }

    function moveElevator(fIdx) {
      if (moving || estop || fIdx === curFloor) return;
      if (doorOpen || gsap.isTweening(carDoorL.position)) { closeDoors(() => moveElevator(fIdx)); return; }

      moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      const ty = FLOOR_Y[fIdx] + S.CAR_H / 2, cy = carGrp.position.y;
      const cwtY = cwtGrp.position.y;
      let prevCarY = cy;
      const dur = Math.max(Math.abs(ty - cy) / (targetSpeed / 60), 0.5);

      // 운행 방향 화살표 결정
      const isUp = ty > cy;
      const dirStr = isUp ? '↑' : '↓';
      updateStatus('v-dir', isUp ? '▲ 상승' : '▼ 하강', '#3fb950');

      // 사운드 시퀀스: 안내음성 → 브레이크 개방 → 구동(가감속은 onUpdate에서 실시간 동기)
      MACH.resume();
      if (isUp) { snd.departUp.currentTime = 0; snd.departUp.play().catch(e=>console.log(e)); }
      else { snd.departDown.currentTime = 0; snd.departDown.play().catch(e=>console.log(e)); }
      MACH.brakeRelease();          // 브레이크 개방음 (기동 직전)
      MACH.motorOn();               // 구동 드론 대기 (게인 0 → 속도 비례 램프업)

      gsap.to(carGrp.position, {
        y: ty, duration: dur, ease: 'power2.inOut',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevCarY;
          prevCarY = carGrp.position.y;
          rotateGovernorTension(deltaY);
          cwtGrp.position.y = cwtY - (carGrp.position.y - cy);
          refreshRopes();
          refreshGovernorRope();

          // 통과 층수는 카 바닥(문턱=중심-CAR_H/2)이 해당 층 레벨에 도달했을 때 갱신
          const carSill = carGrp.position.y - S.CAR_H / 2;
          let currentDisplayFloor = 1;
          for (let i = FLOORS - 1; i >= 0; i--) {
            if (carSill >= FLOOR_Y[i] - 0.01) { currentDisplayFloor = i + 1; break; }
          }
          syncAllIndicators(currentDisplayFloor, dirStr);

          const p = Math.min(Math.max((carGrp.position.y - cy) / (ty - cy), 0), 1);
          const spd = Math.sin(p * Math.PI); // 0(정지)→1(정격)→0, power2.inOut 가감속 프로파일
          MACH.setDrive(spd);                // 구동음 게인·피치를 실제 속도에 동기
          updateStatus('v-spd', Math.round(targetSpeed * spd) + ' m/min', '#f0883e');
          const l = scene.getObjectByName('carLight'); if (l) l.position.y = carGrp.position.y + S.CAR_H * 0.75;
        },
        onComplete: () => {
          curFloor = fIdx; moving = false;
          currentState = ELEVATOR_STATE.IDLE;
          MACH.motorOff();                   // 구동 정지
          MACH.brakeSet();                   // 도착 → 브레이크 체결음
          snd.chime.currentTime = 0; snd.chime.play().catch(e=>console.log(e));
          setTimeout(() => {
            if (snd.floor[fIdx]) { snd.floor[fIdx].currentTime = 0; snd.floor[fIdx].play().catch(e=>console.log(e)); }
          }, 800);
          // 도착 완료 시 화살표 제거하고 해당 층수만 표시
          syncAllIndicators(fIdx + 1, '');
          updateStatus('v-dir', '정지 대기', '#8b949e');
          updateStatus('v-spd', '0 m/min', '#f0883e');
          updateStatus('v-floor', (fIdx + 1) + 'F', '#3fb950');
          // 활성표시는 DOM 순서(4F→1F 역순)가 아니라 data-f(0=1F)를 기준으로 토글
          document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.f) === fIdx));
          setTimeout(() => openDoors(), 300);
        }
      });
    }

    // 독 팝오버 — 한 번에 하나만 열림, 아이콘 재탭·다른 아이콘·접기 버튼으로 닫힘
    function closeAllMenus() {
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('.dock-btn.active').forEach(b => b.classList.remove('active'));
    }

    // HUD 드래그 이동 — 상태 디스플레이가 핸들 (마우스·터치 공용)
    function makeHudDraggable() {
      const hud = document.getElementById('hud');
      const handle = document.getElementById('statusbar');
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
      handle.addEventListener('pointerdown', e => {
        if (e.target.closest('#hud-toggle')) return;
        dragging = true; sx = e.clientX; sy = e.clientY;
        ox = hud.offsetLeft; oy = hud.offsetTop;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const nx = Math.min(Math.max(ox + e.clientX - sx, 4), window.innerWidth - 80);
        const ny = Math.min(Math.max(oy + e.clientY - sy, 4), window.innerHeight - 48);
        hud.style.left = nx + 'px'; hud.style.top = ny + 'px';
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('pointercancel', () => { dragging = false; });
    }

    function bindUIEvents() {
      document.querySelectorAll('.dock-btn[data-menu]').forEach(btn => {
        btn.addEventListener('click', () => {
          const menu = document.getElementById(btn.dataset.menu);
          const wasOpen = menu.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) { menu.classList.add('open'); btn.classList.add('active'); }
        });
      });
      // 메뉴는 아이콘 재탭·다른 아이콘 선택·접기 버튼으로만 닫힘 (실행 중 사라짐 방지)

      // 접기/펴기 — 독(아이콘) 숨김, 열린 메뉴도 함께 닫음
      document.getElementById('hud-toggle').addEventListener('click', () => {
        closeAllMenus();
        document.getElementById('hud').classList.toggle('collapsed');
      });
      makeHudDraggable();

      document.querySelectorAll('input[name="speed"]').forEach(r => {
        r.addEventListener('change', e => {
          targetSpeed = parseInt(e.target.value);
          updateBuffers();
        });
      });
      document.getElementById('speed-select').addEventListener('change', e => {
        targetSpeed = parseInt(e.target.value);
        updateBuffers();
      });

      document.getElementById('fbtns').addEventListener('click', e => {
        const btn = e.target.closest('.c-btn');
        if (btn) moveElevator(parseInt(btn.dataset.f));
      });
      document.getElementById('btn-open').addEventListener('click', () => { if (!moving && !estop) openDoors(); });
      document.getElementById('btn-close').addEventListener('click', () => { if (!moving) closeDoors(); });
      document.getElementById('btn-pax')?.addEventListener('click', e => {
        const on = togglePassenger();
        e.currentTarget.classList.toggle('active', on);
      });

      document.getElementById('btn-estop').addEventListener('click', e => {
        if (overspeedActive) { updateStatus('v-dir', '조속기 트립 — 우측 패널에서 복귀', '#f85149'); return; }
        estop = !estop;
        if (estop) {
          gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position); moving = false;
          MACH.motorOff(); MACH.brakeSet();
          currentState = ELEVATOR_STATE.ESTOP;
          updateStatus('v-dir', '■ 비상정지', '#f85149'); updateStatus('v-spd', '0 m/min');
          e.target.textContent = '▶'; e.target.className = 'c-btn blue';
        } else {
          e.target.textContent = '■'; e.target.className = 'c-btn red'; updateStatus('v-dir', '정지 대기', '#8b949e');
        }
      });

      const ovBtn = document.getElementById('btn-overspeed');
      if (ovBtn) ovBtn.addEventListener('click', () => {
        if (!overspeedActive) startOverspeedFault(ovBtn);
        else if (governorPhase === 'tripped') resetGovernorFault(ovBtn);
      });

      document.getElementById('t-wall')?.addEventListener('change', e => { if (wallGrp) wallGrp.visible = e.target.checked; });
      document.getElementById('t-rope')?.addEventListener('change', e => { ropeObjs.forEach(r => r.line.visible = e.target.checked); });

      // 카메라 4뷰
      const midY = Y0 + TOTAL_H * 0.4;
      const camViews = {
        'c-mr': () => moveCam(8, Y0 + TOTAL_H + 5, 8, 0, Y0 + TOTAL_H + 0.8, 0),
        'c-pit': () => moveCam(6.5, Y0 + 1.0, 6.5, 0, Y0 + 1.0, 0),
        'c-car': () => { const cy = carGrp.position.y; moveCam(0, cy, CAR_FRONT_Z + 0.5, 0, cy - 0.1, CAR_CTR_Z); },
        'c-shaft': () => moveCam(18, midY, 21, 0, midY, 0)
      };
      Object.keys(camViews).forEach(id => {
        document.getElementById(id).addEventListener('click', camViews[id]);
      });
    }

    function moveCam(cx, cy, cz, tx, ty, tz) {
      gsap.to(camera.position, { x: cx, y: cy, z: cz, duration: 1.2, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 1.2, onUpdate: () => controls.update() });
    }

    // makeDraggable(구 플로팅 메뉴 버튼용)은 상단 바 개편으로 제거됨
