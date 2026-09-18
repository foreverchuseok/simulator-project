import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8777/index.html';
const OUT = '.shot-door-header';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`${BASE}?doorcam=2`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  document.body.querySelectorAll('div').forEach(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') e.style.display = 'none';
  });
});
await page.screenshot({ path: `${OUT}/doorcam2.png` });
console.log('saved doorcam1');
await browser.close();
