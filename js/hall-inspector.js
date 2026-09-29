// 승강곰의 긴 삼각키 도구. 교육용 링크이며 기하는 최초 한 번만 생성한다.
const HallInspector=(()=>{
  const spec={poleX:.10,crankR:.060,gripY:.36,bodyZ:.27,footHalfX:.07,footOffsetX:.09,keyTurn:50*Math.PI/180};
  // 개방 유지 자세: 문 홀면에서 발끝만 3mm 걸친다. 발 치수는 실제 메시에서 읽는다.
  const toeOverlap=.003,footBounds=new THREE.Box3();
  let toeReach=null;
  let tool,shaft,rod,slider,crank,socket,linkLength=1,initialX=0;
  const keyPoint=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),handA=new THREE.Vector3(),handB=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
  function keyWorld(f,out=keyPoint){
    const h=hatchDoors[f],t=h.right.userData.triKey;h.right.updateWorldMatrix(true,true);
    return h.right.localToWorld(out.set(t.triX,t.triY,t.hallZ+.003));
  }
  function segment(mesh,p,q){delta.copy(q).sub(p);mesh.position.copy(p).addScaledVector(delta,.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(up,delta.normalize());}
  function build(){
    if(tool)return;
    tool=new THREE.Group();tool.name='InspectorLongTriangleKey';scene.add(tool);tool.visible=false;
    const steel=M.ss(0xbcc7ce),dark=M.paint(0x25364a),gold=M.gold(),red=M.paint(0xdb4f35);
    shaft=createCylinder(.012,.012,1,steel,0,0,0,tool);shaft.name='InspectorToolFixedPole';
    rod=createCylinder(.004,.004,1,gold,0,0,0,tool);rod.name='InspectorToolPushRod';
    slider=new THREE.Group();slider.name='InspectorToolPushHandle';tool.add(slider);createBox(.15,.024,.032,red,.005,0,0,slider);
    for(const y of [-.10,-.30])createBox(.045,.018,.030,dark,spec.poleX,y,.15,tool);
    const bearing=createCylinder(.022,.022,.10,dark,0,0,.09,tool);bearing.rotation.x=Math.PI/2;
    crank=new THREE.Group();crank.name='InspectorToolCrank';crank.position.z=.15;tool.add(crank);
    createBox(spec.crankR,.012,.010,gold,spec.crankR/2,0,0,crank);
    const pin=createCylinder(.009,.009,.018,steel,spec.crankR,0,0,crank);pin.rotation.x=Math.PI/2;
    socket=new THREE.Group();socket.name='InspectorTriangleSocket';tool.add(socket);
    const spindle=createCylinder(.006,.006,.10,steel,0,0,.067,socket);spindle.rotation.x=Math.PI/2;
    const shape=new THREE.Shape(),hole=new THREE.Path();
    for(let i=0;i<3;i++){const t=Math.PI/2+i*2*Math.PI/3,x=Math.cos(t),y=Math.sin(t);if(!i){shape.moveTo(.009*x,.009*y);hole.moveTo(.0057*x,.0057*y);}else{shape.lineTo(.009*x,.009*y);hole.lineTo(.0057*x,.0057*y);}}
    shape.closePath();hole.closePath();shape.holes.push(hole);
    const tip=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.017,bevelEnabled:false}),steel);tip.name='InspectorTriangleSocketTip';socket.add(tip);
    createBox(.10,.018,.024,steel,.05,-.035,.15,tool);
    tool.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  }
  function begin(f){build();Mascot.beginInspection();tool.visible=true;keyWorld(f);initialX=keyPoint.x+spec.poleX+.185;linkLength=keyPoint.y-FLOOR_Y[f]-spec.gripY;}
  function pose(f,p){
    if(!tool||!Mascot.inspecting)return;
    const h=hatchDoors[f],floorY=FLOOR_Y[f];keyWorld(f);
    const edge=h.right.position.x+h.right.userData.triKey.panelInnerX,targetX=edge-spec.footOffsetX-spec.footHalfX,hallZ=keyPoint.z-.003;
    const x=THREE.MathUtils.lerp(initialX+.40*(1-p.approach),targetX,p.walk),z=hallZ+spec.bodyZ;
    tool.position.set(THREE.MathUtils.lerp(keyPoint.x,x-.185-spec.poleX,p.carry),keyPoint.y,THREE.MathUtils.lerp(keyPoint.z+.22*(1-p.insert),hallZ+.40,p.carry));
    const angle=p.key*spec.keyTurn;crank.rotation.z=socket.rotation.z=angle;
    const cx=spec.crankR*Math.cos(angle),cy=spec.crankR*Math.sin(angle),sy=cy-Math.sqrt(linkLength*linkLength-(cx-spec.crankR)**2);
    slider.position.set(spec.crankR,sy,.15);
    segment(shaft,a.set(spec.poleX,-linkLength-.14,.15),b.set(spec.poleX,.025,.15));segment(rod,a.set(spec.crankR,sy,.15),b.set(cx,cy,.15));
    tool.updateMatrixWorld(true);handA.copy(slider.position);tool.localToWorld(handA);handB.set(x+.185,floorY+.38,z-.13);
    Mascot.inspectionPose(x,floorY,z,p.foot*(spec.bodyZ-.03+HALL_FINISH.panelT/2),handA,handB);
    tool.userData.floor=f;tool.userData.inserted=p.insert>.99&&p.carry<.01;tool.userData.keyRatio=p.key;
  }
  function end(){if(tool)tool.visible=false;Mascot.endInspection();}
  function hold(f,amount=1){
    Mascot.beginInspection();if(tool)tool.visible=false;
    if(!Mascot.inspecting)return;
    if(toeReach===null){
      Mascot.inspectionPose(0,0,0,0,null,null,0);Mascot.root.updateMatrixWorld(true);
      footBounds.setFromObject(Mascot.rig.feet[0]);toeReach=footBounds.max.z;
    }
    const h=hatchDoors[f];keyWorld(f);
    const hallZ=keyPoint.z-.003,edge=h.right.position.x+h.right.userData.triKey.panelInnerX;
    const foot=amount*(spec.bodyZ-toeReach+toeOverlap);
    // Yaw=PI에서 막는 발의 +X 오프셋을 빼면 발끝 중심이 문 안쪽 모서리에 온다.
    const x=edge+Mascot.rig.feet[0].position.x;
    Mascot.root.visible=true;
    Mascot.inspectionPose(x,FLOOR_Y[f],hallZ+spec.bodyZ,foot,null,null);
  }
  return {begin,pose,hold,end,keyWorld,spec,get tool(){return tool;}};
})();
