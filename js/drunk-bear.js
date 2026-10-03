/* ─────────────────────────────────────────────────────────────
   취객 곰 「취곰」 — 문 이탈방지 시연 전용 오리지널 캐릭터(외부 IP·상표 없음).
   하얀 아기 북극곰 + 하늘색 반팔 셔츠 + 이마에 두른 넥타이 + 초록 소주병("소주"만 표기).
   ▪ 털: 쉘(shell) 기법 SHELLS겹 — 같은 형상을 법선 방향으로 조금씩 부풀리고
     노이즈 알파로 깎아 실제 털끝처럼 보이게 한다. 원본 승강곰(js/mascot.js)과 무관하다.
   ▪ 형상·재질은 create()에서 한 번만 만든다. pose()는 변환·재질 수치만 바꾼다.
   ▪ 키 약 1.22m. 앞(얼굴)은 로컬 +Z. 바닥은 로컬 y=0.
   ───────────────────────────────────────────────────────────── */
const DrunkBear=(()=>{
  const SHELLS=8,FUR_LEN=.013;
  let cache=null;
  function canvasTexture(w,h,draw,srgb=true){
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;return t;
  }
  // 털 색 — 결 방향(세로) 줄무늬와 얼룩으로 단색 플라스틱 느낌을 없앤다.
  function furMap(base,dark,light){
    const t=canvasTexture(256,256,(g,w,h)=>{
      g.fillStyle=base;g.fillRect(0,0,w,h);
      let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
      for(let i=0;i<2600;i++){
        const x=rnd()*w,y=rnd()*h,l=4+rnd()*10;
        g.strokeStyle=rnd()<.5?dark:light;g.globalAlpha=.10+rnd()*.18;g.lineWidth=.8+rnd()*1.2;
        g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*3,y+l);g.stroke();
      }
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,2);return t;
  }
  // 쉘 알파 — 텍셀마다 독립 난수. 밉맵을 끄고 최근접으로 샘플해야 털끝이 뭉개지지 않는다.
  function furNoise(){
    const t=canvasTexture(256,256,(g,w,h)=>{
      const img=g.createImageData(w,h);let seed=12345;
      for(let i=0;i<w*h;i++){seed=(seed*16807)%2147483647;const v=seed/2147483647*255;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=255;}
      g.putImageData(img,0,0);
    },false);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
  }
  function shellMaterial(map,noise,layer){
    const k=(layer+1)/SHELLS;
    const m=new THREE.MeshStandardMaterial({map,roughness:.96,metalness:0});
    m.onBeforeCompile=shader=>{
      shader.uniforms.uShellOffset={value:FUR_LEN*k};shader.uniforms.uShellT={value:.18+.74*k};
      shader.uniforms.furNoise={value:noise};shader.uniforms.furDensity={value:new THREE.Vector2(.7,.5)};
      shader.vertexShader='uniform float uShellOffset;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += objectNormal * uShellOffset;');
      shader.fragmentShader='uniform float uShellT;\nuniform sampler2D furNoise;\nuniform vec2 furDensity;\n'+shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\nif (texture2D(furNoise, vUv * furDensity).r < uShellT) discard;\ndiffuseColor.rgb *= mix(.72, 1.06, uShellT);');
    };
    m.customProgramCacheKey=()=>'drunkBearShell';
    return m;
  }
  // 경로를 따라 도는 회전체 — 몸통·병·캡슐 팔다리에 쓴다.
  function lathe(points,segments=40){return new THREE.LatheGeometry(new THREE.SplineCurve(points.map(([x,y])=>new THREE.Vector2(x,y))).getPoints(28),segments);}
  // 위(0)에서 아래(-len)로 뻗는 캡슐.
  function capsule(r,len,r2=r){
    const pts=[];for(let i=0;i<=8;i++){const a=Math.PI/2*i/8;pts.push(new THREE.Vector2(Math.sin(a)*r,Math.cos(a)*r));}
    for(let i=0;i<=8;i++){const a=Math.PI/2*i/8;pts.push(new THREE.Vector2(Math.cos(a)*r2,-len-Math.sin(a)*r2));}
    return new THREE.LatheGeometry(pts,28);
  }
  const ellipsoid=(rx,ry,rz,ws=40,hs=28)=>new THREE.SphereGeometry(1,ws,hs).scale(rx,ry,rz);

  function create(){
    if(cache)return cache;
    const std=(c,r=.6,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    const furTex=furMap('#f3efe6','#cbc2b2','#ffffff'),noise=furNoise();
    const FUR=new THREE.MeshStandardMaterial({map:furTex,roughness:.95});
    const shells=[...Array(SHELLS)].map((_,i)=>shellMaterial(furTex,noise,i));
    const creamTex=furMap('#fbf6ec','#e0d4bf','#ffffff');
    const CREAM=new THREE.MeshStandardMaterial({map:creamTex,roughness:.92});
    const creamShells=[...Array(SHELLS)].map((_,i)=>shellMaterial(creamTex,noise,i));
    const PAD=std(0x35353b,.5),INNER_EAR=std(0xf2b9bd,.8);
    const NOSE=new THREE.MeshPhysicalMaterial({color:0x111114,roughness:.16,clearcoat:1,clearcoatRoughness:.08});
    const EYE=new THREE.MeshPhysicalMaterial({color:0x120c0a,roughness:.06,clearcoat:1,clearcoatRoughness:.02});
    const SPARK=new THREE.MeshBasicMaterial({color:0xffffff});
    const MOUTH=std(0x3b1714,.7),TONGUE=std(0xe0606a,.6);
    const BLUSH=new THREE.MeshBasicMaterial({color:0xff6f8a,transparent:true,opacity:.45,depthWrite:false});
    const SHIRT=new THREE.MeshStandardMaterial({color:0xa9cdf0,roughness:.78}),BUTTON=std(0xd9dde2,.35);
    const tieTex=canvasTexture(64,64,(g,w,h)=>{g.fillStyle='#b8282f';g.fillRect(0,0,w,h);g.strokeStyle='#1f2f57';g.lineWidth=7;for(let i=-w;i<w*2;i+=18){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();}});
    tieTex.wrapS=tieTex.wrapT=THREE.RepeatWrapping;tieTex.repeat.set(6,1);
    const TIE=new THREE.MeshStandardMaterial({map:tieTex,roughness:.55,side:THREE.DoubleSide});
    const SHADOW=new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.22,depthWrite:false});
    const STAR=new THREE.MeshBasicMaterial({color:0xffd23f});
    const materials=[FUR,...shells,CREAM,...creamShells,PAD,INNER_EAR,NOSE,EYE,SPARK,MOUTH,TONGUE,BLUSH,SHIRT,BUTTON,TIE,SHADOW,STAR],geometries=new Set();
    const add=(p,geo,mat,x=0,y=0,z=0)=>{geometries.add(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);p.add(m);return m;};
    const group=(p,x=0,y=0,z=0,name='')=>{const g=new THREE.Group();g.position.set(x,y,z);g.name=name;p.add(g);return g;};
    // 털 부위: 본체 + 쉘 SHELLS겹을 자식으로 붙인다(형상 공유).
    const fur=(p,geo,x=0,y=0,z=0,mat=FUR)=>{const m=add(p,geo,mat,x,y,z);(mat===FUR?shells:creamShells).forEach(s=>m.add(new THREE.Mesh(geo,s)));return m;};

    const root=new THREE.Group();root.name='DrunkBear';
    const shadow=add(root,new THREE.CircleGeometry(.26,32),SHADOW,0,.003,0);shadow.rotation.x=-Math.PI/2;
    const rig=group(root,0,0,0,'DrunkBearRig');                  // 비틀거림·넘어짐 전체 자세
    const hips=group(rig,0,.365,0,'DrunkBearHips');
    // 다리: 허벅지 → 무릎 → 발목. 앞차기가 실제 관절로 접히고 펴진다.
    const legs=[-1,1].map(s=>{
      const thigh=group(hips,s*.105,.02,0,s<0?'DrunkBearThighL':'DrunkBearThighR');fur(thigh,capsule(.082,.12,.074));
      const knee=group(thigh,0,-.17,0);fur(knee,capsule(.072,.1,.066));
      const ankle=group(knee,0,-.15,0);
      fur(ankle,ellipsoid(.074,.05,.105),0,-.012,.03);add(ankle,ellipsoid(.05,.008,.07),PAD,0,-.058,.035);
      for(const t of [-1,0,1])add(ankle,ellipsoid(.016,.006,.016),PAD,t*.03,-.055,.105);
      return {thigh,knee,ankle};
    });
    const body=group(hips,0,0,0,'DrunkBearBody');
    const torso=lathe([[0,-.05],[.14,-.035],[.215,.04],[.24,.15],[.225,.27],[.18,.37],[.12,.44],[0,.48]]);
    fur(body,torso);
    fur(body,ellipsoid(.125,.14,.04),0,.15,.205,CREAM);   // 크림색 배 털                  // 배 털 패치(셔츠 앞섶 사이로 보임)
    // 반팔 셔츠 — 털 쉘보다 바깥(+16mm). 앞섶은 열려 배가 보인다.
    const shirt=new THREE.LatheGeometry(new THREE.SplineCurve([[.205,.12],[.258,.17],[.244,.28],[.198,.38],[.135,.452]].map(([x,y])=>new THREE.Vector2(x,y))).getPoints(16),48,Math.PI*.12,Math.PI*1.76);   // 앞(+Z)이 열린 앞섶
    const shirtMesh=add(body,shirt,SHIRT);shirtMesh.material.side=THREE.DoubleSide;
    for(const s of [-1,1]){const collar=add(body,new THREE.BoxGeometry(.075,.008,.05),SHIRT,s*.062,.462,.115);collar.rotation.set(-.6,s*.55,s*.5);}
    for(const [y,r] of [[.36,.215],[.29,.243],[.22,.252]])add(body,new THREE.CylinderGeometry(.008,.008,.004,12),BUTTON,-.37*r,y,.93*r+.004).rotation.x=Math.PI/2;
    // 팔: 어깨 → 팔꿈치 → 손. 오른손(+X)에 소주병.
    const arms=[-1,1].map(s=>{
      const shoulder=group(body,s*.205,.37,0,s<0?'DrunkBearArmL':'DrunkBearArmR');
      fur(shoulder,capsule(.066,.11,.06));add(shoulder,new THREE.SphereGeometry(.086,28,14,0,Math.PI*2,0,Math.PI*.58).scale(1,1.1,1),SHIRT,0,-.01,0);   // 볼록한 반팔 소매
      const elbow=group(shoulder,0,-.14,0);fur(elbow,capsule(.058,.08,.056));
      const paw=group(elbow,0,-.12,0);fur(paw,ellipsoid(.064,.06,.062));add(paw,ellipsoid(.038,.03,.012),PAD,0,-.01,.055);
      shoulder.rotation.z=s*.18;
      return {shoulder,elbow,paw};
    });
    // 머리 — 통통한 볼, 크림색 주둥이, 유리 같은 눈, 반쯤 감긴 눈꺼풀.
    const head=group(body,0,.6,.01,'DrunkBearHead');
    fur(head,ellipsoid(.225,.205,.2));                                   // 큰 동그란 머리
    for(const s of [-1,1])fur(head,ellipsoid(.1,.085,.09),s*.12,-.075,.075);
    const ears=[-1,1].map(s=>{const e=group(head,s*.15,.168,-.03);fur(e,ellipsoid(.06,.058,.035));add(e,ellipsoid(.037,.036,.01),INNER_EAR,0,-.004,.03);e.rotation.z=-s*.25;return e;});
    add(head,ellipsoid(.082,.06,.062),CREAM,0,-.075,.165);                // 작은 주둥이
    const nose=add(head,ellipsoid(.03,.021,.022),NOSE,0,-.052,.226);
    add(head,ellipsoid(.008,.0045,.004),SPARK,-.009,-.043,.246);
    const mouthClosed=group(head,0,-.104,.219);
    for(const s of [-1,1]){const arc=add(mouthClosed,new THREE.TorusGeometry(.018,.0032,8,16,Math.PI),MOUTH,s*.017,0,0);arc.rotation.z=Math.PI;}
    add(mouthClosed,new THREE.BoxGeometry(.003,.022,.003),MOUTH,0,.016,0);
    const mouthOpen=group(head,0,-.112,.205);add(mouthOpen,ellipsoid(.042,.034,.02),MOUTH);add(mouthOpen,ellipsoid(.026,.012,.012),TONGUE,0,-.018,.008);
    const eyes=[],lids=[];
    for(const s of [-1,1]){
      const eye=group(head,s*.085,.0,.19);add(eye,ellipsoid(.04,.046,.024),EYE);   // 크고 동그란 눈
      add(eye,ellipsoid(.013,.015,.005),SPARK,.01,.018,.022);add(eye,ellipsoid(.006,.006,.004),SPARK,-.012,-.017,.023);
      const lid=group(eye,0,0,0);add(lid,new THREE.SphereGeometry(.052,24,12,0,Math.PI*2,0,Math.PI/2),FUR);
      eyes.push(eye);lids.push(lid);
    }
    const blush=[-1,1].map(s=>{const b=add(head,ellipsoid(.05,.03,.01),BLUSH,s*.142,-.068,.172);b.rotation.y=s*.55;b.renderOrder=3;return b;});
    // 이마의 넥타이 머리띠 + 옆 매듭 + 늘어진 끝 2가닥
    const band=add(head,new THREE.TorusGeometry(.207,.016,10,64),TIE,0,.07,0);band.rotation.x=Math.PI/2+.12;band.scale.set(1.04,1,1.02);
    const knot=group(head,.18,.075,-.09);add(knot,ellipsoid(.03,.026,.024),TIE);
    const tails=[0,1].map(i=>{const t=group(knot,0,0,0);const tail=add(t,new THREE.PlaneGeometry(.05,.2),TIE,0,-.1,0);tail.material=TIE;t.rotation.set(.2,.9+i*.3,-.25-i*.35);return t;});
    // 소주병 — 초록 유리, 흰 라벨에 "소주"만. 실물 360mL(높이 21.5cm)를 1.25배로 키워 화면에서 읽히게 한다.
    const bottle=group(arms[1].paw,0,-.02,.06,'DrunkBearSojuBottle');bottle.scale.setScalar(1.25);
    const GLASS=new THREE.MeshPhysicalMaterial({color:0x3fae62,roughness:.08,metalness:0,clearcoat:1,transparent:true,opacity:.72});
    const LIQUID=new THREE.MeshStandardMaterial({color:0xdff5e6,roughness:.05,transparent:true,opacity:.55});
    const CAP=std(0x2f8f4e,.35,.6);
    const labelTex=canvasTexture(512,160,(g,w,h)=>{
      g.fillStyle='#fbfdfb';g.fillRect(0,0,w,h);g.fillStyle='#1d7a3f';g.fillRect(0,0,w,14);g.fillRect(0,h-14,w,14);
      g.font='900 96px "Malgun Gothic","Apple SD Gothic Neo",sans-serif';g.textAlign='center';g.textBaseline='middle';
      // 원통 u=0이 병 앞(+Z), u=.5가 뒤 — 앞뒤 정중앙에 한 번씩(이음매 넘는 글자는 양 끝에 나눠 그림)
      g.fillStyle='#1d7a3f';for(const x of [0,w*.5,w])g.fillText('소주',x,h/2+4);
    });
    const LABEL=new THREE.MeshStandardMaterial({map:labelTex,roughness:.6});
    materials.push(GLASS,LIQUID,CAP,LABEL);
    const glass=add(bottle,lathe([[.0,0],[.03,.002],[.031,.012],[.031,.12],[.027,.15],[.013,.18],[.012,.205],[0,.206]]),GLASS);glass.renderOrder=2;
    const liquid=add(bottle,new THREE.CylinderGeometry(.027,.027,.1,24),LIQUID,0,.058,0);
    add(bottle,new THREE.CylinderGeometry(.0315,.0315,.07,32,1,true),LABEL,0,.07,0);
    add(bottle,new THREE.CylinderGeometry(.0135,.0135,.016,20),CAP,0,.21,0);
    bottle.rotation.set(.35,0,-.3);
    // 머리 위 어지러움 별 5개
    const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.016:.038;i?starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r):starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
    const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:.008,bevelEnabled:false});
    const stars=group(head,0,.29,0,'DrunkBearDizzyStars');
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2,st=add(stars,starGeo,STAR,Math.cos(a)*.17,0,Math.sin(a)*.17);st.userData.a=a;}
    root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    const parts={root,rig,hips,body,head,legs,arms,eyes,lids,blush,mouthOpen,mouthClosed,bottle,liquid,stars,ears,tails,shadow};
    cache={root,parts,pose:p=>pose(parts,p),dispose(){root.parent?.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});noise.dispose();cache=null;}};
    return cache;
  }

  /* p: t(초) · walk(보행 위상) · sway(0~1 취기 흔들림) · kick(0~1 앞차기) · sit(0~1 엉덩방아)
        dizzy(0~1 별) · blush(0~1) · lids(0 뜸~1 감음) · mouth(0~1 벌림) · flail(0~1 허우적) · run(0~1 도움닫기) */
  function pose(q,p){
    const t=p.t||0,sway=p.sway||0,kick=p.kick||0,sit=p.sit||0,flail=p.flail||0,walk=p.walk||0,run=p.run||0;
    const wob=Math.sin(t*2.6)*sway,wob2=Math.sin(t*4.1+1.3)*sway;
    // 전신 — 술 취한 원 그리기 흔들림. 앉으면 엉덩이를 바닥으로.
    q.rig.position.set(wob*.06,0,0);q.rig.rotation.set(wob2*.05,0,wob*.16);
    q.hips.position.y=.365-sit*.27+Math.abs(Math.sin(walk))*.025*(1-sit);
    q.hips.rotation.set(0,wob*.12,0);
    // 앞차기(오른다리): 0~.45 무릎 접어 올림 → .45~.7 쭉 뻗음 → 이후 거둬들임
    const chamber=Math.min(1,kick/.45),extend=kick<.45?0:Math.min(1,(kick-.45)/.25),retract=kick<.8?0:(kick-.8)/.2;
    const kickThigh=-(chamber*1.15+extend*.4)*(1-retract*.85),kickKnee=chamber*1.5*(1-extend)*(1-retract)+retract*.35;
    q.legs.forEach((l,i)=>{
      const stride=Math.sin(walk+(i?Math.PI:0))*(.45+run*.4);
      let thigh=stride*(1-sit),knee=Math.max(0,-Math.sin(walk+(i?Math.PI:0)))*(.6+run*.5)*(1-sit);
      if(i===1&&kick>0){thigh=kickThigh;knee=kickKnee;}
      thigh=thigh*(1-sit)-sit*1.45;knee=knee*(1-sit)+sit*.12;
      l.thigh.rotation.set(thigh,0,(i?1:-1)*(.04+sit*.2));l.knee.rotation.x=knee;l.ankle.rotation.x=-knee*.4+sit*.3;
    });
    q.body.rotation.set(-extend*.32*(1-retract)+sit*-.18+run*.18,0,wob2*.08);
    // 팔: 병 든 오른팔 흔들기, 왼팔 균형. 넘어질 때 허우적.
    const swing=Math.sin(walk)*.35;
    q.arms[0].shoulder.rotation.set(swing*(1-flail)-flail*2.6+Math.sin(t*13)*flail*.3,0,-.18-.5*kick-flail*.4-sway*.15);
    q.arms[0].elbow.rotation.x=-.35-flail*.3;
    q.arms[1].shoulder.rotation.set(-swing*(1-flail)-.55-flail*2.2+Math.sin(t*12+1)*flail*.3+wob*.25,0,.2+.35*kick+flail*.35);
    q.arms[1].elbow.rotation.x=-.75+flail*.4;
    // 머리 — 흐느적
    q.head.rotation.set(-.08+wob2*.12+sit*.1,wob*.18,wob*.2);
    q.ears.forEach((e,i)=>e.rotation.x=Math.sin(t*5+i)*.08*sway);
    q.tails.forEach((g,i)=>g.rotation.x=.2+Math.sin(t*6+i)*.25*(sway+flail));
    const lids=Math.min(1,p.lids??.55);q.lids.forEach(l=>l.rotation.x=-1.75+lids*2.15);
    q.blush.forEach(b=>{b.material.opacity=.35+.6*(p.blush??.6);});
    const mouth=p.mouth||0;q.mouthOpen.visible=mouth>.05;q.mouthOpen.scale.set(.6+.4*mouth,.4+.8*mouth,1);q.mouthClosed.visible=!q.mouthOpen.visible;
    q.liquid.position.y=.058+Math.sin(t*7)*.004*sway;q.liquid.rotation.z=Math.sin(t*5)*.12*sway;
    const dizzy=p.dizzy||0;q.stars.visible=dizzy>.02;q.stars.scale.setScalar(Math.max(.01,dizzy));q.stars.rotation.y=t*3.2;
    q.stars.children.forEach(s=>{s.rotation.y=-t*3.2;s.position.y=Math.sin(t*6+s.userData.a*2)*.02;});
    q.shadow.visible=!(p.airborne);q.shadow.scale.setScalar(1+sit*.25);
  }
  return {create,get active(){return !!cache;}};
})();
