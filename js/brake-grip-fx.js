// 주브레이크 시연의 표시 전용 강조. 실제 GLB 암·슈를 따라가며 물리·피벗·원본 재질은 건드리지 않는다.
// ES_simmul의 정상/고장 부품 윤곽 강조를 참고한다. 제동 유지는 새 체결로 연출하지 않는다.
const BrakeGripFX = (() => {
  const colors = { held:0x19bfa5, lost:0xff624e };
  const resolution = new THREE.Vector2(1,1), projected = new THREE.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let machine, sides = [], phase = '', elapsed = 0, lastTime = 0;
  function material(outline) {
    const m = M.emit(colors.held, 1);
    Object.assign(m,{transparent:true,opacity:0,depthWrite:false,depthTest:outline,toneMapped:false,side:outline?THREE.BackSide:THREE.DoubleSide});
    m.color.setHex(0); m.emissive.convertSRGBToLinear();
    m.userData.gripWidth = {value:2.5};
    if (outline) m.onBeforeCompile = shader => {
      shader.uniforms.gripResolution = {value:resolution}; shader.uniforms.gripWidth = m.userData.gripWidth;
      shader.vertexShader = 'uniform vec2 gripResolution; uniform float gripWidth;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec2 gripDirection = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy * gripResolution;
        float gripLength = length(gripDirection);
        if (gripLength > 0.00001) gl_Position.xy += gripDirection / gripLength * gripWidth * 2.0 / gripResolution * gl_Position.w;`);
    };
    return m;
  }
  function prepare(t) {
    if (machine === t) { clear(); return; }
    machine = t;
    const css = document.createElement('style');
    css.textContent = '.brake-grip-tag{position:fixed;z-index:116;pointer-events:none;white-space:nowrap;padding:4px 7px;border:1px solid #37cbb5;border-radius:6px;background:#e8fff8ed;color:#086855;font:700 11px/16px sans-serif;box-shadow:0 2px 8px #102e2720}.brake-grip-tag[data-contact=lost]{color:#a42b1b;background:#fff0ebef;border-color:#ff7764}.brake-grip-tag[hidden]{display:none!important}';
    document.head.append(css);
    sides = t.arms.map((arm,index) => {
      const fill = material(false), outline = material(true), sources = [], meshes = [];
      arm.traverse(o => {
        if (!o.isMesh) return;
        const name = o.material?.name;
        if (['TM_BrakeLining','TM_DarkGrayPaint','TM_GrayPaint'].includes(name)) sources.push(o);
      });
      const lining = sources.find(o => o.material.name === 'TM_BrakeLining');
      if (!lining) throw new Error('주브레이크 라이닝 노드를 찾을 수 없습니다.');
      for (const source of sources) {
        const materials = source.material.name === 'TM_GrayPaint' ? [outline] : [fill,outline];
        for (const mat of materials) {
          const mesh = new THREE.Mesh(source.geometry,mat);
          mesh.name = `BrakeGrip${index?'R':'L'}${mat===fill?'Fill':'Outline'}`;
          mesh.userData.brakeTeachingFX = true; mesh.renderOrder = mat===fill?40:39;
          mesh.raycast = () => {}; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = false;
          source.add(mesh); meshes.push(mesh);
        }
      }
      lining.geometry.computeBoundingBox();
      const tag = document.createElement('div'); tag.className = 'brake-grip-tag'; tag.hidden = true;
      tag.id = `brake-grip-${index?'right':'left'}`; document.body.append(tag);
      return {fill,outline,meshes,lining,anchor:lining.geometry.boundingBox.getCenter(new THREE.Vector3()),tag,index,contact:''};
    });
    clear();
  }
  function clear() {
    phase = ''; elapsed = 0; lastTime = performance.now()/1000;
    for (const side of sides) { side.meshes.forEach(m=>m.visible=false); side.tag.hidden=true; side.contact=''; }
  }
  function update(state) {
    if (!sides.length) return;
    const now = performance.now()/1000, dt = Math.min(.1,Math.max(0,now-lastTime)); lastTime=now;
    if (!state.active || state.stage === 'preparing' || state.stage === 'resetting') { if(phase)clear(); return; }
    const next = state.stage === 'holding' ? 'holding' : 'fault';
    if (phase !== next) { phase=next; elapsed=0; }
    if (!DemoPause.paused) elapsed += dt;
    resolution.set(innerWidth,innerHeight);
    const pulse = reduced.matches || elapsed>1.1 ? 0 : (1-elapsed/1.1)*(.55+.45*Math.cos(elapsed*Math.PI*5));
    camera.updateMatrixWorld();
    for (const side of sides) {
      const lost = phase==='fault' && (state.mode==='single' || side.index===0);
      const contact = lost?'lost':'held', flash = phase==='holding'||lost ? pulse : 0;
      if (side.contact!==contact) {
        side.contact=contact;
        for (const mat of [side.fill,side.outline]) mat.emissive.setHex(colors[contact]).convertSRGBToLinear();
        side.tag.dataset.contact=contact;
      }
      const label = (side.index?'우':'좌')+' · '+(lost?'제동력 상실':phase==='holding'?'제동 중':'제동 유지');
      if (side.tag.textContent!==label) side.tag.textContent=label;
      side.fill.opacity=.26+flash*.30; side.outline.opacity=.78+flash*.20;
      side.outline.userData.gripWidth.value=2.5+flash*2.5;
      side.meshes.forEach(m=>{if(!m.visible)m.visible=true;});
      side.lining.updateWorldMatrix(true,false);
      projected.copy(side.anchor).applyMatrix4(side.lining.matrixWorld).project(camera);
      const inside = projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1;
      if(side.tag.hidden===inside)side.tag.hidden=!inside;
      if (inside) {
        const x=(projected.x+1)*innerWidth/2, y=(1-projected.y)*innerHeight/2;
        const left = side.index ? x+14 : x-side.tag.offsetWidth-14;
        const sx=Math.round(Math.max(8,Math.min(innerWidth-side.tag.offsetWidth-8,left)))+'px';
        const sy=Math.round(Math.max(72,Math.min(innerHeight-side.tag.offsetHeight-82,y-side.tag.offsetHeight/2)))+'px';
        if(side.tag.style.left!==sx)side.tag.style.left=sx;
        if(side.tag.style.top!==sy)side.tag.style.top=sy;
      }
    }
    const [a,b]=sides.map(s=>s.tag.getBoundingClientRect());
    if (!sides[0].tag.hidden&&!sides[1].tag.hidden&&a.left<b.right+6&&a.right+6>b.left&&a.top<b.bottom+6&&a.bottom+6>b.top) {
      const top=Math.max(72,b.top-a.height-8)+'px';
      if(sides[0].tag.style.top!==top)sides[0].tag.style.top=top;
    }
  }
  return {prepare,update,clear};
})();
