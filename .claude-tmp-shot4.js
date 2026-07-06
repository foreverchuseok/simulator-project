const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.pdf': 'application/pdf' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(8123, r));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge' });
  } catch (e) {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXE });
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  await page.goto('http://localhost:8123/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // 조속기 휠 중심 좌표를 페이지 전역에서 읽음
  const gd = await page.evaluate(`(() => ({
    gx: mrGrp.userData.govX, gy: mrGrp.userData.govWheelY, gz: mrGrp.userData.govZ,
    y0: Y0, th: TOTAL_H
  }))()`);
  console.log('gov data', JSON.stringify(gd));

  const views = [
    // ① 조속기 본체 정면 쿼터뷰 (+X 측에서 휠 면)
    ['gov-body', [gd.gx + 0.75, gd.gy + 0.28, gd.gz + 0.55], [gd.gx, gd.gy, gd.gz]],
    // ② 조속기 + 베이스 스탠드 와이드
    ['gov-stand', [gd.gx + 1.15, gd.gy + 0.55, gd.gz + 1.05], [gd.gx, gd.gy - 0.15, gd.gz]],
    // ③ 피트 인장시브 + 인장추
    ['tens-shv', [gd.gx + 0.75, gd.y0 + 1.05, 0.22 + 0.80], [gd.gx, gd.y0 + 0.60, 0.22]],
  ];
  for (const [name, cam, tgt] of views) {
    const ok = await page.evaluate(`(() => { try {
      camera.position.set(${cam.join(',')});
      controls.target.set(${tgt.join(',')});
      controls.update();
      return true;
    } catch (e) { return e.message; } })()`);
    if (ok !== true) console.log('VIEW FAIL', name, ok);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(root, `.shot-${name}.png`) });
    console.log('saved', name);
  }
  await browser.close();
  server.close();
})();
