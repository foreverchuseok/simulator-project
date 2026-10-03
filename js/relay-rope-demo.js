/* One-click landing-rope story. Educational timing, not a fracture solver.
   Uses h.link geometry and InterlockDemo's exclusive command guard. */
const RelayRopeDemo=(()=>{
  const s={floor:-1,phase:'idle',branch:'opening',drive:0,follower:0,release:0,damage:0,broken:false,recoil:0,approach:0,alarm:0,view:'header'};
  const buttons=[],v=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),box=new THREE.Box3();
  let panel,title,caption,tag,otherTag,bubble,timeline,saved,visual,actor,actorHome,frontReach=0,hallZ=0,cutX=0,cutY=0,shake,wasStopped=false;
  const text={
    intro:['연동로프 파단','한쪽은 카문이 끌고, 반대쪽은 로프가 끕니다.'],
    bend:['같은 지점이 반복해서 굽혀집니다','색으로 표시한 부분을 따라가 보세요.'],
    wear:['반복 굽힘 · 마모 · 부식','소선이 손상되며 버틸 힘을 잃습니다.'],
    breakOpen:['툭! 연동로프 파단','열림을 전달하던 경로가 끊어졌습니다.'],
    reclose:['다음에 문이 열릴 때…','닫혀 있어도 로프가 정상인 것은 아닙니다.'],
    openFail:['카문은 열렸는데, 승장문 한쪽은 그대로','열린 줄 알고 다가가면…'],
    approach:['한쪽 문이 열리지 않았습니다','승강장 쪽에서 보면 이렇게 보입니다.'],
    impact:['쿵! 닫힌 문과 충돌','문이 충분히 열렸는지 확인해야 합니다.'],
    other:['반대쪽 전달 경로가 끊어지면?','이번에는 닫힘 동작을 봅니다.'],
    breakClose:['툭! 닫힘 전달 상실','로프의 다른 쪽이 끊어진 경우입니다.'],
    closeFail:['한쪽 문만 닫힙니다','걸림이 겹치면 폐문 스프링만으로 닫히지 않습니다.'],
    puzzled:['“왜 한쪽 문이 안 닫히지?”','반대 문 보조접점이 떨어져 출발이 차단됩니다.'],
    result:['작은 로프의 손상, 큰 출입 위험','반복 굽힘·부식 → 파단 → 한쪽 문 동작 상실.\n현재 모델은 보조접점으로 출발을 차단합니다.']
  };
  function reason(f){
    if(s.floor>=0)return '시연이 진행 중입니다.';
    if(ManualRescueDemo.active||ARDDemo.active||AscentDemo.active||BrakeDemo.active||BufferDemo.active||CharacterWalk.active||Mascot.inspecting)return '진행 중인 시연·체험을 먼저 종료하세요.';
    if(!InterlockDemo.allowed(f))return '카 정지·문 닫힘 후 점검과 비상정지를 복귀하세요.';
    return '';
  }
  function prepare(h){
    const k=h.link,root=k.seg.upL.parent,group=new THREE.Group();group.name='relayFailureOverlay';root.add(group);
    const mat=M.ss(0xc97b37),geo=new THREE.CylinderGeometry(.0018,.0018,1,7),pieces=[];
    for(let i=0;i<4;i++){const m=new THREE.Mesh(geo,mat);m.userData.noGlow=true;group.add(m);pieces.push(m);}
    const ringGeo=new THREE.TorusGeometry(.034,.0028,6,32),ringMat=M.emit(0xffc45a),ring=new THREE.Mesh(ringGeo,ringMat);ring.userData.noGlow=true;group.add(ring);
    const frayGeo=new THREE.BufferGeometry(),positions=new Float32Array(36);frayGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const frayMat=new THREE.LineBasicMaterial({color:0xe88c43}),fray=new THREE.LineSegments(frayGeo,frayMat);group.add(fray);
    // Educational cutaway overlay: the moving hanger plate can cover the break.
    for(const material of [mat,ringMat,frayMat]){material.depthTest=false;material.depthWrite=false;}
    group.children.forEach((mesh,i)=>{mesh.renderOrder=120+i;});
    const gapGeo=new THREE.PlaneGeometry(1,1),gapMat=new THREE.MeshBasicMaterial({color:0xffa438,transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}),gap=new THREE.Mesh(gapGeo,gapMat);gap.name='relayUnclosedGap';gap.visible=false;scene.add(gap);
    visual={root,group,pieces,ring,fray,positions,gap,resources:[geo,mat,ringGeo,ringMat,frayGeo,frayMat,gapGeo,gapMat],point:new THREE.Vector3(),a:new THREE.Vector3(),b:new THREE.Vector3(),c:new THREE.Vector3(),d:new THREE.Vector3(),e:new THREE.Vector3()};
    if(!actor){actor=Mascot.createWorker('RelayStoryPassenger');actor.root.scale.setScalar(1.45);actorHome=[];actor.root.traverse(o=>actorHome.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));}
    resetActor();actor.root.position.set(0,0,0);actor.root.rotation.set(0,Math.PI,0);actor.root.updateMatrixWorld(true);box.setFromObject(actor.root);frontReach=-box.min.z;
    v.set(0,0,h.right.userData.triKey.hallZ);h.right.localToWorld(v);hallZ=v.z;
  }
  function resetActor(){for(const p of actorHome){p.o.position.copy(p.p);p.o.quaternion.copy(p.q);p.o.scale.copy(p.s);}actor.root.visible=false;actor.rig.wrench.visible=false;}
  // Follow one material point by arc length, from lower span around the pulley
  // to upper span. This is not a marker fixed to the pulley or world space.
  function trackedPoint(out){
    const k=hatchDoors[s.floor].link,r=k.ropeR,q=Math.PI*r/2+CarDoor.dimensions().stroke*(s.drive-.4);
    if(s.branch==='opening'){
      if(q<0)out.set(k.pulLX-q,k.loY,k.loZ);
      else if(q>Math.PI*r)out.set(k.pulLX+q-Math.PI*r,k.upY,k.upZ);
      else{const a=-Math.PI/2-q/r;out.set(k.pulLX+Math.cos(a)*r,(k.upY+k.loY)/2+Math.sin(a)*r,k.ropeZ);}
    }else{
      if(q<0)out.set(k.pulRX+q,k.loY,k.loZ);
      else if(q>Math.PI*r)out.set(k.pulRX-q+Math.PI*r,k.upY,k.upZ);
      else{const a=-Math.PI/2+q/r;out.set(k.pulRX+Math.cos(a)*r,(k.upY+k.loY)/2+Math.sin(a)*r,k.ropeZ);}
    }
    return out;
  }
  function beam(mesh,a,b){delta.subVectors(b,a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(up,delta.normalize());}
  function rope(){
    const w=visual,h=hatchDoors[s.floor],k=h.link,closing=s.branch==='closing',p=trackedPoint(w.point);
    if(s.broken)p.set(cutX,cutY-.065*s.recoil,k.upZ);
    w.ring.position.copy(p);w.ring.position.z-=.009;w.ring.material.color.setHex(s.broken?0xff553c:0xffc45a);w.ring.material.emissive.copy(w.ring.material.color);w.ring.scale.setScalar(s.broken?1.25:1);w.fray.visible=s.damage>0;
    for(let i=0;i<6;i++){const j=i*6,side=i<3?-1:1,x=p.x+side*.024*s.recoil,y=p.y+(side<0?.012:-.012)*s.recoil;
      w.positions[j]=x;w.positions[j+1]=y;w.positions[j+2]=p.z;w.positions[j+3]=x-side*.016*s.damage;w.positions[j+4]=y+(.005+i%3*.007)*s.damage;w.positions[j+5]=p.z+(i%2?-.008:.008)*s.damage;}
    w.fray.geometry.attributes.position.needsUpdate=true;w.fray.geometry.computeBoundingSphere();for(const m of w.pieces)m.visible=s.broken;
    if(!s.broken)return;
    (closing?k.seg.upR:k.seg.upL).visible=false;const ax=h.right.position.x+k.aOff;
    w.a.set(closing?ax+k.aHalf:k.pulLX,k.upY,k.upZ);w.d.set(closing?k.pulRX:ax-k.aHalf,k.upY,k.upZ);
    w.b.set(p.x-.024*s.recoil,p.y+.012*s.recoil,p.z);w.c.set(p.x+.024*s.recoil,p.y-.012*s.recoil,p.z);
    w.e.copy(w.a).lerp(w.b,.8);beam(w.pieces[0],w.a,w.e);beam(w.pieces[1],w.e,w.b);w.e.copy(w.c).lerp(w.d,.2);beam(w.pieces[2],w.c,w.e);beam(w.pieces[3],w.e,w.d);
  }
  function poseActor(){
    if(!actor.root.visible)return;const p=actor.rig,closing=s.branch==='closing',z=hallZ+frontReach+.005+(1-s.approach)*.75;
    actor.root.position.set(closing?.30:hatchDoors[s.floor].left.userData.cx,FLOOR_Y[s.floor],z);actor.root.rotation.set(0,Math.PI-s.alarm*(closing?2.2:1.7),0);
    const walk=Math.sin(s.approach*16)*Math.sin(Math.PI*s.approach),alarm=s.alarm;
    p.feet.forEach((f,i)=>{f.position.z=(i?1:-1)*walk*.045;f.position.y=Math.max(0,(i?1:-1)*walk)*.025;});p.body.rotation.x=-alarm*.12;p.head.rotation.set(-alarm*.12,closing?Math.sin(alarm*8)*.45:alarm*.35,0);
    p.waveArm.rotation.set(-alarm*.55,0,-.2-alarm*1.15);p.holdArm.rotation.set(-alarm*.55,0,.2+alarm*1.15);p.eyes.forEach(e=>e.scale.y=.032*(1+alarm*.45));
  }
  function pose(){
    if(s.floor<0||!visual)return;const h=hatchDoors[s.floor],q=CarDoor.state,stroke=q.d.stroke;
    q.release=s.release;q.coupledFloor=s.floor;carDoorR.position.x=q.d.cx+stroke*s.drive;CarDoor.pose();
    h.right.position.x=h.right.userData.cx+stroke*s.drive;h.left.position.x=h.left.userData.cx-stroke*s.follower;h.hook.rotation.z=-h.latch.liftRad*s.release;h.manualOpen=Math.max(s.drive,s.follower);
    spinDoorDrive(h);HallInterlock.update(h);rope();poseActor();
    visual.gap.visible=s.view==='hall'&&s.branch==='closing'&&s.drive<.1;
    visual.gap.position.set(-stroke*s.follower/2,FLOOR_Y[s.floor]+S.DOOR_H/2,hallZ+.009);visual.gap.scale.set(stroke*s.follower,S.DOOR_H-.06,1);
  }
  function setCar(y){const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;spinSheaves(dy);refreshRopes();refreshGovernorRope();const l=scene.getObjectByName('carLight');if(l)l.position.y=y+S.CAR_H*.75;}
  function shot(view){
    s.view=view;const h=hatchDoors[s.floor],k=h.link,portrait=camera.aspect<.8,aspect=camera.aspect;
    // Cutaway while inspecting the landing header; show the actual car again
    // for the hall-side door scenes. Restore the user's visibility on exit.
    carGrp.visible=view==='hall';
    if(view==='pulley'){v.set(s.branch==='closing'?k.pulRX-.09:k.pulLX+.09,(k.upY+k.loY)/2,k.ropeZ);visual.root.localToWorld(v);camera.position.set(v.x,v.y+.08,v.z-(portrait?1.05:.75));}
    else if(view==='hall'){v.set(0,FLOOR_Y[s.floor]+1.02,hallZ);const dist=Math.max(3.05,(S.DOOR_W+.6)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*aspect));camera.position.set(v.x+.25,v.y+.1,hallZ+dist);}
    else{v.set(0,k.upY-.07,k.upZ);visual.root.localToWorld(v);const dist=Math.max(2.9,(k.pulRX-k.pulLX+.25)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*aspect));camera.position.set(v.x,v.y+.3,v.z-dist);}
    controls.target.copy(v);controls.update();
  }
  function stage(p,view){s.phase=p;[title.textContent,caption.textContent]=text[p];if(view)shot(view);bubble.hidden=!['impact','puzzled'].includes(p);bubble.textContent=p==='impact'?'앗!':'어?';pose();}
  function impact(){if(!matchMedia('(prefers-reduced-motion: reduce)').matches)shake=renderer.domElement.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:180});MACH.bump();}
  function snap(){trackedPoint(visual.point);cutX=visual.point.x;cutY=visual.point.y;s.broken=true;MACH.overspeedImpact('break',.25);impact();}
  function fail(error){console.error('[RelayRopeDemo]',error);finish();panel.hidden=false;title.textContent='시연 중단';caption.textContent='화면을 복구했습니다. 새로고침 후 다시 실행하세요.';}
  function safePose(){try{pose();}catch(e){fail(e);}}
  function start(f){
    const why=reason(f);if(why){if(s.floor<0){panel.hidden=false;title.textContent='연동로프 시연';caption.textContent=why;}return false;}
    const h=hatchDoors[f],q=CarDoor.state;clearTimeout(autoTimer);closeAllMenus();leaveCabinView();PartGlow.closeMenu();
    saved={eye:camera.position.clone(),target:controls.target.clone(),enabled:controls.enabled,carY:carGrp.position.y,cwtY:cwtGrp.position.y,carVisible:carGrp.visible,curFloor,carX:carDoorR.position.x,release:q.release,coupledFloor:q.coupledFloor,mascot:Mascot.root.visible};
    Object.assign(s,{floor:f,phase:'intro',branch:'opening',drive:0,follower:0,release:0,damage:0,broken:false,recoil:0,approach:0,alarm:0});wasStopped=false;
    try{
      gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);gsap.killTweensOf(h.hook.rotation);h.manualActive=h.manualCoupled=true;curFloor=f;setCar(FLOOR_Y[f]+S.CAR_H/2);syncAllIndicators(f+1,'');controls.enabled=false;
      prepare(h);Mascot.root.visible=false;panel.hidden=false;document.body.classList.add('relay-story');tag.hidden=false;stage('intro','header');
      timeline=gsap.timeline({onUpdate:safePose,onComplete:()=>finish(true)});
      timeline.to({}, {duration:1.5}).call(()=>stage('bend','pulley')).to(s,{release:1,duration:.25})
        .to(s,{drive:.8,follower:.8,duration:1.25,ease:'none'}).to(s,{drive:0,follower:0,duration:1.25,ease:'none'})
        .call(()=>stage('wear')).to(s,{drive:.8,follower:.8,damage:.65,duration:1.25,ease:'none'}).to(s,{drive:0,follower:0,damage:.85,duration:1.25,ease:'none'}).to(s,{drive:.8,follower:.8,damage:1,duration:1.25,ease:'none'})
        .call(()=>{snap();stage('breakOpen');}).to(s,{recoil:1,duration:.24,ease:'elastic.out(1,.3)'}).to({}, {duration:.85})
        .call(()=>stage('reclose','hall')).to(s,{drive:0,follower:0,release:0,duration:.8})
        .call(()=>{actor.root.visible=true;stage('openFail');}).to(s,{release:1,duration:.25}).to(s,{drive:1,duration:1.3,ease:'power2.inOut'})
        .call(()=>stage('approach')).to(s,{approach:1,duration:1.0,ease:'power1.in'})
        .call(()=>{impact();stage('impact');}).to(s,{alarm:1,approach:.75,duration:.3}).to({}, {duration:1.3})
        .call(()=>{actor.root.visible=false;s.broken=false;s.recoil=0;s.damage=0;s.branch='closing';s.drive=s.follower=.8;s.release=1;s.approach=s.alarm=0;stage('other','pulley');})
        .to(s,{damage:1,duration:1}).call(()=>{snap();stage('breakClose');}).to(s,{recoil:1,duration:.24,ease:'elastic.out(1,.3)'}).to({}, {duration:.65})
        .call(()=>{actor.root.visible=true;stage('closeFail','hall');}).to(s,{drive:0,duration:1.5,ease:'power2.inOut'}).to(s,{release:0,duration:.25})
        .call(()=>stage('puzzled')).to(s,{alarm:1,duration:1.6}).to({}, {duration:.6})
        .call(()=>stage('result')).to({}, {duration:2.5});
      return true;
    }catch(e){fail(e);return false;}
  }
  function finish(completed=false){
    timeline?.kill();timeline=null;shake?.cancel();shake=null;
    if(s.floor>=0){const h=hatchDoors[s.floor],q=CarDoor.state;
      h.right.position.x=h.right.userData.cx;h.left.position.x=h.left.userData.cx;h.hook.rotation.z=0;h.manualActive=h.manualCoupled=false;h.manualOpen=0;
      if(visual){visual.group.parent.remove(visual.group);scene.remove(visual.gap);visual.resources.forEach(r=>r.dispose());visual=null;}
      if(actor)resetActor();q.release=saved.release;q.coupledFloor=saved.coupledFloor;carDoorR.position.x=saved.carX;CarDoor.pose();spinDoorDrive(h);HallInterlock.update(h);
      setCar(saved.carY);carGrp.visible=saved.carVisible;cwtGrp.position.y=saved.cwtY;refreshRopes();curFloor=saved.curFloor;syncAllIndicators(curFloor+1,'');Mascot.root.visible=saved.mascot;
      camera.position.copy(saved.eye);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.update();s.floor=-1;s.phase=completed?'done':'idle';}
    document.body.classList.remove('relay-story');tag.hidden=otherTag.hidden=bubble.hidden=true;panel.hidden=!completed;
    if(completed){title.textContent='연동로프 파단 시연 끝';caption.textContent='한쪽 문이 열리지 않거나 닫히지 않을 수 있습니다.\n문 동작 이상을 발견하면 사용을 멈추고 점검을 요청하세요.';}
  }
  function update(){
    if(s.floor>=0){
      if(wasStopped!==estop){wasStopped=estop;estop?timeline?.pause():timeline?.resume();caption.textContent=estop?'비상정지 · 해제하면 시연이 이어집니다.':text[s.phase][1];}
      if(s.view==='pulley'){v.copy(visual.ring.position);visual.root.localToWorld(v);tag.textContent=s.broken?'파단부 · 투시 표시':'같은 로프 지점 · 투시';}
      else if(s.view==='header'){v.set(hatchDoors[s.floor].right.position.x,hatchDoors[s.floor].link.upY+.08,hatchDoors[s.floor].link.upZ);visual.root.localToWorld(v);tag.textContent='인터록 · 구동문';}
      else{v.set(0,FLOOR_Y[s.floor]+S.DOOR_H+.12,hallZ);tag.textContent=s.branch==='closing'?'앞 승장문 열림 · 뒤 카문 닫힘':'승강장 시점 · 카 도착';}
      v.project(camera);tag.style.left=`${Math.max(70,Math.min(innerWidth-70,(v.x+1)*innerWidth/2))}px`;tag.style.top=`${Math.max(95,Math.min(innerHeight-170,(1-v.y)*innerHeight/2-40))}px`;
      otherTag.hidden=s.view!=='header';if(!otherTag.hidden){v.set(hatchDoors[s.floor].left.position.x,hatchDoors[s.floor].link.loY-.12,hatchDoors[s.floor].link.loZ);visual.root.localToWorld(v);v.project(camera);otherTag.style.left=`${Math.max(85,Math.min(innerWidth-85,(v.x+1)*innerWidth/2))}px`;otherTag.style.top=`${(1-v.y)*innerHeight/2+12}px`;}
      if(!bubble.hidden){v.copy(actor.root.position);v.y+=1.42;v.project(camera);bubble.style.left=`${(v.x+1)*innerWidth/2}px`;bubble.style.top=`${(1-v.y)*innerHeight/2}px`;}
    }
    for(let f=0;f<buttons.length;f++){const b=buttons[f],h=hatchDoors[f],k=h.link;v.set(k.pulLX+.15,k.upY,k.upZ);k.seg.upL.parent.localToWorld(v);
      let shown=s.floor<0&&camera.position.distanceToSquared(v)<36;for(let o=k.seg.upL.parent;o;o=o.parent)shown&&=o.visible;v.project(camera);shown&&=v.z>-1&&v.z<1&&Math.abs(v.x)<.95&&Math.abs(v.y)<.9;b.hidden=!shown;if(shown)PartActions.positionButton(b,(v.x+1)*innerWidth/2-22,(1-v.y)*innerHeight/2-22);}
  }
  function bind(){
    const style=document.createElement('style');style.textContent=`
      #relay-demo-panel{position:fixed;z-index:116;left:50%;bottom:100px;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px 48px 14px 18px;border:1px solid #e9b65388;border-radius:14px;background:#142330f2;color:#fff;font:14px/1.5 sans-serif;box-shadow:0 6px 22px #0005;pointer-events:none}
      #relay-demo-panel[hidden],#relay-story-tag[hidden],#relay-story-other[hidden],#relay-story-bubble[hidden]{display:none}#relay-demo-panel strong{font-size:20px;color:#ffe2a3}#relay-demo-panel p{white-space:pre-line;margin:4px 0 0}#relay-demo-exit{position:absolute;right:3px;top:3px;min-width:44px;min-height:44px;color:white;background:transparent;border:0;font-size:24px;cursor:pointer;pointer-events:auto}
      #relay-story-tag,#relay-story-bubble{position:fixed;z-index:114;transform:translateX(-50%);pointer-events:none;border-radius:9px;background:#fff0cd;color:#422411;padding:5px 9px;font:700 13px/1.3 sans-serif;text-align:center;box-shadow:0 2px 10px #0004;max-width:calc(100vw - 20px)}#relay-story-bubble{background:white;color:#942a1a;font-size:25px;border-radius:50%;padding:10px 15px}
      body.relay-story #hud,body.relay-story #walk-toggle,body.relay-story #part-menu,body.relay-story #part-tip{visibility:hidden}body.relay-story #relay-demo-panel{bottom:20px}
      #relay-story-other{position:fixed;z-index:114;transform:translateX(-50%);pointer-events:none;border-radius:9px;background:#c2eef8;color:#163e4c;padding:5px 9px;font:700 13px/1.3 sans-serif;max-width:170px;text-align:center}
      @media(max-width:600px){#relay-demo-panel{font-size:13px;bottom:80px;width:calc(100vw - 20px);padding:12px 40px 12px 12px}#relay-demo-panel strong{font-size:18px}#relay-story-tag{font-size:12px}}
    `;document.head.appendChild(style);
    panel=document.createElement('section');panel.id='relay-demo-panel';panel.hidden=true;panel.setAttribute('aria-label','연동로프 파단 자동 시연');panel.innerHTML='<strong></strong><button type="button" id="relay-demo-exit" aria-label="시연 종료 및 복귀">×</button><p role="status"></p>';document.body.appendChild(panel);title=panel.querySelector('strong');caption=panel.querySelector('p');panel.querySelector('button').onclick=()=>finish();
    tag=document.createElement('div');tag.id='relay-story-tag';tag.hidden=true;document.body.appendChild(tag);otherTag=document.createElement('div');otherTag.id='relay-story-other';otherTag.hidden=true;otherTag.textContent='로프에 이끌리는 반대 문';document.body.appendChild(otherTag);bubble=document.createElement('div');bubble.id='relay-story-bubble';bubble.hidden=true;document.body.appendChild(bubble);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)finish();});window.addEventListener('resize',()=>{if(s.floor>=0)shot(s.view);});
    for(const type of ['click','pointerdown','change','dblclick'])document.addEventListener(type,e=>{if(s.floor<0||e.target.closest?.('#relay-demo-exit,#btn-estop,#fault-reset,#demo-pause')||(DemoPause.paused&&e.target.closest?.('canvas')))return;if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}},true);
    for(let f=0;f<FLOORS;f++){const b=document.createElement('button');b.type='button';b.id=`relay-rope-action-${f}`;b.className='part-action';b.hidden=true;b.textContent='↔';b.setAttribute('aria-label',`${f+1}층 연동로프 파단 시연`);b.onclick=()=>start(f);document.getElementById('part-actions').appendChild(b);buttons.push(b);PartGlow.bind(b,()=>hatchDoors[f]?.link?.seg.upL.parent,`${f+1}층 연동로프`,null,{direct:true});}
  }
  return {bind,update,start,cancel:()=>finish(),get active(){return s.floor>=0;},get state(){return s;}};
})();
