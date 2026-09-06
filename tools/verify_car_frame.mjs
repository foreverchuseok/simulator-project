import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = 8894;

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
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

    page.on('console', msg => console.log(`[Browser ${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('[Browser PAGE ERROR]:', err));

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);

    const outDir = path.join(ROOT, '.temp_verify');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. 카 프레임 전체 조감 뷰 (우측-후방 개방면에서 조망)
    await page.evaluate(() => {
      const carPos = carGrp.position;
      camera.position.set(carPos.x + 3.8, carPos.y + 1.0, carPos.z - 2.8);
      controls.target.set(carPos.x, carPos.y, carPos.z);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '01_car_frame_overview.png') });
    console.log('Saved 01_car_frame_overview.png');

    // 2. 상부 크로스헤드 및 1:1 5구 바빗 로프 소켓 클로즈업
    await page.evaluate(() => {
      const carPos = carGrp.position;
      const topY = carPos.y + S.CAR_H / 2 + 0.68;
      camera.position.set(carPos.x + 0.9, topY + 0.40, carPos.z - 0.9);
      controls.target.set(carPos.x, topY, carPos.z);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '02_babbitt_sockets_detail.png') });
    console.log('Saved 02_babbitt_sockets_detail.png');

    // 3. 상부 안전 난간대 (황색 베이스 가드 + 안전 파이프 난간)
    await page.evaluate(() => {
      const carPos = carGrp.position;
      const topY = carPos.y + S.CAR_H / 2 + 0.50;
      camera.position.set(carPos.x + 2.5, topY + 1.2, carPos.z - 1.8);
      controls.target.set(carPos.x, topY, carPos.z);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '03_safety_handrail_top.png') });
    console.log('Saved 03_safety_handrail_top.png');

    // 4. 하부 세이프티 디바이스 및 하부 가이드 슈 클로즈업
    await page.evaluate(() => {
      const carPos = carGrp.position;
      const botY = carPos.y - S.CAR_H / 2 - 0.16;
      camera.position.set(carPos.x + 2.2, botY - 0.1, carPos.z - 1.2);
      controls.target.set(carPos.x + 1.25, botY, carPos.z + 0.04);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '04_safety_gear_and_guide_shoe.png') });
    console.log('Saved 04_safety_gear_and_guide_shoe.png');

    // 5. 플랫폼 베이스 프레임 (카 바닥 지지 채널)
    await page.evaluate(() => {
      const carPos = carGrp.position;
      const botY = carPos.y - S.CAR_H / 2;
      camera.position.set(carPos.x + 3.0, botY + 0.6, carPos.z - 2.0);
      controls.target.set(carPos.x, botY, carPos.z);
      controls.update();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '05_platform_frame.png') });
    console.log('Saved 05_platform_frame.png');

    // 6. 2층 주행 테스트 (운행 중 카 프레임 및 로프 동기화 검증)
    await page.evaluate(() => {
      moveElevator(1); // 2층 호출
    });
    await page.waitForTimeout(1800); // 상승 중간 시점
    await page.evaluate(() => {
      const carPos = carGrp.position;
      camera.position.set(carPos.x + 4.2, carPos.y + 1.2, carPos.z - 3.2);
      controls.target.set(carPos.x, carPos.y, carPos.z);
      controls.update();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '06_car_moving_travel.png') });
    console.log('Saved 06_car_moving_travel.png');

    await browser.close();
    server.close();
    console.log('Verification completed successfully.');
  } catch (err) {
    console.error('Verification error:', err);
    server.close();
    process.exit(1);
  }
});
