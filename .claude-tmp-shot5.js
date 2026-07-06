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
  await new Promise(r => server.listen(8124, r));
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); }
  catch (e) { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8124/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const gd = await page.evaluate(`(() => ({ gx: mrGrp.userData.govX, gy: mrGrp.userData.govWheelY, gz: mrGrp.userData.govZ }))()`);
  const views = [
    // 휠 정면 근접 (진자·스포크·조정스프링 확인)
    ['gov-close', [gd.gx + 0.48, gd.gy + 0.06, gd.gz + 0.10], [gd.gx, gd.gy + 0.02, gd.gz]],
    // 실물 사진 150018 구도 (전면-좌측 쿼터뷰: 스프링 타워측)
    ['gov-quarter', [gd.gx + 0.42, gd.gy + 0.18, gd.gz + 0.42], [gd.gx, gd.gy - 0.02, gd.gz]],
    // 후면 우측 (과속 스위치측)
    ['gov-rear', [gd.gx + 0.45, gd.gy + 0.22, gd.gz - 0.42], [gd.gx, gd.gy + 0.05, gd.gz]],
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
