// 부품설계 227p(CC27 바이패스 부저), 256p(에이프런). 치수 미기재 외형은 현재 카에 맞춘 재구성.
const CarUnderbody = (() => {
  let assembly, lens;
  const spec = Object.freeze({ apronHeight:0.75, thickness:0.002, toeLength:0.035, toeAngle:Math.PI/3,
    beaconWidth:0.16, beaconDepth:0.105, beaconHeight:0.095, period:0.65, pulse:0.28 });
  function build() {
    assembly=new THREE.Group();assembly.name='carUnderbody';carGrp.add(assembly);
    const steel=M.ss(0x929ca5), dark=M.paint(0x32383d), red=M.paint(0x950b0b);
    red.emissive.setHex(0xff0000);red.emissiveIntensity=0;red.toneMapped=false;
    const floor=CarDoor.dimensions().floor, front=HALL_SILL_SHAFT_Z-SILL_GAP-CAR_CTR_Z;
    const w=S.DOOR_W+0.10, z=front-spec.thickness/2, top=floor-0.01;
    const box=(name,w,h,d,mat,x,y,z,parent=assembly)=>{const o=createBox(w,h,d,mat,x,y,z,parent);o.name=name;return o;};
    const bolt=(x,y,z,parent=assembly)=>{const o=createCylinder(.005,.005,.003,steel,x,y,z,parent,6);o.rotation.x=Math.PI/2;o.name='apronFlushFastener';return o;};
    const apron=new THREE.Group();apron.name='carApron';assembly.add(apron);
    box('apronVertical',w,spec.apronHeight,spec.thickness,steel,0,top-spec.apronHeight/2,z,apron);
    const toe=box('apronToe',w,spec.toeLength,spec.thickness,steel,0,
      top-spec.apronHeight-spec.toeLength*Math.sin(spec.toeAngle)/2,
      z-spec.toeLength*Math.cos(spec.toeAngle)/2,apron);
    toe.rotation.x=Math.PI/2-spec.toeAngle;
    for(const x of [-w/2+.025,w/2-.025])box('apronSideReturn',.002,spec.apronHeight,.022,steel,x,top-spec.apronHeight/2,z-.012,apron);
    for(const x of [-w*.38,0,w*.38])bolt(x,top-.022,front+.0015,apron);
    // Drawing's two folded stays: rear platform attachment → lower apron back.
    for(const x of [-w*.30,w*.30]) {
      const ay=-S.CAR_H/2-.065, az=S.CAR_D/2-.30, by=top-.54, bz=z-.022;
      const dy=by-ay,dz=bz-az,len=Math.hypot(dy,dz);
      const stay=box('apronSupportStay',.035,len,.004,steel,x,(ay+by)/2,(az+bz)/2,apron);
      stay.rotation.x=Math.atan2(-dz,-dy);
      box('apronUpperBracket',.060,.004,.07,steel,x,ay,az,apron);
      box('apronLowerBracket',.060,.07,.004,steel,x,by,bz,apron);
      bolt(x,by,front+.0015,apron);
    }
    apron.userData={type:'car-apron',height:spec.apronHeight,width:w,front,top,toeAngle:60,reference:'부품설계 256'};
    const overload=carGrp.getObjectByName('carOverloadAssembly');
    const overloadBounds=new THREE.Box3().setFromObject(overload);
    const local=carGrp.worldToLocal(overloadBounds.getCenter(new THREE.Vector3()));
    const bz=(local.z+z)/2, by=-S.CAR_H/2-.115;
    const beacon=new THREE.Group();beacon.name='carBypassBeacon';beacon.position.set(0,by,bz);assembly.add(beacon);
    const platform=carGrp.getObjectByName('carPlatform').userData;
    const mountX=Math.min(...platform.stringerX.map(Math.abs));
    const spacerH=platform.bottomY-by-.002;
    box('beaconMountPlate',2*mountX+.06,.004,.17,steel,0,0,0,beacon);
    for(const x of [-mountX,mountX])box('beaconMountSpacer',.025,spacerH,.06,steel,x,.002+spacerH/2,0,beacon);
    for(const x of [-mountX,mountX]){const o=createCylinder(.006,.006,.006,steel,x,-.005,0,beacon,6);o.name='beaconMountBolt';}
    box('beaconBase',spec.beaconWidth+.008,.018,spec.beaconDepth+.008,dark,0,-.012,0,beacon);
    // Chamfered rectangular red lens, hanging down from its mounting plate (227p).
    const hw=spec.beaconWidth/2,hd=spec.beaconDepth/2,c=.018,shape=new THREE.Shape();
    [[-hw+c,-hd],[hw-c,-hd],[hw,-hd+c],[hw,hd-c],[hw-c,hd],[-hw+c,hd],[-hw,hd-c],[-hw,-hd+c]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth:spec.beaconHeight-.035,bevelEnabled:true,bevelThickness:.012,bevelSize:.008,bevelSegments:2,steps:1});
    lens=new THREE.Mesh(geom,red);lens.name='bypassRedLens';lens.rotation.x=Math.PI/2;lens.position.y=-.032;beacon.add(lens);
    for(const x of [-.055,0,.055])box('beaconLensRib',.002,.065,.108,dark,x,-.055,0,beacon);
    // 보강채널 옆으로 짧게 붙이고, 전면 외곽 채널을 따라 모서리 상승관에 합류.
    const q=CarWiring.layout,routeX=mountX+.032,edgeZ=q.frontLane-.10;
    CarWiring.run(assembly,'bypassCC27Lead',[[.09,by-.012,bz],[routeX,by-.012,bz],
      [routeX,q.underY,bz],[routeX,q.underY,edgeZ],[-q.outerX,q.underY,edgeZ],
      ...CarWiring.leftRiser('beacon',edgeZ)],{radius:.004});
    box('bypassCC27Connector',.022,.018,.014,dark,.09,by-.012,bz);
    beacon.userData={type:'bypass-alarm',connector:'CC27',active:false,lit:false,reference:'부품설계 227'};
    return assembly;
  }
  function flash(on,lit){if(!lens)return;lens.material.emissiveIntensity=lit?1.2:0;lens.material.color.setHex(lit?0xe50804:0x580202);const q=assembly.getObjectByName('carBypassBeacon');q.userData.active=on;q.userData.lit=lit;}
  return {spec,build,flash,get root(){return assembly;}};
})();

