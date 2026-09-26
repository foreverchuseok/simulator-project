// 승장 도어 의장면·홀 호출버튼 실사 GLB (원본: blender/scripts/hall_door_button.py, 계약: elevator.js HALL_FINISH).
// 도어 패널은 JS 상자를 먼저 세워 두고(개폐·간극 검증이 바로 동작), GLB 가 오면 같은 자리에서 교체한다.
// 스티커·삼각키·인터록·행거는 JS 가 그대로 붙인다. 호출버튼은 층마다 판 하나를 벽에 붙인다.
const HallFinish = (() => {
  let panelSrc = null, buttonSrc = null, failed = false;
  const pendingPanels = [], pendingButtons = [];
  const lampOn = new THREE.Color(0x9fd4ff);

  function prep(root) {
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return root;
  }
  function contractOk(extras, name) {
    const bad = Object.keys(HALL_FINISH).filter(k => Math.abs((extras?.[k] ?? NaN) - HALL_FINISH[k]) > 1e-6);
    if (bad.length) console.error(`${name}: GLB 계약 불일치(${bad.join(', ')}) — hall_door_button.py 를 다시 내보내라`);
    return !bad.length;
  }

  function applyPanel({ box, grp }) {
    if (!box.parent) return;              // 재빌드로 이미 빠진 도어
    const p = panelSrc.clone();
    p.name = 'HallDoorPanelFinish';
    p.position.copy(box.position);
    grp.add(p);
    grp.remove(box);
  }
  function applyButton({ parent, x, y, z, floorIdx }) {
    const b = buttonSrc.clone();
    b.name = 'HallCallButton_' + (floorIdx + 1);
    b.position.set(x, y, z);
    // 종단층은 한 방향만: 1층 ▲, 최상층 ▼ — 남은 버튼을 두 자리 가운데로 옮긴다.
    const up = b.getObjectByName('ButtonUp'), dn = b.getObjectByName('ButtonDown');
    const mid = (up.position.y + dn.position.y) / 2;
    if (floorIdx === 0) { dn.visible = false; up.position.y = mid; }
    if (floorIdx === FLOORS - 1) { up.visible = false; dn.position.y = mid; }
    // LED 링은 층마다 켜고 끌 수 있게 재질을 따로 둔다.
    b.traverse(o => { if (o.isMesh && /Lamp$/.test(o.name)) o.material = o.material.clone(); });
    b.userData = { type: 'hall-call-button', floor: floorIdx + 1 };
    parent.add(b);
  }

  function load() {
    const loader = new THREE.GLTFLoader();
    loader.load('models/gltf/hall_door_panel.glb', gltf => {
      const root = gltf.scene.getObjectByName('HallDoorPanelModel');
      const panel = gltf.scene.getObjectByName('HallDoorPanel');
      if (!panel || !contractOk(root?.userData, 'hall_door_panel.glb')) { failed = true; return; }
      panelSrc = prep(panel);
      pendingPanels.splice(0).forEach(applyPanel);
    }, undefined, e => { failed = true; console.error('hall_door_panel.glb load failed', e); });
    loader.load('models/gltf/hall_call_button.glb', gltf => {
      const root = gltf.scene.getObjectByName('HallCallButtonModel');
      if (!root || !contractOk(root.userData, 'hall_call_button.glb')) return;
      root.position.set(0, 0, 0);
      buttonSrc = prep(root);
      pendingButtons.splice(0).forEach(applyButton);
    }, undefined, e => console.error('hall_call_button.glb load failed', e));
  }

  return {
    load,
    /** 도어 본체 상자(box)를 GLB 패널로 교체 예약. box 치수는 HALL_FINISH 와 같아야 한다. */
    dressPanel(box, grp) {
      const p = box.geometry.parameters;
      if (Math.abs(p.width - HALL_FINISH.panelW) > 1e-4 || Math.abs(p.height - HALL_FINISH.panelH) > 1e-4 ||
          Math.abs(p.depth - HALL_FINISH.panelT) > 1e-4) {
        console.error('HallFinish: 도어 치수가 HALL_FINISH 와 다르다 — 상자 유지', p); return;
      }
      if (failed) return;
      const job = { box, grp };
      panelSrc ? applyPanel(job) : pendingPanels.push(job);
    },
    /** 벽면(z)에 호출버튼 판 부착. y = 승장 바닥 + HALL_FINISH.btnCenterY 를 호출부에서 넘긴다. */
    mountCallButton(parent, x, y, z, floorIdx) {
      const job = { parent, x, y, z, floorIdx };
      buttonSrc ? applyButton(job) : pendingButtons.push(job);
    },
    /** 층 버튼 LED 링 점등(향후 홀 호출 연동용). */
    setLamp(floorIdx, dir, on) {
      const b = scene.getObjectByName('HallCallButton_' + (floorIdx + 1));
      const lampMesh = b?.getObjectByName(dir === 'up' ? 'ButtonUpLamp' : 'ButtonDownLamp');
      if (!lampMesh) return;
      lampMesh.material.emissive.copy(on ? lampOn : new THREE.Color(0));
      lampMesh.material.emissiveIntensity = on ? 1.6 : 0;
    }
  };
})();
HallFinish.load();
