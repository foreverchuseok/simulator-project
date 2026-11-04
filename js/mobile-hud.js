/* ─────────────────────────────────────────────────────────────
   모바일 HUD (2026-10-05 모바일 개편) — 세로 폰 ≤600px · 가로 폰 높이 ≤500px 전용. PC 화면은 desktop-hud.js.
   ▪ 하단 바: 운행 · 관찰 · 체험 · 설정 · 비상정지. 운행 패널에 층·도어·수동, 관찰 패널에 전체 보기·카 정면을 둔다.
     수동이면 PC 패널의 ▲▼(#pc-manual-controls)를 바 위로 옮겨 띄운다.
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
  let bar, runBtn, insBtn, exitBtn, mode = '', runOpen = false, manualHome = null;

  const ICON = {
    ins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.6-.7-.7-2.6z"/></svg>',
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
    if (runOpen && demoWrap) demoWrap.classList.remove('open'), demoFab.setAttribute('aria-expanded', 'false'), demoList.hidden = true;
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

  // 시연 넓게 보기(사용자 2026-10-05 「모바일은 시연 시야가 너무 좁다 · 캐릭터가 너무 크다」).
  // 세로 폰은 가로 화각이 PC 의 절반 남짓이라 옆 승장 바닥 높이·주변 구도가 잘린다. 카메라를 실제로 뒤로 빼면
  // 승강로 벽을 뚫으므로, 위치·각 시연의 카메라 경로는 그대로 두고 camera.zoom(<1)으로 화각만 넓힌다.
  // 시연이 이미 넓은 fov 를 쓰면(카 안 88°·완충기 피트) 실효 세로 화각이 WIDE_MAX_FOV 를 넘지 않게 덜 넓힌다.
  const WIDE_ZOOM = { portrait: 0.62, landscape: 0.85 }, WIDE_MAX_FOV = 80;
  function wideView() {
    let goal = 1;
    if (media.matches && mode === 'demo') {
      const base = camera.aspect < 1 ? WIDE_ZOOM.portrait : WIDE_ZOOM.landscape;
      const deg = THREE.MathUtils.degToRad;
      goal = Math.min(1, Math.max(base, Math.tan(deg(camera.fov / 2)) / Math.tan(deg(WIDE_MAX_FOV / 2))));
    }
    if (Math.abs(camera.zoom - goal) < 1e-3) { if (camera.zoom !== goal) { camera.zoom = goal; camera.updateProjectionMatrix(); } return; }
    camera.zoom += (goal - camera.zoom) * 0.12;
    camera.updateProjectionMatrix();
  }

  // 렌더 루프에서 호출 — 바 모드·라벨만 갱신한다(가벼운 DOM 비교만).
  function update() {
    if (!bar) return;
    wideView();
    if (!media.matches) return;
    const next = demoActive() ? 'demo' : CharacterWalk.active ? 'walk' : 'base';
    if (next !== mode) {
      mode = next; document.body.dataset.mMode = mode;
      if (mode !== 'base') { setRun(false); if (demoWrap) setDemoMenu(false); }
    }
    // 렌더 루프에서 매 프레임 불리므로 값이 바뀔 때만 DOM 을 쓴다(같은 값을 다시 써도 스타일 무효화·:has() 재계산이 일어난다).
    const attr = (el, name, v) => { v = String(v); if (el.getAttribute(name) !== v) el.setAttribute(name, v); };
    const flag = (el, cls, on) => { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); };
    const insBusy = InspectionReturn.busy || inspectionResetting;
    attr(insBtn, 'aria-pressed', insMode);
    if (insBtn.disabled !== !!insBusy) insBtn.disabled = !!insBusy;
    const insTitle = insMode ? '수동(점검)운전 중 — 다시 누르면 자동운전으로' : '수동(점검)운전 — ▲▼ 누르는 동안 서행';
    if (insBtn.title !== insTitle) insBtn.title = insTitle;
    const cabinOn = $('c-cabin').getAttribute('aria-pressed') === 'true';
    attr($('m-cabin'), 'aria-pressed', cabinOn);
    flag($('m-cabin'), 'active', cabinOn);
    if ($('m-walk').hidden !== $('walk-toggle').hidden) $('m-walk').hidden = $('walk-toggle').hidden;
    const setOpen = $('dd-view').classList.contains('open');
    flag($('m-settings'), 'active', setOpen);
    attr($('m-settings'), 'aria-expanded', setOpen);
    const viewOpen = $('dd-overview').classList.contains('open');
    flag($('m-view'), 'active', viewOpen);
    attr($('m-view'), 'aria-expanded', viewOpen);
    const insLabel = insMode ? '자동운전으로 전환' : '수동 점검운전';
    if (insBtn.querySelector('span').textContent !== insLabel) insBtn.querySelector('span').textContent = insLabel;
    if (mode === 'demo') {
      const ucmExit = $('ucm-exit');
      const latched = !$('fault-reset').hidden || shown(ucmExit);
      const target = latched ? null : exitTarget();
      if (exitBtn.hidden !== latched) exitBtn.hidden = latched;
      if (exitBtn.disabled !== !target) exitBtn.disabled = !target;
      const exitTitle = target ? '시연을 끝내고 정상 운행 화면으로' : '진행 중인 장면이 끝나면 종료할 수 있습니다';
      if (exitBtn.title !== exitTitle) exitBtn.title = exitTitle;
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
      // 점검 ▲▼ 는 PC 패널(모바일에선 숨김) 안에 있다 — 바 위로 옮긴다. 표시 여부는 desktop-hud.js state()가 그대로 정한다.
      const manual = $('pc-manual-controls');
      if (!manualHome) { manualHome = document.createComment('mobile-hud: pc-manual-controls'); manual.before(manualHome); }
      $('hud').append(manual);
      mode = ''; update();
    } else {
      setRun(false);
      release();
      if (manualHome) manualHome.after($('pc-manual-controls'));
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
    // 전체 화면에 들어가면 브라우저가 화면 아래에 「Esc 키를 누르세요」 안내를 띄워 하단 바를 가린다(웹에서 끌 수 없음).
    // 잠시 하단 조작부를 그 위로 올리고, 위쪽에 이유를 알려 준다(사용자 2026-10-05 영상).
    const notice = document.createElement('div');
    notice.id = 'm-fs-notice'; notice.hidden = true; notice.setAttribute('role', 'status');
    notice.textContent = '아래 브라우저 안내는 옆으로 밀거나 잠시 기다리면 사라집니다. 그동안 메뉴를 위로 올려 둡니다.';
    $('hud').append(notice);
    let noticeTimer = 0;
    const endNotice = () => { clearTimeout(noticeTimer); notice.hidden = true; document.body.classList.remove('m-fs-notice'); };
    notice.addEventListener('click', endNotice);
    document.addEventListener('fullscreenchange', () => {
      paintFull();
      if (!document.fullscreenElement || !media.matches) { endNotice(); return; }
      document.body.classList.add('m-fs-notice'); notice.hidden = false;
      clearTimeout(noticeTimer); noticeTimer = setTimeout(endNotice, 6000);
    });
    paintFull();
    $('m-clean').addEventListener('click', () => { closeAllMenus(); $('mobile-visibility').click(); });
    $('m-reload').addEventListener('click', () => location.replace(location.pathname));
  }

  // 시트(설정·보기)를 손가락으로 끌어내려 닫는다. 머리 부분은 언제나, 본문은 맨 위까지 스크롤된 상태에서만 끌린다.
  function bindSheetDrag(sheet) {
    let start = null, dy = 0, dragging = false;
    sheet.addEventListener('touchstart', e => {
      if (!media.matches || e.touches.length !== 1 || !sheet.classList.contains('open')) return;
      const t = e.touches[0], head = t.clientY - sheet.getBoundingClientRect().top < 64;
      if (!head && sheet.scrollTop > 0) return;
      start = { x: t.clientX, y: t.clientY, time: performance.now(), head }; dy = 0; dragging = false;
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!start) return;
      if (e.touches.length !== 1) { start = null; return; }
      const t = e.touches[0], d = t.clientY - start.y, dx = t.clientX - start.x;
      if (!dragging) {
        if (d > 8 && d > Math.abs(dx) && (start.head || sheet.scrollTop <= 0)) { dragging = true; sheet.style.transition = 'none'; }
        else { if (Math.abs(dx) > 8 || d < -8) start = null; return; }
      }
      e.preventDefault();
      dy = Math.max(0, d); sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: false });
    const end = () => {
      if (!start) return;
      const speed = dy / Math.max(1, performance.now() - start.time);
      start = null;
      if (!dragging) return;
      dragging = false; sheet.style.transition = '';
      if (dy > 90 || speed > 0.6) closeAllMenus();
      sheet.style.transform = '';
    };
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
  }


  /* ── 시연 메뉴 (2026-11-04) ─────────────────────────────────────────
     모바일에서는 3D 부품을 한 번 탭해 시연을 여는 방식이 없다(오터치 방지, PartGlow 가 모바일 탭을 무시한다).
     오른쪽의 「시연」 아이콘을 눌러 읽을 수 있는 이름의 목록에서 고르고, 고르면 목록은 바로 닫혀 3D 장면을 가리지 않는다.
     각 시연은 PC 부품 클릭이 부르는 것과 같은 시작 함수를 부른다(출발 조건·안내는 각 시연이 판단). 시작 후에는 하단 바가
     시연 모드로 바뀌어 일시정지 · 시연 종료만 남긴다. 한 시연의 단계는 자동 진행되며 시연끼리 이어 붙이지 않는다. */
  const DEMO_ICON = {
    gov: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="m12 10 4-5M10 13l-5 3m9-3 5 3"/>',
    door: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M9 12h.01M15 12h.01"/>',
    up: '<path d="M12 20V6M6 12l6-6 6 6"/><path d="M5 3h14"/>',
    brake: '<path d="M10 3v18m4-18v18M7 7H4v10h3m10-10h3v10h-3M4 12h4m8 0h4"/>',
    power: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5m0-1V5a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.3-1.9L8 14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    limit: '<path d="M5 4v16M5 8h9l-2-2m2 2-2 2M19 20V4"/>',
    rope: '<path d="M8 3v18M12 3v18M16 3v18"/><path d="M5 9h14M5 15h14" stroke-dasharray="2 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    link: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/>',
    buffer: '<path d="M6 21h12M9 21v-4h6v4M12 17V4M8 8h8"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'
  };
  const clickIf = id => () => { const b = $(id); if (b) b.click(); };
  const DEMOS = [
    ['gov', '조속기 과속', clickIf('btn-overspeed')],
    ['door', '개문발차(UCM)', () => UCMDemo.start($('btn-ucm'))],
    ['up', '상승과속', () => AscentDemo.start('normal')],
    ['brake', '브레이크 비교', () => BrakeDemo.start('dual')],
    ['power', 'ARD 자동구출', () => ARDDemo.start()],
    ['hand', '수동 구출', () => ManualRescueDemo.start()],
    ['eye', '문닫힘 안전장치', () => PhotoEyeDemo.start()],
    ['limit', '종단 스위치', clickIf('terminal-demo-USD')],
    ['rope', '주로프 측정', () => RopeMeasure.start()],
    ['lock', '인터록', () => InterlockDemo.start(1)],
    ['link', '연동로프', () => RelayRopeDemo.start(1)],
    ['buffer', '카 완충기', () => BufferDemo.start('car')],
    ['shield', '문 이탈방지', () => RetentionDemo.start(1)]
  ];
  let demoWrap, demoFab, demoList;
  function setDemoMenu(open) {
    open = !!open && media.matches && mode === 'base';
    demoWrap.classList.toggle('open', open);
    demoFab.setAttribute('aria-expanded', String(open));
    demoList.hidden = !open;
    if (open) { setRun(false); closeAllMenus(); }
  }
  function buildDemoMenu() {
    demoWrap = document.createElement('div');
    demoWrap.id = 'm-demo';
    demoWrap.innerHTML = '<button type="button" id="m-demo-fab" aria-label="시연 목록" aria-expanded="false" aria-controls="m-demo-list">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z" fill="currentColor"/></svg><span>시연</span></button>' +
      '<ul id="m-demo-list" role="menu" hidden></ul>';
    demoFab = demoWrap.querySelector('#m-demo-fab'); demoList = demoWrap.querySelector('#m-demo-list');
    for (const [icon, name, run] of DEMOS) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + DEMO_ICON[icon] + '</svg><span>' + name + '</span>';
      b.addEventListener('click', () => {
        setDemoMenu(false);   // 고르는 즉시 목록을 접어 장면을 가리지 않는다
        try { run(); } catch (err) { console.warn('시연 시작 실패:', name, err); }
      });
      li.append(b); demoList.append(li);
    }
    demoFab.addEventListener('click', () => setDemoMenu(!demoWrap.classList.contains('open')));
    // 바깥(3D 장면·다른 버튼)을 누르거나 Esc 로 접는다. 장면을 누른 터치는 그대로 카메라 조작으로 이어진다.
    document.addEventListener('pointerdown', e => { if (demoWrap.classList.contains('open') && !demoWrap.contains(e.target)) setDemoMenu(false); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setDemoMenu(false); });
    $('hud').append(demoWrap);
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
    // 수동(점검)운전: PC 패널의 자동/수동 버튼을 그대로 누른다 — 운행·시연 중 전환 차단은 desktop-hud.js 가 맡는다.
    insBtn = barButton('m-ins', 'base', 'ins', '수동', () => {
      setRun(false); closeAllMenus();
      document.querySelector(`#pc-mode [data-ins="${insMode ? 'off' : 'on'}"]`).click();
    });
    const viewBtn = barButton('m-view', 'base', 'home', '관찰', () => { setRun(false); $('c-shaft').click(); });
    viewBtn.setAttribute('aria-controls', 'dd-overview');
    barButton('m-home', 'base', 'home', '전체 보기', () => { setRun(false); closeAllMenus(); $('overview-home').click(); });
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
    // 목적별 패널. 기존 원본 이벤트와 ID를 유지하고 모바일 대리 버튼만 옮긴다.
    const runHead = document.createElement('div');
    runHead.className = 'm-only m-run-head';
    runHead.innerHTML = '<div><strong>엘리베이터 운행</strong><small>목적층을 선택하세요</small></div><button type="button" aria-label="운행 패널 닫기">×</button>';
    runHead.querySelector('button').addEventListener('click', () => setRun(false));
    $('dd-op').prepend(runHead);
    insBtn.classList.add('m-only');
    $('dd-op').append(insBtn);
    const views = document.createElement('div');
    views.className = 'm-only m-view-grid';
    views.append($('m-home'), $('m-cabin'));
    $('dd-overview').querySelector('.sheet-head').after(views);
    const help = document.createElement('p');
    help.className = 'm-only m-view-help';
    help.textContent = '한 손가락으로 회전 · 두 손가락으로 확대·이동 · 부품을 두 번 탭하면 가까이 봅니다. 시연은 오른쪽 「시연」에서 고르세요.';
    views.after(help);
    buildScreenSection();
    buildDemoMenu();
    document.querySelectorAll('#hud .sheet').forEach(bindSheetDrag);
    // 다른 시트를 열면 운행 띠를 닫아 겹치지 않게 한다.
    document.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => setRun(false)));
    media.addEventListener('change', sync);
    sync();
  }

  return { init, update, setRun, get mode() { return mode; }, get runOpen() { return runOpen; }, isMobile: () => media.matches };
})();
