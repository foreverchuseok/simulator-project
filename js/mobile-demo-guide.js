// 모바일 시연: 큰 원본 패널은 숨기고 맨 아래 자막만 표시한다.
// 원본 노드·이벤트·시연 시간·FSM·카메라는 각 시연이 계속 소유한다.
const MobileDemoGuide = (() => {
  const $ = id => document.getElementById(id);
  const sources = [
    ['terminal-demo-panel', '종단 스위치', 'strong', 'p'],
    ['manual-rescue-panel', '수동 구출', 'strong', '#manual-rescue-detail'],
    ['ard-panel', 'ARD 자동구출', '#ard-title', '#ard-detail'],
    ['photo-eye-panel', '문닫힘 안전장치', 'strong', 'p'],
    ['rope-measure-panel', '주로프 측정', 'h3', 'p'],
    ['retention-demo-panel', '문 이탈방지', 'strong', 'p'],
    ['relay-demo-panel', '연동로프', 'strong', 'p'],
    ['interlock-demo-panel', '인터록', 'strong', '.interlock-contacts'],
    ['ucm-summary', '개문발차 · 결과', 'h2', 'p'],
    ['ucm-stage', '개문발차'],
    ['ascent-stage', '상승과속'],
    ['brake-compare-ending', '브레이크 비교 · 결과', 'strong', 'small'],
    ['brake-compare-stage', '브레이크 비교'],
    ['buffer-stage', '완충기'],
    ['ovs-summary', '조속기 · 결과', 'h2', 'p'],
    ['ovs-stage', '조속기 과속']
  ];
  const terminalCopy = {
    intro: '정상 감속·정지 실패를 가정한 시연입니다.', run: '정상 감속 없이 종단층으로 접근합니다.',
    slowHit: '스위치 개로로 강제감속을 시작합니다.', level: '저속으로 종단층에 착상합니다.',
    pass: '착상 고장으로 종단층을 지나칩니다.', limitHit: '제어 회로 차단 · 브레이크로 정지합니다.',
    sameDir: '같은 방향 운전은 차단됩니다.', reverse: '반대 방향으로 이동하면 자동 복귀합니다.',
    limitDone: '리미트 접점 복귀 · 정상 착상했습니다.', welded: '리미트 접점 융착으로 정지하지 못합니다.',
    finalHit: '주전원 차단 · 브레이크로 정지합니다.', locked: '양방향 운전이 모두 차단됩니다.',
    manual: '원인 조치 후 수동 복귀가 필요합니다.', recover: '점검 속도로 안전 범위에 복귀합니다.'
  };
  let dock, heading, summary, action, dismiss, current, lastDemo = '', nextUpdate = 0;
  let captionKey = '', pages = [], pageIndex = 0, pageElapsed = 0, lastTick = 0;
  const measure = document.createElement('canvas').getContext('2d');
  const visible = el => el && !el.hidden && el.style.display !== 'none';
  const clean = el => el?.textContent.replace(/\s+/g, ' ').trim() || '';
  const write = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const hide = (el, hidden) => { if (el.hidden !== hidden) el.hidden = hidden; };
  function paginate(text, width) {
    measure.font = '14px sans-serif';
    const lines = []; let line = '';
    // 긴 한국어·수치도 단어 단위로 나눠 두 줄 안에 표시한다.
    for (const word of text.match(/\S+\s*/g) || []) {
      if (line && measure.measureText(line + word.trimEnd()).width > width) { lines.push(line.trim()); line = ''; }
      for (const char of Array.from(word)) {
        if (line && measure.measureText(line + char).width > width) { lines.push(line.trim()); line = ''; }
        line += char;
      }
    }
    if (line.trim()) lines.push(line.trim());
    const result = []; for (let i = 0; i < lines.length; i += 2) result.push(lines.slice(i, i + 2).join('\n'));
    return result.length ? result : ['부품의 움직임을 확인하세요.'];
  }
  function subtitle(title, brief, now) {
    const width = Math.max(60, summary.clientWidth - 8), key = `${current.id}|${title}|${brief}|${width}`;
    if (key !== captionKey) { captionKey = key; pages = paginate(brief, width); pageIndex = 0; pageElapsed = 0; lastTick = now; }
    if (!DemoPause.paused) pageElapsed += Math.min(250, now - lastTick);
    lastTick = now;
    if (pages.length > 1 && pageElapsed > Math.max(2800, Array.from(pages[pageIndex]).length * 100)) {
      pageIndex = (pageIndex + 1) % pages.length; pageElapsed = 0;
    }
    write(heading, title + (pages.length > 1 ? ` · ${pageIndex + 1}/${pages.length}` : ''));
    write(summary, pages[pageIndex]);
  }
  function build() {
    dock = document.createElement('section'); dock.id = 'm-demo-guide'; dock.hidden = true;
    dock.setAttribute('aria-label', '현재 시연 단계');
    dock.innerHTML = '<div id="m-demo-guide-copy" role="status" aria-live="polite" aria-atomic="true"><strong></strong><span class="m-guide-summary"></span></div><button type="button" id="m-demo-guide-action" hidden></button><button type="button" id="m-demo-guide-dismiss" aria-label="완료된 시연 자막 닫기" hidden>×</button>';
    document.body.append(dock);
    heading = dock.querySelector('strong'); summary = dock.querySelector('.m-guide-summary'); action = $('m-demo-guide-action');
    dismiss = $('m-demo-guide-dismiss');
    // 시연별 document 캡처 차단보다 먼저 받아 원래 조작 버튼에 연결한다.
    for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) window.addEventListener(type, e => {
      const button = e.target.closest?.('#m-demo-guide button');
      if (!button) return;
      if (/key/.test(type)) {
        if (!['Enter', ' '].includes(e.key)) return;
      }
      e.stopImmediatePropagation();
      if (type !== 'click') return;
      e.preventDefault();
      if (button === action) { $(action.dataset.target)?.click(); return; }
      if (button === dismiss) {
        for (const source of sources) if (belongs(source)) { const el = $(source[0]); if (el) el.hidden = true; }
        current = null; dock.hidden = true;
      }
    }, true);
  }
  const belongs = source => !lastDemo || source[1].startsWith(lastDemo) || lastDemo === '조속기 과속' && source[0].startsWith('ovs-');
  function text(source, el) {
    const [id, name, titleSelector, detailSelector] = source;
    let title = titleSelector ? clean(el.querySelector(titleSelector)) : name;
    let brief = detailSelector ? clean(el.querySelector(detailSelector)) : clean(el).replace(/^.*?\|\s*/, '');
    if (id === 'terminal-demo-panel') {
      const s = TerminalDemo.state;
      title = `${s.side > 0 ? '상부' : '하부'} · ${title.replace(/스위치| → /g, '').replace(/\s*\(.*?\)/g, '')}`;
      brief = terminalCopy[s.stage] || (s.stage === 'done' ? {
        slowdown: '정상 감속 실패 시 속도를 줄입니다.', limit: '제어 회로 차단 · 반대 방향 자동 복귀.', final: '주전원 차단 · 원인 조치 후 수동 복귀.'
      }[s.kind] : brief);
    } else if (id === 'buffer-stage') {
      const s = BufferDemo.state, target = s.mode === 'cwt' ? '균형추' : '카';
      const rail = s.clear?.gap?.toFixed(2);
      title = `${target} 완충기 · ` + ({approach:'접근',compress:'압축',settle:'정지', 'observe-pit':'충돌 결과', 'observe-under':'피트 틈새', 'observe-cwt':s.view==='roof'?'카 상부 틈새':'레일 여유', done:'시연 완료', halted:'비상정지',resetting:'복귀'}[s.stage] || '관찰');
      brief = ({approach:`${target}가 완충기로 접근합니다.`,compress:'완충기가 눌리며 충격을 흡수합니다.',settle:'완충기 위에서 정지합니다.',
        'observe-pit':`완충기 압축 ${Math.round(s.compression * 1000)}mm.`, 'observe-under':'P·Q·R 치수선으로 하부 틈새를 봅니다.',
        'observe-cwt':s.view==='roof'?'A~E 치수선으로 상부 틈새를 봅니다.':`가이드레일·장애물 여유 ${rail}m.`,done:'완충기가 충격을 흡수했습니다. 종료하면 정상 위치로 복귀합니다.',halted:'시연 종료로 정상 위치에 복귀합니다.',resetting:'완충기에서 벗어나 착상합니다.'})[s.stage] || brief;
    } else if (id === 'interlock-demo-panel') {
      brief = clean(el.querySelector('[data-closed]')?.parentElement) || '걸쇠와 주접점·보조접점의 순서를 봅니다.';
    } else if (id === 'rope-measure-panel') {
      brief = clean($('rope-measure-readout')) + ' · ' + brief;
    } else if (id === 'ucm-summary') {
      brief = clean(el.querySelector('p'));
    } else if (id === 'brake-compare-ending') {
      brief = BrakeDemo.state.mode === 'dual' ? '남은 스프링·슈가 제동을 유지합니다.' : '공통 스프링 파손으로 제동력을 잃었습니다.';
    } else if (id === 'ovs-summary') {
      brief = '로프 파단 → 과속 감지 → 비상정지.';
    }
    return [title || name, brief || '부품의 움직임을 확인하세요.'];
  }
  function update() {
    if (!dock) return;
    const now = performance.now(); if (now < nextUpdate) return; nextUpdate = now + 120;
    const mobile = MobileHUD.isMobile();
    if (!mobile) {
      current = null;
      if (!dock.hidden) dock.hidden = true;
      document.body.classList.remove('m-demo-compact'); lastDemo = ''; return;
    }
    const live = BufferDemo.active ? '완충기' : DemoPause.demo;
    if (live) lastDemo = live;
    let selected;
    for (const source of sources) {
      const el = $(source[0]); if (!el) continue;
      if (!el.classList.contains('m-demo-source')) el.classList.add('m-demo-source');
      if (belongs(source) && !selected && visible(el) && clean(el)) selected = [source, el];
    }
    if (!selected) {
      current = null;
      if (!dock.hidden) dock.hidden = true;
      document.body.classList.remove('m-demo-compact'); return;
    }
    const [source, el] = selected;
    current = el;
    hide(dock, false);
    if (!document.body.classList.contains('m-demo-compact')) document.body.classList.add('m-demo-compact');
    const reset = visible($('terminal-demo-reset')) && TerminalDemo.active ? $('terminal-demo-reset')
      : ARDDemo.active && ['done', 'halted'].includes(ARDDemo.state.stage) && visible($('ard-restore')) ? $('ard-restore') : null;
    // 모바일 14종 시연의 일시정지는 하단 바(#demo-pause)로 통일한다. 자막 버튼은 수동 복귀·전원 복구 전용.
    const control = reset;
    hide(action, !control); hide(dismiss, !!DemoExit.active);
    if (control) {
      if (action.dataset.target !== control.id) action.dataset.target = control.id;
      if (action.disabled !== control.disabled) action.disabled = control.disabled;
      write(action, reset.id === 'terminal-demo-reset' ? '수동 복귀' : '전원 복구');
    }
    const [title, brief] = text(source, el); subtitle(title, brief, now);
  }
  return {build, update};
})();
