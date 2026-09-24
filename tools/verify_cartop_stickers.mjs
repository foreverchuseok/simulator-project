import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ args: ['--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => {
    const topBox = scene.getObjectByName('carTopBox');
    if (!topBox) return { success: false, reason: 'carTopBox not found' };

    const posture = topBox.getObjectByName('topBoxStickerPosture');
    const danger = topBox.getObjectByName('topBoxStickerDanger');
    const badge = topBox.getObjectByName('accessibleLabel') || topBox.children.find(c => c.material && c.material.type === 'MeshBasicMaterial');

    const postureWp = new THREE.Vector3();
    const dangerWp = new THREE.Vector3();
    const topBoxWp = new THREE.Vector3();

    topBox.getWorldPosition(topBoxWp);
    if (posture) posture.getWorldPosition(postureWp);
    if (danger) danger.getWorldPosition(dangerWp);

    // Aim camera straight at carTopBox lid
    // The lid faces +X. So place camera at +X and look toward -X
    camera.position.set(topBoxWp.x + 0.95, topBoxWp.y + 0.08, topBoxWp.z);
    controls.target.set(topBoxWp.x, topBoxWp.y + 0.08, topBoxWp.z);
    controls.update();

    return {
      success: !!(posture && danger),
      topBoxWp,
      posturePos: posture?.position,
      dangerPos: danger?.position,
      postureWp,
      dangerWp
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'temporary/cartop_stickers_closeup.png' });
  console.log('Saved temporary/cartop_stickers_closeup.png');

  // Also take context view (slightly zoomed out)
  await page.evaluate(() => {
    const topBox = scene.getObjectByName('carTopBox');
    const topBoxWp = new THREE.Vector3();
    topBox.getWorldPosition(topBoxWp);

    camera.position.set(topBoxWp.x + 1.8, topBoxWp.y + 0.5, topBoxWp.z + 0.6);
    controls.target.set(topBoxWp.x, topBoxWp.y + 0.1, topBoxWp.z);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'temporary/cartop_stickers_context.png' });
  console.log('Saved temporary/cartop_stickers_context.png');

  await browser.close();
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
