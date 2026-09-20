// 카 고정 배선 전용. 모든 경로는 카 로컬 좌표이며 운행/접점 로직과 독립적이다.
const CarWiring = (() => {
  let layout, topBox, jacket, clips;
  const circuits=Object.freeze(['safety','accessible','travel','load','opb','beacon','door']);
  const entry=Object.freeze({holeRadius:.025,bundleRadius:.012,endY:-.299});
  function init(box, {sideX, frontZ}) {
    topBox=box;
    layout={sideX, frontZ, edgeX:sideX-.05, outerX:S.CAR_W/2+.022,
      rearZ:-S.CAR_D/2+.085, frontLane:frontZ-.035,
      roofY:S.CAR_H/2+.045, overY:S.CAR_H/2+.135, underY:-S.CAR_H/2-.115};
    jacket=M.paint(0x030405);jacket.roughness=.9;jacket.clearcoat=0;jacket.metalness=0;
    clips=M.ss(0x899298);
  }
  function endpoint(id) {
    const i=circuits.indexOf(id),a=(i-1)*Math.PI/3+Math.PI/18;
    return [topBox.position.x+(i?Math.cos(a)*entry.bundleRadius:0),topBox.position.y+entry.endY,
      topBox.position.z+(i?Math.sin(a)*entry.bundleRadius:0)];
  }
  // 실제 구멍을 가진 판. XY 평면, +Z 두께. 바닥판은 X축으로 90° 회전한다.
  function plate(w,h,t,holes,material) {
    const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);
    s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();
    for(const [x,y,r] of holes){const hole=new THREE.Path();hole.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(hole);}
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:16}),material);
  }
  function entryPlate(metal,dark) {
    const p=plate(.132,.392,.004,[[0,0,entry.holeRadius]],metal);
    p.name='topBoxEntryPlate';p.rotation.x=Math.PI/2;p.position.y=-.306;topBox.add(p);
    const g=new THREE.Group();g.name='topBoxBundleEntry';g.position.y=-.31;topBox.add(g);
    // 보호 부시는 박스의 단일 인입구에만 둔다. 나머지는 검은 전선이다.
    const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.025,24,1,true),dark);
    sleeve.position.y=-.009;g.add(sleeve);
    for(const y of [0,-.022]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.027,.003,6,24),dark);
      ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring);
    }
    const tie=new THREE.Mesh(new THREE.TorusGeometry(entry.bundleRadius+.005,.0015,4,20),jacket);
    tie.name='topBoxBundleTie';tie.rotation.x=Math.PI/2;tie.position.y=-.043;g.add(tie);
    g.userData={type:'car-bundle-entry',holeRadius:entry.holeRadius,circuits:[...circuits]};
    topBox.userData.entryHole={center:[topBox.position.x,topBox.position.y-.31,topBox.position.z],radius:entry.holeRadius};
    topBox.userData.entries=Object.fromEntries(circuits.map(id=>[id,endpoint(id)]));
  }
  function serviceEntry(parent,skin,point,axis,material) {
    parent.updateMatrixWorld(true);
    const local=skin.worldToLocal(parent.localToWorld(new THREE.Vector3(...point)));
    const {width,height,depth}=skin.geometry.parameters;
    const replacement=plate(width,height,depth,[[local.x,local.y,.009]],skin.material);
    replacement.geometry.translate(0,0,-depth/2);skin.geometry.dispose();skin.geometry=replacement.geometry;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.009,.003,6,12),material);
    ring.name='opbServiceGrommet';ring.position.set(...point);
    if(axis==='x')ring.rotation.y=Math.PI/2;
    parent.add(ring);
  }
  function run(parent,name,points,{radius=.0025,bend=.02,supports=true}={}) {
    const pts=points.map(p=>new THREE.Vector3(...p)).filter((p,i,a)=>!i||p.distanceTo(a[i-1])>1e-7);
    const curve=new THREE.CurvePath();let last=pts[0];
    for(let i=1;i<pts.length-1;i++){
      const p=pts[i],r=Math.min(bend,p.distanceTo(pts[i-1])*.3,p.distanceTo(pts[i+1])*.3);
      const a=p.clone().addScaledVector(pts[i-1].clone().sub(p).normalize(),r);
      const b=p.clone().addScaledVector(pts[i+1].clone().sub(p).normalize(),r);
      curve.add(new THREE.LineCurve3(last,a));curve.add(new THREE.QuadraticBezierCurve3(a,p,b));last=b;
    }
    curve.add(new THREE.LineCurve3(last,pts.at(-1)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(32,Math.ceil(curve.getLength()/.025)),radius,8,false),jacket);
    mesh.name=name;mesh.userData={type:'car-fixed-wire',route:points,radius,endpoint:points.at(-1)};parent.add(mesh);
    if(supports){
      const locations=[];
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i],length=a.distanceTo(b),n=Math.floor(length/.32);
        for(let j=1;j<=n;j++)locations.push({p:a.clone().lerp(b,j/(n+1)),d:b.clone().sub(a).normalize()});
      }
      if(locations.length){
        const saddles=new THREE.InstancedMesh(new THREE.TorusGeometry(radius+.0015,.002,4,8),clips,locations.length);
        saddles.name=name+'Clips';const dummy=new THREE.Object3D();
        locations.forEach(({p,d},i)=>{dummy.position.copy(p);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);dummy.updateMatrix();saddles.setMatrixAt(i,dummy.matrix);});
        parent.add(saddles);
        const feet=[];
        for(const {p,d} of locations){
          if(Math.abs(p.y-layout.roofY)<1e-6&&Math.abs(d.y)<.01){
            feet.push({p:[p.x,S.CAR_H/2+.019,p.z],s:[.014,.038,.014]});
          }else if(Math.abs(Math.abs(p.x)-layout.outerX)<1e-6&&p.y>-S.CAR_H/2&&p.y<S.CAR_H/2){
            const length=layout.outerX-layout.sideX;
            feet.push({p:[Math.sign(p.x)*(layout.sideX+length/2),p.y,p.z],s:[length,.012,.014]});
          }
        }
        if(feet.length){
          const mounts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),clips,feet.length);mounts.name=name+'Mounts';
          dummy.quaternion.identity();
          feet.forEach(({p,s},i)=>{dummy.position.set(...p);dummy.scale.set(...s);dummy.updateMatrix();mounts.setMatrixAt(i,dummy.matrix);});parent.add(mounts);
        }
      }
    }
    return mesh;
  }
  // 도어와 안전장치는 전/후에서 서로 다른 구간으로 접근하므로 같은 레인을 사용한다.
  function laneX(id){return -layout.edgeX+((id==='door'?0:circuits.indexOf(id))-2.5)*.013;}
  // 모서리 경로 유지. 박스 바로 아래에서 전선을 한 원형 인입구로 모은다.
  function toBox(id) {
    const e=endpoint(id),q=layout,i=circuits.indexOf(id),gatherY=q.overY+i*.009;
    return [[laneX(id),q.roofY,e[2]],[laneX(id),gatherY,e[2]],[e[0],gatherY,e[2]],e];
  }
  function leftRiser(id,z) {
    const q=layout;
    return [[-q.outerX,q.underY,z],[-q.outerX,q.overY,z],[laneX(id),q.overY,z],
      [laneX(id),q.roofY,z],...toBox(id)];
  }
  return {init,plate,entryPlate,serviceEntry,run,endpoint,toBox,leftRiser,laneX,get layout(){return layout;}};
})();
