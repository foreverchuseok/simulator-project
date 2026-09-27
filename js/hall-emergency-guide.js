// SUS304 folded keeper: Blender dimensions are read from GLB extras.
const HallEmergencyGuide=(()=>{
  let source;const pending=[],guides=[],plateGeometries=new Map();
  function mount({parent,side,g,floor}){
    const spec=source.userData,guide=source.clone();
    guide.name=`HallEmergencyGuide_${floor+1}_${side>0?'R':'L'}`;
    guide.position.set(side*spec.mountX,g.caseCY,g.plateZ);
    guide.userData={...spec,type:'hall-emergency-guide',floor,side,ready:true,rail:g};
    // Local relief in the upper plate edge exposes the folded neck, as in the
    // reference. Keep the rope terminal windows and all lower mounting points.
    const plate=parent.getObjectByName('hallHangerPlate');
    if(!plateGeometries.has(side)){
      const x=side*spec.mountX,half=spec.width/2+.002,top=.080,notch=spec.bridgeY-.005+.040;
      const shape=new THREE.Shape();
      shape.moveTo(-.190,-.080);shape.lineTo(.190,-.080);shape.lineTo(.190,top);
      shape.lineTo(x+half,top);shape.lineTo(x+half,notch);shape.lineTo(x-half,notch);shape.lineTo(x-half,top);shape.lineTo(-.190,top);shape.closePath();
      for(const w of parent.userData.windows||[]){const hole=new THREE.Path();hole.moveTo(w.x0,w.y0);hole.lineTo(w.x1,w.y0);hole.lineTo(w.x1,w.y1);hole.lineTo(w.x0,w.y1);hole.closePath();shape.holes.push(hole);}
      plateGeometries.set(side,new THREE.ExtrudeGeometry(shape,{depth:spec.plateThickness,bevelEnabled:false}));
    }
    plate.geometry.dispose();plate.geometry=plateGeometries.get(side);plate.position.z=g.plateZ-spec.plateThickness/2;
    parent.add(guide);guides.push(guide);
  }
  new THREE.GLTFLoader().load('models/gltf/hall_emergency_guide.glb',gltf=>{
    source=gltf.scene.getObjectByName('HallEmergencyGuideModel');
    if(!source){console.error('Hall emergency guide model missing');return;}
    source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    pending.splice(0).forEach(mount);
  },undefined,e=>console.error('Hall emergency guide load failed',e));
  return {guides,attach(parent,side,g,floor){const job={parent,side,g,floor};source?mount(job):pending.push(job);}};
})();
