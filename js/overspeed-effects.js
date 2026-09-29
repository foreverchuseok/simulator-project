// OVS 전용 연출. 정상 운행에서는 숨기고, 버퍼·재질은 시연 사이에 재사용한다.
const OVSEffects=(()=>{
  let root,strands=[],dust=[],texture,overlay,headline,summary,headlineTween,shake;
  const frames=new Map(),calls=[];
  const later=(seconds,fn)=>{const t=gsap.delayedCall(seconds,fn);calls.push(t);return t;};
  function build(){
    if(root)return;
    root=new THREE.Group();root.name='OVSCorrodedStrands';root.visible=false;scene.add(root);
    const rust=[0x77341a,0xa44b20,0xc06d30,0x582b1c].map(c=>{const m=M.ss(c);m.roughness=.96;m.metalness=.12;return m;});
    // Each rope has six helical strands, with separate upper/lower torn ends.
    ropeObjs.forEach((rope,r)=>{for(let s=0;s<6;s++)for(let end=0;end<2;end++){
      const geo=new THREE.BufferGeometry(),positions=new Float32Array(25*5*3),indices=[];
      for(let j=0;j<24;j++)for(let k=0;k<5;k++){const a=j*5+k,b=j*5+(k+1)%5;indices.push(a,b,a+5,b,b+5,a+5);}
      geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setIndex(indices);
      const mesh=new THREE.Mesh(geo,rust[(r+s)%rust.length]);mesh.frustumCulled=false;root.add(mesh);strands.push({mesh,r,s,end});
    }});
    const c=document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.35,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,64,64);texture=new THREE.CanvasTexture(c);
    for(let n=0;n<3;n++){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180*3),3).setUsage(THREE.DynamicDrawUsage));
      const mesh=new THREE.Points(geo,new THREE.PointsMaterial({map:texture,color:0xbba58b,size:.3,transparent:true,depthWrite:false,opacity:0}));
      mesh.frustumCulled=false;mesh.visible=false;mesh.name='OVSDust'+n;mesh.renderOrder=11;scene.add(mesh);dust.push({mesh,tween:null});
    }
    const style=document.createElement('style');style.textContent=`
      #ovs-impact{position:fixed;inset:0;z-index:35;pointer-events:none;display:grid;place-items:center;background:radial-gradient(ellipse,transparent 30%,#4e18004a);opacity:0}
      #ovs-impact strong{font:950 clamp(30px,6vw,86px)/1.1 sans-serif;color:#fff4d6;text-shadow:0 3px 0 #762510,0 0 30px #f64;letter-spacing:-.04em;text-align:center}
      #ovs-impact small{display:block;font:700 clamp(11px,1.5vw,17px)/2 sans-serif;letter-spacing:.16em;color:#ffbc77}
      #ovs-summary{position:fixed;inset:18% 6% 14%;z-index:120;display:flex;flex-direction:column;gap:14px;padding:22px;border:1px solid #899aa0;border-radius:16px;background:#0c1724f5;color:#eef6fb;box-shadow:0 20px 100px #0009;font:14px sans-serif}
      #ovs-summary[hidden]{display:none}#ovs-summary header{display:flex;align-items:center;justify-content:space-between;gap:12px}#ovs-summary h2{font-size:20px;margin:0}#ovs-summary p{color:#a9becb;margin:5px 0 0}
      #ovs-summary button{border:1px solid #88b69d;border-radius:10px;background:#23543c;color:white;min-height:44px;padding:10px 18px;font-weight:800;cursor:pointer;white-space:nowrap}
      #ovs-summary .ovs-scenes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex:1;min-height:0}#ovs-summary figure{margin:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;border:1px solid #485665;border-radius:10px;background:#17202a}
      #ovs-summary img{width:100%;height:0;flex:1;min-height:0;object-fit:cover;background:#cbd3dc}#ovs-summary figcaption{padding:12px;font-weight:700;line-height:1.5}#ovs-summary figcaption small{display:block;color:#b2c4d2;font-weight:400}
      @media(max-width:600px){#ovs-summary{inset:12% 12px 10%;padding:12px;gap:10px}#ovs-summary h2{font-size:17px}#ovs-summary p{font-size:11px}#ovs-summary .ovs-scenes{grid-template-columns:1fr;grid-template-rows:repeat(3,1fr);gap:8px}#ovs-summary figure{flex-direction:row}#ovs-summary img{width:56%;height:100%;flex:none}#ovs-summary figcaption{font-size:12px;padding:10px;align-self:center}#ovs-summary figcaption small{font-size:10px}}
      @media(prefers-reduced-motion:reduce){#ovs-impact{background:none}}
    `;document.head.appendChild(style);
    overlay=document.createElement('div');overlay.id='ovs-impact';headline=document.createElement('strong');overlay.appendChild(headline);document.body.appendChild(overlay);
    summary=document.createElement('section');summary.id='ovs-summary';summary.hidden=true;summary.setAttribute('aria-label','과속 시연 세 장면');
    summary.innerHTML='<header><div><h2>비상정지 완료</h2><p>세 장면 다시보기 · 작동 순서를 확인하세요.</p></div><button type="button" id="ovs-exit">종료 · 정상 복귀</button></header><div class="ovs-scenes"></div>';
    document.body.appendChild(summary);summary.querySelector('button').onclick=()=>resetGovernorFault(document.getElementById('btn-overspeed'));
  }
  function prepare(){build();clear();root.visible=true;updateRope();}
  function updateRope(){
    if(!root?.visible)return;
    const cy=carGrp.position.y+S.CAR_H/2+CAR_ROPE_END_DY;
    for(const {mesh,r,s,end} of strands){
      const rope=ropeObjs[r],delay=(r*6+s)/30*.46;
      const p=THREE.MathUtils.clamp((ovsDemo.breakProgress-delay)/.54,0,1),pos=mesh.geometry.attributes.position;
      const angle=s*Math.PI/3,split=(Math.sin(s*7+r*11)*.065),anchor=end?cy+.55:ovsDemo.breakY+.5;
      const tip=end?cy+1.05+split-.25*p:ovsDemo.breakY+split+.24*p;
      for(let j=0;j<=24;j++){
        const u=j/24,a=angle+u*Math.PI*5,spread=p*u*u*(.065+(s%3)*.023);
        const x=rope.hx+Math.cos(a)*rope.ropeR*.72+Math.cos(angle)*spread;
        const z=CAR_CTR_Z+rope.hz+Math.sin(a)*rope.ropeR*.72+Math.sin(angle)*spread;
        const y=anchor+(tip-anchor)*u;
        const radius=rope.ropeR*.32*(1-.6*p*Math.pow(u,6));
        for(let k=0;k<5;k++){const b=k*Math.PI*2/5;pos.setXYZ(j*5+k,x+Math.cos(b)*radius,y,z+Math.sin(b)*radius);}
      }
      pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }
  function burst(origin,scale=1,slot=0,rust=false){
    build();const d=dust[slot];d.tween?.kill();const m=d.mesh;m.position.copy(origin);m.visible=true;m.material.color.setHex(rust?0x9c623b:0xc4bdb2);m.material.size=.23*scale;
    const state={t:0};d.tween=gsap.to(state,{t:1,duration:1.65,ease:'none',onUpdate:()=>{
      const t=state.t,pos=m.geometry.attributes.position;
      for(let i=0;i<180;i++){const a=i*2.39996,s=.2+(i%17)/17;pos.setXYZ(i,Math.cos(a)*s*scale*(.15+t),(.15+Math.sin(i*8.7)*.2+t*.5)*scale,Math.sin(a)*s*scale*(.15+t));}
      pos.needsUpdate=true;m.material.opacity=.6*Math.pow(1-t,1.4);m.material.size=(.23+t*.48)*scale;
    },onComplete:()=>m.visible=false});
  }
  function hit(title,subtitle){
    build();headlineTween?.kill();headline.replaceChildren(document.createTextNode(title));const small=document.createElement('small');small.textContent=subtitle;headline.appendChild(small);
    overlay.style.opacity=1;headlineTween=gsap.fromTo(headline,{scale:1.18},{scale:1,duration:.3,ease:'power3.out'});
    gsap.killTweensOf(overlay);gsap.to(overlay,{opacity:0,delay:.45,duration:.4});
    shake?.cancel();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)shake=renderer.domElement.animate([
      {transform:'translate(0,0)'},{transform:'translate(-5px,3px)'},{transform:'translate(4px,-3px)'},{transform:'translate(-2px,1px)'},{transform:'translate(0,0)'}
    ],{duration:240,easing:'ease-out'});
  }
  function capture(key){
    // Render once at the event, then reuse the still in the final triptych.
    controls.update();scene.updateMatrixWorld(true);renderer.render(scene,camera);
    const canvas=document.createElement('canvas'),src=renderer.domElement;
    const size=Math.min(src.width,src.height);canvas.width=canvas.height=Math.min(700,size);
    canvas.getContext('2d').drawImage(src,(src.width-size)/2,(src.height-size)/2,size,size,0,0,canvas.width,canvas.height);frames.set(key,canvas.toDataURL('image/jpeg',.86));
  }
  function finish(){
    capture('safety');summary.querySelector('.ovs-scenes').replaceChildren();
    for(const [key,title,note] of [['fall','01 · 주로프 파단','부식 가닥 파열 → 카 낙하'],['governor','02 · 조속기 체결','톱니 결착 → 캐치슈 로프 파지'],['safety','03 · 쐐기 제동','가이드레일 파지 → 카 정지']]){
      const fig=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption'),small=document.createElement('small');
      img.src=frames.get(key)||'';img.alt=title;cap.textContent=title;small.textContent=note;cap.appendChild(small);fig.append(img,cap);summary.querySelector('.ovs-scenes').appendChild(fig);
    }
    summary.hidden=false;
  }
  function clear(){
    calls.splice(0).forEach(t=>t.kill());frames.clear();if(root)root.visible=false;
    dust.forEach(d=>{d.tween?.kill();d.mesh.visible=false;});
    if(summary)summary.hidden=true;if(overlay){gsap.killTweensOf(overlay);overlay.style.opacity=0;}headlineTween?.kill();shake?.cancel();
  }
  return {prepare,updateRope,burst,hit,capture,finish,clear,later};
})();
