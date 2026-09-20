/* 카 도어: 부품설계 228–237p + temporary/car-door/source.mp4.
 * 도면의 설치 간극은 실치수, 외형 미기재 치수는 기존 S/승장 인터록에 맞춘 재구성.
 * 한 구동 변위 → 카문 → 접촉 베인 → 해당 층 승장문. 다른 층에는 동력을 주지 않는다.
 */
const CarDoor = (() => {
  const spec = Object.freeze({ gap:0.0035, bottomGap:0.005, panelT:0.032,
    eccentricGap:0.0005, rollerR:0.026, rollerPitch:0.28, plateW:0.40,
    plateH:0.15, vaneH:0.52,
    runningGap:0.006, zone:0.005, gateGap:0.007, bladeT:0.004,
    fixedCamOffset:0.1026, camGap:0.006,
    edgeWireR:0.0012, releaseWireR:0.0006, shoeW:0.060, shoeT:0.007,
    shoeBottom:0.008, shoeTop:0.012, shoeGrooveOffset:0.028 });
  // 165414 field-reference video: upper lock only. Local coordinates use its pivot.
  const lockSpec=Object.freeze({pivotFromFirstVane:-.018,pivotAboveCentre:.12,pivotZ:.044,
    caseX:-.260,caseY:.084,caseW:.260,caseH:.192,backZ:-.040,coverZ:.032,
    hookT:.006,toothL:-.200,toothR:-.177,toothBottom:.030,strikeY:.046,
    slotL:-.207,slotR:-.168,slotHalfZ:.006,releaseAngle:.26,
    contactX:-.280,contactY:.076,contactZ:-.012});
  function dimensions() {
    const dw=S.DOOR_W/2+0.02, cx=dw/2+0.006, ox=dw*1.5-0.01;
    const front=S.CAR_D/2-0.055, floor=-S.CAR_H/2+0.004;
    // Jamb fold outer face + drawing's 5 mm running gap + half panel thickness.
    const doorZ=front+0.0325+0.005+spec.panelT/2;
    return {cx,ox,stroke:ox-cx,width:cx*2-spec.gap,doorZ,guideZ:doorZ+spec.shoeGrooveOffset,floor,
      bottom:floor+spec.bottomGap,top:floor+S.DOOR_H,
      sillW:2*(ox+cx)+0.02,headerW:2*(ox+spec.plateW/2+0.075),
      trackY:floor+S.DOOR_H+0.09};
  }
  let drive;
  const vec=new THREE.Vector3();
  function build() {
    const d=dimensions(), root=new THREE.Group();root.name='carDoorOperator';carGrp.add(root);
    const steel=M.ss(0x87929c), zinc=M.ss(0x8d8559), dark=M.paint(0x242c32), rubber=M.paint(0x161b1e);
    zinc.metalness=.55;zinc.roughness=.38;
    const clutchMetal=M.ss(0x514a2c), linkMetal=M.ss(0x343a3d);
    clutchMetal.metalness=.48;clutchMetal.roughness=.43;
    linkMetal.metalness=.55;linkMetal.roughness=.36;
    const skin=M.silverHairline(0xc8d0d8), wire=M.ss(0x9b9b92), green=M.paint(0x284c3b);
    const box=(name,w,h,t,mat,x,y,z,p=root)=>{const m=createBox(w,h,t,mat,x,y,z,p);m.name=name;return m;};
    const group=(name,x,y,z,p=root)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);p.add(g);return g;};
    const cyl=(name,r,len,mat,x,y,z,p=root,n=20)=>{
      const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,n),mat);
      m.rotation.x=Math.PI/2;m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;p.add(m);return m;
    };
    function bolt(x,y,z,p=root,r=0.005) {
      cyl('washer',r*1.7,0.0015,steel,x,y,z,p,16);
      cyl('hexBolt',r*1.35,0.004,steel,x,y,z+0.003,p,6);
    }
    function plate(name,points,t,mat,z,p=root,holes=[]) {
      const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
      for(const [x,y,r] of holes){const h=new THREE.Path();h.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(h);}
      const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:12}),mat);
      m.position.z=z;m.name=name;m.castShadow=true;m.receiveShadow=true;p.add(m);return m;
    }
    function cable(name,pts,r=0.002,p=root,mat=rubber) {
      const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),40,r,6,false),mat);
      m.name=name;p.add(m);return m;
    }
    function rod(name,length,width,z,p=root,mat=zinc) {
      const g=group(name,0,0,z,p);
      plate(name+'Plate',[[-width/2,-width/2],[length+width/2,-width/2],[length+width/2,width/2],[-width/2,width/2]],0.004,mat,0,g,[[0,0,0.005],[length,0,0.005]]);
      bolt(0,0,0.007,g);bolt(length,0,0.007,g);return g;
    }
    // Folded header, actual track, two fixing brackets on transom/return panels.
    const headerZ=d.doorZ-0.034, headerBottom=d.trackY-0.048, headerTop=d.trackY+0.30;
    box('carHeaderWeb',d.headerW,headerTop-headerBottom,0.003,dark,0,(headerBottom+headerTop)/2,headerZ);
    for(const y of [headerBottom,headerTop])box('carHeaderReturn',d.headerW,0.004,0.032,dark,0,y,headerZ+0.016);
    const track=box('carDoorTrack',d.headerW-0.015,0.025,0.012,steel,0,d.trackY, d.doorZ-0.014);
    track.userData={type:'car-door-track',eccentricGap:spec.eccentricGap};
    for(const side of [-1,1]) {
      const x=side*(S.DOOR_W/2+0.035), bracketBack=S.CAR_D/2-0.040;
      box('operatorFixingBracket',0.065,0.23,0.004,zinc,x,d.trackY+0.075,bracketBack);
      box('operatorFixingReturn',0.004,0.23,headerZ-bracketBack,zinc,x+side*0.03,d.trackY+0.075,(headerZ+bracketBack)/2);
      for(const y of [d.trackY-0.02,d.trackY+0.17])bolt(x,y,headerZ+0.005);
    }
    const rollers=[], hangers=[], edgeTails=[];
    [carDoorL,carDoorR]=[-1,1].map(side=>{
      const g=group(side<0?'carDoorL':'carDoorR',side*d.cx,0,0,carGrp);
      g.userData={cx:side*d.cx,ox:side*d.ox,type:'car-door',side};
      const h=d.top-d.bottom, mid=(d.top+d.bottom)/2;
      box('carDoorSkin',d.width,h,0.002,skin,0,mid,d.doorZ-spec.panelT/2+0.001,g);
      for(const x of [-d.width/2+0.001,d.width/2-0.001]) {
        box('carDoorFold',0.002,h,spec.panelT,zinc,x,mid,d.doorZ,g);
        box('carDoorReturn',0.017,h,0.002,zinc,x-Math.sign(x)*0.0075,mid,d.doorZ+spec.panelT/2-0.001,g);
      }
      for(const y of [d.bottom+0.001,d.top-0.001])box('carDoorEndFold',d.width,0.002,spec.panelT,zinc,0,y,d.doorZ,g);
      for(const x of [-d.width*0.28,d.width*0.28]) {
        box('doorReinforcementWeb',0.032,h-0.06,0.002,zinc,x,mid,d.doorZ+0.007,g);
        for(const dx of [-0.016,0.016])box('doorReinforcementFold',0.002,h-0.06,0.017,zinc,x+dx,mid,d.doorZ-0.001,g);
        const shoe=group('doorGuideShoeAssembly',x,0,0,g);
        plate('doorGuideShoeBracket',[[-.039,d.bottom+.012],[.039,d.bottom+.012],[.039,d.bottom+.069],
          [.027,d.bottom+.078],[-.027,d.bottom+.078],[-.039,d.bottom+.069]],.003,linkMetal,d.doorZ+.018,shoe,
          [[-.023,d.bottom+.053,.004],[.023,d.bottom+.053,.004]]);
        for(const dx of [-.023,.023])bolt(dx,d.bottom+.053,d.doorZ+.024,shoe,.0035);
        box('doorGuideShoeReturn',.060,.003,d.guideZ-d.doorZ-.018,clutchMetal,0,d.bottom+.014,(d.guideZ+d.doorZ+.018)/2,shoe);
        box('doorGuideShoeTongue',.048,.021,.003,steel,0,d.floor+.0085,d.guideZ,shoe);
        box('doorGuideShoe',spec.shoeW,spec.shoeTop+spec.shoeBottom,spec.shoeT,rubber,
          0,d.floor+(spec.shoeTop-spec.shoeBottom)/2,d.guideZ,shoe)
          .userData={type:'car-door-guide-shoe',grooveZ:d.guideZ};
      }
      const hp=group('carHangerPlate',0,d.trackY-0.020,d.doorZ+0.006,g);hangers.push(hp);
      plate('hangerStampedPlate',[[-.2,-.075],[.2,-.075],[.2,.055],[.17,.075],[-.17,.075],[-.2,.055]],.0035,zinc,0,hp,
        [[-.14,.046,0.006],[.14,.046,0.006],[-.11,-.048,.006],[.11,-.048,.006]]);
      for(const x of [-0.14,0.14]) {
        const r=group('carRunningRoller',x,d.trackY+0.0125+spec.rollerR,d.doorZ-0.014,g);
        cyl('rollerTread',spec.rollerR,0.014,rubber,0,0,0,r);cyl('rollerHub',0.013,0.020,steel,0,0,0,r);
        cyl('rollerAxle',0.006,0.038,steel,0,0,0.012,r);
        box('rollerRotationMark',0.019,0.002,0.001,zinc,0.007,0,0.011,r);rollers.push({r,side,radius:spec.rollerR});
        bolt(x,0.058,0.008,hp);
        box('doorHangerFlange',0.070,0.004,0.037,zinc,x,d.top+0.004,d.doorZ,g);
        box('doorLiner',0.060,0.001,0.029,steel,x,d.top+0.0015,d.doorZ,g);
        bolt(x,d.top+0.022,d.doorZ+0.018,g);
      }
      const e=group('carEccentricRoller',0,d.trackY-0.0125-0.016-spec.eccentricGap,d.doorZ-0.014,g);
      cyl('eccentricTread',0.016,0.014,rubber,0,0,0,e);cyl('eccentricAxle',0.006,0.044,steel,0,0,0.008,e);
      rollers.push({r:e,side,radius:0.016});
      const edgeX=-side*(d.width/2-0.003);
      // SE600M multibeam option (p235), Tx/Rx inner faces 8 mm apart at closure.
      const beamX=-side*(d.cx-0.004-0.006);
      box('multiBeam'+(side<0?'Tx':'Rx'),0.012,h-0.04,0.018,rubber,beamX,mid,d.doorZ+0.026,g)
        .userData={type:'door-light-curtain',visualOnly:true};
      for(let y=d.bottom+0.07;y<d.top-0.06;y+=0.10)cyl('beamLens',0.003,0.001,green,beamX,y,d.doorZ+0.0355,g,8);
      box('doorMeetingRubber',0.003,h-0.012,0.008,rubber,edgeX,mid,d.doorZ,g);
      // Thin lower leads follow the user's 八-shaped route; nothing loops over the leaves.
      const leadZ=d.doorZ+.030;
      cable('edgeCable',[[beamX,d.bottom+h*.49,leadZ],[beamX+side*.014,d.bottom+h*.30,leadZ],
        [beamX+side*.050,d.bottom+.24,leadZ],[beamX+side*.16,d.bottom+.13,leadZ],
        [side*.28,d.bottom+.095,leadZ]],spec.edgeWireR,g)
        .userData={type:'door-edge-lead',side,radius:spec.edgeWireR};
      for(const [cx,cy] of [[beamX+side*.014,d.bottom+h*.30],[side*.28,d.bottom+.095]])
        box('edgeCableClamp',.008,.004,.004,linkMetal,cx,cy,leadZ,g);
      const anchorX=side*(d.sillW/2+.025),outsideZ=HALL_SILL_SHAFT_Z-SILL_GAP-CAR_CTR_Z+.012;
      const tail=cable('edgeCableFlex'+side,[[side*(d.cx+.28),d.bottom+.095,leadZ],
        [side*(d.cx+.34),d.bottom+.06,outsideZ],[side*(d.cx+.39),d.floor-.075,outsideZ],
        [anchorX,d.floor-.09,outsideZ],[anchorX,CarWiring.layout.underY,d.doorZ-.06]],spec.edgeWireR);
      tail.userData={type:'door-edge-flex',side};
      edgeTails.push({mesh:tail,side});
      const w=CarWiring.layout,outer=side*w.outerX,backZ=d.doorZ-.06;
      CarWiring.run(root,'edgeCableReturn'+side,[[anchorX,w.underY,backZ],[outer,w.underY,backZ],
        [outer,w.underY,w.frontLane],[outer,w.overY,w.frontLane],
        [CarWiring.laneX('door'),w.overY,w.frontLane],[CarWiring.laneX('door'),w.roofY,w.frontLane],
        ...CarWiring.toBox('door')],{radius:spec.edgeWireR});
      return g;
    });
    const transmission=CarDoorTransmission.build(d,{box,group,cyl,bolt,plate,cable,rod},{steel,zinc,dark,rubber,guide:M.paint(0xb8b6a8)});
    const {motor:driveMotor}=transmission;
    // Car-mounted controller, separate from the existing car top junction box.
    const controller=group('carDoorController',-.36,transmission.A.y+.045,d.doorZ-.15);
    box('doorControllerCase',.30,.115,.18,dark,0,0,0,controller);
    box('doorControllerLid',.302,.004,.182,steel,0,.059,0,controller);
    for(let i=0;i<10;i++)box('controllerVent',.002,.045,.001,rubber,-.105+i*.023,0,.091,controller);
    for(const x of [-.125,.125])bolt(x,.045,.093,controller,.003);
    const wiring=CarWiring.layout,controllerZ=controller.position.z;
    CarWiring.run(root,'doorMotorCable',[[driveMotor.x,driveMotor.y,d.doorZ-.148],[driveMotor.x,wiring.overY,d.doorZ-.148],
      [-.54,wiring.overY,d.doorZ-.148],[-.54,wiring.overY,controllerZ+.035],
      [-.54,controller.position.y,controllerZ+.035],[-.51,controller.position.y,controllerZ+.035]],{radius:.004});
    const topBox=carGrp.getObjectByName('carTopBox');
    if(topBox){CarWiring.run(root,'doorControllerSupply',[
      [-.51,controller.position.y,controllerZ-.035],[-.55,controller.position.y,controllerZ-.035],
      [-.55,wiring.roofY,controllerZ-.035],[CarWiring.laneX('door'),wiring.roofY,controllerZ-.035],
      ...CarWiring.toBox('door')],{radius:.004});
      box('multiBeamPowerBox',.03,.13,.06,dark,-.04,-.12,.12,topBox).userData={type:'multibeam-power-box',visualOnly:true};}
    const sensors=['CLS','OLS'].map((name,i)=>{
      const x=.28+(i?d.stroke:0), s=box(name,.026,.022,.018,dark,x,d.trackY+.09,d.doorZ+.022);
      s.userData={type:'car-door-limit',active:i===0};
      cyl(name+'Target',.007,.001,steel,x,d.trackY+.09,d.doorZ+.032,root,20);return s;
    });
    box('doorLimitFlag',.033,.030,.002,zinc,.28-d.cx,d.trackY+.09,d.doorZ+.034,carDoorR);
    const gate=group('carGateSwitch',-d.cx+.055,d.trackY-.030,d.doorZ+.045,carDoorL);
    // Place mating switch/bridge at the meeting line; switch travels with -X panel.
    gate.position.x=d.cx-.042;
    box('gateSwitchBase',.075,.068,.016,dark,0,0,0,gate);
    const cover=M.glass();cover.transmission=0;cover.opacity=.27;cover.depthWrite=false;
    box('gateSwitchCover',.078,.071,.017,cover,0,0,.012,gate);
    for(const y of [-.020,.020]){const pin=cyl('gateContact',.004,.013,wire,.0355,y,.006,gate,12);pin.rotation.set(0,0,Math.PI/2);bolt(-.026,y,.023,gate,.003);}
    box('gateContactBridge',.024,.052,.006,zinc,-d.cx+.01025,d.trackY-.030,d.doorZ+.053,carDoorR);
    const gateMate=group('carGateMatingSwitch',-d.cx+.049,d.trackY-.030,d.doorZ+.045,carDoorR);
    box('gateMatingBase',.067,.068,.016,dark,0,0,0,gateMate);
    box('gateMatingCover',.069,.071,.002,cover,0,0,.021,gateMate);
    for(const yy of [-.020,.020])bolt(.023,yy,.023,gateMate,.003);
    drive={root,d,spec,ready:false,release:0,coupledFloor:-1,locked:true,gateClosed:true,
      sensors,rollers,edgeTails,transmission,gate,helpers:{box,group,cyl,bolt,plate,cable,rod},materials:{steel,zinc,dark,rubber,clutchMetal,linkMetal},busy:false};
    carGrp.userData.doorDrive=drive;
    // Hall assets are async; dimensions come from their actual tread geometry.
    drive.promise=Promise.all(hatchDoors.map(h=>h.interlock.promise)).then(()=>{
      buildClutch(drive);drive.ready=true;pose();batchHardware(drive);
    }).catch(e=>{console.error('Car door assembly failed',e);throw e;});
  }

  function buildClutch(q) {
    const {d,helpers:f,materials:m}=q, h=hatchDoors[0];
    carGrp.updateWorldMatrix(true,true);h.right.updateWorldMatrix(true,true);
    function rollerMesh(h,name) {
      const g=h.interlock.moving.getObjectByName(name);let best=null,width=0;
      g.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=b.max.x-b.min.x;if(w>width){best=o;width=w;}});
      return best;
    }
    q.hallTreads=hatchDoors.map(h=>rollerMesh(h,'MovingRoller'));
    function tread(name) {
      const mesh=rollerMesh(h,name);
      const b=new THREE.Box3().setFromObject(mesh), p=b.getCenter(new THREE.Vector3());
      carGrp.worldToLocal(p);return {p,r:(b.max.x-b.min.x)/2,z0:b.min.z-CAR_CTR_Z,z1:b.max.z-CAR_CTR_Z};
    }
    const upper=tread('FixedRoller'), lower=tread('MovingRoller');
    const z=(lower.z0+lower.z1)/2, cy=(upper.p.y+lower.p.y)/2;
    const baseZ=d.doorZ+.023;
    const clutch=f.group('carCDLClutch',-d.cx,0,0,carDoorR);
    q.clutch=clutch;q.contact={upper,lower,z,cy};
    const x=lower.p.x;
    f.plate('clutchBase',[[x-.11,cy-.31],[x+.075,cy-.31],[x+.075,cy-.13],[x+.14,cy-.07],
      [x+.14,cy+.04],[x+.10,cy+.12],[x+.10,cy+.23],[x-.11,cy+.23]],.004,m.clutchMetal,baseZ,clutch,
      [[x-.065,cy+.18,.006],[x+.054,cy+.18,.006],[x+.05,cy-.25,.006]]);
    for(const y of [cy-.26,cy+.18])for(const dx of [-.065,.054])f.bolt(x+dx,y,baseZ+.008,clutch);
    // Stand-offs reach the hall roller plane; pivot/backplate stay behind the tread.
    for(const y of [cy-.22,cy+.16]) {
      f.box('clutchStandOff',.038,.028,z-baseZ-.014,m.zinc,x,y,(z+baseZ-.014)/2,clutch);
      f.bolt(x,y,z-.020,clutch);
    }
    // Narrow transport envelope. Stepped pickup shoes match the existing staggered
    // hall rollers; no independent hall geometry/roller coordinates are invented.
    const leftFace=Math.min(upper.p.x-upper.r,lower.p.x-lower.r)-spec.runningGap;
    const rightFace=Math.max(upper.p.x+upper.r,lower.p.x+lower.r)+spec.runningGap;
    q.leftVane=f.group('carCDLActuatorVane',leftFace,cy,z,clutch);
    q.rightVane=f.group('carCDLReactionVane',rightFace,cy,z,clutch);
    for(const [v,side] of [[q.leftVane,-1],[q.rightVane,1]]) {
      f.box('vaneBlade',spec.bladeT,spec.vaneH,.014,m.zinc,side*spec.bladeT/2,0,0,v);
      // Folded flange sits behind the roller contact plane, exposing a broad darker face.
      f.box('vaneFoldedWeb',.025,spec.vaneH,.003,m.clutchMetal,side*.014,0,-.009,v);
      for(const yy of [-.20,.16]){
        f.cyl('vanePivotBush',.014,.005,m.linkMetal,side*.018,yy,-.012,v);
        f.bolt(side*.018,yy,-.008,v,.0035);
      }
      for(const sy of [-1,1]){
        const tip=f.box('vaneEntryFlare',spec.bladeT,.035,.014,m.zinc,side*.004,sy*(spec.vaneH/2+.016),0,v);
        tip.rotation.z=-side*sy*.22;
      }
    }
    // Profiles are relieved around the other roller. Contact occurs only on the
    // appropriate shoe; blade body remains outside both circular envelopes.
    q.shoes=[];
    for(const [v,r,side] of [[q.leftVane,lower,-1],[q.rightVane,upper,1]]) {
      const pad=f.box('vanePickupShoe',.014,.018,.014,m.zinc,0,r.p.y-cy,0,v);q.shoes.push(pad);
    }
    q.leftRest=leftFace;q.rightRest=rightFace;
    // Four parallel short links constrain the vanes to remain vertical.
    q.vaneLinks=[];
    for(const side of [-1,1])for(const yy of [-.20,.16]) {
      const a={x:x+side*.018,y:cy+yy}, len=.055;
      const link=f.rod('vaneParallelLink',len,.018,lower.z0-.020,clutch,m.linkMetal);
      q.vaneLinks.push({link,a,len,side});
    }
    // Fixed cam outer face = centre +102.6 mm, with 6 mm actuator spacing (p233).
    f.box('CDLFixedCam',.010,.19,.012,m.zinc,spec.fixedCamOffset-.005,cy-.08,baseZ+.013,clutch);
    q.cam=f.group('CDLCam',x+.055,cy-.13,baseZ+.022,clutch);
    f.plate('CDLCamPlate',[[-.03,-.026],[.034,-.027],[.135,.10],[.12,.128],[.08,.115],[-.028,.025]],.005,m.clutchMetal,0,q.cam,[[0,0,.006],[.115,.108,.005]]);
    f.bolt(0,0,.009,q.cam);
    const actuator=f.box('CDLActuatorCam',.010,.19,.010,m.zinc,spec.fixedCamOffset+spec.camGap+.005,cy-.08,baseZ+.025,clutch);
    q.actuator=actuator;
    buildUpperLock(q,leftFace,cy,baseZ,clutch);
    // Release lever and wire (p237), anchored to the moving leaf.
    q.releaseLever=f.group('carDoorReleaseLever',x-.065,cy+.06,baseZ+.046,clutch);
    f.plate('releaseLever',[[-.10,-.17],[-.10,-.145],[-.025,-.145],[-.025,.012],[.013,.012],[.013,-.16],[-.025,-.17]],.003,m.linkMetal,0,q.releaseLever,[[0,0,.004]]);
    q.releaseTip=new THREE.Vector3(-.087,-.158,.005);
    f.cyl('releaseWireFerrule',.0025,.005,m.steel,...q.releaseTip.toArray(),q.releaseLever,12);
    q.releaseWire=f.cable('carDoorReleaseWire',[[x-.152,cy-.098,baseZ+.051],
      [.025,cy-.20,baseZ+.051],[.025,d.bottom+.055,baseZ+.051]],spec.releaseWireR,clutch,m.steel);
    q.releaseWire.userData={type:'car-door-release-wire',radius:spec.releaseWireR};
    q.releaseWirePoints=q.releaseWire.geometry.parameters.path.points;
    for(const y of [d.bottom+.10,d.bottom+.55])f.box('releaseWireGuide',.006,.004,.004,m.linkMetal,.025,y,baseZ+.051,clutch);
    f.cable('releaseWirePullLoop',[[.025,d.bottom+.055,baseZ+.051],[.020,d.bottom+.037,baseZ+.051],
      [.025,d.bottom+.025,baseZ+.051],[.030,d.bottom+.037,baseZ+.051],[.025,d.bottom+.055,baseZ+.051]],spec.releaseWireR,clutch,m.steel);
    // Spring between cam follower and clutch base (geometry reused throughout).
    const pts=[];for(let i=0;i<=160;i++){const a=i/160*Math.PI*2*16;pts.push(new THREE.Vector3(.005*Math.cos(a),i/160,.005*Math.sin(a)));}
    q.spring=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),192,.0007,5,false),m.steel);
    q.spring.name='CDLReturnSpring';q.spring.position.set(x+.062,cy-.22,baseZ+.042);q.spring.scale.y=.25;clutch.add(q.spring);
    q.clutch.userData={reference:'부품설계 232–233,237',adaptedToExistingHallRollers:true};
  }
  function buildUpperLock(q,firstVane,cy,baseZ,clutch) {
    const {helpers:f,materials:m}=q,L=lockSpec;
    const gold=M.ss(0x9c783c);gold.metalness=.58;gold.roughness=.32;
    const white=M.paint(0xe9e5d7),brass=M.ss(0xa88740),red=M.paint(0x743b2e);
    const px=firstVane+L.pivotFromFirstVane,py=cy+L.pivotAboveCentre,pz=baseZ+L.pivotZ;
    q.lockSpec=L;q.carHook=f.group('carDoorLockHook',px,py,pz,clutch);
    // The first-vane pivot carries a bent arm and a downward tooth, like the field lock.
    const s=new THREE.Shape();s.moveTo(L.toothL,.095);s.lineTo(-.046,.095);
    s.quadraticCurveTo(-.033,.095,-.025,.083);s.lineTo(.018,.031);
    s.quadraticCurveTo(.032,.010,.019,-.013);s.quadraticCurveTo(.008,-.027,-.012,-.019);
    s.lineTo(-.027,.029);s.lineTo(-.057,.064);s.lineTo(L.toothR,.064);
    s.lineTo(L.toothR,L.toothBottom+.004);s.quadraticCurveTo(L.toothR,L.toothBottom,L.toothR-.004,L.toothBottom);
    s.lineTo(L.toothL+.004,L.toothBottom);s.quadraticCurveTo(L.toothL,L.toothBottom,L.toothL,L.toothBottom+.004);s.closePath();
    const bore=new THREE.Path();bore.absarc(0,0,.006,0,Math.PI*2,true);s.holes.push(bore);
    const hook=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:L.hookT,bevelEnabled:true,bevelThickness:.0004,bevelSize:.0004,bevelSegments:2,steps:1,curveSegments:12}),gold);
    hook.name='carDoorHookPlate';hook.userData={type:'car-lock-hook'};hook.castShadow=hook.receiveShadow=true;q.carHook.add(hook);q.lockHookMesh=hook;
    f.cyl('lockPivotCollar',.014,.004,m.steel,0,0,.009,q.carHook);f.bolt(0,0,.012,q.carHook);
    // Fixed assembly uses the same local frame as the closed hook, independently of the leaf.
    q.keeper=f.group('carDoorLockKeeper',px,py,pz,rootOf(q));
    const fixed=q.keeper;
    const slot=new THREE.Shape();slot.moveTo(-.373,-.015);slot.lineTo(-.149,-.015);slot.lineTo(-.149,.015);slot.lineTo(-.373,.015);slot.closePath();
    const opening=new THREE.Path();opening.moveTo(L.slotL,-L.slotHalfZ);opening.lineTo(L.slotL,L.slotHalfZ);opening.lineTo(L.slotR,L.slotHalfZ);opening.lineTo(L.slotR,-L.slotHalfZ);opening.closePath();slot.holes.push(opening);
    const strike=new THREE.Mesh(new THREE.ExtrudeGeometry(slot,{depth:.003,bevelEnabled:false}),gold);
    strike.name='carLockSlottedStrike';strike.userData={type:'car-lock-strike'};strike.rotation.x=Math.PI/2;strike.position.set(0,L.strikeY,L.hookT/2);strike.castShadow=strike.receiveShadow=true;fixed.add(strike);q.lockStrike=strike;
    f.plate('carLockStrikeBentEnd',[[-.149,L.strikeY],[-.138,L.strikeY+.010],[-.135,L.strikeY+.009],[-.146,L.strikeY-.003]],.030,gold,-.012,fixed);
    f.box('carLockStrikeBracket',.038,.047,.003,gold,-.355,L.strikeY+.021,-.032,fixed);
    for(const xx of [-.366,-.345])f.bolt(xx,L.strikeY+.022,-.026,fixed,.003);
    const lockCase=f.group('carLockContactHousing',0,0,0,fixed);
    f.box('lockContactBacking',L.caseW,L.caseH,.003,gold,L.caseX,L.caseY,L.backZ,lockCase);
    const depth=L.coverZ-L.backZ;
    for(const yy of [L.caseY-L.caseH/2,L.caseY+L.caseH/2])f.box('lockCaseReturn',L.caseW,.003,depth,gold,L.caseX,yy,(L.coverZ+L.backZ)/2,lockCase);
    // Transparent dust cover and separate white fixed/moving contact carriers.
    const clear=M.glass();clear.transmission=0;clear.opacity=.13;clear.depthWrite=false;clear.roughness=.18;
    f.box('lockContactClearCover',L.caseW-.006,L.caseH-.009,.0015,clear,L.caseX,L.caseY,L.coverZ,lockCase);
    f.box('lockCoverSide',.0015,L.caseH-.009,depth,clear,L.caseX-L.caseW/2,L.caseY,(L.coverZ+L.backZ)/2,lockCase);
    for(const xx of [L.caseX-L.caseW/2+.012,L.caseX+L.caseW/2-.012])f.bolt(xx,L.caseY+L.caseH/2-.012,L.coverZ+.003,lockCase,.0025);
    f.box('lockFixedInsulator',.064,.042,.020,white,-.332,L.contactY+.008,L.contactZ,lockCase);
    for(const xx of [-.350,-.318]){
      f.cyl('lockTerminalWasher',.006,.001,m.steel,xx,L.contactY+.009,L.contactZ+.012,lockCase);
      f.cyl('lockTerminalScrew',.004,.003,m.steel,xx,L.contactY+.009,L.contactZ+.014,lockCase);
      f.box('lockScrewSlot',.006,.001,.0005,m.dark,xx,L.contactY+.009,L.contactZ+.016,lockCase);
    }
    q.lockMovingInsulator=f.box('lockMovingInsulator',.145,.020,.019,white,-.232,L.contactY+.014,L.contactZ,q.carHook);
    q.lockMovingInsulator.userData={type:'car-lock-insulator',side:'moving'};
    for(const xx of [-.183,-.163])f.bolt(xx,L.contactY+.014,L.contactZ+.014,q.carHook,.0025);
    q.lockContactPads=[];
    for(const dz of [-.006,.006]){
      f.box('lockContactLeaf',.037,.0015,.004,brass,-.282,L.contactY-.00175,L.contactZ+dz,lockCase);
      const pad=f.box('lockFixedContact',.008,.001,.004,brass,L.contactX,L.contactY-.0005,L.contactZ+dz,lockCase);
      pad.userData={type:'car-lock-contact',side:'fixed'};q.lockContactPads.push(pad);
    }
    q.lockContactBridge=f.box('lockMovingContact',.014,.004,.018,brass,L.contactX,L.contactY+.002,L.contactZ,q.carHook);
    q.lockContactBridge.userData={type:'car-lock-contact',side:'moving'};
    for(const [xx,yy] of [[-.351,.069],[-.318,.069]])f.cable('lockTerminalLead',[[xx,yy,L.contactZ],[xx-.012,.040,L.backZ+.005],[-.340,.022,L.backZ+.005]],.001,lockCase,red);
    q.lockTooth=f.group('carLockToothTip',(L.toothL+L.toothR)/2,L.toothBottom,L.hookT/2,q.carHook);
    q.lockFixedContactPoint=new THREE.Vector3(L.contactX,L.contactY,L.contactZ);
    fixed.userData={type:'car-lock-fixed',reference:'165414 field video',slot:[L.slotL,L.slotR],strikeY:L.strikeY};
  }
  function rootOf(q){return q.root;}
  // Reuse each tube's buffers when the door/lever moves; no geometry allocations.
  const cablePoint=new THREE.Vector3(), cableTangent=new THREE.Vector3(), cableN=new THREE.Vector3(), cableB=new THREE.Vector3();
  function refreshCable(mesh) {
    const g=mesh.geometry,{path,tubularSegments:n,radialSegments:k,radius}=g.parameters;
    const pos=g.attributes.position,normal=g.attributes.normal;
    for(let i=0;i<=n;i++) {
      path.getPoint(i/n,cablePoint);path.getTangent(i/n,cableTangent);
      cableN.set(0,0,1);if(Math.abs(cableTangent.z)>.95)cableN.set(1,0,0);
      cableN.cross(cableTangent).normalize();cableB.crossVectors(cableTangent,cableN).normalize();
      for(let j=0;j<=k;j++) {
        const a=j/k*Math.PI*2,c=-Math.cos(a),s=Math.sin(a),idx=i*(k+1)+j;
        const nx=cableN.x*c+cableB.x*s,ny=cableN.y*c+cableB.y*s,nz=cableN.z*c+cableB.z*s;
        pos.setXYZ(idx,cablePoint.x+radius*nx,cablePoint.y+radius*ny,cablePoint.z+radius*nz);normal.setXYZ(idx,nx,ny,nz);
      }
    }
    pos.needsUpdate=true;normal.needsUpdate=true;g.computeBoundingSphere();if(g.boundingBox)g.computeBoundingBox();
  }
  function alignedFloor() {
    const bottom=carGrp.position.y-S.CAR_H/2;
    return FLOOR_Y.findIndex(y=>Math.abs(bottom-y)<=spec.zone);
  }
  function pose() {
    const q=drive;if(!q?.ready)return;
    const s=carDoorR.position.x-q.d.cx, r=q.release;
    const grip=Math.min(1,r/.45), unlock=Math.max(0,(r-.45)/.55);
    carDoorL.position.x=-q.d.cx-s;
    CarDoorTransmission.pose(q.transmission,s,r);
    q.rollers.forEach(({r:wheel,side,radius})=>wheel.rotation.z=-side*s/radius);
    q.locked=r<.98;q.gateClosed=spec.gap+2*s<=spec.gateGap;
    q.gate.userData={type:'car-gate-switch',contactClosed:q.gateClosed};
    q.sensors[0].userData.active=s<.001;q.sensors[1].userData.active=s>=q.d.stroke-.001;
    const candidate=q.coupledFloor>=0?hatchDoors[q.coupledFloor]:null;
    const h=candidate&&!candidate.manualActive?candidate:null;
    if(h) {
      h.hook.rotation.z=-h.latch.liftRad*Math.max(unlock,h.keyRatio||0);
      // Only the physical mating floor receives the car's displacement.
      h.right.position.x=h.right.userData.cx+s;h.left.position.x=h.left.userData.cx-s;
      spinDoorDrive(h);HallInterlock.update(h);
    }
    const {upper,lower,cy}=q.contact;
    // Actual lever rotation determines the moving roller's contact tangent.
    let lx=lower.p.x,ly=lower.p.y;
    if(h){
      const mesh=q.hallTreads[q.coupledFloor];
      mesh.geometry.boundingBox.getCenter(vec);mesh.localToWorld(vec);carGrp.worldToLocal(vec);
      lx=vec.x-s;ly=vec.y;
    }
    // Move complete vanes inwards; local stepped shoes avoid the opposite roller.
    const leftMove=.004*grip, rightMove=-.004*grip;
    q.leftVane.position.x=q.leftRest+leftMove;q.rightVane.position.x=q.rightRest+rightMove;
    q.shoes[0].position.x=-.007*(1-grip)+(lx-lower.r-.007-q.leftVane.position.x)*grip;
    q.shoes[1].position.x=.007*(1-grip)+(upper.p.x+upper.r+.007-q.rightVane.position.x)*grip;
    q.vaneLinks.forEach(v=>{
      const endX=v.side<0?q.leftVane.position.x:q.rightVane.position.x;
      const dx=endX-v.a.x, dy=-Math.sqrt(Math.max(0,v.len*v.len-dx*dx));
      v.link.position.x=v.a.x;v.link.position.y=v.a.y;v.link.rotation.z=Math.atan2(dy,dx);
      (v.side<0?q.leftVane:q.rightVane).position.y=cy+dy;
    });
    q.shoes[0].position.y=ly-q.leftVane.position.y;
    q.shoes[1].position.y=upper.p.y-q.rightVane.position.y;
    q.cam.rotation.z=-.18*r;q.actuator.position.x=spec.fixedCamOffset+spec.camGap+.005+.004*r;
    q.carHook.rotation.z=-lockSpec.releaseAngle*unlock;q.releaseLever.rotation.z=-.12*unlock;q.spring.scale.y=.25-.014*r;
    if(q.wireRelease!==r){
      q.releaseLever.updateMatrix();q.releaseWirePoints[0].copy(q.releaseTip).applyMatrix4(q.releaseLever.matrix);
      refreshCable(q.releaseWire);q.wireRelease=r;
    }
    if(q.wireTravel!==s){
      for(const {mesh,side} of q.edgeTails){
        const p=mesh.geometry.parameters.path.points,cx=side*(q.d.cx+s);
        p[0].x=cx+side*.28;p[1].x=cx+side*.34;p[2].x=cx+side*.39;
        refreshCable(mesh);
      }
      q.wireTravel=s;
    }

  }
  function canOpen() {
    return !!drive?.ready&&!drive.busy&&alignedFloor()===curFloor&&hatchDoors[curFloor]?.interlock?.ready&&!hatchDoors.some(h=>h.manualActive);
  }
  // Reuse the project's merger only within each rigid parent. Dynamic meshes and
  // sensors stay separate; sourceRanges retains each bolt/panel's part name.
  function batchHardware(q) {
    const keep=new Set([q.actuator,q.carHook,q.keeper,q.spring,...q.shoes,...q.sensors]);
    const parents=[];[q.root,carDoorL,carDoorR].forEach(root=>root.traverse(o=>{if(o.isGroup)parents.push(o);}));
    for(const p of parents){
      const buckets=new Map();
      for(const o of p.children){
        // 인스턴스 원본 형상을 병합하면 배치/스케일이 사라져 실내에 단위 상자가 생긴다.
        if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||keep.has(o)||Object.keys(o.userData).length||o.material.transparent||!o.geometry.attributes.normal||!o.geometry.attributes.uv)continue;
        o.updateMatrix();const key=[o.material.uuid,o.castShadow,o.receiveShadow].join('/');
        if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
      }
      for(const meshes of buckets.values())if(meshes.length>1){const merged=mergeStaticMeshBucket(meshes);merged.name='carDoorHardware_'+p.name;meshes.forEach(o=>p.remove(o));p.add(merged);}
    }
  }
  function secured(){return !!drive?.ready&&!drive.busy&&drive.locked&&drive.gateClosed&&drive.sensors[0].userData.active;}
  function open(done) {
    if(!canOpen())return false;
    const q=drive;q.busy=true;q.operation='open';q.coupledFloor=curFloor;
    gsap.killTweensOf(hatchDoors[curFloor].hook.rotation);
    q.timeline=gsap.timeline({onComplete:()=>{q.busy=false;done?.();}});
    q.timeline.to(q,{release:1,duration:.24,ease:'power1.inOut',onUpdate:pose});
    q.timeline.to(carDoorR.position,{x:q.d.ox,duration:1.15,ease:'power2.inOut',onUpdate:pose});
    return true;
  }
  function close(done) {
    const q=drive;if(!q?.ready)return false;
    q.timeline?.kill();q.busy=true;q.operation='close';q.closeCallbacks=[done].filter(Boolean);
    q.timeline=gsap.timeline({onComplete:()=>{q.busy=false;q.coupledFloor=-1;const callbacks=q.closeCallbacks;q.closeCallbacks=[];callbacks.forEach(fn=>fn());}});
    q.timeline.to(carDoorR.position,{x:q.d.cx,duration:.95,ease:'power2.inOut',onUpdate:pose});
    q.timeline.to(q,{release:0,duration:.24,ease:'power1.inOut',onUpdate:pose});
    return true;
  }
  function afterClose(cb){if(cb)drive.closeCallbacks.push(cb);}
  function pause(){if(drive?.busy)drive.timeline.pause();}
  function resume(){if(drive?.busy){drive.timeline.resume();return drive.operation;}return null;}
  return {spec,dimensions,build,pose,alignedFloor,canOpen,secured,open,close,afterClose,pause,resume,get state(){return drive;}};
})();
