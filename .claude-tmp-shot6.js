const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(8125, r));
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); }
  catch (e) { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8125/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const gd = await page.evaluate(`(() => ({ gx: mrGrp.userData.govX, gy: mrGrp.userData.govWheelY, gz: mrGrp.userData.govZ }))()`);
  const views = [
    // 실물 152626과 같은 측면 정면 (약간 위에서)
    ['gov-side', [gd.gx + 0.66, gd.gy + 0.12, gd.gz + 0.02], [gd.gx, gd.gy + 0.02, gd.gz]],
    // 쿼터뷰
    ['gov-quarter', [gd.gx + 0.45, gd.gy + 0.20, gd.gz + 0.40], [gd.gx, gd.gy - 0.02, gd.gz]],
  ];
  for (const [name, cam, tgt] of views) {
    await page.evaluate(`camera.position.set(${cam.join(',')}); controls.target.set(${tgt.join(',')}); controls.update();`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(root, `.shot-${name}.png`) });
    console.log('saved', name);
  }
  await browser.close();
  server.close();
})();
