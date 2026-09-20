// 현대 하부 안전장치: 2026-09-16 사용자 하부 설계도·설명 영상, 부품설계.pdf 91p.
// 장죽은 하나. 조속기측(+X, 후면에서 왼쪽)과 스위치측(-X)은
// 장죽 핀이 각각 축 아래/위에 있어 서로 반대 방향으로 회전한다.
// 생성기 tools/build_safety_glb.mjs도 이 순수 치수 함수를 읽는다.
function safetyDeviceDimensions(H, BG) {
  const baseY = -H / 2 - 0.16;
  const half = 11 * Math.PI / 180, pinR = 0.075;
  const wedgeThickness=0.052,wedgeTopThickness=0.006,wedgeHeight=0.185;
  const wedgeSlope=(wedgeThickness-wedgeTopThickness)/wedgeHeight;
  return { baseY, half, pinR, pivotX: BG / 2 - 0.095,
    railX: BG / 2 - 0.055, railZ: 0.04,
    rodY: baseY - 0.025, rodZ: -0.128, webZ: -0.094,
    outputR: 0.050, wedgeSlope,
    lift: 2 * 0.050 * Math.sin(half),
    closure: 2 * 0.050 * Math.sin(half) * wedgeSlope,
    carrierY:baseY+0.090,wedgeThickness,wedgeTopThickness,wedgeHeight,
    wedgeWidth:0.080, housingInnerX:BG/2-0.114, housingOuterX:BG/2-0.0065,
    housingHalfDepth:0.12, capTopY:baseY+0.148, capBottomY:baseY-0.145 };
}

