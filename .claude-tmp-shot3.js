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

  const views = [
    // 사용자 스크린샷과 같은 쿼터뷰 (+X 쪽에서, 모터 좌측·디플렉터 우측)
    ['tm-q', '1.7, Y0 + TOTAL_H + 1.15, 0.55', '-0.15, Y0 + TOTAL_H + 0.45, -0.45'],
    // 메인 시브 정면 (+X 측)
    ['tm-shv', '1.15, Y0 + TOTAL_H + 0.75, -0.20', '0.0, Y0 + TOTAL_H + 0.55, -0.20'],
    // 브레이크/솔레노이드 확대 (약간 위 앞)
    ['tm-brk2', '0.55, Y0 + TOTAL_H + 1.05, 0.55', '-0.24, Y0 + TOTAL_H + 0.62, -0.06'],
  ];
  for (const [name, cam, tgt] of views) {
    const ok = await page.evaluate(`(() => { try {
      camera.position.set(${cam});
      controls.target.set(${tgt});
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
