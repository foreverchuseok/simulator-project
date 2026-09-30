// 상승과속 전용. GLB의 원본 피벗/기구 수치와 UCM 턱 접촉 행정을 공유한다.
// 속도·가속·짧은 제동거리는 교육 연출값이며 인증/하중 해석값이 아니다.
const AscentDemo = (() => {
  const motion = { accel: 2.8, tripRatio: 1.3, brakeSlip: .085, ascentSeconds:5.5/1.3 };
  const state = { active:false, stage:'rest', mode:'normal', v:0, rise:0, view:'car' };
  let button, panel, play, caption, inset, insetCamera, saved, jobs=[], fractures=[];
  let dust,ring,shake,bearMouth;
  const bearBox=new THREE.Box3();
  const v=new THREE.Vector3(), viewport=new THREE.Vector4(), scissor=new THREE.Vector4();
  const own=t=>{jobs.push(t);return t;};
  const later=(s,fn)=>own(gsap.delayedCall(s,()=>{if(state.active&&state.stage!=='resetting')fn();}));
  const tr=()=>mrGrp.userData.traction;
  const passenger=()=>Mascot.root;
  function poseBear(){
    const p=Mascot.rig,floor=carGrp.position.y-S.CAR_H/2;
    passenger().position.set(0,floor+state.standOffset+state.lift,CAR_CTR_Z);
    passenger().rotation.set(0,1.15,state.roll||0);
    const alarm=state.alarm||0,w=Math.sin(performance.now()*.021)*alarm;
    p.body.position.y=state.crouch||0;p.body.rotation.set(0,0,w*.045);
    p.head.rotation.set(-.1*alarm,Math.sin(performance.now()*.008)*.12*alarm,w*.09);
    p.waveArm.rotation.set(-.5*alarm,0,-.3-2.1*alarm-w*.15);
    p.holdArm.rotation.set(-.5*alarm,0,.3+2.1*alarm-w*.15);
    p.eyes.forEach(e=>e.scale.y=state.injured ? .007 : .032*(1+.35*alarm));
    bearMouth.rotation.z=alarm||state.injured?0:Math.PI;bearMouth.scale.set(1+alarm,.9+alarm*1.7,1);
    passenger().updateMatrixWorld(true);bearBox.setFromObject(passenger());
    // 넘어지는 전신과 안전모가 카 바닥/천장을 관통하지 않게 실제 경계로 보정한다.
    passenger().position.y+=Math.max(0,floor+.007-bearBox.min.y);
    if(bearBox.max.y>floor+S.CAR_H-.045)passenger().position.y-=bearBox.max.y-(floor+S.CAR_H-.045);
  }
  function shock(power=1){
    shake?.cancel();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    shake=renderer.domElement.animate(Array.from({length:15},(_,i)=>({transform:`translate(${Math.sin(i*2.7)*power*16*(1-i/14)}px,${Math.cos(i*3.4)*power*11*(1-i/14)}px)`})),{duration:power>1?820:440,easing:'ease-out'});
  }
  function burst(origin,size){
    if(!dust){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
      const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffffbb');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*3),3));
      dust=new THREE.Points(geo,new THREE.PointsMaterial({map:new THREE.CanvasTexture(canvas),size:.16,color:0xb7ad97,transparent:true,opacity:0,depthWrite:false}));dust.frustumCulled=false;dust.name='AscentImpactDust';scene.add(dust);
      ring=new THREE.Mesh(new THREE.RingGeometry(.11,.15,48),new THREE.MeshBasicMaterial({color:0xffecc1,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;scene.add(ring);
    }
    dust.position.copy(origin);dust.visible=true;ring.position.copy(origin);ring.visible=true;
    const q={t:0};own(gsap.to(q,{t:1,duration:2.1,ease:'none',onUpdate:()=>{
      const a=dust.geometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i*2.4,r=(.1+q.t*(.25+(i%9)/9))*size;a.setXYZ(i,Math.cos(angle)*r,q.t*size*(.12+(i%7)/8),Math.sin(angle)*r);}
      a.needsUpdate=true;dust.material.opacity=.7*(1-q.t);dust.material.size=size*(.13+q.t*.18);ring.scale.setScalar(size*(1+q.t*9));ring.material.opacity=.65*(1-q.t);
    },onComplete:()=>{dust.visible=ring.visible=false;}}));
  }
  const say=text=>{caption.hidden=!text;caption.textContent=text;updateStatus('v-dir',text,'#f0883e');};
  function build(){
    const style=document.createElement('style');style.textContent=`
      #ascent-panel{position:fixed;z-index:112;width:238px;max-width:calc(100vw - 16px);padding:12px;box-sizing:border-box;border-radius:14px;color:var(--ui-text);font:13px var(--ui-font)}
      #ascent-panel[hidden],#ascent-stage[hidden],#ascent-inset[hidden]{display:none}
      #ascent-panel .ascent-options{display:flex;gap:6px;margin:10px 0}#ascent-panel button{min-height:44px;cursor:pointer;color:inherit;background:#253b49;border:1px solid #667e8c;border-radius:8px;padding:6px 10px}
      #ascent-panel [aria-pressed=true]{background:#367b66;border-color:#8adcc1}#btn-ascent{width:100%}
      #ascent-stage{position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);box-sizing:border-box;padding:10px 16px;border:1px solid #879d9d;border-radius:10px;background:#122633ef;color:#f4f8fa;font:700 14px/1.5 sans-serif;text-align:center;z-index:36;pointer-events:none;white-space:pre-line}
      #ascent-inset{position:fixed;right:16px;top:100px;width:260px;height:210px;border:2px solid #8cd3dd;border-radius:8px;pointer-events:none;z-index:32;box-sizing:border-box}
      #ascent-inset span{position:absolute;left:0;right:0;bottom:0;padding:5px;background:#11242de8;color:white;text-align:center;font:700 12px sans-serif}
      #rope-brake-action::after,#ascent-action::after{position:absolute;top:46px;left:50%;transform:translateX(-50%);font:700 10px sans-serif;white-space:nowrap;color:white;text-shadow:0 1px 3px #000;background:#172b36d9;padding:3px 5px;border-radius:5px;content:'개문출발'}
      #ascent-action::after{content:'상승과속'}
      @media(max-width:600px){#ascent-stage{font-size:12px}#ascent-inset{width:158px;height:140px;top:145px;right:10px}}
    `;document.head.appendChild(style);
    button=document.createElement('button');button.id='ascent-action';button.className='part-action brake-icon';button.hidden=true;
    button.title='로프브레이크 · 상승과속';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','ascent-panel');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v18m4-18v18M6 7H3v10h3m10-10h3v10h-3M3 12h4m8 0h4M20 6V2m-2 2 2-2 2 2"/></svg>';
    button.style.setProperty('--part-icon',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    document.getElementById('part-actions').appendChild(button);
    PartGlow.bind(button,()=>PartActions.ropeBrakeNode(),'로프브레이크',()=>'상승과속 시연 설정');
    panel=document.createElement('section');panel.id='ascent-panel';panel.className='glass';panel.hidden=true;panel.setAttribute('aria-label','상승과속 시연 설정');
    panel.innerHTML='<div class="part-panel-head"><strong>상승과속 · 로프브레이크</strong><button id="ascent-dismiss" aria-label="접기">×</button></div><div class="ascent-options"><button data-ascent-mode="normal" aria-pressed="true">정상 작동</button><button data-ascent-mode="none" aria-pressed="false">미설치</button></div><button id="btn-ascent">상승과속 시연</button>';
    document.getElementById('part-actions').appendChild(panel);play=panel.querySelector('#btn-ascent');
    panel.querySelector('#ascent-dismiss').onclick=close;
    panel.querySelectorAll('[data-ascent-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.ascentMode;panel.querySelectorAll('[data-ascent-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});
    button.onclick=()=>{if(state.active){reset();return;}const open=panel.hidden;closeAllMenus();panel.hidden=!open;button.setAttribute('aria-expanded',String(open));};
    play.onclick=()=>state.active?reset():start(state.mode);
    document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==button)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();if(state.active)reset();}});
    // 기존 점검·속도·문 명령이 시연 중 상태를 덮어쓰지 않도록 한다. 종료와 STOP은 항상 유효하다.
    for(const type of ['click','pointerdown','change','keydown','dblclick'])document.addEventListener(type,e=>{
      if(!state.active||e.target.closest?.('#ucm-exit,#btn-estop,#fault-reset,#btn-ascent'))return;
      if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    caption=document.createElement('div');caption.id='ascent-stage';caption.hidden=true;caption.setAttribute('role','status');document.body.appendChild(caption);
    inset=document.createElement('div');inset.id='ascent-inset';inset.hidden=true;inset.innerHTML='<span>조속기 · 상향 타격</span>';document.body.appendChild(inset);
    insetCamera=new THREE.PerspectiveCamera(42,1,.002,100);
  }
  function close(){if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
  function update(){
    if(!button)return;
    if(state.active&&state.stage!=='resetting')poseBear();
    const anchor=document.getElementById('rope-brake-action');
    button.hidden=anchor.hidden||!PartActions.iconsVisible||state.active;
    if(!button.hidden){
      let x=parseFloat(anchor.style.left),y=parseFloat(anchor.style.top);
      x=Math.min(x,innerWidth-112);
      const governor=document.getElementById('btn-overspeed'),gx=parseFloat(governor.style.left),gy=parseFloat(governor.style.top);
      // 두 로프브레이크 아이콘과 이름표가 조속기 터치 영역을 덮지 않게 한 줄을 함께 옮긴다.
      if(!governor.hidden&&x<gx+48&&x+100>gx-4&&y<gy+68&&y+68>gy-4)y=gy+72<innerHeight-76?gy+72:gy-76;
      PartActions.positionButton(anchor,x,y);
      PartActions.positionButton(button,x+56,y);
    }
    if(!panel.hidden){panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,parseFloat(button.style.left)-130))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,parseFloat(button.style.top)+76))+'px';}
  }
  function renderInset(){
    if(inset.hidden)return;
    const r=inset.getBoundingClientRect();insetCamera.aspect=r.width/r.height;insetCamera.updateProjectionMatrix();
    renderer.getViewport(viewport);renderer.getScissor(scissor);const test=renderer.getScissorTest();
    renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissorTest(true);renderer.clearDepth();renderer.render(scene,insetCamera);
    renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);
  }
  function shot(kind,duration=.4){
    state.view=kind;gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    let c,t;const portrait=Math.max(1,.85/camera.aspect);
    if(kind==='gear'){
      t=tr().worm.getWorldPosition(new THREE.Vector3());c=t.clone().add(new THREE.Vector3(-1.05,.65,.72).multiplyScalar(portrait));
    }else if(kind==='drive'){
      t=mainSheaveGrp.getWorldPosition(new THREE.Vector3());c=t.clone().add(new THREE.Vector3(1.45,.6,.9).multiplyScalar(portrait));
    }else if(kind==='brake'){
      const body=scene.getObjectByName('RopeBrake');t=body.localToWorld(new THREE.Vector3(.01,-.01,0));c=body.localToWorld(new THREE.Vector3(.54,.14,-.7));c.sub(t).multiplyScalar(portrait).add(t);
    }else if(kind==='governor'){
      t=_govWorld();c=t.clone().add(new THREE.Vector3(.70,.15,.35).multiplyScalar(portrait));
      insetCamera.position.copy(t).add(new THREE.Vector3(.85,.14,.40));insetCamera.lookAt(t);
    }else if(kind==='pit'){
      t=new THREE.Vector3(0,bufferGrp.userData.cwt.topY+1.05,CWT_CENTER_Z);c=t.clone().add(new THREE.Vector3(3.5*portrait,1.3,-1.7));
    }else if(kind==='passenger'){
      t=new THREE.Vector3(0,carGrp.position.y,CAR_CTR_Z);c=t.clone().add(new THREE.Vector3(3.0*Math.max(1,.62/camera.aspect),.35,1.5));
    }else{
      // 승장 외벽 앞에서는 닫힌 승장문이 승객을 가린다. 승강로 측면에서 카와 승객을 함께 본다.
      t=new THREE.Vector3(0,carGrp.position.y-.45,CAR_CTR_Z);c=t.clone().add(new THREE.Vector3(3.6*portrait,.65*portrait,1.5));
    }
    _camTo(c.x,c.y,c.z,t.x,t.y,t.z,duration);
  }
  function setCar(y){
    const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;spinSheaves(dy);refreshRopes();refreshGovernorRope();
    if(state.view==='car'){camera.position.y+=dy;controls.target.y+=dy;}
    const light=scene.getObjectByName('carLight');if(light)light.position.y=y+S.CAR_H*.75;
    state.rise=y-state.baseY;if(state.stage!=='resetting')poseBear();
    updateStatus('v-spd',Math.round(state.v*60)+' m/min','#f85149');
    let f=0;FLOOR_Y.forEach((fy,i)=>{if(y-S.CAR_H/2>=fy-.02)f=i;});syncAllIndicators(f+1,state.v?'↑':'');
  }
  // GLB는 그대로 두고 파손 구간의 삼각형만 분리한다. 드럼/모터는 원래 형상과 위치를 유지한다.
  function buildFractures(){
    if(fractures.length)return;
    const root=tr().worm.parent,inv=new THREE.Matrix4();scene.updateMatrixWorld(true);inv.copy(root.matrixWorld).invert();
    const center=new THREE.Vector3(),matrix=new THREE.Matrix4();
    for(const node of [scene.getObjectByName('WormRotor'),scene.getObjectByName('SheaveRotor')])node.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const source=mesh.geometry,idx=source.index,a=source.attributes.position,buckets=Array.from({length:9},()=>[]),mats=Array.from({length:9},()=>[]);
      matrix.multiplyMatrices(inv,mesh.matrixWorld);
      const count=idx?idx.count:a.count;
      for(let i=0;i<count;i+=3){
        const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);center.set(0,0,0);ids.forEach(k=>center.add(v.fromBufferAttribute(a,k)));center.multiplyScalar(1/3).applyMatrix4(matrix);
        const worm=node.name==='WormRotor',r=Math.hypot(center.y,center.z);
        const broken=worm?Math.abs(center.z)<.13&&Math.abs(center.y-TRACTION_MACHINE_MOUNT.wormY)<.085:
          (Math.abs(center.x-TRACTION_MACHINE_MOUNT.wheelX)<.065&&r>.055&&r<.24)||(center.x>-.23&&center.x<-.12&&r<.06);
        const slot=broken?1+Math.min(7,Math.floor(((Math.atan2(center.y,center.z)+Math.PI)/(2*Math.PI))*8)):0;
        const mat=source.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0;
        buckets[slot].push(...ids);mats[slot].push(mat);
      }
      if(!buckets.slice(1).some(b=>b.length))return;
      const subset=k=>{const g=new THREE.BufferGeometry();Object.entries(source.attributes).forEach(([n,a])=>g.setAttribute(n,a));g.setIndex(buckets[k]);let prev=-1;for(let i=0;i<mats[k].length;i++){const m=mats[k][i];if(m!==prev){g.addGroup(i*3,3,m);prev=m;}else g.groups[g.groups.length-1].count+=3;}g.computeBoundingSphere();return g;};
      const pieces=[];
      for(let k=1;k<9;k++)if(buckets[k].length){const p=new THREE.Mesh(subset(k),mesh.material);p.position.copy(mesh.position);p.quaternion.copy(mesh.quaternion);p.scale.copy(mesh.scale);p.visible=false;p.name='AscentGearFragment';mesh.parent.add(p);pieces.push({mesh:p,home:p.position.clone(),rot:p.quaternion.clone(),k});}
      fractures.push({mesh,source,broken:subset(0),pieces});
    });
  }
  function breakDrive(){
    state.stage='failure';tr().driveBroken=true;setTractionBrake(false,true);
    fractures.forEach(f=>{f.mesh.geometry=f.broken;f.pieces.forEach(({mesh:p,home,k})=>{p.visible=true;own(gsap.to(p.position,{x:home.x-.26-.035*k,y:home.y+.16-.035*k,z:home.z+Math.sin(k*2)*.25,duration:.85,ease:'power3.out'}));own(gsap.to(p.rotation,{x:p.rotation.x+k*.3,z:p.rotation.z+k*.4,duration:.85}));});});
    MACH.overspeedImpact('break');UCMEffects.hit('failure','웜기어 구동부 파손','');shock();burst(tr().worm.getWorldPosition(new THREE.Vector3()),.38);say('웜기어 구동부 파손');
    later(2.4,()=>{shot('drive',.7);later(.75,()=>{
      MACH.overspeedImpact('grip');shock(.65);say('구동축 충격');
      for(const [o,home] of [[mainSheaveGrp,saved.mainP],[deflectorSheaveGrp,saved.defP],[cwtGrp,saved.cwtP]]){
        const q={t:0};own(gsap.to(q,{t:1,duration:1.3,onUpdate:()=>{o.position.x=home.x+Math.sin(q.t*45)*.028*(1-q.t);},onComplete:()=>o.position.x=home.x}));
      }
    });});
    later(5.3,()=>{shot('car',.65);later(.8,()=>{state.stage='runaway';state.runStart=performance.now();state.alarm=1;say('▲ 급상승');MACH.overspeedImpact('fall');shock(.45);gsap.ticker.add(tick);});});
  }
  function openPendulum(p){const g=govHandles();g.pendulums.forEach((o,i)=>o.rotation.z=g.geom.pendRot0[i]+p);g.setLinkage(p);}
  function tick(time,delta){
    if(!state.active||!['runaway','unprotected'].includes(state.stage))return;
    // 3~4층 추적 장면을 종전보다 1.3배 빠르게 재생한다. 검출속도와 이동 경로는 유지한다.
    let dt=Math.min((delta||16.7)/1000,.05),a=state.stage==='runaway'?state.runAccel:motion.accel;
    if(state.stage==='runaway')dt*=state.runTimeScale;
    if(state.stage==='runaway')dt=Math.min(dt,(state.tripSpeed-state.v)/a);
    const next=carGrp.position.y+state.v*dt+.5*a*dt*dt;state.v+=a*dt;
    if(state.stage==='unprotected'&&next>=state.contactY){setCar(state.contactY);impact();return;}
    setCar(next);
    if(state.stage==='runaway'){
      openPendulum(govHandles().pose.trip.pendulum*.7*Math.max(0,(state.v/state.rated-.9)/.4));
      if(state.v>=state.tripSpeed-1e-8){state.v=state.tripSpeed;state.detectedSpeed=state.v;state.detectedY=carGrp.position.y;state.stage='detected';gsap.ticker.remove(tick);trip();}
    }else if(state.contactY-next<2.7&&!state.pitShot){state.pitShot=true;shot('pit',.45);say('로프브레이크 없음 · 상승 지속');}
  }
  function trip(){
    governorPhase='tripping';govSpinDir=-1;shot('governor',.65);say('조속기 · 슬로모션');
    const g=govHandles(),p={open:g.pendulums[0].rotation.z-g.geom.pendRot0[0]};
    own(gsap.to(p,{open:g.pose.trip.pendulum,duration:.9,onUpdate:()=>openPendulum(p.open)}));
    later(1.2,()=>{
        // 같은 strikePoint/switchTip의 접촉 위상을 역방향으로 통과한다. 로프/휠은 카 이동량과 일치한다.
        const w=g.wheel.rotation.z,tau=2*Math.PI,phase=g.mechanism.switchHitPhase;
        const hit=phase+Math.floor((w-.12-phase)/tau)*tau;
        const q={y:carGrp.position.y},end=q.y+(w-hit)*mrGrp.userData.govR;
        own(gsap.to(q,{y:end,duration:2.4,ease:'power1.out',onUpdate:()=>setCar(q.y),onComplete:()=>{
          state.stage='switch';state.switchY=carGrp.position.y;state.switchSpeed=state.v;
          g.switchLever.userData.contactClosed=false;governorPhase='tripped';g.ropeLocked=false;
          own(gsap.to(g.switchLever.rotation,{z:g.pose.trip.switchUpRot,duration:.65,ease:'power3.out'}));
          MACH.bump();say('스위치 상향 타격');
          // 타격을 큰 화면에서 끝까지 보여준 뒤, 같은 순간의 로프브레이크 작동으로 컷 전환한다.
          later(1.15,()=>{shot('brake',.45);later(.6,()=>{
            if(state.mode==='normal')grip();else{say('로프브레이크 없음 · 제동 불가');later(1.1,()=>{shot('car',.45);later(.5,()=>{state.stage='unprotected';gsap.ticker.add(tick);});});}
          });});
        }}));
    });
  }
  function grip(){
    state.stage='closing';const up=scene.getObjectByName('BrakeUpperJaw'),lo=scene.getObjectByName('BrakeLowerJaw'),travel=UCMDemo.jawTravel;
    const q={t:0},y=carGrp.position.y,delay=.075;
    const tl=gsap.timeline({onComplete:()=>{
      state.stage='grip';state.gripY=carGrp.position.y;state.gripSpeed=state.v;
      MACH.ropeBrakeBang();UCMEffects.grip();shock();say('쾅! 로프 파지');
      // 실제 접촉 이후만 제동한다. v²/2s의 등감속, 변위 s(2t-t²).
      const stop={t:0},v0=state.v,duration=2*motion.brakeSlip/v0;
      own(gsap.to(stop,{t:1,duration:duration/.35,ease:'none',onUpdate:()=>{state.v=v0*(1-stop.t);setCar(state.gripY+motion.brakeSlip*(2*stop.t-stop.t*stop.t));},onComplete:()=>stopped(false)}));
    }});own(tl);
    tl.to(up.position,{y:saved.upper+travel.upperTravel,duration:delay,ease:'power4.in'},0)
      .to(lo.position,{y:saved.lower+travel.lowerTravel,duration:delay,ease:'power4.in'},0)
      .to(q,{t:1,duration:delay,ease:'none',onUpdate:()=>setCar(y+state.v*delay*q.t)},0);
  }
  function impact(){
    gsap.ticker.remove(tick);state.stage='impact';state.impactSpeed=state.v;
    MACH.bufferImpact();MACH.overspeedImpact('collision');UCMEffects.hit('failure','쾅! 균형추 충돌','');shock(2.2);burst(new THREE.Vector3(0,bufferGrp.userData.cwt.topY,CWT_CENTER_Z),1.5);say('균형추 충돌 · 충격 전달');
    const h=bufferGrp.userData.cwt,stroke=h.stroke||0,q={t:0},v0=state.v;
    own(gsap.to(q,{t:1,duration:.18,ease:'none',onUpdate:()=>{
      const compression=stroke*(2*q.t-q.t*q.t);state.v=v0*(1-q.t);setCar(state.contactY+compression);
      if(h.urethane){const sy=(h.height-compression)/h.height;h.urethane.scale.set(1/Math.sqrt(sy),sy,1/Math.sqrt(sy));}
    },onComplete:()=>stopped(true)}));
  }
  function passengerReaction(severe){
    state.lift=0;state.alarm=1;poseBear();
    const ceiling=carGrp.position.y+S.CAR_H/2;
    const amp=severe?Math.max(.4,ceiling-bearBox.max.y-.10):.28;
    state.jumpHeight=amp;
    own(gsap.timeline({onComplete:()=>{
      state.stage='done';play.disabled=false;play.textContent='RST';say(severe?'로프브레이크 없음 · 큰 부상':'로프브레이크 작동 · 무사 착지');
    }}).to(state,{lift:amp,duration:severe?1.0:.48,ease:'power2.out'})
      .to(state,{lift:0,duration:severe?.85:.55,ease:'power2.in'})
      .call(()=>{MACH.bump();if(severe){MACH.overspeedImpact('grip');shock(1.1);state.injured=true;UCMEffects.hit('failure','큰 부상','');}else shock(.35);})
      .to(state,{crouch:severe?0:-.045,roll:severe?1.40:0,alarm:severe?.5:.35,duration:.4,ease:'power2.out'})
      .to(state,{crouch:0,alarm:severe?.35:0,duration:.7}));
  }
  function stopped(severe){
    state.v=0;state.stopY=carGrp.position.y;state.stage='stopped';moving=false;estop=true;currentState=ELEVATOR_STATE.ESTOP;MACH.motorOff();setCar(carGrp.position.y);
    later(severe?1.7:1.1,()=>{inset.hidden=true;shot('passenger',.5);say(severe?'카 급정지 · 큰 충격':'카 정지 · 승강곰');
      later(.6,()=>{state.stage='passenger';if(severe)shock(1.8);passengerReaction(severe);});});
  }
  function start(mode='normal'){
    if(state.active)return;
    const why=overspeedActive||estop||moving||insMode||DoorBypass.mode!=='off'||!PitLadder.secured||InterlockDemo.active||ARDDemo.active||BufferDemo.active||UCMDemo.state.active||HallManual.active||InspectionReturn.busy||CarDoor.state?.busy||doorOpen||!CarDoor.secured()||!DoorBypass.hallSecured();
    if(why){updateStatus('v-dir','정지·폐문·고장 복귀 후 상승과속 시연','#f0883e');return;}
    if(!tr()?.ready||!govHandles()?.ready||!scene.getObjectByName('RopeBrakeInstallation')?.userData.ready||!cwtGrp.getObjectByName('cwtBufferStrike'))return;
    closeAllMenus();close();clearTimeout(autoTimer);leaveCabinView();
    saved={y:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,cut:tr().cutaway,brake:tr().brakeOpen,worm:tr().worm.rotation.z,
      upper:scene.getObjectByName('BrakeUpperJaw').position.y,lower:scene.getObjectByName('BrakeLowerJaw').position.y,
      brakeVisible:scene.getObjectByName('RopeBrakeInstallation').visible,switch:govHandles().switchLever.rotation.z,
      wheel:govHandles().wheel.rotation.z,tension:tensionSheaveGrp.rotation.x,sheave:mainSheaveGrp.rotation.z,deflector:deflectorSheaveGrp.rotation.z,
      bearParent:passenger().parent,bearPose:[],mainP:mainSheaveGrp.position.clone(),defP:deflectorSheaveGrp.position.clone(),cwtP:cwtGrp.position.clone(),buffer:bufferGrp.userData.cwt.urethane?.scale.clone()};
    passenger().traverse(o=>saved.bearPose.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),visible:o.visible}));
    Object.assign(state,{active:true,mode:mode==='none'?'none':'normal',stage:'preparing',view:'car',v:0,rise:0,lift:0,standOffset:0,roll:0,crouch:0,alarm:0,injured:false,pitShot:false,rated:targetSpeed/60,baseY:FLOOR_Y[0]+S.CAR_H/2,
      detectedSpeed:null,switchY:null,switchSpeed:null,gripY:null,gripSpeed:null,stopY:null,impactSpeed:null});
    state.tripSpeed=state.rated*motion.tripRatio;
    state.detectAt=FLOOR_Y[2]+(FLOOR_Y[3]-FLOOR_Y[2])*.38+S.CAR_H/2;
    const distance=state.detectAt-state.baseY;state.runAccel=state.tripSpeed*state.tripSpeed/(2*distance);state.runTimeScale=(2*distance/state.tripSpeed)/motion.ascentSeconds;
    overspeedActive=true;moving=true;currentState=ELEVATOR_STATE.MOVING;play.disabled=true;
    _saveCam();UCMEffects.prepare(reset);MACH.resume();buildFractures();
    Mascot.beginInspection();scene.attach(passenger());bearMouth=Mascot.rig.head.children.find(o=>o.geometry?.type==='TorusGeometry');
    passenger().position.set(0,carGrp.position.y-S.CAR_H/2,CAR_CTR_Z);passenger().rotation.set(0,1.15,0);passenger().scale.setScalar(1.25);passenger().visible=true;
    scene.updateMatrixWorld(true);
    const floorTop=new THREE.Box3().setFromObject(carGrp.getObjectByName('carFloorFinish')).max.y;
    state.standOffset=floorTop+.003-new THREE.Box3().setFromObject(passenger()).min.y;
    scene.getObjectByName('RopeBrakeInstallation').visible=state.mode!=='none';
    say('1층 · 승객 1명 · 문 닫힘');
    const q={y:carGrp.position.y};own(gsap.to(q,{y:state.baseY,duration:Math.abs(q.y-state.baseY)>.01?1.5:.01,ease:'power2.inOut',onUpdate:()=>setCar(q.y),onComplete:()=>{
      curFloor=0;setCar(state.baseY);state.contactY=carGrp.position.y+cwtGrp.position.y+cwtGrp.getObjectByName('cwtBufferStrike').userData.faceY-bufferGrp.userData.cwt.topY;
      shot('car',.35);later(1.2,()=>{setTractionCutaway(true,true);setTractionBrake(false,true);shot('gear',.65);later(1.25,breakDrive);});
    }}));
  }
  function reset(){
    if(!state.active||state.stage==='resetting')return;
    state.stage='resetting';jobs.forEach(t=>t.kill());jobs=[];gsap.ticker.remove(tick);inset.hidden=true;UCMEffects.clear();
    play.disabled=true;passenger().visible=false;state.lift=0;state.v=0;shake?.cancel();if(dust)dust.visible=ring.visible=false;
    mainSheaveGrp.position.copy(saved.mainP);deflectorSheaveGrp.position.copy(saved.defP);cwtGrp.position.x=saved.cwtP.x;
    fractures.forEach(f=>{f.mesh.geometry=f.source;f.pieces.forEach(p=>{p.mesh.visible=false;p.mesh.position.copy(p.home);p.mesh.quaternion.copy(p.rot);});});
    tr().driveBroken=false;setTractionCutaway(saved.cut,true);setTractionBrake(saved.brake,true);
    scene.getObjectByName('BrakeUpperJaw').position.y=saved.upper;scene.getObjectByName('BrakeLowerJaw').position.y=saved.lower;scene.getObjectByName('RopeBrakeInstallation').visible=saved.brakeVisible;
    const g=govHandles();openPendulum(0);g.switchLever.rotation.z=saved.switch;g.switchLever.userData.contactClosed=true;g.ropeLocked=false;governorPhase='rest';govSpinDir=1;
    if(saved.buffer)bufferGrp.userData.cwt.urethane.scale.copy(saved.buffer);
    gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);state.view='resetting';moving=true;estop=false;currentState=ELEVATOR_STATE.MOVING;
    say('상승과속 시연 종료 · 정상 복귀');const q={y:carGrp.position.y};
    own(gsap.to(q,{y:saved.y,duration:1.1,ease:'power2.inOut',onUpdate:()=>setCar(q.y),onComplete:()=>{
      carGrp.position.y=saved.y;cwtGrp.position.y=saved.cwt;mainSheaveGrp.rotation.z=saved.sheave;deflectorSheaveGrp.rotation.z=saved.deflector;tr().worm.rotation.z=saved.worm;g.wheel.rotation.z=saved.wheel;tensionSheaveGrp.rotation.x=saved.tension;
      refreshRopes();refreshGovernorRope();saved.bearParent.add(passenger());Mascot.endInspection();
      saved.bearPose.forEach(({o,p,q,s,visible})=>{o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);o.visible=visible;});
      _restoreCam(.4);
      own(gsap.delayedCall(.45,()=>{curFloor=saved.floor;moving=false;estop=false;overspeedActive=false;currentState=ELEVATOR_STATE.IDLE;state.active=false;state.stage='rest';play.disabled=false;play.textContent='상승과속 시연';caption.hidden=true;document.body.classList.remove('ucm-active');MACH.motorOff();syncAllIndicators(curFloor+1,'');updateStatus('v-spd','0 m/min');updateStatus('v-dir','정지 대기','#8b949e');}));
    }}));
  }
  return {build,update,renderInset,start,reset,close,motion,state,get active(){return state.active;}};
})();
