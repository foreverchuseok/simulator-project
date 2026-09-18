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
      // 점검 운전 중에는 도어 오퍼레이터 회로가 차단된다 (착상 위치가 아닐 수 있음)
      if (insMode) { updateStatus('v-door', '점검운전 중 — 도어 조작 불가', '#f0883e'); return; }
      if (gsap.isTweening(carDoorL.position) || moving || estop) return;
      // GLB extras supply the release angle; wait for that contract before moving.
      if (!hatchDoors[curFloor]?.interlock?.ready) return;
      currentState = ELEVATOR_STATE.DOOR_OPENING;
      doorOpen = true; updateStatus('v-door', '열리는 중', '#f0883e'); clearTimeout(autoTimer);
      currentState = ELEVATOR_STATE.DOOR_OPEN;
      const h = hatchDoors[curFloor];
      /* 인터록 해정: 클러치가 록 레버를 젖힌다.
         사각 턱이 걸쇠 네모 포켓에 8mm 물려 있으므로 그만큼 + 도면 179p 여유 4mm 를
         들어 올려야 실제로 빠진다. 각도는 elevator.js 의 래치 계약에서 온다. */
      if (h && h.hook) {
        const liftRad = h.latch.liftRad;
        gsap.killTweensOf(h.hook.rotation);
        gsap.to(h.hook.rotation, { z: -liftRad, duration: 0.22, ease: 'power1.out' });
      }
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
      // 승장 행거판 — 연동로프·풀리·폐문 스프링은 이 트윈에 물려 같이 갱신한다
      if (h) {
        gsap.to(h.left.position, { x: h.left.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22 });
        gsap.to(h.right.position, {
          x: h.right.userData.ox, duration: 1.15, ease: 'power2.out', delay: 0.22,
          onUpdate: () => spinDoorDrive(h), onComplete: () => spinDoorDrive(h)
        });
      }
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
          doorOpen = false; updateStatus('v-door', '닫힘', '#3fb950');
          currentState = ELEVATOR_STATE.IDLE;
        }
      });
      // 승장 행거판 — 연동로프·풀리·폐문 스프링은 이 트윈에 물려 같이 갱신한다
      if (h) {
        gsap.to(h.left.position, { x: h.left.userData.cx, duration: 0.95, ease: 'power2.inOut' });
        gsap.to(h.right.position, {
          x: h.right.userData.cx, duration: 0.95, ease: 'power2.inOut',
          onUpdate: () => spinDoorDrive(h),
          onComplete: () => {
            spinDoorDrive(h);
            // 인터록 재잠금: 도어 닫힘 정위치에서 후크 낙하 체결 및 접점 브리지 도킹
            if (h.hook) {
              gsap.killTweensOf(h.hook.rotation);
              if (h.keyRatio) setEmergencyKey(curFloor, 0);
              gsap.to(h.hook.rotation, {
                z: 0, duration: 0.20, ease: 'power1.in',
                onComplete: () => { if (cb) cb(); }
              });
            } else {
              if (cb) cb();
            }
          }
        });
      } else {
        if (cb) cb();
      }
    }

    /* ─────────────────────────────────────────────────────────────
       시브(도르래) 물리 연동 — 카가 실제로 움직인 양(deltaY) 하나로 4개를 모두 구동한다.
       시간 기반으로 "대충 돌리는" 연출이 아니므로 방향·속도가 로프와 항상 일치하고,
       카가 멈추면 시브도 그 순간 멈춘다.

       ▪ 4개 시브 모두 회전축이 월드 +X (스핀 파라미터만 다름)
           주도르래 mainSheaveGrp.rotation.z   (마운트 rotation.y=π/2 → 로컬+Z=월드+X)
           현수도르래 deflectorSheaveGrp.rotation.z (동일 구조)
           조속기휠 governorWheelGrp.rotation.z (govBodyGrp rotation.y=π/2 → 동일)
           인장시브 tensionSheaveGrp.rotation.x (축이 이미 월드 X)
       ▪ 부호 규칙 — +X축 회전 ω에서 접점 표면속도의 Y성분:
           시브 +Z측 접점 → v = -ωR  ⇒  dθ = -Δy / R
           시브 -Z측 접점 → v = +ωR  ⇒  dθ = +Δy / R
       ▪ 권상 로프(1본): 카측은 주도르래 +Z 접점(refreshRopes 호 시작각 a=0),
         균형추측은 현수도르래 -Z 접점(a=π) → 둘 다 dθ = -Δy/R (같은 로프이므로 같은 방향).
       ▪ 조속기 로프(1본): 카 연동(클램프) 가닥이 두 시브 모두 +Z측(govRopeData.z = 중심 + R)
         → 둘 다 dθ = -Δy/R. 즉 조속기·인장시브가 주도르래와 같은 방향으로 돈다.
         ★이건 GOV_TENS_Z(index.html) 오프셋이 "클램프 오프셋 + 홈반경"으로 맞춰져 있어
           클램프가 앞쪽 가닥을 물기 때문이다. 축을 옮기면 무는 가닥이 바뀌어 방향이 뒤집힌다.
       ▪ 회전량이 Δy/R 그대로라 별도 속도 계수가 없다. 반지름이 작을수록 빨리 돈다.
    ───────────────────────────────────────────────────────────── */

    // 권상 로프계 — 주도르래 + 현수(편향)도르래
    function spinTractionSheaves(deltaY) {
      if (!deltaY) return;
      const ud = (mrGrp && mrGrp.userData) || {};
      if (mainSheaveGrp)      mainSheaveGrp.rotation.z      -= deltaY / (ud.mainR || 0.33);
      if (deflectorSheaveGrp) deflectorSheaveGrp.rotation.z -= deltaY / (ud.defRadius || 0.144);
    }

    // 조속기 로프계 — 조속기 휠 + 피트 인장시브
    // 과속 트립(ESTOP) 시 떡판이 로프를 파지하므로 두 시브가 함께 멈춘다
    // (트립 연출 회전은 elevator.js governorTrip 이 담당).
    function spinGovernorSheaves(deltaY) {
      if (!deltaY) return;
      if (currentState === ELEVATOR_STATE.ESTOP) return;
      const govR = (mrGrp && mrGrp.userData && mrGrp.userData.govR) || 0.15;
      if (governorWheelGrp) governorWheelGrp.rotation.z -= deltaY / govR;
      if (tensionSheaveGrp) tensionSheaveGrp.rotation.x -= deltaY / govR;
    }

    function spinSheaves(deltaY) {
      spinTractionSheaves(deltaY);
      spinGovernorSheaves(deltaY);
    }

    /* ─────────────────────────────────────────────────────────────
       점검(수동) 운전 — INS / AUT / ▲ / ▼
       현장 규칙: 점검 스위치를 넣으면 자동·승강장 호출이 모두 무효가 되고,
       ▲/▼ 버튼을 "누르고 있는 동안만" 서행 이동(hold-to-run)한다. 손을 떼면
       즉시 정지. 점검 속도는 정격(60 m/min)이 아니라 15 m/min(0.25 m/s)로,
       법정 상한 0.63 m/s 이내다. 종단(최상·최하층 ±INS_OVERRUN)에서 자동 정지.
    ───────────────────────────────────────────────────────────── */
    const INSPECT_SPEED = 15;   // 점검 운전 속도 (m/min) — 정격 60 대비 1/4 서행
    const INS_OVERRUN   = 0.35; // 최상·최하층 착상면 기준 허용 오버런 (m)
    let insMode = false;        // 점검 운전 스위치 ON/OFF
    let insDir  = 0;            // 현재 이동 방향 (+1 상승 / -1 하강 / 0 정지)
    let insHold = 0;            // 버튼을 누르고 있는 방향 (도어 폐쇄 대기 중 판정용)

    function insLimits() {
      return {
        top: FLOOR_Y[FLOORS - 1] + S.CAR_H / 2 + INS_OVERRUN,
        bot: FLOOR_Y[0] + S.CAR_H / 2 - INS_OVERRUN
      };
    }

    // 카 바닥(문턱) 기준 현재 표시 층수
    function insDisplayFloor() {
      const carSill = carGrp.position.y - S.CAR_H / 2;
      let f = 1;
      for (let i = FLOORS - 1; i >= 0; i--) { if (carSill >= FLOOR_Y[i] - 0.01) { f = i + 1; break; } }
      return f;
    }

    // 프레임 단위 등속 이동 (가감속 없이 일정 서행 — 점검 운전 특성)
    function insTick(time, deltaMs) {
      // 저사양·저FPS에서도 서행 속도가 유지되도록 최대 0.1초까지 델타 인정
      const dt = Math.min((deltaMs || 16.7) / 1000, 0.1);
      const lim = insLimits();
      const y0 = carGrp.position.y;
      const ny = Math.min(Math.max(y0 + insDir * (INSPECT_SPEED / 60) * dt, lim.bot), lim.top);
      const deltaY = ny - y0;

      carGrp.position.y = ny;
      spinSheaves(deltaY);
      cwtGrp.position.y -= deltaY;
      refreshRopes(); refreshGovernorRope();

      syncAllIndicators(insDisplayFloor(), insDir > 0 ? '↑' : '↓');
      MACH.setDrive(INSPECT_SPEED / 60); // 서행 구동음 (정격 대비 비율 아닌 절대 서행감)
      updateStatus('v-spd', INSPECT_SPEED + ' m/min', '#f0883e');
      updateStatus('v-floor', insDisplayFloor() + 'F', '#f0883e');
      const l = scene.getObjectByName('carLight'); if (l) l.position.y = carGrp.position.y + S.CAR_H * 0.75;

      // 종단(최상·최하 오버런 한계) 도달 → 강제 정지
      if ((insDir > 0 && ny >= lim.top) || (insDir < 0 && ny <= lim.bot)) {
        insStop('■ 점검 종단 리미트 (더 이상 이동 불가)');
      }
    }

    function insStart(dir) {
      if (!insMode || estop || overspeedActive || insDir === dir) return;
      // 도어가 열려 있으면 먼저 닫고, 그때까지 버튼을 계속 누르고 있는 경우에만 출발
      if (doorOpen || gsap.isTweening(carDoorL.position)) {
        updateStatus('v-dir', '도어 폐쇄 중 — 계속 누르고 대기', '#f0883e');
        closeDoors(() => { if (insHold === dir) insStart(dir); });
        return;
      }
      if (insDir !== 0) gsap.ticker.remove(insTick); // 방향 전환

      insDir = dir; moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', dir > 0 ? '▲ 점검 상승 (서행)' : '▼ 점검 하강 (서행)', '#f0883e');
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn(); MACH.setDrive(INSPECT_SPEED / 60);
      gsap.ticker.add(insTick);
    }

    function insStop(msg) {
      if (insDir === 0) return;
      gsap.ticker.remove(insTick);
      insDir = 0; moving = false;
      currentState = ELEVATOR_STATE.IDLE;
      MACH.motorOff(); MACH.brakeSet();
      const f = insDisplayFloor();
      syncAllIndicators(f, '');
      updateStatus('v-spd', '0 m/min', '#f0883e');
      updateStatus('v-floor', f + 'F', '#f0883e');
      updateStatus('v-dir', msg || '■ 점검 정지 (INS)', '#f0883e');
    }

    // 점검 스위치 ON/OFF. ON: 자동 운전 즉시 차단 / OFF: 착상 위치가 아니면 최근접 층 착상
    function setInspectionMode(on) {
      if(overspeedActive)return;
      if (insMode === on) return;
      insMode = on;
      insHold = 0;
      insStop();

      const up = document.getElementById('btn-ins-up');
      const dn = document.getElementById('btn-ins-dn');
      if (up) up.disabled = !on;
      if (dn) dn.disabled = !on;
      document.getElementById('btn-ins')?.classList.toggle('mode-on', on);
      document.getElementById('btn-aut')?.classList.toggle('mode-on', !on);

      if (on) {
        // 운전 중 점검 전환 → 자동 운전 즉시 중단 (그 자리에 정지)
        clearTimeout(autoTimer);
        gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position);
        if (moving) { moving = false; MACH.motorOff(); MACH.brakeSet(); }
        currentState = ELEVATOR_STATE.IDLE;
        syncAllIndicators(insDisplayFloor(), '');
        updateStatus('v-spd', '0 m/min', '#f0883e');
        updateStatus('v-dir', '점검운전 (INS) — ▲▼ 누르는 동안 서행', '#f0883e');
      } else {
        // 자동 복귀: 착상면에서 벗어나 있으면 최근접 층으로 서행 착상
        let off = Infinity;
        FLOOR_Y.forEach(fy => { off = Math.min(off, Math.abs(carGrp.position.y - (fy + S.CAR_H / 2))); });
        updateStatus('v-dir', '자동운전 (AUT)', '#3fb950');
        if (off > 0.01 && !estop && !overspeedActive) {
          rescueToNearestFloor('자동 복귀 (착상)', false);
        } else {
          curFloor = insNearestFloor();
          syncAllIndicators(curFloor + 1, '');
          updateStatus('v-floor', (curFloor + 1) + 'F', '#3fb950');
          document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.f) === curFloor));
        }
      }
    }

    function insNearestFloor() {
      let nf = 0, best = Infinity;
      FLOOR_Y.forEach((fy, i) => {
        const d = Math.abs(carGrp.position.y - (fy + S.CAR_H / 2));
        if (d < best) { best = d; nf = i; }
      });
      return nf;
    }

    /* ─────────────────────────────────────────────────────────────
       돌상/돌하 (Overspeed) 고장 주입 — 조속기 트립 시퀀스 연동
       카 폭주 가속 → 정격 130% 검출 → governorTrip() → 카 급정지 →
       governorReset() → 최근접 층 구출 운전
    ───────────────────────────────────────────────────────────── */
    let overspeedActive = false;
    const ovsDemo={stage:'rest',inset:null,trip:null,stop:null,fallTick:null,hidden:[],insetHidden:[],camera:null};
    function ovsStage(text){
      let el=document.getElementById('ovs-stage');
      if(!el){el=document.createElement('div');el.id='ovs-stage';el.setAttribute('role','status');
        el.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:70vw;padding:12px 20px;background:#142230ed;color:#eef5fa;border:1px solid #66859b;border-radius:9px;font:14px sans-serif;z-index:30;pointer-events:none;text-align:center';document.body.appendChild(el);}
      el.hidden=false;el.textContent='OVS · 느린 동작  |  '+text;
      updateStatus('v-dir',text,'#f0883e');
    }
    function setOVSCutaway(enabled){
      if(!enabled){ovsDemo.hidden.forEach(([o,v])=>o.visible=v);ovsDemo.hidden=[];return;}
      const keep=new Set(['carSafetyGear','carSafetyLinkage','CarGuideShoe_L_Lower','CarGuideShoe_R_Lower']);
      carGrp.traverse(o=>{
        if(!o.isMesh&&!o.isLine)return;
        let p=o,retained=false;while(p&&p!==carGrp){if(keep.has(p.name))retained=true;p=p.parent;}
        if(!retained){ovsDemo.hidden.push([o,o.visible]);o.visible=false;}
      });
    }
    function renderOverspeedInset(){
      if(!ovsDemo.inset||!ovsDemo.camera)return;
      const c=ovsDemo.camera,w=Math.min(350,innerWidth*0.32),h=w*0.72;
      const target=ovsDemo.target,offset=ovsDemo.offset;
      if(ovsDemo.inset==='governor'){
        governorWheelGrp.getWorldPosition(target);offset.set(0.64,0.09,0.31);
      }else{
        target.set(1.24,-S.CAR_H/2-0.16,0.04);carGrp.localToWorld(target);offset.set(-0.40,-0.22,-0.42);
      }
      c.position.copy(target).add(offset);c.lookAt(target);c.aspect=w/h;c.updateProjectionMatrix();
      // Inset is an explicit section view; restore visibility immediately after drawing.
      if(ovsDemo.inset==='safety')ovsDemo.insetHidden.forEach(([o])=>{o.userData.ovsInsetVisible=o.visible;o.visible=false;});
      renderer.setScissorTest(true);renderer.setScissor(18,100,w,h);renderer.setViewport(18,100,w,h);
      const shadowUpdate=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
      renderer.clearDepth();renderer.render(scene,c);renderer.shadowMap.autoUpdate=shadowUpdate;
      renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
      if(ovsDemo.inset==='safety')ovsDemo.insetHidden.forEach(([o])=>o.visible=o.userData.ovsInsetVisible);
    }

    /* ── 카메라 연출 헬퍼 (조속기 → 디바이스 추종) ──────────────────
       classic script라 camera/controls/scene/carGrp/governorWheelGrp는 전역 공유. */
    let _camSaved = null;
    function _saveCam() {
      _camSaved = { p: camera.position.clone(), t: controls.target.clone(), damp: controls.enableDamping, minD: controls.minDistance, near:camera.near };
      camera.near=0.002;camera.updateProjectionMatrix();
      controls.enabled = false; controls.enableDamping = false; controls.minDistance = 0.05;
    }
    function _restoreCam(dur = 1.5) {
      if (!_camSaved) return;
      const s = _camSaved; _camSaved = null;
      gsap.to(camera.position, { x: s.p.x, y: s.p.y, z: s.p.z, duration: dur, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: s.t.x, y: s.t.y, z: s.t.z, duration: dur, ease: 'power2.inOut',
        onComplete: () => { controls.enableDamping = s.damp; controls.minDistance = s.minD; controls.enabled = true;camera.near=s.near;camera.updateProjectionMatrix(); } });
    }
    function _camTo(px, py, pz, tx, ty, tz, dur = 1.3, ease = 'power2.inOut', onDone) {
      gsap.to(camera.position, { x: px, y: py, z: pz, duration: dur, ease });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: dur, ease, onComplete: onDone });
    }
    function _govWorld() { const v = new THREE.Vector3(); (governorWheelGrp || mrGrp).getWorldPosition(v); return v; }
    function _deviceWorld() {
      // 카 우측 하단 세이프티 기어 웨지/작동 샤프트 월드 좌표
      carGrp.updateMatrixWorld(true);
      return carGrp.localToWorld(new THREE.Vector3(S.CAR_W / 2 + 0.03, -S.CAR_H / 2 - 0.16, 0.04));
    }

    function startOverspeedFault(btn) {
      const gov = mrGrp.userData.governor;
      if (insMode) { updateStatus('v-dir', '점검운전 중 — 자동 시연 불가 (AUT 전환)', '#f0883e'); return; }
      if (!gov?.ready || !carGrp.userData.safetyGear || moving || doorOpen || estop || gsap.isTweening(carDoorL.position)) return;

      // 낙하 과속 시연은 3층 이상에서만 (아래로 떨어지며 속도가 붙을 거리 필요). 1·2층 불가.
      if (curFloor < 2) {
        updateStatus('v-dir', '⚠ 3층 이상에서만 시연 (낙하 거리 부족)', '#f0883e');
        return;
      }

      const spinDir = 1;                              // 하강 폭주 (휠 rotation.z 증가)
      const ty = FLOOR_Y[0] + S.CAR_H / 2;           // 최하층 방향으로 낙하(도중 트립)

      overspeedActive = true; moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', '▼▼ 돌하 (과속 낙하)', '#f85149');
      btn.disabled = true;
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn();

      // 카메라: 조속기 정면 3/4 사선 클로즈업으로 부드럽게 이동 (쐐기 물림·스위치 타격·캐치슈 파지 관람)
      _saveCam();
      ovsDemo.stage='runaway';ovsDemo.inset='safety';
      ovsDemo.camera ||= new THREE.PerspectiveCamera(42,1,0.002,100);
      ovsDemo.target ||= new THREE.Vector3();ovsDemo.offset ||= new THREE.Vector3();ovsDemo.insetHidden=[];
      scene.traverse(o=>{if(!o.isMesh&&!o.isLine)return;let p=o,keep=false;
        while(p){if(['carSafetyGear','carSafetyLinkage','T_Rail_13K'].includes(p.name))keep=true;p=p.parent;}
        if(!keep)ovsDemo.insetHidden.push([o]);});
      ovsStage('낙하 속도가 증가합니다. 왼쪽 아래는 안전기 작동 단면입니다.');
      const gv = _govWorld();
      _camTo(gv.x + 0.70, gv.y + 0.15, gv.z + 0.35, gv.x - 0.02, gv.y + 0.02, gv.z, 1.2);

      // 폭주 낙하 — 완만한 가속 물리 적분(gsap.ticker). 정격 50%로 하강 시작 →
      // 약 1.3~1.5개 층 미끄러지며 가속 → 정격 130%(트립 임계) 도달 시 조속기 슬로우 작동.
      const vTrip = targetSpeed * 1.3;        // 트립 임계 (m/min)
      const vTripMs = vTrip / 60;             // m/s
      const yFloor1 = ty;                     // 최하층 카 정위치 Y
      let v = (targetSpeed * 0.5) / 60;       // 초기 하강 속도 (정격 50%, m/s)
      const ACCEL = 0.14;                     // 폭주 가속도 (m/s²)
      let tripped = false;
      const fallTick = (time, deltaMs) => {
        const dt = Math.min((deltaMs || 16.7) / 1000, 0.05);
        v += ACCEL * dt;
        const deltaY = -v * dt;
        carGrp.position.y += deltaY;
        spinSheaves(deltaY);
        cwtGrp.position.y -= deltaY;
        refreshRopes(); refreshGovernorRope();
        let curF = 1;
        for (let i = FLOORS - 1; i >= 0; i--) { if (carGrp.position.y >= FLOOR_Y[i]) { curF = i + 1; break; } }
        syncAllIndicators(curF, '↓');
        const vmm = v * 60; // m/min
        MACH.setDrive(Math.min(vmm / vTrip, 1));
        updateStatus('v-spd', Math.round(vmm) + ' m/min', '#f85149');
        // 진자 원심 개방 — 정격 90%부터 속도 비례로 벌어짐 (트립 최대각의 70%까지)
        const open = Math.min(Math.max((vmm - targetSpeed * 0.9) / (vTrip - targetSpeed * 0.9), 0), 1)
          * gov.pose.trip.pendulum * 0.7;
        gov.pendulums[0].rotation.z = gov.geom.pendRot0[0] + open;
        gov.pendulums[1].rotation.z = gov.geom.pendRot0[1] + open;
        if (gov.setLinkage) gov.setLinkage(open);
        // 트립: 정격 130% 도달
        if (!tripped && (v >= vTripMs || carGrp.position.y <= yFloor1 + 0.25)) {
          tripped = true; gsap.ticker.remove(fallTick);ovsDemo.fallTick=null; onGovernorOverspeed(spinDir, btn);
        }
      };
      gsap.ticker.add(fallTick);
      ovsDemo.fallTick=fallTick;
    }

    function onGovernorOverspeed(spinDir, btn) {
      moving=true;
      // Electrical cut-off is visible first; mechanical motion continues in slow time.
      let previousWheel=govHandles().wheel.rotation.z;
      ovsDemo.trip=governorTrip(spinDir,()=>{
        estop=true;moving=false;currentState=ELEVATOR_STATE.ESTOP;
        ovsStage('로프 고정 → 카의 상대 하강이 링크를 당깁니다.');
        ovsDemo.inset='governor';setOVSCutaway(true);
        const d=_deviceWorld();
        _camTo(d.x-0.42,d.y-0.24,d.z-0.52,d.x,d.y,d.z,1.25);
        engageDeviceStop(spinDir,btn,{duration:4.0,onComplete:()=>{
          ovsStage('제동 완료 · 네 쐐기가 레일을 파지했습니다. RST로 복귀합니다.');
          ovsDemo.stage='stopped';
          // Keep the arrested mechanism visible for inspection until RST.
          controls.enabled=true;
        }});
      },{
        onStage:stage=>{
          ovsDemo.stage=stage;
          const captions={centrifugal:'과속 감지 · 원심 진자가 벌어집니다.',
            electrical:'과속 스위치 타격 · 접점이 열리고 레버가 떨어집니다.',
            pawl:'멈춤쇠가 톱니에 걸려 캐치 레버를 해제합니다.',
            'rope-grip':'캐치슈가 조속기 로프를 눌러 고정합니다.'};
          ovsStage(captions[stage]);
          if(stage==='electrical'){MACH.motorOff();estop=true;currentState=ELEVATOR_STATE.ESTOP;}
        },
        onUpdate:()=>{
          const w=govHandles().wheel.rotation.z,deltaY=-(w-previousWheel)*mrGrp.userData.govR;previousWheel=w;
          carGrp.position.y+=deltaY;cwtGrp.position.y-=deltaY;
          spinTractionSheaves(deltaY);
          if(tensionSheaveGrp)tensionSheaveGrp.rotation.x-=deltaY/mrGrp.userData.govR;
          refreshRopes();refreshGovernorRope();
        }
      });
    }

    function engageDeviceStop(spinDir, btn, options={}) {
      const sg=carGrp.userData.safetyGear,linkage=carGrp.userData.safetyLinkage;
      if(!sg||!linkage)return null;
      const startY=carGrp.position.y,stroke=linkage.clampLift;
      const drive={distance:0};let previousY=startY;
      const tween=gsap.to(drive,{distance:stroke,duration:options.duration||0.85,ease:'power2.out',
        onUpdate:()=>{
          const distance=Math.max(0,Math.min(stroke,drive.distance));
          carGrp.position.y=startY-distance;
          const deltaY=carGrp.position.y-previousY;previousY=carGrp.position.y;cwtGrp.position.y-=deltaY;
          spinTractionSheaves(deltaY);
          const half=linkage.dimensions.half,ratio=distance/stroke;
          const p=(Math.asin(-Math.sin(half)+2*Math.sin(half)*ratio)+half)/(2*half);
          sg.shaft.rotation.x=SG_TRIP_ROT*p;
          refreshRopes();refreshGovernorRope();
          if(overspeedActive&&p>0.12&&ovsDemo.stage!=='wedges'){
            ovsDemo.stage='wedges';ovsStage('안전 스위치 해제 → 링크·인상 핀 → 쐐기 상승 → 레일 파지');
          }
        },
        onComplete:()=>{
          MACH.brakeSet();updateStatus('v-spd','0 m/min','#f0883e');
          btn.disabled=false;btn.textContent='RST';options.onComplete?.();
        }
      });
      ovsDemo.stop=tween;return tween;
    }

    function resetGovernorFault(btn) {
      btn.disabled = true;
      ovsDemo.inset=null;ovsDemo.stage='resetting';setOVSCutaway(false);
      if(ovsDemo.fallTick){gsap.ticker.remove(ovsDemo.fallTick);ovsDemo.fallTick=null;}
      ovsDemo.trip?.kill();ovsDemo.stop?.kill();
      const caption=document.getElementById('ovs-stage');if(caption)caption.hidden=true;
      _restoreCam(1.0); // 디바이스 클로즈업 중 즉시 복귀 눌러도 카메라 원위치
      updateStatus('v-dir', '조속기 복귀 중…', '#f0883e');
      governorReset(() => {
        estop = false; overspeedActive = false;
        ovsDemo.stage='rest';
        btn.disabled = false; btn.textContent = 'OVS';
        rescueToNearestFloor();
      });
    }

    // 구출 운전 — 최근접 층까지 서행 이동 후 도어 개방
    // (점검→자동 복귀 착상에도 재사용: label/openAfter 로 문구·도어 개방 여부 조정)
    function rescueToNearestFloor(label = '구출 운전 (서행)', openAfter = true) {
      const nf = insNearestFloor();
      const ty = FLOOR_Y[nf] + S.CAR_H / 2;
      moving = true; currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', label, '#f0883e');
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn(); MACH.setDrive(0.28); // 서행 구동음
      let prevY = carGrp.position.y;
      gsap.to(carGrp.position, {
        y: ty, duration: Math.max(Math.abs(ty - carGrp.position.y) / 0.4, 0.6), ease: 'power1.inOut',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevY; prevY = carGrp.position.y;
          spinSheaves(deltaY);
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
          if (openAfter) setTimeout(() => openDoors(), 300);
        }
      });
    }

    function moveElevator(fIdx) {
      if(overspeedActive)return;
      if (insMode) { updateStatus('v-dir', '점검운전 중 — 자동 호출 무효', '#f0883e'); return; }
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
          spinSheaves(deltaY);
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

      /* ── 점검(수동) 운전 ── AUT/INS 토글 + ▲▼ 홀드 투 런 ── */
      document.getElementById('btn-aut')?.addEventListener('click', () => setInspectionMode(false));
      document.getElementById('btn-ins')?.addEventListener('click', () => setInspectionMode(true));
      document.getElementById('btn-aut')?.classList.add('mode-on'); // 기동 시 자동운전

      [['btn-ins-up', 1], ['btn-ins-dn', -1]].forEach(([id, dir]) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.addEventListener('pointerdown', e => {
          if (b.disabled) return;
          e.preventDefault();
          insHold = dir; insStart(dir);
        });
        // 버튼 밖에서 손을 떼도 반드시 멈추도록 포인터 해제는 window 에서 받는다
        b.addEventListener('contextmenu', e => e.preventDefault());
      });
      const insRelease = () => { insHold = 0; insStop(); };
      window.addEventListener('pointerup', insRelease);
      window.addEventListener('pointercancel', insRelease);
      window.addEventListener('blur', insRelease);
      document.addEventListener('visibilitychange', () => { if (document.hidden) insRelease(); });

      document.getElementById('btn-estop').addEventListener('click', e => {
        if (overspeedActive) { updateStatus('v-dir', '조속기 트립 — 우측 패널에서 복귀', '#f85149'); return; }
        estop = !estop;
        if (estop) {
          insHold = 0; insStop();
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

      // Click the landing triangle key: turn the cam, lift the latch, open that floor.
      const keyRay = new THREE.Raycaster();
      const keyNdc = new THREE.Vector2();
      let keyPtr = null;
      const canvas = renderer.domElement;
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        keyPtr = { x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener('pointerup', e => {
        if (e.button !== 0 || !keyPtr) return;
        const dragged = Math.hypot(e.clientX - keyPtr.x, e.clientY - keyPtr.y) > 6;
        keyPtr = null;
        if (dragged || moving) return;
        const rect = canvas.getBoundingClientRect();
        keyNdc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        keyRay.setFromCamera(keyNdc, camera);
        const groups = hatchDoors.map(h => h.right.userData.triKey?.group).filter(Boolean);
        const hit = keyRay.intersectObjects(groups, true)[0];
        if (!hit) return;
        let grp = hit.object;
        while (grp && grp.name !== 'EmergencyTriangleKey') grp = grp.parent;
        const fIdx = hatchDoors.findIndex(h => h.right.userData.triKey?.group === grp);
        if (fIdx < 0) return;
        const h = hatchDoors[fIdx];
        if (!h.interlock?.ready) return;
        const unlocking = !(h.keyRatio > 0.5);
        if (!h.keyTween) h.keyTween = { r: 0 };
        h.keyTween.r = h.keyRatio || 0;
        gsap.killTweensOf(h.keyTween);
        gsap.to(h.keyTween, {
          r: unlocking ? 1 : 0,
          duration: 0.4,
          ease: 'power1.inOut',
          onUpdate: () => setEmergencyKey(fIdx, h.keyTween.r),
          onComplete: () => {
            setEmergencyKey(fIdx, unlocking ? 1 : 0);
            if (unlocking && fIdx === curFloor && !doorOpen) openDoors();
            else if (!unlocking && fIdx === curFloor && doorOpen) closeDoors();
          }
        });
      });
    }

    function moveCam(cx, cy, cz, tx, ty, tz) {
      gsap.to(camera.position, { x: cx, y: cy, z: cz, duration: 1.2, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 1.2, onUpdate: () => controls.update() });
    }

    // makeDraggable(구 플로팅 메뉴 버튼용)은 상단 바 개편으로 제거됨
