// 정전 시 조명장치와 비상등 2개. 모델 치수는 Blender GLB extras가 원본이다.
// 상부 아이콘은 비상등 점등 시험만 수행한다. 운행 FSM/기존 조명 회로와 독립적이다.
const EmergencyLighting=(()=>{
  const lamps=[],ledMaterials=[],halos=[],lights=[];
  const point=new THREE.Vector3(),local=new THREE.Vector3();
  const ICON='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="m13 8-3 5h4l-1 3M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg>')+'")';
  let ready=false,on=false,power,button,statusMaterial,haloTexture,built=false;
  function glowTexture(){
    if(haloTexture)return haloTexture;
    const c=document.createElement('canvas');c.width=c.height=128;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(230,246,255,.75)');g.addColorStop(.28,'rgba(210,237,255,.4)');g.addColorStop(1,'rgba(200,230,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return haloTexture=new THREE.CanvasTexture(c);
  }
  function prepare(model){model.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=true;
    if(o.material.transparent){o.material.depthWrite=false;o.renderOrder=2;}
  });}
  function lamp(model,parent,name,position,rotation){
    const g=new THREE.Group();g.name=name;g.position.set(...position);g.rotation.x=rotation;
    g.userData={type:'emergency-lamp',lit:false};parent.add(g);g.add(model);prepare(model);lamps.push(g);
    const spec=model.getObjectByName('EmergencyRoundLamp').userData;
    const led=M.emit(0xe4f3ff,0);led.color.setHex(0xffefb1);led.roughness=.35;led.toneMapped=false;
    model.getObjectByName('LampLEDs').traverse(o=>{if(o.isMesh)o.material=led;});ledMaterials.push(led);
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(spec.radius*4,spec.radius*4),new THREE.MeshBasicMaterial({
      map:glowTexture(),transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    halo.name='emergencyLampGlow';halo.position.z=spec.depth+.002;halo.visible=false;halo.renderOrder=3;g.add(halo);halos.push(halo);
    const light=new THREE.PointLight(0xe0f0ff,0,1.5,2);light.name='emergencyLampLight';light.position.z=spec.depth+.035;
    light.castShadow=false;g.add(light);lights.push(light);
    return g;
  }
  function apply(){
    ledMaterials.forEach(m=>{m.emissiveIntensity=on?4.8:0;m.color.setHex(on?0xffffff:0xffefb1);});
    halos.forEach(h=>h.visible=on);lights.forEach(l=>l.intensity=on?1.1:0);
    lamps.forEach(l=>l.userData.lit=on);
    if(statusMaterial){statusMaterial.emissiveIntensity=on?1.4:.15;statusMaterial.color.setHex(on?0x48c870:0x34864a);}
    if(button){button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));
      const label=`카상부·카내 비상등 ${on?'끄기':'켜기'}`;button.setAttribute('aria-label',label);button.title=label;}
  }
  function toggle(){if(!ready)return false;on=!on;apply();return true;}
  function wire(parent,name,points){CarWiring.run(parent,name,points,{radius:.0022,bend:.018});}
  async function build(){
    if(built)return;built=true;
    const loader=new THREE.GLTFLoader(),load=url=>new Promise((resolve,reject)=>loader.load(url,g=>resolve(g.scene),undefined,reject));
    try{
      const [unit,round]=await Promise.all([load('models/gltf/emergency_power_unit.glb'),load('models/gltf/emergency_round_lamp.glb')]);
      const spec=unit.getObjectByName('EmergencyPowerUnit')?.userData,lampSpec=round.getObjectByName('EmergencyRoundLamp')?.userData;
      if(!spec?.width||!lampSpec?.radius||!round.getObjectByName('LampLEDs'))throw new Error('Emergency lighting GLB contract missing');
      const topBox=carGrp.getObjectByName('carTopBox'),top=topBox.getObjectByName('carTopBoxTop');
      const roof=carGrp.getObjectByName('roofDeck'),roofY=roof.position.y+roof.geometry.parameters.height/2;
      const topY=top.position.y+top.geometry.parameters.height/2;
      power=new THREE.Group();power.name='EmergencyLightingPower';power.userData={type:'emergency-light-power',ready:false};
      power.position.set(topBox.position.x+.24,roofY+.003,topBox.position.z-.045);
      power.rotation.set(-Math.PI/2,0,Math.PI/2);carGrp.add(power);power.add(unit);prepare(unit);
      statusMaterial=M.emit(0x34864a,.15);unit.getObjectByName('PowerStatus').traverse(o=>{if(o.isMesh)o.material=statusMaterial;});
      lamp(round.clone(true),topBox,'EmergencyLampCarTop',[0,topY+.002,.102],-Math.PI/2);
      const ceiling=carGrp.getObjectByName('terraceCeiling');
      const width=(S.CAR_W/2-.04)*2-.025;
      const x=-width*TERRACE_CEILING.centerWidth/2+lampSpec.radius+.035;
      const y=ceiling.position.y-TERRACE_CEILING.drop+.014+TERRACE_CEILING.stepRise*(TERRACE_CEILING.steps-1)-.008-.001;
      const z=CarWiring.layout.frontZ-.30;
      lamp(round,carGrp,'EmergencyLampCabin',[x,y,z],Math.PI/2);
      // 장치 출구 → 카탑박스 하부 인입구, 원형등 → 박스 옆면. 카내 배선은 천장 위로 통과한다.
      carGrp.updateMatrixWorld(true);
      const exit=carGrp.worldToLocal(power.localToWorld(new THREE.Vector3(...spec.cableExit)));
      const entry=topBox.userData.entryHole.center,ry=CarWiring.layout.roofY;
      wire(carGrp,'emergencyPowerFeed',[exit.toArray(),[exit.x,ry,exit.z],[entry[0]+.045,ry,entry[2]],[entry[0]+.045,entry[1]-.08,entry[2]],entry]);
      const lampTop=lamps[0].position,sideZ=topBox.position.z+.205;
      wire(carGrp,'emergencyTopLampWire',[[topBox.position.x,topBox.position.y+lampTop.y,topBox.position.z+lampTop.z],
        [topBox.position.x,topBox.position.y+lampTop.y,sideZ],[topBox.position.x,entry[1]-.04,sideZ],[entry[0],entry[1]-.04,entry[2]],entry]);
      wire(carGrp,'emergencyCabinLampWire',[[x,y,z],[x,ry,z],[entry[0]+.07,ry,z],[entry[0]+.07,ry,entry[2]],
        [entry[0]+.07,entry[1]-.07,entry[2]],entry]);
      button=document.createElement('button');button.type='button';button.id='emergency-light-action';button.className='part-action';button.hidden=true;
      button.style.setProperty('--part-icon',ICON);button.addEventListener('click',toggle);document.getElementById('part-actions').appendChild(button);
      PartGlow.bind(button,()=>power,'비상조명 전원장치');
      power.userData.ready=true;ready=true;apply();
    }catch(e){console.error('[emergency lighting] build failed',e);}
  }
  function update(){
    if(!ready)return;
    point.set(0,-power.getObjectByName('EmergencyPowerUnit').userData.height/2-.09,.035);power.localToWorld(point);
    local.copy(camera.position);carGrp.worldToLocal(local);
    let shown=PartActions.iconsVisible&&local.y>S.CAR_H/2+.08&&camera.position.distanceToSquared(point)<36;
    for(let p=power;p&&shown;p=p.parent)if(!p.visible)shown=false;
    if(shown){point.project(camera);shown=point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;}
    button.hidden=!shown;
    if(shown)PartActions.positionButton(button,(point.x+1)*innerWidth/2-22,(1-point.y)*innerHeight/2-22);
  }
  return {build,update,toggle,lamps,get power(){return power;},get ready(){return ready;},get on(){return on;}};
})();
