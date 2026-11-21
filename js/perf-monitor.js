// 렌더 성능 계측 (2026-11-21 최적화 1단계).
// 항상: 렌더한 프레임의 간격·CPU 시간을 가볍게 재어 AdaptiveQuality 등 구독자에게 넘긴다.
// ?fps: 화면 표시 + 갱신(JS)·그리기·그림자 검사/갱신·호출·삼각형을 프레임마다 끊김 없이 기록한다.
//   rAF 간격만 보면 16.7ms 단위로 뭉개지므로, CPU 구간은 performance.now()로 따로 잰다.
//   CPU 합계보다 프레임 간격이 크게 길면 GPU(또는 화면 동기) 대기다.
const PerfMonitor = (() => {
  const on = /[?&]fps(=|&|$)/.test(location.search);
  const N = 8192;                         // 120Hz 약 68초 분량
  const ring = {
    at: new Float64Array(N), interval: new Float32Array(N), update: new Float32Array(N), draw: new Float32Array(N),
    extra: new Float32Array(N), check: new Float32Array(N), shadow: new Float32Array(N),
    calls: new Uint32Array(N), tris: new Uint32Array(N), dpr: new Float32Array(N), throttled: new Uint8Array(N)
  };
  let head = 0, size = 0, last = 0, t0 = 0, t1 = 0, t2 = 0, throttled = false;
  let checkMs = 0, shadowMs = 0, shadowCount = 0;
  const listeners = [];
  let panel, text, result, recordBtn, qualityBtn, recording = null, shownAt = 0;

  function install(scene, renderer) {
    if (!on) return;
    renderer.info.autoReset = false;      // 메인·발광·인셋 패스를 한 프레임으로 합산한다
    const before = scene.onBeforeRender;  // installShadowCache 의 그림자 변경 검사
    scene.onBeforeRender = function (...a) { const t = performance.now(); before.apply(this, a); checkMs += performance.now() - t; };
    const sm = renderer.shadowMap, render = sm.render;
    sm.render = function (...a) {
      const work = sm.enabled && (sm.autoUpdate || sm.needsUpdate), t = performance.now();
      render.apply(this, a);
      if (work) { shadowCount++; shadowMs += performance.now() - t; }
    };
    buildPanel();
  }

  // renderLoop: frameStart → (갱신) → updateDone → renderer.render → drawDone → (발광·인셋) → frameEnd
  function frameStart(isThrottled) {
    t0 = performance.now(); throttled = !!isThrottled;
    if (on) { renderer.info.reset(); checkMs = 0; shadowMs = 0; }
  }
  const updateDone = () => { t1 = performance.now(); };
  const drawDone = () => { t2 = performance.now(); };
  function frameEnd() {
    const t3 = performance.now(), interval = last ? t0 - last : 0;
    last = t0;
    const sample = { interval, update: t1 - t0, draw: t2 - t1, extra: t3 - t2, throttled };
    for (const fn of listeners) fn(sample);
    if (!on || !interval) return;
    const i = head;
    ring.at[i] = t0; ring.interval[i] = interval; ring.update[i] = sample.update; ring.draw[i] = sample.draw; ring.extra[i] = sample.extra;
    ring.check[i] = checkMs; ring.shadow[i] = shadowMs;
    ring.calls[i] = renderer.info.render.calls; ring.tris[i] = renderer.info.render.triangles;
    ring.dpr[i] = renderer.getPixelRatio(); ring.throttled[i] = throttled ? 1 : 0;
    head = (head + 1) % N; size = Math.min(N, size + 1);
    if (recording) recording.frames.push(i);
    if (t3 - shownAt > 500) { shownAt = t3; showLive(); }
    if (recording && t0 - recording.start >= recording.seconds * 1000) finishRecording();
  }

  /* ── 통계 ── */
  function indicesSince(ms) {
    const out = [], from = performance.now() - ms;
    for (let k = 1; k <= size; k++) { const i = (head - k + N) % N; if (ring.at[i] < from) break; out.push(i); }
    return out;
  }
  function stat(idx, arr) {
    const v = idx.map(i => arr[i]).sort((a, b) => a - b), q = p => v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 0;
    return { median: +q(.5).toFixed(2), p95: +q(.95).toFixed(2), p99: +q(.99).toFixed(2), max: +(v.at(-1) || 0).toFixed(2) };
  }
  function summarize(idx, elapsedMs) {
    const cpu = Float32Array.from(idx, i => ring.update[i] + ring.draw[i] + ring.extra[i]);
    const shadowFrames = idx.filter(i => ring.shadow[i] > 0);
    return {
      frames: idx.length, seconds: +(elapsedMs / 1000).toFixed(1), fps: +(idx.length / (elapsedMs / 1000)).toFixed(1),
      intervalMs: stat(idx, ring.interval),
      longFrames50ms: idx.filter(i => ring.interval[i] > 50).length,
      cpuMs: stat(Array.from(cpu, (_, k) => k), cpu),
      cpuBusyMsPerSecond: +(cpu.reduce((a, b) => a + b, 0) / (elapsedMs / 1000)).toFixed(1),   // 발열·배터리 대리 지표
      updateMs: stat(idx, ring.update), drawMs: stat(idx, ring.draw), glowInsetMs: stat(idx, ring.extra),
      shadowCheckMs: stat(idx, ring.check),
      shadowUpdates: { frames: shadowFrames.length, perSecond: +(shadowFrames.length / (elapsedMs / 1000)).toFixed(2), ms: stat(shadowFrames, ring.shadow) },
      calls: stat(idx, ring.calls), triangles: stat(idx, ring.tris),
      dpr: [...new Set(idx.map(i => ring.dpr[i]))], throttledFrames: idx.filter(i => ring.throttled[i]).length
    };
  }
  function environment() {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), ua: navigator.userAgent,
      viewport: [innerWidth, innerHeight], devicePixelRatio, quality: typeof AdaptiveQuality !== 'undefined' ? AdaptiveQuality.describe() : null
    };
  }

  /* ── 연속 기록 ── */
  function record(seconds = 60, label = '') {
    if (!on) return Promise.reject(new Error('?fps 모드에서만 기록합니다'));
    if (recording) return recording.promise;
    let resolve; const promise = new Promise(r => { resolve = r; });
    recording = { seconds, label, start: performance.now(), frames: [], resolve, promise };
    if (result) result.hidden = true;
    return promise;
  }
  function finishRecording() {
    const r = recording; recording = null;
    // 링 버퍼가 한 바퀴 돌면 앞부분이 덮이므로 기록 길이는 N 프레임 이하로 둔다.
    const idx = r.frames.slice(-N), elapsed = idx.length > 1 ? ring.at[idx.at(-1)] - ring.at[idx[0]] + ring.interval[idx[0]] : 1;
    const summary = { label: r.label, at: new Date().toISOString(), ...summarize(idx, elapsed), env: environment() };
    PerfMonitor.results.push(summary);
    console.log('[fps]', JSON.stringify(summary));
    showResult(summary);
    r.resolve(summary);
  }

  /* ── 화면 ── */
  function buildPanel() {
    const style = document.createElement('style');
    style.textContent = `#perf-panel{position:fixed;z-index:9999;top:calc(env(safe-area-inset-top) + 64px);left:50%;transform:translateX(-50%);
      width:max-content;max-width:calc(100vw - 140px);box-sizing:border-box;padding:6px 8px;border-radius:8px;background:#0f172ad9;color:#e2e8f0;
      font:11px/1.45 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:keep-all;pointer-events:none}
      #perf-panel button{pointer-events:auto;margin:4px 4px 0 0;padding:3px 7px;border:1px solid #64748b;border-radius:6px;background:#1e293b;color:#f8fafc;font:inherit}
      #perf-panel .perf-result{white-space:pre-wrap;margin-top:4px;border-top:1px solid #334155;padding-top:4px}`;
    document.head.append(style);
    panel = document.createElement('div'); panel.id = 'perf-panel';
    text = document.createElement('div');
    recordBtn = document.createElement('button'); recordBtn.type = 'button'; recordBtn.textContent = '60초 측정';
    recordBtn.addEventListener('click', () => record(60, 'manual'));
    qualityBtn = document.createElement('button'); qualityBtn.type = 'button';
    qualityBtn.addEventListener('click', () => { if (typeof AdaptiveQuality !== 'undefined') AdaptiveQuality.cycle(); showLive(); });
    result = document.createElement('div'); result.className = 'perf-result'; result.hidden = true;
    panel.append(text, recordBtn, qualityBtn, result);
    document.body.append(panel);
  }
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(n);
  function showLive() {
    if (!text) return;
    const idx = indicesSince(2000);
    if (!idx.length) return;
    const s = summarize(idx, 2000), q = typeof AdaptiveQuality !== 'undefined' ? AdaptiveQuality.describe() : null;
    // 모바일 폭(약 230px)에서 줄마다 한 줄로 들어가도록 짧게 쓴다.
    text.textContent =
      `${s.fps.toFixed(0)}fps · 간격 ${s.intervalMs.median.toFixed(1)} p95 ${s.intervalMs.p95.toFixed(1)}\n` +
      `CPU ${s.cpuMs.median.toFixed(1)} · JS ${s.updateMs.median.toFixed(1)} · 그리기 ${s.drawMs.median.toFixed(1)}\n` +
      `발광 ${s.glowInsetMs.median.toFixed(1)} · 그림자 ${s.shadowCheckMs.median.toFixed(1)} · 갱신 ${s.shadowUpdates.perSecond}/s\n` +
      `호출 ${s.calls.median} · 삼각형 ${fmt(s.triangles.median)}${s.throttledFrames ? ' · 절약' : ''}\n` +
      `${typeof ScreenCull !== 'undefined' && !ScreenCull.off ? `컬링 ${ScreenCull.culled} · ` : ''}DPR ${renderer.getPixelRatio()}${q ? ` · 품질 ${q.level} ${q.mode === 'auto' ? '자동' : '고정'}` : ''}` +
      (recording ? `\n측정 중 ${Math.ceil(recording.seconds - (performance.now() - recording.start) / 1000)}초` : '');
    qualityBtn.textContent = q ? `품질 ${q.mode === 'auto' ? '자동' : q.level}` : '품질';
    recordBtn.disabled = !!recording;
  }
  function showResult(s) {
    result.hidden = false;
    result.textContent = `결과 ${s.seconds}초 · ${s.frames}프레임 · ${s.fps} fps\n간격 중앙 ${s.intervalMs.median} · p95 ${s.intervalMs.p95} · 50ms↑ ${s.longFrames50ms}\n` +
      `CPU 중앙 ${s.cpuMs.median} · p95 ${s.cpuMs.p95}\n호출 ${s.calls.median} (최대 ${s.calls.max}) · 삼각형 ${fmt(s.triangles.median)}`;
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = '결과 복사';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(JSON.stringify(s, null, 1)).then(() => { copy.textContent = '복사됨'; }, () => { copy.textContent = '복사 실패'; }));
    result.append(document.createElement('br'), copy);
  }

  return {
    on, install, frameStart, updateDone, drawDone, frameEnd, record, results: [],
    listen: fn => listeners.push(fn), live: ms => summarize(indicesSince(ms), ms), get recording() { return !!recording; }
  };
})();