const DoorBypass = (() => {
  let mode='off',ctx,osc,gain,active=false,started=0,lastPulse=false;
  function unlockAudio(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();osc=ctx.createOscillator();gain=ctx.createGain();osc.type='triangle';osc.frequency.value=880;gain.gain.value=0;osc.connect(gain);gain.connect(ctx.destination);osc.start();}
    if(ctx.state==='suspended')ctx.resume().catch(console.error);
  }
  function stop(){active=false;lastPulse=false;if(gain){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(0,ctx.currentTime);}CarUnderbody.flash(false,false);}
  function setMode(next){
    if(!['off','hall','car'].includes(next)||moving||CarDoor.state?.busy||overspeedActive||estop)return false;
    unlockAudio();stop();mode=next;clearTimeout(autoTimer);
    if(next!=='off')setInspectionMode(true);
    document.getElementById('bypass-mode').value=mode;
    document.getElementById('bypass-status').textContent=mode==='off'?'BYPASS 해제':mode==='hall'?'BYPASS · 승장문':'BYPASS · 카문';
    if(typeof renderSegments==='function')renderSegments(); // HUD 세그먼트(시트·승장문 패널)도 같은 값을 보인다
    return true;
  }
  function carClosedMonitor(){const d=CarDoor.dimensions();return Math.abs(carDoorL.position.x+d.cx)<.001&&Math.abs(carDoorR.position.x-d.cx)<.001;}
  function hallSecured(){return hatchDoors.every(h=>h.interlock?.ready&&Math.abs(h.left.position.x-h.left.userData.cx)<.001&&Math.abs(h.right.position.x-h.right.userData.cx)<.001&&Math.abs(h.hook.rotation.z)<.001);}
  function canInspect(){return !CarDoor.state?.busy&&(mode==='car'?carClosedMonitor():CarDoor.secured())&&(mode==='hall'||hallSecured());}
  function update(now=performance.now()){
    const on=mode!=='off'&&insMode&&moving&&insDir!==0&&!estop&&!document.hidden;
    if(!on){if(active)stop();return;}
    if(!active){active=true;started=now;}
    const pulse=(now-started)%(CarUnderbody.spec.period*1000)<CarUnderbody.spec.pulse*1000;
    if(pulse!==lastPulse){lastPulse=pulse;if(gain){const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(pulse?.07:0,t,.008);}CarUnderbody.flash(true,pulse);}
  }
  function bind(){document.getElementById('bypass-mode').addEventListener('change',e=>{if(!setMode(e.target.value))e.target.value=mode;});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(insDir)insStop();stop();}});window.addEventListener('pagehide',stop);}
  return {setMode,canInspect,hallSecured,carClosedMonitor,update,stop,bind,unlockAudio,get mode(){return mode;},get active(){return active;},get audioState(){return {context:ctx?.state||'uninitialized',frequency:osc?.frequency.value||0,gain:gain?.gain.value||0};}};
})();
