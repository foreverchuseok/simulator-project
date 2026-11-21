// 저FPS 기기만 해상도 배율(DPR)·그림자 맵 크기를 단계적으로 낮춘다 (2026-11-21 최적화 2단계).
// 0단계가 현재 화질이다. GPU를 기다리느라 느릴 때(프레임 간격 ≫ CPU 시간)만 낮춘다.
// S22+ 실측: 기본 화면은 CPU(그리기 호출) 병목이라 DPR 2→1.25 로도 빨라지지 않았고(14→12.8fps),
// 종단 스위치 시연은 GPU 대기가 있어 19.8→27.2fps 로 빨라졌다. DPR 1 은 1.25 와 차이가 없어 두지 않는다.
// 그림자 켜기/끄기·PCFSoft 종류 변경은 모든 재질 셰이더를 다시 컴파일해 멈춤이 생기므로 하지 않는다.
// ?quality=0~2 고정, ?quality=auto 자동. 자동 검사 브라우저(navigator.webdriver)는 기존 검사 재현성을 위해 0단계 고정.
const AdaptiveQuality = (() => {
  const LEVELS = [
    { dpr: 2, shadow: 2048 },
    { dpr: 1.5, shadow: 2048 },
    { dpr: 1.25, shadow: 1024 }
  ];
  const WINDOW_MS = 3000, LOW_FPS = 38, HIGH_FPS = 55, GPU_WAIT = 1.15, SETTLE_MS = 2500, RELAPSE_MS = 15000, LOCK_MS = 60000;
  const param = new URLSearchParams(location.search).get('quality'), fixed = /^[0-2]$/.test(param);
  let mode = fixed || (navigator.webdriver && param !== 'auto') ? 'fixed' : 'auto';
  let level = fixed ? +param : 0;
  // 올렸다가 곧 다시 내려간 단계 위로는 60초 동안 다시 올리지 않는다(왕복 방지).
  // 세션 내내 잠그면 GPU 무거운 시연 뒤 CPU 병목인 기본 화면까지 낮은 화질에 머문다(S22+ 실측).
  let ceiling = 0, ceilingUntil = 0;
  let intervals = [], cpu = [], winStart = 0, bad = 0, good = 0, settleUntil = 0, raisedAt = -Infinity;
  const history = [];
  const loaded = () => document.getElementById('loading')?.classList.contains('hide');
  const median = a => a.sort((x, y) => x - y)[a.length >> 1];

  function apply(next, reason) {
    level = next;
    const L = LEVELS[level], dpr = Math.min(window.devicePixelRatio || 1, L.dpr);
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);   // 내부에서 setSize 로 캔버스도 갱신
    scene.traverse(o => {
      if (!o.isLight || !o.castShadow) return;
      const base = o.userData.baseShadowSize ??= o.shadow.mapSize.x, size = Math.min(base, L.shadow);
      if (o.shadow.mapSize.x === size) return;
      o.shadow.mapSize.set(size, size);
      if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }   // r128 은 크기가 바뀌어도 맵을 새로 만들지 않는다
    });
    renderer.shadowMap.needsUpdate = true;
    settleUntil = performance.now() + SETTLE_MS; intervals = []; cpu = []; winStart = 0; bad = good = 0;
    history.push({ t: Math.round(performance.now()), level, dpr, reason });
  }

  function sample(s) {
    if (mode !== 'auto' || s.throttled || document.hidden || !loaded()) { intervals = []; cpu = []; winStart = 0; return; }
    const now = s.at ?? performance.now();   // at: 검사 도구가 넣는 가상 시각
    if (now < settleUntil || !s.interval || s.interval > 250) return;
    if (!winStart) winStart = now;
    intervals.push(s.interval); cpu.push(s.update + s.draw + s.extra);
    if (now - winStart < WINDOW_MS) return;
    const interval = median(intervals), fps = 1000 / interval, gpuWait = interval > median(cpu) * GPU_WAIT + 2;
    intervals = []; cpu = []; winStart = 0;
    // 느려도 CPU 병목이면 화질을 낮춰 봐야 소용없다. 낮춘 상태에서 CPU 병목이면 화질을 되돌려도 된다.
    if (fps < LOW_FPS && gpuWait) { bad++; good = 0; }
    else if (fps >= HIGH_FPS || !gpuWait) { good++; bad = 0; }
    else bad = good = 0;
    if (ceiling && now > ceilingUntil) ceiling = 0;
    if (bad >= 2 && level < LEVELS.length - 1) {
      if (now - raisedAt < RELAPSE_MS) { ceiling = Math.max(ceiling, level + 1); ceilingUntil = now + LOCK_MS; }
      apply(level + 1, `자동 ↓ ${fps.toFixed(0)}fps GPU 대기`);
    } else if (good >= 4 && level > ceiling) {
      raisedAt = now;
      apply(level - 1, `자동 ↑ ${fps.toFixed(0)}fps`);
    }
  }

  function init() {
    if (level) apply(level, '?quality');
    PerfMonitor.listen(sample);
  }
  function set(value) {
    if (value === 'auto') { mode = 'auto'; ceiling = 0; settleUntil = performance.now() + SETTLE_MS; return; }
    mode = 'fixed'; apply(Math.max(0, Math.min(LEVELS.length - 1, value | 0)), '수동');
  }
  const cycle = () => set(mode === 'auto' ? 0 : level === LEVELS.length - 1 ? 'auto' : level + 1);
  const describe = () => ({ mode, level, dpr: renderer.getPixelRatio(), shadow: LEVELS[level].shadow, ceiling, history: history.slice(-8) });

  return { init, set, cycle, describe, LEVELS, feed: sample, get level() { return level; }, get mode() { return mode; } };
})();
