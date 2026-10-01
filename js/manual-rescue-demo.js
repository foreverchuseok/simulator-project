// 수동 구출 교육 시연. 자동운전/ARD를 사용하지 않고 기존 도어·로프·웜 피벗을 공유한다.
const ManualRescueDemo=(()=>{
  const state={active:false,stage:'idle',floor:1,brakeReleased:false,handleAttached:false,level:false,call:false,exited:false};
  let button,panel,title,detail,gap,friend,lever,handle,phone,receiver,cord,saved,jobs=[];
  let leverPivot,handlePivot,receiverPivot,wire,actors,selector,breaker;
  const platforms=[];
  const CREW_SCALE=.76, PACE=1.65, FAULT_GAP=.28, WIND_SECONDS=7;
  let otherLever,otherPivot,impact,levelMarker;
  const point=new THREE.Vector3(),handA=new THREE.Vector3(),handB=new THREE.Vector3(),normal=new THREE.Vector3();
  const keyPose={approach:0,insert:0,key:0,walk:0,carry:0,foot:0};
  const own=t=>{t.timeScale(PACE);jobs.push(t);return t;},later=(seconds,fn)=>own(gsap.delayedCall(seconds,()=>{if(state.active)fn();}));
  const tr=()=>mrGrp.userData.traction;
  const toolSpec=()=>handle.userData.manualRescue;
  const passenger=()=>UCMDemo.character;
  function stage(name,text,sub){state.stage=name;panel.dataset.stage=name;title.textContent=text;detail.textContent=sub||'';updateStatus('v-dir',text,'#f0883e');}
  function ready(){return ControlPanel.ready&&!ControlPanel.busy&&MachineRoomPower.ready&&!MachineRoomPower.busy&&tr()?.ready&&tr().contract.manualRescue&&scene.getObjectByName('ReleaseLeverHung')?.userData.ready&&scene.getObjectByName('TurningHandleHung')?.userData.ready&&scene.getObjectByName('IntercomHandset')&&CarDoor.state?.ready&&hatchDoors.every(h=>h.interlock?.ready);}
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
      lever:capture(lever),handle:capture(handle),receiver:capture(receiver),cordVisible:cord.visible,bearScale:Mascot.root.scale.clone(),bearFloor:Mascot.root.position.y,brake:tr().brakeOpen,controlOpen:ControlPanel.open,powerOpen:MachineRoomPower.open,selector:capture(selector),breaker:capture(breaker),
      spin:[mainSheaveGrp,deflectorSheaveGrp,governorWheelGrp,tensionSheaveGrp,tr().worm].map(capture),passenger:[]};
    passenger().traverse(o=>saved.passenger.push(capture(o)));
  }
  function start(){
    if(state.active)return false;if(blocked()){updateStatus('v-dir','운행·다른 시연을 마친 뒤 수동 구출을 실행하세요.','#f0883e');return false;}
    lever=scene.getObjectByName('ReleaseLeverHung');handle=scene.getObjectByName('TurningHandleHung');phone=scene.getObjectByName('ControlPanelIntercom');receiver=phone.getObjectByName('IntercomHandset');cord=phone.getObjectByName('IntercomCord');
    if(!friend)friend=Mascot.createWorker('ManualRescueHelmetedFriend');
    selector=ControlPanel.root.getObjectByName('ManualModeSelector');breaker=MachineRoomPower.root.getObjectByName('MainBreakerToggle');
    if(!selector||!breaker)return false;
    if(!actors)actors=[Mascot,friend].map(worker=>({worker,rig:Mascot.rescueRig(worker,.26),p:new THREE.Vector3(),yaw:Math.PI,hand:null,carry:null,walking:false,phase:0}));
    leaveCabinView();closeAllMenus();snapshot();clearTimeout(autoTimer);EmergencyCall.hangUp();jobs=[];
    Object.assign(state,{active:true,stage:'preparing',manual:false,powerOff:false,brakeReleased:false,handleAttached:false,level:false,call:false,exited:false});
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
    const g=tr().worm.parent;g.updateWorldMatrix(true,true);point.fromArray(tr().contract.manualRescue.shaftCenter);g.localToWorld(point);
    const d=Math.max(1.18, .95/camera.aspect);
    cameraTo(point.clone().add(new THREE.Vector3(-1.10,1.45*d,1.85*d)),point.clone().add(new THREE.Vector3(.15,.04,-.1)),seconds);
  }
  function showLevelMarker(){
    if(!levelMarker){
      levelMarker=new THREE.Group();levelMarker.name='ManualRescueLevelReference';scene.add(levelMarker);
      const mat=M.emit(0xffbd45);mat.depthTest=false;mat.depthWrite=false;
      createBox(.025,.018,S.CAR_D+.10,mat,0,0,0,levelMarker);
      createBox(.025,FAULT_GAP,.018,mat,0,-FAULT_GAP/2,-S.CAR_D*.28,levelMarker);
      createBox(.025,.018,.22,mat,0,-FAULT_GAP,-S.CAR_D*.28,levelMarker);
    }
    levelMarker.position.set(S.CAR_W/2+.03,FLOOR_Y[state.floor],CAR_CTR_Z);levelMarker.visible=true;
  }
  function fault(){
    state.floor=THREE.MathUtils.clamp(insNearestFloor(),1,FLOORS-1);state.targetY=FLOOR_Y[state.floor]+S.CAR_H/2;
    UCMDemo.neutral();passenger().visible=true;passenger().position.set(0,0,CAR_CTR_Z);passenger().rotation.set(0,0,0);
    estop=true;moving=true;currentState=ELEVATOR_STATE.ESTOP;setTractionBrake(true,true);setY(state.targetY-1.10);
    stage('riding','승객 탑승 · 이동 중','층으로 이동하던 중 갑자기 고장이 발생합니다.');
    const fy=FLOOR_Y[state.floor],d=Math.max(4.1,2.4/camera.aspect);
    cameraTo(new THREE.Vector3(d,fy+1.35,CAR_CTR_Z-.80),new THREE.Vector3(0,fy+.35,CAR_CTR_Z+.10),.5);
    MACH.motorOn();MACH.setDrive(.45);updateStatus('v-spd','이동 중');
    const ride={y:carGrp.position.y};
    own(gsap.to(ride,{y:state.targetY-FAULT_GAP,duration:2.8,ease:'power1.in',onUpdate:()=>{
      setY(ride.y);passenger().rotation.z=Math.sin(performance.now()*.003)*.018;
    },onComplete:()=>{
      moving=false;MACH.motorOff();setTractionBrake(false,true);MACH.brakeSet();MACH.ucmBrakeFailure();
      updateStatus('v-spd','0 m/min');syncAllIndicators(state.floor+1,'고장');
      if(!EmergencyLighting.on)EmergencyLighting.toggle();showLevelMarker();
      stage('trapped','쿵! 고장 정지 · 승객 갇힘',`노란선: 층 바닥 · 카는 ${Math.round(FAULT_GAP*100)}cm 아래\n레벨존 밖 / ARD 불가 · 문 잠김`);
      impact=renderer.domElement.animate([{transform:'translateY(0)'},{transform:'translateY(7px)'},{transform:'translateY(-4px)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:380});
      own(gsap.timeline().to(passenger().rotation,{z:-.13,duration:.13}).to(passenger().rotation,{z:.05,duration:.20}).to(passenger().rotation,{z:0,duration:.3}));
      later(4.5,()=>{levelMarker.visible=false;prepareCrew();});
    }}));
  }

  function pivot(name,object,seat,world,q){
    const p=new THREE.Group();p.name=name;scene.add(p);p.position.copy(world);p.add(object);object.quaternion.copy(q);object.position.copy(seat).applyQuaternion(q).multiplyScalar(-1);return p;
  }
  // 축소한 작업자의 손잡이/어깨 좌표에 맞춘 작업 발판.
  // 생성은 시연 준비 때만 하고 다음 실행에서는 재사용한다.
  function platform(position,yaw,name){
    let g=platforms.find(p=>p.name===name);
    const h=Math.max(.04,position.y-saved.bearFloor),n=Math.ceil(h/.20),step=.19;
    if(!g){
      g=new THREE.Group();g.name=name;scene.add(g);platforms.push(g);
      const metal=M.ss(),tread=M.paint(0x253c4b),edge=M.paint(0xe9bb34);
      createBox(.40,.035,.48,tread,0,h-.0175,0,g);
      for(const x of [-.17,.17])for(const z of [-.20,.20])createBox(.035,h,.035,metal,x,h/2,z,g);
      for(let i=1;i<n;i++){
        const y=h*i/n,z=.24+(n-i)*step;
        createBox(.40,.035,step,tread,0,y-.0175,z,g);createBox(.40,.018,.025,edge,0,y-.009,z+step/2,g);
        for(const x of [-.17,.17])createBox(.025,y,.025,metal,x,y/2,z,g);
      }
      // 작업 방향은 열어 두고 낮은 측면 손잡이는 팔 회전 범위 아래에 둔다.
      for(const x of [-.21,.21]){
        createBox(.025,.18,.025,metal,x,h+.09,.18,g);createBox(.025,.025,.24,metal,x,h+.18,.10,g);
      }
      g.userData={height:h,steps:n,run:step*(n-1)+.40};
    }
    g.position.set(position.x,saved.bearFloor,position.z);
    g.rotation.y=name.endsWith('WallStep')||['ControlStep','BreakerStep'].includes(name)?0:yaw-Math.PI;
    g.visible=true;g.updateWorldMatrix(true,true);
    return g;
  }
  function moveActor(a,p,yaw,duration,done){
    const delta=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw));a.walking=true;
    own(gsap.to(a,{yaw:a.yaw+delta,duration:Math.min(.65,duration)}));
    own(gsap.to(a.p,{x:p.x,y:p.y,z:p.z,duration,ease:'none',onComplete:()=>{a.walking=false;done?.();}}));
  }
  function travel(a,dest,yaw,name,done){
    const g=platform(dest,yaw,name),entry=new THREE.Vector3(0,0,g.userData.run);g.localToWorld(entry);
    const arrive=()=>{
      const n=g.userData.steps;let i=0;
      function stepUp(){if(i===n){a.platform=g;moveActor(a,dest,yaw,.6,done);return;}i++;
        const p=entry.clone().lerp(dest,i/n);moveActor(a,p,g.rotation.y+Math.PI,.42,stepUp);
      }stepUp();
    };
    const walk=()=>{
      // 권상기 체대 안을 대각선으로 가로지르지 않고 앞쪽 통로를 이용한다.
      const waypoints=[];
      if(a.p.z<1.60)waypoints.push(new THREE.Vector3(a.p.x,saved.bearFloor,1.65));
      waypoints.push(new THREE.Vector3(entry.x,saved.bearFloor,1.65),entry);
      function next(){const p=waypoints.shift();if(!p){arrive();return;}const d=a.p.distanceTo(p);if(d<.02){next();return;}moveActor(a,p,Math.atan2(p.x-a.p.x,p.z-a.p.z),Math.max(.3,d/.65),next);}next();
    };
    if(a.platform){const old=a.platform,exit=new THREE.Vector3(0,0,old.userData.run);old.localToWorld(exit);a.platform=null;moveActor(a,exit,old.rotation.y,1.8,()=>{old.visible=false;walk();});}else walk();
  }
  function reach(a,target,done){
    a.hand=a.worker.rig.holdArm.userData.rig.paw.getWorldPosition(new THREE.Vector3());
    own(gsap.to(a.hand,{x:target.x,y:target.y,z:target.z,duration:.8,ease:'power2.inOut',onComplete:done}));
  }
  function prepareCrew(){
    Mascot.beginInspection();friend.beginInspection();
    actors.forEach(a=>{a.worker.root.scale.setScalar(CREW_SCALE);a.worker.rig.eyes.forEach(e=>e.scale.y=.032);a.p.copy(a.worker.root.position);a.yaw=a.worker.root.rotation.y;a.hand=null;a.carry=null;a.toolGrip=null;a.secondGrip=null;a.platform=null;a.walking=false;});
    // 동료는 통로에서 기다린 뒤 공구를 가져온다.
    actors[1].p.set(.7,saved.bearFloor,1.45);actors[1].yaw=-Math.PI/2;
    stage('control-manual','제어반 · 자동 → 수동','고장 상태를 확인하고 수동 위치로 전환합니다.');
    if(!ControlPanel.open)ControlPanel.toggle();
    later(1.3,()=>operateSwitch(selector,'ControlStep',()=>{
      own(gsap.to(selector.rotation,{z:1.2,duration:.7,onComplete:()=>{state.manual=true;later(1.5,isolatePower);}}));
    }));
  }
  function operateSwitch(node,name,done){
    const target=node.getWorldPosition(new THREE.Vector3()),a=actors[0],yaw=-Math.PI/2;
    const dest=target.clone().add(new THREE.Vector3(.30,-.36*CREW_SCALE,-.185*CREW_SCALE));
    const d=Math.max(1.8,1.15/camera.aspect);cameraTo(target.clone().add(new THREE.Vector3(d,.3,d*.45)),target.clone().add(new THREE.Vector3(.15,-.3,0)));
    travel(a,dest,yaw,name,()=>reach(a,target,done));
  }
  function isolatePower(){
    actors[0].hand=null;stage('power-off','분전함 · 주전원 차단','수동 전환 후 주전원을 OFF로 내립니다.');
    if(!MachineRoomPower.open)MachineRoomPower.toggle();
    later(1,()=>operateSwitch(breaker,'BreakerStep',()=>{
      own(gsap.to(breaker.rotation,{x:-.65,duration:.65,onComplete:()=>{state.powerOff=true;later(1.5,tools);}}));
    }));
  }
  function fetchTool(a,object,grip,seat,world,q,name,stand,done,yaw=Math.PI){
    const pickup=object.localToWorld(grip.clone()),dest=pickup.clone().add(new THREE.Vector3(.26*CREW_SCALE,-.36*CREW_SCALE,-.185*CREW_SCALE));
    const d=Math.max(2.1,1.6/camera.aspect);cameraTo(pickup.clone().add(new THREE.Vector3(d,.25,d*.8)),pickup.clone().add(new THREE.Vector3(.2,-.25,0)));
    a.hand=null;
    travel(a,dest,-Math.PI/2,name+'WallStep',()=>reach(a,pickup,()=>{
      scene.attach(object);a.worker.root.updateMatrixWorld(true);
      a.carry={object,grip:grip.clone(),local:a.worker.root.worldToLocal(pickup.clone()),q:a.worker.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(object.quaternion)};a.hand=null;
      // 걸이에서 먼저 들어 올리고 몸 앞으로 당긴 다음 운반한다.
      own(gsap.to(a.carry.local,{y:a.carry.local.y+.07,duration:.5,onComplete:()=>{
        own(gsap.to(a.carry.local,{x:.185,y:.36,z:.28,duration:.8,onComplete:()=>{
          machineShot(1.4);
          travel(a,stand,yaw,name+'WorkStep',()=>{
            object.updateWorldMatrix(true,true);const p0=object.position.clone(),q0=object.quaternion.clone(),end=seat.clone().applyQuaternion(q).multiplyScalar(-1).add(world),s={t:0};
            a.carry=null;a.toolGrip={object,grip};
            own(gsap.to(s,{t:1,duration:2.2,ease:'power2.inOut',onUpdate:()=>{object.position.lerpVectors(p0,end,s.t);object.quaternion.copy(q0).slerp(q,s.t);},onComplete:()=>done(pivot(name,object,seat,world,q))}));
          });
        }}));
      }}));
    }));
  }
  function tools(){
    if(!state.manual||!state.powerOff)return;
    actors[0].hand=null;
    stage('handle-mount','핸들 가져오기 · 축에 결합','친구가 벽에서 핸들을 꺼내 들고 발판을 올라 정면에서 끼웁니다.');
    const c=tr().contract.manualRescue,world=tr().worm.parent.localToWorld(new THREE.Vector3(...c.shaftCenter));
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
    const stand=world.clone().add(new THREE.Vector3(.185*CREW_SCALE,-.36*CREW_SCALE,.26*CREW_SCALE));
    fetchTool(actors[1],handle,new THREE.Vector3(...toolSpec().handleGrip),new THREE.Vector3(...toolSpec().handleHub),world,q,'ManualHandlePivot',stand,p=>{
      handlePivot=p;state.handleAttached=true;state.worm0=tr().worm.rotation.z;
      stage('handle-seated','핸들 결합 완료 · 브레이크 닫힘','축 결합을 확인하고 핸들을 잡은 자세로 기다립니다.');
      machineShot(.75);
      later(1.8,mountLever);
    });
  }
  function lugWorld(index=1){
    const c=tr().contract,sign=index===0?-1:1,arm=tr().arms[index];
    return arm.localToWorld(point.fromArray(c.manualRescue.releaseLugs[index]).sub(new THREE.Vector3(c.wheelX+sign*c.brakeArmX,c.brakePivotY,c.drumZ)));
  }
  function poseLevers(t){
    [otherPivot,leverPivot].forEach((p,i)=>{
      tr().arms[i].rotation.z=(i===0?1:-1)*tr().contract.manualRescue.releaseAngle*t;
      p.rotation.set(-.40*t,0,(i===0?1:-1)*.08*t);p.position.copy(lugWorld(i));
    });
  }
  function mountLever(){
    stage('lever-mount','승강곰 · 코일 양옆 레버 결합','금색 코일 양옆에 레버 앞부분을 끼우고 브레이크를 바라봅니다.');
    const world=lugWorld().clone(),q=new THREE.Quaternion();
    const grip=new THREE.Vector3(...toolSpec().leverGrip),seat=new THREE.Vector3(...toolSpec().leverSeat);
    const center=world.clone().add(lugWorld(0)).multiplyScalar(.5);
    const stand=center.clone().add(new THREE.Vector3(0,grip.y-seat.y-.36*CREW_SCALE,-.25));
    fetchTool(actors[0],lever,grip,seat,world,q,'ManualReleaseLeverPivot',stand,p=>{
      leverPivot=p;
      if(!otherLever){otherLever=lever.clone(true);otherLever.name='ManualReleaseLeverOther';}
      otherLever.visible=true;otherLever.scale.copy(lever.scale);
      otherPivot=pivot('ManualReleaseLeverOtherPivot',otherLever,seat,lugWorld(0).clone(),q);
      actors[0].toolGrip={object:lever,grip};actors[0].secondGrip={object:otherLever,grip};
      const d=Math.max(1.1,1/camera.aspect);
      cameraTo(center.clone().add(new THREE.Vector3(-1.15,.9*d,1.6*d)),center.clone().add(new THREE.Vector3(0,.12,-.08)),.65);
      const v={t:0};stage('brake-release','양손으로 당기기 · 이중 브레이크 개방','코일 양옆 레버를 승강곰 쪽으로 당겨 양쪽 브레이크를 벌립니다.');
      own(gsap.to(v,{t:1,duration:1.8,onUpdate:()=>poseLevers(v.t),onComplete:()=>{
        tr().brakeOpen=true;state.brakeReleased=true;later(1.3,()=>{machineShot(.6);wind();});
      }}));
    },0);
  }
  function wind(){
    if(!state.manual||!state.powerOff||!state.brakeReleased||!state.handleAttached||!tr().brakeOpen)return;
    stage('winding','핸들 수동 회전 · 카를 조금 상승','승강곰은 브레이크 개방을 유지하고 친구가 핸들을 돌립니다.');
    moving=true;const p={y:carGrp.position.y};
    own(gsap.to(p,{y:state.targetY,duration:WIND_SECONDS*PACE,ease:'none',onUpdate:()=>{
      if(!state.brakeReleased||!tr().brakeOpen)return;setY(p.y);handlePivot.rotation.z=tr().worm.rotation.z-state.worm0;
      updateStatus('v-spd',`수동 · ${(FAULT_GAP/WIND_SECONDS*60).toFixed(1)} m/min`);
    },onComplete:level}));
    later(3.5*PACE,()=>{carShot(.7);stage('level-approach','카 상승 · 착상 높이 맞춤','카와 균형추가 반대로 이동합니다. 핸들 회전으로 천천히 높이를 맞춥니다.');});
  }
  function level(){
    moving=false;state.level=CarDoor.alignedFloor()===state.floor;curFloor=state.floor;state.brakeReleased=false;tr().brakeOpen=false;setTractionBrake(false,true);updateGap();updateStatus('v-spd','0 m/min');
    poseLevers(0);stage('level','착상 완료 · 브레이크 다시 체결','카를 정지시킨 뒤 인터폰 통화와 삼각키 개방을 진행합니다.');later(3,callPassenger);
  }
  function callPassenger(){
    actors.forEach(a=>{a.hand=null;a.toolGrip=null;a.secondGrip=null;});
    stage('phone-approach','브레이크 체결 확인 · 인터폰으로 이동','공구를 멈춘 뒤 발판을 내려와 승객에게 연락합니다.');
    const c=phone.getObjectByName('IntercomPhoneRoot').userData;
    phone.updateWorldMatrix(true,true);const target=phone.localToWorld(new THREE.Vector3(...c.handsetCenter));
    const n=new THREE.Vector3(0,0,1).transformDirection(phone.matrixWorld),yaw=Math.atan2(-n.x,-n.z);
    const dest=target.clone().addScaledVector(n,.32);dest.y=Math.max(saved.bearFloor,target.y-.60*CREW_SCALE);
    cameraTo(target.clone().addScaledVector(n,2).add(new THREE.Vector3(1,.25,.5)),target.clone().add(new THREE.Vector3(0,-.25,0)));
    travel(actors[0],dest,yaw,'PhoneStep',liftReceiver);
  }
  function liftReceiver(){
    // 공구는 브레이크 재체결 후에도 장착 위치에 둔다. 벽으로 순간 이동시키지 않는다.
    actors.forEach(a=>{a.hand=null;a.toolGrip=null;a.secondGrip=null;});
    state.call=true;EmergencyCall.setManualLink(true);stage('intercom','승강곰 · 기계실 인터폰 통화','“층에 도착했습니다. 친구가 문을 열고 있으니 기다려 주세요.”');
    phone.updateWorldMatrix(true,true);const c=phone.getObjectByName('IntercomPhoneRoot').userData;
    point.fromArray(c.handsetCenter);phone.localToWorld(point);normal.set(0,0,1).transformDirection(phone.matrixWorld);
    // 전화 앞면 쪽에 서서 귀에 수화기를 댄다. 헤드/팔 위치는 현재 캐릭터 축척에서 파생한다.
    state.phoneBear=actors[0].p.clone();
    state.phoneYaw=Math.atan2(-normal.x,-normal.z);
    const ear=state.phoneBear.clone().add(new THREE.Vector3(-.235,.60,0).multiplyScalar(CREW_SCALE).applyAxisAngle(new THREE.Vector3(0,1,0),state.phoneYaw));
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
    actors[1].rig.reset();friend.root.scale.setScalar(CREW_SCALE);HallInspector.begin(state.floor,friend);
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
      if(receiverPivot){handA.copy(receiverPivot.position);Mascot.inspectionPose(state.phoneBear.x,state.phoneBear.y,state.phoneBear.z,0,null,null,state.phoneYaw);actors[0].rig.pose(null,handA);}
      if(['key-approach','key-turn','opening','exit','done'].includes(state.stage))HallInspector.pose(state.floor,keyPose);
      return;
    }
    if(!Mascot.inspecting)return;
    for(const a of actors){
      const w=a.worker;w.inspectionPose(a.p.x,a.p.y,a.p.z,0,null,null,a.yaw);
      if(a.walking)a.phase=performance.now()*.008;
      w.rig.feet.forEach((f,i)=>{f.position.y=a.walking?Math.max(0,Math.sin(a.phase+i*Math.PI))*.045:0;f.position.z=a.walking?Math.sin(a.phase+i*Math.PI)*.05:0;});
      let target=a.hand;
      if(a.carry){
        const c=a.carry;w.root.updateMatrixWorld(true);handA.copy(c.local);w.root.localToWorld(handA);
        c.object.quaternion.copy(w.root.quaternion).multiply(c.q);c.object.position.copy(c.grip).applyQuaternion(c.object.quaternion).multiplyScalar(-1).add(handA);target=handA;
      }else if(a.toolGrip){const g=a.toolGrip;g.object.updateWorldMatrix(true,true);handA.copy(g.grip);g.object.localToWorld(handA);target=handA;}
      let second=null;if(a.secondGrip){const g=a.secondGrip;g.object.updateWorldMatrix(true,true);handB.copy(g.grip);g.object.localToWorld(handB);second=handB;}
      a.rig.pose(target,second);
    }
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
    if(!state.active)return false;state.active=false;jobs.forEach(t=>t.kill());jobs=[];clearTimeout(autoTimer);CarDoor.state.timeline?.kill();impact?.cancel();if(levelMarker)levelMarker.visible=false;
    if(state.call)HallInspector.end();EmergencyCall.setManualLink(false);actors?.forEach(a=>{a.rig.reset();a.carry=null;a.toolGrip=null;a.secondGrip=null;a.hand=null;a.platform=null;});platforms.forEach(p=>p.visible=false);friend?.endInspection();Mascot.endInspection();Mascot.root.scale.copy(saved.bearScale);
    restore(saved.selector);restore(saved.breaker);
    ControlPanel.restoreOpen(saved.controlOpen);MachineRoomPower.restoreOpen(saved.powerOpen);
    restore(saved.lever);restore(saved.handle);restore(saved.receiver);cord.visible=saved.cordVisible;if(wire)wire.visible=false;
    [leverPivot,otherPivot,handlePivot,receiverPivot].forEach(p=>{if(p)scene.remove(p);});leverPivot=otherPivot=handlePivot=receiverPivot=null;
    const q=CarDoor.state,h=hatchDoors[state.floor];q.busy=false;q.closeCallbacks=[];q.release=0;q.coupledFloor=-1;h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;
    hatchDoors.forEach((d,f)=>{gsap.killTweensOf(d.hook.rotation);d.right.position.x=d.right.userData.cx;d.left.position.x=d.left.userData.cx;setEmergencyKey(f,0);spinDoorDrive(d);HallInterlock.update(d);});
    carDoorR.position.x=q.d.cx;CarDoor.pose();doorOpen=false;
    setY(saved.carY);cwtGrp.position.y=saved.cwtY;curFloor=saved.floor;saved.spin.forEach(restore);refreshRopes();refreshGovernorRope();saved.passenger.forEach(restore);
    setTractionBrake(saved.brake,true);MACH.motorOff();MACH.brakeSet();estop=false;moving=false;currentState=ELEVATOR_STATE.IDLE;
    if(EmergencyLighting.on!==saved.emergency)EmergencyLighting.toggle();
    camera.position.copy(saved.camera.p);camera.quaternion.copy(saved.camera.q);camera.fov=saved.fov;camera.near=saved.near;camera.updateProjectionMatrix();controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damp;controls.minDistance=saved.min;controls.update();
    panel.hidden=true;document.body.classList.remove('manual-rescue-active');Object.assign(state,{stage:'idle',manual:false,powerOff:false,brakeReleased:false,handleAttached:false,level:false,call:false,exited:false});
    syncAllIndicators(curFloor+1,'');updateStatus('v-dir','정지 대기','#8b949e');updateStatus('v-spd','0 m/min');updateStatus('v-door','닫힘','#3fb950');
    if(saved.door)openDoors();return true;
  }
  return {build,start,update,reset,get active(){return state.active;},state,get actors(){return actors;},get friend(){return friend;},get handlePivot(){return handlePivot;},get leverPivot(){return leverPivot;},get receiverPivot(){return receiverPivot;}};
})();
