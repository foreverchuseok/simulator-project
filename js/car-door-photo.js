// 현장 사진 20260929_132815/132819/132840. Python이 이 JSON을 읽는다.
const CAR_DOOR_PHOTO = {"width":0.024,"depth":0.018,"endInset":0.020,"gap":0.008,"mountZ":0.026,"glandHeight":0.012,"lensPitch":0.100};
const CarDoorPhoto = (() => {
  let source;
  const pending=[];
  function apply({root,height,role}) {
    const model=source.getObjectByName('Photo'+role).clone(true);
    if(Math.abs(source.userData.height-height)>1e-6)throw new Error('Car photo sensor height contract mismatch');
    root.add(model);root.userData.ready=true;
  }
  function mount(parent,side,d) {
    const p=CAR_DOOR_PHOTO,role=side<0?'Tx':'Rx',height=d.top-d.bottom-2*p.endInset;
    const root=new THREE.Group();root.name='multiBeam'+role;
    root.position.set(-side*(d.cx-p.gap/2-p.width/2),(d.top+d.bottom)/2,d.doorZ+p.mountZ);
    root.userData={type:'door-light-curtain',visualOnly:true,role,height,ready:false,opticalDirection:-side};parent.add(root);
    const job={root,height,role};source?apply(job):pending.push(job);
    return root;
  }
  function load() {
    new THREE.GLTFLoader().load('models/gltf/car_door_photo_sensor.glb?v=20261002-field',gltf=>{
      source=gltf.scene.getObjectByName('CarDoorPhotoModel');
      if(!source||Object.keys(CAR_DOOR_PHOTO).some(k=>Math.abs(source.userData[k]-CAR_DOOR_PHOTO[k])>1e-6)){
        console.error('Car photo sensor GLB contract mismatch');return;
      }
      source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      pending.splice(0).forEach(apply);
    },undefined,e=>console.error('Car photo sensor GLB load failed',e));
  }
  load();return {mount};
})();
