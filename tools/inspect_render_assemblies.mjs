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
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>govHandles()?.ready&&carGrp.userData.safetyGear?.wedges.length===4&&document.getElementById('loading').classList.contains('hide'));
 const tree=await page.evaluate(()=>{
  function inspect(o,depth){let meshes=0;const mats=new Set();o.traverse(m=>{if(m.isMesh){meshes++;[].concat(m.material).forEach(a=>mats.add(a.uuid));}});return {name:o.name||o.type,meshes,materials:mats.size,children:depth?o.children.filter(c=>c.children.length).map(c=>inspect(c,depth-1)).filter(c=>c.meshes>25):o.children.slice(0,5).map(c=>c.name||c.type)};}
  return inspect(scene,3);
 });fs.writeFileSync(path.join(out,'assembly-tree.json'),JSON.stringify(tree,null,2));console.log(JSON.stringify(tree));
}finally{await browser?.close();await new Promise(r=>server.close(r));}