import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = 8892;

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

    page.on('console', msg => console.log(`[Browser ${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('[Browser PAGE ERROR]:', err));

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000); // 3D 모델 및 renderLoop 시작 대기

    const status = await page.evaluate(() => {
      const el = document.getElementById('loading');
      return {
        hasLoading: !!el,
        classes: el?.className,
        display: el?.style.display,
        hasScene: typeof scene !== 'undefined'
      };
    });
    console.log('Loading element status:', status);

    // controls.minDistance 해제하여 초근접 촬영 허용
    await page.evaluate(() => {
      controls.minDistance = 0.05;
      controls.maxDistance = 100;
    });

    const f = 1; // 2층 도어

    // 1. 승강장 로비 시점 — 2.0m 삼각키 베젤 & 정삼각형 홀 초근접 클로즈업
    await page.evaluate((f) => {
      camera.position.set(0.32, FLOOR_Y[f] + 2.00, 1.35);
      controls.target.set(0.32, FLOOR_Y[f] + 2.00, 1.15);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-hall.png') });
    console.log('Saved .shot-tri-key-hall.png');

    // 1-1. [원거리 검증] 승강장 로비 중·원거리 뷰 (도어 전경 속 삼각키 키홀 시인성 확인)
    await page.evaluate((f) => {
      camera.position.set(0.40, FLOOR_Y[f] + 1.95, 1.80);
      controls.target.set(0.32, FLOOR_Y[f] + 2.00, 1.18);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-hall-dist.png') });
    console.log('Saved .shot-tri-key-hall-dist.png');

    // 2. 승강로 내부 시점 — 인터록 ~ 수직 브라켓 바 ~ 삼각키 캠 전체 조망
    await page.evaluate((f) => {
      camera.position.set(0.35, FLOOR_Y[f] + 2.15, 0.30);
      controls.target.set(0.05, FLOOR_Y[f] + 2.05, 1.05);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-shaft.png') });
    console.log('Saved .shot-tri-key-shaft.png');

    // 3. 삼각키 캠 및 수직 바 장공 슬롯 결합부 초근접 클로즈업 (월드 X ≈ 0.32, Y ≈ 2.03)
    await page.evaluate((f) => {
      camera.position.set(0.32, FLOOR_Y[f] + 2.03, 0.70);
      controls.target.set(0.32, FLOOR_Y[f] + 2.03, 1.05);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-joint.png') });
    console.log('Saved .shot-tri-key-joint.png');

    // 4. 인터록 래치 정상 닫힘 상태 (Hook 닫힘 & 스위치 브리지 밀착, 월드 X ≈ 0.22, Y ≈ 2.25)
    await page.evaluate((f) => {
      setEmergencyKey(f, 0); // 완전 잠김 상태
      camera.position.set(0.22, FLOOR_Y[f] + 2.25, 0.60);
      controls.target.set(0.22, FLOOR_Y[f] + 2.25, 1.05);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-locked.png') });
    console.log('Saved .shot-tri-key-locked.png');

    // 5. 비상 삼각키 회전 해정 상태 (Cam 회전 -> 후크 래치 4~5mm 상승 & 스위치 분리)
    await page.evaluate((f) => {
      setEmergencyKey(f, 1.0); // 100% 해정
      camera.position.set(0.22, FLOOR_Y[f] + 2.25, 0.60);
      controls.target.set(0.22, FLOOR_Y[f] + 2.25, 1.05);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-unlocked.png') });
    console.log('Saved .shot-tri-key-unlocked.png');

    // 6. [추가 검증] 측면 뷰 (Side Profile) — C레일-행거플랜지-도어패널-실 단일 PLUMB 축 및 콤팩트한 벽체 브라켓 확인
    await page.evaluate((f) => {
      setEmergencyKey(f, 0); // 잠김 상태로 복귀
      camera.position.set(1.40, FLOOR_Y[f] + 2.15, 1.18);
      controls.target.set(0.20, FLOOR_Y[f] + 2.15, 1.18);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-side.png') });
    console.log('Saved .shot-tri-key-side.png');

    // 7. [추가 검증] 배면 정면 뷰 (Rear Straight) — 인터록 대각암 ~ 2.0m 삼각키 캠까지 완벽한 수직 일직선 평철 바 확인
    await page.evaluate((f) => {
      camera.position.set(0.20, FLOOR_Y[f] + 2.15, 0.50);
      controls.target.set(0.20, FLOOR_Y[f] + 2.15, 1.18);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-straight.png') });
    console.log('Saved .shot-tri-key-straight.png');

    // 8. [추가 검증] 벽체 L-브라켓 콤팩트 밀착 클로즈업 뷰 (월드 X ≈ 1.36m 양단 브라켓)
    await page.evaluate((f) => {
      camera.position.set(1.10, FLOOR_Y[f] + 2.35, 0.70);
      controls.target.set(1.36, FLOOR_Y[f] + 2.22, 1.18);
      controls.update();
    }, f);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-tri-key-bracket.png') });
    console.log('Saved .shot-tri-key-bracket.png');

    // 9. [단차 해소 검증] 1층 전경 — 기단부 포디움 + 전면 계단 + 우측 휠체어 회전 경사로 조망
    await page.evaluate(() => {
      camera.position.set(-3.8, 3.8, 12.0);
      controls.target.set(1.2, 1.2, 5.0);
      controls.update();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-lobby-stairs-ramp.png') });
    console.log('Saved .shot-lobby-stairs-ramp.png');

    // 10. [단차 해소 검증] 우측 휠체어 회전 경사로 (스위치백 램프 및 2단 핸드레일) 측면 뷰
    await page.evaluate(() => {
      camera.position.set(7.2, 3.2, 7.5);
      controls.target.set(3.2, 1.0, 6.0);
      controls.update();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-wheelchair-ramp.png') });
    console.log('Saved .shot-wheelchair-ramp.png');

    // 11. [단차 해소 검증] 전면 계단 및 핸드레일/점자블록 정면 뷰
    await page.evaluate(() => {
      camera.position.set(0.0, 2.0, 8.5);
      controls.target.set(0.0, 1.2, 4.0);
      controls.update();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ROOT, '.shot-stairs-front.png') });
    console.log('Saved .shot-stairs-front.png');

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
