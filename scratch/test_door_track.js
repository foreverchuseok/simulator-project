import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/goodm/Desktop/simmul';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => srv.listen(8349, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:8349/index.html');
await page.waitForTimeout(3000);

// Wait for full open
await page.evaluate(() => openDoors());
await page.waitForTimeout(1600);

// Call close and wait until completion
await page.evaluate(() => closeDoors());
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(100);
  const st = await page.evaluate(() => {
    const h = hatchDoors[0];
    return { rightX: h.right.position.x, hookRot: h.hook.rotation.z };
  });
  if (i >= 10) {
    console.log(`closing ${(i+1)*100}ms: rightX=${st.rightX.toFixed(3)}, hookRot=${st.hookRot.toFixed(4)}`);
  }
  if (Math.abs(st.rightX - 0.391) < 0.001 && Math.abs(st.hookRot) < 0.001) {
    console.log(`>>> FULLY CLOSED & LOCKED at ${(i+1)*100}ms! rightX=${st.rightX.toFixed(3)}, hookRot=${st.hookRot.toFixed(4)}`);
    break;
  }
}

await browser.close();
srv.close();
