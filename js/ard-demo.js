// 교육용 ARD 시연. 표시 시간 10초는 각각 실시간 3.45초(기존보다 15% 길게)다.
// 기존 CarDoor/FSM/로프 구동을 공유하고, 시연 종료 후 명시적 전원 복구까지 호출을 차단한다.
const ARDDemo = (() => {
  const state = { active:false, stage:'idle', floor:0, countdown:0, cycles:0, direction:1 };
  const COUNT_STEP=.3*1.15;
  const point=new THREE.Vector3(), hand=new THREE.Vector3(), reach={t:0};
  const walk={active:false,x:0,z:0,yaw:0,step:0};
  let button, panel, alarm, title, detail, count, restore, ard, outline, saved, jobs=[], epoch=0, internal=false;
  let lights=[], materials=[], opb, opbZ=0;
  const voice=()=>snd.powerFailure;
  const own=t=>{jobs.push(t);return t;};
  function later(t,fn){const id=epoch;return own(gsap.delayedCall(t,()=>{if(state.active&&id===epoch)fn();}));}
  function call(fn){internal=true;try{return fn();}finally{internal=false;}}
  function stage(s,text,sub=''){state.stage=s;panel.dataset.stage=s;title.textContent=text;detail.textContent=sub;panel.hidden=false;updateStatus('v-dir',text,'#f0883e');}
  function blocked(){
    return insMode?'점검운전 중에는 ARD를 실행할 수 없습니다.'
      :DoorBypass.mode!=='off'?'BYPASS 해제 후 자동 모드에서 실행하세요.'
      :estop||overspeedActive||governorPhase==='tripped'?'안전장치 정지·고장을 먼저 복귀하세요.'
      :BufferDemo.active||InterlockDemo.active||UCMDemo.state.active||InspectionReturn.busy||HallManual.active?'다른 시연·점검을 마친 뒤 실행하세요.'
      :!PitLadder.secured||!DoorBypass.hallSecured()?'사다리 고정·승장문 잠금을 확인하세요.'
      :!MachineRoomPower.ready||!EmergencyLighting.ready||!CarDoor.state?.ready?'ARD·비상등·도어 준비 중입니다.':'';
  }
  function build(){
    const style=document.createElement('style');style.textContent=`
      .ard-active .part-action,.ard-active #hall-panel,.ard-active #inspection-drive{visibility:hidden!important}
      .ard-active #rail,.ard-active #mobile-visibility{visibility:hidden}
      .ard-active #fbtns,.ard-active #btn-open,.ard-active #btn-close{display:none!important}
      #ard-panel{position:fixed;z-index:65;left:50%;bottom:88px;transform:translateX(-50%);width:min(324px,84vw);box-sizing:border-box;padding:8px 12px;border:1px solid #70cebb66;border-radius:10px;background:#091c28e8;color:#edfaff;text-align:center;box-shadow:0 8px 24px #0005;font:10px/1.4 sans-serif}
      #ard-panel[hidden],#ard-alarm[hidden]{display:none}
      #ard-panel strong{display:block;font-size:13px}#ard-detail{color:#a7c6d3;font-size:10px;margin:3px 0}
      #ard-count{font:bold 28px/1.15 sans-serif;color:#a5ffe4;font-variant-numeric:tabular-nums}
      #ard-panel button{min-height:44px;margin:5px 2px 0;padding:5px 10px;border:1px solid #9bd9ca77;border-radius:7px;background:#254653;color:white;font:600 11px sans-serif;cursor:pointer}
      #ard-panel:not([data-stage="done"]):not([data-stage="halted"]) #ard-restore{display:none}
      #ard-alarm{position:fixed;inset:0;display:grid;place-content:center;z-index:60;pointer-events:none;background:#02081370;text-align:center;color:#fff;font:900 clamp(44px,9vw,100px)/1.3 sans-serif;text-shadow:0 0 35px #ff6136}
      #ard-alarm small{font:600 16px sans-serif;letter-spacing:.2em;color:#ffb393}
      .ard-blackout canvas{animation:ard-cut .55s ease-out}
      @keyframes ard-cut{0%{filter:brightness(1)}18%{filter:brightness(.05)}35%{filter:brightness(.8)}65%,100%{filter:brightness(.15)}}
      @media(max-width:600px){#ard-panel{padding:6px 10px;width:min(280px,80vw)}#ard-panel strong{font-size:11px}#ard-count{font-size:22px}}
    `;document.head.appendChild(style);
    button=document.createElement('button');button.id='ard-action';button.className='part-action';button.hidden=true;
    button.title='ARD 자동구출운전 시연';button.setAttribute('aria-label',button.title);
    button.style.setProperty('--part-icon','url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="5" width="15" height="15" rx="2"/><path d="M9 2h5M20 10h2v5h-2M13 8l-4 5h4l-2 4"/></svg>')+'")');
    button.addEventListener('click',start);document.getElementById('part-actions').appendChild(button);
    PartGlow.bind(button,()=>MachineRoomPower.root?.getObjectByName('ARDInstallation'),'ARD 자동구출장치');
    panel=document.createElement('section');panel.id='ard-panel';panel.hidden=true;panel.setAttribute('aria-label','자동구출운전 시연');
    panel.innerHTML='<strong id="ard-title" role="status"></strong><div id="ard-detail"></div><div id="ard-count"></div><button id="ard-restore">전원 복구</button>';
    document.body.appendChild(panel);title=panel.querySelector('strong');detail=panel.querySelector('#ard-detail');count=panel.querySelector('#ard-count');
    restore=panel.querySelector('#ard-restore');restore.addEventListener('click',reset);
    alarm=document.createElement('div');alarm.id='ard-alarm';alarm.hidden=true;alarm.innerHTML='<small>POWER FAILURE</small>정전입니다';document.body.appendChild(alarm);
    // 기존 UI의 포인터·키보드·단축 클릭이 자동 시연과 경합하지 않도록 캡처한다. STOP은 계속 유효하다.
    for(const type of ['click','pointerdown','keydown','change','dblclick'])document.addEventListener(type,e=>{
      // 공통 일시정지 버튼과, 멈춘 동안의 화면 둘러보기는 통과시킨다(js/demo-pause.js).
      if(!state.active||panel.contains(e.target)||e.target.closest?.('#btn-estop')||e.target.closest?.('#demo-pause')||(DemoPause.paused&&e.target.closest?.('canvas')))return;
      if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}
    },true);
  }
  function snapshot(){
    lights=[];materials=[];const seen=new Set();
    scene.traverse(o=>{
      if(o.isLight&&!o.name.startsWith('emergencyLamp'))lights.push([o,o.intensity]);
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.emissive&&!seen.has(m)){seen.add(m);materials.push([m,m.emissiveIntensity,m.envMapIntensity]);}
    });
    saved={p:camera.position.clone(),t:controls.target.clone(),fov:camera.fov,near:camera.near,enabled:controls.enabled,damp:controls.enableDamping,min:controls.minDistance,
      emergency:EmergencyLighting.on,emergencyRange:EmergencyLighting.lamps.map(l=>l.getObjectByName('emergencyLampLight').distance),background:scene.background?.clone(),fog:scene.fog?.color.clone()};
  }
  function darkness(cabin=false){
    lights.forEach(([l,v])=>l.intensity=v*(l.name==='carLight'?0:cabin?.07:.24));
    materials.forEach(([m,,env])=>{m.emissiveIntensity=0;if(env!==undefined)m.envMapIntensity=env*(cabin?.025:.18);});
    if(scene.background?.isColor)scene.background.setHex(0x09111c);
    if(scene.fog)scene.fog.color.setHex(0x09111c);
    if(EmergencyLighting.on)EmergencyLighting.toggle();EmergencyLighting.toggle();
    EmergencyLighting.lamps[1].getObjectByName('emergencyLampLight').distance=3.2;
  }
  function start(){
    if(state.active)return false;const why=blocked();if(why){updateStatus('v-dir',why,'#f0883e');return false;}
    const wasMoving=moving, dir=gsap.getTweensOf(carGrp.position).find(t=>Number.isFinite(t.vars.y));
    state.direction=wasMoving&&dir?Math.sign(dir.vars.y-carGrp.position.y)||1:insNearestFloor()===FLOORS-1?-1:1;
    clearTimeout(autoTimer);gsap.killTweensOf(carGrp.position);gsap.killTweensOf(cwtGrp.position);moving=false;MACH.motorOff();
    leaveCabinView();closeAllMenus();snapshot();epoch++;state.active=true;state.cycles=0;
    document.body.classList.add('ard-active');controls.enabled=false;controls.enableDamping=false;controls.minDistance=.02;camera.near=.002;camera.updateProjectionMatrix();
    gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    Mascot.beginInspection();reach.t=0;walk.active=false;state.exited=false;state.reopenGap=null;opb=carGrp.getObjectByName('opbDoorOpen');opbZ=opb.position.z;
    MACH.resume();stage('preparing','ARD 시연 준비','자동운전 중 정전 상황을 재현합니다.');
    const prepare=()=>{if(!state.active)return;if(CarDoor.state.busy){later(.1,prepare);return;}
      call(()=>closeDoors(()=>{if(state.active&&state.stage==='preparing')depart();}));};prepare();return true;
  }
  function setY(y){
    const delta=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=delta;spinSheaves(delta);refreshRopes();refreshGovernorRope();
    const l=scene.getObjectByName('carLight');if(l)l.position.y=y+S.CAR_H*.75;
    syncAllIndicators(insDisplayFloor(),state.direction>0?'↑':'↓');
  }
  function depart(){
    const y=carGrp.position.y,lo=FLOOR_Y[0]+S.CAR_H/2,hi=FLOOR_Y[FLOORS-1]+S.CAR_H/2;
    const gap=(FLOOR_Y[1]-FLOOR_Y[0])*.48;
    if(state.direction>0&&hi-y<gap||state.direction<0&&y-lo<gap)state.direction*=-1;
    state.startY=y;state.stopY=THREE.MathUtils.clamp(y+state.direction*gap,lo,hi);
    stage('depart',state.direction>0?'▲ 정상 자동운전 · 상승':'▼ 정상 자동운전 · 하강','약 반 층을 이동합니다.');
    const d=Math.max(5,3/camera.aspect);controls.target.set(0,y+.2,CAR_CTR_Z);camera.position.set(d*.75,y+1.5,CAR_CTR_Z-d*.8);
    moving=true;currentState=ELEVATOR_STATE.MOVING;MACH.brakeRelease();MACH.motorOn();
    const p={y};own(gsap.to(p,{y:state.stopY,duration:3.3,ease:'power1.in',onUpdate:()=>{setY(p.y);MACH.setDrive(.7);updateStatus('v-spd',Math.round(targetSpeed*.7)+' m/min');},onComplete:blackout}));
  }
  function blackout(){
    moving=false;currentState=ELEVATOR_STATE.IDLE;MACH.motorOff();MACH.brakeSet();state.floor=insNearestFloor();
    darkness();document.body.classList.add('ard-blackout');alarm.hidden=false;
    stage('blackout','정전 · 운행 정지','상용전원 차단 → 비상 배터리 전환');updateStatus('v-spd','0 m/min');voice().play();
    later(3.7,()=>{alarm.hidden=true;machineShot();});
  }
  function machineShot(){
    stage('machine','ARD 작동','비상 배터리 → 제어반·권상기 공급');
    ard=MachineRoomPower.root.getObjectByName('ARDInstallation');ard.getWorldPosition(point);point.y+=MR_POWER_SPEC.ard.stand+MR_POWER_SPEC.ard.h*.55;
    const d=Math.max(1.25,.8/camera.aspect);_camTo(point.x+d,point.y+.30,point.z+.72,point.x,point.y,point.z,1);
    if(!outline){outline=new THREE.BoxHelper(ard,0x64ffe1);outline.material.transparent=true;outline.material.depthTest=false;outline.renderOrder=9;scene.add(outline);}
    outline.visible=true;own(gsap.fromTo(outline.material,{opacity:.1},{opacity:1,duration:.38,yoyo:true,repeat:7}));
    later(3.4,()=>{outline.visible=false;darkness(true);stage('cabin','비상등 점등','승강곰과 함께 카 안에서 출입구를 바라봅니다.');cabinShot();later(1.1,rescue);});
  }
  function cabinShot(){
    const p=cabinLookPose();camera.position.set(...p.position);controls.target.set(...p.target);camera.fov=70;camera.updateProjectionMatrix();
  }
  function rescue(){
    stage('rescue',`${state.floor+1}층으로 자동구출운전`,'비상등 아래 서행 → 최근접 층 레벨 맞춤');
    own(rescueToNearestFloor('ARD · 최근접 층 서행',false,{floor:state.floor,onArrive:()=>{if(state.stage==='rescue')openCycle();}}));
    updateStatus('v-spd','24 m/min');
  }
  function openCycle(){
    count.textContent='';stage('opening',`${state.floor+1}층 착상 · 문 열림`,'카문과 승장문이 함께 열립니다.');
    const id=epoch;call(()=>openDoors(()=>{clearTimeout(autoTimer);if(id!==epoch)return;state.cycles++;countdown();}));
  }
  function countdown(){
    stage('open',state.cycles===1?'승객 탈출 대기':'재열림 · 승객 탈출 대기','10초 → 시연 3.45초');
    state.countdown=10;count.textContent='10';
    if(state.cycles===2)exitToHall();
    for(let i=1;i<=10;i++)later(i*COUNT_STEP,()=>{state.countdown=10-i;count.textContent=String(10-i);if(i===10)closeCycle();});
  }
  function closeCycle(){
    count.textContent='';stage('closing','문 닫힘 · 운행 정지 유지','승강장 호출은 무효입니다.');
    const id=epoch;call(()=>closeDoors(()=>{if(id===epoch)finish();}));
    if(state.cycles===1)pressBeforeClosed();
  }
  function poseMascot(){
    const fy=carGrp.position.y-S.CAR_H/2;opb.getWorldPosition(point);
    if(walk.active){
      Mascot.inspectionPose(walk.x,fy,walk.z,0,null,null,walk.yaw);
      const stride=state.exited?0:Math.sin(walk.step)*.025;
      Mascot.rig.feet.forEach((f,i)=>{f.position.y=Math.max(0,i?stride:-stride);});
      return;
    }
    hand.set(point.x-.05,fy+.5,point.z-.32).lerp(point,reach.t);
    Mascot.inspectionPose(point.x-.10,fy,point.z-.40,0,null,hand,0);
  }
  function pressBeforeClosed(){
    stage('press','승강곰 · 열림 버튼 조작','문이 닫히기 직전에 다시 엽니다.');
    opb.getWorldPosition(point);const fy=carGrp.position.y-S.CAR_H/2;
    camera.position.set(point.x-.75,fy+1.0,point.z-1.05);controls.target.set(point.x-.06,fy+.57,point.z-.08);
    camera.fov=camera.aspect<1?88:70;camera.updateProjectionMatrix();
    own(gsap.to(reach,{t:1,duration:.65,onComplete:()=>{
      // 폐문 완료 전에 실제 남은 개방량에서 반전한다. 폐문 완료 콜백은 실행하지 않는다.
      const q=CarDoor.state;state.reopenGap=(carDoorR.position.x-q.d.cx)/(q.d.ox-q.d.cx);
      q.timeline.kill();q.closeCallbacks=[];q.busy=false;doorOpen=false;currentState=ELEVATOR_STATE.IDLE;
      opb.position.z=opbZ-.002;snd.chime.play();openCycle();
      later(.3,()=>{opb.position.z=opbZ;own(gsap.to(reach,{t:0,duration:.4}));});
    }}));
  }
  function exitToHall(){
    // 버튼으로 뻗었던 팔의 길이를 평상시 자세로 되돌리고 같은 캐릭터가 걷는다.
    Mascot.endInspection();Mascot.beginInspection();
    opb.getWorldPosition(point);Object.assign(walk,{active:true,x:point.x-.10,z:point.z-.40,yaw:-Math.PI/2,step:0});
    const hallZ=HallInspector.keyWorld(state.floor).z+.85,fy=FLOOR_Y[state.floor];
    stage('exiting','승강곰 · 승강장으로 이동','카 밖으로 나온 뒤 문이 닫힙니다.');
    // 승장 쪽에서 열린 문과 카 내부, 걸어 나오는 캐릭터를 함께 본다.
    camera.fov=60;camera.updateProjectionMatrix();
    lights.forEach(([l,v])=>{if(l.name!=='carLight')l.intensity=v*.24;});
    materials.forEach(([m,,env])=>{if(env!==undefined)m.envMapIntensity=env*.18;});
    const d=Math.max(3.1,2.2/camera.aspect);
    _camTo(.45,fy+1.35,FRONT_WALL_INNER_Z+d,-.15,fy+1.05,FRONT_WALL_INNER_Z,.85);
    const tl=gsap.timeline();own(tl);
    tl.to(walk,{x:0,step:Math.PI*2,duration:.65,ease:'power1.inOut'})
      .set(walk,{yaw:0}).to(walk,{z:hallZ,step:Math.PI*8,duration:1.6,ease:'none'})
      .to(walk,{x:-.68,yaw:-Math.PI/2,step:Math.PI*10,duration:.6,ease:'power1.out'})
      .call(()=>{state.exited=true;stage('open','승강곰 · 탈출 완료','승강장에서 카의 문 닫힘을 확인합니다.');});
  }
  function finish(){
    stage('done','자동구출 완료 · 정지 유지','승강장 호출 무효 · 전원 복구 전까지 대기');
    restore.textContent='전원 복구 · 시연 종료';
    if(EmergencyLighting.on)EmergencyLighting.toggle();
    // 암전 대신 승강장에서 닫힌 카와 안전하게 나온 승강곰을 보여주며 종료한다.
    moving=false;currentState=ELEVATOR_STATE.IDLE;updateStatus('v-spd','0 m/min');
  }
  function stopJobs(){epoch++;jobs.forEach(j=>j?.kill());jobs=[];clearTimeout(autoTimer);gsap.killTweensOf(carGrp.position);gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);MACH.motorOff();MACH.brakeSet();
    if(activeAnnouncement){activeAnnouncement.pause();activeAnnouncement=null;}announcementRequest++;window.speechSynthesis?.cancel();MACH.duck(false);}
  function halt(){
    if(!state.active)return;stopJobs();CarDoor.pause();moving=false;currentState=ELEVATOR_STATE.ESTOP;alarm.hidden=true;if(outline)outline.visible=false;
    stage('halted','ARD 시연 중단 · 정지','복구 버튼으로 문을 닫고 최근접 층에 복귀합니다.');restore.textContent='시연 복구';
  }
  function reset(){
    if(!state.active||!['done','halted'].includes(state.stage))return;
    stopJobs();stage('resetting','전원 복구 중','최근접 층 착상 후 자동운전으로 돌아갑니다.');
    // 출구를 지나는 중 중단했으면 캐릭터를 먼저 원위치로 돌려 폐문 간섭을 피한다.
    if(walk.active){Mascot.endInspection();walk.active=false;}
    // 중단된 도어 타임라인의 이전 콜백은 epoch로 무효화한 후 폐문으로 교체한다.
    if(CarDoor.state.busy)CarDoor.state.timeline.kill();currentState=ELEVATOR_STATE.IDLE;
    call(()=>closeDoors(()=>{own(rescueToNearestFloor('ARD 시연 복구',false,{onArrive:cleanup}));}));
  }
  function cleanup(){
    lights.forEach(([l,v])=>l.intensity=v);materials.forEach(([m,v,env])=>{m.emissiveIntensity=v;if(env!==undefined)m.envMapIntensity=env;});
    if(EmergencyLighting.on!==saved.emergency)EmergencyLighting.toggle();
    EmergencyLighting.lamps.forEach((l,i)=>l.getObjectByName('emergencyLampLight').distance=saved.emergencyRange[i]);
    if(saved.background)scene.background.copy(saved.background);if(saved.fog)scene.fog.color.copy(saved.fog);
    camera.position.copy(saved.p);controls.target.copy(saved.t);camera.fov=saved.fov;camera.near=saved.near;camera.updateProjectionMatrix();
    controls.enabled=saved.enabled;controls.enableDamping=saved.damp;controls.minDistance=saved.min;
    Mascot.endInspection();opb.position.z=opbZ;document.body.classList.remove('ard-active','ard-blackout');panel.hidden=true;alarm.hidden=true;
    const cabinLight=scene.getObjectByName('carLight');if(cabinLight)cabinLight.position.y=carGrp.position.y+S.CAR_H*.75;
    state.active=false;state.stage='idle';state.countdown=0;jobs=[];currentState=ELEVATOR_STATE.IDLE;updateStatus('v-dir','정상 자동운전 · 정지 대기','#3fb950');
  }
  function update(){
    if(!button)return;
    if(state.active){button.hidden=true;poseMascot();if(['cabin','rescue','opening','open','closing'].includes(state.stage)){
      // 버튼 누름 클로즈업 이후에는 정면 눈높이 시점으로 카를 추종한다.
      if(state.stage==='cabin'||state.stage==='rescue')cabinShot();
    }return;}
    ard=MachineRoomPower.root?.getObjectByName('ARDInstallation');if(!ard)return;
    point.set(0,MR_POWER_SPEC.ard.stand+MR_POWER_SPEC.ard.h+.12,MR_POWER_SPEC.ard.d*.5);ard.localToWorld(point);
    let show=PartActions.iconsVisible&&MachineRoomPower.ready&&camera.position.distanceToSquared(point)<100;
    for(let p=ard;p&&show;p=p.parent)if(!p.visible)show=false;
    point.project(camera);show=show&&point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;button.hidden=!show;
    if(show)PartActions.positionButton(button,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
  }
  return {build,update,start,halt,reset,get active(){return state.active;},get blocksCommands(){return state.active&&!internal;},get state(){return state;}};
})();
