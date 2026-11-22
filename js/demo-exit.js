// 교육 시연만 취소한다. 페이지·모델을 다시 불러오지 않고 정상 착상 상태와 전체 보기로 복귀한다.
const DemoExit = (() => {
  const demos = [
    ['개문발차', () => UCMDemo.state.active, () => UCMDemo.cancel()],
    ['상승과속', () => AscentDemo.active, () => AscentDemo.cancel()],
    ['브레이크 비교', () => BrakeDemo.active, () => BrakeDemo.cancel()],
    ['ARD 자동구출', () => ARDDemo.active, () => ARDDemo.cancel()],
    ['수동 구출', () => ManualRescueDemo.active, () => ManualRescueDemo.reset()],
    ['문닫힘 안전장치', () => PhotoEyeDemo.active, () => PhotoEyeDemo.cancel()],
    ['종단 스위치', () => TerminalDemo.active || TerminalDemo.state.pending, () => TerminalDemo.cancel()],
    ['주로프 측정', () => RopeMeasure.active, () => RopeMeasure.cancel()],
    ['인터록', () => InterlockDemo.floor >= 0, () => InterlockDemo.cancel()],
    ['연동로프', () => RelayRopeDemo.active, () => RelayRopeDemo.cancel()],
    ['문 이탈방지', () => RetentionDemo.active, () => RetentionDemo.cancel()],
    ['완충기', () => BufferDemo.active || BufferDemo.pending, () => BufferDemo.cancel()],
    ['조속기 과속', () => overspeedActive || ovsDemo.pendingStart, () => resetGovernorFault(document.getElementById('btn-overspeed'), { instant: true })]
  ];
  const comparisons = [
    { key: 'door', name: '개문발차', state: () => UCMDemo.state, complete: s => s.stage === 'done' },
    { key: 'up', name: '상승과속', state: () => AscentDemo.state, complete: s => s.stage === 'done' },
    { key: 'brake', name: '브레이크 비교', state: () => BrakeDemo.state, complete: s => s.stage === 'held' || s.stage === 'paused' }
  ];
  const modeLabel = { normal: '정상', fail: '미작동', none: '미설치', dual: '더블', single: '싱글' };
  let button, compareButton, comparison = null, pendingComparison = null, busy = false, baseline, initialView;
  const current = () => demos.find(([, active]) => active());
  const exitButtons = '#demo-exit,#photo-eye-exit,#rope-measure-exit,#terminal-demo-exit,#relay-demo-exit,#retention-demo-exit,#interlock-demo-cancel';
  const handlesExit = e => !!e.target.closest?.(exitButtons) && !!current();
  function rememberLanding() {
    if (moving || estop || Math.abs(carGrp.position.y - FLOOR_Y[curFloor] - S.CAR_H / 2) > .001) return;
    if (baseline?.floor === curFloor && baseline.car === carGrp.position.y && baseline.cwt === cwtGrp.position.y) return;
    baseline = { floor: curFloor, car: carGrp.position.y, cwt: cwtGrp.position.y };
  }
  function build() {
    initialView = { fov: camera.fov, near: camera.near, min: controls.minDistance, damping: controls.enableDamping };
    rememberLanding();
    const style = document.createElement('style');
    style.textContent = `
      #demo-exit{position:fixed;right:max(16px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));z-index:10001;width:46px;height:46px;display:grid;place-items:center;border:1px solid #fecaca;border-radius:14px;background:#fff5f5f5;color:#a52632;font:400 32px/1 sans-serif;box-shadow:0 3px 12px #0004;cursor:pointer;touch-action:manipulation}
      #demo-exit[hidden]{display:none}#demo-exit:focus-visible{outline:3px solid #ffb83d;outline-offset:3px}#demo-exit:disabled{cursor:progress}
      #demo-compare-next{position:fixed;right:max(16px,env(safe-area-inset-right));top:164px;z-index:10002;width:92px;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:5px;border:1px solid #b5c9bf;border-radius:13px;background:#354541f5;color:#e4f0e9;font:600 11px/1.3 var(--ui-font,sans-serif);box-shadow:0 3px 12px #24334924;cursor:pointer;touch-action:manipulation}
      #demo-compare-next[data-result=true]{top:76px}
      #demo-compare-next svg{width:18px;height:18px}#demo-compare-next[hidden]{display:none}#demo-compare-next:active{background:#4c625a}#demo-compare-next:focus-visible{outline:3px solid #9ed4bb;outline-offset:2px}
      @media(max-width:600px){#demo-exit{right:max(10px,env(safe-area-inset-right));top:84px}}
      @media(max-width:600px){#demo-compare-next,#demo-compare-next[data-result=true]{right:max(10px,env(safe-area-inset-right));top:144px;width:84px}}
      @media(max-height:500px){#demo-exit{right:86px;top:12px}}
      @media(max-height:500px){#demo-compare-next,#demo-compare-next[data-result=true]{right:var(--m-right,86px);width:84px}#demo-compare-next{top:124px}#demo-compare-next[data-result=true]{top:68px}}
    `;
    document.head.append(style);
    button = document.createElement('button');
    button.id = 'demo-exit'; button.type = 'button'; button.textContent = '×'; button.hidden = true;
    button.setAttribute('aria-label', '시연 취소 · 처음 화면으로'); button.title = '시연 취소 · 처음 화면으로';
    document.body.append(button);
    compareButton = document.createElement('button'); compareButton.id = 'demo-compare-next'; compareButton.type = 'button'; compareButton.hidden = true;
    compareButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3"/></svg><span></span>';
    document.body.append(compareButton);
    // 결과 화면의 입력 차단보다 먼저 받아 기존 취소·모드 선택 경로로만 전환한다.
    for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'click']) window.addEventListener(type, e => {
      if (!e.target.closest?.('#demo-compare-next')) return;
      e.stopImmediatePropagation();
      if (type === 'click') { e.preventDefault(); compareOpposite(); }
    }, true);
    // 시연의 document 캡처 차단보다 먼저 받는다. HUD를 숨기거나 비활성화한 장면에서도 항상 누를 수 있다.
    for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup']) window.addEventListener(type, e => {
      if (handlesExit(e)) e.stopImmediatePropagation();
    }, true);
    window.addEventListener('click', e => {
      if (!handlesExit(e)) return;
      e.preventDefault(); e.stopImmediatePropagation(); cancel();
    }, true);
    SceneClean.build();
    DemoTakeaway.build();
  }
  function completedComparison() {
    const demo = comparisons.find(d => d.state().active);
    if (!demo || !demo.complete(demo.state())) return null;
    return { key: demo.key, name: demo.name, mode: demo.state().mode };
  }
  function compareOpposite() {
    if (!comparison || pendingComparison || busy || compareButton.hidden) return;
    const mode = comparison.key === 'brake' ? (comparison.mode === 'dual' ? 'single' : 'dual') : (comparison.mode === 'normal' ? 'none' : 'normal');
    pendingComparison = { ...comparison, mode, previous: comparison };
    comparison = null; compareButton.hidden = true;
    if (current()) cancel();
  }
  function updateComparison(demo) {
    if (pendingComparison) {
      compareButton.hidden = true;
      if (busy || demo) return;
      const next = pendingComparison; pendingComparison = null;
      // 시연 목록과 같은 설정 동기화·시작 함수를 재사용한다. 목록을 다시 열지는 않는다.
      document.querySelector(`#demo-options-${next.key} [data-demo-mode="${next.mode}"]`)?.click();
      if (!current()) comparison = next.previous;
      return;
    }
    const live = comparisons.find(d => d.state().active);
    if (live) {
      const state = live.state();
      if (live.complete(state)) {
        if (!comparison || comparison.key !== live.key || comparison.mode !== state.mode)
          comparison = { key: live.key, name: live.name, mode: state.mode };
      } else if (state.stage !== 'resetting') comparison = null;
    } else if (demo || moving || insMode || CharacterWalk.active) comparison = null;
    if (!comparison) { compareButton.hidden = true; return; }
    const obstructed = document.querySelector('#m-demo.open,.sheet.open') || document.body.classList.contains('m-run-open') || document.getElementById('hud').classList.contains('tools-hidden');
    const ready = live ? live.complete(live.state()) : !demo && !estop && !doorOpen && !CarDoor.state?.busy && CarDoor.secured();
    compareButton.hidden = !comparison || busy || !ready || !!obstructed;
    if (compareButton.hidden) return;
    const result = String(!!live);
    if (compareButton.dataset.result !== result) compareButton.dataset.result = result;
    const mode = comparison.key === 'brake' ? (comparison.mode === 'dual' ? 'single' : 'dual') : (comparison.mode === 'normal' ? 'none' : 'normal');
    if (compareButton.dataset.demo !== comparison.key || compareButton.dataset.demoMode !== mode) {
      compareButton.dataset.demo = comparison.key; compareButton.dataset.demoMode = mode;
      compareButton.querySelector('span').textContent = modeLabel[mode] + ' 보기';
      compareButton.title = comparison.name + ' · ' + modeLabel[comparison.mode] + ' → ' + modeLabel[mode] + ' 비교';
      compareButton.setAttribute('aria-label', compareButton.title);
    }
  }
  function closeDoorsNow() {
    clearTimeout(autoTimer);
    const q = CarDoor.state;
    q.timeline?.kill(); q.busy = false; q.closeCallbacks = []; q.release = 0; q.coupledFloor = -1;
    hatchDoors.forEach((h, f) => {
      gsap.killTweensOf(h.hook.rotation); if (h.keyTween) gsap.killTweensOf(h.keyTween);
      h.manualActive = h.manualCoupled = false; h.manualOpen = 0;
      h.right.position.x = h.right.userData.cx; h.left.position.x = h.left.userData.cx;
      setEmergencyKey(f, 0); spinDoorDrive(h); HallInterlock.update(h);
    });
    carDoorR.position.x = q.d.cx; CarDoor.pose(); doorOpen = false;
  }
  function finish() {
    gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position);
    gsap.killTweensOf(camera); gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    closeDoorsNow(); leaveCabinView();
    const dy = baseline.car - carGrp.position.y;
    carGrp.position.y = baseline.car; cwtGrp.position.y = baseline.cwt; spinSheaves(dy);
    curFloor = baseline.floor; moving = estop = false; currentState = ELEVATOR_STATE.IDLE;
    refreshRopes(); refreshGovernorRope(); refreshTerminalDevices();
    const light = scene.getObjectByName('carLight'); if (light) light.position.y = carGrp.position.y + S.CAR_H * .75;
    MACH.motorOff(); MACH.brakeSet(); window.speechSynthesis?.cancel();
    camera.fov = initialView.fov; camera.near = initialView.near; camera.zoom = 1; camera.updateProjectionMatrix();
    controls.enabled = true; controls.enableDamping = false; controls.minDistance = initialView.min;
    controls.update(); // 일시정지 중 드래그한 회전 관성이 전체 보기 복귀 뒤에 남지 않게 비운다.
    const home = overviewCameraPose(); camera.position.fromArray(home.position); controls.target.fromArray(home.target); controls.update();
    controls.enableDamping = initialView.damping;
    closeAllMenus();
    syncAllIndicators(curFloor + 1, ''); updateStatus('v-floor', `${curFloor + 1}F`);
    updateStatus('v-spd', '0 m/min'); updateStatus('v-dir', '정지 대기', '#8b949e'); updateStatus('v-door', '닫힘', '#3fb950');
    document.querySelectorAll('#fbtns .c-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.f) === curFloor));
    busy = false; button.disabled = false; button.textContent = '×'; button.hidden = true;
  }
  function cancel() {
    const demo = current(); if (!demo || busy) return;
    if (!pendingComparison) comparison = completedComparison();
    compareButton.hidden = true;
    busy = true; button.disabled = true; button.textContent = '…';
    DemoPause.set(false, { exit: true });
    demo[2]();
    if (!current()) finish();
  }
  function update() {
    if (!button) return;
    const demo = current();
    if (busy) { compareButton.hidden = true; SceneClean.hide(); DemoTakeaway.hide(); if (!demo) finish(); return; }
    updateComparison(demo);
    if (button.hidden === !!demo) button.hidden = !demo;
    if (!demo) rememberLanding();
    SceneClean.update(!!demo);
    DemoTakeaway.update();
  }
  return { build, update, cancel, closeDoorsNow, get active() { return !!current(); }, get busy() { return busy; } };
})();

