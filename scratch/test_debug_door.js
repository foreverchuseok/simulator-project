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
await new Promise(r => srv.listen(8350, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', m => console.log('[browser]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e));
await page.goto('http://localhost:8350/index.html');
await page.waitForTimeout(3000);

const testRes = await page.evaluate(async () => {
  const h = hatchDoors[0];
  console.log('1. before open: doorOpen=' + doorOpen + ' rightX=' + h.right.position.x);
  
  openDoors();
  console.log('2. called open: doorOpen=' + doorOpen);
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('3. after 2s: doorOpen=' + doorOpen + ' rightX=' + h.right.position.x + ' hookRot=' + h.hook.rotation.z);
  
  closeDoors();
  console.log('4. called close: doorOpen=' + doorOpen);
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('5. after 2s close: doorOpen=' + doorOpen + ' rightX=' + h.right.position.x + ' hookRot=' + h.hook.rotation.z);

  return {
    rightX: h.right.position.x,
    hookRot: h.hook.rotation.z
  };
});
console.log('Test Result:', testRes);

await browser.close();
srv.close();
