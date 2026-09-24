/* Machine-room safety hardware. Metres, Y-up; installation dimensions come
 * from buildMachineRoom(). The rope tangent remains the brake's datum. */
// Blender reads this JSON mount interface; GLB extras are checked on load.
const ROPE_BRAKE_MOUNT = {"jawGap":0.030,"lugY":-0.055,"lugZ":[-0.095,0.095],"wireExit":[0.110,0.142,-0.189]};
function buildRopeBrakeOnBed(parent, spec) {
  const { ropeY, ropeZ, pitch, bedTop, railX, plateTop } = spec;
  const root = new THREE.Group(); root.name = 'RopeBrakeInstallation'; parent.add(root);
  const steel = M.paint(0x666f75), gold = M.ss(0xbca55a);
  const boltMat = M.ss(0xbfc4c7);
  const box = (w,h,d,mat,x,y,z,p=root) => createBox(w,h,d,mat,x,y,z,p);
  const bolt = (x,y,z,axis='y',p=root) => {
    const washer=createCylinder(.014,.014,.003,boltMat,x,y,z,p);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(.010,.010,.009,6),boltMat);
    head.position.set(x,y+.006,z); p.add(head);
    if(axis==='x') {washer.rotation.z=Math.PI/2;head.rotation.z=Math.PI/2;head.position.set(x+.006,y,z);}
  };
  // Two bridge members bear on both bed channels. Packing shoes make the
  // bearing surfaces continuous above the existing deflector base plate.
  const bridgeBottom=plateTop, bridgeH=.060, footY=bridgeBottom+bridgeH;
  const bridgeZ=[ropeZ-.155,ropeZ+.155];
  bridgeZ.forEach(z=>{
    box(railX*2+.09,bridgeH,.080,steel,0,bridgeBottom+bridgeH/2,z).name='BrakeBridge';
    [-railX,railX].forEach(x=>{
      box(.085,bridgeBottom-bedTop,.080,steel,x,(bridgeBottom+bedTop)/2,z).name='BrakeBearingShoe';
      // Through-bolted clamp: top head, flange, underside backing plate/nut.
      box(.085,.010,.080,steel,x,bedTop-.018,z).name='BrakeBedClamp';
      createCylinder(.006,.006,bridgeH+bridgeBottom-bedTop+.035,boltMat,x,(footY+bedTop-.035)/2,z,root);
      bolt(x,footY+.002,z);
      createCylinder(.010,.010,.010,boltMat,x,bedTop-.028,z,root);
    });
  });
  const body=new THREE.Group();body.name='RopeBrake';
  body.position.set(0,ropeY,ropeZ);body.rotation.x=pitch;root.add(body);
  const worldYZ=(y,z)=>[ropeY+y*Math.cos(pitch)-z*Math.sin(pitch),ropeZ+y*Math.sin(pitch)+z*Math.cos(pitch)];
  const pivots=ROPE_BRAKE_MOUNT.lugZ.map(z=>worldYZ(ROPE_BRAKE_MOUNT.lugY,z));
  // Broad zinc-plated side cheeks transfer both tilted jaw lugs into feet.
  // Their profile is built from the transformed lug coordinates, so neither
  // the body nor its support can float when the rope tangent changes.
  [-1,1].forEach(s=>{
    const x=s*.168, baseY=footY+.014;
    box(.080,.014,.390,gold,x,footY+.007,ropeZ).name='BrakeMountFoot';
    const points=[ [ropeZ-.195,baseY],[ropeZ+.195,baseY],
      [pivots[1][1]+.045,pivots[1][0]+.045],
      [pivots[0][1]-.045,pivots[0][0]+.045] ];
    const sh=new THREE.Shape();points.forEach(([z,y],i)=>i?sh.lineTo(z,y):sh.moveTo(z,y));sh.closePath();
    const slot=new THREE.Path();
    const [py,pz]=pivots[0],radius=.190,angle=Math.atan2(pivots[1][0]-py,pivots[1][1]-pz);
    slot.absarc(pz,py,radius+.007,angle-.13,angle+.13,false);
    slot.absarc(pz,py,radius-.007,angle+.13,angle-.13,true);slot.closePath();sh.holes.push(slot);
    const geo=new THREE.ExtrudeGeometry(sh,{depth:.012,bevelEnabled:false});
    // Shape (z,y,thickness) -> world (thickness,y,z).
    geo.applyMatrix4(new THREE.Matrix4().set(0,0,-1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1));
    const cheek=new THREE.Mesh(geo,gold);cheek.position.x=x+.006;cheek.name='BrakeSupportCheek';root.add(cheek);
    bridgeZ.forEach(z=>bolt(x,footY+.016,z));
    pivots.forEach(([y,z])=>{
      createCylinder(.018,.018,.044,gold,x,y,z,root).rotation.z=Math.PI/2;
      bolt(x+s*.026,y,z,'x');
    });
    // Return flange stiffens the long edge of each support plate.
    const a=new THREE.Vector3(x,baseY,ropeZ+s*.175);
    const b=new THREE.Vector3(x,pivots[s>0?1:0][0],pivots[s>0?1:0][1]);
    const rib=box(.035,a.distanceTo(b),.012,gold,...a.clone().add(b).multiplyScalar(.5).toArray());
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
  });
  const gap=ROPE_BRAKE_MOUNT.jawGap;
  root.updateMatrixWorld(true);
  const exit=body.localToWorld(new THREE.Vector3(...ROPE_BRAKE_MOUNT.wireExit));
  parent.worldToLocal(exit);
  root.userData={type:'rope-brake-installation',spec,bridgeZ,footY,gap,pivots,wireExit:exit.toArray(),ready:false};
  new THREE.GLTFLoader().load('models/gltf/rope_brake.glb',gltf=>{
    const model=gltf.scene.getObjectByName('RopeBrakeModel');
    const contract=model?.userData.ropeBrake;
    if(!contract || JSON.stringify(contract.wireExit)!==JSON.stringify(ROPE_BRAKE_MOUNT.wireExit)
      || contract.jawGap!==gap || contract.lugY!==ROPE_BRAKE_MOUNT.lugY
      || JSON.stringify(contract.lugZ)!==JSON.stringify(ROPE_BRAKE_MOUNT.lugZ)) {
      console.error('[rope brake] GLB mount contract mismatch');return;
    }
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    body.add(model);root.userData.model=contract;root.userData.ready=true;
  },undefined,error=>console.error('[rope brake] GLB load failed',error));
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return {root,exit};
}