function buildHyundaiSafetyLinkage(car, frame, H, BG) {
  const d = safetyDeviceDimensions(H, BG);
  const group = new THREE.Group(); group.name = 'carSafetyLinkage'; frame.add(group);
  const steel = M.ss(0x7c8991), gold = M.ss(0x8b7840), paint = M.paint(0x526970);
  const dark = M.paint(0x15191e), blue = M.paint(0x296078), white = M.paint(0xd0d4ce);
  [steel,gold,paint,dark,blue,white].forEach(m=>m.color.convertSRGBToLinear());
  const inputY = d.rodY + d.pinR * Math.cos(d.half);
  const rodRise = 0.070;
  const switchPivotX = -d.pivotX + 0.140;
  const switchY = d.rodY - d.pinR * Math.cos(d.half) + rodRise;
  const ropeZ = GOV_CLAMP_Z - CAR_CTR_Z;
  const ropeR = (GOV_TENS_X - d.pivotX) / Math.cos(d.half);
  const rodLength = Math.hypot(d.pivotX - switchPivotX, rodRise);
  const axisY = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  function cylinder(r, length, mat, x, y, z, parent, axis = 'z') {
    const mesh = createCylinder(r, r, length, mat, x, y, z, parent);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  function bar(parent, a, b, width, depth, mat, name) {
    const mesh = createBox(width, 1, depth, mat, 0, 0, 0, parent); mesh.name = name || '';
    fitBar(mesh, a, b); return mesh;
  }
  function fitBar(mesh, a, b) {
    v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    mesh.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    mesh.scale.y = v.length(); mesh.quaternion.setFromUnitVectors(axisY, v.normalize());
  }
  function nut(parent, x, y, z, radius = 0.012, axis = 'x') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,0.009,6),gold);
    mesh.position.set(x,y,z);mesh.rotation[axis === 'x' ? 'z' : 'x']=Math.PI/2;parent.add(mesh);return mesh;
  }
  // 2026-09-16 참고 도면: 얇은 절곡 링크에 장공과 둥근 핀 보스가 보인다.
  function linkPlate(parent, x, y, width, height, z, name, material = steel) {
    const shape=new THREE.Shape();
    shape.absarc(0,-height/2+width/2,width/2,Math.PI,0,false);
    shape.absarc(0,height/2-width/2,width/2,0,Math.PI,false);
    shape.closePath();
    if(height>width*2){
      const hole=new THREE.Path(),r=width*0.18,h=height*0.22;
      hole.absarc(0,-h,r,Math.PI,0,true);hole.lineTo(r,h);
      hole.absarc(0,h,r,0,Math.PI,true);hole.closePath();shape.holes.push(hole);
    }
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.006,bevelEnabled:true,bevelThickness:0.0006,bevelSize:0.0006,bevelSegments:1}),material);
    mesh.name=name;mesh.position.set(x,y,z-0.003);parent.add(mesh);return mesh;
  }
  function lever(name, x, y, pinSign, outSign) {
    const g=new THREE.Group();g.name=name;g.position.set(x,y,d.rodZ);group.add(g);
    cylinder(0.022,0.010,steel,0,0,0,g);
    if(name!=='safetySwitchCam')linkPlate(g,0,pinSign*d.pinR/2,0.046,d.pinR+0.032,0,'safetyOuterLink',gold);
    cylinder(0.014,0.010,steel,0,pinSign*d.pinR,0,g);
    cylinder(0.005,0.034,steel,0,pinSign*d.pinR,0,g);
    if(name!=='safetySwitchCam'){
      nut(g,0,0,-0.012,0.020,'z');
      cylinder(0.002,0.033,steel,0,0,-0.020,g,'y');
    }
    // 각 끝의 짧은 Z축과 내부 크랭크. 카 폭을 가로지르는 두 번째 축은 없다.
    cylinder(0.010,0.062,steel,0,0,0.025,g);
    bar(g,[0,0,0.054],[outSign*d.outputR,0,0.054],0.023,0.008,steel,'safetyInternalCrank');
    cylinder(0.005,0.027,steel,outSign*d.outputR,0,0.054,g);
    const bearing=createBox(0.056,0.064,0.018,paint,x,y,d.webZ-0.009,group);
    bearing.name='safetyLeverBearing';
    for(const dy of [-0.023,0.023])cylinder(0.005,0.026,steel,x,y+dy,d.webZ-0.015,group);
    return g;
  }
  const input=lever('safetyGovernorLever',d.pivotX,inputY,-1,1);
  const output=lever('safetySwitchCam',switchPivotX,switchY,1,-1);
  // 카 후면에서 왼쪽 조속기 연결. 같은 Z축의 후방 크랭크가 로프를 직접 받는다.
  const crank=new THREE.Group();crank.name='safetyGovCrank';crank.position.set(d.pivotX,inputY,ropeZ);group.add(crank);
  bar(crank,[0,0,0],[ropeR,0,0],0.036,0.012,gold);
  cylinder(0.018,0.020,gold,ropeR,0,0,crank);
  cylinder(0.011,Math.abs(ropeZ-d.rodZ),steel,d.pivotX,inputY,(ropeZ+d.rodZ)/2,group);
  // 수직 클램프는 핀에 매달리므로 크랭크와 함께 기울지 않는다.
  const clamp=new THREE.Group();clamp.name='safetyGovernorClamp';group.add(clamp);
  createBox(0.026,0.065,0.024,steel,0,-0.027,0,clamp);
  for(const y of [-0.01,-0.03,-0.05]){
    createBox(0.038,0.009,0.030,gold,0,y,0,clamp);
    for(const x of [-0.014,0.014])cylinder(0.003,0.036,steel,x,y,0,clamp);
  }
  const rod=new THREE.Group();rod.name='safetyCrossRod';group.add(rod);
  // 로컬 원점은 스위치측 핀, +X는 조속기측 핀이다.
  cylinder(0.007,rodLength-0.060,steel,rodLength/2,0,0,rod,'x');
  for(const [x,sign] of [[0,1],[rodLength,-1]]){
    for(const z of [-0.014,0.014]){
      createBox(0.038,0.022,0.006,gold,x+sign*0.014,0,z,rod);
      cylinder(0.011,0.006,gold,x,0,z,rod);
    }
    nut(rod,x+sign*0.045,0,0).name=x===0?'safetyClevisLockNut':'';
  }
  // 스위치측 절곡 포크의 가로 연결부와 조정 나사. 너트 사이에 나사산이 드러난다.
  createBox(0.016,0.027,0.028,gold,0.030,0,0,rod).name='safetyClevisShoulder';
  const threadPoints=[],threadStart=0.052,threadEnd=0.108,threadTurns=22;
  for(let i=0;i<=threadTurns*16;i++){
    const t=i/(threadTurns*16),a=t*threadTurns*Math.PI*2;
    threadPoints.push(new THREE.Vector3(threadStart+t*(threadEnd-threadStart),0.007*Math.cos(a),0.007*Math.sin(a)));
  }
  const thread=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(threadPoints),threadTurns*16,0.00065,6,false),steel);
  thread.name='safetyAdjusterThread';rod.add(thread);
  // 중앙 길이 조절용 커플러와 양단 잠금 너트.
  cylinder(0.011,0.07,steel,rodLength/2,0,0,rod,'x');
  nut(rod,rodLength/2-0.039,0,0);nut(rod,rodLength/2+0.039,0,0);
  const springSeat=0.135, springFixed=0.255, springTurns=16, springRadius=0.018;
  const restRodAngle=Math.atan2(-rodRise,d.pivotX-switchPivotX);
  const restPinX=switchPivotX-d.pinR*Math.sin(d.half);
  const restPinY=switchY+d.pinR*Math.cos(d.half);
  const rodRestY=x=>restPinY+(x-restPinX)*Math.tan(restRodAngle);
  for(const x of [springSeat-0.007,springSeat-0.018])nut(rod,x,0,0,0.014).name='safetySpringLockNut';
  cylinder(0.023,0.004,gold,springSeat,0,0,rod,'x').name='safetySpringSeat';
  const points=[];
  const springLength=springFixed-springSeat;
  for(let i=0;i<=springTurns*24;i++){const t=i/(springTurns*24),a=t*springTurns*Math.PI*2;points.push(new THREE.Vector3(t*springLength,springRadius*Math.cos(a),springRadius*Math.sin(a)));}
  const spring=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),springTurns*24,0.0025,8,false),dark);
  spring.userData={turns:springTurns,wireDiameter:0.005,restLength:springLength};
  spring.name='safetyReturnSpring';group.add(spring);
  // 가이드 구멍은 형상으로 뚫어 장죽을 막는 솔리드 블록을 만들지 않는다.
  function guide(x, large=false){
    const shape=new THREE.Shape();const h=large?0.080:0.048;
    shape.moveTo(-0.023,-h+0.022);shape.lineTo(0.023,-h+0.022);shape.lineTo(0.023,0.022);shape.lineTo(-0.023,0.022);shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,0,0.010,0,Math.PI*2,true);shape.holes.push(hole);
    const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.006,bevelEnabled:false}),paint);
    plate.rotation.y=Math.PI/2;plate.position.set(x-0.003,rodRestY(x),d.rodZ);group.add(plate);
    createBox(0.034,0.012,Math.abs(d.rodZ-d.webZ)+0.028,paint,x,rodRestY(x)-h+0.025,(d.rodZ+d.webZ)/2,group);
  }
  const springFixedX=restPinX+springFixed*Math.cos(restRodAngle);
  const springFixedY=rodRestY(springFixedX);
  guide(springFixedX,true);guide(-0.55);guide(0.55);
  // 후면에서 오른쪽: 하부 캠 + 위쪽 롤러 스위치.
  const sw=new THREE.Group();sw.name='safetyLimitSwitch';sw.userData={type:'safety-switch',contactClosed:true};group.add(sw);
  // 후면에서 왼쪽 글랜드, 오른쪽 아래로 내려오는 롤러 암.
  const swX=switchPivotX+0.089, swY=switchY+0.118;
  createBox(0.110,0.048,0.004,paint,swX,swY,d.webZ-0.004,sw);
  createBox(0.094,0.041,0.025,blue,swX,swY,d.webZ-0.019,sw).name='safetySwitchBody';
  createBox(0.062,0.030,0.001,white,swX,swY,d.webZ-0.032,sw);
  for(let i=0;i<5;i++)createBox(0.045-i*0.003,0.0012,0.0005,dark,swX,swY+0.009-i*0.004,d.webZ-0.033,sw);
  cylinder(0.012,0.021,white,swX+0.057,swY,d.webZ-0.019,sw,'x');
  cylinder(0.004,0.010,dark,swX+0.071,swY,d.webZ-0.019,sw,'x');
  for(const x of [-0.038,0.038])cylinder(0.0025,0.003,steel,swX+x,swY,d.webZ-0.033,sw);
  createBox(0.022,0.025,0.023,dark,swX-0.055,swY,d.webZ-0.019,sw).name='safetySwitchHead';
  const swArm=new THREE.Group();swArm.name='safetySwitchArm';
  swArm.position.set(switchPivotX+0.022,swY,d.rodZ-0.014);group.add(swArm);
  const armLength=0.044, rollerR=0.009;
  bar(swArm,[0,0,0],[0,-armLength,0],0.011,0.006,dark);
  cylinder(0.007,0.009,steel,0,0,0,swArm);
  const roller=cylinder(rollerR,0.011,steel,0,-armLength,0,swArm);roller.name='safetySwitchRoller';
  cylinder(0.0055,0.013,gold,0,-armLength,0,swArm);
  cylinder(0.003,0.015,steel,0,-armLength,0,swArm);
  // 배선은 판넬의 카탑박스가 생성된 뒤 실제 글랜드 위치까지 한 번만 만든다.
  function connectTopBox(){
    const top=car.getObjectByName('carTopBox');
    if(!top||group.getObjectByName('safetySwitchHarness'))return;
    car.updateMatrixWorld(true);
    const q=CarWiring.layout,routeZ=d.webZ-.019;
    // 빔 후면 → 우측 하부 채널 → 후면 모서리 상승 → 후면/좌측 토보드 밖.
    // 중앙 천장과 보행 공간을 가로지르지 않는다.
    CarWiring.run(group,'safetySwitchHarness',[
      [swX+.076,swY,routeZ],[swX+.088,swY,routeZ],[swX+.088,q.underY,routeZ],
      [q.outerX,q.underY,routeZ],[q.outerX,q.underY,q.rearZ],[q.outerX,q.overY,q.rearZ],
      [q.edgeX,q.overY,q.rearZ],[q.edgeX,q.roofY,q.rearZ],
      [CarWiring.laneX('safety'),q.roofY,q.rearZ],...CarWiring.toBox('safety')],{radius:.004});
  }
  createBox(0.10,0.038,0.001,dark,0,d.baseY+0.045,d.webZ-0.002,group).name='safetyBarcodeLabel';

  function pose(p){
    const a=-d.half+2*d.half*p;
    const ix=d.pivotX+d.pinR*Math.sin(a),iy=inputY-d.pinR*Math.cos(a);
    // 두 원의 교점으로 강체 장죽 길이를 보존한다. 위쪽 교점이 스위치측 핀이다.
    const dx=ix-switchPivotX,dy=iy-switchY,dist=Math.hypot(dx,dy);
    const along=(d.pinR*d.pinR-rodLength*rodLength+dist*dist)/(2*dist);
    const high=Math.sqrt(Math.max(0,d.pinR*d.pinR-along*along));
    const ox=switchPivotX+along*dx/dist-high*dy/dist;
    const oy=switchY+along*dy/dist+high*dx/dist;
    const b=Math.atan2(-(ox-switchPivotX),oy-switchY);
    return {a,b,ix,iy,ox,oy,inputLift:d.outputR*(Math.sin(a)+Math.sin(d.half)),
      outputLift:d.outputR*(-Math.sin(b)+Math.sin(d.half))};
  }
  const rest=pose(0);
  // 롤러 중심 궤적을 캠 좌표로 바꿔 접촉면을 만든다. 기존 독립 각도 보간 제거.
  // 캠에 눌린 하향 암은 해제점 이후 스프링 복귀로 수평이 된다.
  const releaseAt=0.12;
  const armA=p=>{
    if(p<=releaseAt)return -0.06-0.12*p/releaseAt;
    const t=(p-releaseAt)/(1-releaseAt),ease=t*t*(3-2*t);
    return -0.18+(-Math.PI/2+0.18)*ease;
  };
  const camPoints=[];
  for(let i=0;i<=80;i++){
    const p=releaseAt*i/80,b=pose(p).b,arm=armA(p);
    const x=swArm.position.x+armLength*Math.sin(arm)-switchPivotX;
    const y=swArm.position.y-armLength*Math.cos(arm)-switchY;
    camPoints.push(new THREE.Vector2(x*Math.cos(b)+y*Math.sin(b),-x*Math.sin(b)+y*Math.cos(b)));
  }
  const outline=[];
  for(let i=0;i<camPoints.length;i++){
    const c=camPoints[i],prev=camPoints[Math.max(i-1,0)],next=camPoints[Math.min(i+1,80)];
    const tangent=next.clone().sub(prev).normalize();let normal=new THREE.Vector2(-tangent.y,tangent.x);
    if(normal.dot(c)<0)normal.negate();outline.push(c.clone().addScaledVector(normal,-rollerR));
  }
  const shape=new THREE.Shape();
  shape.moveTo(-0.025,-0.014);shape.lineTo(-0.028,0.052);
  shape.quadraticCurveTo(-0.027,outline[outline.length-1].y,outline[outline.length-1].x,outline[outline.length-1].y);
  for(let i=outline.length-2;i>=0;i--)shape.lineTo(outline[i].x,outline[i].y);
  shape.lineTo(0.025,0.014);shape.quadraticCurveTo(0.028,-0.023,0,-0.024);shape.closePath();
  const slot=new THREE.Path();slot.absarc(0,0.031,0.004,Math.PI,0,true);
  slot.lineTo(0.004,0.048);slot.absarc(0,0.048,0.004,0,Math.PI,true);slot.closePath();shape.holes.push(slot);
  const cam=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.010,bevelEnabled:false}),gold);
  cam.position.z=-0.019;cam.name='safetySwitchCamProfile';output.add(cam);
  // 포크 핀까지 이어지는 뒤쪽 절곡 귀. 앞면의 롤러 궤적과 Z 간극을 둔다.
  createBox(0.024,0.020,0.016,gold,0,0.032,-0.004,output).name='safetyCamClevisBridge';
  bar(output,[0,0.032,-0.001],[0,d.pinR,-0.001],0.024,0.010,gold,'safetyCamClevisEar');
  cylinder(0.014,0.010,gold,0,d.pinR,-0.001,output);
  // 정면 육각 소켓은 캠보다 앞으로 돌출하며, 관통공 안쪽 축과 분할핀이 보인다.
  const socketShape=new THREE.Shape(),socketHole=new THREE.Path();
  for(let i=0;i<6;i++){
    const a=Math.PI/6+i*Math.PI/3,x=0.021*Math.cos(a),y=0.021*Math.sin(a);
    if(i===0)socketShape.moveTo(x,y);else socketShape.lineTo(x,y);
  }
  socketShape.closePath();
  for(let i=0;i<6;i++){
    const a=Math.PI/6-i*Math.PI/3,x=0.0155*Math.cos(a),y=0.0155*Math.sin(a);
    if(i===0)socketHole.moveTo(x,y);else socketHole.lineTo(x,y);
  }
  socketHole.closePath();socketShape.holes.push(socketHole);
  const socket=new THREE.Mesh(new THREE.ExtrudeGeometry(socketShape,{depth:0.012,bevelEnabled:true,bevelThickness:0.0005,bevelSize:0.0005,bevelSegments:1}),gold);
  socket.position.z=-0.033;socket.name='safetyCamHexSocket';output.add(socket);
  const shaftFace=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.004,6),dark);
  shaftFace.rotation.x=Math.PI/2;shaftFace.position.z=-0.023;shaftFace.name='safetyCamShaftFace';output.add(shaftFace);
  const cotter=new THREE.Group();cotter.name='safetyCamSplitPin';output.add(cotter);
  function pinWire(coords,name){
    const path=new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,48,0.0012,8,false),steel);mesh.name=name;cotter.add(mesh);
  }
  // 아래 눈고리와 관통한 두 다리. 한 다리는 장공 방향, 다른 다리는 옆으로 꺾는다.
  pinWire([[-0.0013,-0.018,-0.035],[-0.004,-0.024,-0.035],[0,-0.028,-0.035],[0.004,-0.024,-0.035],[0.0013,-0.018,-0.035]],'safetySplitPinEye');
  pinWire([[-0.0013,-0.018,-0.035],[-0.0013,0.011,-0.035],[-0.004,0.023,-0.035],[-0.023,0.032,-0.029]],'safetySplitPinBentLeg');
  pinWire([[0.0013,-0.018,-0.035],[0.0013,0.014,-0.035],[0.003,0.036,-0.030],[0.004,0.045,-0.023]],'safetySplitPinStraightLeg');
  const clampOut={x:0,y:0,z:ropeZ};car.userData.govClamp=clampOut;
  const followers=[];
  function attachGear(sg){
    // 내부 리프트는 축 핀을 받는 가로 슬롯 요크와 이어진다. 슬롯이 핀의 X 원호를 허용한다.
    for(const [tag,sign,pivotY,restAngle] of [['R',1,inputY,rest.a],['L',-1,switchY,rest.b]]){
      const lift=sg['lift'+tag];
      const px=(tag==='R'?d.pivotX:switchPivotX)+sign*d.outputR*Math.cos(restAngle);
      const py=pivotY+sign*d.outputR*Math.sin(restAngle);
      const z=d.rodZ+0.054;
      for(const offset of [-0.009,0.009])createBox(0.037,0.006,0.014,steel,px,py+offset,z,lift);
      for(const offset of [-0.0155,0.0155])createBox(0.006,0.024,0.014,steel,px+offset,py,z,lift);
      // 요크는 레일 날의 안쪽을 돌아 양쪽 쐐기를 연결한다.
      const innerX=sign*(d.railX-0.065);
      bar(lift,[px,py,z],[innerX,py,z],0.012,0.012,steel,'safetyLiftLink');
      // 트립 끝에서도 상단 플랜지 아래에 남도록 캐리어 위 돌출을 7mm로 제한.
      linkPlate(lift,innerX,(py+d.carrierY)/2,0.022,Math.abs(d.carrierY-py)+0.014,z,'safetyLiftLink');
      bar(lift,[innerX,d.carrierY,z],[innerX,d.carrierY,d.railZ],0.012,0.012,steel,'safetyLiftLink');
      createBox(0.018,0.012,0.018,steel,sign*(d.railX-0.062),d.carrierY,d.railZ,lift);
      followers.push({tag,lift,px,py,z});
    }
    set(sg.shaft.rotation.x/SG_TRIP_ROT);
  }
  function set(progress){
    const p=Math.max(0,Math.min(1,progress)),q=pose(p);
    input.rotation.z=q.a;output.rotation.z=q.b;crank.rotation.z=q.a;
    rod.position.set(q.ox,q.oy,d.rodZ);rod.rotation.z=Math.atan2(q.iy-q.oy,q.ix-q.ox);
    const seatX=q.ox+springSeat*Math.cos(rod.rotation.z),seatY=q.oy+springSeat*Math.sin(rod.rotation.z);
    spring.position.set(seatX,seatY,d.rodZ);spring.scale.x=(springFixedX-seatX)/springLength;
    spring.rotation.z=Math.atan2(springFixedY-seatY,springFixedX-seatX);
    swArm.rotation.z=armA(p);sw.userData.contactClosed=p<releaseAt;
    clampOut.x=d.pivotX+ropeR*Math.cos(q.a);clampOut.y=inputY+ropeR*Math.sin(q.a);
    clamp.position.set(clampOut.x,clampOut.y,ropeZ);
    const sg=car.userData.safetyGear;
    if(sg){
      for(const [tag,lift] of [['R',q.inputLift],['L',q.outputLift]]){
        sg['lift'+tag].position.y=lift;
        for(const w of sg.wedges.filter(w=>w.name.startsWith('wedge'+tag)))w.position.z=w.userData.z0+Math.sign(d.railZ-w.userData.z0)*lift*d.wedgeSlope;
        for(const s of sg.springs.filter(s=>s.name.startsWith('spring'+tag)))s.scale.y=1-0.25*lift/d.lift;
      }
    }
  }
  car.userData.safetyLinkage={set,attachGear,connectTopBox,pose,dimensions:d,rodLength,switchPivotX,rod,crank,swArm,followers,
    clampLift:2*ropeR*Math.sin(d.half),restClampY:inputY-ropeR*Math.sin(d.half)};
  set(0);
}
