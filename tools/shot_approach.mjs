/* 승강로 전면 광장·경사로 스크린샷 — 사용: node tools/shot_approach.mjs [라벨] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const label = process.argv[2] || 'current';
const root = process.cwd(), out = path.join(root, '.shot-approach');
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
  const info = await page.evaluate(() => {
    const g = scene.getObjectByName('lobbyApproachRampAndStairs');
    const b = new THREE.Box3().setFromObject(g);
    const isl = new THREE.Box3().setFromObject(scene.getObjectByName('skyIslandBody'));
    return { SHAFT_W: S.SHAFT_W, SHAFT_D: S.SHAFT_D, WALL_T: S.WALL_T, FRONT_WALL_INNER_Z, SHAFT_BACK_Z, Y0, F0: FLOOR_Y[0], FLOOR_Y,
      approach: [b.min.toArray().map(v => +v.toFixed(2)), b.max.toArray().map(v => +v.toFixed(2))],
      island: [isl.min.toArray().map(v => +v.toFixed(2)), isl.max.toArray().map(v => +v.toFixed(2))] };
  });
  console.log(JSON.stringify(info));
  const SHOTS = (process.argv[3] ? JSON.parse(process.argv[3]) : null) || [
    ['user', [-14, 20, 22], [2, 1, 4]],
    ['top', [1, 40, 5.01], [1, 0, 5]],
    ['front', [4, 5, 22], [2, 1.5, 4]],
    ['side', [16, 4, 9], [2, 1.2, 5]]
  ];
  for (const [name, cam, target] of SHOTS) {
    await page.evaluate(([c, t]) => {
      controls.enableDamping = false;
      camera.position.set(c[0], c[1], c[2]);
      controls.target.set(t[0], t[1], t[2]);
      camera.near = 0.1; camera.updateProjectionMatrix();
      controls.update();
    }, [cam, target]);
    await page.waitForTimeout(400);
    await page.screenshot({ animations: 'disabled', path: path.join(out, `${label}-${name}.png`) });
  }
  if (errors.length) console.log('ERRORS', errors);
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
