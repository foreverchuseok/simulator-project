// 주브레이크의 기계적 중복성 비교. 이동량/시간은 교육 연출이며 제동 성능 계산값이 아니다.
const BrakeDemo = (() => {
  const state={active:false,stage:'rest',mode:'dual',rise:0,v:0};
  const motion={dualSlip:.045,dualSeconds:1.25,rise:1.8,seconds:4,dangerAt:2.4};
  const point=new THREE.Vector3();
  let button,panel,caption,ending,saved,jobs=[],warningStop,shake;
  const traction=()=>mrGrp?.userData.traction;
  const own=t=>{jobs.push(t);return t;};
  const later=(s,fn)=>own(gsap.delayedCall(s,()=>{if(state.active&&state.stage!=='resetting')fn();}));
  const say=text=>{caption.textContent=text;caption.hidden=!text;updateStatus('v-dir',text,'#f0883e');};
  function build(){
    const css=document.createElement('style');css.textContent=`
      #brake-compare-panel{position:fixed;z-index:112;width:270px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:12px;border-radius:14px;color:var(--ui-text);font:13px/1.5 var(--ui-font)}
      #brake-compare-panel[hidden],#brake-compare-stage[hidden]{display:none}
      #brake-compare-panel button{min-height:44px;cursor:pointer;color:inherit;background:#253b49;border:1px solid #667e8c;border-radius:8px;padding:6px 9px}
      #brake-compare-panel .choices{display:flex;gap:6px;margin:10px 0}#brake-compare-panel [aria-pressed=true]{background:#367b66;border-color:#8adcc1}#btn-brake-compare{width:100%}
      #brake-compare-stage{position:fixed;left:50%;bottom:var(--caption-bottom,22px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);box-sizing:border-box;padding:10px 14px;border:1px solid #879d9d;border-radius:10px;background:#122633ef;color:#f4f8fa;font:700 14px/1.5 sans-serif;text-align:center;z-index:36;pointer-events:none;white-space:pre-line}
      #brake-compare-action::after{content:'주브레이크 비교';position:absolute;top:46px;left:50%;transform:translateX(-50%);font:700 10px sans-serif;white-space:nowrap;color:white;background:#172b36d9;padding:3px 5px;border-radius:5px}
      #brake-compare-ending{position:fixed;inset:0;z-index:37;pointer-events:none;box-shadow:inset 0 0 95px #ce1c1c88;background:linear-gradient(#32060b85,transparent 42%);color:#fff0e4;text-align:center}
      #brake-compare-ending[hidden]{display:none}#brake-compare-ending div{position:absolute;top:18%;left:8px;right:8px;text-shadow:0 3px 2px #471313}
      #brake-compare-ending strong{display:block;font:950 clamp(36px,6vw,78px)/1.15 sans-serif}#brake-compare-ending b{display:block;margin:12px 0;font:800 clamp(18px,3vw,30px)/1.3 sans-serif}
      #brake-compare-ending small{display:inline-block;background:#52121ade;border:1px solid #ff8c7b;border-radius:7px;padding:7px 12px;font:700 13px/1.5 sans-serif}
      #brake-compare-ending[data-safe=true]{box-shadow:inset 0 0 70px #29745350;background:linear-gradient(#083a3380,transparent 40%);color:#e8fff5}
      #brake-compare-ending[data-safe=true] strong{font-size:clamp(30px,5vw,60px)}#brake-compare-ending[data-safe=true] small{background:#0e4339e8;border-color:#79cdb4}
      @media(max-width:600px){#brake-compare-stage{font-size:12px}}
    `;document.head.appendChild(css);
    button=document.createElement('button');button.id='brake-compare-action';button.className='part-action';button.hidden=true;
    button.title='주브레이크 · 싱글/더블 비교';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','brake-compare-panel');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="5"/><path d="M7 3H3v18h4m10-18h4v18h-4M3 12h4m10 0h4"/></svg>';
    button.style.setProperty('--part-icon',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    panel=document.createElement('section');panel.id='brake-compare-panel';panel.className='glass';panel.hidden=true;panel.setAttribute('aria-label','주브레이크 비교 설정');
    panel.innerHTML='<div class="part-panel-head"><strong>주브레이크 비교</strong><button id="brake-compare-dismiss" aria-label="접기">×</button></div><div class="choices"><button data-brake-mode="dual" aria-pressed="true">더블 · 기본</button><button data-brake-mode="single" aria-pressed="false">싱글 · 구형</button></div><p>가벼운 카 · 균형추가 더 무거움<br>모터 유지 토크 없음 · 웜기어 정상</p><p>보호망을 벗겨 도르래·로프 움직임을 비교합니다. 정상 브레이크는 코일 전원이 끊기면 잡힙니다.</p><button id="btn-brake-compare">고장 비교 시작</button>';
    document.getElementById('part-actions').append(button,panel);
    button.onclick=()=>{const open=panel.hidden;closeAllMenus();panel.hidden=!open;button.setAttribute('aria-expanded',String(open));};
    panel.querySelector('#brake-compare-dismiss').onclick=close;
    panel.querySelectorAll('[data-brake-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.brakeMode;panel.querySelectorAll('[data-brake-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});
    panel.querySelector('#btn-brake-compare').onclick=()=>state.active?reset():start(state.mode);
    document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==button)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();if(state.active)reset();}});
    for(const type of ['click','pointerdown','change','keydown','dblclick'])document.addEventListener(type,e=>{
      if(!state.active||e.target.closest?.('#ucm-exit,#btn-estop,#fault-reset,#btn-brake-compare'))return;
      if(e.target.closest?.('button,input,select,canvas')){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    caption=document.createElement('div');caption.id='brake-compare-stage';caption.hidden=true;caption.setAttribute('role','status');document.body.appendChild(caption);
    ending=document.createElement('div');ending.id='brake-compare-ending';ending.hidden=true;ending.setAttribute('role','status');ending.innerHTML='<div><strong></strong><b></b><small></small></div>';document.body.appendChild(ending);
  }
  function close(){if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false');}
  function update(){
    if(!button)return;
    const t=traction();button.hidden=true;
    if(!t?.ready||!PartActions.iconsVisible||overspeedActive||moving||ARDDemo.active)return;
    point.set(t.contract.wheelX,t.contract.brakeCompare.iconY,t.contract.drumZ);t.model.localToWorld(point);
    if(camera.position.distanceToSquared(point)>64){close();return;}
    point.project(camera);
    if(point.z<=-1||point.z>=1||Math.abs(point.x)>.96||Math.abs(point.y)>.94){close();return;}
    button.hidden=false;let x=(point.x+1)*innerWidth/2-22,y=(1-point.y)*innerHeight/2-50;
    // 기존 조속기/로프브레이크 아이콘 배치 뒤에 빈 세로 공간을 찾는다.
    const obstacles=['btn-overspeed','rope-brake-action','ascent-action'].map(id=>document.getElementById(id)).filter(b=>b&&!b.hidden);
    for(let i=0;i<5;i++){
      PartActions.positionButton(button,x,y);const r=button.getBoundingClientRect();
      const hit=obstacles.find(b=>{const q=b.getBoundingClientRect();return r.left<q.right+8&&r.right>q.left-8&&r.top<q.bottom+25&&r.bottom+25>q.top;});
      if(!hit)break;const q=hit.getBoundingClientRect();y=q.bottom+30;if(y>innerHeight-80)y=q.top-80;
    }
    if(!panel.hidden){const r=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,r.left-100))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,r.bottom+28))+'px';}
  }
  function appearance(single){
    const t=traction();t.compare.dual.forEach(o=>o.visible=!single);t.compare.single.forEach(o=>o.visible=single);
    const wire=scene.getObjectByName('DualBrakeSupply');if(wire)wire.visible=single?false:saved.wire;
  }
  function shot(kind,duration=.55){
    state.view=kind;gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    const portrait=Math.max(1,.7/camera.aspect);let target,offset;
    if(kind==='brake'){
      const t=traction();target=t.model.localToWorld(new THREE.Vector3(t.contract.wheelX-(state.mode==='single'?.12:0),t.contract.dualBrake.springY,t.contract.drumZ));
      // 세로 화면의 거리 보정으로 -X 벽 뒤로 넘어가지 않게 X는 고정한다.
      offset=new THREE.Vector3(-.85,.53*portrait,.83*portrait);
    }else{
      target=traction().model.localToWorld(new THREE.Vector3(-.04,.10,.05));
      offset=new THREE.Vector3(1.45,.65,.90).multiplyScalar(portrait);
    }
    const c=target.clone().add(offset);_camTo(c.x,c.y,c.z,target.x,target.y,target.z,duration);
  }
  function setCar(y){
    const dy=y-carGrp.position.y;carGrp.position.y=y;cwtGrp.position.y-=dy;spinSheaves(dy);refreshRopes();refreshGovernorRope();
    const light=scene.getObjectByName('carLight');if(light)light.position.y=y+S.CAR_H*.75;
    state.rise=y-state.baseY;
    updateStatus('v-spd',state.stage==='paused'?'시연 일시정지':Math.round(state.v*60)+' m/min');
  }
  function fail(){
    state.stage='failure';const t=traction(),single=state.mode==='single';
    const fragments=single?t.compare.singleSpring:t.compare.dualSpringL;
    // 코일 전원/플런저 해방 동작이 아니라 끊어진 제동 스프링의 힘 상실이다.
    fragments.forEach((o,i)=>own(gsap.to(o.position,{x:o.position.x+(i?-.018:.018),y:o.position.y-(i?.014:0),duration:.35})));
    (single?t.arms:[t.arms[0]]).forEach((a,i)=>own(gsap.to(a.rotation,{z:i===0?.012:-.012,duration:.35})));
    MACH.ucmBrakeFailure();UCMEffects.hit('failure',single?'공통 제동 스프링 파손':'한쪽 제동 스프링 파손',single?'양쪽 슈의 제동력 상실':'반대쪽은 이미 제동 중');
    say(single?'공통 스프링 파손 → 양쪽 제동력 상실':'한쪽 스프링 파손\n반대쪽 스프링·슈는 제동을 그대로 유지');
    later(2.0,()=>{shot('sheave',.8);later(.85,uncover);});
  }
  function uncover(){
    state.stage='uncovering';say('도르래 보호망 탈거 · 시연 중 내부 관찰');
    const guard=saved.guard;
    own(gsap.to(guard.position,{y:saved.guardPosition.y+1.15,duration:1.1,ease:'power2.inOut',onComplete:()=>{
      guard.visible=false;guard.position.copy(saved.guardPosition);later(.25,run);
    }}));
  }
  function result(danger,finished=false){
    ending.hidden=false;ending.dataset.safe=String(!danger);
    ending.querySelector('strong').textContent=danger?'⚠ 위험':'제동 유지';
    ending.querySelector('b').textContent=danger?'도르래 회전 지속':'짧은 움직임 뒤 정지';
    ending.querySelector('small').textContent=danger?(finished?'시연 종료 · 실제 제동된 상태가 아닙니다.':'제동력 상실 · 상승 위험'):'반대쪽 브레이크가 계속 잡고 있습니다.';
  }
  function run(){
    const single=state.mode==='single',q={p:0};state.stage=single?'runaway':'settling';
    say(single?'싱글 · 도르래·로프 회전 지속':'더블 · 반대쪽 제동 유지');
    if(single){
      MACH.overspeedImpact('fall');
      later(motion.dangerAt,()=>{
        state.stage='danger';result(true);warningStop=MACH.brakeWarning();
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
          shake=renderer.domElement.animate([{transform:'translate(0,0)'},{transform:'translate(-5px,2px)'},{transform:'translate(4px,-2px)'},{transform:'translate(0,0)'}],{duration:350});
          own(gsap.fromTo(ending,{opacity:.3},{opacity:1,duration:.35,repeat:2,yoyo:true,onComplete:()=>ending.style.opacity='1'}));
        }
      });
    }
    own(gsap.to(q,{p:1,duration:single?motion.seconds:motion.dualSeconds,ease:'none',onUpdate:()=>{
      // 더블의 짧은 변위는 교육용 미세 움직임이며, 반대쪽 슈를 새로 체결하지 않는다.
      const rise=single?motion.rise*q.p*q.p:motion.dualSlip*(1-Math.pow(1-q.p,3));
      state.v=single?2*motion.rise*q.p/motion.seconds:3*motion.dualSlip*Math.pow(1-q.p,2)/motion.dualSeconds;
      setCar(state.baseY+rise);
    },onComplete:()=>{
      state.stage=single?'paused':'held';state.pauseSpeed=single?state.v:null;
      if(!single)state.v=0;setCar(carGrp.position.y);result(single,true);readyToReset();
      say(single?'싱글 · 제동력 상실 · 시연 종료':'더블 · 로프 정지 · 반대쪽 제동 유지');
    }}));
  }
  function readyToReset(){const b=panel.querySelector('#btn-brake-compare');b.textContent='RST';b.disabled=false;}
  function start(mode='dual'){
    if(state.active)return;
    if(overspeedActive||moving||estop||insMode||DoorBypass.mode!=='off'||!PitLadder.secured||InterlockDemo.active||ARDDemo.active||BufferDemo.active||UCMDemo.state.active||HallManual.active||InspectionReturn.busy||doorOpen||!CarDoor.secured()||!DoorBypass.hallSecured()||Mascot.inspecting){updateStatus('v-dir','정지·폐문·고장 복귀 후 주브레이크 비교','#f0883e');return;}
    const t=traction();if(!t?.compare||!govHandles()?.ready)return;
    closeAllMenus();clearTimeout(autoTimer);leaveCabinView();
    saved={y:carGrp.position.y,cwt:cwtGrp.position.y,floor:curFloor,cut:t.cutaway,brake:t.brakeOpen,
      worm:t.worm.rotation.z,sheave:mainSheaveGrp.rotation.z,deflector:deflectorSheaveGrp.rotation.z,wheel:govHandles().wheel.rotation.z,tension:tensionSheaveGrp.rotation.x,
      wire:scene.getObjectByName('DualBrakeSupply')?.visible,bearVisible:Mascot.root.visible,guard:scene.getObjectByName('SheaveGuard'),parts:[]};
    saved.guardPosition=saved.guard.position.clone();saved.guardVisible=saved.guard.visible;
    [...t.compare.dual,...t.compare.single,...t.arms].forEach(o=>saved.parts.push({o,p:o.position.clone(),q:o.quaternion.clone(),visible:o.visible}));
    Object.assign(state,{active:true,stage:'preparing',mode:mode==='single'?'single':'dual',rise:0,v:0,baseY:FLOOR_Y[0]+S.CAR_H/2,pauseSpeed:null});
    overspeedActive=true;moving=true;currentState=ELEVATOR_STATE.MOVING;
    panel.querySelector('#btn-brake-compare').disabled=true;
    _saveCam();UCMEffects.prepare(reset);MACH.resume();MACH.motorOff();setTractionBrake(false,true);setTractionCutaway(false,true);appearance(state.mode==='single');
    Mascot.root.visible=false;ending.hidden=true;ending.style.opacity='1';shot('brake',.65);
    say('주브레이크 비교 · 기계실\n가벼운 카 · 모터 유지 토크 없음 · 웜기어 정상');
    const q={y:carGrp.position.y};own(gsap.to(q,{y:state.baseY,duration:Math.abs(q.y-state.baseY)>.01?1.2:.01,onUpdate:()=>setCar(q.y),onComplete:()=>{
      curFloor=0;syncAllIndicators(1,'');updateStatus('v-floor','1F');
      later(.8,()=>{state.stage='holding';say(state.mode==='single'?'싱글 · 공통 스프링 하나가 양쪽 슈를 제동':'더블 · 독립된 두 스프링과 슈가 함께 제동');later(2.5,fail);});
    }}));
  }
  function reset(){
    if(!state.active||state.stage==='resetting')return;
    state.stage='resetting';state.view='resetting';jobs.forEach(t=>t.kill());jobs=[];UCMEffects.clear();state.v=0;
    warningStop?.();warningStop=null;shake?.cancel();ending.hidden=true;ending.style.opacity='1';
    saved.guard.position.copy(saved.guardPosition);saved.guard.visible=saved.guardVisible;
    panel.querySelector('#btn-brake-compare').disabled=true;
    gsap.killTweensOf(camera.position);gsap.killTweensOf(controls.target);
    saved.parts.forEach(({o,p,q,visible})=>{gsap.killTweensOf(o.rotation);o.position.copy(p);o.quaternion.copy(q);o.visible=visible;});
    const wire=scene.getObjectByName('DualBrakeSupply');if(wire)wire.visible=saved.wire;
    setTractionBrake(saved.brake,true);setTractionCutaway(saved.cut,true);say('주브레이크 비교 종료 · 정상 복귀');
    const q={y:carGrp.position.y};own(gsap.to(q,{y:saved.y,duration:.8,ease:'power2.inOut',onUpdate:()=>setCar(q.y),onComplete:()=>{
      carGrp.position.y=saved.y;cwtGrp.position.y=saved.cwt;mainSheaveGrp.rotation.z=saved.sheave;deflectorSheaveGrp.rotation.z=saved.deflector;traction().worm.rotation.z=saved.worm;govHandles().wheel.rotation.z=saved.wheel;tensionSheaveGrp.rotation.x=saved.tension;
      refreshRopes();refreshGovernorRope();Mascot.root.visible=saved.bearVisible;
      _restoreCam(.4);
      own(gsap.delayedCall(.45,()=>{curFloor=saved.floor;moving=false;estop=false;overspeedActive=false;currentState=ELEVATOR_STATE.IDLE;state.active=false;state.stage='rest';state.rise=0;caption.hidden=true;const b=panel.querySelector('#btn-brake-compare');b.textContent='고장 비교 시작';b.disabled=false;document.body.classList.remove('ucm-active');syncAllIndicators(curFloor+1,'');updateStatus('v-spd','0 m/min');updateStatus('v-dir','정지 대기','#8b949e');}));
    }}));
  }
  return {build,update,close,start,reset,state,motion,get active(){return state.active;}};
})();
