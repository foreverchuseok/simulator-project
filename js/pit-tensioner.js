/* Shared model contract; Blender reads this JSON. Axle position/rope routes remain in environment.js. */
const PIT_TENSIONER_SPEC = Object.freeze({"ropeRadius":0.15,"switchCenter":[0.11,0.07,0.12],"plungerTop":0.147,"strikerBottom":0.165,"cableExit":[0.11,0.003,0.12]});

function buildPitTensioner(parent, x, y, z) {
  const mount = new THREE.Group(); mount.name = 'PitTensionerMount';
  mount.position.set(x,y,z); parent.add(mount);
  const spin = new THREE.Group(); spin.name = 'PitTensionSheaveSpin'; mount.add(spin);
  tensionSheaveGrp = spin;
  const steel = M.ss(0x9ba4a1);
  // The support reaches the existing rail; the moving weight is carried by its rope/yoke.
  const railX=S.CAR_BG/2-x, railZ=CAR_CTR_Z-z;
  createBox(.055,.31,.012,steel,railX,-.20,railZ+.026,mount);
  createBox(.014,.055,railZ-.235+.026,steel,.075,-.31,(railZ+.026+.235)/2,mount);
  createBox(.075-railX+.028,.055,.035,steel,(.075+railX)/2,-.31,railZ+.026,mount);
  for(const yy of [-.08,-.30]) {
    const bolt=createCylinder(.008,.008,.018,steel,railX,yy,railZ+.037,mount);
    bolt.rotation.x=Math.PI/2;
  }
  new THREE.GLTFLoader().load('models/gltf/pit_tensioner.glb', gltf => {
    const root=gltf.scene.getObjectByName('PitTensioner'),wheel=gltf.scene.getObjectByName('TensionSheave');
    if(!root||!wheel||Math.abs(root.userData.ropeRadius-(mrGrp.userData.govR||.15))>1e-6||
       Object.keys(PIT_TENSIONER_SPEC).some(k=>JSON.stringify(root.userData[k])!==JSON.stringify(PIT_TENSIONER_SPEC[k]))) {
      console.error('Pit tensioner model/rope contract mismatch');return;
    }
    mount.add(gltf.scene); spin.attach(wheel);
    mount.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=true;o.receiveShadow=true;
      if(o.material.metalness>.5){o.material.envMap=getGovernorMetalEnvironment();o.material.envMapIntensity=.9;}
    });
    const sw=gltf.scene.getObjectByName('TensionSwitch');
    sw.userData={...sw.userData,type:'governor-tension-switch',visualOnly:true};
    mount.userData.ready=true;
  },undefined,e=>console.error('Pit tensioner GLB failed',e));
  // Bottom gland -> fixed guide -> pit perimeter. No cable across the viewing area.
  const e=PIT_TENSIONER_SPEC.cableExit, wall=S.SHAFT_W/2-.026, floor=Y0+.027;
  const pts=[new THREE.Vector3(x+e[0],y+e[1],z+e[2]),
    new THREE.Vector3(x+e[0],y-.31,z+e[2]),new THREE.Vector3(wall,y-.31,z+e[2]),
    new THREE.Vector3(wall,floor+.045,z+e[2]),new THREE.Vector3(wall,floor,z+e[2]+.045),
    new THREE.Vector3(wall,floor,SHAFT_BACK_Z+.045)];
  const path=new THREE.CurvePath();for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));
  const wire=new THREE.Mesh(new THREE.TubeGeometry(path,64,.003,8,false),M.paint(0x272b2d));
  wire.name='PitTensionSwitchCable';parent.add(wire);
  // Sealed termination on the floor perimeter, keeping a visible physical cable destination.
  createBox(.034,.037,.055,M.paint(0x545a5d),wall,floor+.012,SHAFT_BACK_Z+.045,parent).name='PitTensionSwitchJunction';
  for(const yy of [y-.35,Y0+.13])createBox(.012,.009,.020,steel,wall,yy,z+e[2],parent);
  return mount;
}
