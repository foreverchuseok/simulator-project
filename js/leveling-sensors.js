/* 현장 20260911 사진: 카측 3단 포크 센서 + 층 고정 평판.
   전기 NO/NC나 제조사 제어 논리를 추정하지 않는다. blocked는 기하학적 차폐 상태다. */
const levelingSystem={sensors:[],vanes:[],position:new THREE.Vector3(),state:{floor:null,upper:false,middle:false,lower:false,atLevel:false,offsetM:null}};

function buildCarLevelingSensors(parent) {
  const g=new THREE.Group();g.name='carLevelingSensors';parent.add(g);
  const x=-CAR_RAIL_X+LCD_VANE_X_OFFSET, z=LCD_VANE_Z-CAR_CTR_Z, y=LCD_VANE_TOP_BEAM_LY;
  g.position.set(x,y,z);
  const steel=M.ss(0x89959f),black=M.paint(0x030405),white=M.paint(0xe5e3d8);
  black.clearcoat=0;black.roughness=0.85;
  function box(name,w,h,d,mat,px,py,pz,p=g){const m=createBox(w,h,d,mat,px,py,pz,p);m.name=name;return m;}
  // 센서 뒷면의 공용 세로 취부대와 조정 볼트.
  box('levelingSensorRack',0.065,2*LCD_SENSOR_PITCH+0.08,0.008,steel,0,0,0.087);
  levelingSystem.sensors.length=0;
  for(const [name,dy] of [['upper',LCD_SENSOR_PITCH],['middle',0],['lower',-LCD_SENSOR_PITCH]]) {
    const s=new THREE.Group();s.name='levelingSensor_'+name;s.position.y=dy;g.add(s);
    s.userData={type:'leveling-sensor',channel:name,blocked:false};
    // 실제 뚫린 슬롯. 차폐판은 X 두께 방향으로 양 턱 사이를 비접촉 통과한다.
    const jawT=0.018;
    for(const side of [-1,1]) {
      box('sensorJaw',jawT,0.038,0.100,steel,side*(LCD_SLOT_GAP/2+jawT/2),0,0.010,s);
      box('sensorBlackCover',0.002,0.021,0.094,black,side*(LCD_SLOT_GAP/2+jawT+0.001),-0.006,0.010,s);
      box('sensorOpticalFace',0.001,0.022,0.055,black,side*(LCD_SLOT_GAP/2+0.0005),0,-0.005,s);
    }
    box('sensorBack',LCD_SLOT_GAP+2*jawT,0.038,0.020,black,0,0,0.060,s);
    box('sensorMountTab',0.044,0.023,0.013,steel,0,0,0.077,s);
    for(const sx of [-0.018,0.018]) createCylinder(0.003,0.003,0.017,steel,sx,0,0.087,s).rotation.x=Math.PI/2;
    box('sensorNameplate',0.002,0.009,0.026,white,0.026,-0.006,-0.015,s);
    const ledMat=M.emit(0x220500,0.1);
    const led=createCylinder(0.0023,0.0023,0.002,ledMat,0.027,0.004,0.026,s);led.rotation.z=Math.PI/2;led.name='levelingLED_'+name;
    levelingSystem.sensors.push({name,node:s,led:ledMat});
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.008,dy,0.071),new THREE.Vector3(0.039,dy+0.023,0.108),
      new THREE.Vector3(0.045,dy,0.115),new THREE.Vector3(0.039,dy-0.018,0.106)]);
    const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,20,0.0025,6,false),black);wire.name='levelingSensorLead_'+name;g.add(wire);
    box('levelingWireTie',0.015,0.004,0.012,white,0.039,dy-0.018,0.106);
  }
  // 세 케이블 고리를 공용 세로 하니스로 묶어 하단 신호선까지 연결한다.
  const trunk=createCylinder(0.0035,0.0035,2*LCD_SENSOR_PITCH,black,0.039,-0.018,0.106,g);
  trunk.name='levelingSensorTrunk';
  // 톱빔 전면 웹 → 낮은 ㄱ자 암 → 센서 랙. 가이드슈/난간 베이스를 아래로 피한다.
  const attachX=-S.CAR_W/2+0.13-x, attachZ=0.095-z, footY=-LCD_SENSOR_PITCH-0.045;
  box('levelingBeamMount',0.065,0.13,0.008,steel,attachX,-0.045,attachZ);
  for(const dy of [-0.01,-0.08])createCylinder(0.005,0.005,0.018,steel,attachX,dy,attachZ+0.008,g).rotation.x=Math.PI/2;
  box('levelingBracketLongArm',0.040,0.010,0.087-attachZ,steel,attachX,footY,(attachZ+0.087)/2);
  box('levelingBracketCrossArm',attachX+0.04,0.010,0.040,steel,attachX/2,footY,0.087);
  box('levelingBracketRib',0.008,0.030,0.087-attachZ,steel,attachX-0.015,footY-0.010,(attachZ+0.087)/2);
  const junction=parent.getObjectByName('carCableJunction');
  if(junction){
    const p=junction.position;
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x+0.039,y-LCD_SENSOR_PITCH-0.018,z+0.106),
      new THREE.Vector3(x+0.05,y-0.12,z+0.16),new THREE.Vector3(p.x,y-0.08,p.z-0.1),new THREE.Vector3(p.x,p.y-0.12,p.z)]);
    const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,40,0.004,8,false),black);wire.name='levelingSignalHarness';parent.add(wire);
  }
  carSensors.leveling=g;
  elevatorState.leveling=levelingSystem.state;
  refreshLevelingSensors();
}

function registerLevelingVane(vane,floor) {
  vane.updateWorldMatrix(true,true);
  const bb=new THREE.Box3().setFromObject(vane.getObjectByName('VanePlate'));
  levelingSystem.vanes.push({floor,minY:bb.min.y,maxY:bb.max.y,minZ:bb.min.z,maxZ:bb.max.z,x:(bb.min.x+bb.max.x)/2});
  refreshLevelingSensors();
}

function refreshLevelingSensors() {
  if(!levelingSystem.sensors.length)return;
  const state=levelingSystem.state;
  state.floor=null;state.atLevel=false;state.offsetM=null;
  let nearest=null,dist=Infinity;
  const center=levelingSystem.sensors[1].node.getWorldPosition(levelingSystem.position).y;
  for(const vane of levelingSystem.vanes){const d=center-(vane.minY+vane.maxY)/2;if(Math.abs(d)<dist){dist=Math.abs(d);nearest=vane;state.offsetM=d;}}
  for(const sensor of levelingSystem.sensors){
    const p=sensor.node.getWorldPosition(levelingSystem.position);
    const blocked=!!nearest&&p.y>=nearest.minY&&p.y<=nearest.maxY&&p.z>=nearest.minZ&&p.z<=nearest.maxZ&&Math.abs(p.x-nearest.x)<(LCD_SLOT_GAP-LCD_VANE_T)/2;
    state[sensor.name]=blocked;sensor.node.userData.blocked=blocked;
    sensor.led.color.setHex(blocked?0xff3010:0x220500);sensor.led.emissive.setHex(blocked?0xff3010:0x220500);sensor.led.emissiveIntensity=blocked?1.6:0.1;
  }
  if(state.upper||state.middle||state.lower)state.floor=nearest.floor;
  state.atLevel=state.upper&&state.middle&&state.lower;
}
