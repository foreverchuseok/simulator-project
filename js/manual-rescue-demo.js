// 수동 구출 교육 시연. 자동운전/ARD를 사용하지 않고 기존 도어·로프·웜 피벗을 공유한다.
const ManualRescueDemo=(()=>{
  const state={active:false,stage:'idle',floor:1,brakeReleased:false,handleAttached:false,level:false,call:false,exited:false};
  let button,panel,title,detail,gap,friend,lever,handle,phone,receiver,cord,saved,jobs=[];
  let leverPivot,handlePivot,receiverPivot,wire;
  const point=new THREE.Vector3(),handA=new THREE.Vector3(),handB=new THREE.Vector3(),normal=new THREE.Vector3();
  const keyPose={approach:0,insert:0,key:0,walk:0,carry:0,foot:0};
  const own=t=>{jobs.push(t);return t;},later=(seconds,fn)=>own(gsap.delayedCall(seconds,()=>{if(state.active)fn();}));
  const tr=()=>mrGrp.userData.traction;
  const toolSpec=()=>handle.userData.manualRescue;
  const passenger=()=>UCMDemo.character;
  function stage(name,text,sub){state.stage=name;panel.dataset.stage=name;title.textContent=text;detail.textContent=sub||'';updateStatus('v-dir',text,'#f0883e');}
  function ready(){return tr()?.ready&&tr().contract.manualRescue&&scene.getObjectByName('ReleaseLeverHung')?.userData.ready&&scene.getObjectByName('TurningHandleHung')?.userData.ready&&scene.getObjectByName('IntercomHandset')&&CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready);}
  function hallReady(){return DoorBypass.hallSecured()||doorOpen&&CarDoor.alignedFloor()===curFloor&&hatchDoors.every((h,f)=>f===curFloor||h.interlock?.ready&&Math.abs(h.left.position.x-h.left.userData.cx)<.001&&Math.abs(h.right.position.x-h.right.userData.cx)<.001&&Math.abs(h.hook.rotation.z)<.001);}
  function blocked(){return moving||estop||insMode||DoorBypass.mode!=='off'||overspeedActive||ARDDemo.active||AscentDemo.active||BrakeDemo.active||UCMDemo.state.active||BufferDemo.active||InterlockDemo.active||HallManual.active||InspectionReturn.busy||inspectionResetting||CarDoor.state?.busy||!PitLadder.secured||!hallReady()||!ready();}
  function build(){
    const style=document.createElement('style');style.textContent=`
      .manual-rescue-active .part-action,.manual-rescue-active #rail,.manual-rescue-active #mobile-visibility{visibility:hidden!important}
      .manual-rescue-active #fbtns,.manual-rescue-active #btn-open,.manual-rescue-active #btn-close{display:none!important}
      #manual-rescue-action::after{content:'수동 구출';position:absolute;top:46px;left:50%;transform:translateX(-50%);white-space:nowrap;font:700 10px sans-serif;color:#fff;background:#172b36e8;padding:3px 5px;border-radius:5px}
      #manual-rescue-panel{position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);width:min(430px,calc(100vw - 24px));box-sizing:border-box;z-index:70;padding:10px 14px;border:1px solid #8fa9b5;border-radius:12px;background:#122633f2;color:#f4f8fa;text-align:center;font:12px/1.5 sans-serif}
      #manual-rescue-panel[hidden]{display:none}#manual-rescue-panel strong{display:block;font-size:15px}#manual-rescue-detail{white-space:pre-line;color:#bfd5df}#manual-rescue-gap{font-weight:bold;color:#9bf2c6;margin-top:3px}
      #manual-rescue-panel button{min-height:44px;margin-top:6px;padding:4px 14px;color:white;border:1px solid #7794a4;border-radius:7px;background:#294958;cursor:pointer}
      @media(max-width:600px){#manual-rescue-panel{font-size:11px;padding:7px 10px}#manual-rescue-panel strong{font-size:13px}}
    `;document.head.appendChild(style);
    button=document.createElement('button');button.id='manual-rescue-action';button.className='part-action';button.type='button';button.hidden=true;button.title='개방레버 + 핸들 · 수동 구출 시연';button.setAttribute('aria-label',button.title);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="m4 20 7-16M7 11h6"/><circle cx="17" cy="12" r="5"/><path d="M17 7v10m-5-5h10"/></svg>';
    button.style.setProperty('--part-icon',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);button.onclick=start;document.getElementById('part-actions').appendChild(button);
    PartGlow.bind(button,()=>[scene.getObjectByName('ReleaseLeverHung'),scene.getObjectByName('TurningHandleHung')],'개방레버 + 핸들',()=> '수동 구출 시연');
    panel=document.createElement('section');panel.id='manual-rescue-panel';panel.hidden=true;panel.setAttribute('aria-label','수동 구출운전 시연');
    panel.innerHTML='<strong role="status"></strong><div id="manual-rescue-detail"></div><div id="manual-rescue-gap"></div><button id="manual-rescue-exit">시연 종료 · 복귀</button>';
    document.body.appendChild(panel);title=panel.querySelector('strong');detail=panel.querySelector('#manual-rescue-detail');gap=panel.querySelector('#manual-rescue-gap');panel.querySelector('button').onclick=reset;
    for(const type of ['click','pointerdown','keydown','change','dblclick'])document.addEventListener(type,e=>{
      if(!state.active)return;
      if(type==='keydown'&&e.key==='Escape'){reset();e.preventDefault();e.stopImmediatePropagation();return;}
      if(panel.contains(e.target)||e.target.closest?.('#btn-estop'))return;
      if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}
    },true);
  }
  function capture(o){return {object:o,parent:o.parent,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),visible:o.visible};}
  function restore(q){q.parent.add(q.object);q.object.position.copy(q.p);q.object.quaternion.copy(q.q);q.object.scale.copy(q.s);q.object.visible=q.visible;}
  function snapshot(){
    saved={carY:carGrp.position.y,cwtY:cwtGrp.position.y,floor:curFloor,door:doorOpen,emergency:EmergencyLighting.on,
      camera:capture(camera),target:controls.target.clone(),fov:camera.fov,near:camera.near,enabled:controls.enabled,damp:controls.enableDamping,min:controls.minDistance,
      lever:capture(lever),handle:capture(handle),receiver:capture(receiver),cordVisible:cord.visible,bearScale:Mascot.root.scale.clone(),bearFloor:Mascot.root.position.y,brake:tr().brakeOpen,
      spin:[mainSheaveGrp,deflectorSheaveGrp,governorWheelGrp,tensionSheaveGrp,tr().worm].map(capture),passenger:[]};
    passenger().traverse(o=>saved.passenger.push(capture(o)));
  }
  function start(){
    if(state.active)return false;if(blocked()){updateStatus('v-dir','운행·다른 시연을 마친 뒤 수동 구출을 실행하세요.','#f0883e');return false;}
    lever=scene.getObjectByName('ReleaseLeverHung');handle=scene.getObjectByName('TurningHandleHung');phone=scene.getObjectByName('ControlPanelIntercom');receiver=phone.getObjectByName('IntercomHandset');cord=phone.getObjectByName('IntercomCord');
    if(!friend)friend=Mascot.createWorker('ManualRescueHelmetedFriend');
    leaveCabinView();closeAllMenus();snapshot();clearTimeout(autoTimer);EmergencyCall.hangUp();jobs=[];
    Object.assign(state,{active:true,stage:'preparing',brakeReleased:false,handleAttached:false,level:false,call:false,exited:false});
    Object.assign(keyPose,{approach:0,insert:0,key:0,walk:0,carry:0,foot:0});
    panel.hidden=false;document.body.classList.add('manual-rescue-active');controls.enabled=false;controls.enableDamping=false;controls.minDistance=.02;camera.near=.002;camera.updateProjectionMatrix();
    gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);MACH.resume();MACH.motorOff();
    stage('preparing','수동 구출 시연 준비','층 사이 고장 정지 상황을 재현합니다.');
    if(doorOpen){CarDoor.close(()=>{doorOpen=false;fault();});own(CarDoor.state.timeline);}else fault();return true;
  }
  function setY(y){
    const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;spinTractionSheaves(dy);
    // 제어회로 ESTOP 상태에서도 온전한 조속기 로프는 기계적 이동에 맞춰 돈다.
    governorWheelGrp.rotation.z-=dy/mrGrp.userData.govR;tensionSheaveGrp.rotation.x-=dy/mrGrp.userData.govR;
    refreshRopes();refreshGovernorRope();const light=scene.getObjectByName('carLight');if(light)light.position.y=y+S.CAR_H*.75;
    if(!state.exited)passenger().position.y=y-S.CAR_H/2+.005;
    updateGap();
  }
  function updateGap(){const delta=FLOOR_Y[state.floor]-(carGrp.position.y-S.CAR_H/2);gap.textContent=state.level?`${state.floor+1}층 착상 · 레벨 일치`:`${state.floor+1}층 바닥까지 ↑ ${Math.max(0,delta).toFixed(2)} m · 레벨존 밖`;}
  function cameraTo(p,t,seconds=.9){own(gsap.to(camera.position,{x:p.x,y:p.y,z:p.z,duration:seconds,ease:'power2.inOut'}));own(gsap.to(controls.target,{x:t.x,y:t.y,z:t.z,duration:seconds,ease:'power2.inOut'}));}
  function carShot(seconds=.9){const fy=carGrp.position.y-S.CAR_H/2,d=Math.max(3.4,2.0/camera.aspect);cameraTo(new THREE.Vector3(d,fy+1.75,CAR_CTR_Z-.80),new THREE.Vector3(0,fy+1.05,CAR_CTR_Z+.10),seconds);}
  function machineShot(seconds=.9){
    const g=tr().worm.parent;g.updateWorldMatrix(true,true);point.set(tr().contract.wheelX-.04,.06,.35);g.localToWorld(point);
    const d=Math.max(3.0,2.2/camera.aspect);cameraTo(new THREE.Vector3(point.x+1.10,point.y+.55,point.z+d),point,seconds);
  }
  function fault(){
    state.floor=THREE.MathUtils.clamp(insNearestFloor(),1,FLOORS-1);state.targetY=FLOOR_Y[state.floor]+S.CAR_H/2;
    UCMDemo.neutral();passenger().visible=true;passenger().position.set(0,0,CAR_CTR_Z);passenger().rotation.set(0,0,0);
    estop=true;moving=false;currentState=ELEVATOR_STATE.ESTOP;setTractionBrake(false,true);setY(state.targetY-.55);
    updateStatus('v-spd','0 m/min');syncAllIndicators(state.floor+1,'고장');MACH.brakeSet();
    if(!EmergencyLighting.on)EmergencyLighting.toggle();carShot();
    stage('trapped','층 사이 고장 정지 · 승객 갇힘','제어 시스템 고장 · ARD 사용 불가\n문은 잠긴 상태로 유지됩니다.');later(5,tools);
  }
  function pivot(name,object,seat,world,q){
    const p=new THREE.Group();p.name=name;scene.add(p);p.position.copy(world);p.add(object);object.quaternion.copy(q);object.position.copy(seat).applyQuaternion(q).multiplyScalar(-1);return p;
  }
  function animateMount(object,seat,world,q,name,done){
    scene.attach(object);const p0=object.position.clone(),q0=object.quaternion.clone(),end=seat.clone().applyQuaternion(q).multiplyScalar(-1).add(world),s={t:0};
    own(gsap.to(s,{t:1,duration:1.7,ease:'power2.inOut',onUpdate:()=>{object.position.lerpVectors(p0,end,s.t);object.quaternion.copy(q0).slerp(q,s.t);},onComplete:()=>done(pivot(name,object,seat,world,q))}));
  }
  function tools(){
    Mascot.beginInspection();Mascot.root.scale.setScalar(1.4);Mascot.rig.eyes.forEach(e=>e.scale.y=.032);friend.beginInspection();friend.root.scale.setScalar(1.4);machineShot();
    stage('handle-mount','안전모 친구 · 핸들 결합','엔코더 앞 돌출축에 핸들을 결합합니다. 브레이크는 아직 닫혀 있습니다.');
    const c=tr().contract.manualRescue;point.fromArray(c.shaftCenter);tr().worm.parent.localToWorld(point);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
    animateMount(handle,new THREE.Vector3(...toolSpec().handleHub),point.clone(),q,'ManualHandlePivot',p=>{
      handlePivot=p;state.handleAttached=true;state.worm0=tr().worm.rotation.z;
      stage('handle-seated','핸들 결합 완료 · 엔코더 앞 돌출축','허브가 축에 들어간 상태입니다. 브레이크 개방 전에는 회전하지 않습니다.');
      const d=Math.max(.75,.35/camera.aspect);cameraTo(p.position.clone().add(new THREE.Vector3(.26,.17,d)),p.position.clone(),.75);
      later(2.8,()=>{machineShot();later(1,mountLever);});
    });
  }
  function lugWorld(){const c=tr().contract,arm=tr().arms[c.manualRescue.armIndex];return arm.localToWorld(point.fromArray(c.manualRescue.releaseLug).sub(new THREE.Vector3(c.wheelX+c.brakeArmX,c.brakePivotY,c.drumZ)));}
  function mountLever(){
    stage('lever-mount','승강곰 · 개방레버 결합','포크를 브레이크 개방 핀에 걸고 레버를 조작합니다.');
    const world=lugWorld().clone(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
    animateMount(lever,new THREE.Vector3(...toolSpec().leverSeat),world,q,'ManualReleaseLeverPivot',p=>{
      leverPivot=p;const s={t:0};stage('brake-release','개방레버 조작 · 이중 브레이크 개방','두 브레이크 슈가 드럼에서 떨어진 뒤 핸들 회전을 시작합니다.');
      own(gsap.to(s,{t:1,duration:1.1,onUpdate:()=>{leverPivot.rotation.z=-1.40*s.t;tr().arms.forEach((a,i)=>a.rotation.z=(i===0?1:-1)*tr().contract.manualRescue.releaseAngle*s.t);leverPivot.position.copy(lugWorld());},onComplete:()=>{
        tr().brakeOpen=true;state.brakeReleased=true;later(2,wind);
      }}));
    });
  }
  function wind(){
    if(!state.brakeReleased||!state.handleAttached||!tr().brakeOpen)return;
    stage('winding','핸들 수동 회전 · 카를 조금 상승','승강곰은 브레이크 개방을 유지하고 친구가 핸들을 돌립니다.');
    moving=true;const p={y:carGrp.position.y};
    own(gsap.to(p,{y:state.targetY,duration:14,ease:'none',onUpdate:()=>{
      if(!state.brakeReleased||!tr().brakeOpen)return;setY(p.y);handlePivot.rotation.z=tr().worm.rotation.z-state.worm0;
      updateStatus('v-spd','수동 · 2.4 m/min');
    },onComplete:level}));
    later(8,()=>{carShot(1.2);stage('level-approach','카 상승 · 착상 높이 맞춤','카와 균형추가 반대로 이동합니다. 핸들 회전으로 천천히 높이를 맞춥니다.');});
  }
  function level(){
    moving=false;state.level=CarDoor.alignedFloor()===state.floor;curFloor=state.floor;state.brakeReleased=false;tr().brakeOpen=false;setTractionBrake(false,true);updateGap();updateStatus('v-spd','0 m/min');
    leverPivot.rotation.z=0;leverPivot.position.copy(lugWorld());stage('level','착상 완료 · 브레이크 다시 체결','카를 정지시킨 뒤 인터폰 통화와 삼각키 개방을 진행합니다.');later(3,callPassenger);
  }
  function callPassenger(){
    restore(saved.lever);restore(saved.handle);scene.remove(leverPivot,handlePivot);leverPivot=handlePivot=null;
    state.call=true;EmergencyCall.setManualLink(true);stage('intercom','승강곰 · 기계실 인터폰 통화','“층에 도착했습니다. 친구가 문을 열고 있으니 기다려 주세요.”');
    phone.updateWorldMatrix(true,true);const c=phone.getObjectByName('IntercomPhoneRoot').userData;
    point.fromArray(c.handsetCenter);phone.localToWorld(point);normal.set(0,0,1).transformDirection(phone.matrixWorld);
    // 전화 앞면 쪽에 서서 귀에 수화기를 댄다. 헤드/팔 위치는 현재 캐릭터 축척에서 파생한다.
    state.phoneBear=point.clone().addScaledVector(normal,.32);state.phoneBear.y=saved.bearFloor;
    state.phoneYaw=Math.atan2(-normal.x,-normal.z);
    const ear=state.phoneBear.clone().add(new THREE.Vector3(-.235*1.4,.60*1.4,0).applyAxisAngle(new THREE.Vector3(0,1,0),state.phoneYaw));
    const q=phone.getWorldQuaternion(new THREE.Quaternion());
    receiverPivot=pivot('ManualRescueHandsetPivot',receiver,new THREE.Vector3(...c.handsetCenter),point.clone(),q);
    cord.visible=false;
    if(!wire){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3));wire=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe8e2d7}));wire.name='ManualRescueIntercomCord';scene.add(wire);}wire.visible=true;
    own(gsap.to(receiverPivot.position,{x:ear.x,y:ear.y,z:ear.z,duration:1.2}));
    const d=Math.max(1.8,1.25/camera.aspect),side=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),normal);
    cameraTo(point.clone().addScaledVector(normal,d*.6).addScaledVector(side,d*.85).add(new THREE.Vector3(0,.30,0)),point.clone().addScaledVector(normal,.16));
    friend.endInspection();later(4,landing);
  }
  function landing(){
    friend.root.scale.setScalar(1);HallInspector.begin(state.floor,friend);
    stage('key-approach','안전모 친구 · 긴 삼각키 삽입','착상 레벨을 확인한 뒤 승장문의 삼각키를 돌립니다. 승강곰은 기계실에서 계속 통화합니다.');
    const fy=FLOOR_Y[state.floor],z=HallInspector.keyWorld(state.floor).z,d=Math.max(3.4,2.0/camera.aspect);
    cameraTo(new THREE.Vector3(.6,fy+1.45,z+d),new THREE.Vector3(0,fy+1.10,z),1.2);
    own(gsap.timeline().to(keyPose,{approach:1,duration:1.5}).to(keyPose,{insert:1,duration:1.2}).call(()=>stage('key-turn','긴 삼각키 회전 · 승장문 잠금 해제','레벨존 안에서 카문과 승장문이 기계적으로 연동됩니다.')).to(keyPose,{key:1,duration:1.2,onUpdate:()=>setEmergencyKey(state.floor,keyPose.key)}).call(openCoupled));
  }
  function openCoupled(){
    if(!state.level||!CarDoor.secured()||tr().brakeOpen)return;
    const q=CarDoor.state,h=hatchDoors[state.floor];q.coupledFloor=state.floor;h.manualActive=true;h.manualCoupled=true;
    stage('opening','승장문 수동 개방 · 카문 함께 열림','긴 삼각키로 잠금을 해제한 승장문을 열면 카문도 연동되어 열립니다.');
    own(gsap.timeline().to(q,{release:1,duration:.7,onUpdate:CarDoor.pose}).to(carDoorR.position,{x:q.d.ox,duration:3,ease:'power2.inOut',onUpdate:CarDoor.pose}).call(()=>{
      doorOpen=true;stage('exit','승객 구출 · 승강장으로 이동','승강곰은 인터폰으로 안내하고 친구는 열린 출입구에서 승객을 돕습니다.');exitPassenger();
    }));
  }
  function exitPassenger(){
    state.exited=true;const z=HallInspector.keyWorld(state.floor).z;
    // 승객은 문 폭 안을 통과하고, 긴 키와 작업자는 오른쪽으로 비킨다.
    own(gsap.to(keyPose,{carry:1,walk:1,duration:1.3}));
    own(gsap.to(passenger().position,{z:z+.95,duration:3.8,ease:'none',onUpdate:()=>{
      const p=UCMDemo.passengerParts,w=Math.sin(performance.now()*.01)*.3;p.legs[0].rotation.x=w;p.legs[1].rotation.x=-w;
    },onComplete:()=>{UCMDemo.passengerParts.legs.forEach(l=>l.rotation.x=0);stage('done','승객 구출 완료','카는 착상 위치에 정지하고 두 문은 열린 상태입니다. 시연 종료 버튼으로 정상 복귀합니다.');}}));
  }
  function poseWorkers(){
    if(state.call){
      if(receiverPivot){handA.copy(receiverPivot.position);Mascot.inspectionPose(state.phoneBear.x,state.phoneBear.y,state.phoneBear.z,0,null,handA,state.phoneYaw);}
      if(['key-approach','key-turn','opening','exit','done'].includes(state.stage))HallInspector.pose(state.floor,keyPose);
      return;
    }
    if(!Mascot.inspecting)return;
    const machineFloor=saved.bearFloor;
    if(leverPivot){lever.updateWorldMatrix(true,true);handA.fromArray(toolSpec().leverGrip);lever.localToWorld(handA);}else handA.set(0,0,0);
    const base=leverPivot?leverPivot.position:tr().worm.getWorldPosition(point);
    Mascot.inspectionPose(base.x+.55,machineFloor,base.z-.05,0,leverPivot?handA:null,null,-Math.PI/4);
    if(handlePivot){
      handle.updateWorldMatrix(true,true);handB.fromArray(toolSpec().handleGrip);handle.localToWorld(handB);
      friend.inspectionPose(handlePivot.position.x-.65,machineFloor,handlePivot.position.z+.20,0,handB,null,Math.PI/4);
    }else friend.inspectionPose(base.x+.3,machineFloor,base.z+.7,0,null,null,Math.PI);
  }
  function updateWire(){
    if(!state.call||!wire?.visible)return;
    const c=phone.getObjectByName('IntercomPhoneRoot').userData;
    handA.fromArray(c.bodyCord);phone.localToWorld(handA);handB.fromArray(c.handsetCord);receiver.localToWorld(handB);
    const a=wire.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const t=i/(a.count-1);point.lerpVectors(handA,handB,t);point.y-=.16*Math.sin(Math.PI*t);point.x+=.006*Math.sin(t*Math.PI*24);a.setXYZ(i,point.x,point.y,point.z);}a.needsUpdate=true;wire.geometry.computeBoundingSphere();
  }
  function update(){
    if(!button)return;
    if(state.active){poseWorkers();updateWire();button.hidden=true;return;}
    const l=scene.getObjectByName('ReleaseLeverHung'),h=scene.getObjectByName('TurningHandleHung');
    button.hidden=true;if(!l?.userData.ready||!h?.userData.ready)return;
    for(let o=l;o;o=o.parent)if(!o.visible)return;
    l.getWorldPosition(point);h.getWorldPosition(handA);point.add(handA).multiplyScalar(.5);point.y-=.14;
    // 전체 승강로 시점에서는 작은 공구의 선택 윤곽까지 그리지 않는다.
    if(camera.position.distanceToSquared(point)>100)return;
    point.project(camera);
    if(point.z<-1||point.z>1||Math.abs(point.x)>.95||Math.abs(point.y)>.9)return;
    button.hidden=false;PartActions.positionButton(button,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
  }
  function reset(){
    if(!state.active)return false;state.active=false;jobs.forEach(t=>t.kill());jobs=[];clearTimeout(autoTimer);CarDoor.state.timeline?.kill();
    if(state.call)HallInspector.end();EmergencyCall.setManualLink(false);friend?.endInspection();Mascot.endInspection();Mascot.root.scale.copy(saved.bearScale);
    restore(saved.lever);restore(saved.handle);restore(saved.receiver);cord.visible=saved.cordVisible;if(wire)wire.visible=false;
    [leverPivot,handlePivot,receiverPivot].forEach(p=>{if(p)scene.remove(p);});leverPivot=handlePivot=receiverPivot=null;
    const q=CarDoor.state,h=hatchDoors[state.floor];q.busy=false;q.closeCallbacks=[];q.release=0;q.coupledFloor=-1;h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;
    hatchDoors.forEach((d,f)=>{gsap.killTweensOf(d.hook.rotation);d.right.position.x=d.right.userData.cx;d.left.position.x=d.left.userData.cx;setEmergencyKey(f,0);spinDoorDrive(d);HallInterlock.update(d);});
    carDoorR.position.x=q.d.cx;CarDoor.pose();doorOpen=false;
    setY(saved.carY);cwtGrp.position.y=saved.cwtY;curFloor=saved.floor;saved.spin.forEach(restore);refreshRopes();refreshGovernorRope();saved.passenger.forEach(restore);
    setTractionBrake(saved.brake,true);MACH.motorOff();MACH.brakeSet();estop=false;moving=false;currentState=ELEVATOR_STATE.IDLE;
    if(EmergencyLighting.on!==saved.emergency)EmergencyLighting.toggle();
    camera.position.copy(saved.camera.p);camera.quaternion.copy(saved.camera.q);camera.fov=saved.fov;camera.near=saved.near;camera.updateProjectionMatrix();controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damp;controls.minDistance=saved.min;controls.update();
    panel.hidden=true;document.body.classList.remove('manual-rescue-active');Object.assign(state,{stage:'idle',brakeReleased:false,handleAttached:false,level:false,call:false,exited:false});
    syncAllIndicators(curFloor+1,'');updateStatus('v-dir','정지 대기','#8b949e');updateStatus('v-spd','0 m/min');updateStatus('v-door','닫힘','#3fb950');
    if(saved.door)openDoors();return true;
  }
  return {build,start,update,reset,get active(){return state.active;},state,get friend(){return friend;},get handlePivot(){return handlePivot;},get leverPivot(){return leverPivot;},get receiverPivot(){return receiverPivot;}};
})();
