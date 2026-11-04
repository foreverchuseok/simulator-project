/* 승곰이 한 명의 체험. 운행 FSM은 기존 PassengerControls/ui.js가 소유한다.
   보행면은 environment의 치수 계약에서 파생하고 카 탑승자는 카의 실제 Y를 따른다. */
const CharacterWalk = (() => {
  const actors = [], keys = new Set();
  const target = new THREE.Vector3(), desired = new THREE.Vector3(), hit = new THREE.Vector3();
  const cameraRay = new THREE.Ray(), direction = new THREE.Vector3(), cameraBoxes = [];
  let active = null, plaza, layout, panel, toggle, status, ring, saved;
  let yaw = 0, pitch = .30, lastTime = 0, viewY = 0, lookPointer = null;
  const walkRay = new THREE.Raycaster(), walkNdc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(), floorNormal = new THREE.Vector3(), floorHit = new THREE.Vector3();
  let route = [], destinationRing, blockedTime = 0;
  // 체험 중 시야 확대·축소 — 두 손가락 벌리기/오므리기(PC 휠). 3인칭은 카메라 거리, 카 안 1인칭은 화각을 바꾼다.
  const ZOOM_MIN = .45, ZOOM_MAX = 2.8, pinchPoints = new Map();
  let zoom = 1, pinchStart = null;
  let carBoxes, floorOffset = 0, lastStatus = '';
  const clamp = THREE.MathUtils.clamp;
  const radius = a => .24 * a.scale;
  const carY = () => carGrp.position.y - S.CAR_H / 2 + floorOffset;
  function register(a) {
    a.id = actors.length; a.home = a.root.position.clone(); a.homeYaw = a.root.rotation.y;
    a.zone = 'ground'; a.floor = 0; a.root.userData.characterId = a.id; actors.push(a);
  }
  function unavailable() {
    return overspeedActive || insMode || ManualRescueDemo.active || ARDDemo.active ||
      UCMDemo.state.active || InterlockDemo.active || BufferDemo.active || AscentDemo.active ||
      BrakeDemo.active || InspectionReturn.busy || DoorBypass.mode !== 'off' || HallManual.busy || Mascot.inspecting;
  }
  function portalOpen(floor) {
    return !moving && !estop && currentState === ELEVATOR_STATE.DOOR_OPEN &&
      !CarDoor.state?.busy && CarDoor.alignedFloor() === floor;
  }
  function doorwayOccupied() {
    if (!active) return false;
    const floor = CarDoor.alignedFloor();
    return actors.some(a => a.floor === floor && a.zone !== 'ground' &&
      Math.abs(a.root.position.x) < S.DOOR_W / 2 + radius(a) &&
      a.root.position.z > CAR_FRONT_Z - radius(a) - .08 &&
      a.root.position.z < layout.lobbyBackZ + radius(a) + .08);
  }
  // Returns support only on the actor's connected level. No gravity or shaft floor raycasts.
  function support(x, z, a) {
    const r = radius(a), L = layout, f = a.zone === 'car' ? CarDoor.alignedFloor() : a.floor;
    const open = f != null && f >= 0 && portalOpen(f);
    const insideCar = Math.abs(x) <= S.CAR_W / 2 - .08 - r && z >= CAR_BACK_Z + .08 + r;
    if (a.zone === 'car' && insideCar && z <= CAR_FRONT_Z - r - .05)
      return { y: carY(), zone: 'car', floor: f >= 0 ? f : a.floor };
    // The only connection between car and landing is the fully-open, aligned doorway.
    if (open && a.zone !== 'ground' && Math.abs(x) <= S.DOOR_W / 2 - r - .035 &&
        z >= CAR_FRONT_Z - r - .06 && z <= L.lobbyBackZ + r + .06)
      return { y: FLOOR_Y[f] + floorOffset, zone: z < (CAR_FRONT_Z + L.lobbyBackZ) / 2 ? 'car' : 'landing', floor: f };
    if (open && a.zone !== 'ground' && insideCar && z < CAR_FRONT_Z - r - .05)
      return { y: carY(), zone: 'car', floor: f };
    if (a.zone === 'car' && !open) return null;
    const floor = f >= 0 ? f : a.floor;
    const first = floor === 0, left = -L.totalWallW / 2 + r + .04;
    const right = (first ? L.rampX1 : L.totalWallW / 2) - r - .04;
    const stairLane = Math.abs(x) <= L.stairW / 2 - r - .06;
    const rampLane = x >= L.rampX0 + r + .025 && x <= L.rampX1 - r - .025;
    if (x >= left && x <= right && z >= L.lobbyBackZ + r + .04 && z <= L.lobbyFrontZ &&
        (z <= L.lobbyFrontZ - r - .04 || first && (stairLane || rampLane)))
      return { y: FLOOR_Y[floor], zone: 'landing', floor };
    if (!first) return null;
    const stairEnd = L.lobbyFrontZ + APPROACH_STEP_COUNT * APPROACH_STEP_TREAD;
    if (stairLane && z >= L.lobbyFrontZ && z <= stairEnd) {
      const step = Math.min(APPROACH_STEP_COUNT - 1, Math.floor((z - L.lobbyFrontZ) / APPROACH_STEP_TREAD));
      return { y: L.slabY - step * L.deltaH / APPROACH_STEP_COUNT, zone: 'stairs', floor: 0 };
    }
    if (rampLane && z >= L.lobbyFrontZ && z <= L.rampEndZ)
      return { y: L.slabY - (z - L.lobbyFrontZ) / (L.rampEndZ - L.lobbyFrontZ) * L.deltaH, zone: 'ramp', floor: 0 };
    // Finite garden, pond, shaft footprint and approach retaining walls.
    if ((x / (21 - r)) ** 2 + ((z - 6) / (17 - r)) ** 2 > 1) return null;
    if (Math.hypot(x - MEADOW_POND.x, z - MEADOW_POND.z) < MEADOW_POND.r + r + .12) return null;
    if (Math.abs(x) < L.totalWallW / 2 + r && z > SHAFT_BACK_Z - S.WALL_T - r && z < L.lobbyBackZ + r) return null;
    if (x > -L.totalWallW / 2 - r && x < L.rampX1 + RAMP_WALL_T + r &&
        z > L.lobbyBackZ - r && z < L.lobbyFrontZ + r) return null;
    if (Math.abs(x) < L.stairW / 2 + STAIR_WING_T + r && z > L.lobbyFrontZ &&
        z < stairEnd + (stairLane ? 0 : r)) return null;
    if (x > L.rampX0 - RAMP_WALL_T - r && x < L.rampX1 + RAMP_WALL_T + r &&
        z > L.lobbyFrontZ && z < L.rampEndZ + (rampLane ? 0 : r)) return null;
    const paved = x >= plaza.x0 && x <= plaza.x1 && z >= plaza.z0 && z <= plaza.z1;
    return { y: paved ? plaza.y : Y0 - .03, zone: 'ground', floor: 0 };
  }
  function tryStep(a, dx, dz) {
    const p = a.root.position, next = support(p.x + dx, p.z + dz, a);
    if (!next || Math.abs(next.y - p.y) > layout.deltaH / APPROACH_STEP_COUNT + .035) return false;
    // Never step sideways through the walls of parallel stairs/ramp.
    if ((a.zone === 'stairs' || a.zone === 'ramp') && next.zone !== a.zone &&
        next.zone !== 'landing' && next.zone !== 'ground') return false;
    p.set(p.x + dx, next.y, p.z + dz); a.zone = next.zone; a.floor = next.floor; return true;
  }
  function move(a, dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .06));
    let changed = false;
    for (let i = 0; i < steps; i++) {
      if (tryStep(a, dx / steps, dz / steps)) changed = true;
      else { if (dx && tryStep(a, dx / steps, 0)) changed = true; if (dz && tryStep(a, 0, dz / steps)) changed = true; }
    }
    return changed;
  }
  function stopRoute() { route = []; blockedTime = 0; if (destinationRing) destinationRing.visible = false; }
  // 이동 경로도 실제 보행과 같은 지지면·단차·문 검사로 검증한다. 순간이동이나 승강로 관통은 없다.
  function clearSegment(from, to) {
    const a = { root: { position: from.point.clone() }, zone: from.zone, floor: from.floor, scale: active.scale };
    const dx = to.point.x - from.point.x, dz = to.point.z - from.point.z;
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .04));
    for (let i = 0; i < count; i++) if (!tryStep(a, dx / count, dz / count)) return false;
    return Math.abs(a.root.position.y - to.point.y) < .1;
  }
  function planRoute(point) {
    const a = active, L = layout;
    const node = (x, z) => {
      const s = support(x, z, a) || (a.zone === 'ground' ? support(x, z, { ...a, zone: 'landing' }) : null);
      return s && { ...s, point: new THREE.Vector3(x, s.y, z) };
    };
    const goal = node(point.x, point.z);
    if (!goal || Math.abs(goal.point.y - point.y) > .18) return [];
    const start = { point: a.root.position.clone(), zone: a.zone, floor: a.floor };
    if (clearSegment(start, goal)) return [goal.point];
    // 계단·경사로·열린 출입구의 중앙과 연못 외곽을 경유점으로 삼는다.
    const points = [[0, L.lobbyFrontZ + APPROACH_STEP_COUNT * APPROACH_STEP_TREAD + .4], [0, L.lobbyFrontZ - .4],
      [(L.rampX0 + L.rampX1) / 2, L.rampEndZ + .4], [(L.rampX0 + L.rampX1) / 2, L.lobbyFrontZ - .4],
      [0, L.lobbyBackZ + radius(a) + .12], [0, CAR_FRONT_Z - radius(a) - .12], [0, (CAR_FRONT_Z + CAR_BACK_Z) / 2]];
    if (a.floor === 0) for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, r = (MEADOW_POND.r + radius(a) + .4) / Math.cos(Math.PI / 8);
      points.push([MEADOW_POND.x + Math.cos(angle) * r, MEADOW_POND.z + Math.sin(angle) * r]);
    }
    const nodes = [start, goal, ...points.map(([x,z]) => node(x,z)).filter(Boolean)];
    const distance = nodes.map(() => Infinity), previous = [], visited = new Set(); distance[0] = 0;
    while (visited.size < nodes.length) {
      let best = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (best < 0 || distance[i] < distance[best])) best = i;
      if (best < 0 || !Number.isFinite(distance[best])) return [];
      if (best === 1) { const path = []; for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i].point); return path; }
      visited.add(best);
      for (let i = 1; i < nodes.length; i++) {
        if (visited.has(i)) continue;
        const cost = distance[best] + nodes[best].point.distanceTo(nodes[i].point);
        if (cost < distance[i] && clearSegment(nodes[best], nodes[i])) { distance[i] = cost; previous[i] = best; }
      }
    }
    return [];
  }
  function tapDestination(x, y) {
    const rect = renderer.domElement.getBoundingClientRect();
    camera.updateMatrixWorld(true);
    walkNdc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    walkRay.setFromCamera(walkNdc, camera);
    // 보행면 수치 계약에 직접 투영한다. 계단 앞면·점자 돌기·캐릭터가 바닥 탭을 가로채지 않는다.
    const a = active, L = layout, ray = walkRay.ray;
    let point = null, distance = Infinity;
    const consider = (y, slope = 0) => {
      floorNormal.set(0,1,slope).normalize();
      floorPlane.set(floorNormal, -y / Math.sqrt(1+slope*slope));
      if (!ray.intersectPlane(floorPlane,floorHit)) return;
      const s = support(floorHit.x,floorHit.z,a) || (a.zone==='ground' ? support(floorHit.x,floorHit.z,{...a,zone:'landing'}) : null);
      if (!s || Math.abs(s.y-floorHit.y)>.045) return;
      const d = ray.origin.distanceTo(floorHit);
      if (d < distance) { distance=d; point=floorHit.clone(); point.y=s.y; }
    };
    if (a.floor===0 && a.zone!=='car') {
      consider(plaza.y); consider(Y0-.03);
      for(let i=0;i<APPROACH_STEP_COUNT;i++) consider(L.slabY-i*L.deltaH/APPROACH_STEP_COUNT);
      // 눈높이보다 높은 계단 앞면을 눌러도 바로 위 디딤판으로 이동한다.
      if(Math.abs(ray.direction.z)>1e-6)for(let i=1;i<=APPROACH_STEP_COUNT;i++) {
        const z=L.lobbyFrontZ+i*APPROACH_STEP_TREAD,t=(z-ray.origin.z)/ray.direction.z;
        if(t<=0)continue;
        ray.at(t,floorHit);
        const high=L.slabY-(i-1)*L.deltaH/APPROACH_STEP_COUNT,low=Math.max(L.groundY,high-L.deltaH/APPROACH_STEP_COUNT);
        if(Math.abs(floorHit.x)>L.stairW/2-radius(a)-.06||floorHit.y<low||floorHit.y>high)continue;
        const s=support(floorHit.x,z-.08,a),d=ray.origin.distanceTo(floorHit);
        if(s&&d<distance){distance=d;point=new THREE.Vector3(floorHit.x,s.y,z-.08);}
      }
      const slope=L.deltaH/(L.rampEndZ-L.lobbyFrontZ);
      consider(L.slabY+slope*L.lobbyFrontZ,slope);
    }
    if (a.zone!=='car' || portalOpen(a.floor)) consider(FLOOR_Y[a.floor]);
    if (a.zone==='car' || portalOpen(a.floor)) consider(carY());
    if (!point) return;
    // 보행면을 골라도 닫힌 문·벽 너머를 직접 찍지는 못한다.
    for(const b of cameraBoxes) {
      if(b===carBoxes[4]&&portalOpen(a.floor))continue;
      if(ray.intersectBox(b,floorHit)&&ray.origin.distanceTo(floorHit)<distance-.08)return;
    }
    const path = planRoute(point); stopRoute();
    if (!path.length) return;
    route = path; const end = route[route.length - 1];
    destinationRing.position.set(end.x, end.y + .025, end.z); destinationRing.visible = true;
  }
  function clearInput() { keys.clear(); lookPointer = null; pinchPoints.clear(); pinchStart = null; stopRoute(); }
  function resetActor(a) {
    a.root.position.copy(a.home); a.root.rotation.y = a.homeYaw; a.zone = 'ground'; a.floor = 0;
    a.visual.position.y = 0; a.resetPose(); viewY = a.root.position.y;
  }
  function start() {
    if (active) return true;
    if (unavailable() || !controls.enabled) {
      toggle.textContent = '시연·점검 종료 후 체험';
      return false;
    }
    if (!actors.length) {
      const walker = Mascot.createWalker();
      walker.root.position.set(0, plaza.y, layout.lobbyFrontZ + APPROACH_STEP_COUNT * APPROACH_STEP_TREAD + 1);
      walker.root.rotation.y = Math.PI;
      register({...walker, label:'승곰이', scale:1});
    }
    const a = actors[0]; resetActor(a);
    if (!active) {
      saved = { position: camera.position.clone(), target: controls.target.clone(), near: camera.near, fov: camera.fov,
        rotate: controls.enableRotate, pan: controls.enablePan, zoom: controls.enableZoom, damping: controls.enableDamping,
        mascotVisible: Mascot.root.visible };
      leaveCabinView(); gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target); PartGlow.closeMenu();
      controls.enableDamping = false; controls.update();
      controls.enableRotate = controls.enablePan = controls.enableZoom = false;
    }
    active = a; a.root.visible=true; a.visual.visible=true; Mascot.root.visible=false;
    clearInput(); yaw = 0; pitch = .30; zoom = 1; lastTime = 0; lastStatus='';
    panel.hidden = false; ring.visible = true;
    document.body.classList.add('character-walking'); toggle.hidden=true;
    updateCamera(1); refreshStatus(); return true;
  }
  function exit(restoreCamera = true) {
    if (!active) return;
    resetActor(active); active.visual.visible=true; active.root.visible=false;
    Mascot.root.visible=saved.mascotVisible;
    active = null; clearInput(); ring.visible = false; panel.hidden = true;
    document.body.classList.remove('character-walking'); toggle.hidden=false; toggle.textContent = '캐릭터 체험';
    controls.enableRotate = saved.rotate; controls.enablePan = saved.pan; controls.enableZoom = saved.zoom;
    controls.enableDamping = saved.damping;
    camera.fov = saved.fov; camera.updateProjectionMatrix();
    if (restoreCamera) { camera.position.copy(saved.position); controls.target.copy(saved.target); camera.near = saved.near; camera.updateProjectionMatrix(); controls.update(); }
  }
  function refreshStatus() {
    if (!active) return;
    const place = active.zone === 'car' ? (moving ? '엘리베이터 이동 중' : `${curFloor + 1}층 · 엘리베이터 안`) :
      active.zone === 'landing' ? `${active.floor + 1}층 승강장` : active.zone === 'stairs' ? '계단' : active.zone === 'ramp' ? '경사로' : '정원';
    const value = active.label + ' · ' + place;
    if (lastStatus !== value) { status.textContent = value; lastStatus = value; }
    document.getElementById('walk-call').hidden = active.zone !== 'landing';
    document.getElementById('walk-floors').hidden = active.zone !== 'car';
    document.querySelectorAll('#walk-floors button').forEach((b, i) => b.classList.toggle('called', PassengerControls.pending.includes(i)));
  }
  function box(x0, y0, z0, x1, y1, z1) {
    const b = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)); cameraBoxes.push(b); return b;
  }
  function buildCameraBounds() {
    const L = layout, half = L.totalWallW / 2, gap = S.DOOR_W / 2;
    FLOOR_Y.forEach(y => {
      box(-half, y, FRONT_WALL_INNER_Z, -gap, y + S.DOOR_H, L.lobbyBackZ);
      box(gap, y, FRONT_WALL_INNER_Z, half, y + S.DOOR_H, L.lobbyBackZ);
      box(-half, y + S.DOOR_H, FRONT_WALL_INNER_Z, half, y + 3, L.lobbyBackZ);
      box(-half, y - .12, L.lobbyBackZ, half, y, L.lobbyFrontZ);
    });
    carBoxes = Array.from({ length: 5 }, () => box(0, 0, 0, 0, 0, 0));
  }
  function updateCamera(dt) {
    if (!active) return;
    const a = active, p = a.root.position, inCar = a.zone === 'car';
    const h = .50 * a.scale, distance = 2.6 * zoom;
    const fov = inCar ? clamp(saved.fov * zoom, 30, 80) : saved.fov;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    viewY += (p.y-viewY)*(1-Math.exp(-dt*16));
    // 좁은 카에서는 머리가 화면을 가리지 않도록 자연스럽게 탑승자 시점으로 전환한다.
    if (inCar) {
      camera.position.set(p.x, p.y + Math.max(1.05, 1.1 * a.scale), p.z);
      direction.set(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      controls.target.copy(camera.position).add(direction); camera.lookAt(controls.target);
      if (camera.near !== .025) { camera.near = .025; camera.updateProjectionMatrix(); }
      a.visual.visible = false; ring.visible = false; return;
    }
    ring.visible = true;
    target.set(p.x, viewY + h, p.z);
    desired.set(p.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      viewY + h + Math.sin(pitch) * distance, p.z + Math.cos(yaw) * Math.cos(pitch) * distance);
    const cy = carY(), w = S.CAR_W / 2 - .05;
    const specs = [[-w,cy,CAR_BACK_Z,w,cy+S.CAR_H,CAR_BACK_Z+.08],
      [-w-.05,cy,CAR_BACK_Z,-w,cy+S.CAR_H,CAR_FRONT_Z],
      [w,cy,CAR_BACK_Z,w+.05,cy+S.CAR_H,CAR_FRONT_Z],
      [-w,cy+S.CAR_H-.08,CAR_BACK_Z,w,cy+S.CAR_H,CAR_FRONT_Z],
      [-S.DOOR_W/2,cy,CAR_FRONT_Z,S.DOOR_W/2,cy+S.DOOR_H,layout.lobbyBackZ]];
    specs.forEach((s,i) => { carBoxes[i].min.set(s[0],s[1],s[2]); carBoxes[i].max.set(s[3],s[4],s[5]); });
    direction.subVectors(desired, target).normalize(); cameraRay.set(target, direction);
    let limit = distance;
    for (const b of cameraBoxes) {
      if (b === carBoxes[4] && portalOpen(a.floor)) continue;
      if (cameraRay.intersectBox(b, hit)) limit = Math.min(limit, Math.max(.12, hit.distanceTo(target) - .10));
    }
    desired.copy(target).addScaledVector(direction, limit);
    camera.position.copy(desired); controls.target.copy(target); camera.lookAt(target);
    if (camera.near !== .025) { camera.near = .025; camera.updateProjectionMatrix(); }
    a.visual.visible = limit > .48;
    ring.position.set(p.x, p.y + .012, p.z); ring.scale.setScalar(a.scale);
  }
  function update(now) {
    if (!active) return;
    if (unavailable() || !controls.enabled) { exit(false); return; }
    Mascot.root.visible=false;
    if (active.zone === 'car') {
      active.root.position.y = carY(); const f = CarDoor.alignedFloor(); if (f >= 0) active.floor = f;
    }
    const dt = lastTime ? Math.min(.05, Math.max(0, now - lastTime)) : 0; lastTime = now;
    let x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const len = Math.hypot(x, z); if (len > 1) { x /= len; z /= len; }
    let dx = Math.cos(yaw) * x + Math.sin(yaw) * z, dz = -Math.sin(yaw) * x + Math.cos(yaw) * z;
    let step = .85 * dt;
    if (route.length) {
      const p = active.root.position, next = route[0], distance = Math.hypot(next.x-p.x, next.z-p.z);
      if (distance < .025) { route.shift(); if (!route.length) stopRoute(); }
      else { dx = (next.x-p.x)/distance; dz = (next.z-p.z)/distance; step = Math.min(step,distance); }
    }
    const oldX=active.root.position.x,oldY=active.root.position.y,oldZ=active.root.position.z;
    const walking = (dx || dz) && move(active, dx * step, dz * step);
    if (route.length) { blockedTime = walking ? 0 : blockedTime + dt; if (blockedTime > .25) stopRoute(); }
    const travel=Math.hypot(active.root.position.x-oldX,active.root.position.z-oldZ);
    if (walking) {
      const angle=Math.atan2(dx,dz)-active.root.rotation.y;
      active.root.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*(1-Math.exp(-dt*14));
    }
    active.visual.position.y=(active.visual.position.y+oldY-active.root.position.y)*Math.exp(-dt*18);
    active.animate(travel,dt,now);
    if (doorwayOccupied() && currentState === ELEVATOR_STATE.DOOR_CLOSING) openDoors();
    updateCamera(dt); refreshStatus();
  }
  function init() {
    layout = lobbyApproachLayout();
    plaza.y = new THREE.Box3().setFromObject(scene.getObjectByName('plazaPaver')).max.y;
    floorOffset = (carGrp.getObjectByName('carPanelAssembly')?.userData.floorY ?? -S.CAR_H / 2) + S.CAR_H / 2;
    buildCameraBounds();
    const style = document.createElement('style'); style.textContent = `
      #walk-toggle,#walk-panel{position:fixed;z-index:108;font:600 13px/1.5 var(--ui-font,sans-serif);color:#f8faf5}
      #walk-toggle{left:16px;bottom:112px;background:#234738ee;border:1px solid #b5e5b377;border-radius:22px;padding:10px 16px;cursor:pointer}
      #walk-panel button{min-height:42px;border:1px solid #ffffff35;border-radius:12px;background:#ffffff12;color:inherit;font:inherit;padding:6px 10px;cursor:pointer}
      #walk-panel button:hover{background:#ffffff28}
      #walk-panel{left:16px;top:100px;max-width:calc(100vw - 32px);padding:12px;background:#172b25eb;border-radius:16px;border:1px solid #b5e5b355}
      #walk-status{margin-bottom:6px;color:#dfffbc} #walk-help{font-size:11px;font-weight:400;color:#d4e9dc;margin:4px 0 10px}
      .walk-touch-help{display:none}
      #walk-floors{display:flex;gap:5px;margin-top:8px} #walk-floors .called{background:#637d2f;border-color:#dbff9b}
      #walk-toggle[hidden],#walk-panel[hidden],#walk-floors[hidden],#walk-call[hidden]{display:none}
      @media(pointer:coarse),(max-width:700px){#walk-panel{top:86px;font-size:12px;padding:10px;width:240px;max-width:calc(100vw - 126px);box-sizing:border-box} .walk-desktop-help{display:none}.walk-touch-help{display:inline} #walk-help{max-width:230px} #walk-floors button{flex:1;min-width:0;padding:6px 4px} }
      @media(max-height:520px){#walk-panel{top:65px;left:auto;right:10px}}
    `; document.head.appendChild(style);
    const host = document.createElement('div'); host.innerHTML = `
      <button id="walk-toggle">캐릭터 체험</button>
      <section id="walk-panel" aria-label="캐릭터 체험" hidden><div id="walk-status"></div>
        <div id="walk-help"><span class="walk-desktop-help">바닥 클릭으로 이동 · 드래그로 시야 회전 · 휠로 확대·축소</span><span class="walk-touch-help">바닥을 찍어 이동 · 밀어서 시야 회전<br>두 손가락으로 확대·축소</span></div>
        <button id="walk-home">시작 위치</button> <button id="walk-exit">체험 종료</button>
        <button id="walk-call" hidden>승강기 호출</button><div id="walk-floors" hidden></div></section>`;
    document.body.appendChild(host); toggle = document.getElementById('walk-toggle');
    panel = document.getElementById('walk-panel'); status = document.getElementById('walk-status');
    toggle.onclick = start;
    document.getElementById('walk-exit').onclick = () => exit();
    document.getElementById('walk-home').onclick = () => { if(active) {resetActor(active); clearInput(); yaw=0; pitch=.3; zoom=1;} };
    document.getElementById('walk-call').onclick = () => { if(active?.zone==='landing') PassengerControls.request(active.floor,active.floor===FLOORS-1?'down':'up'); };
    for (let f=0;f<FLOORS;f++) { const b=document.createElement('button'); b.textContent=(f+1)+'층'; b.onclick=()=>PassengerControls.request(f); document.getElementById('walk-floors').appendChild(b); }
    ring = new THREE.Mesh(new THREE.RingGeometry(.24,.26,32),new THREE.MeshBasicMaterial({color:0xe4ff9f,side:THREE.DoubleSide,depthWrite:false}));
    ring.name='characterSelectionRing'; ring.rotation.x=-Math.PI/2; ring.visible=false; scene.add(ring);
    destinationRing = new THREE.Mesh(new THREE.RingGeometry(.13,.17,24),new THREE.MeshBasicMaterial({color:0x59d9ff,side:THREE.DoubleSide,depthWrite:false}));
    destinationRing.name='characterDestination'; destinationRing.rotation.x=-Math.PI/2; destinationRing.visible=false; scene.add(destinationRing);
    window.addEventListener('keydown', e => {
      if (!active || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.code==='Escape') { exit(); return; }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) { e.preventDefault(); stopRoute(); keys.add(e.code); }
    });
    window.addEventListener('keyup',e=>keys.delete(e.code)); window.addEventListener('blur',clearInput);
    document.addEventListener('visibilitychange',clearInput);
    const canvas=renderer.domElement;
    const pinchDistance=()=>{const [a,b]=[...pinchPoints.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
    canvas.addEventListener('pointerdown',e=>{
      if(active&&e.pointerType==='touch'){
        pinchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
        // 두 번째 손가락부터는 핀치만 처리하고 이동 지점 탭으로 판정하지 않는다.
        if(pinchPoints.size===2){e.stopImmediatePropagation();canvas.setPointerCapture(e.pointerId);lookPointer=null;pinchStart={d:Math.max(1,pinchDistance()),zoom};return;}
      }
      if(active){e.stopImmediatePropagation();if(lookPointer || pinchStart || e.button!==0)return;canvas.setPointerCapture(e.pointerId);}
      if(e.button===0)lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,t:e.timeStamp,drag:false};
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(pinchPoints.has(e.pointerId)){pinchPoints.get(e.pointerId).x=e.clientX;pinchPoints.get(e.pointerId).y=e.clientY;}
      if(active&&pinchStart&&pinchPoints.size===2){e.stopImmediatePropagation();zoom=clamp(pinchStart.zoom*pinchStart.d/Math.max(1,pinchDistance()),ZOOM_MIN,ZOOM_MAX);return;}
      if(!lookPointer||lookPointer.id!==e.pointerId)return;const p=lookPointer;
      const moved=Math.hypot(e.clientX-p.ox,e.clientY-p.oy),wasDragging=p.drag;
      if(moved>(e.pointerType==='touch'?14:6))p.drag=true;
      if(active){e.stopImmediatePropagation();if(p.drag){yaw-=(e.clientX-(wasDragging?p.x:p.ox))*.006;pitch=clamp(pitch+(e.clientY-(wasDragging?p.y:p.oy))*.004,-.2,1.0);}}
      p.x=e.clientX;p.y=e.clientY;
    },true);
    const endPinch=e=>{if(!pinchPoints.delete(e.pointerId))return false;if(pinchPoints.size<2&&pinchStart){pinchStart=null;if(active)e.stopImmediatePropagation();return true;}return false;};
    canvas.addEventListener('wheel',e=>{if(!active)return;e.preventDefault();e.stopImmediatePropagation();zoom=clamp(zoom*Math.exp(e.deltaY*.0012),ZOOM_MIN,ZOOM_MAX);},{capture:true,passive:false});
    canvas.addEventListener('pointerup',e=>{
      if(endPinch(e))return;
      const p=lookPointer;if(!p||p.id!==e.pointerId)return;lookPointer=null;
      const wasActive=!!active;
      if(active&&!p.drag&&e.timeStamp-p.t<(e.pointerType==='touch'?850:500)){
        const part=active.zone==='car'?PartGlow.pickAt(e.clientX,e.clientY):null;
        if(part?.entries.some(entry=>entry.button?.id.startsWith('ec-action-')))PartGlow.activate(part);
        else tapDestination(e.clientX,e.clientY);
      }
      if(wasActive)e.stopImmediatePropagation();
    },true);
    canvas.addEventListener('pointercancel',e=>{endPinch(e);lookPointer=null;});
  }
  return { setPlaza(value){plaza=value;}, init, update, start, exit, doorwayOccupied, get zoom(){return zoom;},
    setRoofVisible(on){if(active)saved.mascotVisible=!!on;}, get roofVisible(){return !!saved?.mascotVisible;},
    get active(){return active;}, get actors(){return actors;} };
})();