function buildMachineRoomDucts(parent, spec, brake) {
  const {floorY,frontZ,panelX,panelZ,governorX,governorZ,traction}=spec;
  const root=new THREE.Group();root.name='MachineRoomSafetyWiring';parent.add(root);
  const metal=M.paint(0x8f969a), lid=M.ss(0xaab0b3), cable=M.paint(0x25282c);
  const height=.022,width=.140, brakeX=.86,govX=governorX+.220,leftX=panelX+.36;
  const brakeWireZ=brake.root.userData.bridgeZ[0];
  const paths=[ [[leftX,panelZ],[leftX,frontZ],[govX,frontZ],[govX,governorZ+.10]],
    [[brakeX,frontZ],[brakeX,brakeWireZ]], [[panelX+.20,panelZ],[leftX,panelZ]] ];
  // Traction machine branch: cabinet -> along the -X side of the machine bed (outside the beam pads).
  if(traction)paths.push([[leftX,panelZ],[leftX,traction.zA],[traction.x,traction.zA],[traction.x,traction.zB]]);
  // Low trapezoid cross-section: sloped shoulders rather than a tall box.
  const section=new THREE.Shape();section.moveTo(-width/2,0);section.lineTo(width/2,0);
  section.lineTo(width*.30,height);section.lineTo(-width*.30,height);section.closePath();
  paths.forEach(path=>{for(let i=1;i<path.length;i++){
    const a=new THREE.Vector3(path[i-1][0],floorY,path[i-1][1]);
    const b=new THREE.Vector3(path[i][0],floorY,path[i][1]);
    const len=a.distanceTo(b),dir=b.clone().sub(a).normalize();
    const geo=new THREE.ExtrudeGeometry(section,{depth:len,bevelEnabled:false});
    const run=new THREE.Mesh(geo,metal);run.position.copy(a);run.rotation.y=Math.atan2(dir.x,dir.z);
    run.name='LowFloorDuct';root.add(run);
    const top=createBox(width*.57,.0015,len,lid,0,height, len/2,run);
    top.name='DuctLid';
  }});
  // Junction covers hide open butt joints; every branch joins the cabinet run.
  [[leftX,frontZ],[govX,frontZ],[brakeX,frontZ],[leftX,panelZ],
   ...(traction?[[leftX,traction.zA],[traction.x,traction.zA]]:[])].forEach(([x,z])=>
    createBox(width*.60,.002,width*.60,lid,x,floorY+height+.001,z,root));
  function lead(name,points,radius=.005,material=cable) {
    const pts=points.map(p=>p.isVector3?p:new THREE.Vector3(...p));
    // Rounded polylines stay within the route's corners; Catmull-Rom can
    // overshoot a straight bearing surface and dip through the bridge.
    const path=new THREE.CurvePath();let from=pts[0];
    for(let i=1;i<pts.length-1;i++){
      const p=pts[i],prev=pts[i-1],next=pts[i+1];
      const trim=Math.min(.035,p.distanceTo(prev)*.25,p.distanceTo(next)*.25);
      const a=p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(trim));
      const b=p.clone().add(next.clone().sub(p).normalize().multiplyScalar(trim));
      path.add(new THREE.LineCurve3(from,a));path.add(new THREE.QuadraticBezierCurve3(a,p,b));from=b;
    }
    path.add(new THREE.LineCurve3(from,pts.at(-1)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,64,radius,8,false),material);
    mesh.name=name;root.add(mesh);mesh.userData.endpoints=[pts[0].toArray(),pts.at(-1).toArray()];return mesh;
  }
  // Follow the side cheek and bridge, with clips, instead of an unsupported
  // high loop across the working space. Drop outside the bed's outer edge.
  const e=brake.exit,z=brakeWireZ,bridgeY=brake.root.userData.footY;
  lead('RopeBrakeSupply',[e,[.205,e.y-.035,z],[.205,bridgeY+.080,z],
    [.255,bridgeY+.009,z],[.72,bridgeY+.009,z],[brakeX,bridgeY-.075,z],
    [brakeX,floorY+.070,z],[brakeX,floorY+height*.4,z]],.006);
  [[.205,bridgeY+.20,z],[.48,bridgeY+.009,z]].forEach(([x,y,z],i)=>{
    const clip=new THREE.Mesh(new THREE.TorusGeometry(.009,.002,6,12),lid);
    clip.position.set(x,y,z);if(i===0)clip.rotation.x=Math.PI/2;else clip.rotation.y=Math.PI/2;root.add(clip);
  });
  root.userData={type:'machine-room-wiring',height,width,paths,governorReady:false};
  return {root,attachGovernor(body,mechanism){
    if(!mechanism?.switchCableExit)throw new Error('Governor switch cable anchor missing from GLB');
    body.updateWorldMatrix(true,false);
    const start=parent.worldToLocal(body.localToWorld(new THREE.Vector3(...mechanism.switchCableExit)));
    const endZ=governorZ+.10;
    lead('GovernorSwitchSupply',[start,[start.x+.025,start.y-.025,start.z],
      [govX,start.y-.080,endZ],[govX,floorY+.085,endZ],[govX,floorY+height*.4,endZ]],.004);
    root.userData.governorReady=true;
  },
  // Flexible conduits (프렉시블 전선관) from the traction machine's terminal points
  // (dual-brake coil/switch box, motor terminal box, encoder) down to the floor duct branch.
  // Exits come from the GLB extras in machine-local coordinates.
  attachTractionMachine(machine,exits){
    if(!traction||!exits?.brakeTB||!exits.motorTB||!exits.encoder)throw new Error('Traction machine cable exits missing from GLB');
    machine.updateWorldMatrix(true,false);
    const w=(x,y,z)=>parent.worldToLocal(machine.localToWorld(new THREE.Vector3(x,y,z)));
    const f=machine.worldToLocal(new THREE.Vector3(0,floorY,0)).y,dx=traction.x-machine.position.x;
    const bed=machine.worldToLocal(new THREE.Vector3(0,traction.bedY,0)).y,px=traction.pedX;
    const conduit=M.paint(0x3a3e43);
    // clipped down the pedestal side, over the bed channel, into the floor duct branch
    const drop=(z)=>[[px,bed+.20,z],[px,bed+.035,z],[dx+.090,bed+.035,z],[dx+.030,f+.060,z],[dx,f+height*.4,z]];
    const [bx,by,bz]=exits.brakeTB,[mx,my,mz]=exits.motorTB,[ex,ey,ez]=exits.encoder;
    const runs={
      // behind the spring (z > spring caps), outside the motor bell, then down the pedestal
      DualBrakeSupply:[[bx,by,bz],[bx-.026,by,bz],[bx-.096,by-.040,bz+.075],[bx-.126,by-.160,bz+.085],
        [bx-.166,by-.310,bz+.105],[px,by-.480,bz+.115],...drop(bz+.115)],
      MotorPowerSupply:[[mx,my,mz],[mx,my-.060,mz],[px,my-.160,mz+.018],...drop(mz+.018)],
      EncoderSignal:[[ex,ey,ez],[ex-.050,ey,ez-.010],[px,ey-.120,ez-.050],...drop(ez-.050)]
    };
    Object.entries(runs).forEach(([name,pts])=>{
      lead(name,pts.map(p=>w(...p)),name==='EncoderSignal'?.006:.009,conduit);
      const z=pts.at(-1)[2];
      [bed+.12,bed+.06].forEach(y=>{   // saddle clips on the pedestal face
        const clip=createBox(.004,.010,.030,lid,0,0,0,root);clip.position.copy(w(px+.011,y,z));
      });
    });
    root.userData.tractionReady=true;
  }};
}
