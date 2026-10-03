// One continuous educational story: a drunk bear kicks a landing door.
// Upper emergency guide (header) and lower retention shoe (sill) are shown as one set
// (EN 81-20 5.3.5.3.2 — both keep the panel in place when the normal guiding fails).
// All deformation is on disposable visual copies; this is not a strength calculation
// or a certified impact-resistance demonstration.
const RetentionDemo=(()=>{
  const s={floor:-1,phase:'idle',chapter:0,focus:'retention',reinforced:false,approach:0,bend:0,escape:0,fall:0,alarm:0,install:1,
    kick:0,sit:0,run:0,jump:0,drunk:0,dizzy:0,mouth:0,flail:0,topPush:0,topEscape:0,damage:0,
    hic:0,scream:0,bang:0,flash:0,flashTop:0,flashBottom:0,clock:0};
  const v=new THREE.Vector3(),target=new THREE.Vector3(),box=new THREE.Box3();
  let saved,visual,bear,timeline,panel,title,caption,chapter,progress,pauseButton,badge,shoeLabel,retentionLabel,guideLabel,paused=false,shake;
  let hicBubble,screamBubble,bangBurst,flashLayer;
  const lines={
    intro:['문을 붙잡는 두 번째 안전장치','위는 상부 비상가이드가 C레일 립을, 아래는 금색 보강슈가 2번 홈을 붙잡습니다. 둘은 한 세트입니다.'],
    worn:['보조장치가 없고, 기존 가이드가 낡았다면','마모·부식·화재로 행거와 도어슈가 제 기능을 잃은 상황을 가정합니다.'],
    stagger:['소주 한 병 들고 비틀비틀…','카가 없는 승강장. 닫힌 문은 기대거나 차도 되는 벽이 아닙니다.'],
    kick:['쾅! 술김에 문을 걷어찹니다','충격이 문 아래를 승강로 쪽으로 밀어냅니다.'],
    doorFly:['문짝이 위·아래 모두 이탈 → 추락','하단은 실에서, 상단은 레일에서 빠져 문짝째 승강로로 떨어집니다.'],
    install:['상부 비상가이드 + 하부 보강슈 설치','기존 가이드와 별도로, 문의 위와 아래를 붙잡을 경로를 추가합니다.'],
    installOther:['반대쪽 장치도 함께','상부와 하부가 같이 있어야 문짝 전체를 붙잡을 수 있습니다.'],
    retainedApproach:['다시 비틀비틀 다가와서…','같은 충격을 다시 가합니다.'],
    retainedKick:['쾅! 이번엔 문이 버팁니다','문은 찌그러져도 제자리에 남고, 곰은 튕겨 엉덩방아를 찧습니다.'],
    upperHeld:['위: 비상가이드가 C레일 립에 걸림','문 상부가 승강로 쪽으로 2.5mm 밀리자 갈고리 턱이 립을 붙잡습니다.'],
    lowerHeld:['아래: 보강슈가 2번 홈에서 버팀','일반 도어슈가 손상돼도 금색 보강슈가 문 하단의 이탈을 억제합니다.'],
    overloadApproach:['그러나, 더 큰 충격은 다릅니다','도움닫기 날아차기 — 보강장치에도 한계가 있습니다.'],
    overload:['보조장치까지 손상되면 이탈 가능','큰 충격은 갈고리·보강슈·체결부를 함께 손상시킬 수 있습니다. 안전한 충격 크기를 제시하는 시연이 아닙니다.'],
    result:['보조장치는 위험을 줄이는 추가 장치입니다','충돌을 막아 주지 않습니다. 문을 차거나 기대지 말고, 손상된 문은 사용을 중지하고 점검을 요청하세요.']
  };
  function reason(f){
    if(s.floor>=0)return '문 이탈방지 시연이 진행 중입니다.';
    if(!Number.isInteger(f)||!hatchDoors[f])return '승장문을 선택해 주세요.';
    if(ManualRescueDemo.active||ARDDemo.active||AscentDemo.active||BrakeDemo.active||BufferDemo.active||CharacterWalk.active||Mascot.inspecting)return '진행 중인 시연·체험을 먼저 종료하세요.';
    if(!InterlockDemo.allowed(f))return '카 정지·문 닫힘 후 점검과 비상정지를 복귀하세요.';
    if(![hatchDoors[f].left,hatchDoors[f].right].every(l=>l.getObjectByName('HallRetentionDevice')&&l.getObjectByName('HallDoorPanelFinish')&&l.children.some(c=>c.userData?.type==='hall-emergency-guide')))return '문과 보강장치를 불러오는 중입니다. 잠시 후 다시 눌러주세요.';
    return '';
  }
  function own(resource){visual.resources.add(resource);return resource;}
  function boxPart(parent,w,h,d,mat,x=0,y=0,z=0){const m=createBox(w,h,d,mat,x,y,z,parent);own(m.geometry);return m;}
  function hide(o){saved.hidden.push([o,o.visible]);o.visible=false;}
  function flashRing(){
    const m=own(new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:0,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    const ring=new THREE.Mesh(own(new THREE.RingGeometry(.005,.0075,40)),m);ring.renderOrder=10;visual.root.add(ring);return ring;
  }
  function prepare(f){
    const h=hatchDoors[f],root=new THREE.Group();root.name='RetentionStoryVisuals';scene.add(root);
    visual={root,resources:new Set(),leaves:[],lastBend:NaN,view:'hall',hallZ:0};
    h.right.localToWorld(v.set(0,0,h.right.userData.triKey.hallZ));visual.hallZ=v.z;
    const panelMat=own(M.ss(0xc8d0d6)),wornMat=own(M.paint(0x9b5542)),crackMat=own(new THREE.LineBasicMaterial({color:0x38424c}));
    for(const leaf of [h.left,h.right]){
      const device=leaf.getObjectByName('HallRetentionDevice'),finish=leaf.getObjectByName('HallDoorPanelFinish'),top=device.userData.panelTop;
      const guide=leaf.children.find(c=>c.userData?.type==='hall-emergency-guide'),gs=guide.userData,rail=gs.rail;
      const group=new THREE.Group();group.name='RetentionDamagedDoor';root.add(group);group.position.copy(leaf.position);group.quaternion.copy(leaf.quaternion);
      // upper: whole leaf incl. hanger plate, rollers and guide; pivot: lower panel swinging about the panel top.
      const upper=new THREE.Group();upper.name='RetentionDoorUpper';group.add(upper);
      const pivot=new THREE.Group();pivot.name='RetentionDoorLower';pivot.position.y=top;upper.add(pivot);
      // Hook inner face ↔ C-rail lip outer face, both in leaf-local Z (same formula as verify_hall_emergency_guide).
      const gap=rail.plateZ+gs.tipZ-gs.thickness/2-(rail.lipZ+.0015);
      const data={group,upper,pivot,top,gap,home:group.position.clone(),shoes:[],details:[],device:null,deviceHome:null,guide:null,guideHome:null,
        lipZ:leaf.getWorldPosition(new THREE.Vector3()).z+rail.lipZ+.0015,hookOffset:gs.tipZ-gs.thickness/2,tipY:gs.tipY};
      leaf.updateWorldMatrix(true,true);
      for(const child of leaf.children){
        box.setFromObject(child);if(box.isEmpty())continue;v.copy(box.min);leaf.worldToLocal(v);
        if(child===finish){hide(child);continue;}
        const copy=child.clone(true);hide(child);
        if(child!==device&&v.y>=top-.035){upper.add(copy);if(child===guide){data.guide=copy;data.guideHome=copy.position.clone();}continue;}
        pivot.add(copy);copy.position.y-=top;
        if(child===device){data.device=copy;data.deviceHome=copy.position.clone();}
        else if(child.name==='HallOrdinaryDoorShoe')data.shoes.push({o:copy,p:copy.position.clone(),s:copy.scale.clone(),normal:copy.material,worn:wornMat});
        else data.details.push({o:copy,p:copy.position.clone()});
      }
      const geometry=own(new THREE.BoxGeometry(HALL_FINISH.panelW,HALL_FINISH.panelH,HALL_FINISH.panelT,10,22,1));
      const mesh=new THREE.Mesh(geometry,panelMat);mesh.name='RetentionDeformedPanel';mesh.position.copy(finish.position);mesh.position.y-=top;pivot.add(mesh);
      data.panel=mesh;data.base=new Float32Array(geometry.attributes.position.array);
      const cracks=own(new THREE.BufferGeometry());cracks.setAttribute('position',new THREE.BufferAttribute(new Float32Array(108),3));
      data.cracks=new THREE.LineSegments(cracks,crackMat);data.cracks.name='RetentionPanelDamage';data.cracks.position.copy(mesh.position);pivot.add(data.cracks);
      data.hookY=data.guideHome.y+data.tipY;
      visual.leaves.push(data);
    }
    // A local dark shaft cutaway is used while the actual car stays at its saved floor.
    const dark=own(M.paint(0x111923));dark.roughness=1;
    const voidPanel=boxPart(root,S.DOOR_W+1.8,S.DOOR_H+4,.025,dark,0,FLOOR_Y[f]+S.DOOR_H/2-.7,visual.hallZ-1.7);voidPanel.name='RetentionShaftCutaway';visual.voidPanel=voidPanel;
    visual.ringTop=flashRing();visual.ringBottom=flashRing();
    bear=DrunkBear.create();scene.add(bear.root);bear.root.visible=false;
  }
  function deform(){
    if(visual.lastBend===s.bend)return;visual.lastBend=s.bend;
    for(const d of visual.leaves){const a=d.panel.geometry.attributes.position,b=d.base;
      for(let i=0;i<a.count;i++){
        const j=i*3,y=(b[j+1]+HALL_FINISH.panelH/2)/HALL_FINISH.panelH,x=b[j]/HALL_FINISH.panelW*2;
        const bow=Math.pow(Math.max(0,Math.sin(Math.PI*y)),1.2)*(.65+.35*Math.cos(x*Math.PI/2));
        const crease=Math.sin(y*32+x*7)*Math.exp(-Math.pow((y-.38)*5,2))*.12;
        a.setXYZ(i,b[j],b[j+1],b[j+2]-s.bend*(bow+crease));
      }
      a.needsUpdate=true;d.panel.geometry.computeVertexNormals();d.panel.geometry.computeBoundingSphere();
      const cp=d.cracks.geometry.attributes.position;let n=0;
      for(let row=0;row<3;row++)for(let segment=0;segment<6;segment++)for(let end=0;end<2;end++){
        const k=segment+end,x=-.24+k*.075,y=.27+row*.10+(k%2)*.013,px=x/HALL_FINISH.panelW*2;
        const bow=Math.pow(Math.sin(Math.PI*y),1.2)*(.65+.35*Math.cos(px*Math.PI/2));
        const crease=Math.sin(y*32+px*7)*Math.exp(-Math.pow((y-.38)*5,2))*.12;
        cp.setXYZ(n++,x,(y-.5)*HALL_FINISH.panelH,HALL_FINISH.panelT/2+.009-s.bend*(bow+crease));
      }
      cp.needsUpdate=true;d.cracks.geometry.computeBoundingSphere();
    }
  }
  const time=()=>timeline?timeline.time():0;
  function poseActor(){
    const t=time(),floorY=FLOOR_Y[s.floor],sway=s.drunk*(1-s.sit*.6);
    // Kick contact: the extended right foot reaches ~0.4m ahead of the root.
    const distance=(1-s.approach)*(1.5+s.run*.9);
    const z=visual.hallZ+.40+distance+s.sit*.28-s.fall*.75;
    bear.root.visible=visual.view==='hall'||visual.view==='bear';
    bear.root.position.set(-.12+Math.sin(t*1.7)*.16*sway*(1-s.kick),floorY+s.jump*.28*(1-s.fall)-s.fall*2.8,z);
    bear.root.rotation.set(-s.fall*1.15,Math.PI+Math.sin(t*1.3)*.22*sway*(1-s.kick),Math.sin(t*2.1)*.12*sway+s.alarm*.04);
    bear.pose({t,walk:s.approach*(13+s.run*5),sway,kick:s.kick,sit:s.sit,run:s.run,dizzy:s.dizzy,blush:.55+.45*s.drunk,
      lids:s.mouth>.5?.05:s.dizzy>.5?.85:.55,mouth:s.mouth,flail:s.flail,airborne:s.jump>.05||s.fall>.05});
  }
  function bubble(el,o,offsetY,amount,offsetX=0){
    el.hidden=amount<.02||!(visual.view==='hall'||visual.view==='bear');if(el.hidden)return;
    o.getWorldPosition(v);v.project(camera);
    el.style.left=`${Math.max(60,Math.min(innerWidth-60,(v.x+1)*innerWidth/2+offsetX))}px`;el.style.top=`${Math.max(60,(1-v.y)*innerHeight/2-offsetY)}px`;
    el.style.opacity=String(Math.min(1,amount*1.4));el.style.transform=`translate(-50%,-50%) scale(${.6+.5*Math.min(1,amount)})`;
  }
  function pose(){
    if(s.floor<0||!visual)return;deform();
    for(const d of visual.leaves){
      d.group.position.copy(d.home);
      const lift=s.topEscape*.035,drop=s.fall*(s.topEscape*2.5+(1-s.topEscape)*.35);
      d.upper.position.set(0,lift-drop,-s.topEscape*.30-s.escape*.08*(1-s.topEscape));
      // topPush tilts the leaf about its sill line: the bottom stays in the groove, the hook moves exactly `gap` and meets the lip.
      d.upper.rotation.set(-Math.atan2(s.topPush*d.gap,d.hookY)-s.topEscape*(.35+s.fall*.5),0,(d.home.x<0?-1:1)*s.topEscape*.08);
      d.pivot.rotation.x=s.escape*.60;d.pivot.rotation.z=(d.home.x<0?-1:1)*s.escape*.065;
      d.panel.visible=visual.view!=='shoe';
      d.cracks.visible=d.panel.visible&&s.bend>.08;
      d.details.forEach(q=>{q.o.visible=visual.view!=='shoe';q.o.position.copy(q.p);const y=(q.p.y+d.top)/d.top;q.o.position.z-=s.bend*Math.max(0,Math.sin(Math.PI*y));});
      d.device.visible=s.reinforced;d.device.position.copy(d.deviceHome);d.device.position.y+=(1-s.install)*.22;
      d.device.position.z-=s.damage*.035;d.device.rotation.x=s.damage*.55;
      d.guide.visible=s.reinforced;d.guide.position.copy(d.guideHome);d.guide.position.y+=(1-s.install)*.14;
      d.guide.rotation.x=s.damage*.8;
      d.shoes.forEach(q=>{q.o.material=s.phase==='intro'?q.normal:q.worn;q.o.position.copy(q.p);q.o.position.z-=s.bend*.23;q.o.rotation.x=s.bend*1.1;q.o.scale.copy(q.s);q.o.scale.y*=s.phase==='intro'?1:.55;});
    }
    visual.voidPanel.visible=visual.view==='hall'||visual.view==='bear';
    // Contact flashes at the hook tip (top) and the reinforcement shoe (bottom).
    const d=visual.leaves[0];
    d.guide.updateWorldMatrix(true,false);d.guide.localToWorld(v.set(0,d.tipY,d.hookOffset));visual.ringTop.position.copy(v);
    d.device.getWorldPosition(visual.ringBottom.position);
    for(const [ring,amount] of [[visual.ringTop,s.flashTop],[visual.ringBottom,s.flashBottom]]){
      ring.visible=amount>.01;ring.material.opacity=amount;ring.scale.setScalar(1+(1-amount)*2.5);ring.quaternion.copy(camera.quaternion);
    }
    poseActor();progress.style.transform=`scaleX(${timeline?Math.min(1,timeline.progress()):0})`;
    bubble(hicBubble,bear.parts.head,90,s.hic);bubble(screamBubble,bear.parts.head,110,s.scream);
    bubble(bangBurst,bear.parts.legs[1].ankle,130,s.bang,-70);flashLayer.style.opacity=String(s.flash);
    shoeLabel.hidden=retentionLabel.hidden=visual.view!=='shoe';guideLabel.hidden=visual.view!=='header';
    const bottom=innerHeight<500&&camera.aspect>1.4?innerHeight-65:innerHeight-panel.offsetHeight-90;
    const at=(label,node,lift)=>{node.getWorldPosition(v);v.project(camera);
      return{label,x:Math.max(88,Math.min(innerWidth-88,(v.x+1)*innerWidth/2)),y:Math.max(75,Math.min(bottom,(1-v.y)*innerHeight/2-lift))};};
    if(visual.view==='shoe'){
      retentionLabel.hidden=!s.reinforced;
      const place=[at(shoeLabel,d.shoes[0].o,40),at(retentionLabel,d.device,85)];
      // On narrow portrait screens both parts project to nearly the same spot: stack the retention label above.
      const [a,b]=place,gap=6;
      if(!b.label.hidden&&Math.abs(a.x-b.x)<(a.label.offsetWidth+b.label.offsetWidth)/2+gap&&Math.abs(a.y-b.y)<Math.max(a.label.offsetHeight,b.label.offsetHeight)+gap){
        b.y=a.y-b.label.offsetHeight-gap;
        if(b.y<75){b.y=75;a.y=b.y+b.label.offsetHeight+gap;}
      }
      for(const p of place){p.label.style.left=`${p.x}px`;p.label.style.top=`${p.y}px`;}
    }else if(visual.view==='header'){
      guideLabel.hidden=!s.reinforced;const p=at(guideLabel,visual.ringTop,60);guideLabel.style.left=`${p.x}px`;guideLabel.style.top=`${p.y}px`;
    }
  }
  function aim(view){
    visual.view=view;const f=s.floor,portrait=camera.aspect<.8,fit=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
    if(view==='shoe'){
      const d=visual.leaves[0];d.device.updateWorldMatrix(true,true);d.device.getWorldPosition(target);target.y=FLOOR_Y[f]+.035;
      const distance=Math.max(.48,.62/fit);
      if(innerHeight<500&&camera.aspect>1.4)target.x-=.18;
      camera.position.copy(target).add(v.set(portrait?.11:.18,.14*distance/.48,-distance));
    }else if(view==='header'){
      // From the shaft side, as in verify_hall_emergency_guide: hook, hanger plate and C-rail lip in one frame.
      const d=visual.leaves[0];d.guide.updateWorldMatrix(true,true);d.guide.localToWorld(target.set(0,d.tipY*.6,d.hookOffset));
      const distance=Math.max(.2,.3/fit);
      camera.position.copy(target).add(v.set(distance*(portrait?.35:.7),distance*.42,-distance));
    }else if(view==='bear'){
      // Low side view from the kicking-leg side (bear's right = world -X), just outside the wall face: face profile + kick + recessed door.
      const faceZ=FRONT_WALL_INNER_Z+S.WALL_T;
      target.set(-.2,FLOOR_Y[f]+.68,faceZ+.4);
      camera.position.set(portrait?-1.55:-2.5,FLOOR_Y[f]+1.15,faceZ+(portrait?1.7:.95));
    }else{
      // Door front: cut here at the moment of impact so both leaves (top hanger and bottom) and the fall read at once.
      target.set(0,FLOOR_Y[f]+1.0,visual.hallZ+.3);
      const dist=Math.max(4.7,(S.DOOR_W+1.0)/fit);
      camera.position.set(portrait?.3:.9,target.y+.45,target.z+dist);
    }
    controls.target.copy(target);controls.update();camera.updateMatrixWorld(true);pose();
  }
  const focusView=()=>s.focus==='guide'?'header':'shoe',otherView=()=>s.focus==='guide'?'shoe':'header';
  function stage(phase,view,number){
    s.phase=phase;if(number)s.chapter=number;
    [title.textContent,caption.textContent]=lines[phase];chapter.textContent=`${s.chapter} / 6 · 문 이탈방지 (상부·하부)`;
    const shown=view||visual.view;
    badge.textContent=shown==='shoe'?'하부 실 확대 · 문판 생략':shown==='header'?'상부 헤더 확대 · 승강로 쪽에서 봄':'카가 없는 승강장 · 교육용 재구성';
    panel.dataset.danger=String(['doorFly','overload'].includes(phase));if(view)aim(view);else pose();
  }
  function resetScene(reinforced){Object.assign(s,{reinforced,approach:0,bend:0,escape:0,fall:0,alarm:0,install:1,kick:0,sit:0,run:0,jump:0,drunk:1,dizzy:0,mouth:0,flail:0,topPush:0,topEscape:0,damage:0,hic:0,scream:0,bang:0,flash:0,flashTop:0,flashBottom:0});pose();}
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function impact(level){
    if(level==='big'){MACH.overspeedImpact('collision');}else MACH.bump();
    if(reduced())return;shake?.cancel();
    const a=level==='big'?14:7;
    shake=renderer.domElement.animate([{transform:'translate(0,0)'},{transform:`translate(${-a}px,${a*.5}px)`},{transform:`translate(${a*.8}px,${-a*.4}px)`},{transform:`translate(${-a*.5}px,${a*.3}px)`},{transform:'translate(0,0)'}],{duration:level==='big'?360:200,easing:'ease-out'});
  }
  function failed(error){console.error('[RetentionDemo]',error);finish();panel.hidden=false;title.textContent='시연을 중단했습니다';caption.textContent='장면을 복구했습니다. 새로고침 후 다시 실행하세요.';}
  function safePose(){try{pose();}catch(e){failed(e);}}
  // Kick to full extension, hit, then retract. `hit` runs at the moment the foot meets the door.
  function kickTo(tl,hit,{chamber=.34,extend=.12}={}){
    return tl.to(s,{kick:.45,duration:chamber,ease:'power1.out'}).to(s,{kick:.7,duration:extend,ease:'power3.in'}).call(hit);
  }
  function bang(tl,text){
    // The white flash is one short frame-ish pop; the comic burst lingers a little longer.
    return tl.call(()=>{bangBurst.querySelector('b').textContent=text;})
      .fromTo(s,{flash:reduced()?0:.55},{flash:0,duration:.22,ease:'power2.out',immediateRender:false},'<')
      .fromTo(s,{bang:1},{bang:0,duration:.8,ease:'power2.in',immediateRender:false},'<');
  }
  function hiccup(tl,at){tl.fromTo(s,{hic:0},{hic:1,duration:.15,yoyo:true,repeat:1,repeatDelay:.5,immediateRender:false},at);}
  function start(f,focus='retention'){
    const why=reason(f);if(why){if(s.floor<0){panel.hidden=false;title.textContent='문 이탈방지 시연';caption.textContent=why;}return false;}
    clearTimeout(autoTimer);closeAllMenus();leaveCabinView();PartGlow.closeMenu();
    saved={eye:camera.position.clone(),target:controls.target.clone(),enabled:controls.enabled,minDistance:controls.minDistance,near:camera.near,carVisible:carGrp.visible,mascot:Mascot.root.visible,hidden:[],manualActive:hatchDoors[f].manualActive,manualCoupled:hatchDoors[f].manualCoupled};
    Object.assign(s,{floor:f,phase:'intro',chapter:1,focus:focus==='guide'?'guide':'retention',clock:0});paused=false;
    try{
      gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);controls.enabled=false;controls.minDistance=.05;camera.near=.005;camera.updateProjectionMatrix();
      hatchDoors[f].manualActive=true;hatchDoors[f].manualCoupled=false;
      carGrp.visible=false;Mascot.root.visible=false;prepare(f);resetScene(true);panel.hidden=false;badge.hidden=false;document.body.classList.add('retention-story');
      pauseButton.hidden=false;pauseButton.textContent='일시정지';stage('intro',focusView(),1);
      const main=s.focus==='guide'?'upperHeld':'lowerHeld',second=main==='upperHeld'?'lowerHeld':'upperHeld';
      const heldView=p=>p==='upperHeld'?'header':'shoe',flashKey=p=>p==='upperHeld'?'flashTop':'flashBottom';
      const tl=timeline=gsap.timeline({onUpdate:safePose,onComplete:()=>finish(true)});
      tl.to({}, {duration:2.6})
        .call(()=>{resetScene(false);stage('worn',focusView(),1);}).to({}, {duration:2.2})
        // 2: drunk approach → kick → whole door leaves (top from the rail, bottom from the sill)
        .call(()=>stage('stagger','bear',2)).to(s,{approach:1,duration:3.8,ease:'none'});
      hiccup(tl,'-=3.1');hiccup(tl,'-=1.5');
      kickTo(tl,()=>{impact('big');stage('kick','hall');});
      bang(tl,'쾅!');
      tl.to(s,{bend:.4,escape:1,alarm:1,duration:.4,ease:'power2.in'},'<')
        .to(s,{kick:1,duration:.3},'<')
        .call(()=>stage('doorFly','hall')).to(s,{topEscape:1,flail:1,mouth:1,scream:1,duration:.75,ease:'power2.in'})
        .to(s,{fall:1,duration:1.2,ease:'power2.in'}).to(s,{scream:0,duration:.6}).to({}, {duration:.6})
        // 3: install both devices, focused one first
        .call(()=>{resetScene(true);s.install=0;stage('install',focusView(),3);}).to(s,{install:1,duration:1.4,ease:'power2.out'}).to({}, {duration:.9})
        .call(()=>stage('installOther',otherView())).to({}, {duration:1.6})
        // 4: same kick, held at top and bottom
        .call(()=>{resetScene(true);stage('retainedApproach','bear',4);}).to(s,{approach:1,duration:3.0,ease:'none'});
      hiccup(tl,'-=1.8');
      kickTo(tl,()=>{impact('big');stage('retainedKick','hall');});
      bang(tl,'쾅!');
      tl.to(s,{bend:.3,alarm:1,topPush:1,duration:.22},'<')
        .to(s,{kick:1,duration:.25})
        .to(s,{sit:1,dizzy:1,mouth:.7,duration:.45,ease:'bounce.out'}).to(s,{mouth:0,duration:.6}).to({}, {duration:.7})
        .call(()=>stage(main,heldView(main))).fromTo(s,{[flashKey(main)]:1},{[flashKey(main)]:0,duration:1.2,repeat:1,immediateRender:false}).to({}, {duration:.8})
        .call(()=>stage(second,heldView(second))).fromTo(s,{[flashKey(second)]:1},{[flashKey(second)]:0,duration:1.1,immediateRender:false}).to({}, {duration:.9})
        // 5: running flying kick beyond the devices' limit
        .call(()=>{resetScene(true);s.run=1;stage('overloadApproach','bear',5);}).to({}, {duration:1.2}).to(s,{approach:1,duration:1.4,ease:'power2.in'})
        .to(s,{jump:1,duration:.22,ease:'power2.out'},'-=.25');
      kickTo(tl,()=>{impact('big');stage('overload','hall');},{chamber:.12,extend:.08});
      bang(tl,'콰앙!');
      tl.to(s,{bend:.7,damage:1,escape:1,alarm:1,duration:.35,ease:'power2.in'},'<')
        .to(s,{topEscape:1,flail:1,mouth:1,scream:1,kick:1,duration:.4,ease:'power2.in'})
        .to(s,{fall:.8,duration:.8,ease:'power2.in'}).to(s,{scream:0,duration:.5}).to({}, {duration:1.6})
        // 6: restored scene, dazed bear sitting in the hall
        .call(()=>{resetScene(true);Object.assign(s,{approach:.45,sit:1,dizzy:1,drunk:.6});stage('result','hall',6);}).to({}, {duration:4.8});
      return true;
    }catch(e){failed(e);return false;}
  }
  function finish(completed=false){
    timeline?.kill();timeline=null;shake?.cancel();shake=null;
    if(s.floor>=0){
      if(visual){scene.remove(visual.root);visual.resources.forEach(r=>r.dispose());visual=null;}
      if(bear){bear.root.parent?.remove(bear.root);bear.root.visible=false;}
      for(const [o,visible] of saved.hidden)o.visible=visible;
      hatchDoors[s.floor].manualActive=saved.manualActive;hatchDoors[s.floor].manualCoupled=saved.manualCoupled;
      carGrp.visible=saved.carVisible;Mascot.root.visible=saved.mascot;camera.near=saved.near;camera.updateProjectionMatrix();controls.minDistance=saved.minDistance;
      camera.position.copy(saved.eye);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.update();s.floor=-1;s.phase=completed?'done':'idle';
    }
    paused=false;document.body.classList.remove('retention-story');panel.hidden=!completed;badge.hidden=shoeLabel.hidden=retentionLabel.hidden=guideLabel.hidden=true;pauseButton.hidden=true;
    hicBubble.hidden=screamBubble.hidden=bangBurst.hidden=true;flashLayer.style.opacity='0';
    if(completed){title.textContent='문 이탈방지 시연 끝';caption.textContent='상부 비상가이드와 하부 보강슈는 추가 안전 여유입니다. 큰 충격에서의 이탈까지 보장하지 않습니다. 손상된 문은 사용을 중지하고 점검을 요청하세요.';chapter.textContent='정상 장면으로 복귀했습니다';progress.style.transform='scaleX(1)';}
  }
  function update(){if(s.floor>=0&&timeline){const stop=paused||estop;if(timeline.paused()!==stop)timeline.paused(stop);pauseButton.textContent=estop?'비상정지 중':paused?'계속 재생':'일시정지';}}
  function bind(){
    const style=document.createElement('style');style.textContent=`
      #retention-demo-panel{position:fixed;z-index:119;left:50%;bottom:20px;transform:translateX(-50%);width:560px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:16px 20px 12px;border:1px solid #deb75e99;border-radius:16px;background:#142331f5;color:#f2f5f8;box-shadow:0 8px 32px #0005;font:14px/1.55 sans-serif}
      #retention-demo-panel[hidden],#retention-demo-badge[hidden],.retention-part-label[hidden]{display:none}.retention-fx[hidden]{display:none!important}#retention-demo-panel strong{display:block;font-size:21px;line-height:1.35;color:#ffdda0;margin:5px 32px 5px 0}#retention-demo-panel p{margin:0 0 8px}#retention-demo-panel small{color:#bbc9d6;font-size:11px}#retention-demo-panel[data-danger=true]{border-color:#ff7968}#retention-demo-panel[data-danger=true] strong{color:#ffb3a0}
      .retention-part-label{position:fixed;z-index:118;transform:translateX(-50%);width:max-content;padding:6px 9px;border-radius:8px;background:#fff0c8;color:#453621;font:700 12px/1.4 sans-serif;pointer-events:none;box-shadow:0 2px 10px #0003}.retention-part-label::after{content:'↓';display:block;text-align:center}
      #retention-demo-exit{position:absolute;right:4px;top:4px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:white;font:26px sans-serif;cursor:pointer}#retention-demo-pause{min-height:36px;border:1px solid #ffffff40;border-radius:8px;background:#ffffff12;color:white;padding:4px 12px;cursor:pointer}#retention-demo-panel footer{display:flex;align-items:center;justify-content:space-between;gap:10px}#retention-demo-panel .retention-track{height:3px;background:#ffffff20;margin-top:10px;overflow:hidden;border-radius:3px}#retention-demo-progress{height:100%;background:#e8bf6b;transform:scaleX(0);transform-origin:left}
      #retention-demo-badge{position:fixed;z-index:118;top:20px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;padding:7px 12px;border-radius:9px;background:#142331e8;color:#ffe0a0;font:12px/1.4 sans-serif;text-align:center;pointer-events:none}
      .retention-fx{position:fixed;z-index:117;left:0;top:0;pointer-events:none;width:max-content;transform:translate(-50%,-50%)}
      .retention-bubble{padding:8px 14px;border-radius:18px;background:#fff;color:#2b2320;border:3px solid #2b2320;font:900 20px/1.2 sans-serif;box-shadow:0 4px 0 #2b232055}
      .retention-bubble::after{content:'';position:absolute;left:50%;bottom:-13px;margin-left:-8px;border:8px solid transparent;border-top-color:#2b2320}
      #retention-scream{background:#fff3f0;color:#c0281e;border-color:#c0281e;font-size:30px}#retention-scream::after{border-top-color:#c0281e}
      #retention-bang{width:190px;height:190px;display:grid;place-items:center;background:#ffd23f;clip-path:polygon(50% 0,61% 30%,95% 12%,74% 42%,100% 55%,70% 63%,84% 96%,54% 74%,30% 100%,32% 68%,0 72%,24% 48%,4% 20%,38% 30%);filter:drop-shadow(0 0 0 #c0281e)}
      #retention-bang b{font:950 50px/1 sans-serif;color:#fff;-webkit-text-stroke:3px #b3261e;text-shadow:0 4px 0 #b3261e;letter-spacing:-.04em}
      #retention-flash{position:fixed;inset:0;z-index:116;pointer-events:none;background:#fff;opacity:0}
      body.retention-story #hud,body.retention-story #walk-toggle,body.retention-story #part-menu,body.retention-story #part-tip{visibility:hidden}body.retention-story #retention-demo-panel{visibility:visible}
      @media(max-width:600px){#retention-demo-panel{bottom:12px;padding:12px 14px 10px;font-size:13px}#retention-demo-panel strong{font-size:18px}#retention-demo-badge{top:12px}#retention-demo-pause{min-height:44px}#retention-bang{width:140px;height:140px}#retention-bang b{font-size:38px}#retention-scream{font-size:24px}}
      #retention-demo-pause{flex-shrink:0;white-space:nowrap}#retention-demo-panel strong,#retention-demo-panel p{word-break:keep-all}
      @media(max-height:500px) and (min-width:600px){#retention-demo-panel{left:auto;right:12px;bottom:12px;transform:none;width:310px;padding:12px 14px;font-size:12px}#retention-demo-panel strong{font-size:17px}}
    `;document.head.appendChild(style);
    panel=document.createElement('section');panel.id='retention-demo-panel';panel.hidden=true;panel.setAttribute('aria-label','승장문 이탈방지(상부 비상가이드·하부 보강슈) 자동 시연');
    panel.innerHTML='<small id="retention-demo-chapter"></small><button id="retention-demo-exit" aria-label="시연 종료 및 정상 복귀">×</button><strong></strong><p role="status"></p><footer><small>교육 연출 · 강도 시험 / 충격 허용치 아님</small><button id="retention-demo-pause">일시정지</button></footer><div class="retention-track"><div id="retention-demo-progress"></div></div>';
    document.body.appendChild(panel);title=panel.querySelector('strong');caption=panel.querySelector('p');chapter=panel.querySelector('#retention-demo-chapter');progress=panel.querySelector('#retention-demo-progress');pauseButton=panel.querySelector('#retention-demo-pause');pauseButton.onclick=()=>{paused=!paused;update();};panel.querySelector('#retention-demo-exit').onclick=()=>finish();
    badge=document.createElement('div');badge.id='retention-demo-badge';badge.hidden=true;document.body.appendChild(badge);
    shoeLabel=document.createElement('div');retentionLabel=document.createElement('div');guideLabel=document.createElement('div');
    for(const label of [shoeLabel,retentionLabel,guideLabel]){label.className='retention-part-label';label.hidden=true;document.body.appendChild(label);}
    shoeLabel.textContent='1번 홈 · 일반 도어슈';retentionLabel.textContent='2번 홈 · 추가 보강슈';guideLabel.textContent='상부 비상가이드 · C레일 립을 붙잡음';
    const fx=(id,cls,html)=>{const e=document.createElement('div');e.id=id;e.className='retention-fx '+cls;e.hidden=true;e.innerHTML=html;e.setAttribute('aria-hidden','true');document.body.appendChild(e);return e;};
    hicBubble=fx('retention-hic','retention-bubble','딸꾹!');screamBubble=fx('retention-scream','retention-bubble','으악!');bangBurst=fx('retention-bang','','<b>쾅!</b>');
    flashLayer=document.createElement('div');flashLayer.id='retention-flash';document.body.appendChild(flashLayer);
    document.addEventListener('keydown',e=>{if(s.floor>=0){if(e.key==='Escape')finish();else if(e.target.closest?.('#retention-demo-panel'))return;else{e.preventDefault();e.stopImmediatePropagation();}}},true);
    for(const type of ['click','pointerdown','dblclick','change','wheel'])document.addEventListener(type,e=>{if(s.floor<0||e.target.closest?.('#retention-demo-panel,#btn-estop,#fault-reset'))return;if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
    // The main resize listener updates camera.aspect later in this event turn.
    window.addEventListener('resize',()=>requestAnimationFrame(()=>{if(s.floor>=0)aim(visual.view);}));
  }
  return {bind,start,update,cancel:()=>finish(),get active(){return s.floor>=0;},get state(){return s;}};
})();
