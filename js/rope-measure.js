/* 주로프 측정 교육. 사용자 영상 16:43–17:56 / docs/ROPE-MEASUREMENT.md.
   직경 기준은 '비마모부 실측 직경의 90% 이상'. 공칭 지름을 분모로 쓰지 않는다.
   2026-10-05 사용자: 4번 로프 한 가닥을 먼저 마모부(균형추측 — 시브를 지나 힘을 받는 구간)에서 재고,
   뒤로 돌아 비마모부(카측 바빗 소켓 바로 위 — 시브에 감기지 않아 힘을 받지 않는 구간)를 재고 끝낸다.
   12φ 비마모부는 보통 12.2~12.34mm, 예시 마모부는 90% 이상(적합)이다. 승곰이 팔은 짧게(관절 ARM).
   아래 측정값은 교육용 예시이며 기존 로프의 실제 손상/강도 계산값이 아니다. */
const RopeMeasure = (() => {
  const EXAMPLE = Object.freeze({ reference: 12.25, worn: 11.18, limitRatio: .9 });
  const state = { active: false, stage: 'idle', completed: false, zeroed: false, reference: null, readings: [], ratio: null };
  const motion = { y: 0, jaw: .025, lift: 0, walk: 0, step: 0 };
  // ROPE = 4번 로프(앞줄 — 균형추측이 후면 난간에 가장 가깝다). 측정점 높이는 카 지붕 기준.
  const CREW_SCALE = 1.2, ARM = .16, GLOW_LENGTH = 1, ROPE = 3, WORN_H = .22, UNWORN_ABOVE_SOCKET = .04;
  const glowTargets = [];
  const handA = new THREE.Vector3(), handB = new THREE.Vector3(), carried = new THREE.Vector3(), restHold = new THREE.Vector3();
  const wornPoint = new THREE.Vector3(), unwornPoint = new THREE.Vector3(), site = new THREE.Vector3(), bearAt = new THREE.Vector3();
  const standWorn = new THREE.Vector3(), standUnworn = new THREE.Vector3(), lineTop = new THREE.Vector3(), lineBottom = new THREE.Vector3(), lineDir = new THREE.Vector3();
  let worker, arms, hiddenDrop = null, bearYaw = -Math.PI / 2;
  const v = new THREE.Vector3(), w = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const splitEdge = new THREE.Vector3();
  const pickBottom = new THREE.Vector3(), pickTop = new THREE.Vector3(), pickRay = new THREE.Vector3(), pickPoint = new THREE.Vector3(), pickForward = new THREE.Vector3(), pickDelta = new THREE.Vector3();
  let panel, heading, caption, readout, detail, next, root, caliper, slide, screen, screenCtx, screenTex, marker, buttons = [];
  let timeline, saved, lobbyY, materialS, roofY, sample, sampleMat, replacements, lastReading = '';
  const steps = ['ready', 'lobby', 'transfer', 'zero', 'worn', 'turn', 'unworn', 'result'];
  const copy = {
    ready: ['승곰이의 주로프 측정', '승곰이가 카 상부에서 버니어 캘리퍼스로 4번 로프 한 가닥을 잽니다. 먼저 마모부, 그다음 뒤로 돌아 비마모부를 재서 비교합니다.'],
    lobby: ['자주 서는 층의 시브 구간', '이 예시는 1층이 주출입층입니다. 그 층에서 주도르래에 걸리는 로프 구간을 표시합니다. 반복 굽힘·기동과 정지·접촉압 때문에 마모가 가장 많은 구간입니다.'],
    transfer: ['표시한 구간을 카 상부에서 찾기', '1:1 로핑에서는 카가 올라가면 표시한 로프가 시브를 넘어 균형추측으로 내려옵니다. 후면 난간 바로 너머에 오도록 카를 세웁니다.'],
    zero: ['버니어 캘리퍼스 영점 조정', '카를 정지시킨 뒤 측정합니다. 측정면을 닫아 영점을 맞춥니다. 카 상부에서는 추락에 주의합니다.'],
    worn: ['① 마모부 측정 · 균형추측', '시브를 지나며 힘을 받는 쪽이라 마모가 많습니다. 난간 사이로 손을 넣어 4번 로프의 봉우리↔봉우리를 잽니다. 예시 측정값 11.18mm.'],
    turn: ['뒤로 돌아 비마모부로', '카측 바빗 소켓 바로 위 로프는 시브에 감기지 않아 힘(굽힘·마찰)을 받을 일이 없습니다. 같은 4번 로프의 이 구간이 비교 기준입니다.'],
    unworn: ['② 비마모부 측정 · 카측 소켓 위', '마모되지 않은 부분의 실측 지름입니다. 12φ 로프는 보통 12.2~12.34mm가 나옵니다. 예시 측정값 12.25mm. 공칭지름 12를 대신 쓰지 않습니다.'],
    result: ['측정 결과 · 적합', '마모부분의 와이어로프 지름은 마모되지 않은 부분 지름의 90% 이상이어야 합니다. 4번 로프 마모부는 비마모부의 91%로 기준을 만족합니다.']
  };
  function reason() {
    if (state.active) return '로프 측정 시연 중입니다.';
    if (!wireRopeShape || ropeObjs.length !== 5) return '주로프를 불러오는 중입니다.';
    if (moving || estop || insMode || doorOpen || CarDoor.state.busy || !CarDoor.secured()) return '자동 모드에서 문을 닫고 카가 정지한 뒤 실행하세요.';
    if (overspeedActive || governorPhase === 'tripped' || DoorBypass.mode !== 'off' || InspectionReturn.busy || HallManual.busy || Mascot.inspecting || CharacterWalk.active ||
      PhotoEyeDemo.active || ARDDemo.active || ManualRescueDemo.active || BufferDemo.active || RetentionDemo.active || InterlockDemo.active || RelayRopeDemo.active || UCMDemo.state.active || AscentDemo.active || BrakeDemo.active || TerminalDemo.active) return '다른 시연·점검을 마친 뒤 실행하세요.';
    return '';
  }
  function setCar(y) {
    const delta = y - carGrp.position.y; carGrp.position.y = y; cwtGrp.position.y -= delta;
    spinSheaves(delta); refreshRopes(); refreshGovernorRope();
    const light = scene.getObjectByName('carLight'); if (light) light.position.y = y + S.CAR_H * .75;
  }
  // 호길이 원점은 카측 시브 접점. 표시 재료는 카 상승량만큼 균형추 쪽으로 이동한다.
  function markedPoint(index, out, offset = 0) {
    const r = ropeObjs[index], sh = wireRopeShape, s = materialS + carGrp.position.y - lobbyY + offset;
    if (s <= sh.arcLen && s >= 0) { out.copy(sh.path.getPoint(s / sh.arcLen)); out.x += r.rx; }
    else if (s > sh.arcLen) {
      const bottomY = cwtGrp.position.y + S.CWT_H / 2 + CWT_ROPE_END_DY;
      out.set(r.rx, sh.cwtTopY, sh.cwtTopZ); w.set(r.hx, bottomY, cwtGrp.position.z + r.hz);
      out.lerp(w, (s - sh.arcLen) / out.distanceTo(w));
    } else {
      out.set(r.rx, sh.carTopY, sh.carTopZ); w.set(r.hx, carGrp.position.y + S.CAR_H / 2 + CAR_ROPE_END_DY, CAR_CTR_Z + r.hz);
      out.lerp(w, -s / out.distanceTo(w));
    }
    return out;
  }
  // 로프 한쪽 하강부의 양 끝(위 = 시브 접점, 아래 = 히치). side 0 = 균형추측, 1 = 카측.
  function dropLine(side) {
    const r = ropeObjs[ROPE], sh = wireRopeShape;
    if (side) { lineTop.set(r.rx, sh.carTopY, sh.carTopZ); lineBottom.set(r.hx, carGrp.position.y + S.CAR_H / 2 + CAR_ROPE_END_DY, CAR_CTR_Z + r.hz); }
    else { lineTop.set(r.rx, sh.cwtTopY, sh.cwtTopZ); lineBottom.set(r.hx, cwtGrp.position.y + S.CWT_H / 2 + CWT_ROPE_END_DY, cwtGrp.position.z + r.hz); }
    lineDir.copy(lineTop).sub(lineBottom).normalize();
  }
  // 측정점과 서는 자리. 승곰이는 −X 를 보고 서며, 오른팔(waveArm, −Z 쪽)로 캘리퍼스 본척 끝을 잡는다.
  function sites() {
    const roof = carGrp.position.y + S.CAR_H / 2;
    markedPoint(ROPE, wornPoint);
    dropLine(1); unwornPoint.copy(lineBottom).addScaledVector(lineDir, UNWORN_ABOVE_SOCKET / lineDir.y);
    // 마모부: 후면 난간(파이프 중심 Z) 안쪽 0.32m — 몸통·안전모가 닿지 않고, 뻗은 팔이 중간 바 아래로 지나간다.
    standWorn.set(wornPoint.x + .05, roof, CAR_CTR_Z - S.CAR_D / 2 + .18 + .32);
    // 비마모부: 카측 로프 앞(+Z) 0.52m — 오른팔이 소켓 바로 위 로프에 닿는다.
    standUnworn.set(unwornPoint.x + .05, roof, unwornPoint.z + .52);
  }
  // 승곰이 로컬(+z = 앞) 점 → 월드. 몸 기준 들고 있는 캘리퍼스 위치에 쓴다.
  function bearLocal(out, lx, ly, lz) {
    const c = Math.cos(bearYaw), s = Math.sin(bearYaw);
    return out.set(bearAt.x + lx * c + lz * s, bearAt.y + ly, bearAt.z - lx * s + lz * c);
  }
  function makeVisuals() {
    root = new THREE.Group(); root.name = 'RopeMeasurement'; root.visible = false; scene.add(root);
    worker = Mascot.createWorker('RopeMeasureSeunggom'); arms = Mascot.rescueRig(worker, ARM);
    worker.root.scale.setScalar(CREW_SCALE);
    marker = new THREE.Group(); root.add(marker);
    const markMat = M.paint(0x147e83);
    // 교육용 위치 표시는 시브 보호덮개 뒤에서도 보이게 한다.
    markMat.depthTest = false; markMat.depthWrite = false;
    for (let i = 0; i < 5; i++) {
      const ring = createCylinder(ropeObjs[i].ropeR * 1.35, ropeObjs[i].ropeR * 1.35, .035, markMat, 0, 0, 0, marker);
      ring.name = `ropeMeasureMark_${i + 1}`;
      ring.renderOrder = 20;
    }
    caliper = new THREE.Group(); caliper.name = 'RopeCaliper'; root.add(caliper);
    const metal = M.ss(0x78858f), dark = M.paint(0x030b11), mint = M.paint(0x267b78);
    createBox(.205, .014, .008, metal, .071, .045, .022, caliper);
    const ruler = document.createElement('canvas'); ruler.width = 1024; ruler.height = 80;
    const ctx = ruler.getContext('2d'); ctx.fillStyle = '#aab8c0'; ctx.fillRect(0,0,1024,80); ctx.fillStyle = '#273c47'; ctx.font = '20px sans-serif';
    for (let i=0;i<=170;i++) { const x=(.0315+i/1000)/.205*1024; ctx.fillRect(x,0,2,i%5===0?30:17); if(i%20===0)ctx.fillText(String(i),x+3,59); }
    const rulerFace = new THREE.Mesh(new THREE.PlaneGeometry(.205,.014),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ruler)})); rulerFace.position.set(.071,.045,.0261); caliper.add(rulerFace);
    createBox(.006, .050, .010, metal, -.003, .020, 0, caliper);
    createBox(.010, .012, .035, metal, -.005, .040, .015, caliper);
    slide = new THREE.Group(); slide.name = 'RopeCaliperMovingJaw'; caliper.add(slide);
    createBox(.006, .050, .010, metal, .003, .020, 0, slide);
    createBox(.010, .012, .035, metal, .005, .040, .015, slide);
    createBox(.057, .032, .016, dark, .029, .044, .031, slide);
    createBox(.006, .004, .018, mint, .032, .025, .032, slide);
    screen = document.createElement('canvas'); screen.width = 384; screen.height = 128; screenCtx = screen.getContext('2d');
    screenTex = new THREE.CanvasTexture(screen);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.045, .018), new THREE.MeshBasicMaterial({map:screenTex}));
    face.position.set(.029, .046, .040); slide.add(face);
    // 측정 중인 하강부만 교체한다. 다른 가닥·원래 형상·재질과 운행 로프 계약은 보존한다.
    replacements = new THREE.Group(); replacements.name = 'RopeInspectionSegment'; root.add(replacements);
    for (let i = 0; i < 2; i++) replacements.add(makeRopeDrop(ropeObjs[ROPE].ropeR, getWireRopeMat()));
    sample = new THREE.Group(); replacements.add(sample); sampleMat = M.ss(0x252d33);
    const radius = ropeObjs[ROPE].ropeR, strandR = radius * .27, centerR = radius - strandR;
    for (let i = 0; i < 8; i++) {
      const points = [];
      for (let j = 0; j <= 96; j++) { const y = -.12 + .24 * j / 96, a = i * Math.PI / 4 + y / (radius * 14) * Math.PI * 2; points.push(new THREE.Vector3(centerR * Math.cos(a), y, centerR * Math.sin(a))); }
      sample.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, strandR, 6, false), sampleMat));
    }
    root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.noGlow = true; } });
  }
  function display(value) {
    const text = value.toFixed(2); if (text === lastReading) return; lastReading = text;
    screenCtx.fillStyle = '#d8e7d5'; screenCtx.fillRect(0, 0, 384, 128); screenCtx.fillStyle = '#18342d';
    screenCtx.font = 'bold 80px monospace'; screenCtx.textAlign = 'center'; screenCtx.fillText(text, 165, 96); screenCtx.font = '30px sans-serif'; screenCtx.fillText('mm', 335, 95); screenTex.needsUpdate = true;
    readout.textContent = text + ' mm';
  }
  function restoreDrop() { if (hiddenDrop) hiddenDrop.visible = true; hiddenDrop = null; if (replacements) replacements.visible = false; }
  // 측정 중인 하강부만 두 토막 + 확대 소선 표본으로 바꾼다. 표본 지름 = 측정값.
  function showSample(side, point, diameter) {
    const r = ropeObjs[ROPE], drop = side ? r.carDrop : r.cwtDrop, sh = wireRopeShape;
    if (hiddenDrop !== drop) { restoreDrop(); hiddenDrop = drop; }
    drop.visible = false; replacements.visible = true;
    dropLine(side);
    const u = p => side ? -lineTop.distanceTo(p) / WIRE_ROPE_UV_LEN : (sh.arcLen + lineTop.distanceTo(p)) / WIRE_ROPE_UV_LEN;
    for (let i = 0; i < 2; i++) {
      const edge = splitEdge.copy(point).addScaledVector(lineDir, i ? -.12 : .12);
      const top = i ? edge : lineTop, bottom = i ? lineBottom : edge;
      setRopeDrop(replacements.children[i], top.x, top.y, top.z, bottom.x, bottom.y, bottom.z, u(top), u(bottom));
    }
    sample.position.copy(point); sample.quaternion.setFromUnitVectors(up, lineDir);
    const k = diameter / (r.ropeR * 2000); sample.scale.set(k, 1, k);
  }
  const smooth = t => t * t * (3 - 2 * t);
  function poseWorker() {
    const stepping = motion.walk > .2 && motion.walk < .8;
    worker.inspectionPose(bearAt.x, bearAt.y, bearAt.z, 0, null, null, bearYaw);
    worker.rig.feet.forEach((f, i) => { f.position.y = stepping ? Math.max(0, Math.sin(motion.step + i * Math.PI)) * .035 : 0; });
    worker.rig.head.rotation.x = -.10 * motion.lift;
    worker.root.updateMatrixWorld(true);
    caliper.updateMatrixWorld(true);
    // 들고 있을 땐 양손(왼손 본척 끝·오른손 슬라이더), 로프에 댈 땐 오른손이 본척 끝을 잡고 왼손은 내린다.
    caliper.localToWorld(handA.set(.165, .005, -.042));
    slide.localToWorld(handB.set(.029, .005, -.042));
    const r = worker.rig;
    r.body.localToWorld(restHold.copy(r.holdArm.position).add(v.set(.025, -.30, .075)));
    const t = smooth(motion.lift);
    handB.lerp(handA, t);
    arms.pose(w.copy(handA).lerp(restHold, t), handB);
  }
  function pose() {
    if (!state.active) return;
    for (let i = 0; i < 5; i++) markedPoint(i, marker.children[i].position);
    sites();
    marker.visible = motion.lift < .02 && ['lobby', 'transfer', 'zero'].includes(state.stage);
    // 걸음: 0~0.2 제자리에서 앞(+Z)으로 돌아섬 → 0.2~0.8 걷기 → 0.8~1 다시 −X 를 봄.
    const k = motion.walk, move = smooth(THREE.MathUtils.clamp((k - .2) / .6, 0, 1));
    const turn = k < .2 ? smooth(k / .2) : k > .8 ? 1 - smooth((k - .8) / .2) : 1;
    bearYaw = -Math.PI / 2 * (1 - turn);
    bearAt.copy(standWorn).lerp(standUnworn, move);
    // 들고 있는 자리: 몸 앞 0.22m·배 높이, 측정할 땐 로프(본척은 승곰이 오른쪽으로 뻗는다).
    bearLocal(carried, -.06, .36, .22);
    site.copy(motion.walk > .5 ? unwornPoint : wornPoint);
    caliper.position.copy(carried).lerp(site, motion.lift);
    // 높이는 먼저 내린다 — 난간 면을 지날 때 손이 이미 중간 바 아래에 있다.
    caliper.position.y = carried.y + (site.y - carried.y) * Math.min(1, motion.lift * 1.8);
    caliper.rotation.set(0, bearYaw, 0);
    // 고정·가동 측정면의 중간이 로프 중심이다(측정면은 캘리퍼스 원점 아래 2cm 높이 중앙).
    caliper.position.x -= Math.cos(bearYaw) * motion.jaw / 2; caliper.position.z += Math.sin(bearYaw) * motion.jaw / 2; caliper.position.y -= .02;
    slide.position.x = motion.jaw;
    poseWorker();
    if (['zero', 'worn', 'unworn'].includes(state.stage)) display(state.stage === 'zero' && state.zeroed ? 0 : motion.jaw * 1000);
    if (state.stage === 'worn') showSample(0, wornPoint, EXAMPLE.worn);
    else if (state.stage === 'unworn') showSample(1, unwornPoint, EXAMPLE.reference);
    else restoreDrop();
  }
  function aim() {
    if (!state.active) return;
    const portrait = camera.aspect < .9, far = portrait ? 1.35 : 1;
    sites();
    if (state.stage === 'lobby') { markedPoint(ROPE, v); camera.position.set(v.x + 1.2, v.y + .85, v.z + 1.5); }
    // 측정 장면: 승곰이 왼쪽 앞에서 — 난간 사이로 뻗은 손·캘리퍼스·로프가 한 화면에 든다.
    else if (state.stage === 'worn') { v.copy(wornPoint).add(w.set(.05, .12, .22)); camera.position.copy(wornPoint).add(w.set(-1.15 * far, .62 * far, .5 * far)); }
    else if (state.stage === 'unworn') { v.copy(unwornPoint).add(w.set(.05, -.08, .22)); camera.position.copy(unwornPoint).add(w.set(-1.1 * far, .42 * far, 1.0 * far)); }
    else {
      const roof = carGrp.position.y + S.CAR_H / 2;
      v.set(.05, roof + (portrait ? .3 : .4), CAR_CTR_Z - S.CAR_D / 2 + .55);
      camera.position.set(v.x - (portrait ? 1.5 : 1.3), roof + 1.55, v.z + (portrait ? 1.9 : 1.5));
    }
    controls.target.copy(v); controls.update();
  }
  function stage(key) {
    state.stage = key; [heading.textContent, caption.textContent] = copy[key];
    updateStatus('v-dir', '주로프 측정 · ' + (key==='transfer'?'위치 이동':'교육 시연'), '#55b8d8');
    panel.querySelector('small').textContent = `${steps.indexOf(key) + 1} / ${steps.length} · 주로프 측정 · 4번 로프`;
    detail.hidden = !['worn', 'unworn', 'result'].includes(key);
    readout.hidden = !['zero', 'worn', 'unworn'].includes(key);
    next.hidden = key !== 'result';
    if (key === 'result') {
      const measured = state.readings.reduce((sum, d) => sum + d, 0) / state.readings.length;
      state.ratio = measured / state.reference * 100;
      const ok = state.ratio >= EXAMPLE.limitRatio * 100;
      detail.innerHTML = `마모부 ${measured.toFixed(2)}mm ÷ 비마모부 ${state.reference.toFixed(2)}mm × 100<br><b>= ${state.ratio.toFixed(2)}% · ${ok ? '90% 이상 · 적합' : '90% 미만 · 부적합'}</b><br>기준 지름: ${(state.reference * EXAMPLE.limitRatio).toFixed(2)}mm 이상`;
      state.completed = true;
    } else detail.innerHTML = '<b>봉우리 ↔ 봉우리</b>로 측정합니다.<br>골에 측정면이 들어가면 실제 지름보다 작게 읽힙니다.';
    pose(); aim();
  }
  function start() {
    const why = reason(); if (why) { updateStatus('v-dir', why, '#f0883e'); return false; }
    if (!root) makeVisuals();
    saved = { car: carGrp.position.y, cwt: cwtGrp.position.y, floor: curFloor, eye: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, near: camera.near, min: controls.minDistance, enabled: controls.enabled, mascotVisible: Mascot.root.visible };
    clearTimeout(autoTimer); closeAllMenus(); leaveCabinView(); PartGlow.closeMenu(); gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    Object.assign(state, { active: true, completed: false, zeroed: false, reference: null, readings: [], ratio: null });
    worker.beginInspection(); Mascot.root.visible = false;
    root.visible = true; panel.hidden = false; document.body.classList.add('rope-measure-active'); controls.enabled = false; controls.minDistance = .02; camera.near = .005; camera.fov = 52; camera.updateProjectionMatrix();
    lobbyY = FLOOR_Y[0] + S.CAR_H / 2; materialS = wireRopeShape.arcLen * .12; setCar(lobbyY);
    // 표시 구간이 카 지붕 위 WORN_H(후면 난간 중간 바 아래)에 오는 카 위치를 기존 로프 경로에서 역산한다.
    let lo = lobbyY, hi = FLOOR_Y[FLOORS - 1] + S.CAR_H / 2;
    for (let i = 0; i < 35; i++) { const mid = (lo + hi) / 2; setCar(mid); markedPoint(ROPE, v); if (v.y > mid + S.CAR_H / 2 + WORN_H) lo = mid; else hi = mid; }
    roofY = (lo + hi) / 2; setCar(lobbyY); Object.assign(motion, {y:lobbyY, jaw:.025, lift:0, walk:0, step:0});
    stage('ready');
    timeline = gsap.timeline({onUpdate:pose});
    timeline.to({}, {duration:3}).call(() => stage('lobby')).to({}, {duration:4.5}).call(() => stage('transfer')).to(motion, {y:roofY,duration:5,ease:'power1.inOut',onUpdate:() => { setCar(motion.y); aim(); }})
      .call(() => stage('zero')).to(motion,{jaw:0,duration:1}).call(() => { state.zeroed = true; display(0); }).to({}, {duration:1.8})
      .call(() => { motion.jaw = .025; stage('worn'); }).to(motion,{lift:1,duration:1.4,ease:'power1.inOut'}).to(motion,{jaw:EXAMPLE.worn/1000,duration:1}).call(() => state.readings.push(EXAMPLE.worn)).to({}, {duration:3.5})
      .to(motion,{jaw:.024,duration:.4}).to(motion,{lift:0,duration:1.1,ease:'power1.inOut'}).call(() => stage('turn'))
      .to(motion,{walk:1,step:'+=' + Math.PI * 10,duration:3.2,ease:'none'})
      .call(() => { motion.jaw = .025; stage('unworn'); }).to(motion,{lift:1,duration:1.3,ease:'power1.inOut'}).to(motion,{jaw:EXAMPLE.reference/1000,duration:1}).call(() => { state.reference = EXAMPLE.reference; }).to({}, {duration:3.5})
      .to(motion,{jaw:.024,duration:.4}).to(motion,{lift:0,duration:1}).call(() => stage('result'));
    return true;
  }
  function cancel() {
    if (!state.active) { panel.hidden = true; return; }
    timeline?.kill(); if (DemoPause.paused) DemoPause.set(false);
    gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target); restoreDrop(); setCar(saved.car); cwtGrp.position.y = saved.cwt; refreshRopes();
    curFloor = saved.floor; state.active = false; root.visible = false; panel.hidden = true;
    arms.reset(); worker.endInspection(); Mascot.root.visible = saved.mascotVisible;
    camera.position.copy(saved.eye); controls.target.copy(saved.target); camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix(); controls.minDistance = saved.min; controls.enabled = saved.enabled; controls.update();
    document.body.classList.remove('rope-measure-active'); syncAllIndicators(curFloor + 1, ''); updateStatus('v-dir', '정지 대기', '#8b949e');
  }
  function update() {
    if (!panel || !wireRopeShape) return;
    for (let i = 0; i < glowTargets.length; i++) {
      const r = ropeObjs[i], target = glowTargets[i];
      if (target.userData.carY !== carGrp.position.y) {
        socketSegment(r);
        setRopeDrop(target, pickTop.x, pickTop.y, pickTop.z, pickBottom.x, pickBottom.y, pickBottom.z, 0, 0);
        target.userData.carY = carGrp.position.y;
        target.updateMatrixWorld(true);
      }
      target.visible = r.line.visible && r.carDrop.visible;
    }
    if (state.active) { buttons.forEach(b => b.hidden = true); if (estop) cancel(); return; }
    buttons.forEach(b => {
      const r = ropeObjs[2]; if (!r) return;
      v.set(r.hx, carGrp.position.y + S.CAR_H / 2 + CAR_ROPE_END_DY + .15, CAR_CTR_Z + r.hz);
      // 카 상부 로프가 화면에 있으면 선택 가능하다. 관찰 카메라의 높이·줌으로 잠그지 않는다.
      v.project(camera);
      b.hidden = !!reason() || v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
      if (!b.hidden) PartActions.positionButton(b, (v.x + 1) * innerWidth/2 - 22, (1-v.y)*innerHeight/2 - 22);
    });
  }
  function socketSegment(r) {
    pickBottom.set(r.hx, carGrp.position.y + S.CAR_H / 2 + CAR_ROPE_END_DY, CAR_CTR_Z + r.hz);
    pickTop.set(r.rx, wireRopeShape.carTopY, wireRopeShape.carTopZ);
    pickTop.sub(pickBottom).clampLength(0, GLOW_LENGTH).add(pickBottom);
  }
  function pickNearRope(raycaster) {
    // 얇고 긴 로프는 PartGlow의 작은 사각 부품용 탭 여유에서 제외되므로 선분으로 판정한다.
    // 클릭 여유만 화면 기준 10px로 늘리고 실제 로프 형상·발광 폭·가림 판정은 유지한다.
    camera.getWorldDirection(pickForward);
    const pixelScale = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / renderer.domElement.clientHeight;
    let best = null;
    for (const r of ropeObjs) {
      if (!r.carDrop.visible || !r.line.visible) continue;
      socketSegment(r);
      const d2 = raycaster.ray.distanceSqToSegment(pickBottom, pickTop, pickRay, pickPoint);
      const depth = pickDelta.copy(pickPoint).sub(camera.position).dot(pickForward);
      if (depth < camera.near || depth > camera.far) continue;
      const radius = Math.max(r.ropeR, depth * pixelScale * 10), distance = raycaster.ray.origin.distanceTo(pickRay);
      if (d2 <= radius * radius && distance >= raycaster.near && distance <= raycaster.far && (!best || distance < best.distance)) best = {distance, object:r.carDrop};
    }
    return best;
  }
  function build() {
    // 발광·선택 전용 1m 형상. 메인 장면에는 넣지 않아 실제 로프를 중복 렌더하지 않는다.
    for (const r of ropeObjs) {
      const target = makeRopeDrop(r.ropeR, getWireRopeMat());
      target.name = 'RopeMeasureSocketGlow'; target.castShadow = false;
      glowTargets.push(target);
    }
    const style = document.createElement('style'); style.textContent = `
      #rope-measure-panel{position:fixed;z-index:121;left:50%;bottom:16px;transform:translateX(-50%);width:500px;max-width:calc(100vw - 28px);padding:16px 20px;box-sizing:border-box;background:#f1fafff5;color:#284b60;border:1px solid #97d9df;border-radius:16px;box-shadow:0 6px 26px #16485725;font:14px/1.55 sans-serif}
      #rope-measure-panel[hidden],#rope-measure-panel [hidden]{display:none}#rope-measure-panel small{font-size:11px;color:#598199}#rope-measure-panel h3{font-size:19px;margin:5px 28px 7px 0;color:#227d91}#rope-measure-panel p{margin:6px 0;word-break:keep-all}#rope-measure-readout{font:bold 26px monospace;color:#176873}#rope-measure-detail{padding:8px 10px;background:#dceff4;border-radius:9px;font-size:12px}#rope-measure-exit{position:absolute;right:4px;top:4px;width:44px;height:44px;border:0;background:transparent;color:#397c9a;font-size:26px;cursor:pointer}#rope-measure-return{min-height:44px;border:0;border-radius:8px;background:#237e96;color:white;padding:8px 18px;margin-top:8px;cursor:pointer}
      body.rope-measure-active .part-action,body.rope-measure-active #part-menu,body.rope-measure-active #part-tip{visibility:hidden!important}body.rope-measure-active #fbtns,body.rope-measure-active #btn-open,body.rope-measure-active #btn-close{display:none!important}
      @media(max-width:600px){#rope-measure-panel{left:10px;right:72px;bottom:10px;transform:none;width:auto;max-width:none;padding:11px 13px;font-size:12px;max-height:43vh;overflow:auto}#rope-measure-panel h3{font-size:16px}#rope-measure-readout{font-size:22px}}
      @media(max-height:500px) and (min-width:600px){#rope-measure-panel{left:auto;right:12px;top:10px;bottom:auto;transform:none;width:290px;max-height:75vh;overflow:auto;font-size:12px}}
    `; document.head.appendChild(style);
    panel = document.createElement('section'); panel.id = 'rope-measure-panel'; panel.hidden = true; panel.setAttribute('aria-label','주로프 지름 측정');
    panel.innerHTML = '<small></small><button id="rope-measure-exit" aria-label="로프 측정 종료">×</button><h3></h3><div id="rope-measure-readout"></div><p role="status"></p><div id="rope-measure-detail"></div><p><small>4번 로프 · 교육용 측정값 · 비마모부 대비 90% 기준</small></p><button id="rope-measure-return">측정 종료 · 원래 위치</button>';
    document.body.appendChild(panel); heading = panel.querySelector('h3'); caption = panel.querySelector('p'); readout = panel.querySelector('#rope-measure-readout'); detail = panel.querySelector('#rope-measure-detail'); next = panel.querySelector('#rope-measure-return');
    panel.querySelector('#rope-measure-exit').onclick = next.onclick = cancel;
    for (const id of ['rope-measure-roof']) {
      const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'part-action'; b.hidden = true; b.setAttribute('aria-label','주로프 지름 측정'); b.onclick = start; document.getElementById('part-actions').appendChild(b); buttons.push(b);
      PartGlow.bind(b, () => glowTargets, '카 상부 주로프', () => '지름 측정 · 마모 검사', {direct:true, hitTest:pickNearRope});
    }
    document.addEventListener('keydown',e => { if (state.active && e.key === 'Escape') { e.preventDefault(); cancel(); } });
    for (const type of ['click','pointerdown','keydown','change','dblclick']) document.addEventListener(type,e => {
      if (!state.active || panel.contains(e.target) || e.target.closest?.('#btn-estop,#demo-pause,#pc-reset') || (DemoPause.paused && e.target.closest?.('canvas'))) return;
      if (type === 'keydown' && e.key === 'Escape') { e.preventDefault(); cancel(); return; }
      if (e.target.closest?.('button,input,select,canvas') || type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
    },true);
    window.addEventListener('resize', () => { if(state.active) aim(); });
  }
  return {build,update,start,cancel,get active(){return state.active;},get state(){return state;},get example(){return EXAMPLE;},markedPoint};
})();
