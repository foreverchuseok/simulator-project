/* 기계실 전원 계통 — 분전함(P-ELEV) → ARD(자동구출운전장치) → 제어반, 분전함 → 조명 스위치.
   형상 원본: blender/scripts/machine_room_power.py → models/gltf/ard.glb · models/gltf/elevator_distribution_box.glb
   MR_POWER_SPEC 한 줄이 GLB 치수 원본이다(Python 이 정규식으로 읽는다).
   GLB 로컬: +Y 위, +Z 앞면(벽에서 나오는 방향), z=0 = 뒷면(벽), 원점 = 뒷면 바닥 중심. 좌측벽에 rotY=π/2 로 붙인다
   (로컬 +X = 월드 −Z, 로컬 −X = 월드 +Z = 제어반 쪽).
   고압 3상은 선이 보이면 안 되므로 회색 사각 덕트(벽면 부착)로만 잇는다. 분전함 내부는 문이 열렸을 때만 그린다. */
const MR_POWER_SPEC = {"ard":{"w":0.46,"h":0.76,"d":0.19,"stand":0.06},"db":{"w":0.36,"h":0.45,"d":0.14},"doorOpenDeg":100,"cableX":0.04};

const MachineRoomPower = (() => {
  const P = MR_POWER_SPEC;
  // 좌측벽 배치(월드 Z, 기계실 마감 바닥 기준 높이) — 제어반 -Z 옆면과 개방 레버·핸들 사이.
  // 조명 스위치는 벽 앞 끝(출입 쪽, 제어반 인터폰 너머) — 사용자 표시 1443581. 인입·조명선은 벽 매립이라 덕트 없음.
  const LAYOUT = { ardZ: -0.02, dbZ: 0.00, dbBottom: 1.30, switchZ: 1.40, switchY: 1.20, panelDuctY: 0.40 };
  const DUCT = { w: 0.060, d: 0.045 };
  let root = null, door = null, interior = null, button = null, ready = false, open = false, busy = false;
  const anchor = new THREE.Vector3();
  const ICON = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M13 7l-3 5h4l-3 5"/></svg>') + '")';

  function build(parent, wallX, floorY, panelSideZ) {
    root = new THREE.Group(); root.name = 'MachineRoomPower'; parent.add(root);
    const L = LAYOUT, rotY = Math.PI / 2;
    const ard = new THREE.Group(); ard.name = 'ARDInstallation';
    ard.position.set(wallX + 0.01, floorY, L.ardZ); ard.rotation.y = rotY; root.add(ard);
    const db = new THREE.Group(); db.name = 'DistributionBoxInstallation';
    db.position.set(wallX, floorY + L.dbBottom, L.dbZ); db.rotation.y = rotY; root.add(db);
    const sw = new THREE.Group(); sw.name = 'LightSwitchInstallation';
    sw.position.set(wallX, floorY + L.switchY, L.switchZ); sw.rotation.y = rotY; root.add(sw);
    const load = (url, cb) => new THREE.GLTFLoader().load(url, gltf => {
      gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      cb(gltf.scene);
    }, undefined, e => console.error('[mr power] GLB load failed', url, e));
    let pending = 2;
    const done = () => { if (--pending === 0) { ready = true; root.userData.ready = true; syncButton(); } };
    load('models/gltf/ard.glb', s => { ard.add(s); done(); });
    load('models/gltf/elevator_distribution_box.glb', s => {
      const swNode = s.getObjectByName('LightSwitch');
      if (swNode) { swNode.position.set(0, 0, 0); sw.add(swNode); }
      door = s.getObjectByName('BoxDoor'); interior = s.getObjectByName('BoxInterior');
      if (interior) interior.visible = false;
      db.add(s); done();
    });
    buildDucts(wallX, floorY, panelSideZ);
    button = document.createElement('button');
    button.id = 'distribution-box-action'; button.type = 'button'; button.className = 'part-action'; button.hidden = true;
    button.style.setProperty('--part-icon', ICON);
    button.addEventListener('click', toggle);
    PartGlow.bind(button, () => root?.getObjectByName('DistributionBoxInstallation'), '엘리베이터 분전함');
    document.getElementById('part-actions').appendChild(button);
    syncButton();
    return root;
  }

  /* 회색 PVC 사각 덕트 — 벽면에 붙여(X = 벽 ~ 벽+DUCT.d) 선을 모두 감춘다. 뚜껑 줄눈·끝 칼라 포함. */
  function buildDucts(wallX, floorY, panelSideZ) {
    const g = new THREE.Group(); g.name = 'PowerWiringDucts'; root.add(g);
    const body = M.paint(0x9ea3a7); body.clearcoat = 0; body.roughness = 0.7;
    const lidLine = M.paint(0x7d8286); lidLine.clearcoat = 0;
    const x = wallX + DUCT.d / 2, L = LAYOUT, A = P.ard;
    const run = (name, a, b) => {           // a,b = [y,z] 끝점 (월드 y 는 바닥 기준)
      const dy = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dy, dz), vertical = Math.abs(dy) > Math.abs(dz);
      const cy = floorY + (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
      const m = createBox(DUCT.d, vertical ? len : DUCT.w, vertical ? DUCT.w : len, body, x, cy, cz, g); m.name = name;
      createBox(0.001, vertical ? len : 0.003, vertical ? 0.003 : len, lidLine, wallX + DUCT.d + 0.0005, cy,
        cz + (vertical ? DUCT.w * 0.32 : 0), g);                 // 뚜껑 물림 줄
      if (!vertical) createBox(0.001, 0.003, len, lidLine, wallX + DUCT.d + 0.0005, cy + DUCT.w * 0.32, cz, g);
      return m;
    };
    const collar = (y, z, vertical) => createBox(DUCT.d + 0.006, vertical ? 0.02 : DUCT.w + 0.008, vertical ? DUCT.w + 0.008 : 0.02,
      body, x + 0.001, floorY + y, z, g);
    const cz = L.dbZ - P.cableX;                                   // 분전함 아래 인출구 Z (로컬 +X → 월드 −Z)
    const ardTop = A.stand + A.h;
    // 건물 간선 인입과 조명선은 벽 속 매립(분전함 뒷판 부싱) — 노출 덕트 없음(사용자 144336).
    // ① 분전함 아래 → ARD 윗면 (380V 3상)
    run('ductDbToArd', [ardTop, cz], [L.dbBottom, cz]); collar(ardTop + 0.01, cz, true); collar(L.dbBottom - 0.01, cz, true);
    // ② ARD 옆면(+Z) → 제어반 옆면(-Z) (3상 → 제어반)
    const ardSide = L.ardZ + A.w / 2;
    run('ductArdToPanel', [L.panelDuctY, ardSide], [L.panelDuctY, panelSideZ]);
    collar(L.panelDuctY, ardSide + 0.01, false); collar(L.panelDuctY, panelSideZ - 0.01, false);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    g.userData = { type: 'power-duct', duct: DUCT };
  }

  function syncButton() {
    if (!button) return;
    button.disabled = !ready || busy;
    button.classList.toggle('active', open);
    button.setAttribute('aria-pressed', String(open));
    button.setAttribute('aria-label', open ? '분전함 문 닫기' : '분전함 문 열기');
    button.title = open ? '분전함 문 닫기' : '분전함 문 열기 (엘리베이터 전용 차단기)';
  }
  function toggle() {
    if (!ready || busy || !door) return false;
    open = !open; busy = true; syncButton();
    if (open && interior) interior.visible = true;
    gsap.killTweensOf(door.rotation);
    gsap.to(door.rotation, { y: open ? THREE.MathUtils.degToRad(P.doorOpenDeg) : 0, duration: 0.9, ease: 'power2.inOut',
      onComplete: () => { busy = false; if (!open && interior) interior.visible = false; syncButton(); } });
    return true;
  }
  function update() {
    if (!button || !root) return;
    const db = root.getObjectByName('DistributionBoxInstallation');
    // 문을 열면 안의 차단기를 가리지 않도록 함 위 바깥에 띄운다(사용자 1444241 "위나 옆"). 옆(경첩 쪽)은 열린 문과 겹친다.
    anchor.set(0, P.db.h + 0.07, P.db.d * 0.5); db.localToWorld(anchor);
    const near = camera.position.distanceToSquared(anchor) < 100;
    anchor.project(camera);
    let shown = near && anchor.z > -1 && anchor.z < 1 && Math.abs(anchor.x) < 0.95 && Math.abs(anchor.y) < 0.9;
    for (let p = root; p && shown; p = p.parent) if (!p.visible) shown = false;
    button.hidden = !shown;
    if (shown) PartActions.positionButton(button, (anchor.x + 1) * innerWidth / 2 - 22, (1 - anchor.y) * innerHeight / 2 - 22);
  }
  return { build, toggle, update, get open() { return open; }, get ready() { return ready; }, get root() { return root; }, layout: LAYOUT };
})();
