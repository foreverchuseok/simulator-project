/* ─────────────────────────────────────────────────────────────
   모바일 HUD (2026-10-05 모바일 개편) — 세로 폰 ≤600px · 가로 폰 높이 ≤500px 전용. PC 화면은 desktop-hud.js.
   ▪ 하단 바 하나에 조작을 모은다: 운행(층·도어 띠 열기) · 전체 보기 · 카 정면 · 체험 · 설정 · 비상정지.
   ▪ 바는 상황에 따라 바뀐다(body[data-m-mode]):
       base — 위 기본 조작
       walk — 승곰이 체험: 시작 위치 · 체험 종료 (방향키는 왼쪽, 호출·층 버튼은 체험 패널)
       demo — 시연: 일시정지 · 고장 복귀 · 시연 종료 · 비상정지 (층·도어·시점 버튼은 숨김)
   ▪ 기존 버튼의 id·이벤트를 그대로 쓴다. 바에 옮긴 노드(비상정지·일시정지·고장 복귀)는 주석 자리표시로
     원래 위치를 기억했다가 PC·태블릿 화면으로 바뀌면 되돌린다. 나머지 바 버튼은 원본을 누르는 대리 버튼이다.
   ───────────────────────────────────────────────────────────── */
const MobileHUD = (() => {
  const media = matchMedia('(max-width: 600px) and (orientation: portrait), (max-height: 500px) and (orientation: landscape)');
  const homes = new Map();
  const $ = id => document.getElementById(id);
  let bar, runBtn, exitBtn, mode = '', runOpen = false;

  const ICON = {
    run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 9.5 12 6.5l3 3M9 14.5l3 3 3-3"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
    cabin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M12 16.5v-4.2"/><path d="M9.2 14.6 12 11.8l2.8 2.8"/></svg>',
    walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="m9 21 2-6 3 2 1 4M7 12l3-4h4l3 3M11 15l-1-5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.4" fill="currentColor"/><circle cx="15" cy="17" r="2.4" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h13M8 7l-5 5 5 5"/><path d="M21 5v14"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>'
  };

  function barButton(id, modes, icon, label, onClick) {
    const b = document.createElement('button');
    b.id = id; b.type = 'button'; b.className = 'm-btn'; b.dataset.modes = modes;
    b.innerHTML = (ICON[icon] || '') + '<span>' + label + '</span>';
    b.addEventListener('click', onClick);
    bar.append(b);
    return b;
  }

  // 바로 옮기는 원본 노드 — 자리표시 주석 뒤로 되돌릴 수 있게 한다(desktop-hud.js 와 같은 방식).
  function adopt(node, slotClass) {
    if (!node) return;
    if (!homes.has(node)) {
      const home = document.createComment('mobile-hud: ' + node.id);
      node.before(home); homes.set(node, home);
    }
    node.classList.add('m-adopted', slotClass);
    bar.querySelector('.' + slotClass + '-slot').replaceWith(node);
  }
  function release() {
    homes.forEach((home, node) => {
      if (node.parentNode === bar) {
        const slot = document.createElement('span');
        slot.className = [...node.classList].find(c => c.startsWith('m-slot-')) + '-slot';
        node.replaceWith(slot);
      }
      node.classList.remove('m-adopted');
      home.after(node);
    });
  }

  function setRun(open) {
    runOpen = !!open && mode === 'base';
    document.body.classList.toggle('m-run-open', runOpen);
    runBtn.classList.toggle('active', runOpen);
    runBtn.setAttribute('aria-expanded', String(runOpen));
  }

  // 시연별 「끝내고 정상으로」 경로. 패널에 보이는 종료 버튼을 먼저 쓰고, 없으면 비상정지 경로(각 시연의 중단·복귀)를 쓴다.
  const PANEL_EXITS = ['ovs-exit', 'manual-rescue-exit', 'photo-eye-exit', 'rope-measure-exit', 'terminal-demo-end', 'terminal-demo-exit',
    'relay-demo-exit', 'interlock-demo-cancel', 'retention-demo-exit', 'ard-restore'];
  const shown = el => !!el && !el.hidden && !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  function exitTarget() {
    for (const id of PANEL_EXITS) { const el = $(id); if (shown(el)) return () => el.click(); }
    if (typeof ARDDemo !== 'undefined' && ARDDemo.active) return () => { ARDDemo.halt(); ARDDemo.reset(); };
    if (typeof BufferDemo !== 'undefined' && BufferDemo.active) return () => { if (BufferDemo.state.stage === 'approach') BufferDemo.halt(); BufferDemo.reset(); };
    const estopCancels = [
      typeof UCMDemo !== 'undefined' && UCMDemo.state.active, typeof AscentDemo !== 'undefined' && AscentDemo.active,
      typeof BrakeDemo !== 'undefined' && BrakeDemo.active, typeof ManualRescueDemo !== 'undefined' && ManualRescueDemo.active,
      typeof PhotoEyeDemo !== 'undefined' && PhotoEyeDemo.active, typeof RopeMeasure !== 'undefined' && RopeMeasure.active,
      typeof TerminalDemo !== 'undefined' && TerminalDemo.active
    ];
    if (estopCancels.some(Boolean)) return () => $('btn-estop').click();
    return null;
  }

  function demoActive() {
    try {
      return !!(DemoPause.demo || overspeedActive || UCMDemo.state.active || BufferDemo.active || ARDDemo.active || RetentionDemo.active ||
        !$('fault-reset').hidden);
    } catch (e) { return false; }
  }

  // 렌더 루프에서 호출 — 바 모드·라벨만 갱신한다(가벼운 DOM 비교만).
  function update() {
    if (!bar || !media.matches) return;
    const next = demoActive() ? 'demo' : CharacterWalk.active ? 'walk' : 'base';
    if (next !== mode) {
      mode = next; document.body.dataset.mMode = mode;
      if (mode !== 'base') setRun(false);
    }
    $('m-cabin').setAttribute('aria-pressed', $('c-cabin').getAttribute('aria-pressed') || 'false');
    $('m-cabin').classList.toggle('active', $('c-cabin').getAttribute('aria-pressed') === 'true');
    $('m-walk').hidden = $('walk-toggle').hidden;
    $('m-settings').classList.toggle('active', $('dd-view').classList.contains('open'));
    if (mode === 'demo') {
      const ucmExit = $('ucm-exit');
      const latched = !$('fault-reset').hidden || shown(ucmExit);
      const target = latched ? null : exitTarget();
      exitBtn.hidden = latched;
      exitBtn.disabled = !target;
      exitBtn.title = target ? '시연을 끝내고 정상 운행 화면으로' : '진행 중인 장면이 끝나면 종료할 수 있습니다';
    }
  }

  function sync() {
    const on = media.matches;
    document.body.classList.toggle('m-hud', on);
    bar.hidden = !on;
    if (on) {
      adopt($('demo-pause'), 'm-slot-pause');
      adopt($('fault-reset'), 'm-slot-reset');
      adopt($('btn-estop'), 'm-slot-estop');
      mode = ''; update();
    } else {
      setRun(false);
      release();
      delete document.body.dataset.mMode; mode = '';
    }
  }

  function buildScreenSection() {
    // 설정 시트에 화면 관련 동작을 모은다 — 전체 화면(주소창 숨김)·화면만 보기(도구 숨김)·처음 상태로(새로 불러오기)는 서로 다르다.
    const sheet = $('dd-view');
    const wrap = document.createElement('div');
    wrap.className = 'm-only m-screen';
    wrap.innerHTML = '<h4>화면</h4><div class="m-screen-row">' +
      '<button type="button" id="m-fullscreen" class="m-screen-btn"><b>전체 화면</b><small>주소창 숨김</small></button>' +
      '<button type="button" id="m-clean" class="m-screen-btn"><b>화면만 보기</b><small>버튼 잠시 숨김</small></button>' +
      '</div><button type="button" id="m-reload" class="m-screen-btn m-reload"><b>처음 상태로</b><small>진행 중인 운행·시연을 모두 끝내고 새로 불러옵니다</small></button>';
    sheet.querySelector('.sheet-head').after(wrap);
    const fs = $('m-fullscreen');
    const canFull = !!document.documentElement.requestFullscreen;
    fs.hidden = !canFull;
    const paintFull = () => { const on = !!document.fullscreenElement; fs.setAttribute('aria-pressed', String(on)); fs.querySelector('b').textContent = on ? '전체 화면 끝내기' : '전체 화면'; };
    fs.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    });
    document.addEventListener('fullscreenchange', paintFull); paintFull();
    $('m-clean').addEventListener('click', () => { closeAllMenus(); $('mobile-visibility').click(); });
    $('m-reload').addEventListener('click', () => location.replace(location.pathname));
  }

  function init() {
    const hud = $('hud');
    bar = document.createElement('nav');
    bar.id = 'm-bar'; bar.className = 'glass'; bar.hidden = true; bar.setAttribute('aria-label', '모바일 조작');
    hud.append(bar);
    runBtn = barButton('m-run', 'base', 'run', '운행', () => {
      const open = !runOpen;
      if (open) closeAllMenus();
      setRun(open);
    });
    runBtn.setAttribute('aria-controls', 'dd-op'); runBtn.setAttribute('aria-expanded', 'false');
    barButton('m-home', 'base', 'home', '전체 보기', () => { setRun(false); $('overview-home').click(); });
    barButton('m-cabin', 'base', 'cabin', '카 정면', () => { setRun(false); closeAllMenus(); $('c-cabin').click(); });
    barButton('m-walk', 'base', 'walk', '체험', () => { setRun(false); closeAllMenus(); $('walk-toggle').click(); });
    barButton('m-walk-home', 'walk', 'back', '시작 위치', () => $('walk-home').click());
    barButton('m-walk-exit', 'walk', 'exit', '체험 종료', () => $('walk-exit').click());
    bar.insertAdjacentHTML('beforeend', '<span class="m-slot-pause-slot"></span><span class="m-slot-reset-slot"></span>');
    exitBtn = barButton('m-demo-exit', 'demo', 'exit', '시연 종료', () => {});
    // 시연 모듈은 document 캡처 단계에서 허용목록 밖의 버튼을 막는다. 「시연 종료」는 window 캡처에서 먼저 받아
    // 각 시연이 이미 허용하는 종료 경로(패널 종료 버튼·비상정지·고장 복귀)로만 넘긴다.
    window.addEventListener('click', e => {
      if (!e.target.closest?.('#m-demo-exit')) return;
      e.stopImmediatePropagation();
      const go = !exitBtn.disabled && exitTarget();
      if (go) go();
    }, true);
    const settings = barButton('m-settings', 'base walk', 'settings', '설정', () => {
      setRun(false);
      $('pc-settings-source').click();   // 원본 레일 버튼 — 시트 열기·닫기·세그먼트 갱신을 그대로 쓴다
    });
    settings.setAttribute('aria-controls', 'dd-view');
    bar.insertAdjacentHTML('beforeend', '<span class="m-slot-estop-slot"></span>');
    buildScreenSection();
    // 다른 시트를 열면 운행 띠를 닫아 겹치지 않게 한다.
    document.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => setRun(false)));
    media.addEventListener('change', sync);
    sync();
  }

  return { init, update, setRun, get mode() { return mode; }, get runOpen() { return runOpen; }, isMobile: () => media.matches };
})();
