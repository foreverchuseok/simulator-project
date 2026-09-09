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
await new Promise(r => srv.listen(8351, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:8351/index.html');
await page.waitForTimeout(3000);

const res = await page.evaluate(async () => {
  const h = hatchDoors[0];
  const logs = [];
  logs.push('initial: ' + h.hook.rotation.z);
  h.hook.rotation.z = -0.055;
  logs.push('manually set: ' + h.hook.rotation.z);
  await new Promise(r => {
    gsap.to(h.hook.rotation, { z: 0, duration: 0.2, onComplete: r });
  });
  logs.push('after gsap to 0: ' + h.hook.rotation.z);
  return logs;
});
console.log(res);

await browser.close();
srv.close();
