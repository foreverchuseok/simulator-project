// Live Server: node tools/verify_demo_opposite.mjs [--mobile | --phone].
// Exercises completed result states and the existing cancel/start paths; accelerates timeline waits only.
﻿import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const phone=process.argv.includes('--phone'),mobile=phone||process.argv.includes('--mobile'),out='.shot-demo-opposite';
fs.mkdirSync(out,{recursive:true});
const b=phone?await chromium.connectOverCDP('http://127.0.0.1:9222'):await chromium.launch({args:['--enable-gpu','--use-angle=d3d11']});
const c=phone?b.contexts()[0]:await b.newContext({viewport:{width:mobile?390:1280,height:850},isMobile:mobile,hasTouch:mobile});
const p=phone?c.pages().find(p=>p.url().includes('localhost:5500')):await c.newPage();p.setDefaultTimeout(90000);const d=await c.newCDPSession(p),errors=[],checks=[];p.on('pageerror',e=>{errors.push(e.stack);console.log('PAGE ERROR',e.message);});await d.send('Network.setCacheDisabled',{cacheDisabled:true});
await p.route(/^https:\/\//,r=>{const f='temporary/background-phone/vendor/'+new URL(r.request().url()).pathname.split('/').at(-1);return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:'text/javascript'}):r.continue();});
const touch=(type,points=[])=>d.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
const tap=async s=>{if(!phone)return p.locator(s)[mobile?'tap':'click']();const r=await p.locator(s).boundingBox();assert.ok(r,s);await touch('touchStart',[[r.x+r.width/2,r.y+r.height/2]]);await p.waitForTimeout(80);await touch('touchEnd');await p.waitForTimeout(250);};
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);};
const state=key=>p.evaluate(key=>{const s=key==='door'?UCMDemo.state:key==='up'?AscentDemo.state:BrakeDemo.state;return{active:s.active,stage:s.stage,mode:s.mode};},key);
const active=async(key,mode)=>p.waitForFunction(({key,mode})=>{const s=key==='door'?UCMDemo.state:key==='up'?AscentDemo.state:BrakeDemo.state;return s.active&&s.mode===mode;},{key,mode});
const done=key=>p.waitForFunction(key=>{const s=key==='door'?UCMDemo.state:key==='up'?AscentDemo.state:BrakeDemo.state;return s.active&&(key==='brake'?['held','paused'].includes(s.stage):s.stage==='done')&&!document.getElementById('demo-compare-next').hidden;},key);
const idle=()=>p.waitForFunction(()=>!DemoExit.active&&!DemoExit.busy&&!moving&&!estop&&CarDoor.secured());
try{
await p.goto(phone?'http://localhost:5500/index.html':'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});await p.bringToFront();await p.waitForFunction(()=>govHandles()?.ready&&CarDoor.secured()&&document.querySelector('#loading.hide'));
await p.evaluate(()=>{window.oppositeToken='same-page';gsap.globalTimeline.timeScale(4);window.oppositeSum=carGrp.position.y+cwtGrp.position.y;});
check('no opposite button initially',!await p.locator('#demo-compare-next').isVisible());
for(const [key,first,opposite]of [['door','normal','none'],['up','normal','none'],['brake','dual','single']]){
 await idle();await p.evaluate(({key,mode})=>document.querySelector(`#demo-options-${key} [data-demo-mode="${mode}"]`).click(),{key,mode:first});await active(key,first);
 check(key+' no offer before completion',!await p.locator('#demo-compare-next').isVisible());
 await done(key);check(key+' offers opposite result',await p.getAttribute('#demo-compare-next','data-demo-mode')===opposite);
 await p.screenshot({path:out+`/${phone?'phone':mobile?'mobile':'pc'}-${key}-first.png`});
 if(key==='brake')await p.evaluate(()=>DemoPause.set(true));
 await tap('#demo-compare-next');await active(key,opposite);
 check(key+' switches with no menu or reload',await p.evaluate(()=>!DemoPause.paused&&!document.querySelector('#m-demo.open')&&window.oppositeToken==='same-page'));
 await done(key);check(key+' offers reverse comparison',await p.getAttribute('#demo-compare-next','data-demo-mode')===first);
 await p.screenshot({path:out+`/${phone?'phone':mobile?'mobile':'pc'}-${key}-opposite.png`});
 if(key==='up'){
  await tap('#demo-exit');await idle();await p.waitForFunction(()=>!document.getElementById('demo-compare-next').hidden);
  check('completed comparison remains after exit',await p.getAttribute('#demo-compare-next','data-demo-mode')===first);
 }
 await tap('#demo-compare-next');await active(key,first);check(key+' reverse starts correct mode',(await state(key)).mode===first);
 await p.evaluate(()=>DemoExit.cancel());await idle();await p.waitForTimeout(250);
 check(key+' early exit has no completion offer',!await p.locator('#demo-compare-next').isVisible());
 check(key+' car and counterweight restored',await p.evaluate(()=>Math.abs(carGrp.position.y+cwtGrp.position.y-oppositeSum)<1e-5));
}
await p.evaluate(()=>PhotoEyeDemo.start());await p.waitForFunction(()=>PhotoEyeDemo.active);check('other demos have no opposite button',!await p.locator('#demo-compare-next').isVisible());await tap('#demo-exit');await idle();check('other demo exit has no offer',!await p.locator('#demo-compare-next').isVisible());
await p.evaluate(()=>{gsap.globalTimeline.timeScale(1);});check('no browser errors',errors.length===0);fs.writeFileSync(out+`/${phone?'phone':mobile?'mobile':'pc'}-report.json`,JSON.stringify({checks,errors},null,2));
}catch(e){await p.screenshot({path:out+`/${phone?'phone':mobile?'mobile':'pc'}-failure.png`}).catch(()=>{});console.error('TEST ERROR',e.message);console.error(await p.evaluate(()=>({ucm:UCMDemo.state.stage,up:AscentDemo.state.stage,brake:BrakeDemo.state.stage,active:DemoExit.active,busy:DemoExit.busy,hidden:document.getElementById('demo-compare-next').hidden,mode:document.getElementById('demo-compare-next').dataset.demoMode,paused:DemoPause.paused,moving,estop})).catch(()=>null));throw e;}
finally{await p.unrouteAll();await b.close();}

