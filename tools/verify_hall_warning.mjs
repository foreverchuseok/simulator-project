import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket('**',ws=>ws.close());
 await page.addInitScript(()=>{
  window.hallVoice={requests:0,started:0,ended:0,failed:0};
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){
   if(this.src.includes('announce_hall_warning.mp3')){
    hallVoice.requests++;window.hallVoiceClip=this;
    this.addEventListener('playing',()=>hallVoice.started++,{once:true});
    this.addEventListener('ended',()=>hallVoice.ended++,{once:true});
    return play.call(this).catch(e=>{hallVoice.failed++;throw e;});
   }
   return play.call(this);
  };
 });
 await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready)&&getComputedStyle(document.getElementById('loading')).opacity==='0');
 for(const f of [0,1,2]){
  await page.evaluate(f=>HallManual.pick(f),f);await page.tap('#hall-half');
  await page.waitForFunction(()=>HallManual.phase==='holding');
  assert.equal(await page.evaluate(()=>hallVoice.requests),f===2?1:0);
 }
 await page.waitForFunction(()=>hallVoice.ended===1);
 assert.equal(await page.evaluate(()=>hallVoiceClip.error),null);
 await page.tap('#hall-half');await page.waitForFunction(()=>!HallManual.busy);
 assert.equal(await page.evaluate(()=>hallVoice.requests),1);
 await page.tap('#hall-open');await page.waitForFunction(()=>hallVoice.ended===2);
 await page.tap('#hall-close');await page.waitForFunction(()=>HallManual.phase==='idle');
 const result=await page.evaluate(()=>({...hallVoice,duration:hallVoiceClip.duration}));
 assert.deepEqual({...result,duration:0},{requests:2,started:2,ended:2,failed:0,duration:0});
 assert.deepEqual(errors,[]);console.log('PASS: same/below silent, absent half/full audio, no repeated idle/close audio.',result);
}finally{await browser.close();}
