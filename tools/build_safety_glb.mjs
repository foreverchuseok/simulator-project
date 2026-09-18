// 하부 설계도: 열린 절곡 프레임과 양면 흑색 삼각 쐐기. node tools/build_safety_glb.mjs
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const shared=readFileSync(new URL('../js/safety-device.js',import.meta.url),'utf8');
const geometry=vm.runInNewContext(shared+'; safetyDeviceDimensions');
const config=readFileSync(new URL('../js/config.js',import.meta.url),'utf8');
const value=name=>Number(config.match(new RegExp(name+':\\s*([0-9.]+)'))[1]);
const d=geometry(value('CAR_H'),value('CAR_BG'));
const railFile=readFileSync(new URL('../models/gltf/car_guide_shoe.glb',import.meta.url));
const railJson=JSON.parse(railFile.subarray(20,20+railFile.readUInt32LE(12)).toString());
const railHalf=railJson.nodes.find(n=>n.name==='GuideShoeRoot').extras.railHalfWidth;
const wedgeCenter=railHalf+d.closure+d.wedgeThickness/2;
const lowerY=d.baseY+0.008-d.wedgeHeight/2;
const capT=0.026,baseT=0.020,wallT=0.006;
const z0=d.railZ-d.housingHalfDepth,z1=d.railZ+d.housingHalfDepth;
const slotHalf=railHalf+0.009,width=d.housingOuterX-d.housingInnerX;
const material=(color,metalness=0.35,roughness=0.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const mat={frame:material(0x586d76),steel:material(0x9da8ac),wedge:material(0x101418,0.12,0.82),
 groove:material(0x020304,0.05,0.95),guide:material(0x354147),bolt:material(0x454d51)};
Object.values(mat).forEach(m=>m.color.convertSRGBToLinear());
const root=new THREE.Group();root.name='SafetyGear';
root.userData={design:'open-folded-frame-paired-wedges',railHalfWidth:railHalf,wedgeSlope:d.wedgeSlope,restClearance:d.closure};
function box(w,h,depth,m,x,y,z,parent=root,name=''){
 const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),m);o.position.set(x,y,z);o.name=name;parent.add(o);return o;
}
function cyl(r,len,m,x,y,z,parent=root,axis='y',segments=16){
 const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,segments),m);o.position.set(x,y,z);
 if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;parent.add(o);return o;
}
function bolt(x,y,z,parent=root,axis='y'){
 cyl(0.007,0.002,mat.steel,x,y,z,parent,axis);
 const p={x,y,z};p[axis]+=0.003;cyl(0.0055,0.006,mat.bolt,p.x,p.y,p.z,parent,axis,6);
}
function outline(mesh){
 // 얇은 모서리 선으로 절곡판 두께를 읽을 수 있게 한다. 장면 조명은 유지한다.
 mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:0x273338})));
}
function finishWedgeGeometry(g,sign){
 // Z를 뒤집은 쐐기도 바깥면이 앞면이 되도록 삼각형 순서를 반전한다.
 if(sign<0){const a=g.index.array;for(let i=0;i<a.length;i+=3)[a[i+1],a[i+2]]=[a[i+2],a[i+1]];}
 g.computeVertexNormals();
}
const shaft=new THREE.Group();shaft.name='shaft';shaft.position.set(0,d.baseY,-0.15);root.add(shaft);
for(const [tag,sign] of [['L',-1],['R',1]]){
 const centerX=sign*(d.housingInnerX+d.housingOuterX)/2,bx=sign*d.railX;
 const housing=new THREE.Group();housing.name='safetyOpenHousing'+tag;root.add(housing);
 // 레일 통로가 열린 U자 상하판. 기존 하부 가이드슈 장착면 보존.
 for(const [cy,t] of [[d.capTopY-capT/2,capT],[d.capBottomY+baseT/2,baseT]]){
  for(const [a,b] of [[z0,d.railZ-slotHalf],[d.railZ+slotHalf,z1]]){
   const plate=box(width,t,b-a,mat.frame,centerX,cy,(a+b)/2,housing,'safetySlottedCap');outline(plate);
  }
  const innerEnd=d.railX-0.020;
  box(innerEnd-d.housingInnerX,t,2*slotHalf,mat.frame,sign*(innerEnd+d.housingInnerX)/2,cy,d.railZ,housing);
  for(const zz of [z0+0.020,z1-0.020])bolt(centerX,cy+t/2+0.001,zz,housing);
 }
 // 끝단 리턴만 세워서 내부 삼각 쐐기와 리프트를 가리지 않는다.
 for(const zz of [z0+wallT/2,z1-wallT/2]){
  const frame=box(0.014,0.25,wallT,mat.frame,sign*(d.housingOuterX-0.007),d.baseY,zz,housing,'safetyFoldedReturn');outline(frame);
  for(const yy of [-0.105,0.105]){
   box(width,0.020,wallT,mat.frame,centerX,d.baseY+yy,zz,housing);
   bolt(sign*(d.housingInnerX+0.018),d.baseY+yy,zz-0.004,housing,'z');
  }
 }
 // 경사 받침판도 공용 쐐기 경사를 따른다.
 for(const [index,zs] of [[0,-1],[1,1]]){
  const gh=d.wedgeHeight+d.lift+0.002,g=new THREE.BoxGeometry(d.wedgeWidth,gh,1),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const y=lowerY+p.getY(i)+gh/2;
   const inner=railHalf+d.closure+d.wedgeThickness-d.wedgeSlope*(y-lowerY);
   p.setZ(i,zs*(inner+(p.getZ(i)>0?0.007:0)));
  }
  finishWedgeGeometry(g,zs);const guide=new THREE.Mesh(g,mat.guide);
  guide.position.set(bx,lowerY+gh/2,d.railZ);guide.name='wedgeGuide'+tag+index;housing.add(guide);outline(guide);
 }
 const lift=new THREE.Group();lift.name='lift'+tag;root.add(lift);
 for(const [index,zs] of [[0,-1],[1,1]]){
  // 접촉면은 수직, 바깥면만 기울어진 삼각 단면. 각 레일 앞뒤에 한 개씩.
  const g=new THREE.BoxGeometry(d.wedgeWidth,d.wedgeHeight,1,24,72,1),p=g.attributes.position;
  const grain=[];
  for(let i=0;i<p.count;i++){
   const t=d.wedgeThickness-(p.getY(i)+d.wedgeHeight/2)*d.wedgeSlope;
   p.setZ(i,zs*(-d.wedgeThickness/2+(p.getZ(i)>0?t:0)));
   const n=Math.abs(Math.sin(p.getX(i)*8731+p.getY(i)*38217+p.getZ(i)*7183)*43758.5453)%1;
   const v=0.65+n*0.7;grain.push(v,v,v);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(grain,3));mat.wedge.vertexColors=true;
  finishWedgeGeometry(g,zs);const w=new THREE.Mesh(g,mat.wedge);w.name='wedge'+tag+index;
  w.position.set(bx,d.baseY+0.008,d.railZ+zs*wedgeCenter);
  w.userData={type:'safetyWedge',side:tag,railFace:zs};lift.add(w);
  // 노출 측면 가공 홈. 레일 접촉면은 평면으로 유지한다.
  for(let k=1;k<18;k++){
   const y=-d.wedgeHeight/2+k*d.wedgeHeight/18,t=d.wedgeThickness-(y+d.wedgeHeight/2)*d.wedgeSlope;
   for(const xs of [-1,1])box(0.00035,0.0014,Math.max(0.001,t-0.0015),mat.groove,
    xs*(d.wedgeWidth/2+0.0001),y,zs*(-d.wedgeThickness/2+t/2),w,'safetyWedgeSerration');
  }
  // 쐐기 측면에 실제로 체결된 인상 귀. 핀은 쐐기와 함께 Z로 이동하고,
  // 리프트의 횡방향 장공이 그 접근량을 허용한다 (떠 있는 캐리어 제거).
  const lugX=-sign*(d.wedgeWidth/2+0.003),pinY=d.carrierY-w.position.y;
  const lugZ=zs*(-d.wedgeThickness/2+0.008);
  box(0.006,0.059,0.012,mat.steel,lugX,pinY-0.022,lugZ,w,'safetyWedgePullLug');
  for(const yy of [pinY-0.043,pinY-0.027])bolt(lugX,yy,lugZ,w,'x');
  const pullPin=cyl(0.004,0.022,mat.bolt,lugX,pinY,lugZ,w,'x');pullPin.name='safetyWedgePullPin';
  pullPin.userData={side:tag,index};
  const pinZ=d.railZ+zs*(railHalf+d.closure+0.008);
  const slotZ=pinZ-zs*d.closure/2,slotL=d.closure+0.013;
  const forkX=bx+lugX-sign*0.007;
  const fork=new THREE.Group();fork.name='safetyWedgeFork'+tag+index;lift.add(fork);
  fork.userData={pinX:bx+lugX,pinY:d.carrierY,slotZ,slotHalf:slotL/2,pinRadius:0.004};
  for(const dy of [-0.007,0.007])box(0.012,0.006,slotL+0.006,mat.steel,forkX,d.carrierY+dy,slotZ,fork);
  for(const dz of [-slotL/2-0.003,slotL/2+0.003])box(0.012,0.020,0.006,mat.steel,forkX,d.carrierY,slotZ+dz,fork);
  // 미세한 피트/교차 가공면을 메시 색·노멀에 새긴다. 접촉 최대면은 유지하여 레일 관통 없음.
  const surface=new THREE.PlaneGeometry(d.wedgeWidth-0.001,d.wedgeHeight-0.002,48,112);
  const sp=surface.attributes.position,colors=[];
  for(let i=0;i<sp.count;i++){
    const x=sp.getX(i),y=sp.getY(i);
    const noise=Math.abs(Math.sin(i*127.1+tag.charCodeAt(0)*31.7)*43758.5453)%1;
    const cut=Math.pow(Math.abs(Math.sin((y+x*0.31)*4600)),12);
    sp.setZ(i,0.000015-(0.00010*noise+0.00016*cut));
    const shade=0.045+0.042*noise;colors.push(shade,shade*1.06,shade*1.10);
  }
  surface.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));surface.computeVertexNormals();
  const contact=new THREE.Mesh(surface,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0.25,roughness:0.92}));
  contact.name='safetyWedgeFrictionFace';contact.position.z=-zs*d.wedgeThickness/2;
  contact.rotation.y=zs>0?Math.PI:0;w.add(contact);
  // 호환 노드만 남긴다. 영상에서 지적한 레일 안쪽 코일은 제거.
  const spring=new THREE.Group();spring.name='spring'+tag+index;root.add(spring);
 }
 box(0.008,0.010,2*wedgeCenter+0.016,mat.steel,sign*(d.railX-0.059),d.carrierY,d.railZ,lift,'safetyLiftBridge');
 for(const zs of [-1,1])box(0.025,0.010,0.016,mat.steel,sign*(d.railX-0.053),d.carrierY,
   d.railZ+zs*(railHalf+d.closure/2+0.008),lift,'safetyForkBridge');
}
class NodeFileReader{
 readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+blob.type+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}
}
globalThis.window=globalThis.window||{};globalThis.window.FileReader=NodeFileReader;
new GLTFExporter().parse(root,result=>{
 if(!(result instanceof ArrayBuffer))throw Error('Expected GLB');
 const out=new URL('../assets/safety_gear.glb',import.meta.url);writeFileSync(out,Buffer.from(result));
 console.log('WROTE',out.pathname,result.byteLength,'bytes; four wedges; clearance',d.closure);
},{binary:true,onlyVisible:true});
