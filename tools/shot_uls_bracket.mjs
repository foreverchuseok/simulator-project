import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8777/index.html';
const OUT = '.shot-uls-bracket';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`${BASE}?sldcam`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  document.body.querySelectorAll('div').forEach(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') e.style.display = 'none';
  });
  window.__aimAt = (name, dx, dy, dz) => {
    const sw = TERMINAL_SWITCHES.find(s => s.name === name);
    camera.position.set(FLS_PIVOT_X + dx, sw.y + dy, FLS_Z + dz);
    controls.target.set(FLS_PIVOT_X + 0.03, sw.y, FLS_Z);
    controls.update();
  };
  window.__aimY = (y, dx, dy, dz) => {
    camera.position.set(FLS_PIVOT_X + dx, y + dy, FLS_Z + dz);
    controls.target.set(FLS_PIVOT_X + 0.03, y, FLS_Z);
    controls.update();
  };
});
const shots = [
  ['ULS_wide', 'ULS', 0.9, 0.35, -1.0],
  ['ULS_mid', 'ULS', 0.5, 0.15, -0.6],
  ['UFL_mid', 'UFL', 0.5, 0.15, -0.6],
  ['USD_mid', 'USD', 0.5, 0.15, -0.6],
  ['bracket1485', null, 0.9, 0.35, -1.0]
];
for (const [name, sw, dx, dy, dz] of shots) {
  if (sw) await page.evaluate(([n,x,y,z]) => window.__aimAt(n,x,y,z), [sw,dx,dy,dz]);
  else await page.evaluate(([x,y,z]) => window.__aimY(14.85,x,y,z), [dx,dy,dz]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}
await browser.close();
