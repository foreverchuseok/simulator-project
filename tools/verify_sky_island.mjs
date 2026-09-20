/* 천공섬 배경 검증 — 섬이 지상 footprint(보도블록 광장 ∪ 승강로)를 모두 받치는지,
   상면이 기존 지면 레벨(Y0-0.03)을 지키는지, 섬 아래·주변 구름이 두 배경 모드에서 모두 보이는지.
   사용: node tools/verify_sky_island.mjs [라벨] */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const label = process.argv[2] || 'current';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use an alphanumeric report label');
const root = process.cwd(), out = path.join(root, '.shot-sky-island');
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const errors = [];
let browser;
try {
  browser = await chromium.launch({ args: ['--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => govHandles()?.ready && document.getElementById('loading').classList.contains('hide'));

  const report = await page.evaluate(() => {
    const island = scene.getObjectByName('skyIslandBody');
    const box = new THREE.Box3().setFromObject(island);
    // 보도블록 상면에서 아래로 쏘아 섬이 실제로 받치는지 확인한다.
    const paver = scene.getObjectByName('outdoorGround').children
      .find(o => o.isMesh && o.geometry.parameters?.width === 13);
    const pBox = new THREE.Box3().setFromObject(paver);
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const probes = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const x = pBox.min.x + (pBox.max.x - pBox.min.x) * i / 8;
      const z = pBox.min.z + (pBox.max.z - pBox.min.z) * j / 8;
      ray.set(new THREE.Vector3(x, Y0 + 2, z), down);
      probes.push({ x, z, hit: ray.intersectObject(island, false).length > 0 });
    }
    // 승강로 외벽 네 모서리도 섬 위에 있어야 한다.
    const wall = S.SHAFT_W / 2 + S.WALL_T;
    const shaft = [[-wall, SHAFT_BACK_Z - S.WALL_T], [wall, SHAFT_BACK_Z - S.WALL_T],
                   [-wall, FRONT_WALL_INNER_Z + S.WALL_T], [wall, FRONT_WALL_INNER_Z + S.WALL_T]]
      .map(([x, z]) => { ray.set(new THREE.Vector3(x, Y0 + 2, z), down); return { x, z, hit: ray.intersectObject(island, false).length > 0 }; });
    const clouds = scene.getObjectByName('softClouds');
    let low = 0, high = 0;
    clouds.children.forEach(c => { if (c.position.y < Y0) low++; else high++; });
    return {
      islandTopGap: Y0 - box.max.y,
      islandDepth: box.max.y - box.min.y,
      islandSpan: [box.max.x - box.min.x, box.max.z - box.min.z],
      paverInside: probes.every(p => p.hit),
      paverMisses: probes.filter(p => !p.hit).map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]),
      shaftInside: shaft.every(p => p.hit),
      cloudsUnderIsland: low, cloudsAbove: high,
      cloudsVisibleInSimple: clouds.visible && !outdoorPresentation.detailed,
      wideGroundRemoved: !scene.getObjectByName('outdoorBase'),
      triangles: renderer.info.render.triangles, calls: renderer.info.render.calls
    };
  });
  console.log(JSON.stringify(report, null, 1));
  assert.ok(Math.abs(report.islandTopGap - 0.03) < 1e-6, '섬 상면은 피트 기초보다 30mm 아래');
  assert.equal(report.paverInside, true, '보도블록 광장 전 구역이 섬 위에 있어야 한다');
  assert.equal(report.shaftInside, true, '승강로 외벽 모서리가 섬 위에 있어야 한다');
  assert.equal(report.wideGroundRemoved, true, '광활한 지면 슬래브 제거');
  assert.ok(report.cloudsUnderIsland >= 6, '섬 아래 구름 데크');
  assert.equal(report.cloudsVisibleInSimple, true, '기본 배경에서도 구름이 보인다');

  const SHOTS = [
    ['overview', [26, 16, 38], [2, 9, 5]],
    ['island-edge', [14, 3.2, 26], [2, 0, 6]],
    ['from-below', [18, -12, 30], [2, -2, 5]],
    ['underside', [2, -26, 16], [2, -6, 5]],
    ['far', [55, 20, 80], [2, 8, 5]]
  ];
  for (const [name, cam, target] of SHOTS) {
    await page.evaluate(([c, t]) => {
      controls.enableDamping = false;
      camera.position.set(c[0], c[1], c[2]);
      controls.target.set(t[0], t[1], t[2]);
      camera.near = 0.1; camera.updateProjectionMatrix();
      controls.update();
    }, [cam, target]);
    await page.screenshot({ animations: 'disabled', path: path.join(out, `${label}-${name}.png`) });
  }
  // 상세 배경(주변 풍경)에서도 섬·구름만 보이는지
  await page.click('[data-menu="dd-cam"]');
  await page.click('#c-background');
  await page.waitForFunction(() => outdoorPresentation.detailed && outdoorPresentation.sky.visible);
  await page.evaluate(() => {
    camera.position.set(26, 16, 38); controls.target.set(2, 9, 5); controls.update();
  });
  await page.screenshot({ animations: 'disabled', path: path.join(out, `${label}-detailed.png`) });
  await page.click('#c-background');

  fs.writeFileSync(path.join(out, `${label}.json`), JSON.stringify({ report, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log('OK');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
