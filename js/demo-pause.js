/* ─────────────────────────────────────────────────────────────
   모든 시연 공통 일시정지 (사용자 2026-10-03 「모든 시연 장면에 일시정지」)
   ▪ 자체 일시정지가 있는 완충기(BufferDemo)·문 이탈방지(RetentionDemo)는 제외하고,
     나머지 시연이 진행 중일 때 상단 가운데에 「❚❚ 일시정지」를 띄운다(완충기 버튼과 같은 자리·모양).
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
    ['인터록', () => typeof InterlockDemo !== 'undefined' && InterlockDemo.floor >= 0],
    ['연동로프', () => typeof RelayRopeDemo !== 'undefined' && RelayRopeDemo.active],
    ['조속기 과속', () => typeof overspeedActive !== 'undefined' && overspeedActive]
  ];
  let btn = null, paused = false, saved = null;
  const current = () => DEMOS.find(([, on]) => { try { return on(); } catch (e) { return false; } });
  function build() {
    btn = document.createElement('button'); btn.id = 'demo-pause'; btn.type = 'button'; btn.hidden = true;
    btn.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:122;padding:8px 18px;border-radius:999px;border:1px solid #ffd24d;background:#142230ee;color:#ffd24d;font:700 14px/1 sans-serif;cursor:pointer;box-shadow:0 0 14px #ffb21e66';
    btn.addEventListener('click', () => set(!paused));
    document.body.appendChild(btn);
    label();
  }
  function label() { if (btn) { btn.textContent = paused ? '▶ 재생' : '❚❚ 일시정지'; btn.setAttribute('aria-pressed', String(paused)); } }
  function set(on) {
    on = !!on;
    if (on === paused || (on && !current())) return;
    paused = on;
    if (on) {
      saved = { p: camera.position.clone(), t: controls.target.clone(), enabled: controls.enabled, estop };
      gsap.globalTimeline.pause();
      MACH.hold?.(true);
      controls.enabled = true;   // 멈춘 동안 둘러보기
    } else {
      const s = saved; saved = null;
      gsap.globalTimeline.resume();
      MACH.hold?.(false);
      if (s) {
        controls.enabled = s.enabled;
        if (!gsap.isTweening(camera.position)) {
          gsap.to(camera.position, { x: s.p.x, y: s.p.y, z: s.p.z, duration: .6, ease: 'power2.inOut' });
          gsap.to(controls.target, { x: s.t.x, y: s.t.y, z: s.t.z, duration: .6, ease: 'power2.inOut', onUpdate: () => controls.update() });
        }
      }
    }
    label();
  }
  // 렌더 루프에서 호출 — 버튼 표시·자동 해제만 한다.
  function update() {
    if (!btn) return;
    const demo = current();
    // 상승과속·브레이크 비교는 시연 중 스스로 estop 을 켠다 — 멈춘 뒤 사용자가 새로 누른 비상정지만 해제 조건이다.
    if (paused && (!demo || (estop && !saved?.estop))) set(false);
    btn.hidden = !demo;
    if (demo) btn.title = demo[0] + ' 시연 일시정지·재생';
    if (innerWidth < 800) Object.assign(btn.style, { left: '8px', top: '76px', transform: 'none' });
    // 상단 가운데 12~56px 은 개문발차·상승과속의 「종료 · 정상 복귀」 버튼 자리 — 그 아래에 둔다.
    else Object.assign(btn.style, { left: '50%', top: '64px', transform: 'translateX(-50%)' });
  }
  return { build, update, set, toggle: () => set(!paused), get paused() { return paused; }, get demo() { return current()?.[0] || null; } };
})();
