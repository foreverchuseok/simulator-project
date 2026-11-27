/* 균형체인(보상체인) 이중체결 비교 시연 (2026-11-27)
   - 근거: [별표22] 엘리베이터 안전기준 9.6.4 (추가적인 보호조치 — 체인 연결부와 다른 부재에 연결)
           2014년 불만제로 E79 균형체인 추락 사고 사례 (균형추 하부 고정부 이탈)
   - 비교 2모드 (공통: 노란 브라켓 용접부 파단 → 브라켓·U-볼트·1번 링크가 한 덩어리로 이탈):
       dual   (이중체결 · 정상) : 빔 웹을 관통한 안전 와이어로프에 2번 링크가 걸려 체인 추락 방지.
       single (미설치 · 사고)   : 붙잡을 곳이 없어 브라켓째 12m 균형체인이 승강로로 추락. */
const CompChainDemo = (() => {
  const state = { active: false, stage: 'rest', mode: 'dual', time: 0 };
  const point = new THREE.Vector3();
  let button, panel, caption, ending, saved, jobs = [], warningStop = null, shake = null;
  let lastFrameMs = 0, crashSoundPlayed = false, dustGrp = null;

  const own = t => { jobs.push(t); return t; };
  const later = (s, fn) => own(gsap.delayedCall(s, () => { if (state.active && state.stage !== 'resetting') fn(); }));
  const say = text => {
    if (!caption) return;
    caption.textContent = text;
    caption.hidden = !text;
    if (text) updateStatus('v-dir', text.split('\n')[0], state.mode === 'single' && ['falling', 'done'].includes(state.stage) ? '#f85149' : '#f0883e');
  };

  function buildDust() {
    if (dustGrp) return;
    dustGrp = new THREE.Group();
    dustGrp.name = 'compChainCrashDust';
    dustGrp.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.45, depthWrite: false });
    const geo = new THREE.SphereGeometry(0.14, 10, 8);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      const a = (i / 10) * Math.PI * 2;
      m.userData = { vx: Math.cos(a) * (0.45 + (i % 3) * 0.25), vy: 0.35 + (i % 4) * 0.18, vz: Math.sin(a) * (0.45 + (i % 2) * 0.25) };
      dustGrp.add(m);
    }
    scene.add(dustGrp);
  }

  function triggerDust(x, y, z) {
    buildDust();
    dustGrp.visible = true;
    dustGrp.position.set(x, y, z);
    dustGrp.children.forEach(m => {
      m.position.set(0, 0, 0);
      m.scale.setScalar(0.35);
      m.material.opacity = 0.55;
      own(gsap.to(m.position, { x: m.userData.vx, y: m.userData.vy, z: m.userData.vz, duration: 1.1, ease: 'power2.out' }));
      own(gsap.to(m.scale, { x: 2.2, y: 1.8, z: 2.2, duration: 1.1, ease: 'power2.out' }));
      own(gsap.to(m.material, { opacity: 0, duration: 1.15, ease: 'power2.in' }));
    });
  }

  function build() {
    const css = document.createElement('style');
    css.textContent = `
      #comp-chain-panel{position:fixed;z-index:112;width:276px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:12px;border-radius:14px;color:var(--ui-text);font:13px/1.5 var(--ui-font)}
      #comp-chain-panel[hidden],#comp-chain-stage[hidden]{display:none}
      #comp-chain-panel button{min-height:44px;cursor:pointer;color:inherit;background:#253b49;border:1px solid #667e8c;border-radius:8px;padding:6px 9px}
      #comp-chain-panel .choices{display:flex;gap:6px;margin:10px 0}
      #comp-chain-panel [aria-pressed=true]{background:#367b66;border-color:#8adcc1}
      #btn-comp-chain{width:100%}
      #comp-chain-stage{position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);box-sizing:border-box;padding:10px 14px;border:1px solid #879d9d;border-radius:10px;background:#122633ef;color:#f4f8fa;font:700 14px/1.5 sans-serif;text-align:center;z-index:36;pointer-events:none;white-space:pre-line}
      #comp-chain-action::after{content:'균형체인 비교';position:absolute;top:46px;left:50%;transform:translateX(-50%);font:700 10px sans-serif;white-space:nowrap;color:white;background:#172b36d9;padding:3px 5px;border-radius:5px}
      #comp-chain-ending{position:fixed;inset:0;z-index:37;pointer-events:none;box-shadow:inset 0 0 95px #ce1c1c88;background:linear-gradient(#32060b85,transparent 42%);color:#fff0e4;text-align:center}
      #comp-chain-ending[hidden]{display:none}
      #comp-chain-ending div{position:absolute;top:12%;left:8px;right:8px;text-shadow:0 3px 2px #471313}
      #comp-chain-ending strong{display:block;font:950 clamp(34px,5.6vw,70px)/1.15 sans-serif}
      #comp-chain-ending b{display:block;margin:10px 0;font:800 clamp(17px,2.8vw,28px)/1.3 sans-serif}
      #comp-chain-ending small{display:inline-block;background:#52121ade;border:1px solid #ff8c7b;border-radius:7px;padding:7px 12px;font:700 13px/1.5 sans-serif;max-width:min(540px,92vw)}
      #comp-chain-ending[data-safe=true]{box-shadow:inset 0 0 70px #29745350;background:linear-gradient(#083a3380,transparent 40%);color:#e8fff5}
      #comp-chain-ending[data-safe=true] strong{font-size:clamp(30px,4.8vw,56px)}
      #comp-chain-ending[data-safe=true] small{background:#0e4339e8;border-color:#79cdb4}
      body.demo-inspecting #comp-chain-ending{visibility:hidden!important}
      body.m-hud #comp-chain-stage{display:none!important}
      @media(max-width:600px){#comp-chain-stage{font-size:12px}}
    `;
    document.head.appendChild(css);

    button = document.createElement('button');
    button.id = 'comp-chain-action';
    button.className = 'part-action';
    button.hidden = true;
    button.title = '균형체인 · 이중체결 비교';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'comp-chain-panel');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="8" rx="3.5"/><rect x="8.5" y="13.5" width="7" height="8" rx="3.5"/><path d="M12 8.5v7"/></svg>';
    button.style.setProperty('--part-icon', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);

    panel = document.createElement('section');
    panel.id = 'comp-chain-panel';
    panel.className = 'glass';
    panel.hidden = true;
    panel.setAttribute('aria-label', '균형체인 이중체결 비교 설정');
    panel.innerHTML =
      '<div class="part-panel-head"><strong>균형체인 이중체결 비교</strong><button id="comp-chain-dismiss" aria-label="접기">×</button></div>' +
      '<div class="choices"><button data-chain-mode="dual" aria-pressed="true">이중체결 · 정상</button><button data-chain-mode="single" aria-pressed="false">미설치 · 사고</button></div>' +
      '<p>안전기준 9.6.4 · 보상체인 추가 보호조치<br>균형추 최상층(최대 하중)에서 주 브라켓 파손 시 이중체결 유무의 차이를 비교합니다.</p>' +
      '<button id="btn-comp-chain">파손 비교 시작</button>';
    document.getElementById('part-actions').append(button, panel);

    PartGlow.bind(button, () => CompChain.ready ? CompChain.glowTargets : null, '균형체인 체결부');

    button.onclick = () => {
      const open = panel.hidden;
      closeAllMenus();
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    };
    panel.querySelector('#comp-chain-dismiss').onclick = close;
    panel.querySelectorAll('[data-chain-mode]').forEach(b => {
      b.onclick = () => {
        state.mode = b.dataset.chainMode;
        panel.querySelectorAll('[data-chain-mode]').forEach(n => n.setAttribute('aria-pressed', String(n === b)));
      };
    });
    panel.querySelector('#btn-comp-chain').onclick = () => state.active ? reset() : start(state.mode);

    document.addEventListener('pointerdown', e => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== button) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); if (state.active) reset(); }
    });
    for (const type of ['click', 'pointerdown', 'change', 'keydown', 'dblclick']) {
      document.addEventListener(type, e => {
        if (!state.active || e.target.closest?.('#ucm-exit,#btn-estop,#fault-reset,#btn-comp-chain,#demo-pause,#demo-exit,#demo-compare-next') || (DemoPause.paused && e.target.closest?.('canvas'))) return;
        if (e.target.closest?.('button,input,select,canvas')) { e.preventDefault(); e.stopImmediatePropagation(); }
      }, true);
    }

    caption = document.createElement('div');
    caption.id = 'comp-chain-stage';
    caption.hidden = true;
    caption.setAttribute('role', 'status');
    document.body.appendChild(caption);

    ending = document.createElement('div');
    ending.id = 'comp-chain-ending';
    ending.hidden = true;
    ending.setAttribute('role', 'status');
    ending.innerHTML = '<div><strong></strong><b></b><small></small></div>';
    document.body.appendChild(ending);
  }

  function close() {
    if (panel) panel.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function setCar(y) {
    const dy = y - carGrp.position.y;
    carGrp.position.y = y;
    cwtGrp.position.y -= dy;
    spinSheaves(dy);
    refreshRopes();
    refreshGovernorRope();
    const light = scene.getObjectByName('carLight');
    if (light) light.position.y = y + S.CAR_H * 0.75;
  }

  function shot(kind, duration = 0.75) {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    const portrait = Math.max(1, 0.72 / camera.aspect);
    const cx = CompChain.spec.chainXOffset;
    const cwtBotY = cwtGrp.position.y - S.CWT_H / 2;
    let target, offset;
    if (kind === 'hitch') {
      // 균형추 우측 하부 체결부 초근접 (브라켓·U볼트·빔 관통 안전와이어로프가 한눈에 들어오는 사선)
      target = new THREE.Vector3(cx, cwtBotY - 0.09, CWT_CENTER_Z);
      offset = new THREE.Vector3(0.58 * portrait, -0.06, 0.44 * portrait);
    } else if (kind === 'caught-wide') {
      // 팽팽해진 V 와이어 + 2번 링크에 매달린 이탈 브라켓(+X 쪽)
      target = new THREE.Vector3(cx + 0.03, cwtBotY - 0.17, CWT_CENTER_Z);
      offset = new THREE.Vector3(0.85 * portrait, -0.08, 0.68 * portrait);
    } else if (kind === 'fall-mid') {
      // 후면 우측 사선(개방면): 인장추·피트스크린에 가리지 않고 낙하하는 체인을 전체 추적
      target = new THREE.Vector3(cx * 0.5, cwtBotY * 0.44, CWT_CENTER_Z + 0.05);
      offset = new THREE.Vector3(2.45 * portrait, 0.45, -1.65 * portrait);
    } else {
      // 피트 후면 우측 사선: 레일 지지 채널 위·뒤로 쌓인 쇠사슬 더미 + 맨 위 이탈 브라켓을 장애물 없이 관찰
      target = new THREE.Vector3(cx * 0.9, Y0 + 0.20, CWT_CENTER_Z - 0.16);
      offset = new THREE.Vector3(1.45 * portrait, 0.72, -1.20 * portrait);
    }
    const c = target.clone().add(offset);
    c.y = Math.max(Y0 + 0.35, c.y);
    _camTo(c.x, c.y, c.z, target.x, target.y, target.z, duration);
  }

  function showResult(danger) {
    ending.hidden = false;
    ending.dataset.safe = String(!danger);
    ending.querySelector('strong').textContent = danger ? '⚠ 추락 사고' : '추락 방지';
    ending.querySelector('b').textContent = danger ? '균형체인 이탈 · 승강로 추락' : '안전 와이어로프가 체인 지지';
    ending.querySelector('small').textContent = danger
      ? '이중체결(안전 와이어로프) 미설치 시 주 고정부 파손이 곧바로 체인 추락 사고로 이어집니다.'
      : '주 고정 브라켓이 떨어져도 체인 연결부와 다른 부재(프레임 빔)에 연결된 안전 와이어로프가 체인을 붙잡습니다. (안전기준 9.6.4)';
  }

  function readyToReset() {
    const b = panel?.querySelector('#btn-comp-chain');
    if (b) { b.textContent = 'RST'; b.disabled = false; }
  }

  function beginBreak() {
    const single = state.mode === 'single';
    state.stage = single ? 'falling' : 'caught';
    state.time = 0;
    crashSoundPlayed = false;
    MACH.chainBreak?.();
    if (!single) {
      CompChain.setSim({ mode: 'caught', time: 0, stressAmt: 0, highlightWire: true });
      say('주 브라켓 용접부 파단!\n빔을 관통한 안전 와이어로프가 2번 링크를 붙잡습니다.');
      later(0.20, () => MACH.chainCatch?.());
      later(1.4, () => {
        shot('caught-wide', 0.85);
        later(0.95, () => {
          state.stage = 'done';
          showResult(false);
          readyToReset();
          say('이중체결 지지 성공 · 체인 추락 방지 (안전기준 9.6.4 적합)');
        });
      });
    } else {
      CompChain.setSim({ mode: 'falling', time: 0, stressAmt: 0, highlightWire: false });
      say('주 브라켓 용접부 파단 · 이중체결 없음!\n브라켓째 균형체인이 승강로 아래로 그대로 추락합니다!');
      later(0.35, () => shot('fall-mid', 0.85));
      later(1.25, () => shot('pit-crash', 0.90));
      later(2.45, () => {
        state.stage = 'done';
        showResult(true);
        warningStop = MACH.brakeWarning?.() || null;
        readyToReset();
        say('이중체결 미설치 · 균형체인 승강로 추락 사고 (2014년 사고 재현)');
      });
    }
  }

  function start(mode = 'dual') {
    if (state.active) return;
    if (!CompChain.ready) {
      updateStatus('v-dir', '균형체인 모델 로드 중입니다. 잠시 후 다시 시도하세요.', '#f0883e');
      return;
    }
    if (overspeedActive || moving || estop || insMode || DoorBypass.mode !== 'off' || !PitLadder.secured ||
        InterlockDemo.active || ARDDemo.active || BufferDemo.active || UCMDemo.state.active ||
        AscentDemo.active || BrakeDemo.active || HallManual.active || InspectionReturn.busy ||
        doorOpen || !CarDoor.secured() || !DoorBypass.hallSecured() || Mascot.inspecting) {
      updateStatus('v-dir', '정지·폐문·고장 복귀 후 균형체인 비교 시연을 실행하세요.', '#f0883e');
      return;
    }

    close();
    closeAllMenus();
    clearTimeout(autoTimer);
    leaveCabinView();
    saved = {
      y: carGrp.position.y,
      cwt: cwtGrp.position.y,
      floor: curFloor,
      dual: CompChain.dualProtection,
      near: camera.near,
      minDist: controls.minDistance
    };

    Object.assign(state, { active: true, stage: 'preparing', mode: mode === 'single' ? 'single' : 'dual', time: 0 });
    lastFrameMs = performance.now();
    crashSoundPlayed = false;
    overspeedActive = true;
    moving = true;
    currentState = ELEVATOR_STATE.MOVING;
    document.body.classList.add('comp-chain-active');

    const b = panel?.querySelector('#btn-comp-chain');
    if (b) b.disabled = true;

    _saveCam();
    camera.near = 0.005;
    camera.updateProjectionMatrix();
    controls.minDistance = 0.05;
    MACH.resume();
    MACH.motorOff();

    CompChain.resetSim();
    CompChain.setDualProtection(state.mode === 'dual');
    ending.hidden = true;
    ending.style.opacity = '1';

    const targetY = FLOOR_Y[0] + S.CAR_H / 2; // 카 1층 → 균형추 최상층(최대 체인 자중!)
    say(state.mode === 'dual'
      ? '균형체인 이중체결 비교 · 안전기준 9.6.4\n균형추 최상층(최대 하중) · 프레임 빔 관통 안전 와이어로프가 2번 링크를 감음'
      : '균형체인 이중체결 비교 · 미설치(단일체결)\n균형추 최상층(최대 하중) · 용접 브라켓에만 단일 체결(안전 와이어 없음)');

    const q = { y: carGrp.position.y };
    const moveDur = Math.abs(q.y - targetY) > 0.02 ? 1.15 : 0.05;
    own(gsap.to(q, {
      y: targetY,
      duration: moveDur,
      ease: 'power2.inOut',
      onUpdate: () => setCar(q.y),
      onComplete: () => {
        curFloor = 0;
        syncAllIndicators(1, '');
        updateStatus('v-floor', '1F');
        shot('hitch', 0.85);
        later(1.05, () => {
          state.stage = 'stress';
          state.time = 0;
          say(state.mode === 'dual'
            ? '운행 진동과 반복 하중으로 노란 브라켓 용접부에 피로 균열이 발생합니다.'
            : '안전 와이어로프 미설치 상태 · 노란 브라켓 용접부에 피로 균열이 발생합니다.');
          // 균열 전 미세 하중 떨림
          const pulse = { v: 0 };
          own(gsap.to(pulse, {
            v: 1,
            duration: 2.1,
            ease: 'power1.in',
            onUpdate: () => CompChain.setSim({ mode: 'stress', stressAmt: pulse.v }),
            onComplete: beginBreak
          }));
        });
      }
    }));
  }

  function reset({ instant = false } = {}) {
    if (!state.active || (state.stage === 'resetting' && !instant)) return;
    if (DemoPause.paused) DemoPause.set(false, { exit: true });
    state.stage = 'resetting';
    jobs.forEach(t => t.kill());
    jobs = [];
    warningStop?.();
    warningStop = null;
    shake?.cancel();
    shake = null;
    ending.hidden = true;
    ending.style.opacity = '1';
    if (dustGrp) dustGrp.visible = false;

    const b = panel?.querySelector('#btn-comp-chain');
    if (b) b.disabled = true;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    CompChain.resetSim();
    CompChain.setDualProtection(saved?.dual ?? true);
    say('균형체인 비교 시연 종료 · 정상 복귀');

    const finishRestore = () => {
      if (saved) {
        carGrp.position.y = saved.y;
        cwtGrp.position.y = saved.cwt;
        curFloor = saved.floor;
        camera.near = saved.near;
        controls.minDistance = saved.minDist;
        camera.updateProjectionMatrix();
      }
      refreshRopes();
      refreshGovernorRope();
      _restoreCam(instant ? 0 : 0.45);
      own(gsap.delayedCall(instant ? 0 : 0.5, () => {
        moving = false;
        estop = false;
        overspeedActive = false;
        currentState = ELEVATOR_STATE.IDLE;
        state.active = false;
        state.stage = 'rest';
        state.time = 0;
        caption.hidden = true;
        document.body.classList.remove('comp-chain-active');
        if (b) { b.textContent = '파손 비교 시작'; b.disabled = false; }
        syncAllIndicators(curFloor + 1, '');
        updateStatus('v-spd', '0 m/min');
        updateStatus('v-dir', '정지 대기', '#8b949e');
      }));
    };

    if (instant || !saved || Math.abs(carGrp.position.y - saved.y) < 0.01) {
      finishRestore();
    } else {
      const q = { y: carGrp.position.y };
      own(gsap.to(q, {
        y: saved.y,
        duration: 0.75,
        ease: 'power2.inOut',
        onUpdate: () => setCar(q.y),
        onComplete: finishRestore
      }));
    }
  }

  function update(nowMs = performance.now()) {
    // 저FPS 환경에서도 GSAP 시연 타임라인과 낙하 진행도가 어긋나지 않도록 dt 상한을 0.2초로 둔다.
    const dt = lastFrameMs ? Math.min(0.20, Math.max(0, (nowMs - lastFrameMs) / 1000)) : 0;
    lastFrameMs = nowMs;

    if (state.active && !DemoPause.paused && state.stage !== 'resetting') {
      if (state.stage === 'stress') {
        state.time += dt;
        CompChain.setSim({ time: state.time });
      } else if (state.stage === 'caught' || (state.stage === 'done' && state.mode === 'dual')) {
        // 2번 링크가 와이어에 걸리고 이탈 덩어리가 넘어가 매달리는 진행 (js/comp-chain.js caughtState)
        state.time += dt;
        CompChain.setSim({ time: state.time });
      } else if (state.stage === 'falling' || (state.stage === 'done' && state.mode === 'single')) {
        state.time += dt;
        CompChain.setSim({ time: state.time });
        // 체인이 피트 바닥에 강타하는 시점(≈1.15s)에 굉음 + 먼지 + 화면 흔들림!
        if (!crashSoundPlayed && state.time >= 1.12) {
          crashSoundPlayed = true;
          MACH.chainCrash?.();
          triggerDust(CompChain.spec.chainXOffset + 0.03, Y0 + 0.10, CWT_CENTER_Z - 0.16);
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            shake = renderer.domElement.animate(
              [{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,5px)' }, { transform: 'translate(6px,-4px)' },
               { transform: 'translate(-4px,3px)' }, { transform: 'translate(0,0)' }],
              { duration: 460 }
            );
          }
        }
      }
    }

    if (!button) return;
    button.hidden = true;
    if (!CompChain.ready || !PartActions.iconsVisible || overspeedActive || moving || ARDDemo.active) return;
    const anchor = CompChain.cwtGlowTarget || CompChain.carGlowTarget;
    if (!anchor) return;
    anchor.getWorldPosition(point);
    if (camera.position.distanceToSquared(point) > 100) { close(); return; }
    point.project(camera);
    if (point.z <= -1 || point.z >= 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.94) { close(); return; }
    button.hidden = false;
    const x = (point.x + 1) * innerWidth / 2 - 22;
    const y = (1 - point.y) * innerHeight / 2 - 50;
    PartActions.positionButton(button, x, y);
    if (!panel.hidden) {
      const r = button.getBoundingClientRect();
      panel.style.left = Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left - 100)) + 'px';
      panel.style.top = Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, r.bottom + 28)) + 'px';
    }
  }

  return {
    build,
    update,
    close,
    start,
    reset,
    cancel: () => reset({ instant: true }),
    state,
    get active() { return state.active; }
  };
})();
