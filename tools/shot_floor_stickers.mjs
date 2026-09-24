import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.shot-floor-stickers');
fs.mkdirSync(out, { recursive: true });

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('pageerror', e => console.error('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto(`http://127.0.0.1:${server.address().port}/index.html?doorcam=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => hatchDoors.length === 4 && hatchDoors.every(h => h.interlock?.ready));

await page.evaluate(() => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  camera.near = 0.003;
  camera.updateProjectionMatrix();
  controls.minDistance = 0.005;
  // Move car to top floor so it does not block 1F view
  if (window.carGrp) {
    carGrp.position.y = FLOOR_Y[3] + S.CAR_H / 2;
  }
});

// Capture each floor's sticker from hoistway side
for (let fl = 0; fl < 4; fl++) {
  await page.evaluate((flIdx) => {
    const sticker = hatchDoors[flIdx].right.getObjectByName(`hoistwayFloorSticker_${flIdx + 1}F`);
    if (!sticker) return;
    const v = new THREE.Vector3();
    sticker.getWorldPosition(v);
    camera.position.set(v.x, v.y, v.z - 0.35);
    controls.target.copy(v);
    controls.update();
  }, fl);

  await page.waitForTimeout(400);
  const shotPath = path.join(out, `floor_${fl + 1}.png`);
  await page.screenshot({ path: shotPath });
  console.log(`Saved screenshot for floor ${fl + 1}: ${shotPath}`);
}

await browser.close();
server.close();
