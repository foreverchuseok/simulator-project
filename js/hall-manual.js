// 층별 승장문 독립 개방. 개방 시 INS, 이동은 기존 BYPASS 접점 판정을 따른다.
const HallManual=(()=>{
  let selected=0,buttons=[],inspectorFloor=-1;
  const states=new Map(),point=new THREE.Vector3(),el=id=>document.getElementById(id);
  const busy=()=>[...states.values()].some(s=>s.phase!=='holding');
  const carAbsent=f=>{const c=CarDoor.alignedFloor();return c!==f&&!(f>0&&c===f-1);};
  function allowed(f){
    if(InterlockDemo.active)return {ok:false,message:'인터록 시연 중'};
    if(InspectionStations.active||InspectionReturn.busy)return {ok:false,message:'점검운전 종료 후 개방'};
    if(!Number.isInteger(f)||!hatchDoors[f]?.interlock?.ready||!CarDoor.state?.ready)return {ok:false,message:'도어 준비 중'};
    if(moving||estop||overspeedActive||UCMDemo.state.active||BufferDemo.active||CarDoor.state.busy||busy()||inspectionResetting)return {ok:false,message:'정지 후 개방'};
    return {ok:true,message:''};
  }
  function dismiss(){insHold=0;insStop();if(el('hall-panel'))el('hall-panel').hidden=true;buttons.forEach(b=>b.setAttribute('aria-expanded','false'));}
  function select(f){if(moving||!Number.isInteger(f)||!hatchDoors[f])return false;selected=f;if(states.has(f))inspectorFloor=f;refresh();return true;}
  function poseInspector(){
    const s=states.get(inspectorFloor);if(!s)return;
    // 열린 폭이 줄면 발을 먼저 빼며, 카가 움직여도 점검자는 승장 바닥에 남는다.
    HallInspector.hold(inspectorFloor,s.phase==='closing'?0:Math.min(1,s.ratio/.12));
  }
  function pick(f){if(!select(f))return false;const was=!el('hall-panel').hidden&&buttons[f]?.getAttribute('aria-expanded')==='true';closeAllMenus();if(!was){el('hall-panel').hidden=false;buttons[f]?.setAttribute('aria-expanded','true');renderSegments();refresh();}return true;}
  function pose(f,s){
    const h=hatchDoors[f],stroke=CarDoor.dimensions().stroke;
    h.manualOpen=s.ratio;setEmergencyKey(f,s.key);
    h.right.position.x=h.right.userData.cx+stroke*s.ratio;
    h.left.position.x=h.left.userData.cx-stroke*s.ratio;
    spinDoorDrive(h);HallInterlock.update(h);
    if(f===inspectorFloor)poseInspector();
  }
  function request(ratio){
    if(![.5,1].includes(ratio))return false;
    const permission=allowed(selected);if(!permission.ok){el('hall-message').textContent=permission.message;return false;}
    setInspectionMode(true);if(!insMode)return false;clearTimeout(autoTimer);
    const f=selected,h=hatchDoors[f];
    let s=states.get(f);
    if(!s){s={ratio:Math.max(0,(h.right.position.x-h.right.userData.cx)/CarDoor.dimensions().stroke),key:0,phase:'opening',timeline:null};states.set(f,s);}
    if(ratio>s.ratio&&carAbsent(f))snd.hallWarning.play().catch(console.error);
    h.manualActive=true;h.manualCoupled=false;
    inspectorFloor=f;poseInspector();
    // 카문은 별도 조작한다. 카문 pose가 승장문 개방을 덮어쓰지 않게 한다.
    gsap.killTweensOf(h.hook.rotation);if(h.keyTween)gsap.killTweensOf(h.keyTween);
    s.timeline?.kill();s.phase='opening';
    s.timeline=gsap.timeline({onUpdate:()=>{pose(f,s);refresh();}})
      .to(s,{key:1,duration:.15}).to(s,{ratio,duration:.65,ease:'power2.inOut'})
      .to(s,{key:0,duration:.1}).call(()=>{s.phase='holding';refresh();});
    refresh();return true;
  }
  function close(){
    const f=selected,s=states.get(f);if(!s||!allowed(f).ok)return false;
    s.phase='closing';clearTimeout(autoTimer);
    inspectorFloor=f;poseInspector();
    s.timeline=gsap.timeline({onUpdate:()=>{pose(f,s);refresh();}})
      .to(s,{ratio:0,duration:.65,ease:'power2.inOut'}).to(s,{key:0,duration:.15})
      .call(()=>{const h=hatchDoors[f];h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;states.delete(f);inspectorFloor=[...states.keys()].pop()??-1;if(inspectorFloor<0)HallInspector.end();else poseInspector();refresh();});
    refresh();return true;
  }
  function refresh(){
    if(!el('hall-title'))return;
    const permission=allowed(selected),s=states.get(selected);
    el('hall-title').textContent=`${selected+1}F · HD`;
    for(const id of ['hall-half','hall-open'])el(id).disabled=!permission.ok;
    el('hall-close').disabled=!s||!permission.ok;
    el('hall-mode').textContent=insMode?'INS':'AUTO';
    el('hall-mode').title=insMode?'점검운전 상태입니다.':'문을 열면 INS로 전환됩니다.';
    el('hall-half').setAttribute('aria-pressed',String(s?.phase==='holding'&&s.ratio===.5));
    el('hall-open').setAttribute('aria-pressed',String(s?.phase==='holding'&&s.ratio===1));
    const warning=s?.ratio>0&&carAbsent(selected);
    const message=warning?'⚠ 바로 아래 카 없음':!permission.ok?permission.message:'';
    el('hall-message').textContent=message;el('hall-message').hidden=!message;
    el('hall-message').classList.toggle('warning',warning);
    el('hall-drive-note').textContent=insMode&&states.size&&!DoorBypass.canInspect()?
      !CarDoor.secured()?'이동: 카문 닫힘 확인':'이동: BYP · HD 확인':'';
    el('hall-drive-note').hidden=!el('hall-drive-note').textContent;
    el('hall-up').disabled=el('hall-dn').disabled=!insMode||busy()||estop;
  }
  function observe(){
    if(moving||overspeedActive)return;leaveCabinView();gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    const y=FLOOR_Y[selected];controls.target.set(0,y+1.1,FRONT_WALL_INNER_Z);
    const distance=Math.max(3.5,(S.DOOR_W+.8)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
    camera.position.set(.65,y+1.35,FRONT_WALL_INNER_Z+distance);controls.update();updateManualCameraNear();
  }
  function update(){
    for(const s of states.values())if(s.phase!=='holding'){if(estop||moving)s.timeline.pause();else s.timeline.resume();}
    poseInspector();
    for(let f=0;f<buttons.length;f++){
      const b=buttons[f],h=hatchDoors[f];HallInspector.keyWorld(f,point);point.x=0;point.y=FLOOR_Y[f]+1.15;point.z+=.05;let shown=camera.position.distanceToSquared(point)<400;
      for(let o=h.right;o&&shown;o=o.parent)if(!o.visible)shown=false;
      point.project(camera);shown=shown&&point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;
      b.hidden=!shown;if(shown)PartActions.positionButton(b,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);b.classList.toggle('active',states.has(f));
    }
    if(!el('hall-panel')?.hidden)refresh();
  }
  function bind(){
    const icon='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.7"><path d="M4 21V3h16v18M12 3v18M8 12h1m6 0h1"/><path d="m7 17 2-2 2 2m2 0 2-2 2 2"/></svg>')+'")';
    for(let f=0;f<FLOORS;f++){const b=document.createElement('button');b.className='part-action';b.type='button';b.id=`hall-action-${f}`;b.hidden=true;b.setAttribute('aria-label',`${f+1}층 승장문 점검`);b.setAttribute('aria-controls','hall-panel');b.setAttribute('aria-expanded','false');b.style.setProperty('--part-icon',icon);b.onclick=()=>pick(f);el('part-actions').appendChild(b);buttons.push(b);}
    el('hall-dismiss').onclick=dismiss;el('hall-half').onclick=()=>request(.5);el('hall-open').onclick=()=>request(1);el('hall-close').onclick=close;refresh();
  }
  function resetAll(){
    InterlockDemo.cancel();for(const s of states.values())s.timeline?.kill();states.clear();inspectorFloor=-1;HallInspector.end();
    hatchDoors.forEach((h,f)=>{if(h.keyTween)gsap.killTweensOf(h.keyTween);gsap.killTweensOf(h.hook.rotation);h.manualActive=false;h.manualCoupled=false;h.manualOpen=0;h.right.position.x=h.right.userData.cx;h.left.position.x=h.left.userData.cx;setEmergencyKey(f,0);spinDoorDrive(h);HallInterlock.update(h);});refresh();
  }
  return {bind,select,pick,dismiss,observe,request,close,resetAll,update,allowed,open:ratio=>ratio===0?close():request(ratio),get selected(){return selected;},get active(){return states.size>0;},get activeFloor(){return states.has(selected)?selected:states.keys().next().value??-1;},get busy(){return busy();},get phase(){return states.get(selected)?.phase||'idle';},get poseState(){return states.get(selected)||{ratio:0};}};
})();
