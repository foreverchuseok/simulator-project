import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8777/index.html';
const OUT = '.shot-cartop';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`${BASE}?doorcam=2`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  document.body.querySelectorAll('div').forEach(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') e.style.display = 'none';
  });
  window.__aim = (x,y,z,tx,ty,tz) => {
    camera.position.set(x,y,z);
    controls.target.set(tx,ty,tz);
    controls.update();
  };
});
const cy0 = await page.evaluate(() => carGrp.position.y);
const shots = [
  ['zoom1', -0.2, cy0+2.15, -0.55, -0.7, cy0+1.75, -0.15],
  ['zoom2', 0.1, cy0+2.05, -0.35, -0.6, cy0+1.85, -0.25],
  ['zoom3', -0.4, cy0+2.0, -0.60, -0.75, cy0+1.85, -0.30]
];
for (const [name,x,y,z,tx,ty,tz] of shots) {
  await page.evaluate(([x,y,z,tx,ty,tz]) => window.__aim(x,y,z,tx,ty,tz), [x,y,z,tx,ty,tz]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}
await browser.close();
