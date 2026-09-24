/* ─────────────────────────────────────────────────────────────
   기계실 마스코트 「승강곰」 — 오리지널 캐릭터(외부 IP 없음, 배포 가능).
   동글동글한 크림색 아기곰 + 노란 안전모 + 남색 미니 조끼(반사띠) + 스패너.
   키 약 0.85m. 손 흔들기·몸 까딱·눈 깜빡임 대기 동작.
   ▪ 형상은 build() 에서 한 번만 만든다. update() 는 회전·위치·스케일만 바꾼다.
   ▪ 움직이는 부품이 그림자 캐시(environment.js)를 매 프레임 무효화하지 않도록
     castShadow 를 끄고, 발밑에 고정 원형 그림자를 둔다.
   ▪ 표시 여부는 카메라 메뉴 「캐릭터」 버튼(Mascot.setVisible)으로 켜고 끈다.
   ───────────────────────────────────────────────────────────── */
const Mascot = (() => {
  let root = null, parts = null;

  function build(parent, x, y, z, yaw) {
    const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const FUR = std(0xf1dcc0, .85), FUR_IN = std(0xfff2e2, .9), NOSE = std(0x3a2a24, .4), EYE = std(0x16110f, .25),
      CHEEK = std(0xf4a7a0, .8), HELMET = std(0xf6c21c, .32), VEST = std(0x1d2d4f, .7), REFL = std(0xd9dee2, .25, .6),
      STEEL = std(0xb8bec5, .3, .85), GRIP = std(0xd6392f, .55), SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false });
    const sphere = new THREE.SphereGeometry(1, 32, 24);
    const add = (p, geo, mat, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.receiveShadow = true; p.add(m); return m; };
    const ball = (p, rx, ry, rz, mat, px, py, pz) => { const m = add(p, sphere, mat, px, py, pz); m.scale.set(rx, ry, rz); return m; };
    const group = (p, px = 0, py = 0, pz = 0) => { const g = new THREE.Group(); g.position.set(px, py, pz); p.add(g); return g; };

    root = new THREE.Group(); root.name = 'MachineRoomMascot';
    root.position.set(x, y, z); root.rotation.y = yaw;
    root.userData = { type: 'mascot', name: '승강곰' };
    parent.add(root);
    const shadow = add(root, new THREE.CircleGeometry(.20, 32), SHADOW, 0, .002, 0);
    shadow.rotation.x = -Math.PI / 2; shadow.receiveShadow = false;

    const body = group(root);
    // legs + feet (short and round)
    for (const s of [-1, 1]) {
      ball(body, .075, .075, .075, FUR, s * .085, .07, 0);
      ball(body, .07, .045, .095, FUR, s * .09, .035, .03);
      ball(body, .036, .018, .04, FUR_IN, s * .09, .03, .105);            // paw pad
    }
    // round belly-body + vest
    ball(body, .20, .21, .18, FUR, 0, .27, 0);
    ball(body, .125, .13, .06, FUR_IN, 0, .25, .135);                       // belly patch
    const vest = add(body, new THREE.SphereGeometry(1, 40, 24, Math.PI * .62, Math.PI * 1.76, Math.PI * .28, Math.PI * .50), VEST, 0, .275, 0);
    vest.scale.set(.207, .217, .187); vest.material.side = THREE.DoubleSide;
    const band = add(body, new THREE.CylinderGeometry(1, 1, .022, 40, 1, true, Math.PI * .62, Math.PI * 1.76), REFL, 0, .235, 0);
    band.scale.set(.212, 1, .193);
    add(body, new THREE.BoxGeometry(.06, .022, .004), REFL, .085, .33, .158).rotation.set(-.35, .45, 0);   // name tag

    // head (big, chibi proportion)
    const head = group(body, 0, .58, 0);
    ball(head, .20, .185, .18, FUR, 0, 0, 0);
    for (const s of [-1, 1]) {                                                // ears (outside the helmet brim)
      ball(head, .062, .062, .04, FUR, s * .155, .135, -.01);
      ball(head, .035, .035, .02, FUR_IN, s * .155, .135, .018);
    }
    ball(head, .085, .062, .06, FUR_IN, 0, -.055, .145);                     // muzzle
    ball(head, .028, .02, .018, NOSE, 0, -.035, .203);
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = ball(head, .026, .032, .016, EYE, s * .075, .015, .165); eyes.push(e);
      ball(head, .008, .008, .004, FUR_IN, s * .075 + .008, .027, .18);     // eye highlight
      ball(head, .033, .018, .01, CHEEK, s * .125, -.045, .14);
    }
    const mouth = add(head, new THREE.TorusGeometry(.018, .0035, 8, 16, Math.PI), NOSE, 0, -.072, .196);
    mouth.rotation.z = Math.PI;
    // yellow safety helmet (brim + ridge + logo dot)
    const helmet = group(head, 0, .07, -.005);
    const dome = add(helmet, new THREE.SphereGeometry(.19, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), HELMET); dome.scale.set(1.03, .82, 1.0);
    add(helmet, new THREE.CylinderGeometry(.215, .215, .012, 40), HELMET, 0, .003, .02).scale.z = 1.08;
    add(helmet, new THREE.BoxGeometry(.03, .028, .30), HELMET, 0, .145, 0);
    add(helmet, new THREE.CylinderGeometry(.03, .03, .004, 24), std(0x1d2d4f, .5), 0, .105, .158).rotation.x = Math.PI / 2 - .7;

    // arms: right one waves, left holds a small wrench
    const arm = s => {
      const sh = group(body, s * .185, .36, 0);
      ball(sh, .052, .09, .052, FUR, 0, -.07, 0);
      const paw = ball(sh, .048, .048, .048, FUR, 0, -.15, 0);
      return sh;
    };
    const waveArm = arm(-1), holdArm = arm(1);
    const wrench = group(holdArm, 0, -.16, .03);
    add(wrench, new THREE.BoxGeometry(.018, .16, .008), STEEL, 0, -.02, 0);
    add(wrench, new THREE.CylinderGeometry(.013, .013, .07, 12), GRIP, 0, .03, 0);
    const jaw = add(wrench, new THREE.TorusGeometry(.024, .008, 8, 20, Math.PI * 1.5), STEEL, 0, -.11, 0);
    jaw.rotation.z = Math.PI * .75;
    wrench.rotation.set(.3, 0, -.25);
    holdArm.rotation.z = .25;

    parts = { body, head, eyes, waveArm, holdArm };
    root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return root;
  }

  // t: seconds. Called from renderLoop; only transforms change.
  function update(t) {
    if (!root || !root.visible) return;
    const p = parts;
    p.body.position.y = .012 * Math.abs(Math.sin(t * 2.2));
    p.body.rotation.z = .05 * Math.sin(t * 1.1);
    p.head.rotation.z = .12 * Math.sin(t * 1.1 + .6);
    p.head.rotation.x = -.05 + .04 * Math.sin(t * 2.2);
    p.waveArm.rotation.z = -2.35 + .38 * Math.sin(t * 5.2);     // raised, waving
    p.waveArm.rotation.x = -.15;
    p.holdArm.rotation.x = .08 * Math.sin(t * 1.1);
    const blink = (t % 3.6) > 3.45 ? .12 : 1;                    // quick blink every 3.6 s
    p.eyes.forEach(e => { e.scale.y = .032 * blink; });
  }

  function setVisible(on) { if (root) root.visible = !!on; }
  function isVisible() { return !!(root && root.visible); }
  return { build, update, setVisible, isVisible, get root() { return root; } };
})();
