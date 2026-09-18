/* Field-reference GLB integration. Blender extras are the dimension source.
   Coordinates: closed assembly X / track-centre Y / hanger-plate Z.
   Geometry is loaded once and shared across floors; only transforms animate. */
const HallInterlock = (() => {
  let asset;
  const up = new THREE.Vector3(0, 1, 0);
  function load() {
    if (!asset) asset = new Promise((resolve, reject) =>
      new THREE.GLTFLoader().load('models/gltf/hall_interlock.glb', resolve, undefined, reject));
    return asset;
  }
  function mount(parent, name, x, g) {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(x, g.caseCY, g.plateZ);
    parent.add(o);
    return o;
  }
  function attach(h, header, g) {
    const fixed = mount(header.ilMount, 'FieldInterlockFixed', 0, g);
    const moving = mount(h.right, 'FieldInterlockMoving', -h.right.userData.cx, g);
    const opposite = mount(h.left, 'FieldInterlockOpposite', -h.left.userData.cx, g);
    const pivot = new THREE.Group();
    pivot.name = 'HookPivotGrp';
    moving.add(pivot);
    h.hook = h.right.userData.hookPivot = pivot;
    const state = h.interlock = { ready: false, fixed, moving, opposite };
    state.promise = load().then(gltf => {
      const root = gltf.scene.clone(true);
      const data = root.getObjectByName('InterlockRoot').userData;
      if (data.contractVersion !== 2) throw new Error('Interlock GLB contract version mismatch');
      const take = (name, parent) => {
        const node = root.getObjectByName(name);
        if (!node) throw new Error(`Interlock node missing: ${name}`);
        parent.add(node);
        return node;
      };
      take('SwitchAssembly', fixed);
      const base = take('InterlockBase', moving);
      take('Keeper', opposite);
      const hook = root.getObjectByName('Hook');
      pivot.position.copy(hook.position);
      // Keep the wrapper referenced by existing GSAP/UI code stable.
      while (hook.children.length) pivot.add(hook.children[0]);
      Object.assign(h.latch, data.latch, {
        rimY: g.caseCY + data.latch.rimY,
        lipBotY: g.caseCY + data.latch.lipBotY,
        z: g.plateZ + data.latch.z,
        keeperParent: 'oppositeDoor'
      });
      state.spring = base.getObjectByName('Spring');
      state.springSeat = pivot.getObjectByName('SpringSeat');
      state.springWasher = base.getObjectByName('SpringBottomWasher') || pivot.getObjectByName('SpringBottomWasher');
      state.springTop = new THREE.Vector3(...data.spring.top);
      state.springRest = data.spring.restLength;
      state.linkPin = pivot.getObjectByName('LinkPin');
      state.stock = take('LinkStock', moving);
      state.foot = take('LinkFoot', moving);
      const tri = h.right.userData.triKey;
      const localBarX = data.link.x - h.right.userData.cx;
      const shift = localBarX - tri.barX;
      tri.group.position.x += shift;
      tri.triX += shift;
      tri.barX = localBarX;
      state.a = new THREE.Vector3();
      state.b = new THREE.Vector3();
      state.d = new THREE.Vector3();
      state.bottom = new THREE.Vector3();
      state.q = new THREE.Quaternion();
      // Cam stays on the cylinder; the drive pin reaches the GLB link plane.
      h.right.updateWorldMatrix(true, true);
      moving.updateWorldMatrix(true, true);
      tri.camPivot.updateWorldMatrix(true);
      state.linkPin.getWorldPosition(state.a);
      const dz = state.a.z - tri.camPivot.getWorldPosition(state.b).z;
      tri.drivePin.position.set(tri.camLen, 0, dz);
      if (tri.pinMesh) {
        const pinLen = Math.abs(dz) + 0.006;
        tri.pinMesh.position.set(tri.camLen, 0, dz * 0.5);
        tri.pinMesh.scale.y = pinLen / tri.pinRest;
        const capDir = dz === 0 ? -1 : Math.sign(dz);
        tri.pinCap.position.set(tri.camLen, 0, dz + capDir * 0.002);
      }
      tri.drivePin.updateWorldMatrix(true);
      state.linkPin.getWorldPosition(state.a);
      tri.drivePin.getWorldPosition(state.b);
      moving.worldToLocal(state.a);
      moving.worldToLocal(state.b);
      state.rodLength = Math.hypot(state.a.x - state.b.x, state.a.y - state.b.y);
      for (const assembly of [fixed, moving, opposite]) assembly.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some(m => m.transparent)) {
          o.castShadow = false;
          mats.forEach(m => { if (m.transparent) m.depthWrite = false; });
        }
      });
      state.ready = true;
      if (Math.abs(h.right.position.x - h.right.userData.cx) > 0.001) pivot.rotation.z = -h.latch.liftRad;
      update(h);
    }).catch(error => {
      console.error('[hall_interlock.glb] Field model load failed:', error);
      throw error;
    });
  }
  function update(h) {
    const s = h.interlock;
    if (!s?.ready) return;
    s.moving.updateWorldMatrix(true, true);
    const a = s.a, b = s.b, d = s.d;
    s.springSeat.getWorldPosition(a);
    s.moving.worldToLocal(a);
    // The stud guides the spring vertically; the wide/slotted lever seat slides
    // beneath its washer, rather than dragging the spring off the stud sideways.
    a.x = s.springTop.x; a.z = s.springTop.z;
    s.springWasher.position.y = a.y;
    d.copy(s.springTop).sub(a);
    const len = d.length();
    s.spring.position.copy(a);
    s.spring.quaternion.setFromUnitVectors(up, d.normalize());
    s.spring.scale.y = len / s.springRest;
    s.linkPin.getWorldPosition(a);
    s.moving.worldToLocal(a);
    const tri = h.right.userData.triKey;
    tri.drivePin.getWorldPosition(b);
    s.moving.worldToLocal(b);
    // Rigid bar: slot origin sits on the cam pin; stock keeps a fixed length.
    const dx = a.x - b.x;
    const bottom = s.bottom.set(b.x, a.y - Math.sqrt(Math.max(0, s.rodLength ** 2 - dx ** 2)), a.z);
    d.copy(a).sub(bottom).normalize();
    s.q.setFromUnitVectors(up, d);
    s.foot.position.copy(bottom);
    s.foot.quaternion.copy(s.q);
    const stockLen = Math.max(0.01, s.rodLength - 0.020);
    s.stock.position.copy(bottom).addScaledVector(d, 0.020 + stockLen / 2);
    s.stock.quaternion.copy(s.q);
    s.stock.scale.y = stockLen;
  }
  return { attach, update, updateAll: hs => hs.forEach(update) };
})();