// 비-시연 설비 조작(제어반·분전함 문, 피트 사다리, 승장문 수동개방, 조명·비상등, 비상통화, 점검운전·바이패스·비상정지)을
// 페이지 새로고침 없이 한 번에 원상복구 + 첫 화면으로 정리한다 (2026-11-22).
const SceneClean = (() => {
  let btn = null, nextCheck = 0;
  function dirty() {
    try {
      if (DemoExit.active || DemoExit.busy || CharacterWalk.active || inspectionResetting) return false;
      const bl = typeof BuildingLights !== 'undefined' ? BuildingLights.state : null;
      return !!(
        (typeof ControlPanel !== 'undefined' && (ControlPanel.open || ControlPanel.busy)) ||
        (typeof MachineRoomPower !== 'undefined' && (MachineRoomPower.open || MachineRoomPower.busy)) ||
        (typeof PitLadder !== 'undefined' && (PitLadder.deployed || PitLadder.busy || !PitLadder.secured)) ||
        (typeof HallManual !== 'undefined' && (HallManual.active || HallManual.busy || !document.getElementById('hall-panel')?.hidden)) ||
        (bl && (bl.mr || bl.shaft || bl.car)) ||
        (typeof EmergencyLighting !== 'undefined' && EmergencyLighting.on) ||
        (typeof EmergencyCall !== 'undefined' && EmergencyCall.state.active) ||
        (typeof InspectionStations !== 'undefined' && InspectionStations.active) ||
        (typeof DoorBypass !== 'undefined' && DoorBypass.mode !== 'off') ||
        insMode || estop
      );
    } catch (e) { return false; }
  }
  function run() {
    if (DemoExit.active || DemoExit.busy || CharacterWalk.active || inspectionResetting) return false;
    PartGlow.closeMenu();
    PartActions.close();
    closeAllMenus();
    leaveCabinView();
    if (typeof EmergencyCall !== 'undefined' && EmergencyCall.state.active) EmergencyCall.hangUp();
    if (typeof InspectionStations !== 'undefined' && InspectionStations.active) InspectionStations.release();
    if (typeof InspectionReturn !== 'undefined' && InspectionReturn.busy) InspectionReturn.cancel();
    if (typeof HallManual !== 'undefined') { HallManual.dismiss(); HallManual.resetAll(); }
    if (typeof DoorBypass !== 'undefined' && DoorBypass.mode !== 'off') DoorBypass.setMode('off');
    if (typeof ControlPanel !== 'undefined' && (ControlPanel.open || ControlPanel.busy)) ControlPanel.restoreOpen(false);
    if (typeof MachineRoomPower !== 'undefined' && (MachineRoomPower.open || MachineRoomPower.busy)) MachineRoomPower.restoreOpen(false);
    if (typeof PitLadder !== 'undefined' && (PitLadder.deployed || PitLadder.busy || !PitLadder.secured)) PitLadder.restoreClosed();
    if (typeof BuildingLights !== 'undefined' && BuildingLights.resetAll) BuildingLights.resetAll();
    if (typeof EmergencyLighting !== 'undefined' && EmergencyLighting.on) EmergencyLighting.set(false);
    if (typeof TerminalDemo !== 'undefined' && TerminalDemo.clearFaults) TerminalDemo.clearFaults();
    insHold = 0; insStop();
    if (estop) {
      estop = false;
      const stop = document.getElementById('btn-estop');
      if (stop) {
        stop.classList.remove('armed'); stop.setAttribute('aria-pressed', 'false'); stop.setAttribute('aria-label', '비상정지');
        const span = stop.querySelector('span');
        if (span && typeof estopLabel === 'function') span.textContent = estopLabel(!!portraitHUD?.isPortrait(), false);
      }
    }
    if (insMode) setInspectionMode(false, { recover: false });
    gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position);
    gsap.killTweensOf(camera); gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    DemoExit.closeDoorsNow();
    const targetFloor = 0;
    const targetCarY = FLOOR_Y[targetFloor] + S.CAR_H / 2;
    const dy = targetCarY - carGrp.position.y;
    carGrp.position.y = targetCarY;
    cwtGrp.position.y -= dy;
    spinSheaves(dy);
    curFloor = targetFloor; moving = false; currentState = ELEVATOR_STATE.IDLE;
    refreshRopes(); refreshGovernorRope(); refreshTerminalDevices();
    const light = scene.getObjectByName('carLight'); if (light) light.position.y = carGrp.position.y + S.CAR_H * .75;
    MACH.motorOff(); MACH.brakeSet(); window.speechSynthesis?.cancel();
    controls.enabled = true;
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update();
    const home = overviewCameraPose();
    camera.position.fromArray(home.position); controls.target.fromArray(home.target); controls.update();
    controls.enableDamping = damping;
    syncAllIndicators(curFloor + 1, '');
    updateStatus('v-floor', `${curFloor + 1}F`, '#3fb950');
    updateStatus('v-spd', '0 m/min');
    updateStatus('v-dir', '설비 정리 완료 · 첫 화면', '#3fb950');
    updateStatus('v-door', '닫힘', '#3fb950');
    document.querySelectorAll('#fbtns .c-btn').forEach(b => { b.classList.toggle('active', Number(b.dataset.f) === curFloor); b.classList.remove('called'); });
    if (btn) btn.hidden = true;
    return true;
  }
  function build() {
    if (btn) return;
    const style = document.createElement('style');
    style.textContent = `
      #scene-clean-btn{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:112;
        display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 13px;border:1px solid #d9b252;border-radius:999px;
        background:#fcfaf5f2;color:#4a3309;font:700 12px/1 var(--ui-font,sans-serif);box-shadow:0 3px 14px rgba(32,24,6,.22);cursor:pointer;touch-action:manipulation;white-space:nowrap}
      #scene-clean-btn[hidden]{display:none!important}
      #scene-clean-btn svg{width:15px;height:15px;flex:none}
      #scene-clean-btn:active{background:#f1e3bc}
      #scene-clean-btn:focus-visible{outline:2px solid #c88e1a;outline-offset:2px}
      body.m-hud #scene-clean-btn{top:calc(var(--edge-t,10px) + 60px)}
      @media (orientation:landscape){
        body.m-hud #scene-clean-btn{left:auto;right:var(--m-right,72px);top:var(--edge-t,10px);transform:none}
      }
      body.m-hud.portrait-tools-hidden #scene-clean-btn{visibility:hidden;pointer-events:none}
    `;
    document.head.append(style);
    btn = document.createElement('button');
    btn.id = 'scene-clean-btn'; btn.type = 'button'; btn.hidden = true;
    btn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg><span>설비 정리</span>';
    btn.title = '열어 둔 제어반·분전함·사다리·조명·점검 상태를 한 번에 닫고 첫 화면으로 복귀';
    btn.setAttribute('aria-label', '설비 정리 · 열어 둔 설비 모두 닫고 첫 화면으로');
    btn.addEventListener('click', run);
    document.body.append(btn);
  }
  function hide() { if (btn && !btn.hidden) btn.hidden = true; }
  function update(demoActive) {
    if (!btn) return;
    if (demoActive) { hide(); return; }
    const now = performance.now();
    if (now < nextCheck) return;
    nextCheck = now + 140;
    const obstructed = document.querySelector('#m-demo.open,.sheet.open') || document.body.classList.contains('m-run-open') || document.getElementById('hud')?.classList.contains('tools-hidden');
    const show = !obstructed && dirty();
    if (btn.hidden === show) btn.hidden = !show;
  }
  return { build, update, hide, dirty, run };
})();

