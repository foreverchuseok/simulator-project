// UCM 전용 연출. 파지 효과는 실제 턱 접촉 콜백에서만 시작한다.
// 사용자 제공 10.7.5 / 그림 20의 상승 장면. 비율이나 시연 실측값을 기준값으로 표기하지 않는다.
const UCM_STOP_GUIDE = '상승 개문발차 정지 기준 · 10.7.5\n가) 승강장 기준 정지거리 1.2 m 이하.\n나) 승강장문 문턱~카 에이프런 최하단 수직거리 200 mm 이하.\n라) 카 문턱~승강장문 상인방 수직거리 1 m 이상.';
const UCMEffects = (() => {
  let banner, title, subtitle, summary, exit, dust, dustTween, shake;
  const frames = new Map();
  function build() {
    if (banner) return;
    const style = document.createElement('style');
    style.textContent = `
      .ucm-active .part-action,.ucm-active #hall-panel,.ucm-active #inspection-drive,.ucm-active #rail,.ucm-active #mobile-visibility{visibility:hidden!important}
      .ucm-active #fbtns,.ucm-active #btn-open,.ucm-active #btn-close{display:none!important}
      #ucm-impact{position:fixed;inset:0;z-index:35;pointer-events:none;opacity:0;background:radial-gradient(ellipse,transparent 45%,#661c1238)}
      #ucm-impact div{position:absolute;top:24%;left:5%;right:5%;text-align:center;color:#fff0d7;text-shadow:0 3px 0 #612614,0 0 22px #301509}
      #ucm-impact strong{display:block;font:950 clamp(30px,5.4vw,76px)/1.12 sans-serif;letter-spacing:-.055em}
      #ucm-impact small{display:block;margin-top:12px;font:700 clamp(12px,1.5vw,19px)/1.5 sans-serif;color:#ffd6a5}
      #ucm-impact[data-kind=grip] div{top:19%}
      #ucm-exit{position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:121;min-height:44px;padding:10px 18px;border:1px solid #a5bcbd;border-radius:12px;background:#172b36ed;color:white;font:700 13px sans-serif;cursor:pointer}
      #ucm-exit[hidden],#ucm-summary[hidden]{display:none}
      #ucm-summary{position:fixed;inset:16% 6% 15%;z-index:120;display:flex;flex-direction:column;gap:16px;padding:22px;background:#0d1c29f5;color:#f0f6fa;border:1px solid #70858c;border-radius:16px;box-shadow:0 18px 80px #0009;font:14px/1.5 sans-serif}
      #ucm-summary h2{margin:0;font-size:23px}#ucm-summary p{margin:4px 0 0;color:#b1c9d2;white-space:pre-line;word-break:keep-all}
      #ucm-summary .ucm-scenes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;flex:1;min-height:0}
      #ucm-summary figure{margin:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#192b39;border:1px solid #425b6b;border-radius:10px}
      #ucm-summary img{width:100%;height:0;flex:1;min-height:0;object-fit:cover;background:#bfc8cf}
      #ucm-summary figcaption{padding:12px;font-weight:800;word-break:keep-all}#ucm-summary figcaption small{display:block;font-weight:400;color:#afc6d3}
      @media(max-width:600px){
        #ucm-impact div{top:28%}#ucm-impact[data-kind=grip] div{top:24%}
        #ucm-exit{left:auto;right:10px;transform:none;max-width:142px;padding:8px 12px}
        #ucm-summary{inset:15% 10px 15%;padding:12px;gap:10px}#ucm-summary h2{font-size:19px}#ucm-summary p{font-size:11px}
        #ucm-summary .ucm-scenes{grid-template-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr));gap:8px}
        #ucm-summary figure{flex-direction:row}#ucm-summary img{width:53%;height:100%;flex:none}#ucm-summary figcaption{padding:8px;align-self:center;font-size:12px}#ucm-summary figcaption small{font-size:10px}
        #ucm-stage{font-size:12px!important;padding:8px 12px!important;max-width:90vw!important;width:max-content;box-sizing:border-box}
      }
      @media(prefers-reduced-motion:reduce){#ucm-impact{background:none}}
    `;
    document.head.appendChild(style);
    banner = document.createElement('div'); banner.id = 'ucm-impact'; banner.setAttribute('role', 'status');
    const text = document.createElement('div'); title = document.createElement('strong'); subtitle = document.createElement('small');
    text.append(title, subtitle); banner.append(text); document.body.append(banner);
    exit = document.createElement('button'); exit.id = 'ucm-exit'; exit.type = 'button'; exit.hidden = true;
    exit.textContent = '종료 · 정상 복귀'; exit.onclick = () => UCMDemo.reset(); document.body.append(exit);
    summary = document.createElement('section'); summary.id = 'ucm-summary'; summary.hidden = true;
    summary.setAttribute('aria-label', '로프브레이크 시연 세 장면');
    summary.innerHTML = '<header><h2>로프 파지 · 카 정지</h2><p></p></header><div class="ucm-scenes"></div>';
    document.body.append(summary);
    // 짧은 먼지는 접촉면 양 끝으로만 퍼진다. 로프와 턱 중심은 가리지 않는다.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,'rgba(255,255,255,.7)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,32,32);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    dust = new THREE.Points(geometry, new THREE.PointsMaterial({map:new THREE.CanvasTexture(canvas),color:0xbfb4a1,size:.026,transparent:true,opacity:0,depthWrite:false}));
    dust.name = 'UCMGripDust'; dust.visible = false; dust.frustumCulled = false;
    scene.getObjectByName('RopeBrake')?.add(dust);
  }
  function prepare() { build(); clear(); document.body.classList.add('ucm-active'); exit.hidden = false; }
  function hit(kind, heading, note) {
    title.textContent = heading; subtitle.textContent = note; banner.dataset.kind = kind;
    gsap.killTweensOf(banner); gsap.killTweensOf(title);
    banner.style.opacity = '1';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) gsap.fromTo(title, {scale:1.12}, {scale:1,duration:.22,ease:'power3.out'});
    gsap.to(banner, {opacity:0,delay:kind === 'failure' ? .9 : .45,duration:.3});
    shake?.cancel();
    if (!reduced) shake = renderer.domElement.animate([
      {transform:'translate(0,0)'},{transform:'translate(-7px,4px)'},{transform:'translate(5px,-3px)'},
      {transform:'translate(-3px,2px)'},{transform:'translate(0,0)'}
    ], {duration:kind === 'grip' ? 210 : 160,easing:'ease-out'});
  }
  function grip() {
    hit('grip', '팍! 로프 파지', '로프브레이크 작동 → 카 제동');
    dust.visible = true;
    const state = {t:0}; dustTween?.kill();
    dustTween = gsap.to(state, {t:1,duration:.65,ease:'none',onUpdate:() => {
      const t = state.t, pos = dust.geometry.attributes.position;
      for (let i=0;i<48;i++) {
        const side = i % 2 ? 1 : -1, spread = (i % 11) / 11;
        pos.setXYZ(i, side * (.115 + t * (.035 + spread * .045)), .008 + t * (.025 + spread * .035), -.15 + Math.sin(i * 2.4) * .02 - t * .06);
      }
      pos.needsUpdate = true; dust.material.opacity = .32 * (1-t); dust.material.size = .026 + t * .025;
    },onComplete:() => { dust.visible = false; }});
  }
  function capture(key) {
    controls.update(); scene.updateMatrixWorld(true); renderer.render(scene, camera);
    const src = renderer.domElement, canvas = document.createElement('canvas');
    const size = Math.min(src.width, src.height);
    canvas.width = canvas.height = Math.min(640, size);
    canvas.getContext('2d').drawImage(src,(src.width-size)/2,(src.height-size)/2,size,size,0,0,canvas.width,canvas.height);
    frames.set(key, canvas.toDataURL('image/jpeg', .86));
  }
  function finish() {
    summary.querySelector('p').textContent = UCM_STOP_GUIDE;
    const scenes = summary.querySelector('.ucm-scenes'); scenes.replaceChildren();
    for (const [key,heading,note] of [
      ['failure','01 · 주브레이크 고장','탑승 순간 제동 기능 상실'],
      ['departure','02 · 개문발차','열린 문 · 벌어진 문턱 단차'],
      ['grip','03 · 로프브레이크 파지','턱 접촉 → 제동 → 카 정지']
    ]) {
      const fig=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption'),small=document.createElement('small');
      img.src=frames.get(key); img.alt=heading; cap.textContent=heading; small.textContent=note;
      cap.append(small); fig.append(img,cap); scenes.append(fig);
    }
    summary.hidden = false;
    document.getElementById('ucm-stage').hidden = true;
  }
  function clear() {
    frames.clear(); dustTween?.kill(); if (dust) { dust.visible=false; dust.material.opacity=0; }
    if (summary) { summary.hidden=true; summary.querySelector('.ucm-scenes').replaceChildren(); }
    if (exit) exit.hidden=true;
    if (banner) { gsap.killTweensOf(banner); gsap.killTweensOf(title); banner.style.opacity=0; }
    shake?.cancel();
  }
  return {prepare,hit,grip,capture,finish,clear};
})();
