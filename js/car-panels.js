/* 부품설계 205–219p: 설치 완료 상태. 치수 원본 S, 카 로컬 좌표.
   후면/우측은 사용자의 투시용 변경: 중앙 개구 면적 80%의 사각 유리.
   제작/인증 도면이 아닌 시뮬레이터 형상이며 임시 받침목·양중구는 제외한다. */
function buildCarPanels(parent) {
  const W=S.CAR_W, D=S.CAR_D, H=S.CAR_H;
  const root=new THREE.Group(); root.name='carPanelAssembly'; parent.add(root);
  const steel=M.ss(0xb8bfc5), trim=M.ss(0x717c85), roofMat=M.paint(0x343d44);
  roofMat.clearcoat=0;
  const rubber=M.paint(0x202629); rubber.clearcoat=0;
  const glass=M.glass(); glass.transmission=0; glass.opacity=0.17;
  glass.depthWrite=false; glass.roughness=0.16;
  const floorY=-H/2, finish=0.004, bottom=floorY+finish, top=H/2-0.025;
  const height=top-bottom, mid=(top+bottom)/2;
  // 판넬을 스타일 안쪽에 배치하여 측판과 스타일 사이 간극을 확보한다.
  const sideX=W/2-0.04, rearZ=-D/2+0.025, frontZ=D/2-0.055;
  const sideLength=frontZ-rearZ, sideMid=(frontZ+rearZ)/2, rearWidth=2*sideX;
  const box=(name,w,h,d,mat,x,y,z,g=root)=>{
    const m=createBox(w,h,d,mat,x,y,z,g); m.name=name; return m;
  };
  // 벽은 3분할씩 + 출입구 리턴 2장 = 11장. 창 가장자리/이음부 절곡과 체결부.
  function wall(name,length,glazed,position,rotation,firstNumber) {
    const group=new THREE.Group(); group.name=name;
    group.position.set(...position); group.rotation.y=rotation; root.add(group);
    const fraction=Math.sqrt(0.8), winW=length*fraction, winH=height*fraction;
    const edge=(length-winW)/2, band=(height-winH)/2;
    for(let i=0;i<3;i++) {
      const panel=new THREE.Group(); panel.name=`carPanel_${firstNumber+i}`; group.add(panel);
      const a=-length/2+i*length/3, b=a+length/3, cx=(a+b)/2;
      if(!glazed) box('opaqueSkin',b-a-0.002,height,0.004,steel,cx,mid,0,panel);
      else {
        for(const y of [bottom+band/2,top-band/2]) box('windowBorder',b-a-0.002,band,0.004,steel,cx,y,0,panel);
        if(i===0||i===2) box('windowBorder',edge,winH,0.004,steel,(i===0?-1:1)*(length-edge)/2,mid,0,panel);
        const ga=Math.max(a,-winW/2), gb=Math.min(b,winW/2);
        const pane=box('visionGlass',gb-ga-0.008,winH-0.008,0.008,glass,(ga+gb)/2,mid,0,panel);
        pane.userData.type='car-vision-glass'; pane.renderOrder=3;
      }
      // 이음 절곡은 실내 쪽으로, 외부 스타일/케이블 간극을 침범하지 않는다.
      for(const x of [a+0.004,b-0.004]) {
        box('panelFold',0.008,height,0.024,trim,x,mid,0.010,panel);
        for(let y=bottom+0.10;y<top;y+=0.40) {
          const bolt=createCylinder(0.0045,0.0045,0.006,steel,x,y,0.025,panel);
          bolt.rotation.x=Math.PI/2;
        }
      }
    }
    for(const y of [bottom+0.025,top-0.025]) box('mountingChannel',length,0.05,0.026,trim,0,y,0.01,group);
    if(glazed) {
      for(const y of [mid-winH/2,mid+winH/2]) box('glazingGasket',winW,0.009,0.012,rubber,0,y,0,group);
      for(const x of [-winW/2,winW/2]) box('glazingGasket',0.009,winH,0.012,rubber,x,mid,0,group);
    }
  }
  wall('carWallLeft',sideLength,false,[-sideX,0,sideMid],Math.PI/2,2);
  wall('carWallRear',rearWidth,true,[0,0,rearZ],0,5);
  wall('carWallRight',sideLength,true,[sideX,0,sideMid],-Math.PI/2,8);
  const returnW=(rearWidth-S.DOOR_W)/2;
  for(const sign of [-1,1]) {
    box(`carPanel_${sign<0?1:11}`,returnW,height,0.025,steel,sign*(S.DOOR_W/2+returnW/2),mid,frontZ);
    box('entranceJambFold',0.022,height,0.045,trim,sign*(S.DOOR_W/2+0.011),mid,frontZ+0.01);
  }
  const transomH=top-(bottom+S.DOOR_H);
  box('entranceTransom',S.DOOR_W,transomH,0.035,steel,0,top-transomH/2,frontZ);
  box('carFloorFinish',rearWidth-0.04,finish,sideLength-0.02,M.floor(),0,floorY+finish/2,sideMid);
  // 실 상면은 4T 바닥과 동일 높이. 두 홈은 실을 분할해 실제 음각으로 만든다.
  const sill=new THREE.Group(); sill.name='carSill'; root.add(sill);
  const sillFront=HALL_SILL_SHAFT_Z-SILL_GAP-CAR_CTR_Z;
  const sillBack=frontZ-0.025, sillD=sillFront-sillBack, sillZ=(sillFront+sillBack)/2;
  box('sillBase',S.DOOR_W+0.16,0.025,sillD,steel,0,bottom-0.0225,sillZ,sill);
  const cuts=[-sillD/2,-0.014,-0.004,0.025,0.035,sillD/2];
  for(let i=0;i<cuts.length-1;i+=2) box('sillLand',S.DOOR_W+0.16,0.01,cuts[i+1]-cuts[i],steel,0,bottom-0.005,sillZ+(cuts[i]+cuts[i+1])/2,sill);
  // 후면 손잡이: 창 테두리와 중앙 이음 기둥의 고정판에 지지한다.
  const railY=bottom+0.90, railZ=rearZ+0.09, railW=rearWidth-0.16;
  const rail=createCylinder(0.018,0.018,railW,steel,0,railY,railZ,root);
  rail.name='carInteriorHandrail'; rail.rotation.z=Math.PI/2;
  for(const x of [-railW/2,-rearWidth/6,rearWidth/6,railW/2]) {
    box('handrailBackingPlate',0.055,0.065,0.015,trim,x,railY,rearZ+0.02);
    const support=createCylinder(0.011,0.011,0.065,steel,x,railY,rearZ+0.055,root); support.rotation.x=Math.PI/2;
  }
  // 천장 덮개, 절곡 테두리, 보강대와 스타일 방진 고정 브라켓(218–219p).
  const roof=new THREE.Group(); roof.name='carRoof'; root.add(roof);
  box('roofDeck',rearWidth+0.03,0.025,sideLength+0.04,roofMat,0,H/2-0.0125,sideMid,roof);
  for(const z of [rearZ,frontZ]) box('roofEdge',rearWidth,0.07,0.012,roofMat,0,H/2+0.035,z,roof);
  for(const x of [-sideX,sideX]) box('roofEdge',0.012,0.07,sideLength,roofMat,x,H/2+0.035,sideMid,roof);
  for(const z of [rearZ+0.35,frontZ-0.35]) box('roofStiffener',rearWidth,0.025,0.045,roofMat,0,H/2+0.0125,z,roof);
  for(const sign of [-1,1]) {
    const x=sign*(S.CAR_BG/2-0.055);
    box('roofStileBracket',0.14,0.012,0.22,steel,sign*(sideX+0.025),H/2+0.006,0.04,roof);
    box('roofStileBracketUpright',0.008,0.10,0.19,steel,x-sign*0.03,H/2+0.05,0.04,roof);
    box('roofAntiVibrationPad',0.012,0.065,0.10,rubber,x-sign*0.02,H/2+0.055,0.04,roof);
    for(const z of [-0.035,0.115]) createCylinder(0.006,0.006,0.02,steel,sign*(sideX+0.015),H/2+0.018,z,roof);
  }
  root.userData={reference:'부품설계.pdf 205–219',glazedSides:['rear','right'],windowAreaRatio:0.8,sideOuterX:sideX+0.004,floorY:bottom};
  buildCarControls(parent,{floorY:bottom,frontZ,sideX});
}

