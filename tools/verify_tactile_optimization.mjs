// Preserve every block's placement, triangle, UV, normal and face material.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), out = path.join(root, 'temporary/optimization/approach');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--enable-gpu'] });
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.routeWebSocket('**', ws => ws.close());
  await page.route('**/index.html', route => {
    const html = fs.readFileSync('index.html', 'utf8');
    const probe = `
      window.tactileSources = [];
      const blockOriginal = addTactileBlock, stripOriginal = addTactileStrip;
      addTactileBlock = function(parent, x, y, z, size = .3) {
        const mesh = blockOriginal(parent, x, y, z, size);
        tactileSources.push({ parent, meshes: [mesh], positions: [[x,y,z]], size });
        return mesh;
      };
      addTactileStrip = function(parent, cx, y, z, count = 4, size = .3) {
        const children = new Set(parent.children);
        stripOriginal(parent, cx, y, z, count, size);
        tactileSources.push({ parent, meshes: parent.children.filter(m => !children.has(m)),
          positions: Array.from({length: count}, (_, k) => [cx - (count-1)*size/2 + k*size, y, z]), size });
      };
      init();`;
    assert.ok(html.includes('    init();'));
    return route.fulfill({ contentType: 'text/html', body: html.replace('    init();', probe) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => govHandles()?.ready && hatchDoors.every(h => h.interlock?.ready) && getComputedStyle(document.getElementById('loading')).opacity === '0');
  report.geometry = await page.evaluate(() => {
    let blocks = 0, triangles = 0, maxPositionError = 0, maxNormalError = 0, maxUVError = 0;
    const geometries = new Set(), p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const source of tactileSources) {
      const expected = new THREE.BoxGeometry(source.size, .006, source.size), materials = getTactileFaceMats();
      let blockIndex = 0;
      for (const mesh of source.meshes) {
        geometries.add(mesh.geometry);
        if (mesh.castShadow || mesh.receiveShadow) throw new Error('Tactile shadow flags changed');
        mesh.updateMatrix();
        const actual = mesh.geometry;
        if (actual.index.count !== expected.index.count) throw new Error('Triangle count changed');
        const remaining = new Set(Array.from({ length: expected.index.count / 3 }, (_, i) => i));
        for (const group of actual.groups) for (let i = group.start; i < group.start + group.count; i += 3) {
          const original = [...remaining].find(t => [0,1,2].every(k => expected.index.getX(t*3+k) === actual.index.getX(i+k)));
          if (original === undefined) throw new Error('Triangle missing, repeated or winding changed');
          remaining.delete(original);
          const face = expected.groups.find(g => original*3 >= g.start && original*3 < g.start + g.count);
          if (mesh.material[group.materialIndex] !== materials[face.materialIndex]) throw new Error('Face material changed');
          for (let k = 0; k < 3; k++) {
            const index = actual.index.getX(i+k);
            p.fromBufferAttribute(actual.attributes.normal, index); q.fromBufferAttribute(expected.attributes.normal, index);
            maxNormalError = Math.max(maxNormalError, p.distanceTo(q));
            for (const axis of ['X', 'Y']) maxUVError = Math.max(maxUVError, Math.abs(actual.attributes.uv['get'+axis](index) - expected.attributes.uv['get'+axis](index)));
          }
        }
        if (remaining.size) throw new Error('Missing faces');
        for (let instance = 0; instance < (mesh.isInstancedMesh ? mesh.count : 1); instance++) {
          const matrix = new THREE.Matrix4();
          if (mesh.isInstancedMesh) mesh.getMatrixAt(instance, matrix);
          matrix.premultiply(mesh.matrix);
          const position = new THREE.Vector3(...source.positions[blockIndex++]);
          for (let i = 0; i < expected.attributes.position.count; i++) {
            p.fromBufferAttribute(actual.attributes.position, i).applyMatrix4(matrix);
            q.fromBufferAttribute(expected.attributes.position, i).add(position);
            maxPositionError = Math.max(maxPositionError, p.distanceTo(q));
          }
          blocks++; triangles += actual.index.count / 3;
        }
      }
      if (blockIndex !== source.positions.length) throw new Error('Block count changed');
      expected.dispose();
    }
    return { blocks, triangles, geometries: geometries.size, maxPositionError, maxNormalError, maxUVError };
  });
  assert.equal(report.geometry.blocks, 28);
  assert.equal(report.geometry.geometries, 1);
  assert.ok(report.geometry.maxPositionError < 1e-6);
  assert.equal(report.geometry.maxNormalError, 0);
  assert.equal(report.geometry.maxUVError, 0);
  // Compare the exact original block construction with the optimized meshes in the same scene.
  await page.evaluate(() => {
    window.tactileReferences = tactileSources.map(s => s.positions.map(([x,y,z]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.size,.006,s.size), getTactileFaceMats());
      mesh.position.set(x,y,z); mesh.visible = false; s.parent.add(mesh); return mesh;
    }));
    controls.enableDamping = false;
    window.setTactileReference = show => {
      tactileSources.forEach(s => s.meshes.forEach(m => {m.visible = !show;}));
      tactileReferences.flat().forEach(m => {m.visible = show;});
    };
    window.tactileSnapshot = () => {
      renderer.render(scene,camera);
      return renderer.domElement.toDataURL('image/png').split(',')[1];
    };
  });
  for (const view of ['approach', 'top', 'underside']) {
    await page.evaluate(view => {
      const L = lobbyApproachLayout();
      if (view === 'underside') {
        // The slab normally occludes the lower faces; isolate blocks for this check.
        const blocks = new Set([...tactileSources.flatMap(s => s.meshes), ...tactileReferences.flat()]);
        scene.traverse(o => { if (o.isMesh && !blocks.has(o)) o.visible = false; });
      }
      const target = view === 'approach' ? new THREE.Vector3(1, L.slabY, L.lobbyFrontZ + 1) : new THREE.Vector3(0,L.slabY+.002,L.lobbyFrontZ-.2);
      controls.target.copy(target);
      camera.position.copy(target).add(view === 'approach' ? new THREE.Vector3(8,6,10) : new THREE.Vector3(.7,view === 'top' ? .8 : -.15,.7));
      controls.update();
    }, view);
    const pair = await page.evaluate(() => [true, false].map(reference => {
      setTactileReference(reference); return tactileSnapshot();
    }));
    pair.forEach((png, i) => fs.writeFileSync(path.join(out, `${view}-${i === 0 ? 'source' : 'optimized'}.png`), Buffer.from(png, 'base64')));
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} finally {
  fs.writeFileSync(path.join(out, 'tactile-verification.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(r => server.close(r));
}
