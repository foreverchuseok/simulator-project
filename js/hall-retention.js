// Lower landing-door retention shoe, behind the ordinary groove. Blender reads this contract.
const HALL_RETENTION = {"bladeW":0.19,"plateW":0.21,"plateTop":0.044,"plateBottom":0.007,"bladeBottom":-0.012,"bladeTop":0.007,"bridgeY":0.009,"bridgeT":0.004,"plateT":0.0035};
const HallRetention=(()=>{
  let source;const pending=[],devices=[];
  function mount(job){
    const {parent,x,z,zBack,grooveWidth,grooveDepth,runLength,panelTop}=job,s=source.userData;
    if(Math.abs(zBack-z-s.backZ)>1e-6||Math.abs(grooveWidth-s.grooveWidth)>1e-6){console.error('Hall retention sill contract mismatch');return;}
    const d=source.clone();d.name='HallRetentionDevice';d.position.set(x,0,z);
    d.userData={...s,type:'hall-door-retention',runLength,grooveDepth,panelTop};parent.add(d);devices.push(d);
  }
  new THREE.GLTFLoader().load('models/gltf/hall_door_retention.glb',gltf=>{
    source=gltf.scene.getObjectByName('HallRetentionModel');
    if(!source||Object.keys(HALL_RETENTION).some(k=>Math.abs(source.userData[k]-HALL_RETENTION[k])>1e-6)){console.error('Hall retention GLB contract mismatch');return;}
    source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});pending.splice(0).forEach(mount);
  },undefined,e=>console.error('Hall retention GLB load failed',e));
  return {devices,attach(job){source?mount(job):pending.push(job);}};
})();