/* 부품설계 221–223p + 현장 참고. 외형만 구현: 표시 4, 1~4층 버튼, 하중 스위치 30/50/100/110.
   전기회로/FSM 연결은 docs/CAR-CONTROLS.md 참고. */
function buildCarControls(parent,{floorY,frontZ,sideX}) {
  const root=new THREE.Group(); root.name='carControlEquipment'; parent.add(root);
  const metal=M.ss(0x9aa4ac), dark=M.paint(0x020303), brass=M.ss(0xb49a38);
  dark.clearcoat=0;dark.roughness=0.9;dark.metalness=0;
  const box=(name,w,h,d,mat,x,y,z,g=root)=>{
    const m=createBox(w,h,d,mat,x,y,z,g);m.name=name;return m;
  };
  const cyl=(r,h,mat,x,y,z,g,axis='y')=>{
    const m=createCylinder(r,r,h,mat,x,y,z,g);
    if(axis==='z')m.rotation.x=Math.PI/2;
    if(axis==='x')m.rotation.z=Math.PI/2;
    return m;
  };
  function label(text,w,h,x,y,z,g,fg='#dde5ec',bg=null) {
    const canvas=document.createElement('canvas');canvas.height=256;canvas.width=Math.max(128,Math.round(256*w/h));
    const ctx=canvas.getContext('2d');
    if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);}
    const fontSize=Math.min(200,canvas.width/(Math.max(1,text.length)*0.66));
    ctx.fillStyle=fg;ctx.font=`bold ${fontSize}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,128);
    const mat=M.emit(0xffffff,1);mat.map=new THREE.CanvasTexture(canvas);
    mat.emissiveMap=mat.map;mat.color.set(0x000000);
    mat.transparent=true;mat.depthWrite=false;mat.toneMapped=false;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
    mesh.position.set(x,y,z);g.add(mesh);return mesh;
  }
  function cable(name,points) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,64,0.004,8,false),dark);
    mesh.name=name;root.add(mesh);return mesh;
  }
  // 실내에서 출입구를 바라볼 때 왼쪽 리턴(세계좌표 +X)에 매립형 OPB.
  const opb=new THREE.Group();opb.name='carOPB';
  const opbX=(sideX+S.DOOR_W/2)/2;
  opb.position.set(opbX,floorY+1.10,frontZ-0.020);opb.rotation.y=Math.PI;root.add(opb);
  box('opbRecessedHousing',0.266,1.82,0.018,dark,0,0,-0.008,opb);
  box('opbStainlessFace',0.25,1.80,0.006,metal,0,0,0.004,opb);
  box('opbBlackDisplay',0.205,0.46,0.005,dark,0,0.60,0.010,opb);
  label('4',0.070,0.12,0,0.66,0.014,opb,'#d9edff','#10161c').name='opbFloorDisplay';
  label('AUTO',0.060,0.015,0,0.77,0.014,opb);
  for(let i=0;i<4;i++)box('opbSpeakerSlot',0.034,0.002,0.001,metal,0,0.52-i*0.008,0.014,opb);
  function button(name,text,x,y,alarm=false) {
    const group=new THREE.Group();group.name=name;group.position.set(x,y,0.013);opb.add(group);
    cyl(0.023,0.006,metal,0,0,0,group,'z');
    cyl(0.019,0.005,alarm?brass:dark,0,0,0.005,group,'z');
    label(text,0.028,0.021,0,0,0.008,group);
    return group;
  }
  button('opbEmergencyCall','☎',0,0.415,true);
  for(let floor=4;floor>=1;floor--){
    const y=0.21-(4-floor)*0.145;
    const b=button('opbFloorButton_'+floor,String(floor),0,y);
    b.userData={type:'cop-floor-button',floor,visualOnly:true};
    // 버튼 아래 작은 점자 돌기(외형).
    for(let i=0;i<floor;i++)cyl(0.0015,0.002,metal,-0.008+i*0.005,y-0.033,0.012,opb,'z');
  }
  button('opbDoorOpen','◀|▶',-0.047,-0.39);
  button('opbDoorClose','▶|◀',0.047,-0.39);
  box('opbServiceDoor',0.19,0.23,0.003,metal,0,-0.68,0.010,opb);
  cyl(0.007,0.004,dark,0.065,-0.61,0.014,opb,'z');
  for(const y of [-0.875,0.875])cyl(0.003,0.003,metal,0,y,0.010,opb,'z');
  opb.userData={visualOnly:true,displayFloor:4,floors:[1,2,3,4]};

  // 현대 NEO OPDNB210의 금속 표판/원형 버튼/노란 호출 버튼을 4층 가로형으로 재구성.
  // 진입 방향은 -Z이므로 진입 우측은 -X(불투명 벽). 버튼 중심은 마감바닥 +850mm.
  const wcop=new THREE.Group();wcop.name='carAccessibleOPB';
  wcop.position.set(-sideX+0.030,floorY+0.850,0.25);
  wcop.rotation.y=Math.PI/2;root.add(wcop);
  box('accessibleOPBBack',0.82,0.22,0.020,dark,0,0,0,wcop);
  box('accessibleOPBFace',0.81,0.21,0.005,metal,0,0,0.0125,wcop);
  for(const x of [-0.385,0.385])for(const y of [-0.08,0.08]){
    cyl(0.003,0.003,metal,x,y,0.017,wcop,'z');
    box('accessibleWallMount',0.025,0.025,0.02,metal,x,y,-0.020,wcop);
  }
  label('♿',0.045,0.045,-0.365,0.035,0.017,wcop,'#1c2731');
  label('1–4',0.055,0.018,-0.355,-0.045,0.017,wcop,'#1c2731');
  // 숫자는 수표+숫자, 기능은 국립국어원 승강기 점자 지침의 개/폐/호출.
  const accessibleKeys=[
    {id:'1',text:'1',dots:[[3,4,5,6],[1]]},
    {id:'2',text:'2',dots:[[3,4,5,6],[1,2]]},
    {id:'3',text:'3',dots:[[3,4,5,6],[1,4]]},
    {id:'4',text:'4',dots:[[3,4,5,6],[1,4,5]]},
    {id:'open',text:'◀|▶',dots:[[4],[1,2,3,5]]},
    {id:'close',text:'▶|◀',dots:[[1,4,5],[3,4]]},
    {id:'call',text:'☎',dots:[[2,4,5],[1,3,6],[5,6],[1,2,3,4,6]]}
  ];
  accessibleKeys.forEach((key,i)=>{
    const x=-0.27+i*0.10;
    const b=new THREE.Group();b.name='accessibleButton_'+key.id;b.position.set(x,0,0.020);wcop.add(b);
    cyl(0.024,0.006,metal,0,0,0,b,'z');
    cyl(0.021,0.005,key.id==='call'?brass:dark,0,0,0.004,b,'z');
    label(key.text,0.035,0.026,0,0,0.007,b);
    b.userData={type:'accessible-cop-button',action:key.id,visualOnly:true,centerHeight:0.850};
    const plate=box('accessibleBraillePlate',0.035,0.013,0.001,metal,x,-0.041,0.016,wcop);
    plate.userData.brailleCells=key.dots;
    key.dots.forEach((cell,ci)=>cell.forEach(dot=>{
      const dx=(ci-(key.dots.length-1)/2)*0.006+(dot>3?1:-1)*0.00125;
      const dy=(1-(dot-1)%3)*0.0025;
      const bead=new THREE.Mesh(new THREE.SphereGeometry(0.00075,8,6),metal);
      bead.position.set(x+dx,-0.041+dy,0.0165);bead.name='accessibleBrailleDot';wcop.add(bead);
    }));
  });
  wcop.userData={visualOnly:true,reference:'Hyundai NEO OPDNB210',buttonHeight:0.850,entrySide:'right',wall:'opaque-left',floorCount:4};

  // 221p: 상부 난간 왼쪽 앞, 난간 안쪽에 걸친 긴 카 탑 박스와 네 고정 볼트.
  const topBox=new THREE.Group();topBox.name='carTopBox';
  const tx=-(S.CAR_W/2-0.25),ty=S.CAR_H/2+0.59,tz=S.CAR_D/2-0.55;
  topBox.position.set(tx,ty,tz);root.add(topBox);
  box('carTopBoxBody',0.14,0.62,0.40,metal,0,0,0,topBox);
  box('carTopBoxLid',0.005,0.595,0.375,metal,0.073,0,0,topBox);
  box('carTopBoxUpperSeam',0.006,0.003,0.375,dark,0.077,0.16,0,topBox);
  for(const y of [-0.11,0.31])for(const z of [-0.145,0.145]){
    box('topBoxRailClamp',0.07,0.028,0.035,metal,-0.10,y,z,topBox);
    cyl(0.006,0.07,metal,-0.105,y,z,topBox,'x');
  }
  const badge=label('CAR TOP',0.17,0.04,0.078,0.22,0,topBox,'#1e2428');badge.rotation.y=Math.PI/2;
  for(const z of [-0.11,0.11])cyl(0.013,0.028,dark,0,-0.323,z,topBox);
  // 탑 박스 → OPB: 천장 가장자리와 전면 리턴 뒤로 내려가는 검정 하니스.
  const roofY=S.CAR_H/2+0.025;
  // 장애인 OPB 하니스는 불투명 외판 바깥으로 올라가 탑 박스에 인입한다.
  cable('accessibleOPBToTopBox',[[ -sideX-0.008,floorY+0.85,0.25],[-sideX-0.008,S.CAR_H/2-0.08,0.25],
    [-sideX+0.05,roofY+0.03,0.30],[tx,ty-0.325,tz+0.11]]);
  cable('topBoxToOPBHarness',[[tx,ty-0.324,tz+0.11],[tx,roofY+0.04,tz+0.11],
    [tx,roofY,frontZ-0.06],[opbX,roofY,frontZ-0.06],[opbX,floorY+1.97,frontZ+0.018]]);
  const junction=parent.getObjectByName('carCableJunction');
  if(junction){
    const p=junction.position;
    cable('travelJunctionToTopBox',[[p.x+0.05,p.y,p.z],[tx-0.12,p.y,p.z],[tx,ty-0.325,tz-0.11]]);
  }

  // 223p: 플랫폼의 하중 감지 볼트와 플랭크 전면 취부판에 고정한 하중 스위치 4조.
  // 기존 안전기 샤프트(-Z), 중앙 완충 타격면은 피하고 전면(+Z)에 취부한다.
  const load=new THREE.Group();load.name='carOverloadAssembly';root.add(load);
  const baseY=-S.CAR_H/2, loadZ=0.195;
  const thresholds=[30,50,100,110];
  const boltDrop={30:0.213,50:0.207,100:0.203,110:0.201};
  const switchX=[-0.42,-0.14,0.14,0.42];
  box('loadBoltUpperPlate',1.10,0.012,0.13,metal,0,baseY-0.092,loadZ,load);
  for(const x of [-0.28,0.28])cyl(0.007,0.035,metal,x,baseY-0.086,loadZ,load);
  box('loadSwitchMountShelf',1.10,0.012,0.18,metal,0,baseY-0.222,0.17,load);
  for(const x of [-0.50,0.50]){
    box('loadSwitchBeamBracket',0.05,0.12,0.012,metal,x,baseY-0.165,0.096,load);
    cyl(0.007,0.020,metal,x,baseY-0.14,0.11,load,'z');
  }
  thresholds.forEach((threshold,i)=>{
    const x=switchX[i];
    const sw=new THREE.Group();sw.name='carLoadSwitch_'+threshold;
    sw.userData={type:'car-load-switch',thresholdPercent:threshold,connector:'CC26',visualOnly:true};load.add(sw);
    box('loadSwitchBody',0.13,0.038,0.065,dark,x,baseY-0.247,loadZ,sw);
    cyl(0.008,0.020,metal,x,baseY-0.222,loadZ,sw);
    for(const dx of [-0.048,0.048])cyl(0.005,0.049,brass,x+dx,baseY-0.246,loadZ,sw);
    // 무부하 상태에서 스위치 접점 간격. 감지 볼트 길이로 30/50/100/110을 구분한다.
    const boltBottom=baseY-boltDrop[threshold],boltTop=baseY-0.09;
    cyl(0.005,boltTop-boltBottom,brass,x,(boltTop+boltBottom)/2,loadZ,sw);
    for(const y of [baseY-0.101,baseY-0.113])cyl(0.010,0.007,brass,x,y,loadZ,sw);
    cyl(0.014,0.005,brass,x,boltBottom,loadZ,sw);
    label(threshold+'%',0.09,0.025,x,baseY-0.246,loadZ+0.034,sw,'#eeeeee','#252c31');
    cable('loadSwitchLead_'+threshold,[[x+0.065,baseY-0.248,loadZ],[x+0.10,baseY-0.25,loadZ+0.045],
      [0.44,baseY-0.25,loadZ+0.045],[0.48,baseY-0.12,0.28],
      [opbX,baseY-0.10,frontZ-0.04],[opbX,floorY+0.25,frontZ+0.018]]);
  });
  load.userData={sensorType:'load-switch',thresholds,connector:'CC26',visualOnly:true,
    reference:'부품설계.pdf 223'};
  root.userData={reference:'부품설계.pdf 221–223',visualOnly:true};
}
