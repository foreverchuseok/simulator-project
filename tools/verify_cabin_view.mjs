// 카 정면(탑승 시점) 토글·카 추종과 카 내부 OPB 층표시 갱신을 확인한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),out=path.join(root,'.shot-cabin-view');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&document.getElementById('loading').classList.contains('hide'));
 await page.evaluate(()=>{gsap.ticker.lagSmoothing(0);targetSpeed=240;});
 const rel=()=>page.evaluate(()=>({cam:camera.position.y-carGrp.position.y,tgt:controls.target.y-carGrp.position.y,z:camera.position.z,
  active:document.getElementById('c-cabin').classList.contains('active'),follow:!!cabinFollow,opb:CarFloorDisplay.last,cur:curFloor,moving}));

 assert.equal((await rel()).opb,'1|','OPB starts at 1F');
 await page.click('#c-cabin');
 await page.waitForFunction(()=>cabinFollow&&!cabinFollow.entering);
 const a=await rel();assert.ok(a.active&&a.follow);
 await page.screenshot({path:path.join(out,'1-enter-1F.png')});

 // 층 버튼 → 운행 중에도 시점이 카와 같은 상대 높이를 유지해야 한다.
 await page.click('#fbtns .c-btn[data-f="2"]');
 await page.waitForFunction(()=>moving);
 await page.waitForFunction(()=>CarFloorDisplay.last.includes('↑'));
 const mid=await rel();
 await page.waitForFunction(()=>!moving&&curFloor===2);
 const b=await rel();
 await page.screenshot({path:path.join(out,'2-arrived-3F.png')});
 assert.ok(Math.abs(b.cam-a.cam)<1e-4&&Math.abs(b.tgt-a.tgt)<1e-4,`camera rides the car ${JSON.stringify({a,b})}`);
 assert.ok(Math.abs(mid.cam-a.cam)<0.05,'camera stays in the car while moving');
 assert.equal(b.opb,'3|');

 // 드래그로 둘러봐도 추종은 유지된다.
 await page.mouse.move(640,420);await page.mouse.down();await page.mouse.move(700,400,{steps:5});await page.mouse.up();
 assert.ok((await rel()).follow,'orbit drag keeps cabin follow');

 // 다시 누르면 해제 — 이후 운행에서 카메라는 제자리.
 await page.click('#c-cabin');
 const c=await page.evaluate(()=>({y:camera.position.y,follow:!!cabinFollow,active:document.getElementById('c-cabin').classList.contains('active')}));
 assert.ok(!c.follow&&!c.active);
 await page.waitForFunction(()=>!gsap.isTweening(carDoorL.position)&&!moving);
 await page.click('#fbtns .c-btn[data-f="0"]');
 await page.waitForFunction(()=>!moving&&curFloor===0,null,{timeout:180000});
 const d=await page.evaluate(()=>({y:camera.position.y,opb:CarFloorDisplay.last}));
 assert.ok(Math.abs(d.y-c.y)<1e-6,'released view does not follow');assert.equal(d.opb,'1|');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({a,mid,b,c,d}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
