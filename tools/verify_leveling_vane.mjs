/* 착상장치 차폐판(LCD Vane) 배치 검증
   (1) 4층 모두 로드
   (2) 중심 Y = FLOOR_Y[f] + CAR_H/2 + LCD_VANE_TOP_BEAM_LY
   (3) Z는 리미트(FLS_Z)와 이동케이블(TC_CAR_Z) 사이
   (4) 좌측 레일 X, 3단 센서 상태 및 비접촉 슬롯, 4층/이탈 위치 검증
   사용: node tools/verify_leveling_vane.mjs
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8897;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

server.listen(PORT, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?lcdcam`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  const R = await page.evaluate(() => {
    const vanes = [];
    railGrp.traverse(o => {
      if (o.userData && o.userData.type === 'leveling-vane') {
        const bb = new THREE.Box3().setFromObject(o);
        vanes.push({
          floor: o.userData.floor, name: o.name,
          x: o.position.x, y: o.position.y, z: o.position.z,
          bbMin: bb.min.toArray(), bbMax: bb.max.toArray()
        });
      }
    });
    vanes.sort((a, b) => a.floor - b.floor);
    const expectedY = FLOOR_Y.map(fy => fy + S.CAR_H / 2 + LCD_VANE_TOP_BEAM_LY);
    return {
      count: vanes.length,
      vanes,
      expectedY,
      CAR_RAIL_X, CAR_RAIL_Z, LCD_VANE_Z, LCD_VANE_H, FLS_Z, TC_CAR_Z,
      topBeamLY: LCD_VANE_TOP_BEAM_LY,
      carY: carGrp.position.y,
      carTopBeamWorldY: carGrp.position.y + LCD_VANE_TOP_BEAM_LY
    };
  });

  let fail = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
    if (!ok) fail++;
  };
  check(errs.length === 0, 'page errors ' + JSON.stringify(errs));
  check(R.count === 4, `vane count ${R.count}`);
  R.vanes.forEach((v, i) => {
    check(Math.abs(v.x + R.CAR_RAIL_X) < 1e-6, `F${v.floor} X left rail ${v.x}`);
    check(Math.abs(v.y - R.expectedY[i]) < 1e-6, `F${v.floor} Y ${v.y} vs ${R.expectedY[i]}`);
    check(Math.abs(v.z - R.CAR_RAIL_Z) < 1e-6, `F${v.floor} Z origin ${v.z}`);
    check(v.bbMax[2] > R.FLS_Z && v.bbMin[2] < R.TC_CAR_Z, `F${v.floor} Z between FLS and TC`);
    check(Math.abs((v.bbMax[1] - v.bbMin[1]) - R.LCD_VANE_H) < 1e-6, `F${v.floor} height matches LCD_VANE_H ${v.bbMax[1] - v.bbMin[1]}`);
  });
  check(Math.abs(R.carTopBeamWorldY - R.expectedY[0]) < 1e-6, `1F landed car top-beam Y matches vane 1 (${R.carTopBeamWorldY})`);
  check(R.LCD_VANE_Z - R.FLS_Z > 0.4, `LCD_VANE_Z ${R.LCD_VANE_Z} clear of FLS_Z ${R.FLS_Z}`);
  check(R.TC_CAR_Z - R.LCD_VANE_Z > 0.2, `LCD_VANE_Z ${R.LCD_VANE_Z} clear of TC_CAR_Z ${R.TC_CAR_Z}`);

  const sensorChecks=await page.evaluate(()=>{
    const result=[];const push=(name,pass,detail)=>result.push({name,pass,detail});
    const cy=carGrp.position.y,cw=cwtGrp.position.y;
    const move=y=>{carGrp.position.y=y;cwtGrp.position.y=cw-(y-cy);refreshRopes();scene.updateMatrixWorld(true);};
    push('three fork sensors',levelingSystem.sensors.length===3);
    for(let f=0;f<FLOORS;f++){
      const y=FLOOR_Y[f]+S.CAR_H/2;
      for(const offset of [-0.20,-0.01,0,0.01,0.20]){
        move(y+offset);const s=elevatorState.leveling;
        const expected=offset===0?[true,true,true]:offset===-0.01?[true,true,false]:offset===0.01?[false,true,true]:[false,false,false];
        push('F'+(f+1)+' offset '+offset,JSON.stringify([s.upper,s.middle,s.lower])===JSON.stringify(expected),{...s});
      }
      move(y);
      const plate=scene.getObjectByName('levelingVane_'+(f+1)).getObjectByName('VanePlate');
      const pb=new THREE.Box3().setFromObject(plate);
      let collision=false;
      scene.getObjectByName('carLevelingSensors').traverse(o=>{if(o.isMesh&&!o.name.startsWith('levelingSensorLead')){const b=new THREE.Box3().setFromObject(o);if(pb.intersectsBox(b))collision=true;}});
      push('F'+(f+1)+' plate passes actual sensor opening',!collision);
      push('F'+(f+1)+' flat plate has no old lips',!scene.getObjectByName('levelingVane_'+(f+1)).getObjectByName('VaneLip'));
    }
    // X 축이 어긋나면 Y가 맞아도 차폐 신호를 내지 않는다.
    const sensors=scene.getObjectByName('carLevelingSensors');sensors.position.x+=0.03;refreshLevelingSensors();
    push('misalignment is not level',!elevatorState.leveling.atLevel);sensors.position.x-=0.03;
    move(cy);cwtGrp.position.y=cw;refreshRopes();
    return result;
  });
  sensorChecks.forEach(c=>check(c.pass,c.name+' '+JSON.stringify(c.detail||'')));

  for(const view of ['slot','side','above']){
    await page.evaluate(view=>{
      scene.children.forEach(o=>{if(o!==carGrp&&o!==railGrp&&!o.isLight)o.visible=false;});
      railGrp.children.forEach(o=>{o.visible=o.name==='levelingVane_1';});
      // 확대 절개 시점에서만 시야를 가리는 난간과 탑 박스를 숨긴다.
      carGrp.getObjectByName('carHandrail').visible=false;
      carGrp.getObjectByName('carTopBox').visible=false;
      const g=scene.getObjectByName('carLevelingSensors'),p=g.getWorldPosition(new THREE.Vector3());
      controls.enableDamping=false;controls.minDistance=0.03;
      if(view==='slot')camera.position.set(p.x+0.20,p.y+0.18,p.z-0.32);
      if(view==='side')camera.position.set(p.x-0.32,p.y+0.06,p.z+0.25);
      if(view==='above')camera.position.set(p.x-0.20,p.y+0.50,p.z+0.22);
      controls.target.set(p.x,p.y,p.z+0.025);controls.update();
    },view);
    await page.screenshot({path:path.join(ROOT,`.shot-leveling-${view}.png`)});
  }
  if(process.argv.includes('--detail')){await browser.close();server.close();if(fail)process.exitCode=1;return;}

  await page.screenshot({ path: path.join(ROOT, '.shot-lcd-vane-1f.png') });

  await page.evaluate(() => {
    const y = FLOOR_Y[1] + S.CAR_H / 2 + LCD_VANE_TOP_BEAM_LY;
    camera.position.set(-CAR_RAIL_X + 1.2, y + 0.35, LCD_VANE_Z + 0.85);
    controls.target.set(-CAR_RAIL_X, y, LCD_VANE_Z);
    controls.update();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ROOT, '.shot-lcd-vane-2f.png') });

  await page.evaluate(() => {
    camera.position.set(2.2, 8.2, 2.8);
    controls.target.set(-CAR_RAIL_X, 8.0, CAR_RAIL_Z);
    controls.update();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ROOT, '.shot-lcd-vane-shaft.png') });

  console.log(JSON.stringify({ expectedY: R.expectedY, vanes: R.vanes.map(v => ({ f: v.floor, y: v.y, z: v.z })) }, null, 2));
  await browser.close();
  server.close();
  if (fail) process.exit(1);
});