// 6번: 「정상 vs 미설치 / 더블 vs 싱글 / 이탈방지」 비교 시연 완료 시 한 줄 핵심 결론 배너 (2026-11-22).
// 관리주체·고객 브리핑에서 안전장치의 필요성과 미설치 위험을 또렷하게 요약한다.
const DemoTakeaway = (() => {
  const COPY = {
    'door:normal': { tone: 'safe', tag: '안전 · 로프브레이크 정상', text: '문이 열린 채 움직이면 로프를 즉시 잡아 끼임·추락 사고를 막습니다.' },
    'door:none': { tone: 'danger', tag: '위험 · 로프브레이크 미설치', text: '제동장치가 없으면 문이 열린 상태로 카가 상승해 중대사고로 이어집니다.' },
    'door:fail': { tone: 'danger', tag: '위험 · 로프브레이크 미작동', text: '장치가 작동하지 않으면 개문발차를 막지 못해 승객 끼임 위험이 큽니다.' },
    'up:normal': { tone: 'safe', tag: '안전 · 상승과속 방지장치 정상', text: '정격속도 초과 즉시 로프브레이크가 카를 잡아 상부 충돌을 막습니다.' },
    'up:none': { tone: 'danger', tag: '위험 · 상승과속 방지장치 미설치', text: '상승 폭주를 막을 장치가 없으면 카가 최상부 슬래브와 정면 충돌합니다.' },
    'brake:dual': { tone: 'safe', tag: '안전 · 이중(더블) 주브레이크', text: '한쪽 스프링·슈가 고장 나도 독립된 나머지 브레이크가 카를 붙잡습니다.' },
    'brake:single': { tone: 'danger', tag: '위험 · 단일(싱글) 주브레이크', text: '공통 스프링 하나가 파손되면 제동력을 모두 잃어 카가 폭주합니다.' },
    'retention:result': { tone: 'info', tag: '핵심 · 상부 비상가이드 + 하부 보강슈', text: '기존 가이드 손상 시 문 이탈을 억제합니다. 충격 예방·점검이 필수입니다.' }
  };
  let box = null, tagEl = null, textEl = null, dismissedKey = '', activeKey = '';

  function detectKey() {
    try {
      if (typeof DemoPause !== 'undefined' && DemoPause.paused) return '';
      if (typeof UCMDemo !== 'undefined' && UCMDemo.state.active && UCMDemo.state.stage === 'done') {
        return 'door:' + (UCMDemo.state.mode || 'normal');
      }
      if (typeof AscentDemo !== 'undefined' && AscentDemo.active && AscentDemo.state.stage === 'done') {
        return 'up:' + (AscentDemo.state.mode || 'normal');
      }
      if (typeof BrakeDemo !== 'undefined' && BrakeDemo.active && ['held', 'paused'].includes(BrakeDemo.state.stage)) {
        return 'brake:' + (BrakeDemo.state.mode || 'dual');
      }
      if (typeof RetentionDemo !== 'undefined' && RetentionDemo.active && RetentionDemo.state.phase === 'result') {
        return 'retention:result';
      }
    } catch (e) {}
    return '';
  }

  function build() {
    if (box) return;
    const style = document.createElement('style');
    style.textContent = `
      #demo-takeaway{position:fixed;left:50%;top:104px;transform:translateX(-50%);z-index:126;
        display:flex;align-items:center;gap:10px;max-width:min(580px,calc(100vw - 240px));padding:9px 12px 9px 14px;
        border-radius:14px;border:1px solid #d9b252;background:#fcfaf5f5;color:#2b2110;
        font-family:var(--ui-font,sans-serif);box-shadow:0 6px 22px rgba(24,18,6,.26);box-sizing:border-box}
      #demo-takeaway[hidden]{display:none!important}
      #demo-takeaway[data-tone="safe"]{border-color:#d4ab46;background:#fcfaf3f7;color:#2c220f}
      #demo-takeaway[data-tone="danger"]{border-color:#e06b5c;background:#fff5f3f7;color:#3d1410}
      #demo-takeaway[data-tone="info"]{border-color:#d9b252;background:#fcfaf5f7;color:#2c220f}
      #demo-takeaway .dt-body{flex:1;min-width:0}
      #demo-takeaway .dt-tag{display:inline-block;padding:2px 7px;margin-bottom:3px;border-radius:999px;font:800 10.5px/1.3 var(--ui-font,sans-serif);letter-spacing:-.01em}
      #demo-takeaway[data-tone="safe"] .dt-tag{background:#8c5c08;color:#fffdf8}
      #demo-takeaway[data-tone="danger"] .dt-tag{background:#c23326;color:#fff}
      #demo-takeaway[data-tone="info"] .dt-tag{background:#7d5510;color:#fffdf8}
      #demo-takeaway p{margin:0;font:650 12.5px/1.4 var(--ui-font,sans-serif);word-break:keep-all}
      #demo-takeaway button{flex:none;width:30px;height:30px;border:0;border-radius:8px;background:rgba(0,0,0,.07);color:inherit;font:700 16px/1 sans-serif;cursor:pointer;touch-action:manipulation}
      #demo-takeaway button:focus-visible{outline:2px solid #c88e1a;outline-offset:2px}
      body.m-hud #demo-takeaway{left:var(--edge,10px);right:var(--m-right,10px);top:auto;bottom:calc(var(--m-above,68px) + 74px);transform:none;max-width:none;padding:8px 10px 8px 12px}
      body.m-hud #demo-takeaway p{font-size:12px;line-height:1.38}
      body.m-hud.demo-takeaway-open #brief-badge,body.m-hud.demo-takeaway-open #xray-badge{opacity:0;pointer-events:none}
      @media (orientation:landscape){
        body.m-hud #demo-takeaway{right:calc(var(--m-right,72px) + 92px);max-width:520px}
      }
      body.m-hud.portrait-tools-hidden #demo-takeaway{visibility:hidden;pointer-events:none}
    `;
    document.head.append(style);
    box = document.createElement('aside');
    box.id = 'demo-takeaway'; box.hidden = true;
    box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); box.setAttribute('aria-label', '비교 시연 핵심 결론');
    box.innerHTML = '<div class="dt-body"><span class="dt-tag"></span><p></p></div><button type="button" id="demo-takeaway-close" aria-label="핵심 요약 닫기">×</button>';
    tagEl = box.querySelector('.dt-tag'); textEl = box.querySelector('p');
    document.body.append(box);
    // 시연의 document 캡처 차단보다 먼저 닫기 버튼을 받는다.
    for (const type of ['pointerdown', 'pointerup', 'click']) window.addEventListener(type, e => {
      if (!e.target.closest?.('#demo-takeaway-close')) return;
      e.stopImmediatePropagation();
      if (type === 'click') { e.preventDefault(); dismissedKey = activeKey; hide(); }
    }, true);
  }

  function hide() {
    if (box && !box.hidden) box.hidden = true;
    if (document.body.classList.contains('demo-takeaway-open')) document.body.classList.remove('demo-takeaway-open');
  }

  function update() {
    if (!box) return;
    const key = detectKey();
    if (!key) {
      activeKey = ''; dismissedKey = '';
      hide(); return;
    }
    if (key !== activeKey) { activeKey = key; dismissedKey = ''; }
    if (dismissedKey === key) { hide(); return; }
    const entry = COPY[key];
    if (!entry) { hide(); return; }
    if (box.dataset.tone !== entry.tone) box.dataset.tone = entry.tone;
    if (box.dataset.key !== key) box.dataset.key = key;
    if (tagEl.textContent !== entry.tag) tagEl.textContent = entry.tag;
    if (textEl.textContent !== entry.text) textEl.textContent = entry.text;
    if (box.hidden) box.hidden = false;
    if (!document.body.classList.contains('demo-takeaway-open')) document.body.classList.add('demo-takeaway-open');
  }

  return { build, update, hide, get activeKey() { return box && !box.hidden ? activeKey : ''; } };
})();
