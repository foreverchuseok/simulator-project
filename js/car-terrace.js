/* TERRACE-inspired cabin finish. Structural panels, glass and door travel stay in their original assemblies.
 * Ceiling GLB uses normalized X/Z dimensions; Y is metres below the roof underside.
 * Blender reads this JSON contract. Re-export car_terrace_ceiling.py after changing it. */
const TERRACE_CEILING = {"version":1,"drop":0.115,"centerWidth":0.58,"lightWidth":0.014,"steps":4,"stepRise":0.014};
const CarTerrace = (() => {
  let materials;
  function texture(draw,w=1024,h=1024) {
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;
  }
  function random(seed) {return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function getMaterials() {
    if(materials)return materials;
    const wall=M.ss(0xffffff);wall.metalness=.35;wall.roughness=.42;
    wall.map=texture((c,w,h)=>{
      c.fillStyle='#474344';c.fillRect(0,0,w,h);const rand=random(19027);
      // Sparse warm flecks, fixed seed, no individual particle meshes.
      for(let i=0;i<4400;i++){
        const x=rand()*w,y=rand()*h,r=.25+rand()*.65;
        c.fillStyle=`rgba(191,161,107,${.12+rand()*.43})`;c.fillRect(x,y,r,r*1.3);
      }
    });
    const door=M.ss(0xffffff);door.metalness=.48;door.roughness=.3;
    door.map=texture((c,w,h)=>{
      c.fillStyle='#242426';c.fillRect(0,0,w,h);
      for(let x=0;x<w;x+=22){c.fillStyle='#414043';c.fillRect(x,0,2,h);c.fillStyle='#171719';c.fillRect(x+3,0,2,h);}
    },1024,256);
    const gold=M.gold();gold.color.setHex(0xa57c45);gold.metalness=.45;gold.roughness=.42;
    const charcoal=M.ss(0x353438);charcoal.roughness=.42;
    const silver=M.ss(0xb9b9b5);silver.metalness=.45;silver.roughness=.34;
    const white=M.paint(0xdeddd7);white.clearcoat=0;white.roughness=.65;
    const light=M.emit(0xfff5e4,1.15);light.roughness=.5;
    const floor=M.marble();floor.color.setHex(0xffffff);floor.roughness=.46;floor.metalness=.02;
    floor.map=texture((c,w,h)=>{
      c.fillStyle='#dfdfd7';c.fillRect(0,0,w,h);const rand=random(142401);
      for(let i=0;i<16000;i++){const v=150+Math.floor(rand()*60);c.fillStyle=`rgba(${v},${v},${v-5},.18)`;c.fillRect(rand()*w,rand()*h,.6+rand(),.6+rand());}
      // Fine, irregular mineral veins across a bright stone field.
      for(let i=0;i<24;i++){
        let x=rand()*w,y=rand()*h;c.beginPath();c.moveTo(x,y);
        for(let j=0;j<9;j++){const nx=x+20+rand()*95,ny=y-40+rand()*95;c.quadraticCurveTo(x+40,y-25+rand()*50,nx,ny);x=nx;y=ny;}
        c.strokeStyle='rgba(130,132,127,.16)';c.lineWidth=.5+rand()*1.1;c.stroke();
      }
      const border=30;c.strokeStyle='#65635f';c.lineWidth=border;c.strokeRect(border/2,border/2,w-border,h-border);
      c.strokeStyle='rgba(113,111,105,.28)';c.lineWidth=1;
      for(let i=1;i<3;i++){c.beginPath();c.moveTo(border,h*i/3);c.lineTo(w-border,h*i/3);c.stroke();c.beginPath();c.moveTo(w*i/3,border);c.lineTo(w*i/3,h-border);c.stroke();}
    });
    materials={wall,door,gold,charcoal,silver,white,light,floor};return materials;
  }
  function dressDoor(skin,group,side,d) {
    // BoxGeometry: +X/-X/+Y/-Y/+Z are unfinished steel; only -Z faces the passenger.
    skin.material=[skin.material,getMaterials().door];
    skin.geometry.clearGroups();skin.geometry.addGroup(0,30,0);skin.geometry.addGroup(30,6,1);
    skin.userData={type:'car-door-skin',interiorFace:'-Z',exteriorFace:'+Z'};
    // Inlays project 0.15 mm past the skin, behind stickers (0.6 mm), inside the 5 mm running gap.
    const x=-side*(d.width/2-.065),y=(d.top+d.bottom)/2,z=d.doorZ-CarDoor.spec.panelT/2+.00005;
    for(const [offset,width] of [[0,.033],[.028,.004]]){
      const m=createBox(width,d.top-d.bottom-.014,.0004,getMaterials().gold,x+side*offset,y,z,group);
      m.name='terraceDoorGoldInlay';
    }
  }
  function mount(parent,{sideX,rearZ,frontZ,top,bottom}) {
    const m=getMaterials(),root=new THREE.Group();root.name='carTerraceInterior';parent.add(root);
    const width=sideX*2-.025,depth=frontZ-rearZ-.04,midZ=(frontZ+rearZ)/2;
    // Small champagne reveals on the solid wall; leave the two glass walls unobstructed.
    for(const z of [rearZ+.035,frontZ-.035]){
      const trim=createBox(.0015,top-bottom-.1,.009,m.gold,-sideX+.003,bottom+(top-bottom)/2,z,root);trim.name='terraceWallReveal';
    }
    const ceiling=new THREE.Group();ceiling.name='terraceCeiling';ceiling.position.set(0,S.CAR_H/2-.025,midZ);
    root.add(ceiling);ceiling.userData.ready=false;
    ceiling.userData.promise=new Promise((resolve,reject)=>{
      new THREE.GLTFLoader().load('models/gltf/car_terrace_ceiling.glb',gltf=>{
        const model=gltf.scene.getObjectByName('TerraceCeiling');
        if(!model||Object.keys(TERRACE_CEILING).some(k=>model.userData[k]!==TERRACE_CEILING[k])){
          const e=new Error('Terrace ceiling contract mismatch; re-export car_terrace_ceiling.py');console.error(e);reject(e);return;
        }
        model.scale.set(width,1,depth);
        const palette={TerraceDark:m.charcoal,TerraceSilver:m.silver,TerraceWhite:m.white,TerraceLight:m.light};
        model.traverse(o=>{if(o.isMesh){o.material=palette[o.material.name]||m.silver;o.castShadow=false;o.receiveShadow=true;}});
        ceiling.add(model);ceiling.userData.ready=true;resolve();
      },undefined,e=>{console.error('Terrace ceiling load failed',e);reject(e);});
    });
    root.userData={theme:'TERRACE',reference:'Remodeling catalogue PDF 14',glassSides:['rear','right']};
  }
  return {getMaterials,dressDoor,mount};
})();
