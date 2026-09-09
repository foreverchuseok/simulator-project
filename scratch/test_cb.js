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
await new Promise(r => srv.listen(8354, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:8354/index.html');
await page.waitForTimeout(3000);

const finalStatus = await page.evaluate(() => {
  return new Promise(resolve => {
    openDoors(() => {
      closeDoors(() => {
        // Wait 300ms for hook to finish dropping into keeper
        setTimeout(() => {
          const h = hatchDoors[0];
          resolve({
            doorOpen,
            currentState,
            rightX: +h.right.position.x.toFixed(4),
            leftX: +h.left.position.x.toFixed(4),
            hookRot: +h.hook.rotation.z.toFixed(4)
          });
        }, 300);
      });
    });
  });
});
console.log('FINAL VERIFIED DOOR & INTERLOCK STATUS:', finalStatus);

await browser.close();
srv.close();
