// Live Server: node tools/verify_background_modes.mjs [--mobile]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const mobile=process.argv.includes('--mobile'),out='.shot-background-modes';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
const page=await browser.newPage({viewport:mobile?{width:390,height:850}:{width:1280,height:850},hasTouch:mobile,isMobile:mobile});
page.setDefaultTimeout(90000);
const errors=[],tag=mobile?'mobile':'desktop';
page.on('pageerror',e=>errors.push(e.stack));
const state=()=>page.evaluate(()=>({space:outdoorPresentation.inCabin,texture:scene.background.isTexture===true,
 logo:!document.getElementById('background-branch-logo').hidden,fog:!!scene.fog}));
try {
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>CarDoor.state?.ready&&document.querySelector('#loading.hide'));
 assert.deepEqual(await state(),{space:false,texture:false,logo:true,fog:true});
 assert.ok(await page.evaluate(()=>!scene.getObjectByName('skyDome')&&!scene.getObjectByName('meadowIsland')&&!!scene.getObjectByName('studioGround')));
 await page.screenshot({path:`${out}/${tag}-overview.png`});
 // The containing menu is closed after cabin entry.
 if(mobile){await page.tap('#m-view');await page.tap('#m-cabin');}
 else {await page.click('#c-shaft');await page.click('#c-cabin');}
 await page.waitForFunction(()=>cabinFollow&&!cabinFollow.entering&&outdoorPresentation.inCabin);
 assert.deepEqual(await state(),{space:true,texture:true,logo:false,fog:false});
 await page.screenshot({path:`${out}/${tag}-cabin-front.png`});
 // Look through the panoramic rear/side glazing while staying inside the car.
 await page.evaluate(()=>{controls.enableDamping=false;camera.position.z=CAR_CTR_Z;controls.target.set(camera.position.x,camera.position.y+.15,camera.position.z-1);controls.update();});
 await page.screenshot({path:`${out}/${tag}-cabin-space.png`});
 const panorama=await page.evaluate(()=>{window.firstSpace=outdoorPresentation.spaceBackground;return [firstSpace.image.width,firstSpace.image.height];});
 assert.deepEqual(panorama,[2048,1024]);
 // Releasing and zooming outside must never expose space in the general view.
 await page.evaluate(()=>{camera.position.x=S.CAR_W;controls.target.x=0;controls.update();});
 await page.waitForFunction(()=>!outdoorPresentation.inCabin);
 assert.equal((await state()).logo,true);
 await page.evaluate(()=>{leaveCabinView();enterCabinView();});
 await page.waitForFunction(()=>outdoorPresentation.inCabin&&!cabinFollow.entering);
 assert.ok(await page.evaluate(()=>outdoorPresentation.spaceBackground===firstSpace));
 await page.evaluate(()=>{leaveCabinView();setBranchLogoVisible(false);});
 await page.waitForFunction(()=>!outdoorPresentation.inCabin);
 assert.deepEqual(await state(),{space:false,texture:false,logo:false,fog:true});
 await page.evaluate(()=>document.getElementById('c-background').click());
 assert.equal((await state()).logo,true);
 await page.evaluate(()=>moveCam(...overviewCameraPose().position,...overviewCameraPose().target,false));
 await page.waitForTimeout(1400);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({tag,panorama,errors,result:'PASS'}));
} finally {await browser.close();}
