// 정지 화면 프레임 절약 (2026-11-21 최적화 3단계). 발열·배터리용이며 화질은 바꾸지 않는다.
// 입력·누른 채 유지·카메라 이동·운행·문 동작·시연·GSAP 연출·그림자 변화가 없으면
// 1.5초 뒤 30fps, 20초 뒤 12fps로 그린다. 입력이 들어오면 그 프레임부터 원래 속도다.
// 시연 중에는 항상 원래 속도다(프레임 수 기반 연출이 느려지지 않도록). ?idle=0 이면 끈다(전후 측정용).
const IdleThrottle = (() => {
  const off = /[?&]idle=0(&|$)/.test(location.search);
  const IDLE_AFTER = 1500, DEEP_AFTER = 20000, GAP = [0, 1000 / 30, 1000 / 12];
  let lastActive = performance.now(), lastRender = 0, mode = 0, prevMode = 0, pointers = 0;
  let pulseClock = 0, pulseReal = 0;
  const cam = new Float64Array(19);
  const wake = () => { lastActive = performance.now(); };
  for (const type of ['pointermove', 'wheel', 'keydown', 'touchstart', 'resize']) addEventListener(type, wake, { capture: true, passive: true });
  addEventListener('pointerdown', () => { pointers++; wake(); }, { capture: true, passive: true });
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, () => { pointers = Math.max(0, pointers - 1); wake(); }, { capture: true, passive: true });
  addEventListener('blur', () => { pointers = 0; });

  function busy() {
    if (pointers || moving || currentState !== ELEVATOR_STATE.IDLE && currentState !== ELEVATOR_STATE.DOOR_OPEN && currentState !== ELEVATOR_STATE.ESTOP) return true;
    if (CarDoor.state.busy || CharacterWalk.active || DemoExit.active || DemoPause.demo || overspeedActive || !document.getElementById('fault-reset').hidden) return true;
    return gsap.globalTimeline.getChildren(true, true, false).some(t => t.isActive());
  }
  // renderLoop 맨 앞: false 면 이번 rAF 는 건너뛴다.
  function frame() {
    if (off) return true;
    const now = performance.now();
    let active = true;
    try { active = busy(); } catch (e) { /* 판단 불가면 원래 속도 */ }
    if (active) lastActive = now;
    const quiet = now - lastActive, next = quiet < IDLE_AFTER ? 0 : quiet < DEEP_AFTER ? 1 : 2;
    if (next && now - lastRender < GAP[next] - 2) return false;
    prevMode = mode; mode = next; lastRender = now;
    return true;
  }
  // renderLoop 맨 끝: 카메라(감쇠·연출 포함)나 그림자 캐스터가 바뀌었으면 활동으로 본다.
  function after() {
    if (off) return;
    const e = camera.matrixWorld.elements, t = controls.target;
    let moved = false;
    for (let i = 0; i < 16; i++) if (cam[i] !== e[i]) { cam[i] = e[i]; moved = true; }
    if (cam[16] !== t.x || cam[17] !== t.y || cam[18] !== t.z) { cam[16] = t.x; cam[17] = t.y; cam[18] = t.z; moved = true; }
    if (moved || performance.now() - (scene.userData.shadowChangedAt || 0) < 300) wake();
  }
  // 깊은 정지에서는 부품 발광 맥동을 늦춰 낮은 프레임에서도 끊겨 보이지 않게 한다(초 단위 연속 시계).
  function pulseTime(now) {
    if (pulseReal) pulseClock += (now - pulseReal) * (mode === 2 ? .35 : mode === 1 ? .7 : 1);
    pulseReal = now;
    return pulseClock;
  }

  return { frame, after, pulseTime, get mode() { return mode; }, get throttled() { return mode !== 0 || prevMode !== 0; }, off };
})();
