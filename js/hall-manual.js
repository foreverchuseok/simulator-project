// 층별 아이콘 → 해정 → 반/완전개방 → 한 발 받침 → 발 빼고 폐문·재잠금.
const HallManual=(()=>{
  let selected=0,activeFloor=-1,phase='idle',timeline=null,buttons=[];
  const p={approach:0,insert:0,key:0,carry:0,walk:0,foot:0,ratio:0,release:0};
  const point=new THREE.Vector3(),el=id=>document.getElementById(id);
  const busy=()=>activeFloor>=0&&phase!=='holding';
  function allowed(f){
    if(InspectionStations.active||InspectionReturn.busy)return {ok:false,message:'피트·카상부 점검운전을 먼저 종료하세요.'};
    if(!Number.isInteger(f)||!hatchDoors[f]?.interlock?.ready)return {ok:false,message:'도어 준비 중입니다.'};
    if(moving||estop||overspeedActive||UCMDemo.state.active||CarDoor.state?.busy||busy())return {ok:false,message:'운행·시연을 멈춘 뒤 점검하세요.'};
    if(activeFloor>=0)return {ok:activeFloor===f,message:activeFloor===f?'발로 문을 받치고 있습니다.':`${activeFloor+1}층 점검문을 먼저 닫으세요.`};
    const carFloor=CarDoor.alignedFloor();
    if(carFloor<0)return {ok:false,message:'카가 층에 정지한 뒤 개방할 수 있습니다.'};
    if(!(f===0||carFloor===f||carFloor===f-1))return {ok:false,message:`${f+1}층은 카가 ${f}층 또는 ${f+1}층에 정지해 있어야 합니다.`};
    if(carFloor!==f&&!CarDoor.secured())return {ok:false,message:'카문이 닫힌 뒤 개방하세요.'};
    return {ok:true,message:carFloor===f?'카문과 승장문이 함께 열립니다.':f===0?'1층 피트 진입 점검 · 승장문만 열립니다.':'카가 바로 아래층에 있습니다 · 승장문만 열립니다.'};
  }
  function dismiss(){if(el('hall-panel'))el('hall-panel').hidden=true;buttons.forEach(b=>b.setAttribute('aria-expanded','false'));}
  function select(f){if(moving||!Number.isInteger(f)||!hatchDoors[f])return false;selected=f;refresh();return true;}
  function pick(f){if(!select(f))return false;const was=!el('hall-panel').hidden&&buttons[f]?.getAttribute('aria-expanded')==='true';closeAllMenus();if(!was){el('hall-panel').hidden=false;buttons[f]?.setAttribute('aria-expanded','true');renderSegments();refresh();}return true;}
  function pose(){
    if(activeFloor<0)return;
    const h=hatchDoors[activeFloor],q=CarDoor.state;
    h.manualOpen=p.ratio;setEmergencyKey(activeFloor,p.key);
    if(h.manualCoupled){q.release=p.release;q.coupledFloor=activeFloor;carDoorR.position.x=q.d.cx+q.d.stroke*p.ratio;CarDoor.pose();}
    else {h.right.position.x=h.right.userData.cx+q.d.stroke*p.ratio;h.left.position.x=h.left.userData.cx-q.d.stroke*p.ratio;spinDoorDrive(h);HallInterlock.update(h);}
    HallInspector.pose(activeFloor,p);
  }
  function makeTimeline(){timeline?.kill();return timeline=gsap.timeline({onUpdate:()=>{pose();refresh();}});}
  function request(ratio){
    if(![.5,1].includes(ratio))return false;
    const permission=allowed(selected);if(!permission.ok){el('hall-message').textContent=permission.message;return false;}
    clearTimeout(autoTimer);
    if(activeFloor>=0){
      phase='opening';refresh();makeTimeline().to(p,{foot:0,duration:.2}).to(p,{ratio,duration:1,ease:'power2.inOut'}).to(p,{foot:1,duration:.3}).call(()=>{phase='holding';refresh();});return true;
    }
    activeFloor=selected;const h=hatchDoors[selected],q=CarDoor.state;
    h.manualCoupled=CarDoor.alignedFloor()===selected;h.manualActive=true;
    gsap.killTweensOf(h.hook.rotation);if(h.keyTween)gsap.killTweensOf(h.keyTween);
    const start=h.manualCoupled?Math.max(0,(carDoorR.position.x-q.d.cx)/q.d.stroke):0;
    Object.assign(p,{approach:0,insert:0,key:0,carry:0,walk:0,foot:0,ratio:start,release:h.manualCoupled?q.release:0});
    if(h.manualCoupled){q.coupledFloor=selected;doorOpen=true;currentState=ELEVATOR_STATE.DOOR_OPENING;}
    phase='arriving';HallInspector.begin(selected);pose();refresh();
    makeTimeline().to(p,{approach:1,duration:.6}).to(p,{insert:1,duration:.4}).call(()=>{phase='unlocking';})
      .to(p,{key:1,release:h.manualCoupled?1:0,duration:.7,ease:'power1.inOut'}).call(()=>{phase='opening';})
      .to(p,{ratio:Math.max(start,.06),duration:.35}).to(p,{key:0,duration:.35}).to(p,{insert:0,duration:.3})
      .to(p,{carry:1,walk:1,duration:.65}).to(p,{ratio,duration:1.2,ease:'power2.inOut'}).to(p,{foot:1,duration:.35})
      .call(()=>{phase='holding';if(h.manualCoupled){currentState=ELEVATOR_STATE.DOOR_OPEN;updateStatus('v-door',ratio===1?'점검 완전개방 · 발 받침':'점검 반개방 · 발 받침','#f0883e');}refresh();});
    return true;
  }
  function close(){
    if(activeFloor<0||selected!==activeFloor||busy()||moving||estop||overspeedActive)return false;
    const h=hatchDoors[activeFloor];phase='closing';clearTimeout(autoTimer);if(h.manualCoupled)currentState=ELEVATOR_STATE.DOOR_CLOSING;
    makeTimeline().to(p,{foot:0,duration:.4}).to(p,{ratio:0,duration:1.25,ease:'power2.inOut'}).call(()=>{phase='locking';})
      .to(p,{release:0,key:0,duration:.4}).call(()=>{
        pose();
        h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;
        if(CarDoor.state.coupledFloor===activeFloor){CarDoor.state.coupledFloor=-1;doorOpen=false;currentState=ELEVATOR_STATE.IDLE;updateStatus('v-door','닫힘','#3fb950');}
        activeFloor=-1;phase='idle';HallInspector.end();refresh();
      });return true;
  }
  function refresh(){
    if(!el('hall-title'))return;
    const h=hatchDoors[selected],permission=allowed(selected);el('hall-title').textContent=`${selected+1}층 승장문 점검`;
    for(const id of ['hall-half','hall-open'])el(id).disabled=!permission.ok;
    el('hall-close').disabled=selected!==activeFloor||busy()||moving||estop;
    const labels={arriving:'승강곰 준비',unlocking:'긴 삼각키 해정',opening:'문 개방 중',holding:'한 발로 문 받침',closing:'발을 빼고 폐문',locking:'재잠금'};
    el('hall-message').textContent=activeFloor===selected?`${labels[phase]} · ${Math.round((h.manualOpen||0)*100)}%${estop?' · 비상정지':''}`:permission.message;
  }
  function observe(){
    if(moving||overspeedActive)return;leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    const y=FLOOR_Y[selected];controls.target.set(0,y+1.1,FRONT_WALL_INNER_Z);
    const distance=Math.max(3.5,(S.DOOR_W+.8)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
    camera.position.set(.65,y+1.35,FRONT_WALL_INNER_Z+distance);controls.update();updateManualCameraNear();
  }
  function update(){
    if(timeline&&busy()){if(estop||moving)timeline.pause();else timeline.resume();}
    if(activeFloor>=0)HallInspector.pose(activeFloor,p);
    for(let f=0;f<buttons.length;f++){
      const b=buttons[f],h=hatchDoors[f];HallInspector.keyWorld(f,point);point.x=0;point.y=FLOOR_Y[f]+1.15;point.z+=.05;let shown=camera.position.distanceToSquared(point)<400;
      for(let o=h.right;o&&shown;o=o.parent)if(!o.visible)shown=false;
      point.project(camera);shown=shown&&point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;
      b.hidden=!shown;if(shown)PartActions.positionButton(b,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);b.classList.toggle('active',f===activeFloor);
    }
    if(!el('hall-panel')?.hidden)refresh();
  }
  function bind(){
    const icon='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7"><path d="M4 21V3h16v18M12 3v18M8 12h1m6 0h1"/><path d="m7 17 2-2 2 2m2 0 2-2 2 2"/></svg>')+'")';
    for(let f=0;f<FLOORS;f++){const b=document.createElement('button');b.className='part-action';b.type='button';b.id=`hall-action-${f}`;b.hidden=true;b.setAttribute('aria-label',`${f+1}층 승장문 점검`);b.setAttribute('aria-controls','hall-panel');b.setAttribute('aria-expanded','false');b.style.setProperty('--part-icon',icon);b.onclick=()=>pick(f);el('part-actions').appendChild(b);buttons.push(b);}
    el('hall-dismiss').onclick=dismiss;el('hall-half').onclick=()=>request(.5);el('hall-open').onclick=()=>request(1);el('hall-close').onclick=close;el('hall-observe').onclick=observe;refresh();
  }
  function resetAll(){
    timeline?.kill();timeline=null;const coupled=hatchDoors.some(h=>h.manualCoupled);activeFloor=-1;phase='idle';HallInspector.end();
    if(coupled&&CarDoor.state?.ready){CarDoor.state.release=0;carDoorR.position.x=CarDoor.dimensions().cx;doorOpen=false;CarDoor.pose();}
    CarDoor.state.coupledFloor=-1;
    hatchDoors.forEach((h,f)=>{if(h.keyTween)gsap.killTweensOf(h.keyTween);gsap.killTweensOf(h.hook.rotation);h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;h.right.position.x=h.right.userData.cx;h.left.position.x=h.left.userData.cx;setEmergencyKey(f,0);spinDoorDrive(h);HallInterlock.update(h);});refresh();
  }
  return {bind,select,pick,dismiss,observe,request,close,resetAll,update,allowed,open:ratio=>ratio===0?close():request(ratio),get selected(){return selected;},get active(){return activeFloor>=0;},get activeFloor(){return activeFloor;},get busy(){return busy();},get phase(){return phase;},get poseState(){return p;}};
})();
