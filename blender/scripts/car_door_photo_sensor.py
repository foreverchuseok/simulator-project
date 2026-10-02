"""Field-reference car door light curtain, viewed from the hoistway.
Photo proportions reconstructed inside the simulator's existing door envelope.
Model axes: X width, Y vertical, +Z nameplate/hoistway. Tx optical face +X, Rx -X.
Shared dimensions: CAR_DOOR_PHOTO JSON, S.DOOR_H and CarDoor.spec.bottomGap.
"""
import bpy, json, re, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
C=json.loads(re.search(r'const CAR_DOOR_PHOTO = (\{.*?\});',(ROOT/'js/car-door-photo.js').read_text(encoding='utf8'))[1])
DOOR_H=float(re.search(r'DOOR_H:\s*([\d.]+)',(ROOT/'js/config.js').read_text(encoding='utf8'))[1])
BOTTOM_GAP=float(re.search(r'bottomGap:\s*([\d.]+)',(ROOT/'js/car-door.js').read_text(encoding='utf8'))[1])
W,D=C['width'],C['depth'];H=DOOR_H-BOTTOM_GAP-2*C['endInset']
CAP=.012;LABEL_H=.185;LABEL_W=W*.72;BRACKET_T=.0012;SCREW_R=.0025
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def T(v):return (v[0],-v[2],v[1])
def mat(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    p.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
black=mat('PhotoAnodizedBlack','#25292d',.48,.38)
rubber=mat('PhotoRubberCaps','#111518',0,.7)
silver=mat('PhotoSatinFasteners','#a8adb1',.82,.34)
smoke=mat('PhotoOpticalWindow','#27161d',.15,.2)
white=mat('PhotoIdentificationLabel','#e6e4df',0,.68)
purple=mat('PhotoLabelStripe','#595287',0,.53)
ink=mat('PhotoLabelInk','#33383c',0,.75)
root=bpy.data.objects.new('CarDoorPhotoModel',None);bpy.context.collection.objects.link(root)
for k,v in {**C,'height':H,'reference':'20260929_132815 / 132819 / 132840','visualOnly':True}.items():root[k]=v
def box(name,c,d,m,parent,bevel=.0005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(c));o=bpy.context.object;o.name=name
    o.dimensions=(d[0],d[2],d[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(m);o.parent=parent
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=min(bevel,min(d)*.3);mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cyl(name,c,r,h,m,parent,axis='z',vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=T(c));o=bpy.context.object;o.name=name
    direction=Vector(T((1,0,0) if axis=='x' else (0,1,0) if axis=='y' else (0,0,1)))
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(direction)
    o.data.materials.append(m);o.parent=parent
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o
def text(body,x,y,z,size,parent,rotate=False):
    c=bpy.data.curves.new('label','FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER'
    o=bpy.data.objects.new('Label '+body,c);bpy.context.collection.objects.link(o);o.parent=parent
    o.location=T((x,y,z));o.rotation_euler=(math.pi/2,0,0)
    if rotate:o.rotation_euler=(math.pi/2,-math.pi/2,0)
    o.data.materials.append(ink);bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target='MESH');o.select_set(False)
for role,opt in [('Tx',1),('Rx',-1)]:
    group=bpy.data.objects.new('Photo'+role,None);bpy.context.collection.objects.link(group);group.parent=root
    group['opticalDirection']=opt;group['cableExit']=[0,H/2+C['glandHeight'],0]
    box('Extruded black aluminium',(0,0,0),(W,H-2*CAP,D),black,group,.0011)
    # Parallel extrusion seams visible on the back, separate rubber end caps.
    for x in [-W*.39,W*.39]:box('Extrusion seam',(x,0,D/2+.00015),(.0006,H-2*CAP,.0003),rubber,group,0)
    for y in [-H/2+CAP/2,H/2-CAP/2]:
        box('Moulded sealed end cap',(0,y,0),(W,CAP,D+.0004),rubber,group,.001)
        cyl('End cap screw',(0,y,D/2+.0004),.0018,.001,silver,group)
        box('Screw recess',(0,y,D/2+.001),(.0024,.00045,.00025),ink,group,0)
    # Inward-facing strip: the two detectors face each other across the opening.
    box('Recessed IR filter',(opt*(W/2-.0004),0,0),(.0008,H-.06,D*.68),smoke,group,.0003)
    count=int((H-.12)/C['lensPitch'])+1
    for i in range(count):
        y=(i-(count-1)/2)*C['lensPitch']
        cyl('Recessed optical cell',(opt*(W/2-.0004),y,0),.0033,.0008,smoke,group,'x')
        for dy in [-.007,.007]:box('Optical aperture separator',(opt*(W/2-.0001),y+dy,0),(.0002,.001,D*.69),rubber,group,0)
    # Field label: light vertical sticker, violet band and compact markings.
    ly=H/2-.18
    box('Long identification label',(0,ly,D/2+.0002),(LABEL_W,LABEL_H,.00035),white,group,.0005)
    box('Violet manufacturer band',(-W*.27,ly,D/2+.00042),(.0028,LABEL_H-.005,.0001),purple,group,0)
    text(role.upper(),.001,ly+LABEL_H*.38,D/2+.00055,.005,group)
    text('LIGHT CURTAIN',.003,ly+.004,D/2+.00055,.004,group,True)
    for j in range(10):
        box('Fine rating lines',(.001,ly-.030-j*.004,D/2+.0005),(.010-(j%3)*.0015,.0005,.0001),ink,group,0)
    cyl('Inspection seal',(.001,H/2-.055,D/2+.0005),.0044,.0005,purple if role=='Rx' else white,group)
    # Three compact mounting saddles screwed to the steel door return.
    for y in [-H/2+.055,0,H/2-.055]:
        x=-opt*(W/2+.0025)
        box('Mounting saddle',(x,y,-D/2-.002),(.015,.030,BRACKET_T),silver,group)
        box('Folded saddle return',(-opt*(W/2-.0006),y,-.006),(.0012,.030,.008),silver,group)
        cyl('Mounting screw',(x,y,-D/2-.0002),SCREW_R,.002,silver,group)
        for angle in [0,math.pi/2]:
            slit=box('Phillips slot',(x,y,-D/2+.001),(.0035,.00055,.00025),ink,group,0)
            slit.rotation_euler[1]=angle
    cyl('Top cable strain relief',(0,H/2+C['glandHeight']/2,0),.0035,C['glandHeight'],rubber,group,'y')
    for i in range(4):cyl('Strain relief rib',(0,H/2+.002+i*.0025,0),.0042,.0008,rubber,group,'y')
    # Rigid per-material batches; never merge Tx/Rx across the moving door leaves.
    for m in [black,rubber,silver,smoke,white,purple,ink]:
        objects=[o for o in list(group.children) if o.type=='MESH' and o.data.materials[0]==m]
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        if objects:
            bpy.context.view_layer.objects.active=objects[0]
            if len(objects)>1:bpy.ops.object.join()
            o=bpy.context.object;o.name=role+'_'+m.name
            bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='SELECT')
dest=ROOT/'models/gltf/car_door_photo_sensor.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
print('EXPORTED',dest,'height',H,'meshes',len([o for o in bpy.data.objects if o.type=='MESH']))
