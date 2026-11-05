/* ─────────────────────────────────────────────────────────────
   모든 시연 공통 일시정지 (사용자 2026-10-03 「모든 시연 장면에 일시정지」)
   ▪ 완충기·문 이탈방지는 기존 버튼을 그대로 쓰되 같은 정지·자유 관찰·시점 복원 경로를 사용한다.
   ▪ 멈춤 = GSAP 전체 타임라인 정지 + 각 시연의 ticker 운동(UCM motionTick·상승과속 tick·조속기 fallTick)이
     DemoPause.paused 를 보고 건너뜀 + 효과음 정지(MACH.hold). 멈춘 동안 화면을 돌려 볼 수 있고,
     재생하면 멈춘 시점 화면으로 돌아와 이어 간다.
   ▪ 비상정지·시연 종료가 오면 스스로 풀린다(복귀 애니메이션이 멈춘 채 남지 않게).
   ───────────────────────────────────────────────────────────── */
const DemoPause = (() => {
  // [표시 이름, 진행 중인가] — 위에서부터 먼저 맞는 것. 조속기는 상승과속·브레이크 비교도 overspeedActive 를 쓰므로 맨 뒤.
  const DEMOS = [
    ['개문발차', () => typeof UCMDemo !== 'undefined' && UCMDemo.state.active],
    ['상승과속', () => typeof AscentDemo !== 'undefined' && AscentDemo.active],
    ['브레이크 비교', () => typeof BrakeDemo !== 'undefined' && BrakeDemo.active],
    ['ARD 자동구출', () => typeof ARDDemo !== 'undefined' && ARDDemo.active],
    ['수동 구출', () => typeof ManualRescueDemo !== 'undefined' && ManualRescueDemo.active],
    ['문닫힘 안전장치', () => typeof PhotoEyeDemo !== 'undefined' && PhotoEyeDemo.active],
    ['종단 스위치', () => typeof TerminalDemo !== 'undefined' && TerminalDemo.active],
    ['주로프 측정', () => typeof RopeMeasure !== 'undefined' && RopeMeasure.active],
    ['인터록', () => typeof InterlockDemo !== 'undefined' && InterlockDemo.floor >= 0],
    ['연동로프', () => typeof RelayRopeDemo !== 'undefined' && RelayRopeDemo.active],
    ['완충기', () => typeof BufferDemo !== 'undefined' && BufferDemo.active && !['done', 'halted', 'resetting', 'rest'].includes(BufferDemo.state.stage), 'buffer-demo-pause'],
    ['문 이탈방지', () => typeof RetentionDemo !== 'undefined' && RetentionDemo.active, 'retention-demo-pause'],
    ['조속기 과속', () => typeof overspeedActive !== 'undefined' && overspeedActive]
  ];
  let btn = null, paused = false, saved = null;
  const current = () => DEMOS.find(([, on]) => { try { return on(); } catch (e) { return false; } });
  const controlKeys = ['enabled', 'enableDamping', 'enableRotate', 'enableZoom', 'enablePan', 'autoRotate',
    'minDistance', 'maxDistance', 'minPolarAngle', 'maxPolarAngle', 'minAzimuthAngle', 'maxAzimuthAngle', 'screenSpacePanning'];
  function build() {
    const style = document.createElement('style');
    style.textContent = 'body.demo-inspecting #ucm-summary,body.demo-inspecting #ucm-overlay,body.demo-inspecting #ucm-impact,body.demo-inspecting #brake-compare-ending{visibility:hidden!important}';
    document.head.append(style);
    btn = document.createElement('button'); btn.id = 'demo-pause'; btn.type = 'button'; btn.hidden = true;
    btn.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:122;padding:8px 18px;border-radius:999px;border:1px solid #ffd24d;background:#142230ee;color:#ffd24d;font:700 14px/1 sans-serif;cursor:pointer;box-shadow:0 0 14px #ffb21e66';
    btn.addEventListener('click', () => set(!paused));
    document.body.appendChild(btn);
    label();
  }
  function label() { if (btn) { btn.textContent = paused ? '▶ 재생' : '❚❚ 일시정지'; btn.setAttribute('aria-pressed', String(paused)); } }
  function localPause(on) {
    if (typeof BufferDemo !== 'undefined' && BufferDemo.active) BufferDemo.setPaused(on);
    if (typeof RetentionDemo !== 'undefined' && RetentionDemo.active) RetentionDemo.setPaused(on);
  }
  function set(on, { exit = false, ended = false } = {}) {
    on = !!on;
    if (on === paused || (on && !current())) return;
    if (on) {
      saved = { p: camera.position.clone(), t: controls.target.clone(), up: camera.up.clone(), q: camera.quaternion.clone(),
        fov: camera.fov, zoom: camera.zoom, near: camera.near, far: camera.far, estop,
        controls: Object.fromEntries(controlKeys.map(key => [key, controls[key]])),
        mouse: { ...controls.mouseButtons }, touches: { ...controls.touches },
        effects: renderer.domElement.getAnimations().filter(a => a.playState === 'running') };
      paused = true; localPause(true); gsap.globalTimeline.pause(); MACH.hold?.(true);
      saved.effects.forEach(a => a.pause());
      // 남은 회전 관성을 비운 뒤, 자동 카메라의 타임라인을 그대로 둔 채 수동 관찰만 허용한다.
      controls.enableDamping = false; controls.update();
      camera.position.copy(saved.p); controls.target.copy(saved.t);
      controls.enabled = controls.enableRotate = controls.enableZoom = controls.enablePan = true;
      controls.autoRotate = false; controls.screenSpacePanning = true;
      controls.minDistance = .02; controls.maxDistance = Math.max(90, saved.controls.maxDistance);
      controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
      controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY; controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      camera.near = Math.min(saved.near, .002); camera.updateProjectionMatrix(); controls.update();
      document.body.classList.add('demo-inspecting');
    } else {
      const s = saved; saved = null;
      if (s) {
        // 복귀 경로와 겹치는 새 카메라 트윈을 만들지 않는다. 시연 시간을 풀기 전에 정확한 시점을 복원한다.
        const ownerControls = { enabled: controls.enabled, enableDamping: controls.enableDamping, minDistance: controls.minDistance };
        controls.enableDamping = false; controls.update();
        Object.assign(controls, s.controls); Object.assign(controls.mouseButtons, s.mouse); Object.assign(controls.touches, s.touches);
        if (ended) Object.assign(controls, ownerControls);
        if (!exit) {
          controls.enableDamping = false;
          camera.position.copy(s.p); controls.target.copy(s.t); camera.up.copy(s.up); camera.quaternion.copy(s.q);
        }
        s.effects.forEach(a => { if (a.playState === 'paused') a.play(); });
        if (!ended) { camera.fov = s.fov; camera.zoom = s.zoom; camera.near = s.near; camera.far = s.far; camera.updateProjectionMatrix(); }
        if (!exit) {
          controls.update(); controls.enableDamping = s.controls.enableDamping;
          camera.quaternion.copy(s.q); camera.fov = s.fov; camera.zoom = s.zoom; camera.near = s.near; camera.far = s.far;
          camera.updateProjectionMatrix();
        }
      }
      paused = false; localPause(false); document.body.classList.remove('demo-inspecting');
      gsap.globalTimeline.resume(); MACH.hold?.(false);
    }
    label();
  }
  // 렌더 루프에서 호출 — 버튼 표시·자동 해제만 한다.
  function update() {
    if (!btn) return;
    const demo = current();
    // 상승과속·브레이크 비교는 시연 중 스스로 estop 을 켠다 — 멈춘 뒤 사용자가 새로 누른 비상정지만 해제 조건이다.
    if (paused && (!demo || (estop && !saved?.estop))) set(false, { exit: true, ended: !demo });
    btn.hidden = !demo || !!demo[2];
    if (demo) btn.title = paused ? '드래그로 회전 · 휠/두 손가락 확대·축소 · 우클릭/두 손가락 이동 · 재생하면 시연 화면으로 복귀' : demo[0] + ' 시연 일시정지·재생';
    if (innerWidth < 800) Object.assign(btn.style, { left: '8px', top: '76px', transform: 'none' });
    // 상단 가운데 12~56px 은 개문발차·상승과속의 「종료 · 정상 복귀」 버튼 자리 — 그 아래에 둔다.
    else Object.assign(btn.style, { left: '50%', top: '64px', transform: 'translateX(-50%)' });
  }
  return { build, update, set, toggle: () => set(!paused), get paused() { return paused; }, get demo() { return current()?.[0] || null; } };
})();
