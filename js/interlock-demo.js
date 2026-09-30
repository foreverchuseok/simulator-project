// One local landing-door cycle. Existing GLB pivots and contact meshes are the source.
const InterlockDemo=(()=>{
  const poseState={release:0,opening:0},buttons=[],point=new THREE.Vector3();
  const target=new THREE.Vector3(),eye=new THREE.Vector3(),startEye=new THREE.Vector3(),startTarget=new THREE.Vector3();
  // Keep the action beside the contact housing in a narrow portrait close-up.
  const anchor=new THREE.Vector3(.13,-.015,-.055),cameraBlend={value:0};
  let floor=-1,phase='idle',timeline,paused=false,panel,title,message,contactBadges,mainBadge,auxBadge,controlsWereEnabled=true;
  const materials=[];let lastPaint='';
  function blockedReason(f){
    if(!Number.isInteger(f)||!hatchDoors[f]?.interlock?.ready||!CarDoor.state?.ready)return '도어 준비 중입니다. 잠시 후 다시 눌러주세요.';
    if(!hatchDoors[f].interlock.contacts)return '인터록 파일을 새로 불러와야 합니다. 페이지를 새로고침한 뒤 눌러주세요.';
    if(floor>=0)return '인터록 시연이 진행 중입니다.';
    if(overspeedActive||UCMDemo.state.active)return '진행 중인 고장 시연을 복귀한 뒤 눌러주세요.';
    if(estop)return '비상정지 상태입니다. 정지 버튼으로 해제한 뒤 눌러주세요.';
    if(moving)return '카가 운행 중입니다. 정지한 뒤 눌러주세요.';
    if(inspectionResetting||InspectionReturn.busy)return '점검 복귀 중입니다. 복귀가 끝난 뒤 눌러주세요.';
    if(HallManual.active)return '승장문 점검 중입니다. 승장문 점검 패널의 「발 빼고 닫기」로 재잠금한 뒤 눌러주세요.';
    if(InspectionStations.active)return '점검운전 중입니다. 점검 패널의 「리셋」으로 복귀한 뒤 눌러주세요.';
    if(DoorBypass.mode!=='off')return 'BYPASS를 해제하고 점검운전을 종료한 뒤 눌러주세요.';
    if(insMode)return '점검운전(INS) 상태입니다. 점검 리셋으로 자동운전에 복귀한 뒤 눌러주세요.';
    if(CarDoor.state.busy)return '문이 움직이고 있습니다. 문이 닫힌 뒤 눌러주세요.';
    if(doorOpen)return '문이 열려 있습니다. 운행바의 닫힘 버튼으로 닫은 뒤 눌러주세요.';
    if(!CarDoor.secured())return '카문이 잠기지 않았습니다. 카문을 닫고 다시 눌러주세요.';
    if(!DoorBypass.hallSecured())return '승장문이 잠기지 않았습니다. 승장문을 닫고 삼각키를 복귀한 뒤 눌러주세요.';
    return '';
  }
  function allowed(f){return !blockedReason(f);}
  function notice(text){
    closeAllMenus();title.textContent='인터록 시연 안내';message.textContent=text;
    message.hidden=false;contactBadges.hidden=true;panel.hidden=false;
  }
  function restoreMaterials(){
    for(const m of materials){m.o.material=m.original;m.copy.dispose();}materials.length=0;
  }
  function failed(error){
    console.error('[InterlockDemo] 시연 오류:',error);
    try{finish();}catch(cleanupError){console.error('[InterlockDemo] 복귀 오류:',cleanupError);}
    restoreMaterials();
    notice('인터록 시연 중 오류가 발생해 중단했습니다. 화면 조작은 복구했습니다. 페이지를 새로고침한 뒤 다시 눌러주세요.');
  }
  function showContacts(h){
    const c=h.interlock.contacts,conductors=new Set([c.bridge,...c.leaves,...c.pins]);
    for(const root of [h.interlock.fixed,h.interlock.moving,h.interlock.opposite])root.traverse(o=>{
      if(!o.isMesh)return;
      const name=o.name.replace(/_/g,' '),housing=/^(Central contact housing|Contact nose|Terminal spine|Insulating tongue nose)$/.test(name);
      if(!housing&&!conductors.has(o))return;
      const original=o.material,copy=original.clone();materials.push({o,original,copy,conductor:conductors.has(o)});o.material=copy;
      if(housing){copy.transparent=true;copy.opacity=.14;copy.depthWrite=false;}
    });
  }
  function paint(){
    if(floor<0)return;const c=hatchDoors[floor].interlock.contacts;
    const key=[floor,phase,paused,c.mainClosed,c.auxClosed].join(':');if(key===lastPaint)return;lastPaint=key;
    const labels={focus:'접점 관찰',unlock:'걸쇠 상승 · 주접점 분리',opening:'반개방 · 보조접점 분리',hold:'반개방 상태',closing:'문 닫힘 · 보조접점 복귀',lock:'걸쇠 복귀 · 주접점 복귀',done:'닫힘 · 잠금 완료'};
    title.textContent=`${floor+1}층 인터록 · ${paused?'일시 정지':labels[phase]||''}`;
    for(const [badge,closed,label] of [[mainBadge,c.mainClosed,'주접점'],[auxBadge,c.auxClosed,'보조접점']]){
      badge.textContent=`${label} ${closed?'붙음':'떨어짐'}`;badge.dataset.closed=String(closed);
    }
    for(const m of materials)if(m.conductor){const closed=m.o===c.bridge||c.leaves.includes(m.o)?c.mainClosed:c.auxClosed;
      m.copy.emissive.setHex(closed?0x197843:0xa8430b);m.copy.emissiveIntensity=.65;}
  }
  function aim(){
    if(floor<0)return;const h=hatchDoors[floor],travel=CarDoor.dimensions().stroke*poseState.opening;
    h.interlock.fixed.getWorldPosition(target);target.x+=.035;target.y+=.008;target.z-=.023;
    // Close on the contacts first; widen only while the two leaves separate.
    const width=.47+2*travel,dist=width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)*1.12;
    eye.copy(target);eye.x+=.045;eye.y+=.065;eye.z-=Math.max(.43,dist);
    camera.position.lerpVectors(startEye,eye,cameraBlend.value);controls.target.lerpVectors(startTarget,target,cameraBlend.value);controls.update();
  }
  function pose(){
    if(floor<0)return;const h=hatchDoors[floor],q=CarDoor.state;
    h.manualOpen=poseState.opening;
    if(h.manualCoupled){q.release=poseState.release;q.coupledFloor=floor;carDoorR.position.x=q.d.cx+q.d.stroke*poseState.opening;CarDoor.pose();}
    else{
      h.hook.rotation.z=-h.latch.liftRad*poseState.release;
      h.right.position.x=h.right.userData.cx+q.d.stroke*poseState.opening;
      h.left.position.x=h.left.userData.cx-q.d.stroke*poseState.opening;
      spinDoorDrive(h);HallInterlock.update(h);
    }
    aim();paint();
  }
  function stage(value){phase=value;const h=hatchDoors[floor];
    if(h?.manualCoupled)currentState=value==='closing'||value==='lock'?ELEVATOR_STATE.DOOR_CLOSING:value==='hold'?ELEVATOR_STATE.DOOR_OPEN:ELEVATOR_STATE.DOOR_OPENING;
    try{paint();}catch(error){failed(error);}
  }
  function safePose(){try{pose();}catch(error){failed(error);}}
  function finish(){
    if(floor<0){if(panel)panel.hidden=true;return;}timeline?.kill();timeline=null;
    const h=hatchDoors[floor],coupled=h.manualCoupled;
    try{poseState.release=poseState.opening=0;pose();}
    finally{
      h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;
      if(coupled){CarDoor.state.coupledFloor=-1;doorOpen=false;currentState=estop?ELEVATOR_STATE.ESTOP:ELEVATOR_STATE.IDLE;updateStatus('v-door','닫힘','#3fb950');}
      floor=-1;phase='idle';paused=false;panel.hidden=true;controls.enabled=controlsWereEnabled;
      restoreMaterials();
      buttons.forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');b.disabled=false;});
    }
  }
  function start(f){
    if(floor>=0)return false;
    const reason=blockedReason(f);
    if(reason){notice(reason);return false;}
    try{
    // Prepare visuals before taking control. A failed setup must not lock the page.
    showContacts(hatchDoors[f]);
    clearTimeout(autoTimer);closeAllMenus();leaveCabinView();
    message.hidden=true;contactBadges.hidden=false;
    const h=hatchDoors[f];floor=f;phase='focus';lastPaint='';poseState.release=poseState.opening=0;
    h.manualActive=true;h.manualCoupled=CarDoor.alignedFloor()===f;
    if(h.manualCoupled){CarDoor.state.coupledFloor=f;doorOpen=true;currentState=ELEVATOR_STATE.DOOR_OPENING;}
    gsap.killTweensOf(h.hook.rotation);if(h.keyTween)gsap.killTweensOf(h.keyTween);
    gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    startEye.copy(camera.position);startTarget.copy(controls.target);cameraBlend.value=0;
    controlsWereEnabled=controls.enabled;controls.enabled=false;
    panel.hidden=false;buttons[f].classList.add('active');buttons[f].setAttribute('aria-pressed','true');pose();
    timeline=gsap.timeline({onUpdate:safePose,onComplete:()=>{try{finish();}catch(error){failed(error);}}});
    timeline.to(cameraBlend,{value:1,duration:.65,ease:'power2.inOut'}).to({}, {duration:.35})
      .call(()=>stage('unlock')).to(poseState,{release:1,duration:1.2,ease:'power1.inOut'}).to({}, {duration:.8})
      .call(()=>stage('opening')).to(poseState,{opening:.5,duration:1.9,ease:'power2.inOut'})
      .call(()=>stage('hold')).to({}, {duration:1})
      .call(()=>stage('closing')).to(poseState,{opening:0,duration:1.9,ease:'power2.inOut'}).to({}, {duration:.6})
      .call(()=>stage('lock')).to(poseState,{release:0,duration:1.2,ease:'power1.inOut'})
      .call(()=>stage('done')).to({}, {duration:1});
    return true;
    }catch(error){failed(error);return false;}
  }
  function pause(value){if(floor<0)return;paused=!!value;paused?timeline?.pause():timeline?.resume();paint();}
  function update(){
    if(floor>=0){try{if(paused!==estop)pause(estop);aim();paint();}catch(error){failed(error);}}
    for(let f=0;f<buttons.length;f++){
      const b=buttons[f],h=hatchDoors[f];if(!h.interlock?.ready){b.hidden=true;continue;}
      point.copy(anchor);h.interlock.moving.localToWorld(point);
      let shown=camera.position.distanceToSquared(point)<9;
      for(let o=h.right;o&&shown;o=o.parent)if(!o.visible)shown=false;
      point.project(camera);shown&&=point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;
      // A blocked action must still accept a click so its reason can be shown.
      b.hidden=!shown;b.disabled=floor>=0;
      if(shown)PartActions.positionButton(b,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
    }
  }
  function bind(){
    panel=document.getElementById('interlock-demo-panel');title=document.getElementById('interlock-demo-title');
    message=document.getElementById('interlock-demo-message');contactBadges=panel.querySelector('.interlock-contacts');
    mainBadge=document.getElementById('interlock-main-contact');auxBadge=document.getElementById('interlock-aux-contact');
    document.getElementById('interlock-demo-cancel').onclick=finish;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)finish();});
    const icon='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V7a5 5 0 0 1 9-3M4 11h11v10H4Z"/><path d="m18 10 5 4-5 4Z"/></svg>')+'")';
    for(let f=0;f<FLOORS;f++){const b=document.createElement('button');b.className='part-action';b.type='button';b.id=`interlock-action-${f}`;b.hidden=true;b.style.setProperty('--part-icon',icon);
      b.setAttribute('aria-label',`${f+1}층 인터록 열림·닫힘 시연`);b.title=b.getAttribute('aria-label');b.setAttribute('aria-controls','interlock-demo-panel');b.setAttribute('aria-pressed','false');b.onclick=()=>start(f);document.getElementById('part-actions').appendChild(b);buttons.push(b);
      PartGlow.bind(b,()=>{const i=hatchDoors[f]?.interlock;return i?.ready?[i.fixed,i.moving,i.opposite]:null;},`${f+1}층 승장문 인터록`);}
  }
  return {bind,update,start,pause,cancel:finish,allowed,get active(){return floor>=0;},get floor(){return floor;},get phase(){return phase;},get poseState(){return poseState;},get paused(){return paused;}};
})();
