// 20260909_112451/112453: raised motor plate, belt reduction and coaxial rope drum.
// Photo proportions adapted to the existing door stroke; no change to const S.
const CarDoorTransmission = (() => {
  const spec=Object.freeze({wheelR:.18,motorR:.045,drumR:.065,guideR:.050,endR:.035,
    wheelX:-.50,wheelRise:.50,motorX:.04,motorRise:.36,guideX:-.27,guideRise:.16,
    ropeR:.0014,groovePitch:.009,takeup:.014,clampX:.50});
  function build(d,f,m) {
    const p=spec,z=d.doorZ,root=f.group('carDoorTransmission',0,0,0);
    root.userData={type:'car-door-transmission',reference:'20260909_112451 / 112453',spec:p};
    const A={x:p.wheelX,y:d.trackY+p.wheelRise,r:p.drumR},B={x:p.guideX,y:d.trackY+p.guideRise,r:p.guideR};
    const motor={x:p.motorX,y:d.trackY+p.motorRise,r:p.motorR};
    const beltZ=z-.012,ropeZ=z+.009,returnZ=z-.006,endX=d.headerW/2-.07,low=B.y-B.r,high=low+2*p.endR;
    const plateBottom=d.trackY+.08,plateTop=A.y+p.wheelR+.04;
    f.box('raisedMotorPlate',.98,plateTop-plateBottom,.004,m.dark,-.30,(plateTop+plateBottom)/2,z-.035,root);
    for(const y of [plateBottom,plateTop])f.box('raisedPlateFold',.98,.004,.035,m.dark,-.30,y,z-.051,root);
    for(const x of [-.72,.12])for(const y of [plateBottom+.04,plateTop-.06])f.bolt(x,y,z-.029,root,.006);
    function wheel(name,c,r,plane,material) {
      const g=f.group(name,c.x,c.y,plane,root);
      // Five real openings leave a rim, hub and spokes, as in the reference.
      if(name==='carDoorReductionWheel') {
        const shape=new THREE.Shape();shape.absarc(0,0,r-.005,0,Math.PI*2,false);
        for(let i=0;i<5;i++){const a=i*Math.PI*2/5,h=new THREE.Path();h.absarc(Math.cos(a)*r*.60,Math.sin(a)*r*.60,r*.24,0,Math.PI*2,true);shape.holes.push(h);}
        const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,curveSegments:24}),material);
        mesh.position.z=-.004;mesh.name='reductionWheelSpokes';g.add(mesh);
      } else f.cyl(name+'Body',r-.005,.012,material,0,0,0,g,32);
      const flangeOffset=name==='carDoorRopeGuide'?.010:.007;
      for(const dz of [-flangeOffset,flangeOffset]){
        const rim=new THREE.Mesh(new THREE.TorusGeometry(r,.0025,6,64),material);rim.position.z=dz;g.add(rim);
      }
      f.cyl(name+'Hub',r*.23,.022,m.steel,0,0,.002,g,24);f.bolt(0,0,.016,g,.005);
      f.box('rotationWitness',r*.38,.002,.001,m.zinc,r*.48,0,.010,g);
      return g;
    }
    const reduction=wheel('carDoorReductionWheel',A,p.wheelR,beltZ,m.steel);
    const motorPulley=wheel('carDoorMotorPulley',motor,p.motorR,beltZ,m.dark);
    const driveMotor=f.group('carDoorMotor',motor.x,motor.y,z-.098,root);
    f.cyl('motorBody',.049,.096,m.dark,0,0,0,driveMotor,32);
    f.cyl('motorShaft',.008,.12,m.steel,0,0,.045,driveMotor);
    f.box('motorMount',.12,.13,.004,m.zinc,0,0,.052,driveMotor);
    const drum=f.group('carDoorRopeDrum',0,0,ropeZ-beltZ,reduction);
    f.cyl('ropeDrumCore',p.drumR-.002,.024,m.steel,0,0,.004,drum,48);
    for(const dz of [-.006,.018]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(p.drumR+.002,.002,6,48),m.steel);ring.position.z=dz;drum.add(ring);
    }
    const guide=wheel('carDoorRopeGuide',B,p.guideR,ropeZ+p.groovePitch/2,m.guide);
    const ends=[-1,1].map(side=>wheel('carDoorRopeEnd'+side,{x:side*endX,y:low+p.endR},p.endR,returnZ,m.steel));
    for(const side of [-1,1]){
      f.box('ropeEndBracket',.075,.12,.005,m.zinc,side*endX,low+.03,z-.018,root);
      f.bolt(side*endX,low-.018,z-.010,root,.004);
    }
    function tangent(a,b) {
      const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),base=Math.atan2(dy,dx),off=Math.acos((a.r-b.r)/L);
      return [base+off,base-off];
    }
    function pathBuilder(){
      const pts=[];
      const point=(x,y,z)=>pts.push(new THREE.Vector3(x,y,z));
      const arc=(c,from,to,z0,z1=z0,turns=0)=>{
        while(to>=from-1e-9)to-=Math.PI*2;to-=turns*Math.PI*2;
        const n=Math.ceil((from-to)*24);
        for(let i=0;i<=n;i++){const t=i/n,a=from+(to-from)*t;point(c.x+c.r*Math.cos(a),c.y+c.r*Math.sin(a),z0+(z1-z0)*t);}
      };
      const finish=()=>{const curve=new THREE.CurvePath();for(let i=1;i<pts.length;i++)if(pts[i].distanceToSquared(pts[i-1])>1e-16)curve.add(new THREE.LineCurve3(pts[i-1],pts[i]));curve.updateArcLengths();return curve;};
      return {point,arc,finish};
    }
    const beltA={...A,r:p.wheelR},[bp,bm]=tangent(beltA,motor),beltPath=pathBuilder();
    beltPath.arc(beltA,bm,bp,beltZ);
    beltPath.point(motor.x+motor.r*Math.cos(bp),motor.y+motor.r*Math.sin(bp),beltZ);
    beltPath.arc(motor,bp,bm,beltZ);
    beltPath.point(A.x+p.wheelR*Math.cos(bm),A.y+p.wheelR*Math.sin(bm),beltZ);
    const beltCurve=beltPath.finish();
    const belt=new THREE.Mesh(new THREE.TubeGeometry(beltCurve,180,.004,4,false),m.rubber);belt.name='motorDriveBelt';root.add(belt);
    const [rp,rm]=tangent(A,B),ropePath=pathBuilder();
    // Two neighbouring guide grooves keep the outgoing/return leads separate.
    ropePath.point(A.x+A.r*Math.cos(rp),A.y+A.r*Math.sin(rp),ropeZ);
    ropePath.point(B.x+B.r*Math.cos(rp),B.y+B.r*Math.sin(rp),ropeZ);
    ropePath.arc(B,rp,-Math.PI/2,ropeZ);
    // The straight return passes behind the guide disk, never through its face.
    ropePath.point(-endX,low,returnZ);
    ropePath.arc({x:-endX,y:low+p.endR,r:p.endR},-Math.PI/2,-Math.PI*1.5,returnZ);
    ropePath.point(endX,high,returnZ);
    ropePath.arc({x:endX,y:low+p.endR,r:p.endR},Math.PI/2,-Math.PI/2,returnZ);
    ropePath.point(B.x,low,ropeZ+p.groovePitch);
    ropePath.arc(B,-Math.PI/2,rm,ropeZ+p.groovePitch);
    ropePath.point(A.x+A.r*Math.cos(rm),A.y+A.r*Math.sin(rm),ropeZ+p.groovePitch);
    ropePath.arc(A,rm,rp,ropeZ+p.groovePitch,ropeZ,1);
    const ropeCurve=ropePath.finish(),rope=new THREE.Mesh(new THREE.TubeGeometry(ropeCurve,420,p.ropeR,6,false),m.steel);
    rope.name='carDoorLinkageRope';root.add(rope);
    // Anchors ride with the leaves; spring take-up absorbs the existing unlock stroke.
    const clamps=[-1,1].map(side=>{
      const leaf=side<0?carDoorL:carDoorR,anchorX=side*p.clampX,anchorY=side<0?low:high;
      const c=f.group('ropeClamp'+side,anchorX-side*d.cx,anchorY,ropeZ+(side<0?0:p.groovePitch),leaf);
      c.slider=f.group('ropeClampSlider',0,0,0,c);
      f.box('ropeClampBody',.075,.022,.022,m.zinc,0,0,0,c.slider);for(const x of [-.022,.022])f.bolt(x,0,.014,c.slider,.003);
      const len=anchorY-(d.trackY+.060);
      f.box('ropeInputBracket',.034,len,.004,m.zinc,0,-len/2,-.004,c);
      f.box('ropeInputFoot',.055,.004,.030,m.zinc,0,-len,.008,c);
      f.box('ropeTakeupSlot',.080,.006,.002,m.dark,0,0,.012,c);
      const spring=f.group('ropeTakeupSpring',0,0,.018,c);
      c.spring=spring;
      for(let i=0;i<12;i++)f.cyl('takeupTurn',.004,.001,m.steel,-.027+i*.0045,0,0,spring,8).rotation.set(0,0,Math.PI/2);
      return c;
    });
    const marks=[];
    for(const [curve,material,count,radius] of [[beltCurve,m.zinc,4,.0045],[ropeCurve,m.steel,12,.0021]]){
      for(let i=0;i<count;i++){const marker=new THREE.Mesh(new THREE.SphereGeometry(radius,6,4),material);marker.name='driveMotionWitness';marker.userData.dynamic=true;root.add(marker);marks.push({marker,curve,offset:i/count,belt:curve===beltCurve});}
    }
    return {root,spec:p,A,B,motor,reduction,motorPulley,drum,guide,ends,clamps,marks,beltCurve,ropeCurve,endX,low,high,ropeZ,returnZ};
  }
  function pose(t,travel,release) {
    const p=t.spec,ropeTravel=travel+p.takeup*release,angle=-ropeTravel/p.drumR;
    t.reduction.rotation.z=angle;t.motorPulley.rotation.z=angle*p.wheelR/p.motorR;
    t.guide.rotation.z=-ropeTravel/p.guideR;t.ends.forEach(e=>e.rotation.z=-ropeTravel/p.endR);
    const leftX=-p.clampX-travel;
    t.clamps[0].position.z=t.returnZ+(t.ropeZ-t.returnZ)*(leftX+t.endX)/(t.B.x+t.endX);
    t.clamps[1].position.z=t.returnZ;
    t.clamps.forEach((c,i)=>{c.slider.position.x=(i?1:-1)*p.takeup*release;c.spring.scale.x=1-p.takeup*release/.054;});
    for(const item of t.marks){const distance=item.belt?ropeTravel*p.wheelR/p.drumR:ropeTravel;const u=((item.offset+distance/item.curve.getLength())%1+1)%1;item.curve.getPointAt(u,item.marker.position);}
    t.travel=ropeTravel;t.angle=angle;
  }
  return {spec,build,pose};
})();
