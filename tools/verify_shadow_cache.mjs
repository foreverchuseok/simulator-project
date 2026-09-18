// Same quality before/after; desktop measurements are not tablet performance results.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
const label=process.argv[2]||'current';
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('Use an alphanumeric report label');
const root=process.cwd(),out=path.join(root,'.shot-render-performance');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const errors=[];
try{
 browser=await chromium.launch({args:['--enable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 await page.addInitScript(()=>{let seed=20260918;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 const session=await page.context().newCDPSession(page);
 await session.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(process.env.SIMULATOR_URL||`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));
 const result=await page.evaluate(async()=>{
  const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow);
  const original=renderer.shadowMap.render;
  let updates=0;
  renderer.shadowMap.render=function(...args){if(this.enabled&&(this.autoUpdate||this.needsUpdate))updates++;return original.apply(this,args);};
  const draw=()=>renderer.render(scene,camera);
  draw();draw();const idleStart=updates;for(let i=0;i<10;i++)draw();
  const idleUpdates=updates-idleStart;
  const savedCamera=camera.position.clone();camera.position.x+=1;draw();
  const orbitUpdates=updates-idleStart;camera.position.copy(savedCamera);
  const a=new Uint8Array(sun.shadow.map.width*sun.shadow.map.height*4),b=new Uint8Array(a.length);
  const cases=[];
  function compare(name,change,restore){
   const start=updates;change();draw();const changedUpdates=updates-start;
   renderer.readRenderTargetPixels(sun.shadow.map,0,0,sun.shadow.map.width,sun.shadow.map.height,a);
   renderer.shadowMap.needsUpdate=true;draw();
   renderer.readRenderTargetPixels(sun.shadow.map,0,0,sun.shadow.map.width,sun.shadow.map.height,b);
   let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;
   cases.push({name,changedUpdates,different});restore();draw();
  }
  const cy=carGrp.position.y,wy=cwtGrp.position.y;
  compare('car-counterweight-ropes',()=>{carGrp.position.y+=.4;cwtGrp.position.y-=.4;refreshRopes();},()=>{carGrp.position.y=cy;cwtGrp.position.y=wy;refreshRopes();});
  compare('cutaway',()=>setOVSCutaway(true),()=>setOVSCutaway(false));
  const visible=railGrp.visible;
  compare('parent-hidden',()=>{railGrp.visible=false;},()=>{railGrp.visible=visible;});
  const g=new THREE.BoxGeometry(.2,.2,.2),m=M.ss(),mesh=new THREE.Mesh(g,m);mesh.castShadow=true;
  compare('late-model-added',()=>scene.add(mesh),()=>scene.remove(mesh));g.dispose();m.dispose();
  const rope=ropeObjs[0].line.geometry.attributes.position,oldX=rope.getX(0);
  compare('geometry-buffer',()=>{rope.setX(0,oldX+.1);rope.needsUpdate=true;},()=>{rope.setX(0,oldX);rope.needsUpdate=true;});
  const sx=sun.position.x;
  compare('light-position',()=>{sun.position.x+=1;},()=>{sun.position.x=sx;});
  draw();const end=updates;for(let i=0;i<10;i++)draw();
  return {idleUpdates,orbitUpdates,settledUpdates:updates-end,cases,shadowSize:[sun.shadow.map.width,sun.shadow.map.height],shadows:renderer.shadowMap.enabled};
 });
 console.log(JSON.stringify(result));
 assert.equal(result.idleUpdates,0);assert.equal(result.orbitUpdates,0);assert.equal(result.settledUpdates,0);
 for(const c of result.cases){assert.equal(c.changedUpdates,1,c.name);assert.equal(c.different,0,c.name);}
 await page.screenshot({path:path.join(out,label+'-shadow-cache.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,label+'-shadow-cache.json'),JSON.stringify({result,errors},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
