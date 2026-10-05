// 모바일 HUD 상태별 화면 — node tools/shot_mobile_hud.mjs <label> [WxH]
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {chromium} from 'playwright';
const label=process.argv[2]||'current',[W,H]=(process.argv[3]||'390x844').split('x').map(Number);
const root=process.cwd(),out=path.join(root,'temporary','mobile-redesign','shots');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--enable-gpu']});const errors=[];
try{
 const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&document.querySelector('#loading.hide'));await page.waitForTimeout(1500);
 const shot=async n=>{await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`${label}-${W}-${n}.png`)});};
 await shot('idle');
 await page.evaluate(()=>document.querySelector('#m-run')?.click());await shot('run');
 await page.evaluate(()=>{document.querySelector('#m-run')?.click();(document.querySelector('#m-settings')||document.querySelector('[data-menu="dd-view"]')).click();});await shot('settings');
 await page.evaluate(()=>closeAllMenus());
 await page.evaluate(()=>CharacterWalk.start());await page.waitForTimeout(1500);await shot('walk');
 await page.evaluate(()=>CharacterWalk.exit());await page.waitForTimeout(800);
 await page.evaluate(()=>document.getElementById('btn-estop').click());await shot('estop');await page.evaluate(()=>document.getElementById('btn-estop').click());
 await page.evaluate(()=>document.getElementById('m-clean')?.click());await shot('clean');await page.evaluate(()=>document.getElementById('mobile-visibility').click());
 await page.evaluate(()=>PhotoEyeDemo.start());await page.waitForTimeout(6000);await shot('photoeye');
 await page.evaluate(()=>document.getElementById('m-demo-exit')?.click());await page.waitForFunction(()=>!PhotoEyeDemo.active,null,{timeout:60000});await page.waitForTimeout(1500);await shot('photoeye-exit');
 await page.evaluate(()=>startOverspeedFault(document.getElementById('btn-overspeed')));await page.waitForFunction(()=>ovsDemo.stage==='rope-break'||ovsDemo.stage==='runaway',null,{timeout:60000});await page.waitForTimeout(1200);await shot('ovs');
 console.log(JSON.stringify({out,errors}));
}finally{await browser.close();server.close();}
