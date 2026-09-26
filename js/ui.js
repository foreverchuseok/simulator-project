// 엘리베이터 상태 제어와 UI 이벤트 로직을 정의한다.
const MANUAL_CAMERA = Object.freeze({ minDistance: 0.04, near: 0.002 });

function updateManualCameraNear() {
  if (overspeedActive || !controls.enabled) return;
  // 원거리에서는 깊이 정밀도를 높이고, 가까이 볼 때만 근접 클리핑을 낮춘다.
  const near = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.02, MANUAL_CAMERA.near, 0.1);
  if (Math.abs(camera.near - near) < 0.00001) return;
  camera.near = near;
  camera.updateProjectionMatrix();
}

    /* ─────────────────────────────────────────────────────────────
       기계 구동음 엔진 (Web Audio) — 브레이크 개방·구동·가감속·체결을
       카의 실제 운동 속도(0~1)에 프레임 단위로 동기시켜 "핀트"를 맞춘다.
       (기존 extracted_move.wav 통짜 블롭 루프 재생을 대체)
    ───────────────────────────────────────────────────────────── */
    const MACH = (() => {
      const EFFECT_VOLUME = 1.2, ANNOUNCEMENT_EFFECT_VOLUME = 0.4;
      let ctx = null, motor = null, running = false, noiseBuf = null, effects = null, doorStop = null;
      function ac() {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          ctx = new AC();
          effects = ctx.createGain(); effects.gain.value = EFFECT_VOLUME; effects.connect(ctx.destination);
          noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.0), ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      }
      function resume() { try { ac(); } catch (e) { console.log(e); } }

      // 구동 모터 드론 시작 — 정지 상태(게인 0)에서 대기, setDrive로 램프업
      function motorOn() {
        const c = ac();
        if (running) return; running = true;
        const now = c.currentTime;
        const master = c.createGain(); master.gain.value = 0.0001; master.connect(effects);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7; lp.connect(master);
        const base = 82;
        const oscA = c.createOscillator(); oscA.type = 'sine'; oscA.frequency.value = base;
        const oscB = c.createOscillator(); oscB.type = 'sine'; oscB.frequency.value = base * 2.0;
        const oscC = c.createOscillator(); oscC.type = 'sine'; oscC.frequency.value = base * 4;
        const gLow = c.createGain(); gLow.gain.value = 0.24;
        const gUpper = c.createGain(); gUpper.gain.value = 0.045;
        oscA.connect(gLow); oscB.connect(gUpper); oscC.connect(gUpper); gUpper.connect(lp); gLow.connect(lp);
        const whine = c.createOscillator(); whine.type = 'sine'; whine.frequency.value = 140;
        const gWhine = c.createGain(); gWhine.gain.value = 0.008; whine.connect(gWhine); gWhine.connect(lp);
        const noise = c.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
        const gN = c.createGain(); gN.gain.value = 0.13; noise.connect(bp); bp.connect(gN); gN.connect(lp);
        oscA.start(now); oscB.start(now); oscC.start(now); whine.start(now); noise.start(now);
        motor = { c, master, lp, oscA, oscB, oscC, whine, noise, base,
          nodes: [master, lp, oscA, oscB, oscC, whine, noise, gLow, gUpper, gWhine, bp, gN], lastDrive: -1 };
        setDrive(0);
      }

      // 카 속도(0~1)에 맞춰 게인·피치·필터 실시간 변조 → 가속/감속과 소리가 일치
      function setDrive(v) {
        if (!motor) return;
        v = Math.max(0, Math.min(1, v));
        if (Math.abs(v - motor.lastDrive) < 0.008) return;
        motor.lastDrive = v;
        const t = motor.c.currentTime, tc = 0.09, f = motor.base * (1 + 0.24 * v);
        motor.master.gain.setTargetAtTime(0.0001 + 0.10 * v, t, tc);
        motor.oscA.frequency.setTargetAtTime(f, t, tc);
        motor.oscB.frequency.setTargetAtTime(f * 2.0, t, tc);
        motor.oscC.frequency.setTargetAtTime(f * 4, t, tc);
        motor.whine.frequency.setTargetAtTime(240 + 80 * v, t, tc);
        motor.lp.frequency.setTargetAtTime(380 + 240 * v, t, tc);
      }

      function motorOff() {
        if (!motor) return;
        const m = motor, t = m.c.currentTime;
        m.master.gain.setTargetAtTime(0.0001, t, 0.08);
        const stopAt = t + 0.5;
        [m.oscA, m.oscB, m.oscC, m.whine, m.noise].forEach(n => { try { n.stop(stopAt); } catch (e) {} });
        m.noise.onended = () => m.nodes.forEach(n => n.disconnect());
        motor = null; running = false;
      }

      // 브레이크 개방 — 작고 짧은 기계식 클릭
      function brakeRelease() { setTractionBrake(true); const c = ac(), t = c.currentTime; clack(c, t, 700, 0.045, 0.09); }
      // 브레이크 체결 — 묵직한 쿵 + 클랙
      function brakeSet() { setTractionBrake(false); const c = ac(), t = c.currentTime; thump(c, t, 75, 0.09, 0.06); clack(c, t + 0.02, 520, 0.045, 0.09); }
      // 로프브레이크 파지 — 강철 턱이 로프를 무는 "쾅" (UCM 시연)
      function ropeBrakeBang() { const c = ac(), t = c.currentTime; thump(c, t, 48, 0.32, 0.5); clack(c, t, 340, 0.08, 0.35); clack(c, t + 0.015, 1400, 0.05, 0.18); hiss(c, t + 0.02, 0.35, 0.05, 2500); }
      // 승객이 에이프런에 부딪히는 가벼운 "쿵"
      function bump() { const c = ac(), t = c.currentTime; thump(c, t, 110, 0.12, 0.18); clack(c, t, 260, 0.05, 0.1); }
      function overspeedImpact(kind) {
        const c=ac(),t=c.currentTime;
        if(kind==='break'){clack(c,t,1700,.12,.22);thump(c,t,100,.18,.13);}
        if(kind==='pawl'){clack(c,t,1900,.07,.24);thump(c,t,640,.20,.09);}
        if(kind==='grip'){clack(c,t,460,.09,.17);thump(c,t,95,.17,.14);}
        if(kind==='rail'){thump(c,t,52,.36,.28);clack(c,t,850,.11,.23);hiss(c,t+.025,.38,.06,2100);}
      }

      function clack(c, t, freq, dur, amp) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
        const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp); bp.connect(g); g.connect(effects); src.start(t); src.stop(t + dur + 0.02);
        src.onended = () => [src, bp, g].forEach(n => n.disconnect());
      }
      function hiss(c, t, dur, amp, hp) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(effects); src.start(t); src.stop(t + dur + 0.02);
        src.onended = () => [src, f, g].forEach(n => n.disconnect());
      }
      function thump(c, t, freq, dur, amp) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(effects); o.start(t); o.stop(t + dur + 0.02);
        o.onended = () => [o, g].forEach(n => n.disconnect());
      }
      function duck(active) {
        if (ctx) effects.gain.setTargetAtTime(active ? ANNOUNCEMENT_EFFECT_VOLUME : EFFECT_VOLUME, ctx.currentTime, 0.12);
      }
      // 도어 타임라인: 열림 .24 + 1.15초, 닫힘 .95 + .24초 (CarDoor).
      function door(closing) {
        const c = ac(), t = c.currentTime, duration = closing ? 1.19 : 1.39;
        if (doorStop) doorStop();
        const noise = c.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
        const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 950; filter.Q.value = 0.5;
        const oscillator = c.createOscillator(); oscillator.frequency.value = closing ? 175 : 155;
        const toneGain = c.createGain(); toneGain.gain.value = 0.08;
        const gain = c.createGain(); gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.065, t + 0.18);
        gain.gain.setValueAtTime(0.065, t + duration - 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        noise.connect(filter); filter.connect(gain); oscillator.connect(toneGain); toneGain.connect(gain); gain.connect(effects);
        noise.start(t); oscillator.start(t); noise.stop(t + duration); oscillator.stop(t + duration);
        const stop = () => {
          gain.gain.cancelScheduledValues(c.currentTime);
          gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.015);
        };
        doorStop = stop;
        noise.onended = () => {
          [noise, filter, oscillator, toneGain, gain].forEach(n => n.disconnect());
          if (doorStop === stop) doorStop = null;
        };
      }
      function chime() {
        const c = ac(), now = c.currentTime;
        // 부드러운 장3도 하행 차임. 짧은 어택으로 클릭을 방지한다.
        [659.25, 523.25].forEach((frequency, index) => {
          const t = now + index * 0.25;
          [1, 2].forEach((harmonic, partial) => {
            const o = c.createOscillator(), g = c.createGain();
            o.frequency.value = frequency * harmonic;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(partial ? 0.009 : 0.075, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
            o.connect(g); g.connect(effects); o.start(t); o.stop(t + 0.7);
            o.onended = () => { o.disconnect(); g.disconnect(); };
          });
        });
      }
      function effect(play) { return { currentTime: 0, play() { try { play(); return Promise.resolve(); } catch (e) { return Promise.reject(e); } } }; }
      return { resume, motorOn, motorOff, setDrive, brakeRelease, brakeSet, duck, ropeBrakeBang, bump, overspeedImpact,
        doorOpen: effect(() => door(false)), doorClose: effect(() => door(true)), chime: effect(chime) };
    })();

    // 고정 한국어 신경망 음원 우선. 파일 재생 실패 시 기기 TTS로 대체한다.
    let activeAnnouncement = null;
    let announcementRequest = 0;
    function koreanAnnouncement(text, file) {
      const clip = new Audio(file);
      clip.preload = 'auto'; clip.volume = 1;
      return { currentTime: 0, play() {
        const request = ++announcementRequest;
        if (activeAnnouncement) { activeAnnouncement.pause(); activeAnnouncement.currentTime = 0; }
        window.speechSynthesis?.cancel();
        MACH.duck(false);
        activeAnnouncement = clip;
        clip.currentTime = 0;
        clip.onplaying = () => { if (request === announcementRequest) MACH.duck(true); };
        clip.onended = clip.onerror = () => {
          if (request === announcementRequest) { MACH.duck(false); activeAnnouncement = null; }
        };
        return clip.play().catch(() => {
        if (request !== announcementRequest) return;
        MACH.duck(false); activeAnnouncement = null;
        const synth = window.speechSynthesis;
        if (!synth) return Promise.resolve();
        const speak = () => {
          if (request !== announcementRequest) return;
          const voices = synth.getVoices().filter(v => /^ko(?:-|_)/i.test(v.lang));
          const voice = voices.find(v => /sunhi|순희|natural|neural/i.test(v.name))
            || voices.find(v => /google/i.test(v.name)) || voices[0];
          if (!voice) { console.warn('한국어 음성 엔진을 사용할 수 없습니다.'); return; }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice; utterance.lang = 'ko-KR';
          utterance.rate = 0.96; utterance.pitch = 1; utterance.volume = 1;
          utterance.onstart = () => { if (request === announcementRequest) MACH.duck(true); };
          utterance.onend = utterance.onerror = () => { if (request === announcementRequest) MACH.duck(false); };
          synth.cancel(); MACH.duck(false); synth.speak(utterance);
        };
        if (synth.getVoices().length) speak();
        else {
          const ready = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', ready); speak(); };
          const timer = setTimeout(() => synth.removeEventListener('voiceschanged', ready), 2000);
          synth.addEventListener('voiceschanged', ready, { once: true });
        }
        });
      }};
    }
    const snd = {
      doorOpen: MACH.doorOpen,
      doorClose: MACH.doorClose,
      doorVoice: koreanAnnouncement('문이 닫힙니다.', 'sound/announce_close.mp3'),
      chime: MACH.chime,
      departUp: koreanAnnouncement('올라갑니다.', 'sound/announce_up.mp3'),
      departDown: koreanAnnouncement('내려갑니다.', 'sound/announce_down.mp3'),
      floor: [
        koreanAnnouncement('1층입니다.', 'sound/announce_floor_1.mp3'),
        koreanAnnouncement('2층입니다.', 'sound/announce_floor_2.mp3'),
        koreanAnnouncement('3층입니다.', 'sound/announce_floor_3.mp3'),
        koreanAnnouncement('4층입니다.', 'sound/announce_floor_4.mp3')
      ]
    };

    /* 상태 카드 갱신. 호출부가 넘기는 색은 상태 칩의 톤(정상·안내·경고·고장)으로만 쓴다.
       v-dir 문구의 ▲/▼ 로 방향 화살표를, v-spd 숫자로 속도 막대(정격 130% = 가득)를 움직인다. */
    const STATUS_TONE = { '#3fb950': 'ok', '#8b949e': 'idle', '#f0883e': 'warn', '#f85149': 'bad', '#58a6ff': 'info' };
    function updateStatus(id, txt, col) {
      const e = document.getElementById(id); if (!e) return;
      e.textContent = txt;
      const card = document.getElementById('statusbar');
      if (id === 'v-dir') {
        if (col) e.dataset.tone = STATUS_TONE[col.toLowerCase()] || 'warn';
        if (card) card.dataset.dir = /▲|상승/.test(txt) ? 'up' : /▼|하강|낙하/.test(txt) ? 'down' : '';
      } else if (id === 'v-spd') {
        const v = parseFloat(txt) || 0, fill = document.getElementById('st-bar-fill');
        if (fill) fill.style.width = Math.min(100, v / (targetSpeed * 1.3) * 100).toFixed(1) + '%';
        if (card) card.toggleAttribute('data-over', v > targetSpeed + 0.5);
      }
    }

    function openDoors(cb) {
      if (DoorBypass.mode !== 'off') return;
      // 점검 운전 중에는 도어 오퍼레이터 회로가 차단된다 (착상 위치가 아닐 수 있음)
      if (insMode) { updateStatus('v-door', '점검운전 중 — 도어 조작 불가', '#f0883e'); return; }
      if (doorOpen || moving || estop || !CarDoor.canOpen()) return;
      currentState = ELEVATOR_STATE.DOOR_OPENING;
      doorOpen = true; updateStatus('v-door', '열리는 중', '#f0883e'); clearTimeout(autoTimer);
      snd.doorOpen.currentTime = 0; snd.doorOpen.play().catch(e=>console.log(e));
      CarDoor.open(() => {
        currentState = ELEVATOR_STATE.DOOR_OPEN;
        updateStatus('v-door', '완전 개방', '#3fb950');
        autoTimer = setTimeout(() => { if (doorOpen && !moving) closeDoors(); }, 3500);
        if (cb) cb();
      });
    }

    function closeDoors(cb) {
      if (DoorBypass.mode !== 'off') return;
      if (estop) return;
      if (!doorOpen) { if (cb) cb(); return; }
      if (currentState === ELEVATOR_STATE.DOOR_CLOSING) { CarDoor.afterClose(cb); return; }
      currentState = ELEVATOR_STATE.DOOR_CLOSING;
      clearTimeout(autoTimer); updateStatus('v-door', '닫히는 중', '#f0883e');
      const h = hatchDoors[curFloor];
      snd.doorVoice.currentTime = 0; snd.doorVoice.play().catch(e=>console.log(e));
      snd.doorClose.currentTime = 0; snd.doorClose.play().catch(e=>console.log(e));
      if (h?.keyRatio) setEmergencyKey(curFloor, 0);
      CarDoor.close(() => {
        doorOpen = false; updateStatus('v-door', '닫힘', '#3fb950');
        currentState = ELEVATOR_STATE.IDLE;
        if (cb) cb();
      });
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
      // 웜은 휠(=시브 축)과 25:1로 맞물린다. 절대각으로 맞춰 이물림 위상이 누적 오차 없이 유지된다.
      const tr = ud.traction;
      if (tr && mainSheaveGrp) tr.worm.rotation.z = tr.wormPerSheave * mainSheaveGrp.rotation.z;
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
      if (!DoorBypass.canInspect()) { insStop('바이패스 — 미우회 접점/카문 닫힘 확인'); return; }
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
      if (!PitLadder.secured) { updateStatus('v-dir', '피트 사다리 펼침 — 운행 차단', '#f85149'); return; }
      if (!insMode || estop || overspeedActive || insDir === dir) return;
      if (DoorBypass.mode !== 'off' && !DoorBypass.canInspect()) return;
      // 도어가 열려 있으면 먼저 닫고, 그때까지 버튼을 계속 누르고 있는 경우에만 출발
      if (DoorBypass.mode === 'off' && (doorOpen || gsap.isTweening(carDoorL.position))) {
        updateStatus('v-dir', '도어 폐쇄 중 — 계속 누르고 대기', '#f0883e');
        closeDoors(() => { if (insHold === dir) insStart(dir); });
        return;
      }
      if (DoorBypass.mode === 'off' && !DoorBypass.canInspect()) return;
      if (DoorBypass.mode !== 'off') DoorBypass.unlockAudio();
      if (insDir !== 0) gsap.ticker.remove(insTick); // 방향 전환

      insDir = dir; moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', dir > 0 ? '▲ 점검 상승 (서행)' : '▼ 점검 하강 (서행)', '#f0883e');
      MACH.resume(); MACH.brakeRelease(); MACH.motorOn(); MACH.setDrive(INSPECT_SPEED / 60);
      gsap.ticker.add(insTick);
    }

    function insStop(msg) {
      DoorBypass.stop();
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

    let inspectionResetting=false;
    async function resetInspections() {
      if(inspectionResetting||!CarDoor.state?.ready)return;
      inspectionResetting=true;
      const buttons=[...document.querySelectorAll('[data-inspection-reset]')];
      const surfaces=[document.getElementById('hud'),document.getElementById('hall-panel'),document.getElementById('pit-ladder-action'),document.getElementById('part-actions'),renderer.domElement].filter(Boolean);
      const labels=buttons.map(b=>b.textContent),inert=surfaces.map(e=>e.inert);
      buttons.forEach(b=>{b.disabled=true;b.textContent='리셋 중…';});
      surfaces.forEach(e=>e.inert=true);
      const wait=async test=>{
        const start=performance.now();
        while(!test()){
          if(performance.now()-start>60000)throw new Error('점검 복귀 시간 초과');
          await new Promise(resolve=>setTimeout(resolve,50));
        }
      };
      try {
        clearTimeout(autoTimer);insHold=0;insStop();
        // Fault demonstrations retain their own mechanical recovery sequence.
        if(UCMDemo.state.active){
          await wait(()=>!CarDoor.state.busy);
          UCMDemo.reset(document.getElementById('btn-ucm'));await wait(()=>!UCMDemo.state.active);
        }
        if(overspeedActive){
          await wait(()=>governorPhase==='tripped'||!overspeedActive);
          if(overspeedActive)resetGovernorFault(document.getElementById('btn-overspeed'));
          await wait(()=>!overspeedActive&&!moving);
          await new Promise(resolve=>setTimeout(resolve,350));
        }
        clearTimeout(autoTimer);
        gsap.killTweensOf(carGrp.position);gsap.killTweensOf(cwtGrp.position);
        moving=false;MACH.motorOff();MACH.brakeSet();
        estop=false;
        const stop=document.getElementById('btn-estop');
        stop.classList.remove('armed');stop.setAttribute('aria-pressed','false');stop.setAttribute('aria-label','비상정지');
        stop.querySelector('span').textContent=portraitHUD?.isPortrait()?'STOP':'정지';
        HallManual.resetAll();
        await new Promise(resolve=>CarDoor.close(resolve));
        doorOpen=false;currentState=ELEVATOR_STATE.IDLE;
        updateStatus('v-door','닫힘','#3fb950');
        DoorBypass.setMode('off');
        await wait(()=>!PitLadder.busy);
        if(PitLadder.deployed&&!PitLadder.toggle())throw new Error('사다리 복귀 실패');
        await wait(()=>PitLadder.secured);
        document.getElementById('ucm-brake').value='normal';renderSegments();
        setInspectionMode(false);
        const nf=insNearestFloor();
        if(!moving&&Math.abs(carGrp.position.y-FLOOR_Y[nf]-S.CAR_H/2)>.01)rescueToNearestFloor('점검 리셋 · 가까운 층 복귀',false);
        await wait(()=>!moving);
        clearTimeout(autoTimer);HallManual.resetAll();
        curFloor=insNearestFloor();syncAllIndicators(curFloor+1,'');updateStatus('v-floor',(curFloor+1)+'F','#3fb950');
        document.querySelectorAll('#fbtns .c-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.f)===curFloor));
        document.querySelectorAll('#fbtns .called').forEach(b=>b.classList.remove('called'));
        updateStatus('v-spd','0 m/min');updateStatus('v-dir','점검 전체 리셋 완료 · 자동운전','#3fb950');
      } catch(error) {
        console.error(error);updateStatus('v-dir','점검 리셋 미완료 · 다시 눌러 주세요','#f0883e');
      } finally {
        inspectionResetting=false;
        surfaces.forEach((e,i)=>e.inert=inert[i]);
        buttons.forEach((b,i)=>{b.disabled=false;b.textContent=labels[i];});
        document.getElementById('inspection-reset').textContent=portraitHUD?.isPortrait()?'리셋':'점검 전체 리셋';
      }
    }

    // 점검 스위치 ON/OFF. ON: 자동 운전 즉시 차단 / OFF: 착상 위치가 아니면 최근접 층 착상
    function setInspectionMode(on) {
      if (!on && (DoorBypass.mode !== 'off' || !DoorBypass.hallSecured())) { updateStatus('v-dir', '승장문 닫기·재잠금 및 BYPASS 해제 후 AUT 전환', '#f0883e'); return; }
      if(overspeedActive)return;
      if (insMode === on) return;
      insMode = on;
      insHold = 0;
      insStop();

      // 고장·점검 시트와 승장문 점검 패널의 운전 모드·▲▼ 가 같은 상태를 보인다.
      document.querySelectorAll('[data-ins-dir]').forEach(b => { b.disabled = !on; });
      document.querySelectorAll('[data-ins]').forEach(b => b.classList.toggle('mode-on', (b.dataset.ins === 'on') === on));

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
        if (off > 0.01 && !estop && !overspeedActive && PitLadder.secured) {
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
    const ovsDemo={stage:'rest',shot:null,trip:null,stop:null,fallTick:null,hidden:[],broken:false,breakProgress:0};
    function ovsStage(text){
      let el=document.getElementById('ovs-stage');
      if(!el){el=document.createElement('div');el.id='ovs-stage';el.setAttribute('role','status');
        el.style.cssText='position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:12px 16px;background:#142230ed;color:#eef5fa;border:1px solid #66859b;border-radius:9px;font:14px sans-serif;line-height:1.5;word-break:keep-all;z-index:30;pointer-events:none;text-align:center';document.body.appendChild(el);}
      el.hidden=false;el.textContent='OVS · 느린 동작  |  '+text;
      updateStatus('v-dir',text,'#f0883e');
    }
    function setOVSCutaway(enabled){
      if(!enabled){ovsDemo.hidden.forEach(([o,v])=>o.visible=v);ovsDemo.hidden=[];return;}
      if(ovsDemo.hidden.length)return;
      const keep=new Set(['carSafetyGear','carSafetyLinkage','CarGuideShoe_L_Lower','CarGuideShoe_R_Lower']);
      carGrp.traverse(o=>{
        if(!o.isMesh&&!o.isLine)return;
        let p=o,retained=false;while(p&&p!==carGrp){if(keep.has(p.name))retained=true;p=p.parent;}
        if(!retained){ovsDemo.hidden.push([o,o.visible]);o.visible=false;}
      });
    }
    // 주로프 파단은 카측 5본만 교체한다. 조속기 로프/클램프에는 손대지 않는다.
    function prepareOVSRopeBreak(){
      if(!ovsDemo.ropePieces){
        ovsDemo.ropeGroup=new THREE.Group();ovsDemo.ropeGroup.name='OVSMainRopeBreak';scene.add(ovsDemo.ropeGroup);
        ovsDemo.ropePieces=ropeObjs.map(r=>Array.from({length:4},()=>{
          const m=makeRopeDrop(r.ropeR,getWireRopeMat());ovsDemo.ropeGroup.add(m);return m;
        }));
      }
      ovsDemo.ropeGroup.visible=false;ovsDemo.breakProgress=0;
      ovsDemo.breakY=carGrp.position.y+S.CAR_H/2+CAR_ROPE_END_DY+1.05;
      ovsDemo.ropeVisibility=ropeObjs.map(r=>r.carDrop.visible);
    }
    function refreshOVSRopeBreak(){
      if(!ovsDemo.broken)return;
      const cy=carGrp.position.y+S.CAR_H/2+CAR_ROPE_END_DY,p=ovsDemo.breakProgress;
      const shape=wireRopeShape;
      ropeObjs.forEach((r,i)=>{
        const parts=ovsDemo.ropePieces[i],z=CAR_CTR_Z+r.hz;
        const bend=(i-2)*.045*p,whip=Math.sin(p*Math.PI)*.20;
        const a=[r.rx,shape.carTopY,shape.carTopZ],b=[r.hx,ovsDemo.breakY+.35,z];
        const c=[r.hx+bend,ovsDemo.breakY+.10+.18*p,z+whip];
        const d=[r.hx-bend,cy+1.05-.40*p,z-whip-.06*p],e=[r.hx,cy+.48,z],f=[r.hx,cy,z];
        [[a,b],[b,c],[d,e],[e,f]].forEach(([top,bot],j)=>setRopeDrop(parts[j],...top,...bot,0,-Math.hypot(top[0]-bot[0],top[1]-bot[1],top[2]-bot[2])/WIRE_ROPE_UV_LEN));
      });
    }
    function restoreOVSRopes(){
      ovsDemo.breakTween?.kill();ovsDemo.broken=false;
      if(ovsDemo.ropeGroup)ovsDemo.ropeGroup.visible=false;
      ropeObjs.forEach((r,i)=>{if(ovsDemo.ropeVisibility)r.carDrop.visible=ovsDemo.ropeVisibility[i];});
    }
    // 카메라를 한 장면씩 사용한다. 세로 화면에서도 기구가 잘리지 않게 거리를 보정한다.
    function ovsCamera(shot,duration=1,onDone){
      ovsDemo.shot=shot;gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
      const d=_deviceWorld(),g=_govWorld(),target=new THREE.Vector3(),offset=new THREE.Vector3();
      if(shot==='shaft'){target.set(0,carGrp.position.y+.9,CAR_CTR_Z);offset.set(8.2,1.1,4.8);}
      if(shot==='governor'){target.copy(g).add(new THREE.Vector3(-.02,.02,0));offset.set(.70,.15,.35);}
      if(shot==='linkage'){target.copy(d).add(new THREE.Vector3(-.45,.08,0));offset.set(-.15,.80,-2.55);}
      if(shot==='safety'){target.copy(d);offset.set(-.42,-.24,-.52);}
      if(shot==='linkage'&&camera.aspect<.8){target.copy(d).add(new THREE.Vector3(.08,.06,0));offset.set(-.10,.40,-1.25);}
      offset.multiplyScalar(Math.max(1,(shot==='shaft'?.68:.95)/camera.aspect));
      _camTo(target.x+offset.x,target.y+offset.y,target.z+offset.z,target.x,target.y,target.z,duration,'power2.inOut',onDone);
    }
    // 불꽃은 레일 마찰 위치에만 짧게 표시한다. 버퍼를 재사용하며 프레임 안에서 생성하지 않는다.
    function ovsRailImpact(){
      MACH.overspeedImpact('rail');
      if(!ovsDemo.sparks){
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(32*6),3).setUsage(THREE.DynamicDrawUsage));
        const material=new THREE.LineBasicMaterial({color:0xffbc4b,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
        ovsDemo.sparks=new THREE.LineSegments(geometry,material);ovsDemo.sparks.frustumCulled=false;scene.add(ovsDemo.sparks);
      }
      const sparks=ovsDemo.sparks,origin=_deviceWorld(),base=camera.position.clone(),state={t:0};
      sparks.visible=true;sparks.position.copy(origin);
      ovsDemo.impact?.kill();
      ovsDemo.impact=gsap.to(state,{t:1,duration:.55,ease:'none',onUpdate:()=>{
        const t=state.t,positions=sparks.geometry.attributes.position;
        for(let i=0;i<32;i++){
          const a=i*2.39996,speed=.12+(i%7)*.025,tail=Math.max(0,t-.12);
          for(let j=0;j<2;j++){const u=j?t:tail;positions.setXYZ(i*2+j,Math.cos(a)*speed*u,Math.sin(a)*speed*u-.20*u*u,Math.sin(i*4.7)*speed*u);}
        }
        positions.needsUpdate=true;sparks.material.opacity=1-t;
        const shake=.014*(1-t)*(1-t);camera.position.copy(base);camera.position.x+=Math.sin(t*97)*shake;camera.position.y+=Math.sin(t*123)*shake;
      },onComplete:()=>{sparks.visible=false;camera.position.copy(base);}});
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
    // 권상기 주도르래 축 중심(월드). 절개·관찰 카메라 기준점.
    function _tractionWorld() {
      const u = mrGrp.userData;
      return { x: 0, y: u.mainY, z: u.mainZ };
    }

    function _govWorld() { const v = new THREE.Vector3(); (governorWheelGrp || mrGrp).getWorldPosition(v); return v; }
    function _deviceWorld() {
      // 카 우측 하단 세이프티 기어 웨지/작동 샤프트 월드 좌표
      carGrp.updateMatrixWorld(true);
      return carGrp.localToWorld(new THREE.Vector3(S.CAR_W / 2 + 0.03, -S.CAR_H / 2 - 0.16, 0.04));
    }

    function startOverspeedFault(btn) {
      if (!PitLadder.secured) { updateStatus('v-dir', '피트 사다리 펼침 — 운행 차단', '#f85149'); return; }
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
      MACH.resume(); MACH.motorOff();

      // 먼저 카와 주로프가 함께 보이는 승강로 측면. 이 시점에는 아직 파단하지 않는다.
      _saveCam();
      ovsDemo.stage='preparing';prepareOVSRopeBreak();
      ovsStage('① 승강로 측면 · 주로프와 카를 확인합니다.');

      // 폭주 낙하 — 완만한 가속 물리 적분(gsap.ticker). 정격 50%로 하강 시작 →
      // 약 1.3~1.5개 층 미끄러지며 가속 → 정격 130%(트립 임계) 도달 시 조속기 슬로우 작동.
      const vTrip = targetSpeed * 1.3;        // 트립 임계 (m/min)
      const vTripMs = vTrip / 60;             // m/s
      const yFloor1 = ty;                     // 최하층 카 정위치 Y
      let v = (targetSpeed * 0.5) / 60;       // 관찰용 느린 낙하. 실제 중력 가속 시간과 다르다.
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
        // 낙하를 따라가되 파단된 상단 로프도 시야에 남긴다.
        camera.position.y+=deltaY*.6;controls.target.y+=deltaY*.6;
        let curF = 1;
        for (let i = FLOORS - 1; i >= 0; i--) { if (carGrp.position.y >= FLOOR_Y[i]) { curF = i + 1; break; } }
        syncAllIndicators(curF, '↓');
        const vmm = v * 60; // m/min
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
      ovsCamera('shaft',1.25,()=>{
        ovsDemo.stage='rope-break';ovsDemo.broken=true;ovsDemo.ropeGroup.visible=true;
        ropeObjs.forEach(r=>r.carDrop.visible=false);refreshOVSRopeBreak();
        MACH.overspeedImpact('break');ovsStage('① 주로프 파단 · 조속기 로프는 연결된 상태입니다.');
        ovsDemo.breakTween=gsap.to(ovsDemo,{breakProgress:1,duration:.55,ease:'power2.out',onUpdate:refreshOVSRopeBreak});
        ovsDemo.pending=gsap.delayedCall(.65,()=>{
          ovsDemo.stage='runaway';ovsStage('② 카 자유낙하 · 연결된 조속기 로프가 휠을 돌립니다.');
          gsap.ticker.add(fallTick);ovsDemo.fallTick=fallTick;
        });
      });
    }

    function onGovernorOverspeed(spinDir, btn) {
      moving=true;
      ovsDemo.stage='machine-room';ovsStage('③ 기계실 · 조속기 작동을 확대합니다.');
      ovsCamera('governor',1.15,()=>runGovernorSequence(spinDir,btn));
    }

    function runGovernorSequence(spinDir,btn){
      // Electrical cut-off is visible first; mechanical motion continues in slow time.
      let previousWheel=govHandles().wheel.rotation.z;
      ovsDemo.trip=governorTrip(spinDir,()=>{
        estop=true;moving=false;currentState=ELEVATOR_STATE.ESTOP;
        ovsDemo.stage='rope-locked';MACH.overspeedImpact('grip');
        ovsStage('④ 캐치슈가 뒤쪽 조속기 로프를 꽉 잡았습니다.');
        ovsDemo.pending=gsap.delayedCall(.85,()=>{
          setOVSCutaway(true);ovsDemo.stage='linkage-view';
          ovsStage('⑤ 고정된 로프 → 카의 하강이 링크를 당깁니다.');
          ovsCamera('linkage',1.15,()=>engageDeviceStop(spinDir,btn,{onComplete:()=>{
            ovsStage('⑥ 비상정지 완료 · 네 쐐기가 레일을 파지했습니다. RST로 시연을 복귀합니다.');
            ovsDemo.stage='stopped';controls.enabled=true;
          }}));
        });
      },{
        onStage:stage=>{
          ovsDemo.stage=stage;
          const captions={centrifugal:'과속 감지 · 원심 진자가 벌어집니다.',
            electrical:'과속 스위치 타격 · 접점이 열리고 레버가 떨어집니다.',
            pawl:'쐐기가 톱니에 꽉 걸려 캐치 레버를 작동시킵니다.',
            'rope-grip':'캐치슈가 조속기 로프를 눌러 고정합니다.'};
          ovsStage(captions[stage]);
          if(stage==='pawl')MACH.overspeedImpact('pawl');
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
      let impacted=false;
      const apply=()=>{
          const distance=Math.max(0,Math.min(stroke,drive.distance));
          carGrp.position.y=startY-distance;
          const deltaY=carGrp.position.y-previousY;previousY=carGrp.position.y;cwtGrp.position.y-=deltaY;
          spinTractionSheaves(deltaY);
          const half=linkage.dimensions.half,ratio=distance/stroke;
          const p=(Math.asin(-Math.sin(half)+2*Math.sin(half)*ratio)+half)/(2*half);
          sg.shaft.rotation.x=SG_TRIP_ROT*p;
          refreshRopes();refreshGovernorRope();
          if(p>.90&&!impacted){impacted=true;ovsRailImpact();}
      };
      const tween=gsap.timeline({onComplete:()=>{
          MACH.brakeSet();updateStatus('v-spd','0 m/min','#f0883e');
          btn.disabled=false;btn.textContent='RST';options.onComplete?.();
      }});
      ovsDemo.stage='linkage';
      tween.to(drive,{distance:stroke*.32,duration:1.45,ease:'power1.in',onUpdate:apply});
      tween.call(()=>{ovsDemo.stage='safety-view';ovsStage('⑥ 인상 핀이 쐐기를 올립니다. 레일 파지 순간을 봅니다.');ovsCamera('safety',.95);});
      tween.to({}, {duration:1.05});
      tween.call(()=>{ovsDemo.stage='wedges';});
      tween.to(drive,{distance:stroke,duration:.85,ease:'power2.in',onUpdate:apply});
      tween.to({}, {duration:.60});
      ovsDemo.stop=tween;return tween;
    }

    function resetGovernorFault(btn) {
      btn.disabled = true;
      ovsDemo.stage='resetting';ovsDemo.shot=null;setOVSCutaway(false);
      if(ovsDemo.fallTick){gsap.ticker.remove(ovsDemo.fallTick);ovsDemo.fallTick=null;}
      ovsDemo.trip?.kill();ovsDemo.stop?.kill();ovsDemo.pending?.kill();ovsDemo.impact?.kill();
      if(ovsDemo.sparks)ovsDemo.sparks.visible=false;
      restoreOVSRopes();
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
      if (!PitLadder.secured) { updateStatus('v-dir', '피트 사다리 펼침 — 운행 차단', '#f85149'); return; }
      if (!DoorBypass.hallSecured()) return;
      if (DoorBypass.mode !== 'off') return;
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
      if (!PitLadder.secured) { updateStatus('v-dir', '피트 사다리 펼침 — 운행 차단', '#f85149'); return; }
      if (DoorBypass.mode !== 'off') return;
      if(overspeedActive)return;
      if (insMode) { updateStatus('v-dir', '점검운전 중 — 자동 호출 무효', '#f0883e'); return; }
      if (moving || estop || fIdx === curFloor) return;
      if (doorOpen || gsap.isTweening(carDoorL.position)) { closeDoors(() => moveElevator(fIdx)); return; }
      if (!CarDoor.secured() || !DoorBypass.hallSecured()) { updateStatus('v-door', '카문·승장문 닫힘 및 잠금 확인 대기', '#f0883e'); return; }

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
      portraitHUD?.close();
      PartActions.close();
      document.querySelectorAll('.sheet.open').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('[data-menu].active').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
    }

    // 세로 폰은 기존 컨트롤 자체를 옮긴다. ID/이벤트/고장 복귀 상태를 복제하지 않는다.
    let portraitHUD = null;
    function bindPortraitHUD() {
      const media = matchMedia('(max-width: 600px) and (orientation: portrait)');
      const hud = document.getElementById('hud'), dock = document.getElementById('mobile-tools');
      const detail = document.getElementById('mobile-detail'), content = document.getElementById('mobile-detail-content');
      const visibility = document.getElementById('mobile-visibility');
      const menuButton = document.querySelector('[data-menu="dd-inst"]');
      const slots = new Map();
      const remember = node => {
        if (!slots.has(node)) { const marker = document.createComment('portrait-control-home'); node.before(marker); slots.set(node, marker); }
        return node;
      };
      const actions = ['hall-toggle', 'inspection-reset'].map(id => remember(document.getElementById(id)));
      const panels = {
        mode: remember(document.querySelector('#dd-inst .mode-row')),
        bypass: remember(document.getElementById('bypass-mode').closest('.field'))
      };
      const labels = new Map();
      const shortLabel = (node, text) => { if (!labels.has(node)) labels.set(node, node.textContent); node.textContent = text; };
      const restore = node => slots.get(node).after(node);
      const closeDetail = () => {
        Object.values(panels).forEach(restore);
        detail.hidden = true;
        dock.querySelectorAll('[data-mobile-panel]').forEach(b => b.setAttribute('aria-expanded', 'false'));
        // 점검 버튼을 누른 상태에서 패널을 닫거나 회전해도 운전을 지속하지 않는다.
        if (typeof insHold !== 'undefined' && insHold) { insHold = 0; insStop(); }
      };
      const close = () => { closeDetail(); dock.hidden = true; };
      const sync = () => {
        closeAllMenus();
        hud.classList.remove('tools-hidden');
        document.body.classList.remove('portrait-tools-hidden');
        visibility.setAttribute('aria-pressed', 'false');
        visibility.setAttribute('aria-label', '도구 숨기기'); visibility.title = '도구 숨기기';
        document.getElementById('mobile-eye-slash').style.display = '';
        if (media.matches) {
          menuButton.setAttribute('aria-controls', 'mobile-tools');
          actions.forEach(node => dock.insertBefore(node, dock.querySelector('[data-mobile-panel="bypass"]')));
          shortLabel(actions[0], 'KEY'); shortLabel(actions[1], '리셋');
          for (const [id, text] of [['btn-aut','AUT'],['btn-ins','INS']]) shortLabel(document.getElementById(id),text);
          for (const [id, values] of [['bypass-mode',['OFF','HALL','CAR']]]) {
            document.querySelectorAll(`.seg[data-for="${id}"] button`).forEach((node,i) => shortLabel(node,values[i]));
          }
          shortLabel(document.querySelector('#btn-estop span'), estop ? 'RESET' : 'STOP');
        } else {
          menuButton.setAttribute('aria-controls', 'dd-inst');
          actions.forEach(restore);
          // AUT/INS의 small 마크업까지 원래 그대로 복원한다.
          labels.forEach((text,node) => { node.textContent = text; }); labels.clear();
          document.getElementById('btn-aut').innerHTML = '<small>AUT</small>자동';
          document.getElementById('btn-ins').innerHTML = '<small>INS</small>점검';
          document.querySelector('#btn-estop span').textContent = estop ? '해제' : '정지';
        }
      };
      dock.querySelectorAll('[data-mobile-panel]').forEach(button => button.addEventListener('click', () => {
        const wasOpen = button.getAttribute('aria-expanded') === 'true';
        closeDetail();
        if (wasOpen) return;
        content.appendChild(panels[button.dataset.mobilePanel]);
        document.getElementById('mobile-detail-title').textContent = button.textContent;
        detail.hidden = false; button.setAttribute('aria-expanded','true'); renderSegments();
      }));
      document.getElementById('mobile-detail-close').addEventListener('click', closeDetail);
      visibility.addEventListener('click', () => {
        const hide = !hud.classList.contains('tools-hidden'); closeAllMenus();
        document.getElementById('hall-dismiss')?.click();
        hud.classList.toggle('tools-hidden',hide); visibility.setAttribute('aria-pressed',String(hide));
        document.body.classList.toggle('portrait-tools-hidden',hide);
        visibility.setAttribute('aria-label',hide ? '도구 보이기' : '도구 숨기기'); visibility.title = visibility.getAttribute('aria-label');
        document.getElementById('mobile-eye-slash').style.display = hide ? 'none' : '';
      });
      actions.forEach(node => { if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label',node.title); });
      media.addEventListener('change',sync);
      const api = { close, isPortrait: () => media.matches, toggle: () => {
        const wasOpen = !dock.hidden; closeAllMenus();
        if (!wasOpen) { dock.hidden = false; menuButton.classList.add('active'); menuButton.setAttribute('aria-expanded','true'); renderSegments(); }
      }};
      portraitHUD = api; sync(); return api;
    }

    /* select 원본(값·change 이벤트는 기존 코드가 그대로 쓴다)을 한 번에 누르는 세그먼트 버튼으로 보여준다.
       DoorBypass 처럼 코드가 value 를 직접 바꾸는 경우를 위해 시트를 열 때·누른 뒤 다시 그린다. */
    function renderSegments() {
      document.querySelectorAll('.seg[data-for]').forEach(seg => {
        const select = document.getElementById(seg.dataset.for);
        if (!select) return;
        if (!seg.children.length) {
          [...select.options].forEach(o => {
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.value = o.value; b.textContent = o.textContent;
            b.addEventListener('click', () => {
              if (select.value === o.value) return;
              select.value = o.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              renderSegments();
            });
            seg.appendChild(b);
          });
          select.addEventListener('change', renderSegments);
        }
        [...seg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === select.value)));
      });
    }

    // 처음 한 번만 보이는 조작 안내. 캔버스를 만지거나 7초가 지나면 사라진다(설정 시트에 상시 안내).
    function showControlHint() {
      const hint = document.getElementById('hint'); if (!hint) return;
      const touch = matchMedia('(hover: none)').matches;
      hint.textContent = touch
        ? '부품을 두 번 탭하면 가까이 · 두 손가락 확대·이동'
        : '드래그 회전 · 휠 확대 · 우클릭 이동 · 부품 더블클릭하면 가까이';
      hint.classList.add('show');
      const hide = () => hint.classList.remove('show');
      setTimeout(hide, 7000);
      renderer.domElement.addEventListener('pointerdown', hide, { once: true });
    }

    function bindUIEvents() {
      // 시트는 레일 버튼 재탭·다른 버튼·✕·Esc 로만 닫힌다 (시연 중 사라짐 방지)
      document.querySelectorAll('[data-menu]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (portraitHUD?.isPortrait()) document.getElementById('hall-dismiss')?.click();
          if (btn.dataset.menu === 'dd-inst' && portraitHUD?.isPortrait()) { portraitHUD.toggle(); return; }
          const menu = document.getElementById(btn.dataset.menu);
          const wasOpen = menu.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) {
            menu.classList.add('open'); btn.classList.add('active'); btn.setAttribute('aria-expanded', 'true');
            renderSegments();
          }
        });
      });
      document.querySelectorAll('.sheet [data-close]').forEach(b => b.addEventListener('click', closeAllMenus));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllMenus(); });
      renderSegments();
      bindPortraitHUD();
      PartActions.bind();
      showControlHint();
      // 세로 폰에서는 승장문 점검 패널이 같은 자리(운행바 위)에 뜨므로 고장 시트를 닫아 준다.
      document.getElementById('hall-toggle')?.addEventListener('click', () => {
        if (matchMedia('(max-width: 600px)').matches) closeAllMenus();
        renderSegments();
      });

      document.getElementById('speed-select').addEventListener('change', e => {
        targetSpeed = parseInt(e.target.value);
        updateBuffers();
      });

      document.getElementById('fbtns').addEventListener('click', e => {
        const btn = e.target.closest('.c-btn');
        if (!btn) return;
        moveElevator(parseInt(btn.dataset.f));
        // 호출 등록 표시 — 도착(또는 정지)하면 꺼진다. 도착층 점등(active)은 moveElevator 가 한다.
        if (!btn.classList.contains('active') && (moving || gsap.isTweening(carDoorL.position))) {
          document.querySelectorAll('#fbtns .c-btn.called').forEach(b => b.classList.remove('called'));
          btn.classList.add('called');
          const clear = setInterval(() => {
            if (moving || gsap.isTweening(carDoorL.position)) return;
            btn.classList.remove('called'); clearInterval(clear);
          }, 250);
        }
      });
      document.getElementById('btn-open').addEventListener('click', () => { if (!moving && !estop) openDoors(); });
      document.getElementById('btn-close').addEventListener('click', () => { if (!moving) closeDoors(); });
      // 개문발차(UCM) 시연 — 로프브레이크 정상/미작동/미설치 (js/ucm-demo.js)
      document.getElementById('btn-ucm')?.addEventListener('click', e => {
        UCMDemo.toggle(e.currentTarget);
        if (UCMDemo.state.active) closeAllMenus();   // 시연 화면을 가리지 않게
      });

      /* ── 점검(수동) 운전 ── AUT/INS 토글 + ▲▼ 홀드 투 런 ── */
      document.querySelectorAll('[data-inspection-reset]').forEach(b=>b.addEventListener('click',resetInspections));
      document.querySelectorAll('[data-ins]').forEach(b => {
        b.addEventListener('click', () => setInspectionMode(b.dataset.ins === 'on'));
        b.classList.toggle('mode-on', b.dataset.ins === 'off');   // 기동 시 자동운전
      });

      document.querySelectorAll('[data-ins-dir]').forEach(b => {
        const dir = Number(b.dataset.insDir);
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

      const estopBtn = document.getElementById('btn-estop');
      const paintEstop = () => {
        estopBtn.classList.toggle('armed', estop);
        estopBtn.setAttribute('aria-pressed', String(estop));
        estopBtn.setAttribute('aria-label', estop ? '비상정지 해제' : '비상정지');
        estopBtn.querySelector('span').textContent = portraitHUD?.isPortrait() ? (estop ? 'RESET' : 'STOP') : (estop ? '해제' : '정지');
      };
      estopBtn.addEventListener('click', e => {
        if (overspeedActive) { updateStatus('v-dir', '조속기 트립 — 고장·점검에서 OVS 복귀', '#f85149'); return; }
        estop = !estop;
        paintEstop();
        if (estop) {
          insHold = 0; insStop();
          gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position); moving = false;
          CarDoor.pause();
          MACH.motorOff(); MACH.brakeSet();
          currentState = ELEVATOR_STATE.ESTOP;
          updateStatus('v-dir', '■ 비상정지', '#f85149'); updateStatus('v-spd', '0 m/min');
        } else {
          updateStatus('v-dir', '정지 대기', '#8b949e');
          const doorAction=CarDoor.resume();
          currentState=doorAction==='open'?ELEVATOR_STATE.DOOR_OPENING:doorAction==='close'?ELEVATOR_STATE.DOOR_CLOSING:doorOpen?ELEVATOR_STATE.DOOR_OPEN:ELEVATOR_STATE.IDLE;
        }
      });

      const ovBtn = document.getElementById('btn-overspeed');
      if (ovBtn) ovBtn.addEventListener('click', () => {
        if (!overspeedActive) { startOverspeedFault(ovBtn); if (overspeedActive) closeAllMenus(); } // 시연 화면을 가리지 않게
        else if (governorPhase === 'tripped') resetGovernorFault(ovBtn);
      });
      // 고장 래치 복귀 버튼 — OVS·UCM 버튼이 RST 를 표시하는 동안만 상태 카드 아래에 띄우고, 누르면 그 버튼을 누른다.
      const resetPill = document.getElementById('fault-reset');
      const latchSources = ['btn-overspeed', 'btn-ucm'].map(id => document.getElementById(id)).filter(Boolean);
      const syncResetPill = () => {
        const src = latchSources.find(b => b.textContent.trim() === 'RST');
        resetPill.hidden = !src;
        document.body.classList.toggle('fault-latched', !!src);   // 승장문 패널을 복귀 버튼 아래로 내린다
        if (!src) return;
        resetPill.disabled = src.disabled; resetPill.dataset.src = src.id;
        resetPill.querySelector('span').textContent = src.id === 'btn-ucm' ? '개문발차 복귀' : '과속 복귀';
      };
      latchSources.forEach(b => new MutationObserver(syncResetPill).observe(b, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['disabled'] }));
      resetPill.addEventListener('click', () => document.getElementById(resetPill.dataset.src)?.click());

      // 전체 보기 — 더블클릭으로 가까이 간 화면을 처음 운행 시점으로 되돌린다(부품별 카메라 프리셋은 두지 않는다).
      document.getElementById('c-shaft').addEventListener('click', () => {
        if (overspeedActive || !controls.enabled) return; // 자동 시연·복귀 카메라를 보호한다.
        controls.minDistance = MANUAL_CAMERA.minDistance;
        camera.near = MANUAL_CAMERA.near;
        camera.updateProjectionMatrix();
        gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
        const home = overviewCameraPose();
        moveCam(...home.position, ...home.target, false);
      });
      // 권상기 내부: 기어 케이스 절개 조각을 빼내 웜·휠 이물림과 오일 레벨을 보여준다.
      const cutBtn = document.getElementById('tm-cutaway');
      cutBtn.addEventListener('click', () => {
        const on = !mrGrp.userData.traction.cutaway;
        setTractionCutaway(on);
        cutBtn.classList.toggle('active', on);
        cutBtn.setAttribute('aria-pressed', String(on));
        if (on && !overspeedActive && controls.enabled) {
          const m = _tractionWorld(), wx = TRACTION_MACHINE_MOUNT.wheelX;
          // 절개면은 -X(좌측 벽 쪽). 세로 화면에서 물러나도 벽 라이닝 앞에서 멈춘다.
          const wallGap = (m.x + wx) - (-(S.SHAFT_W / 2) + MR_LINING_T) - 0.12;
          const d = Math.min(wallGap, 0.95 * Math.max(1, 0.9 / camera.aspect));
          controls.minDistance = MANUAL_CAMERA.minDistance;
          gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
          moveCam(m.x + wx - d, m.y + 0.05 + 0.26 * d, m.z + 0.02 + 0.30 * d, m.x + wx, m.y + 0.05, m.z + 0.02, false);
        }
      });
      const mascotBtn = document.getElementById('c-mascot');
      mascotBtn.addEventListener('click', () => {
        const on = !Mascot.isVisible();
        Mascot.setVisible(on);
        mascotBtn.classList.toggle('active', on);
        mascotBtn.setAttribute('aria-pressed', String(on));
      });
      document.getElementById('c-background').addEventListener('click', () => {
        setDetailedBackground(!outdoorPresentation.detailed);
      });

      // Click the landing triangle key: turn the cam, lift the latch, open that floor.
      const keyRay = new THREE.Raycaster();
      const keyNdc = new THREE.Vector2();
      let keyPtr = null;
      const canvas = renderer.domElement;
      const ignoreCameraGesture = bindCameraFocus(canvas);
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        keyPtr = { x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener('pointerup', e => {
        if (e.button !== 0 || !keyPtr) return;
        const dragged = Math.hypot(e.clientX - keyPtr.x, e.clientY - keyPtr.y) > 6;
        keyPtr = null;
        if (dragged || moving || ignoreCameraGesture(e)) return;
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
        HallManual.pick(fIdx);
      });
    }

    // Tap classification is shared with the triangle key; pinch/drag must never activate it.
    function bindCameraFocus(canvas) {
      const pointers = new Map(), ignored = new WeakSet();
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      let lastTap = null;
      const cancelMotion = () => {
        if (overspeedActive || !controls.enabled) return;
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(controls.target);
      };
      controls.addEventListener('start', cancelMotion);
      controls.addEventListener('change', updateManualCameraNear);
      updateManualCameraNear();
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0) { lastTap = null; return; }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: performance.now(), invalid: false });
        if (pointers.size > 1) {
          pointers.forEach(p => p.invalid = true);
          lastTap = null;
        }
      }, true);
      canvas.addEventListener('pointermove', e => {
        const p = pointers.get(e.pointerId);
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.invalid = true;
      }, true);
      const clear = () => { pointers.clear(); lastTap = null; };
      canvas.addEventListener('pointercancel', clear, true);
      window.addEventListener('blur', clear);
      canvas.addEventListener('pointerup', e => {
        const p = pointers.get(e.pointerId);
        pointers.delete(e.pointerId);
        const now = performance.now();
        if (!p || p.invalid || now - p.time > 450 || overspeedActive || !controls.enabled) {
          ignored.add(e); lastTap = null; return;
        }
        const rect = canvas.getBoundingClientRect();
        ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        ray.setFromCamera(ndc, camera);
        // Preserve the existing immediate single-tap emergency-key action.
        const keys = hatchDoors.map(h => h.right.userData.triKey?.group).filter(Boolean);
        if (ray.intersectObjects(keys, true).length) { lastTap = null; return; }
        const previous = lastTap;
        lastTap = { x: e.clientX, y: e.clientY, time: now, type: e.pointerType };
        if (!previous || previous.type !== e.pointerType || now - previous.time > 350 ||
            Math.hypot(previous.x - e.clientX, previous.y - e.clientY) > 24) return;
        lastTap = null;
        const meshes = [];
        scene.traverseVisible(o => {
          if (!o.isMesh) return;
          for (let parent = o; parent; parent = parent.parent) {
            if (['outdoorGround', 'outdoorBackground', 'outdoorLandscape', 'skyDome'].includes(parent.name)) return;
          }
          meshes.push(o);
        });
        const hit = ray.intersectObjects(meshes, false).find(h => {
          const material = Array.isArray(h.object.material) ? h.object.material[h.face.materialIndex] : h.object.material;
          return material?.visible && material.opacity > 0 && camera.layers.test(h.object.layers);
        });
        if (!hit) return;
        ignored.add(e);
        cancelMotion();
        const distance = THREE.MathUtils.clamp(hit.distance * 0.3, 0.12, 2);
        const position = camera.position.clone().sub(hit.point).normalize().multiplyScalar(distance).add(hit.point);
        position.y = Math.max(Y0 + 0.35, position.y);
        controls.minDistance = MANUAL_CAMERA.minDistance;
        camera.near = MANUAL_CAMERA.near;
        camera.updateProjectionMatrix();
        gsap.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: 0.75, ease: 'power2.inOut' });
        gsap.to(controls.target, { x: hit.point.x, y: hit.point.y, z: hit.point.z, duration: 0.75, ease: 'power2.inOut', onUpdate: () => controls.update() });
      }, true);
      return e => ignored.has(e);
    }

    function overviewCameraPose() {
      if (!matchMedia('(max-width: 600px) and (orientation: portrait)').matches) {
        const y = Y0 + TOTAL_H * 0.4;
        return { position: [18, y, 21], target: [0, y, 0] };
      }
      // 기계실 지붕과 피트를 상태 카드 아래의 관찰 공간 안에 함께 담는다.
      const height = TOTAL_H + S.MR_H + 0.6;
      const y = Y0 + height * 0.5;
      const distance = Math.max(Math.hypot(18, 21), height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.68));
      const scale = distance / Math.hypot(18, 21);
      return { position: [18 * scale, y, 21 * scale], target: [0, y, 0] };
    }

    function moveCam(cx, cy, cz, tx, ty, tz, fitWidth = true) {
      // 세로 화면에서는 부품의 좌우가 잘리지 않도록 같은 시선 방향으로 물러난다.
      const distanceScale = fitWidth ? Math.max(1, 0.9 / camera.aspect) : 1;
      cx = tx + (cx - tx) * distanceScale;
      cy = ty + (cy - ty) * distanceScale;
      cz = tz + (cz - tz) * distanceScale;
      gsap.to(camera.position, { x: cx, y: cy, z: cz, duration: 1.2, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 1.2, onUpdate: () => controls.update() });
    }

    // makeDraggable(구 플로팅 메뉴 버튼용)은 상단 바 개편으로 제거됨
