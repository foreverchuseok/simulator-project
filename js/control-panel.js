/* 기계실 제어반 — SICON-4000형 양문(일본 수출형 사진 122351 참고) 캐비닛.
   형상 원본: blender/scripts/control_panel_sicon.py → models/gltf/control_panel.glb
   CONTROL_PANEL_SPEC 한 줄이 치수 원본이다(Python 이 정규식으로 읽는다).
   GLB 로컬: +Y 위, +Z 문(전면), 원점 = 바닥 중심. 문 피벗은 양쪽 바깥 모서리 피아노 경첩 축.
   내부(CabinetInterior)는 문이 열려 있을 때만 그린다 — 닫힌 상태의 draw call·삼각형을 늘리지 않는다. */
// width·depth·baseH·bodyH·resistor 는 설계치수(1.0 기준). scale = [폭 x, 높이 y, 깊이 z] 축별 축척이며 곱한 값이 실제 크기다.
// (2026-09-27: 80% → 폭 +5%·높이 80% = [0.84, 0.64, 0.8]. 둥근 부품·글자는 Python 이 모양을 유지한다.)
const CONTROL_PANEL_SPEC = {"width":0.70,"depth":0.35,"baseH":0.10,"bodyH":1.45,"resistor":[0.52,0.26,0.19],"scale":[0.84,0.64,0.8],"doorOpenDeg":105,"wallGap":0.01};

const ControlPanel = (() => {
  const S0 = CONTROL_PANEL_SPEC, [KX, KY, KZ] = S0.scale;
  let root = null, doorL = null, doorR = null, interior = null, button = null;
  let ready = false, open = false, busy = false;
  const anchor = new THREE.Vector3();
  const ICON = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M10 12h.01M14 12h.01"/></svg>') + '")';

  // parent 로컬에서 캐비닛 바닥 중심(x,y,z)과 방향(rotY: 로컬 +Z 문이 향할 방향)을 받는다.
  function build(parent, x, y, z, rotY) {
    root = new THREE.Group();
    root.name = 'ControlPanelInstallation';
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    root.userData = { type: 'control-panel', spec: S0, ready: false };
    parent.add(root);
    new THREE.GLTFLoader().load('models/gltf/control_panel.glb?v=20261002-rescue-focus', gltf => {
      const model = gltf.scene;
      model.name = 'ControlPanelModel';
      const extras = model.getObjectByName('ControlPanel')?.userData || {};
      for (const k of ['width', 'depth', 'baseH', 'bodyH', 'scale'])
        if (extras[k] != null && [].concat(extras[k]).some((v, i) => Math.abs(v - [].concat(S0[k])[i]) > 1e-5))
          console.warn('[control panel] GLB 치수 불일치 — control_panel_sicon.py 재내보내기 필요', k, extras[k], S0[k]);
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      doorL = model.getObjectByName('DoorLeft');
      doorR = model.getObjectByName('DoorRight');
      interior = model.getObjectByName('CabinetInterior');
      if (interior) interior.visible = false;
      root.add(model);
      mountIntercom();
      ready = true;
      root.userData.ready = true;
      syncButton();
    }, undefined, e => console.error('[control panel] GLB load failed', e));
    button = document.createElement('button');
    button.id = 'control-panel-action';
    button.type = 'button';
    button.className = 'part-action';
    button.hidden = true;
    button.style.setProperty('--part-icon', ICON);
    button.addEventListener('click', toggle);
    PartGlow.bind(button, () => ready ? root : null, '제어반');
    document.getElementById('part-actions').appendChild(button);
    return root;
  }

  /* 인터폰(요즘 현장형 흰 트림 전화기, intercom_phone.glb) — 캐비닛 왼쪽 옆면(로컬 -X), 앞쪽 가까이.
     GLB 로컬 +Z 앞면·z=0 뒷면이므로 -90° 돌려 뒷면을 옆판에 붙인다. 실물 크기(축척 없음). */
  const INTERCOM = { y: 0.80, fromFront: 0.075 };
  function mountIntercom() {
    new THREE.GLTFLoader().load('models/gltf/intercom_phone.glb?v=20261002-manual-rescue', gltf => {
      const phone = gltf.scene;
      phone.name = 'ControlPanelIntercom';
      phone.rotation.y = -Math.PI / 2;
      phone.position.set(-S0.width * KX / 2, INTERCOM.y, S0.depth * KZ / 2 - INTERCOM.fromFront);
      phone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      root.add(phone);
      root.userData.intercom = true;
    }, undefined, e => console.error('[intercom] GLB load failed', e));
  }

  function syncButton() {
    if (!button) return;
    button.disabled = !ready || busy;
    button.classList.toggle('active', open);
    button.setAttribute('aria-pressed', String(open));
    button.setAttribute('aria-label', open ? '제어반 문 닫기' : '제어반 문 열기');
    button.title = open ? '제어반 문 닫기' : '제어반 문 열기';
  }

  // 오른쪽 문에 중앙 겹침판(astragal)이 있어 열 때는 오른쪽 먼저, 닫을 때는 왼쪽 먼저.
  function toggle() {
    if (!ready || busy || !doorL || !doorR) return false;
    open = !open;
    if (!open && InspectionStations.active === 'machine') InspectionStations.dismiss();
    busy = true;
    syncButton();
    const a = THREE.MathUtils.degToRad(S0.doorOpenDeg);
    if (open) interior.visible = true;
    const first = open ? doorR : doorL, second = open ? doorL : doorR;
    const target = d => (open ? (d === doorL ? -a : a) : 0);
    gsap.killTweensOf(doorL.rotation); gsap.killTweensOf(doorR.rotation);
    gsap.to(first.rotation, { y: target(first), duration: 0.9, ease: 'power2.inOut' });
    gsap.to(second.rotation, { y: target(second), duration: 0.9, delay: 0.28, ease: 'power2.inOut',
      onComplete: () => { busy = false; if (!open) interior.visible = false; syncButton(); } });
    return true;
  }

  // 문과 겹치지 않도록 상단 회생제동 장치 위에 띄운다.
  function update() {
    if (!button || !root) return;
    anchor.set(0, (S0.baseH + S0.bodyH + S0.resistor[2]) * KY + 0.09, S0.depth / 2 * KZ + 0.05);
    root.localToWorld(anchor);
    const near = camera.position.distanceToSquared(anchor) < 100;
    anchor.project(camera);
    let shown = near && anchor.z > -1 && anchor.z < 1 && Math.abs(anchor.x) < 0.95 && Math.abs(anchor.y) < 0.9;
    for (let p = root; p && shown; p = p.parent) if (!p.visible) shown = false;
    button.hidden = !shown;
    if (shown) PartActions.positionButton(button, (anchor.x + 1) * innerWidth / 2 - 22, (1 - anchor.y) * innerHeight / 2 - 22);
  }

  function restoreOpen(value){
    if(!ready)return;
    open=value;busy=false;
    for(const d of [doorL,doorR]){gsap.killTweensOf(d.rotation);d.rotation.y=value?(d===doorL?-1:1)*THREE.MathUtils.degToRad(S0.doorOpenDeg):0;}
    interior.visible=value;syncButton();
  }
  return { build, toggle, update, restoreOpen, get open() { return open; }, get busy() { return busy; }, get ready() { return ready; },
    get root() { return root; } };
})();
