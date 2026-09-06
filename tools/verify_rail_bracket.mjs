import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = 8891;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Browser error:', msg.text());
    });

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // 3D 모델 및 GLB 로딩 대기

    // 1. 좌측 레일 브라켓 클로즈업 뷰 (2단 브라켓 Y = 4.05m 부근)
    await page.evaluate(() => {
      // 카 레일 좌측 위치: X = -1.3125, Z = CAR_CTR_Z + 0.04
      const leftRailX = -S.CAR_BG / 2;
      const railZ = CAR_CTR_Z + 0.04;
      const targetY = 4.05;

      camera.position.set(leftRailX + 0.9, targetY + 0.45, railZ + 0.9);
      controls.target.set(leftRailX - 0.15, targetY, railZ);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ROOT, '.shot-bracket-close.png') });
    console.log('Saved .shot-bracket-close.png');

    // 2. 승강로 내부 전체 뷰 (우측 대각선 후면에서 카/CWT 레일 4개 및 좌측 벽 브라켓 전체 조망)
    await page.evaluate(() => {
      camera.position.set(3.8, 8.5, -2.2);
      controls.target.set(-0.6, 7.5, -0.2);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ROOT, '.shot-shaft-overview.png') });
    console.log('Saved .shot-shaft-overview.png');

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
