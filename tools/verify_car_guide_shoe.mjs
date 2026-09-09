import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.shot-guide-shoe');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const errors = [];
const warnings = [];
try {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('requestfailed', req => errors.push(`${req.url()}: ${req.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => carGrp?.userData.guideShoes?.length === 4 && carGrp.userData.safetyGear?.shaft);
  const inspect = () => {
    scene.updateMatrixWorld(true);
    const shoes = carGrp.userData.guideShoes;
    const reports = shoes.map(mount => {
      const model = mount.children[0];
      const data = model.getObjectByName('GuideShoeRoot').userData;
      const meshes = [];
      model.traverseVisible(o => { if (o.isMesh) meshes.push(o); });
      // Shoot along the rail head inside the full assembly height. No shoe
      // triangle may cross this volume (the felt touches only the tip face).
      let intersections = 0;
      const hitNames = new Set();
      const ray = new THREE.Raycaster();
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
        const x = 0.035 + (data.railTip - 0.035 - 0.00005) * i / 8;
        const z = (-1 + j / 4) * (data.railHalfWidth - 0.00005);
        const origin = model.localToWorld(new THREE.Vector3(x, -0.03, z));
        const direction = new THREE.Vector3(0, 1, 0).transformDirection(model.matrixWorld);
        ray.set(origin, direction); ray.far = 0.30;
        const hits = ray.intersectObjects(meshes, false);
        intersections += hits.length;
        hits.forEach(hit => hitNames.add(hit.object.name));
      }
      return { name: mount.name, parent: mount.parent.name, scale: model.scale.toArray(),
        position: mount.position.toArray(), world: mount.getWorldPosition(new THREE.Vector3()).toArray(),
        oiler: model.getObjectByName('Oiler').visible, intersections,
        clearance: data.channelHalfWidth - data.railHalfWidth,
        height: data.guideHeight, meshes: meshes.length, hitNames: [...hitNames],
        materials: meshes.flatMap(m => (Array.isArray(m.material) ? m.material : [m.material]).map(mat => mat.name)) };
    });
    let hiddenLegacy = 0;
    carGrp.traverse(o => { if (o.userData.legacyGuideShoe && !o.visible) hiddenLegacy++; });
    const sg = carGrp.userData.safetyGear;
    return { reports, hiddenLegacy, safety: [!!sg.shaft, !!sg.liftL, !!sg.liftR, !!sg.clamp, sg.wedges.length, sg.springs.length], carY: carGrp.position.y };
  };
  const initial = await page.evaluate(inspect);
  console.log(JSON.stringify(initial));
  assert.equal(initial.reports.length, 4);
  assert.equal(initial.hiddenLegacy, 4);
  assert.deepEqual(initial.safety, [true, true, true, true, 4, 4]);
  for (const shoe of initial.reports) {
    assert.equal(shoe.parent, 'carFrameGrp');
    assert.deepEqual(shoe.scale, [1, 1, 1]);
    assert.equal(shoe.oiler, shoe.name.endsWith('Upper'));
    assert.equal(shoe.intersections, 0, `${shoe.name}: rail penetration`);
    assert.ok(Math.abs(shoe.clearance - 0.0005) < 1e-8);
    assert.equal(shoe.height, 0.12);
    assert.ok(shoe.materials.every(name => name.startsWith('Shoe_')), 'Missing GLB material');
  }
  const focus = async (name, lower = false) => {
    await page.evaluate(({ name, lower }) => {
      const mount = scene.getObjectByName(name);
      const model = mount.children[0];
      const data = model.getObjectByName('GuideShoeRoot').userData;
      const target = model.localToWorld(new THREE.Vector3(0.08, data.guideBottom + data.guideHeight / 2, 0));
      controls.minDistance = 0.02;
      camera.position.copy(target).add(new THREE.Vector3(name.includes('_L_') ? 0.36 : -0.36, lower ? -0.19 : 0.23, 0.36));
      controls.target.copy(target); controls.update();
    }, { name, lower });
    await page.waitForTimeout(250);
  };
  await focus('CarGuideShoe_L_Upper');
  await page.screenshot({ path: path.join(out, 'upper-left.png') });
  await focus('CarGuideShoe_R_Lower', true);
  await page.screenshot({ path: path.join(out, 'lower-right.png') });
  await page.evaluate(() => {
    moveElevator(1);
    // Seek the real movement tween so headless GPU frame rate cannot stall tests.
    const tween = gsap.getTweensOf(carGrp.position)[0];
    if (!tween) throw new Error('Movement tween was not created');
    window.guideShoeTestTween = tween.pause().progress(0.5);
  });
  const during = await page.evaluate(inspect);
  assert.ok(during.carY > initial.carY + 0.1);
  await page.evaluate(() => window.guideShoeTestTween.progress(1));
  assert.equal(await page.evaluate(() => curFloor === 1 && !moving), true);
  const arrived = await page.evaluate(inspect);
  for (const state of [during, arrived]) state.reports.forEach((shoe, i) => {
    assert.deepEqual(shoe.position, initial.reports[i].position);
    assert.equal(shoe.intersections, 0);
    assert.ok(Math.abs(shoe.world[1] - initial.reports[i].world[1] - (state.carY - initial.carY)) < 1e-7);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await focus('CarGuideShoe_L_Upper');
  await page.screenshot({ path: path.join(out, 'mobile-upper.png') });
  const pixels = await page.evaluate(() => {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const bytes = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    const colors = new Set();
    for (let i = 0; i < bytes.length; i += 64) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
    return colors.size;
  });
  assert.ok(pixels > 100, `Canvas blank: ${pixels} colors`);
  assert.deepEqual(errors, []);
  // Existing background dodecahedron conversion and screenshot readback warnings
  // do not indicate a shoe failure. Preserve them; reject every other warning.
  const unexpectedWarnings = warnings.filter(message =>
    message !== 'THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.' &&
    !/^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/.test(message));
  assert.deepEqual(unexpectedWarnings, []);
  console.log(JSON.stringify({ initial, movingY: during.carY, arrivedY: arrived.carY, canvasColors: pixels, errors, warnings }, null, 2));
  console.log(`PASS: four shoes, rail clearance, safety handles, travel, desktop/mobile. Screenshots: ${out}`);
} catch (error) {
  console.error('Guide-shoe browser diagnostics:', { errors, warnings });
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
