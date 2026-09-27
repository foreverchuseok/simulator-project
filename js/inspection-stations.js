// 피트·카상부 점검기 아이콘 → 승강곰 접근 → UP/DOWN 홀드 운전.
// 형상 원본은 두 위치 모두 pit_inspection_station.glb. 이동/FSM은 ui.js를 사용한다.
const InspectionStations=(()=>{
  const stations={},point=new THREE.Vector3(),body=new THREE.Vector3(),handA=new THREE.Vector3(),handB=new THREE.Vector3();
  const approach={value:0};
  let active=null,ready=false,lastCarY=0,cloned=false;
  const panel=()=>document.getElementById('inspection-drive');
  const icon='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="m9 9 3-3 3 3m-6 6 3 3 3-3"/></svg>')+'")';
  function add(key,node){
    const b=document.createElement('button');b.id=`inspection-action-${key}`;b.className='part-action';b.type='button';b.hidden=true;
    b.style.setProperty('--part-icon',icon);b.setAttribute('aria-controls','inspection-drive');b.setAttribute('aria-expanded','false');
    b.setAttribute('aria-label',key==='pit'?'피트 점검운전':key==='machine'?'기계실 제어반 점검운전':'카 상부 점검운전');b.title=b.getAttribute('aria-label')+' · 리셋으로 자동 복귀';
    b.addEventListener('click',()=>toggle(key));document.getElementById('part-actions').appendChild(b);
    stations[key]={node,button:b};
  }
  function build(){
    add('pit',shaftCableGrp.getObjectByName('pitInspectionStation'));
    const frame=carGrp.getObjectByName('carFrameGrp'),mount=frame.userData.inspectionMount;
    const g=new THREE.Group();g.name='carInspectionStation';g.userData={type:'car-inspection-station',ready:false};
    // 체대 윗면: 로컬 +Z(버튼)가 +Y, 긴 +Y축은 -X(STOP은 왼쪽).
    g.position.set(mount.x,mount.topY+.002,0);g.rotation.set(-Math.PI/2,0,Math.PI/2);frame.add(g);add('car',g);
    document.getElementById('inspection-return').addEventListener('click',()=>InspectionReturn.start(active));
  }
  function cloneModel(){
    const source=stations.pit.node;
    if(cloned||!source.userData.ready)return;
    const target=stations.car.node,model=source.children[0].clone(true);target.add(model);target.userData.ready=true;cloned=true;
    target.updateWorldMatrix(true,true);
    const data=model.getObjectByName('PitInspectionStation').userData;
    const start=carGrp.worldToLocal(target.localToWorld(new THREE.Vector3(...data.cableExit)));
    const box=carGrp.getObjectByName('carTopBox'),hole=box.userData.entryHole.center;
    const y=hole[1]-.08,z=carGrp.getObjectByName('carFrameGrp').userData.inspectionMount.z+.018;
    CarWiring.run(carGrp,'carInspectionCable',[
      start.toArray(),[start.x-.025,start.y,z],[box.position.x,start.y,z],
      [box.position.x,y,z],[box.position.x,y,hole[2]],[hole[0]+.008,hole[1],hole[2]]
    ],{radius:.003,bend:.012});
  }
  function mountMachine(){
    if(stations.machine||!ControlPanel.ready)return;
    const root=ControlPanel.root,data=root.getObjectByName('ControlPanel').userData.upperLayout;
    const [kx,ky,kz]=CONTROL_PANEL_SPEC.scale,bp=data.bypassPosition;
    const g=new THREE.Group();g.name='machineInspectionStation';
    // GLB upperLayout 기준. 상대 버튼 오프셋은 control_panel_sicon.py의
    // left=SW_X-.067, bp=(SW_X+.025,SW_Y-.143,fz+.003) 계약을 따른다.
    g.position.set((data.switchX-.067)*kx,(bp[1]+.143)*ky,(bp[2]+.010)*kz);
    g.userData={ready:true,type:'machine-inspection-station',
      up:.012*ky,down:-.162*ky,common:-.075*ky,
      iconX:(data.switchWidth/2+.067+.035)*kx,iconY:.100*ky};
    root.add(g);add('machine',g);
  }
  function stop(){insHold=0;insStop();}
  function dismiss(){
    if(!active)return;stop();panel().hidden=true;stations[active].button.setAttribute('aria-expanded','false');
  }
  function release(){
    if(!active)return;stop();gsap.killTweensOf(approach);Mascot.endInspection();
    stations[active].node.userData.inspection=false;stations[active].button.classList.remove('active');
    stations[active].button.setAttribute('aria-expanded','false');panel().hidden=true;active=null;ready=false;
  }
  function toggle(key){
    if(InspectionReturn.busy)return false;
    const s=stations[key];if(!s?.node.userData.ready)return false;
    if(key==='machine'&&(!ControlPanel.open||ControlPanel.busy))return false;
    if(active===key){
      if(panel().hidden){closeAllMenus();panel().hidden=false;s.button.setAttribute('aria-expanded','true');return true;}
      dismiss();return true;
    }
    if(HallManual.active||HallManual.busy){updateStatus('v-dir','승장문 점검을 마친 뒤 점검운전하세요.','#f0883e');return false;}
    if(moving||estop||overspeedActive||UCMDemo.state.active||inspectionResetting){updateStatus('v-dir','운행·시연을 멈춘 뒤 점검운전하세요.','#f0883e');return false;}
    closeAllMenus();release();setInspectionMode(true);if(!insMode)return false;
    leaveCabinView();active=key;ready=false;lastCarY=carGrp.position.y;approach.value=0;
    s.node.userData.inspection=true;s.button.classList.add('active');s.button.setAttribute('aria-expanded','true');panel().hidden=false;
    panel().querySelectorAll('button').forEach(b=>b.disabled=true);
    Mascot.beginInspection();pose();
    gsap.to(approach,{value:1,duration:.85,ease:'power1.inOut',onComplete:()=>{
      ready=true;pose();panel().querySelectorAll('button').forEach(b=>b.disabled=!insMode);
    }});
    return true;
  }
  function pose(){
    const s=stations[active];if(!s)return;
    const n=s.node;n.updateWorldMatrix(true,false);
    if(active==='machine'){
      const d=n.userData;
      handA.set(0,insDir<0?d.down:d.up,0);n.localToWorld(handA);
      handB.set(0,d.common,0);n.localToWorld(handB);
      body.set(n.position.x-.38,0,.38+(1-approach.value)*.35);ControlPanel.root.localToWorld(body);
      Mascot.inspectionPose(body.x,body.y,body.z,0,ready?handA:null,ready?handB:null,ControlPanel.root.rotation.y+Math.PI);
      return;
    }
    // 원본 GLB 버튼: UP=-.037, COMMON=-.079, DOWN=-.121, 앞면=.0762.
    handA.set(0,insDir<0?-.121:-.037,.080);n.localToWorld(handA);
    handB.set(0,-.079,.080);n.localToWorld(handB);
    n.getWorldPosition(body);
    const remaining=1-approach.value;
    if(active==='car'){
      body.x+=.23;body.z+=.38+remaining*.45;body.y=carGrp.position.y+S.CAR_H/2+.035;
    }else{
      body.x+=.43;body.z+=remaining*.45;body.y=Y0+.02;
    }
    Mascot.inspectionPose(body.x,body.y,body.z,0,ready?handA:null,ready?handB:null,active==='car'?Math.PI:-Math.PI/2);
    if(!ready){
      const step=Math.sin(approach.value*Math.PI*6)*.025;
      Mascot.rig.feet[0].position.y=Math.max(0,step);Mascot.rig.feet[1].position.y=Math.max(0,-step);
    }else{Mascot.rig.feet.forEach(f=>f.position.y=0);}
  }
  function update(){
    if(!stations.pit)return;cloneModel();mountMachine();
    if(active){
      if(active==='car'){
        const dy=carGrp.position.y-lastCarY;camera.position.y+=dy;controls.target.y+=dy;
      }
      lastCarY=carGrp.position.y;pose();
    }
    for(const [key,s] of Object.entries(stations)){
      if(key==='machine')point.set(s.node.userData.iconX,s.node.userData.iconY,.025);
      else point.set(0,.20,.13);
      s.node.localToWorld(point);
      let shown=s.node.userData.ready&&camera.position.distanceToSquared(point)<49;
      if(key==='machine')shown=shown&&ControlPanel.open&&!ControlPanel.busy;
      for(let p=s.node;p&&shown;p=p.parent)if(!p.visible)shown=false;
      point.project(camera);shown=shown&&point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;
      s.button.hidden=!shown;
      if(shown)PartActions.positionButton(s.button,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
    }
  }
  return {build,update,toggle,dismiss,release,get active(){return active;},get ready(){return ready;}};
})();
