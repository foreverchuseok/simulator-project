// 승장문 수동 개방은 카 오퍼레이터와 독립된 층별 상태다.
const HallManual = (() => {
  let selected = 0;
  const el = id => document.getElementById(id);
  const editable = () => !moving && !estop && !overspeedActive && CarDoor.secured();
  function status(message) { el('hall-message').textContent = message; }
  function select(f) {
    if (moving || !Number.isInteger(f) || !hatchDoors[f]) return false;
    selected = f; refresh(); return true;
  }
  function key(f = selected) {
    if (!editable() || !select(f)) return false;
    const h = hatchDoors[f];
    if (!h.interlock?.ready) return false;
    if (h.keyRatio > .5 && (h.manualOpen || 0) > 0) { status('문을 완전히 닫은 뒤 재잠금하세요.'); return false; }
    clearTimeout(autoTimer);
    if (CarDoor.state.coupledFloor === f) CarDoor.state.coupledFloor = -1;
    if (h.keyTween) gsap.killTweensOf(h.keyTween);
    const unlock = !(h.keyRatio > .5);
    h.manualActive = unlock;
    h.manualOpen = 0;
    setEmergencyKey(f, unlock ? 1 : 0);
    refresh(); return true;
  }
  function open(ratio) {
    const h = hatchDoors[selected];
    if (!editable() || !h?.manualActive || !(h.keyRatio > .5) || !Number.isFinite(ratio)) return false;
    h.manualOpen = THREE.MathUtils.clamp(ratio, 0, 1);
    const stroke = CarDoor.dimensions().stroke * h.manualOpen;
    h.right.position.x = h.right.userData.cx + stroke;
    h.left.position.x = h.left.userData.cx - stroke;
    spinDoorDrive(h); HallInterlock.update(h); refresh(); return true;
  }
  function observe() {
    if (moving || overspeedActive) return;
    gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    const y = FLOOR_Y[selected];
    controls.target.set(0, y + 1.1, FRONT_WALL_INNER_Z);
    const distance = Math.max(2.5, (S.DOOR_W + .6) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.set(.25, y + 1.35, FRONT_WALL_INNER_Z + distance);
    controls.update(); updateManualCameraNear();
  }
  function refresh() {
    const h = hatchDoors[selected]; if (!h) return;
    el('hall-floor').value = selected;
    el('hall-key').textContent = h.keyRatio > .5 ? '삼각키 재잠금' : '삼각키 해제';
    el('hall-opening').value = Math.round((h.manualOpen || 0) * 100);
    status(`${selected + 1}층 · ${h.keyRatio > .5 ? '잠금 해제' : '잠김'} · 개방 ${el('hall-opening').value}%`);
  }
  function bind() {
    for (let f=0; f<FLOORS; f++) el('hall-floor').add(new Option(`${f+1}층`, f));
    el('hall-toggle').onclick = () => { el('hall-panel').hidden = !el('hall-panel').hidden; refresh(); };
    el('hall-dismiss').onclick = () => { el('hall-panel').hidden = true; };
    el('hall-floor').onchange = e => { if (!select(Number(e.target.value))) refresh(); };
    el('hall-key').onclick = () => { if (!key()) status('카 정지·카문 닫힘을 확인하고, 열린 승장문은 먼저 닫으세요.'); };
    el('hall-opening').oninput = e => { if (!open(Number(e.target.value)/100)) { refresh(); status('카 정지 후 삼각키를 해제하세요.'); } };
    el('hall-open').onclick = () => { if (!open(1)) status('카 정지 후 삼각키를 해제하세요.'); };
    el('hall-close').onclick = () => open(0);
    el('hall-observe').onclick = observe;
    refresh();
  }
  function pick(f) { if (select(f)) { el('hall-panel').hidden = false; key(f); } }
  return {bind,key,open,select,observe,pick,get selected(){return selected;}};
})();
