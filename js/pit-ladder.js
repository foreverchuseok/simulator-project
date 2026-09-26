// Pit ladder (측면 벽부 접이식): 좌측벽(-X)에 벽과 나란히, 피트 정지·조명 스위치 옆.
// 사다리를 당기면 흰 플라스틱 스냅 클립이 탄성으로 살짝 벌어졌다 복귀하고(클립 자체는 고정),
// 양쪽 레일의 짧은 평행 링크가 세로 평면에서 돌아 정면으로 나오며 두 발이 착지한다.
// 사다리가 벽에서 떨어지면 고정 배꼽 스위치의 누름봉이 풀려 운행이 차단된다.
// 기준(별표 22~27): 문턱 위 1.1 m 이상, 손잡이 폭 ≤35·깊이 ≤100 mm, 발판 유효폭 ≥280 mm,
// 간격 250~300 균등, 깊이 25~30 mm, 미끄럼 방지 성형면, 알루미늄, 15 kg 이하, 1,500 N.
// Blender pit_ladder_switch.py가 읽는 장착 계약. 누름봉 끝 위치(+X)와 스트로크, m.
const PIT_LADDER_SWITCH = { "pressedTip": 0.0415, "travel": 0.006 };
const PitLadder = (() => {
  const D = {
    railW: 0.030, railD: 0.045, railSpan: 0.315, // 레일 중심 간격 → 유효폭 285
    rungPitch: 0.28, rungDepth: 0.028, rungH: 0.022,
    sillExtension: 1.10, wallPivotX: 0.012, pullX: 0.145,
    standOff: 0.145,                                    // 접힌 상태 벽 ↔ 레일 뒷면
    doorRailFromDoor: 0.3325,                           // 승장문 기준면 ↔ 문쪽 레일 중심
    linkLength: 0.33,                                   // 짧은 평행 링크. 낙차(footY)는 여기서 파생
    socketY: [0.96, 2.58]                               // 레일 링크 소켓 높이 (사다리 발 기준)
  };
  D.width = D.railSpan + D.railW;              // 외폭 345
  D.effectiveWidth = D.railSpan - D.railW;     // 유효폭 285
  let root, frame, plunger, clips = [], links = [], deployed = false, busy = false, sw, actionButton, modelReady = false;
  const anchor = new THREE.Vector3();
  // 액추에이터 판 뒷면 = 접힌 레일 앞면 + 0.5mm. 스위치 누름봉 끝을 이 면에 맞춘다.
  const ACT_X = D.standOff + D.railD + 0.002, SW_X = ACT_X - 0.0015 - PIT_LADDER_SWITCH.pressedTip;

  function build(parent) {
    const alu = M.ss(0xa9b0b5), aluDark = M.ss(0x7f878c), galv = M.ss(0x949da2);
    const white = M.paint(0xf4f3ee), black = M.paint(0x17191b);
    white.clearcoat = black.clearcoat = 0.2;
    const doorRailZ = FRONT_WALL_INNER_Z - D.doorRailFromDoor;
    const zc = doorRailZ - D.railSpan / 2, wallX = -S.SHAFT_W / 2;
    const LX = D.standOff + D.railD / 2;                       // 접힌 레일 중심 (벽 기준 로컬 X)
    const UX = LX;
    const RZ = D.railSpan / 2, inner = RZ - D.railW / 2, outer = RZ + D.railW / 2;
    D.lx = LX; D.ux = UX; D.zc = zc;

    root = new THREE.Group(); root.name = 'pitFoldingLadder';
    root.position.set(wallX, 0, zc); parent.add(root);   // 로컬 +X = 승강로 안쪽, +Z = 승장문 쪽
    const deployedTop = FLOOR_Y[0] + D.sillExtension;
    D.length = deployedTop - Y0;
    // 링크가 짧을수록 같은 145mm 전개에 낙차가 커진다 → 접힘 시 발이 그만큼 떠 있다.
    const closedX = LX - D.wallPivotX, openX = closedX + D.pullX;
    D.closedRise = Math.sqrt(D.linkLength ** 2 - closedX ** 2);
    D.footY = D.closedRise - Math.sqrt(D.linkLength ** 2 - openX ** 2);
    D.closedAngle = Math.atan2(D.closedRise, closedX);
    D.openAngle = Math.atan2(D.closedRise - D.footY, openX);
    const stowedTop = deployedTop + D.footY;
    D.clipY = stowedTop - 0.14;
    D.switchY = stowedTop - 0.095;
    D.pullZ = 0;
    root.userData = { type: 'pit-ladder', deployed: false, contactClosed: true,
      width: D.width, effectiveWidth: D.effectiveWidth, stepPitch: D.rungPitch, stepDepth: D.rungDepth,
      railWidth: D.railW, railDepth: D.railD,
      sillExtension: deployedTop - FLOOR_Y[0],
      stowedTop, stowedFootY: D.footY, linkLength: D.linkLength, motion: 'horizontal-foldout', pullX: D.pullX, pullZ: D.pullZ,
      doorDistance: { doorRail: D.doorRailFromDoor, center: FRONT_WALL_INNER_Z - zc, farRail: FRONT_WALL_INNER_Z - (zc - RZ) },
      deployedDoorDistance: { doorRail: D.doorRailFromDoor - D.pullZ, center: FRONT_WALL_INNER_Z - zc - D.pullZ, farRail: FRONT_WALL_INNER_Z - (zc - RZ) - D.pullZ },
      rungToWall: D.standOff + D.railD / 2 - D.rungDepth / 2,
      material: 'aluminium', designLoadN: 1500 };

    function rail(g, x, z, len, depth, name) {
      const m = createBox(depth, len, D.railW, alu, x, len / 2, z, g); m.name = name;
      createBox(0.002, len - 0.01, 0.006, aluDark, x + depth / 2 + 0.0005, len / 2, z, g); // 압출 홈
      return m;
    }
    function rung(g, x, y) {
      const m = createBox(D.rungDepth, D.rungH, D.effectiveWidth, alu, x, y, 0, g); m.name = 'pitLadderNonSlipRung';
      for (const o of [-0.009, 0, 0.009]) createBox(0.003, 0.003, D.effectiveWidth - 0.01, aluDark, x + o, y + D.rungH / 2 + 0.0015, 0, g);
      for (const s of [-1, 1]) createCylinder(0.004, 0.004, 0.004, galv, x, y, s * (outer + 0.002), g).rotation.x = Math.PI / 2;
    }

    // 한 덩어리 전장 사다리. 펼침 상단은 승강장 +1.1m, 접혔을 때 발은 40mm 떠 있다.
    frame = new THREE.Group(); frame.name = 'pitLadderMovingFrame'; frame.position.y = Y0 + D.footY; root.add(frame);
    for (const s of [-1, 1]) {
      rail(frame, LX, s * RZ, D.length, D.railD, 'pitLadderRail');
      createBox(D.railD + 0.006, 0.03, D.railW + 0.006, black, LX, 0.015, s * RZ, frame);
      createBox(D.railD + 0.004, 0.020, D.railW + 0.004, black, LX, D.length - 0.010, s * RZ, frame);
    }
    for (let k = 1; k * D.rungPitch <= D.length - 0.20; k++) rung(frame, LX, k * D.rungPitch);

    // 양쪽 레일의 위아래 링크는 Z축으로 회전한다. Z 이동 없이 +X 전개와 Y 착지만 허용한다.
    const fixed = new THREE.Group(); fixed.name = 'pitLadderWallMount'; root.add(fixed);
    D.socketY.forEach((sy, i) => {
      const y = Y0 + D.footY + sy - D.closedRise;
      const plate = createBox(0.004, 0.085, D.width + 0.04, galv, 0.002, y, 0, fixed); plate.name = 'pitLadderWallBracket';
      for (const side of [-1, 1]) {
        const z = side * (outer + 0.008);
        createCylinder(0.0075, 0.0075, 0.008, galv, 0.008, y, side * RZ, fixed).rotation.z = Math.PI / 2;
        const link = new THREE.Group(); link.name = 'pitLadderFoldLink';
        link.position.set(D.wallPivotX, y, z); link.userData.socketY = sy;
        root.add(link); links.push(link);
        createBox(D.linkLength, 0.020, 0.006, galv, D.linkLength / 2, 0, 0, link);
        for (const x of [0, D.linkLength]) createCylinder(0.009, 0.009, 0.025, galv, x, 0, 0, link).rotation.x = Math.PI / 2;
        createBox(0.032, 0.045, 0.022, galv, LX, link.userData.socketY, z, frame);
        batchStaticChildren(link, 'pitLadderLink' + links.length);
      }
      if (i === 1) {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 150;
        const c = cv.getContext('2d');
        c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, 512, 150); c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 138);
        c.fillStyle = '#111'; c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillText('엘리베이터 주행구간에', 256, 62);
        c.font = 'bold 58px sans-serif'; c.fillText('돌 출 금 지', 256, 124);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.05),
          new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.6 }));
        label.rotation.y = Math.PI / 2; label.position.set(0.0045, y, 0); label.name = 'pitLadderNoProtrusionSticker';
        fixed.add(label);
      }
    });

    const frontX = LX + D.railD / 2;
    // 배꼽 스위치를 누르는 액추에이터 판(접힘 상태에서 스위치 높이).
    const act = createBox(0.003, 0.035, 0.060, galv, ACT_X, D.switchY - (Y0 + D.footY), inner - 0.005, frame);
    act.name = 'pitLadderSwitchActuator';

    // 흰 플라스틱 스냅 클립 — 벽에 고정. 레일 바깥 옆면을 따라 나온 탄성 손가락 끝의 둥근 돌기가
    // 레일 앞면 모서리를 5mm 물고 있다. 당기면 레일 모서리가 돌기를 밀어 손가락이 살짝 벌어지고,
    // 레일이 빠지면 딸깍 제자리로 돌아온다. 밀어 넣을 때도 같은 원리로 다시 물린다.
    const CLIP = { h: 0.07, bite: 0.005, beadR: 0.007, root: D.standOff - 0.005 };
    CLIP.beadX = frontX + CLIP.beadR + 0.0005; CLIP.lever = CLIP.beadX - CLIP.root;
    D.clip = CLIP;
    for (const s of [-1, 1]) {
      createBox(CLIP.root - 0.020, 0.04, 0.016, galv, (CLIP.root - 0.020) / 2, D.clipY, s * (outer + 0.010), fixed);
      createBox(0.020, CLIP.h, 0.018, white, CLIP.root - 0.010, D.clipY, s * (outer + 0.010), fixed);
      const finger = new THREE.Group(); finger.name = 'pitLadderStorageClip';
      finger.position.set(CLIP.root, D.clipY, s * (outer + 0.006)); root.add(finger);
      createBox(CLIP.lever + 0.004, CLIP.h, 0.010, white, (CLIP.lever + 0.004) / 2, 0, 0, finger);
      createCylinder(CLIP.beadR, CLIP.beadR, CLIP.h, white, CLIP.lever, 0, s * (CLIP.beadR - CLIP.bite - 0.006), finger);
      finger.userData.side = s; clips.push(finger);
    }

    // 실사형 배꼽 스위치: 접힌 판이 은색 누름봉을 누르면 회로 연결, 놓이면 개로.
    sw = new THREE.Group(); sw.name = 'pitLadderNCswitch';
    sw.userData = { type: 'pit-ladder-switch', contactClosed: true, pressedClosesCircuit: true };
    sw.position.set(SW_X, D.switchY, inner - 0.017); root.add(sw);
    createBox(SW_X, 0.012, 0.026, galv, SW_X / 2, D.switchY - 0.045, inner - 0.017, fixed);
    createBox(0.002, 0.07, 0.036, galv, 0.001, 0, 0, sw);
    plunger = new THREE.Group(); plunger.name = 'pitLadderPlunger'; sw.add(plunger);
    new THREE.GLTFLoader().load('models/gltf/pit_ladder_switch.glb', gltf => {
      const body = gltf.scene.getObjectByName('SwitchBody'), pin = gltf.scene.getObjectByName('SwitchPlunger');
      const contract = gltf.scene.getObjectByName('PitLadderSwitchModel')?.userData;
      if (!body || !pin || contract?.pressedTip !== PIT_LADDER_SWITCH.pressedTip || contract?.travel !== PIT_LADDER_SWITCH.travel) {
        console.error('Pit ladder switch: GLB mount contract mismatch'); return;
      }
      sw.add(body); plunger.add(pin);
      sw.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      modelReady = true; root.userData.switchReady = true;
    }, undefined, error => console.error('Pit ladder switch load failed', error));
    // 스위치선: 사다리 뒤 벽면을 타고 피트 정지 박스 우측 예비 글랜드로 인입.
    const cable = new THREE.Group(); cable.name = 'pitLadderSwitchCable'; root.add(cable);
    const gz = PIT_STOP_Z - 0.040 - zc, gy = PIT_STOP_Y - PIT_STOP_H / 2 - 0.018;
    const pts = [[D.standOff + 0.016, D.switchY - 0.03, inner - 0.017], [D.standOff + 0.016, D.switchY - 0.06, inner - 0.017],
      [0.03, D.switchY - 0.08, inner - 0.017], [0.03, D.switchY - 0.08, outer + 0.03], [0.03, gy - 0.16, outer + 0.03], [0.034, gy - 0.16, gz - 0.06],
      [0.034, gy - 0.10, gz], [0.034, gy, gz]].map(p => new THREE.Vector3(...p));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], v = b.clone().sub(a);
      const m = createCylinder(0.004, 0.004, v.length(), black, ...a.clone().add(b).multiplyScalar(0.5).toArray(), cable);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    }
    // 이름 없는 고정 소부품(리브·나사·브라켓·가이드)은 절별로 합친다. 이름 붙은 레일·발판·스위치는 유지.
    // 간극 검증에서 떨어진 벽 취부품 사이의 빈 공간을 장애물로 보지 않도록 식별한다.
    fixed.children.forEach((o, i) => { if (!o.name) o.name = 'pitLadderMountPart_' + i; });
    batchStaticChildren(frame, 'pitLadderFrame');
    clips.forEach((c, i) => batchStaticChildren(c, 'pitLadderClip' + i));
    setPose(false);
    actionButton = document.createElement('button');
    actionButton.id = 'pit-ladder-action'; actionButton.type = 'button';
    actionButton.style.cssText = 'position:fixed;z-index:12;min-height:44px;padding:8px 12px;border:1px solid #a5b8c5;border-radius:22px;background:#f8fbff;color:#182533;box-shadow:0 2px 8px #0005;cursor:pointer;font:600 13px sans-serif;display:none';
    actionButton.addEventListener('click', () => {
      if (!toggle()) updateStatus('v-dir', '카를 사다리보다 높이 올려 정지한 후 조작', '#f0883e');
    });
    document.body.appendChild(actionButton);
    syncButton();
  }

  // 레일(앞면 frontX+dx, 뒷면 standOff+dx)이 돌기 원을 침범하지 않도록 손가락이 벌어지는 양.
  function clipSpread(dx) {
    const c = D.clip, e = Math.max(0, D.standOff + dx - c.beadX, c.beadX - (D.standOff + D.railD + dx));
    if (e >= c.beadR) return 0;
    return Math.asin(Math.max(0, Math.sqrt(c.beadR ** 2 - e * e) - (c.beadR - c.bite)) / c.lever);
  }
  function pose(fold) {
    const angle = D.closedAngle + (D.openAngle - D.closedAngle) * fold;
    const dx = D.wallPivotX + D.linkLength * Math.cos(angle) - D.lx;
    frame.position.set(dx, Y0 + D.footY + D.linkLength * Math.sin(angle) - D.closedRise, 0);
    links.forEach(link => { link.rotation.z = angle; });
    const spread = clipSpread(dx);
    clips.forEach(c => { c.rotation.y = -c.userData.side * spread; });
    // 판이 떨어지면 은색 누름봉이 6 mm 튀어나온다. 무가압 상태는 운행 회로 개로.
    plunger.position.x = PIT_LADDER_SWITCH.pressedTip + Math.max(0, Math.min(dx, PIT_LADDER_SWITCH.travel));
  }
  function setContact(closed) {
    root.userData.contactClosed = closed; sw.userData.contactClosed = closed;
  }
  function setPose(open) {
    deployed = open;
    pose(open ? 1 : 0);
    root.userData.deployed = open;
    setContact(!open);
    const button = document.getElementById('btn-pit-ladder');
    if (button) {
      button.textContent = '사다리';
      button.title = open ? '피트 사다리 접기' : '피트 사다리 펴기';
      button.classList.toggle('warn', open);
      button.setAttribute('aria-pressed', String(open));
    }
    const output = document.getElementById('pit-ladder-status');
    if (output) output.textContent = open ? '펼침 · 운행 차단' : '접힘 · 운행 가능';
    syncButton();
  }
  function syncButton() {
    if (!actionButton) return;
    actionButton.textContent = busy ? '↔ 사다리 이동 중' : deployed ? '↔ 사다리 접기' : '↔ 사다리 펼치기';
    actionButton.setAttribute('aria-label', deployed ? '피트 사다리 접기' : '피트 사다리 펼치기');
    actionButton.setAttribute('aria-pressed', String(deployed));
    actionButton.disabled = busy;
    actionButton.style.borderColor = deployed || busy ? '#cf5034' : '#a5b8c5';
  }
  function update() {
    if (!actionButton || !root) return;
    anchor.set(D.ux + frame.position.x, 1.34, -D.width / 2 - 0.065 + frame.position.z); root.localToWorld(anchor);
    const near = camera.position.distanceToSquared(anchor) < 49;
    anchor.project(camera);
    const visible = near && root.visible && pitGrp.visible && anchor.z > -1 && anchor.z < 1 && Math.abs(anchor.x) < 0.95 && Math.abs(anchor.y) < 0.9;
    actionButton.style.display = visible ? 'block' : 'none';
    if (visible) {
      actionButton.style.left = Math.min(innerWidth - 150, Math.max(8, (anchor.x + 1) * innerWidth / 2 + 18)) + 'px';
      actionButton.style.top = Math.min(innerHeight - 52, Math.max(8, (1 - anchor.y) * innerHeight / 2)) + 'px';
    }
  }
  function toggle() {
    if (!root || !modelReady || busy || moving) return false;
    const open = !deployed;
    // 전장 사다리가 수평으로 나오므로 에이프런을 포함한 카 하단이 사다리 상단을 벗어나야 한다.
    if (open && new THREE.Box3().setFromObject(carGrp).min.y < root.userData.stowedTop + 0.05) return false;
    busy = true;
    syncButton();
    const st = { fold: open ? 0 : 1 };
    setContact(false); // 펴는 순간부터, 접을 때는 클립이 다시 물 때까지 운행 차단
    gsap.to(st, { fold: open ? 1 : 0, duration: 1.2, ease: 'power2.inOut',
      onUpdate: () => pose(st.fold), onComplete: () => { busy = false; setPose(open); } });
    return true;
  }
  return { build, toggle, update, get secured() { return !!root && root.userData.contactClosed; },
    get deployed() { return deployed; }, dimensions: D };
})();
