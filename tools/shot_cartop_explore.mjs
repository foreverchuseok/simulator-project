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
  ['wide',  1.5, cy0+2.2, -1.6,  0, cy0+1.3, 0],
  ['left1', 0.6, cy0+2.4, -1.3, -0.9, cy0+1.6, -0.2],
  ['left2', -0.5, cy0+2.3, -0.8, -0.9, cy0+1.5, -0.2],
  ['front', 0.0, cy0+2.4, 1.6, 0, cy0+1.6, 0.5],
  ['rail_post_L', -0.9, cy0+1.9, -0.4, -0.9, cy0+1.5, -0.15],
  ['rail_post_R', 0.9, cy0+1.9, -0.4, 0.9, cy0+1.5, -0.15]
];
for (const [name,x,y,z,tx,ty,tz] of shots) {
  await page.evaluate(([x,y,z,tx,ty,tz]) => window.__aim(x,y,z,tx,ty,tz), [x,y,z,tx,ty,tz]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}
await browser.close();
