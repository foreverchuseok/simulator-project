// PC에서는 기존 컨트롤 노드를 이동한다. 모바일 복귀 시 원래 위치와 이벤트를 보존한다.
const DesktopHUD = (() => {
  const media = matchMedia('(min-width: 901px) and (min-height: 560px)');
  const homes = new Map();
  let dock;
  function move(id, target) {
    const node = document.getElementById(id);
    if (!homes.has(node)) {
      const home = document.createComment('desktop-hud: ' + id);
      node.before(home); homes.set(node, home);
    }
    target.append(node);
  }
  function init() {
    dock = document.getElementById('pc-dock');
    // HUD의 inert/visibility와 별개로 모든 시연에서 사용할 수 있는 전체 초기화.
    const reset = document.createElement('button');
    reset.id = 'pc-reset'; reset.type = 'button';
    reset.setAttribute('aria-label', '리셋 · 모든 동작을 종료하고 최초 상태로');
    reset.innerHTML = '<span aria-hidden="true">↻</span><span>리셋</span>';
    document.body.append(reset);
    reset.addEventListener('click', () => location.replace(location.pathname));
    const placeReset = () => {
      reset.hidden = !media.matches;
      if (!media.matches) return;
      const rect = document.getElementById('pc-reset-slot').getBoundingClientRect();
      Object.assign(reset.style, {left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    };
    new ResizeObserver(placeReset).observe(dock);
    window.addEventListener('resize', placeReset);
    document.getElementById('c-cabin').addEventListener('click', () => { if(media.matches) closeAllMenus(); });
    // 기존 점검 복귀 연출이 잠근 동안에는 새 모드 버튼으로도 개입하지 않는다.
    document.getElementById('pc-mode').addEventListener('click', e => {
      if (InspectionReturn.busy || inspectionResetting) { e.stopImmediatePropagation(); return; }
      if(e.target.closest('[data-ins="on"]') && (moving || estop || overspeedActive || UCMDemo.state.active || HallManual.active || HallManual.busy)) {
        e.stopImmediatePropagation();
        updateStatus('v-dir','운행·시연·승장문 점검을 마친 뒤 수동 전환하세요.','#f0883e');
      }
    }, true);
    const sync = () => {
      insHold = 0; insStop(); closeAllMenus();
      document.body.classList.toggle('desktop-hud', media.matches);
      dock.hidden = !media.matches;
      if (media.matches) {
        move('statusbar', document.getElementById('pc-upper'));
        move('walk-toggle', document.getElementById('pc-shortcuts'));
        move('c-shaft', document.getElementById('pc-shortcuts'));
        move('c-cabin', document.getElementById('pc-view-options'));
        move('pc-settings-source', document.getElementById('pc-shortcuts'));
        move('dd-op', dock);
        move('inspection-drive', document.getElementById('pc-inspection'));
      } else {
        homes.forEach((home, node) => home.after(node));
      }
      placeReset();
    };
    const state = () => {
      dock.classList.toggle('pc-ins-mode', insMode);
      dock.querySelectorAll('[data-ins]').forEach(b => {
        b.setAttribute('aria-pressed', String((b.dataset.ins === 'on') === insMode));
        b.disabled = InspectionReturn.busy || inspectionResetting;
      });
      document.getElementById('pc-manual-controls').hidden = !insMode || !document.getElementById('inspection-drive').hidden;
    };
    new MutationObserver(state).observe(document.getElementById('inspection-drive'), {attributes:true, subtree:true, attributeFilter:['hidden','disabled']});
    new MutationObserver(state).observe(document.getElementById('pc-mode'), {attributes:true, subtree:true, attributeFilter:['class']});
    document.querySelectorAll('[data-inspection-reset]').forEach(button => new MutationObserver(state).observe(button, {attributes:true, attributeFilter:['disabled']}));
    media.addEventListener('change', sync);
    sync(); state();
  }
  return {init};
})();
