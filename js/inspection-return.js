// 점검 종료 연출. 기존 착상·문·로프 동작을 호출하고, 피트 복귀 절차만 순서대로 보여준다.
const InspectionReturn=(()=>{
  let busy=false,stage='idle',source=null,targetFloor=0,clicks=0,run=0,timeline=null,travel=null,timer=null;
  let audioContext=null,button=null,buttonZ=0,controlsBefore=[];
  const keyPose={approach:0,insert:0,key:0,carry:0,walk:0,foot:0};
  const callPose={x:0,y:0,z:0,reach:0};
  const keyPoint=new THREE.Vector3(),callPoint=new THREE.Vector3(),hand=new THREE.Vector3();
  const panel=()=>document.getElementById('inspection-drive');
  function announce(next,text){stage=next;updateStatus('v-dir',text,'#f0883e');}
  function sound(beep=false){
    if(!audioContext)return;
    const t=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();
    o.type=beep?'sine':'square';o.frequency.setValueAtTime(beep?1500:1350,t);
    if(!beep)o.frequency.exponentialRampToValueAtTime(350,t+.035);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(beep?.09:.04,t+.004);
    g.gain.exponentialRampToValueAtTime(.0001,t+(beep?.65:.045));o.connect(g);g.connect(audioContext.destination);
    o.start(t);o.stop(t+(beep?.68:.05));o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function lockUI(){
    const nodes=document.querySelectorAll('#fbtns button,#btn-open,#btn-close,#btn-overspeed,#btn-ucm,#hall-panel button,.part-action,#inspection-drive button');
    controlsBefore=[...nodes].map(b=>[b,b.disabled]);nodes.forEach(b=>b.disabled=true);
  }
  function unlockUI(){controlsBefore.forEach(([b,d])=>b.disabled=d);controlsBefore=[];}
  function cameraShot(kind){
    leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    const fy=FLOOR_Y[targetFloor],front=FRONT_WALL_INNER_Z;
    if(kind==='travel'){
      const mid=(carGrp.position.y+fy+S.CAR_H/2)/2;
      const span=Math.abs(carGrp.position.y-fy-S.CAR_H/2)+S.CAR_H+2;
      const d=Math.max(6,span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))),3/camera.aspect);
      controls.target.set(0,mid,CAR_CTR_Z);camera.position.set(d*.8,mid+1.4,CAR_CTR_Z-d*.65);
    }else if(kind==='call'){
      button.getWorldPosition(callPoint);controls.target.set(callPoint.x-.12,fy+.70,callPoint.z+.12);
      const d=Math.max(1.8,1/camera.aspect);camera.position.set(callPoint.x-.45,fy+1.05,callPoint.z+d);
    }else{
      const x=kind==='key'?.28:0,d=Math.max(3.1,(S.DOOR_W+.9)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
      controls.target.set(x,fy+1.08,front);camera.position.set(x+.25,fy+1.20,front+d);
    }
    controls.update();updateManualCameraNear();
  }
  function poseKey(){HallInspector.pose(0,keyPose);setEmergencyKey(0,keyPose.key);}
  function poseCall(){
    button.getWorldPosition(callPoint);callPoint.z+=.010;
    hand.set(callPose.x,callPose.y+.40,callPose.z-.12).lerp(callPoint,callPose.reach);
    Mascot.inspectionPose(callPose.x,callPose.y,callPose.z,0,null,hand);
  }
  function start(kind){
    if(busy)return false;
    kind=kind||source;if(!['pit','car','machine'].includes(kind))return false;
    if(estop||overspeedActive||UCMDemo.state.active||HallManual.active||CarDoor.state?.busy||DoorBypass.mode!=='off'||!DoorBypass.hallSecured()||!PitLadder.secured){
      updateStatus('v-dir','문 잠금·사다리·BYPASS·비상정지 상태를 확인한 뒤 리셋하세요.','#f0883e');return false;
    }
    button=scene.getObjectByName('HallCallButton_1')?.getObjectByName('ButtonUpBody');
    if(kind==='pit'&&(!button||!hatchDoors[0].interlock?.ready))return false;
    // 클릭 제스처에서 오디오를 열어 긴 누름 뒤의 확인음을 재생한다.
    const AC=window.AudioContext||window.webkitAudioContext;if(AC){audioContext??=new AC();audioContext.resume().catch(()=>{});}
    insHold=0;insStop();clearTimeout(autoTimer);
    source=kind;targetFloor=kind==='pit'?0:insNearestFloor();clicks=0;const id=++run;
    setInspectionMode(false,{recover:false});if(insMode)return false;
    busy=true;panel().hidden=false;lockUI();buttonZ=button?.position.z||0;
    announce('preparing','점검 종료 · 자동 복귀 준비');
    const next=()=>{if(!busy||id!==run)return;if(source==='pit')keySequence(id);else returnCar(id);};
    if(doorOpen)closeDoors(next);else next();
    return true;
  }
  function keySequence(id){
    Object.assign(keyPose,{approach:0,insert:0,key:0,carry:0,walk:0,foot:0});
    HallInspector.begin(0);poseKey();cameraShot('key');announce('key','1층 삼각키 복귀 조작 · 0/4');
    timeline=gsap.timeline({onUpdate:poseKey});
    timeline.to(keyPose,{approach:1,duration:.7}).to(keyPose,{insert:1,duration:.35});
    for(let i=1;i<=4;i++){
      timeline.to(keyPose,{key:1,duration:.22,ease:'power1.inOut'}).call(()=>{clicks=i;sound();updateStatus('v-dir',`문은 닫힌 상태 · 삼각키 딸각 ${i}/4`,'#f0883e');})
        .to(keyPose,{key:0,duration:.22,ease:'power1.inOut'}).to({}, {duration:.20});
    }
    timeline.to(keyPose,{insert:0,duration:.35}).call(()=>{if(busy&&id===run)callSequence(id);});
  }
  function callSequence(id){
    // 긴 삼각키를 내려놓고 같은 곰이 호출판으로 이동한다.
    const from=Mascot.root.position.clone();HallInspector.end();Mascot.beginInspection();
    button.getWorldPosition(callPoint);Object.assign(callPose,{x:from.x,y:FLOOR_Y[0],z:from.z,reach:0});
    announce('approach-call','1층 호출 버튼으로 이동');cameraShot('call');
    timeline=gsap.timeline({onUpdate:poseCall});
    timeline.to(callPose,{x:callPoint.x-.16,z:callPoint.z+.30,duration:1.1,ease:'power1.inOut'})
      .to(callPose,{reach:1,duration:.4}).call(()=>{
        announce('call-hold','1층 호출 버튼 길게 누르는 중…');button.position.z=buttonZ-.0015;HallFinish.setLamp(0,'up',true);
      }).to({}, {duration:2}).call(()=>{
        sound(true);announce('beep','삐 — 피트 복귀 확인');button.position.z=buttonZ;
      }).to(callPose,{reach:0,duration:.4}).to({}, {duration:.35}).call(()=>{if(busy&&id===run)returnCar(id);});
  }
  function returnCar(id){
    cameraShot('travel');announce('returning',`${targetFloor+1}층으로 자동 복귀 중`);
    travel=rescueToNearestFloor(`${targetFloor+1}층으로 자동 복귀 중`,false,{floor:targetFloor,onArrive:()=>{
      if(!busy||id!==run)return;HallFinish.setLamp(0,'up',false);cameraShot('door');announce('opening','복귀 확인 · 문 열림');
      openDoors(()=>{
        if(!busy||id!==run)return;clearTimeout(autoTimer);announce('open','복귀 확인 · 문 열림 완료');
        timer=setTimeout(()=>{
          if(!busy||id!==run)return;announce('closing','복귀 확인 · 문 닫힘');closeDoors(()=>{if(busy&&id===run)finish();});
        },1400);
      });
    }});
    if(!travel)cancel(true);
  }
  function finish(){
    clearTimeout(autoTimer);HallInspector.end();unlockUI();panel().hidden=true;busy=false;stage='complete';
    document.querySelectorAll('[data-ins-dir]').forEach(b=>b.disabled=true);
    document.getElementById('inspection-return').disabled=true;
    currentState=ELEVATOR_STATE.IDLE;updateStatus('v-dir','정상 자동운전 · 정지 대기','#3fb950');
  }
  function cancel(retry=false){
    if(!busy){if(!retry)panel().hidden=true;return;}
    ++run;timeline?.kill();travel?.kill();clearTimeout(timer);clearTimeout(autoTimer);
    setEmergencyKey(0,0);HallFinish.setLamp(0,'up',false);if(button)button.position.z=buttonZ;
    HallInspector.end();if(moving){moving=false;MACH.motorOff();MACH.brakeSet();}
    busy=false;stage='cancelled';unlockUI();panel().hidden=!retry;
    document.querySelectorAll('[data-ins-dir]').forEach(b=>b.disabled=true);
    document.getElementById('inspection-return').disabled=!retry;
    if(!estop)currentState=doorOpen?ELEVATOR_STATE.DOOR_OPEN:ELEVATOR_STATE.IDLE;
  }
  function update(){if(busy&&estop)cancel(true);}
  return {start,cancel,update,get busy(){return busy;},get state(){return {stage,source,targetFloor,clicks,busy};}};
})();
