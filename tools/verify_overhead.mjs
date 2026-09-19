import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Run against Live Server; old dimensions are served only inside the baseline browser page.
const out='.shot-overhead';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--enable-gpu']});
const errors=[],results=[];
try {
 for(const old of [true,false]) {
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  if(old)await page.route('**/index.html',async route=>{
   const response=await route.fetch();let body=await response.text();
   body=body.replace('const OVERHEAD = 4.77;','const OVERHEAD = 3.7;').replace(', Y0 + TOTAL_H - 0.65];','];');
   await route.fulfill({response,body});
  });
  await page.goto(process.env.SIMULATOR_URL||'http://127.0.0.1:5500/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>govHandles()?.ready&&ropeObjs.length===5&&railGrp.children.length>=12&&document.getElementById('loading').classList.contains('hide'));
  const result=await page.evaluate(()=>{
   const initialCwt=cwtGrp.position.y;
   const dy=FLOOR_Y.at(-1)+S.CAR_H/2-carGrp.position.y;
   carGrp.position.y+=dy;cwtGrp.position.y-=dy;refreshRopes();refreshGovernorRope();refreshTerminalDevices();scene.updateMatrixWorld(true);
   const box=name=>{const b=new THREE.Box3().setFromObject(scene.getObjectByName(name));return {min:b.min.toArray(),max:b.max.toArray()};};
   const mr=[];mrGrp.traverse(o=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);mr.push({name:o.name,min:b.min.toArray(),max:b.max.toArray()});}});
   const rail=[];railGrp.traverse(o=>{if(o.isMesh&&o.name.startsWith('T_Rail_')){const b=new THREE.Box3().setFromObject(o);rail.push(b.max.y);}});
   const roof=carGrp.position.y+S.CAR_H/2;
   controls.enableDamping=false;controls.target.set(0,roof+.5,CAR_CTR_Z);camera.position.set(8,roof+2,-10);controls.update();
   return {floor:FLOOR_Y,initialCwt,cwt:cwtGrp.position.y,car:carGrp.position.y,ceiling:SHAFT_CEIL_Y,roof,roofGap:SHAFT_CEIL_Y-roof,handrail:box('carHandrail'),junction:box('carCableJunction'),mr,railTop:Math.max(...rail),mainY:mrGrp.userData.mainY,defY:mrGrp.userData.defY,govTop:govRopeData.topY,govBottom:govRopeData.botY,terminal:TERMINAL_SWITCHES,brackets:RAIL_BRACKET_Y};
  });
  await page.screenshot({path:out+'/'+(old?'before.png':'after.png')});results.push(result);await page.close();
 }
 const [a,b]=results,delta=1.07,near=(x,y)=>assert.ok(Math.abs(x-y)<2e-5,JSON.stringify({x,y}));
 for(const key of ['floor','initialCwt','cwt','car','handrail','junction','terminal','govBottom'])assert.deepEqual(b[key],a[key],key+' must stay fixed');
 for(const key of ['ceiling','railTop','mainY','defY','govTop'])near(b[key]-a[key],delta);
 near(b.roofGap,2.17);assert.ok(b.ceiling-b.handrail.max[1]>1.2);
 assert.equal(a.mr.length,b.mr.length);
 for(let i=0;i<a.mr.length;i++)for(const side of ['min','max'])for(let axis=0;axis<3;axis++)near(b.mr[i][side][axis]-a.mr[i][side][axis],axis===1?delta:0);
 assert.equal(b.brackets.length,a.brackets.length+1);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({beforeGap:a.roofGap,afterGap:b.roofGap,handrailGap:b.ceiling-b.handrail.max[1],machineRoomMeshes:b.mr.length,railTop:b.railTop,errors}));
}finally{await browser.close();}
