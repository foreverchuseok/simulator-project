/* 조명 회로 — 승강로 등(3로 스위치)과 기계실 등(단독 스위치).
   승강로: 피트 스위치(최하층 +1m)와 상부 스위치(최상층 +1m)가 3로 스위치다. 어느 쪽에서 눌러도 전체 승강로 등이 켜지고 꺼진다
   (점등 = 피트 XOR 상부). 기계실 등은 기계실 스위치로만 켜고 끈다(사용자 지시 2026-09-28, 스크린샷 004107·0041071).
   기계실 등: 좌측벽 첫 보드 위쪽 띠(가로 이음매 위)에 900mm 일자형 LED. 배선은 벽 매립(분전함 → 스위치 → 등).
   실제 광원은 넣지 않는다 — 켜면 확산판 발광 + 벽면 빛 번짐(가산 합성 판)만 켜서 셰이더 비용이 늘지 않는다. */
const BuildingLights = (() => {
  // 기계실 등 치수·배치(월드 Z, 기계실 마감 바닥 기준 높이) — 사용자 살색 선(첫 보드, 이음매 위)
  const MR_LED = { len: 0.90, z: 1.01, y: 1.89, body: { d: 0.042, h: 0.046 } };
  const ICON = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/></svg>') + '")';
  const ROCKER_TILT = 0.14;
  const state = { pit: false, top: false, mr: false, car: false };
  const circuits = {
    shaft: { diffuser: null, halos: [], lamps: [] },
    mr: { diffuser: null, halos: [], lamps: [] },
    car: { diffuser: null, halos: [], lamps: [] }
  };
  const switches = {};   // key → { node, rocker, q0, button, anchor(local offset) }
  const anchor = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1), tiltQ = new THREE.Quaternion();
  let haloTex = null;

  const shaftOn = () => state.pit !== state.top;
  const circuitOn = key => key === 'mr' || key === 'car' ? state[key] : shaftOn();

  function diffuserMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0xdfe4e8, emissive: 0xf4f8ff, emissiveIntensity: 0, roughness: 0.35 });
  }
  function haloTexture() {
    if (haloTex) return haloTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,250,236,1)'); r.addColorStop(0.25, 'rgba(255,246,226,.55)');
    r.addColorStop(0.6, 'rgba(255,242,220,.14)'); r.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return haloTex = new THREE.CanvasTexture(c);
  }
  // 벽면 빛 번짐 — 등기구 길이 방향(Z)으로 늘인 타원. 벽에서 3mm 띄워 +X(실내)를 본다.
  function halo(parent, x, y, z, w, h, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: haloTexture(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = Math.PI / 2; m.renderOrder = 2; m.visible = false; m.name = 'lightHalo';
    parent.add(m); return m;
  }

  /* 900mm 일자형 LED 등기구(벽부 배턴): 백색 강판 몸체 + 반원 오팔 확산판 + 양끝 캡 + 벽 고정 클립 2 + 매립 인입 부싱. */
  function buildMachineRoomLED(parent, wallX, floorY) {
    const g = new THREE.Group(); g.name = 'MachineRoomLinearLED';
    g.userData = { type: 'mr-linear-led', length: MR_LED.len };
    const B = MR_LED.body, y = floorY + MR_LED.y;
    g.position.set(wallX, y, MR_LED.z); parent.add(g);
    const white = M.paint(0xeef0f1), cap = M.paint(0x9aa1a6), galv = M.ss(0xb4b9bc);
    createBox(B.d, B.h, MR_LED.len, white, B.d / 2, 0, 0, g).name = 'ledBody';
    const diffuser = diffuserMaterial();
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, MR_LED.len - 0.03, 20, 1, true, 0, Math.PI), diffuser);
    lens.name = 'ledDiffuser'; lens.rotation.x = Math.PI / 2; lens.position.set(B.d, -0.004, 0); g.add(lens);
    for (const s of [-1, 1]) {
      createBox(B.d + 0.022, B.h + 0.004, 0.014, cap, (B.d + 0.022) / 2, 0, s * (MR_LED.len / 2 - 0.007), g);
      createBox(0.004, B.h + 0.020, 0.030, galv, 0.002, 0, s * (MR_LED.len / 2 - 0.12), g);   // 벽 고정 클립
    }
    // 뒤판 매립 인입 부싱(+Z 끝, 스위치 쪽) — 배선은 벽 속이라 노출선 없음.
    const bush = createCylinder(0.009, 0.009, 0.010, cap, 0.005, 0, MR_LED.len / 2 - 0.06, g); bush.rotation.z = Math.PI / 2;
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    circuits.mr.diffuser = diffuser; circuits.mr.lamps.push(g);
    circuits.mr.halos.push(halo(g, 0.003, -0.08, 0, MR_LED.len + 1.3, 1.2, 0.8));
    return g;
  }

  function adoptShaftLamps() {
    const mat = diffuserMaterial();
    circuits.shaft.diffuser = mat;
    shaftCableGrp.traverse(o => {
      if (o.userData?.type !== 'shaft-led') return;
      const d = o.getObjectByName('shaftLEDDiffuser');
      if (d) d.material = mat;
      circuits.shaft.lamps.push(o);
      circuits.shaft.halos.push(halo(o, -0.052, 0, 0, 1.5, 1.1, 0.5));   // 등기구 원점은 벽 +55mm
    });
  }

  // 0714301 표시: 좌측 상단 난간, 카탑 박스 뒤쪽. +Z 끝이 박스 쪽(사진 왼쪽)이다.
  function buildCarRailLED() {
    const rail = carGrp.getObjectByName('carHandrail'), mount = rail.userData.lightMount;
    const topBox = carGrp.getObjectByName('carTopBox');
    const len = 0.60, front = topBox.position.z - 0.20 - 0.06;
    const g = new THREE.Group(); g.name = 'CarRailLED';
    g.position.set(mount.x, mount.y, front - len / 2); rail.add(g);
    g.userData = { type: 'car-rail-led', length: len, lit: false };
    const metal = M.ss(0xbfc6cc), black = M.paint(0x15191d);
    for (const z of [-len * 0.33, len * 0.33]) {
      createBox(0.008, 0.030, 0.046, black, 0.004, 0, z, g).name = 'ledMagnet';
    }
    createBox(0.026, 0.043, len, metal, 0.021, 0, 0, g).name = 'ledBody';
    const diffuser = M.emit(0xf4f8ff, 0); diffuser.color.setHex(0xdfe4e8);
    createBox(0.012, 0.033, len - 0.062, diffuser, 0.040, 0, -0.013, g).name = 'ledDiffuser';
    for (const z of [-1, 1]) createBox(0.038, 0.045, 0.013, black, 0.027, 0, z * (len / 2 - 0.0065), g);
    const sw = new THREE.Group(); sw.name = 'carRailLightSwitch'; sw.position.set(0.04, 0, len / 2 - 0.030); g.add(sw);
    createBox(0.014, 0.027, 0.023, black, 0, 0, 0, sw).name = 'lightRocker';
    createBox(0.001, 0.007, 0.002, M.paint(0xffffff), 0.0075, 0.006, 0, sw);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    circuits.car.diffuser = diffuser; circuits.car.lamps.push(g);
    const glow = halo(g, 0.048, 0, 0, len + 0.10, 0.14, 0.3);
    circuits.car.halos.push(glow);
    addSwitch('car', sw, '카 상부 난간 조명', [0.04, 0.12, 0]);
  }

  function makeButton(key, label) {
    const b = document.createElement('button');
    b.id = `light-switch-${key}`; b.type = 'button'; b.className = 'part-action'; b.hidden = true;
    b.style.setProperty('--part-icon', ICON); b.dataset.label = label;
    b.addEventListener('click', () => toggle(key));
    document.getElementById('part-actions').appendChild(b);
    return b;
  }
  function addSwitch(key, node, label, offset) {
    if (!node) { console.warn('[lights] switch not found', key); return; }
    const rocker = node.getObjectByName('lightRocker');
    switches[key] = { node, rocker, q0: rocker ? rocker.quaternion.clone() : null, button: makeButton(key, label), offset };
    PartGlow.bind(switches[key].button, () => node, label);
  }

  function build() {
    adoptShaftLamps();
    buildCarRailLED();
    const pw = MachineRoomPower.root, floorY = Y0 + TOTAL_H + 0.02, wallX = -(S.SHAFT_W / 2) + 0.030;   // MR_LINING_T
    buildMachineRoomLED(pw, wallX, floorY);
    addSwitch('pit', shaftCableGrp.getObjectByName('pitLightSwitchBox'), '승강로 조명 (피트 3로 스위치)', [0.09, 0.13, 0]);
    addSwitch('top', shaftCableGrp.getObjectByName('topLightSwitchBox'), '승강로 조명 (상부 3로 스위치)', [0.09, 0.13, 0]);
    addSwitch('mr', pw.getObjectByName('LightSwitchInstallation'), '기계실 조명', [0, 0.13, 0.09]);   // rotY=π/2 → 로컬 +Z가 실내
    apply();
  }

  function apply() {
    for (const [name, c] of Object.entries(circuits)) {
      const on = circuitOn(name);
      if (c.diffuser) { c.diffuser.emissiveIntensity = on ? 2.4 : 0; c.diffuser.color.setHex(on ? 0xffffff : 0xdfe4e8); }
      c.halos.forEach(h => { h.visible = on; });
      c.lamps.forEach(l => { l.userData.lit = on; });
    }
    for (const [key, s] of Object.entries(switches)) {
      if (s.rocker) {    // 3로 스위치 락커: 누를 때마다 위/아래가 바뀐다(박스 로컬 Z축 기준 시소).
        tiltQ.setFromAxisAngle(zAxis, state[key] ? -ROCKER_TILT : ROCKER_TILT);
        s.rocker.quaternion.copy(s.q0).premultiply(tiltQ);
      }
      const on = circuitOn(key);
      s.button.classList.toggle('active', on);
      s.button.setAttribute('aria-pressed', String(on));
      const text = `${s.button.dataset.label} — ${on ? '끄기' : '켜기'}`;
      s.button.setAttribute('aria-label', text); s.button.title = text;
    }
  }
  function toggle(key) {
    if (!(key in state)) return false;
    state[key] = !state[key]; apply(); return true;
  }

  function update() {
    for (const s of Object.values(switches)) {
      const b = s.button;
      anchor.set(...s.offset); s.node.localToWorld(anchor);
      let shown = camera.position.distanceToSquared(anchor) < 81;
      for (let p = s.node; p && shown; p = p.parent) if (!p.visible) shown = false;
      if (shown) {
        anchor.project(camera);
        shown = anchor.z > -1 && anchor.z < 1 && Math.abs(anchor.x) < 0.95 && Math.abs(anchor.y) < 0.9;
      }
      b.hidden = !shown;
      if (shown) PartActions.positionButton(b, (anchor.x + 1) * innerWidth / 2 - 22, (1 - anchor.y) * innerHeight / 2 - 22);
    }
  }

  return { build, toggle, update, get state() { return { ...state, shaft: shaftOn() }; }, spec: MR_LED };
})();
