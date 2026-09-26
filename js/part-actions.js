// Small glass controls follow their parts; mechanical state remains in existing controllers.
const PartActions=(()=>{
  let governor,brake,panel,source,brakeRoot,brakeAnchor;
  const point=new THREE.Vector3(),govScreen={x:0,y:0,visible:false};
  let statusBox,runBox;
  function positionButton(button,x,y){
    x=Math.max(8,Math.min(innerWidth-52,x));y=Math.max(8,Math.min(innerHeight-52,y));
    const overlaps=b=>b&&x<b.right+4&&x+44>b.left-4&&y<b.bottom+4&&y+44>b.top-4;
    if(overlaps(statusBox))y=statusBox.bottom+8;
    if(overlaps(runBox)){
      if(runBox.height>runBox.width)x=runBox.left-52;
      else y=runBox.top-52;
    }
    button.style.left=x+'px';button.style.top=y+'px';
  }
  const paths={
    ladder:'<path d="M7 3v18M17 3v18M7 6h10M7 12h10M7 18h10"/>',
    governor:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="m12 10 4-5M10 13l-5 3m9-3 5 3"/>',
    brake:'<path d="M10 3v18m4-18v18M7 7H4v10h3m10-10h3v10h-3M4 12h4m8 0h4"/>',
    play:'<path d="m9 5 10 7-10 7Z"/>',
    reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>'
  };
  const icons=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+v+'</svg>')}")`]));
  const icon=(button,key)=>button.style.setProperty('--part-icon',icons[key]);
  function close(){if(panel)panel.hidden=true;if(brake)brake.setAttribute('aria-expanded','false');}
  function sync(){
    const ovsReset=governor.textContent.trim()==='RST',ucmReset=source.textContent.trim()==='RST';
    icon(governor,ovsReset?'reset':'governor');icon(source,ucmReset?'reset':'play');icon(brake,ucmReset?'reset':'brake');
    governor.setAttribute('aria-label',ovsReset?'조속기 복귀':'조속기 과속 시연');
    source.setAttribute('aria-label',ucmReset?'개문발차 복귀':'개문발차 시연');
    brake.setAttribute('aria-label',ucmReset?'로프브레이크 시연 복귀':'로프브레이크 시연 설정');
    brake.disabled=source.disabled;
    governor.classList.toggle('active',ovsReset);brake.classList.toggle('active',ucmReset);
  }
  function bind(){
    governor=document.getElementById('btn-overspeed');brake=document.getElementById('rope-brake-action');
    panel=document.getElementById('rope-brake-panel');source=document.getElementById('btn-ucm');
    icon(document.getElementById('pit-ladder-action'),'ladder');sync();
    for(const b of [governor,source])new MutationObserver(sync).observe(b,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    brake.addEventListener('click',()=>{
      if(UCMDemo.state.active){source.click();return;}
      const open=panel.hidden;closeAllMenus();panel.hidden=!open;brake.setAttribute('aria-expanded',String(open));renderSegments();
    });
    document.getElementById('rope-brake-dismiss').addEventListener('click',close);
    document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&e.target!==brake)close();});
  }
  function visible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return !!object;}
  function place(button,object,offset){
    if(!visible(object)){button.hidden=true;return false;}
    point.copy(offset);object.localToWorld(point);point.project(camera);
    const shown=point.z>-1&&point.z<1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.94;
    button.hidden=!shown;if(!shown)return false;
    let x=Math.max(8,Math.min(innerWidth-52,(point.x+1)*innerWidth/2-22));
    const y=Math.max(8,Math.min(innerHeight-52,(1-point.y)*innerHeight/2-50));
    if(button===brake&&govScreen.visible&&Math.abs(x-govScreen.x)<48&&Math.abs(y-govScreen.y)<48){
      x=govScreen.x+52<innerWidth-52?govScreen.x+52:govScreen.x-52;
    }
    positionButton(button,x,y);
    if(button===governor){govScreen.x=x;govScreen.y=y;}
    return true;
  }
  const govOffset=new THREE.Vector3(0,.32,0);
  function update(){
    if(!governor)return;
    statusBox=document.getElementById('statusbar').getBoundingClientRect();
    runBox=document.getElementById('dd-op').getBoundingClientRect();
    const wheel=govHandles()?.ready?govHandles().wheel:null;
    if(wheel){govOffset.copy(wheel.position);govOffset.y+=.32;}
    govScreen.visible=place(governor,wheel?.parent,govOffset);
    if(!brakeRoot){
      const installation=scene.getObjectByName('RopeBrakeInstallation');
      if(installation?.userData.ready){
        brakeRoot=installation.getObjectByName('RopeBrake');
        const bounds=new THREE.Box3().setFromObject(brakeRoot);
        brakeAnchor=bounds.getCenter(new THREE.Vector3());brakeAnchor.y=bounds.max.y+.06;
        brakeRoot.worldToLocal(brakeAnchor);
      }
    }
    const shown=place(brake,brakeRoot,brakeAnchor);
    if(!shown){close();return;}
    if(!panel.hidden){
      panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,parseFloat(brake.style.left)-90))+'px';
      panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,parseFloat(brake.style.top)+50))+'px';
    }
  }
  return {bind,update,close,positionButton};
})();
