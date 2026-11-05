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
    if (busy) { compareButton.hidden = true; if (!demo) finish(); return; }
    updateComparison(demo);
    if (button.hidden === !!demo) button.hidden = !demo;
    if (!demo) rememberLanding();
  }
  return { build, update, cancel, get active() { return !!current(); }, get busy() { return busy; } };
})();
