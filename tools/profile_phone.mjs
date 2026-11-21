// 연결한 안드로이드 Chrome 탭(5500)의 JS CPU 프로파일을 떠서 함수별 자체 시간을 보여 준다 (2026-11-21 최적화 근거).
// node tools/profile_phone.mjs [--seconds=6] [--label=idle]   → temporary/fps/profile-<label>.json
// 먼저 tools/measure_fps.mjs --phone 등으로 휴대폰에 페이지를 띄워 둔다. 측정 중에는 화면을 건드리지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith(`--${k}=`));return a?a.slice(k.length+3):d;};
const seconds=+arg('seconds','6'),label=arg('label','current');
const out=path.join(process.cwd(),'temporary/fps');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP(process.env.PHONE_CDP_URL||'http://127.0.0.1:9223');
try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes(':5500'));
  if(!page)throw new Error('휴대폰에 5500 탭이 없다');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});
  await cdp.send('Profiler.start');await new Promise(r=>setTimeout(r,seconds*1000));
  const {profile}=await cdp.send('Profiler.stop');
  const total=profile.endTime-profile.startTime,per=total/profile.samples.length/1000;   // ms/샘플
  const self=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));
  const counts=new Map();for(const s of profile.samples)counts.set(s,(counts.get(s)||0)+1);
  for(const [id,c] of counts){const n=byId.get(id),f=n.callFrame,key=`${f.functionName||'(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber+1}`;self.set(key,(self.get(key)||0)+c*per);}
  const rows=[...self].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,ms])=>({fn:k,ms:+ms.toFixed(1),pct:+(ms/(total/1000)*100).toFixed(1)}));
  fs.writeFileSync(path.join(out,`profile-${label}.json`),JSON.stringify({seconds:total/1e6,rows},null,1));
  for(const r of rows.slice(0,30))console.log(String(r.pct).padStart(5)+'%',String(r.ms).padStart(7)+'ms',r.fn);
}finally{try{await browser.close();}catch{}}
