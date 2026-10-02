/* 승장·주 OPB·측면 OPB의 직접 조작. 운행/도어/안전 판정은 기존 ui.js 경로를 쓴다. */
const PassengerControls = (() => {
  const keys = [], calls = new Map(), point = new THREE.Vector3();
  let target = null, dwelling = false, lastVisibility = 0;
  function blocked() {
    return estop || insMode || overspeedActive || ManualRescueDemo.active || ARDDemo.active ||
      UCMDemo.state.active || InterlockDemo.active || InspectionReturn.busy || inspectionResetting ||
      BufferDemo.active || AscentDemo.active || BrakeDemo.active || DoorBypass.mode !== 'off' || !PitLadder.secured;
  }
  function paint() {
    for (const k of keys) {
      const on = k.floor != null && calls.has(k.floor) && (k.dir ? calls.get(k.floor).has(k.dir) : true);
      if (k.on === on) continue;
      k.on = on;k.button.classList.toggle('active',on);k.button.setAttribute('aria-pressed',String(on));
      if (k.dir) HallFinish.setLamp(k.floor,k.dir,on);
      else if (k.material) { k.material.emissive.setHex(on?0x65baff:0);k.material.emissiveIntensity=on?1.6:0; }
    }
    document.querySelectorAll('#fbtns .c-btn').forEach(b=>b.classList.toggle('called',calls.has(Number(b.dataset.f))));
  }
  function request(floor, dir = 'car') {
    if (!Number.isInteger(floor) || floor < 0 || floor >= FLOORS || blocked()) return false;
    if (!calls.has(floor)) calls.set(floor,new Set());
    calls.get(floor).add(dir);paint();
    if (!moving && floor !== curFloor && currentState === ELEVATOR_STATE.DOOR_OPEN) dwelling=false;
    if (!moving && floor === curFloor && CarDoor.alignedFloor() === floor) openDoors();
    pump();return true;
  }
  function pump() {
    if (blocked()) {
      if (calls.size) { calls.clear();paint(); }
      target=null;dwelling=false;return;
    }
    if (moving) return;
    if (currentState === ELEVATOR_STATE.DOOR_OPEN && calls.has(curFloor)) {
      calls.delete(curFloor);target=null;dwelling=true;paint();
    }
    if (dwelling) {
      if (currentState !== ELEVATOR_STATE.IDLE) return;
      dwelling=false;
    }
    if (!calls.size || CarDoor.state?.busy) return;
    if (target == null) target=calls.keys().next().value;
    if (target === curFloor && CarDoor.alignedFloor() === target) openDoors();
    else if (doorOpen) closeDoors(); // 폐문 콜백에 목적지를 남기지 않아 STOP/열림 후 유령 출발을 막는다.
    else moveElevator(target);
  }
  function bind(object, floor, dir, action, name) {
    if (!object || keys.some(k=>k.object===object)) return;
    object.userData.visualOnly=false;
    const button=document.createElement('button');button.type='button';button.className='part-action';button.hidden=true;
    button.id='passenger-'+(dir?`hall-${floor}-${dir}`:object.name);button.setAttribute('aria-label',name);
    const k={object,floor,dir,button,on:null,rest:object.position.z};
    if (!dir) {
      const face=object.children.find(o=>o.isMesh && !o.material.map);
      if (face) { face.material=face.material.clone();k.material=face.material; }
    }
    button.addEventListener('click',()=>{
      const accepted=floor!=null?request(floor,dir||'car'):!blocked()&&!moving;
      if (!accepted) return;
      if (action) document.getElementById(action==='open'?'btn-open':'btn-close').click();
      gsap.killTweensOf(object.position);
      gsap.fromTo(object.position,{z:k.rest-.0015},{z:k.rest,duration:.18,ease:'power1.out'});
    });
    document.getElementById('part-actions').appendChild(button);
    PartGlow.bind(button,()=>object,name,null,{direct:true});keys.push(k);paint();
  }
  function hall(root,floor) {
    for (const dir of ['up','down']) {
      const object=root.getObjectByName(dir==='up'?'ButtonUp':'ButtonDown');
      if (object?.visible) bind(object,floor,dir,null,`${floor+1}층 ${dir==='up'?'상승':'하강'} 호출`);
    }
  }
  function build() {
    for (let f=0;f<FLOORS;f++) {
      bind(carGrp.getObjectByName('opbFloorButton_'+(f+1)),f,null,null,`주조작반 ${f+1}층`);
      bind(carGrp.getObjectByName('accessibleButton_'+(f+1)),f,null,null,`측면 조작반 ${f+1}층`);
      const h=scene.getObjectByName('HallCallButton_'+(f+1));if(h)hall(h,f);
    }
    for (const action of ['open','close']) {
      bind(carGrp.getObjectByName(action==='open'?'opbDoorOpen':'opbDoorClose'),null,null,action,`주조작반 ${action==='open'?'열림':'닫힘'}`);
      bind(carGrp.getObjectByName('accessibleButton_'+action),null,null,action,`측면 조작반 ${action==='open'?'열림':'닫힘'}`);
    }
  }
  function update(now) {
    pump();
    if(now-lastVisibility<.12)return;lastVisibility=now;
    for(const k of keys) {
      k.object.getWorldPosition(point);
      let shown=camera.position.distanceToSquared(point)<(k.dir?16:9);
      for(let o=k.object;o&&shown;o=o.parent)if(!o.visible)shown=false;
      if(shown){point.project(camera);shown=Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1;}
      k.button.hidden=!shown;
    }
  }
  return {build,hall,request,update,hold(){dwelling=true;},get pending(){return [...calls.keys()];},get keys(){return keys;}};
})();
