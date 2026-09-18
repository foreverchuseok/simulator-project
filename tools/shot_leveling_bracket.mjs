import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8777/index.html';
const OUT = '.shot-leveling';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`${BASE}?doorcam=2`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  document.querySelectorAll('#ui, #hud, .panel, #hint, #loading').forEach(e => e.style.display = 'none');
  document.body.querySelectorAll('div').forEach(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') e.style.display = 'none';
  });
  const g = scene.getObjectByName('carLevelingSensors');
  const wp = new THREE.Vector3();
  g.getWorldPosition(wp);
  const box = new THREE.Box3().setFromObject(g);
  window.__aim = (x,y,z,tx,ty,tz) => { camera.position.set(x,y,z); controls.target.set(tx,ty,tz); controls.update(); };
  // also get car top handrail top Y for comparison
  const hr = scene.getObjectByName('carHandrail');
  const hrBox = new THREE.Box3().setFromObject(hr);
  return { pos: wp.toArray(), box: {min: box.min.toArray(), max: box.max.toArray()}, hrBoxMaxY: hrBox.max.y };
});
console.log(JSON.stringify(info, null, 2));
const [x,y,z] = info.pos;
const shots = [
  ['bracket_wide', x+0.5, y+0.35, z+0.5, x, y, z],
  ['bracket_close', x+0.25, y+0.15, z+0.30, x, y-0.05, z],
  ['bracket_side', x+0.05, y+0.10, z+0.45, x-0.05, y-0.05, z]
];
for (const [name,cx,cy,cz,tx,ty,tz] of shots) {
  await page.evaluate(([cx,cy,cz,tx,ty,tz]) => window.__aim(cx,cy,cz,tx,ty,tz), [cx,cy,cz,tx,ty,tz]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
}
await browser.close();
