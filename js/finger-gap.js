// 전 층 승강장문 + 카문의 양쪽 문설주에 문턱 위 1.6m까지 반투명 표시. 아이콘은 설명만 연다.
// 치수는 hatchDoors[i].fingerGap(elevator.js)과 CarDoor.dimensions()가 원본이다.
const FingerGap=(()=>{
  const REACH_H=1.6, STRIP_W=0.03;
  const EFFECT_STRENGTH=.7;
  const ICON='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3H3v18h4M17 3h4v18h-4M8 7v10M16 7v10M8 12h8m-5-3-3 3 3 3m2-6 3 3-3 3"/></svg>')+'")';
  const entries=[],point=new THREE.Vector3(),local=new THREE.Vector3();
  let panel,active=null,built=false,material,edgeMaterial;
  function strip(parent,x0,x1,y0,z0,z1){
    const g=new THREE.BoxGeometry(x1-x0,REACH_H,z1-z0);
    const m=new THREE.Mesh(g,material);m.name='fingerGapStrip';
    m.position.set((x0+x1)/2,y0+REACH_H/2,(z0+z1)/2);m.renderOrder=3;
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),edgeMaterial);m.add(e);
    m.userData={type:'finger-gap-strip',height:REACH_H};parent.add(m);return m;
  }
  function build(){
    material=new THREE.MeshBasicMaterial({color:0x3fd4c4,transparent:true,opacity:.5*EFFECT_STRENGTH,depthWrite:false});
    edgeMaterial=new THREE.LineBasicMaterial({color:0x9ff5ea,transparent:true,opacity:.9*EFFECT_STRENGTH,depthWrite:false});
    const root=new THREE.Group();root.name='FingerGapHighlights';scene.add(root);
    hatchDoors.forEach((h,f)=>{
      const q=h.fingerGap,strips=[];
      // 문설주: 홀에서 보이는 문짝 가장자리 30mm + 문짝면 ↔ 립 5mm.
      for(const s of [-1,1]){const a=s*(q.edgeX-STRIP_W),b=s*q.edgeX;strips.push(strip(root,Math.min(a,b),Math.max(a,b),q.floorY,q.faceZ,q.jambZ));}
      entries.push({kind:'hall',floor:f,strips,button:button(`${f+1}층 승강장문`,`finger-gap-hall-${f}`),
        anchor:new THREE.Vector3(-q.edgeX+STRIP_W/2,q.floorY+REACH_H+.14,q.jambZ),parent:scene,owner:h.right,
        facing:()=>camera.position.z>q.faceZ});
    });
    const d=CarDoor.dimensions(),edge=S.DOOR_W/2,face=d.doorZ-CarDoor.spec.panelT/2,strips=[];
    for(const s of [-1,1]){const a=s*(edge-STRIP_W),b=s*edge;strips.push(strip(carGrp,Math.min(a,b),Math.max(a,b),d.floor,d.jambFaceZ,face));}
    entries.push({kind:'car',floor:-1,strips,button:button('카문','finger-gap-car'),
      anchor:new THREE.Vector3(edge-STRIP_W/2,d.floor+REACH_H+.14,d.jambFaceZ),parent:carGrp,owner:carDoorR,
      facing:()=>{local.copy(camera.position);carGrp.worldToLocal(local);return local.z<d.jambFaceZ&&Math.abs(local.x)<S.CAR_W/2&&Math.abs(local.y)<S.CAR_H/2;}});
    built=true;
  }
  function button(label,id){
    const b=document.createElement('button');b.type='button';b.className='part-action gap-action';b.id=id;b.hidden=true;b.style.setProperty('--part-icon',ICON);
    b.setAttribute('aria-label',`${label} 문틀 틈새 기준 설명`);b.title=b.getAttribute('aria-label');
    b.setAttribute('aria-controls','finger-gap-panel');b.setAttribute('aria-expanded','false');
    b.addEventListener('click',()=>{const e=entries.find(x=>x.button===b),open=active!==e;close();if(open)show(e);});
    document.getElementById('part-actions').appendChild(b);return b;
  }
  function show(e){
    closeAllMenus();active=e;
    document.getElementById('finger-gap-title').textContent=`${e.kind==='car'?'카문':e.floor+1+'층 승강장문'} · 틈새 기준`;
    panel.hidden=false;e.button.setAttribute('aria-expanded','true');e.button.classList.add('active');
  }
  function close(){
    if(active){active.button.setAttribute('aria-expanded','false');active.button.classList.remove('active');}
    active=null;if(panel)panel.hidden=true;
  }
  function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
  function update(){
    if(!built){if(hatchDoors.length===FLOORS&&hatchDoors.every(h=>h.fingerGap)&&carDoorR)build();else return;}
    if(!PartActions.iconsVisible){if(active)close();for(const e of entries)e.button.hidden=true;return;}
    for(const e of entries){
      point.copy(e.anchor);if(e.parent!==scene)e.parent.localToWorld(point);
      // 가까이 있으면 확대 관찰로 아이콘이 화면 밖에 나가도 설명창을 유지한다.
      const near=visible(e.owner)&&camera.position.distanceToSquared(point)<9&&e.facing();
      let shown=near;
      if(shown){point.project(camera);shown=point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;}
      e.button.hidden=!shown;
      if(shown)PartActions.positionButton(e.button,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
      if(e===active){
        if(!near){close();continue;}
        if(!shown)continue;
        panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,parseFloat(e.button.style.left)-100))+'px';
        panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,parseFloat(e.button.style.top)+50))+'px';
      }
    }
  }
  function bind(){
    panel=document.getElementById('finger-gap-panel');
    document.getElementById('finger-gap-dismiss').addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  return {bind,update,close,entries,get active(){return active;}};
})();
