"""Video-reference pit governor tensioner. Three coordinates: axle X, up Y.
Source: temporary/tension-weight/source.mp4 (visual proportions, not a shop drawing).
Only Sheave rotates; the guard is on -X, the wall-facing +X side is open.
Shared mounting contract is PIT_TENSIONER_SPEC in js/pit-tensioner.js.
"""
import bpy, math, json, re
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads(re.search(r'const PIT_TENSIONER_SPEC = Object.freeze\((\{[^\n]+\})\)', (ROOT/'js/pit-tensioner.js').read_text(encoding='utf-8')).group(1))
R = SPEC['ropeRadius']
SHEET = .0025
GUARD_X = -.057
WEIGHT_Y, WEIGHT_H = -.405, .32
WEIGHT_FLANGE_Y, WEIGHT_FLANGE_T = -.24, .016
GUIDE_Z = .235
HOLE_COUNT, HOLE_PITCH_R, HOLE_R = 5, .082, .026
WEB_R, WEB_T = .130, .024
SWITCH = SPEC['switchCenter']
PLUNGER_TOP = SPEC['plungerTop']
STRIKER_BOTTOM = SPEC['strikerBottom']
SWITCH_PLATE_X = SWITCH[0]-.023
SWITCH_PLATE_DEPTH = .085
STRIKER_T = .008
STRIKER_END_X = SWITCH[0]+.020
STRIKER_ROOT_X = GUARD_X+.004
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def T(v): return (v[0], -v[2], v[1])
def material(name, color, metal, rough):
    m=bpy.data.materials.new(name); m.use_nodes=True
    c=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*c,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m
yellow=material('Tensioner safety yellow','e5b817',.12,.38)
steel=material('Galvanized steel','aeb5b3',.76,.36)
cast=material('Cast iron grey','686e69',.42,.69)
green=material('Guide grey green','a0aaa0',.25,.48)
black=material('Rubber seals','242626',0,.67)
bright=material('Zinc fasteners','cad0d1',.86,.28)
gold=material('Chromate bracket','a59560',.68,.42)

root=bpy.data.objects.new('PitTensioner',None); bpy.context.collection.objects.link(root)
for k,v in SPEC.items(): root[k]=v
groups={}
def group(name):
    g=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(g); g.parent=root; groups[name]=g
    return g
wheel=group('TensionSheave'); weight=group('WeightAndYoke'); guard=group('ProtectiveGuard')
fixed=group('FixedGuide'); switch=group('TensionSwitch'); striker=group('SwitchStriker')
def finish(o,name,mat,parent,bevel=0):
    o.name=name; o.data.materials.append(mat); o.parent=parent
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def box(name,c,d,mat,parent,bevel=.0008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(c)); o=bpy.context.object
    o.dimensions=(d[0],d[2],d[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)
def cyl(name,c,r,h,mat,parent,axis='x',vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=T(c))
    o=bpy.context.object
    direction=Vector(T({'x':(1,0,0),'y':(0,1,0),'z':(0,0,1)}[axis]))
    o.rotation_mode='QUATERNION'; o.rotation_quaternion=Vector((0,0,1)).rotation_difference(direction)
    o=finish(o,name,mat,parent,.0004)
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return o
def bolt(c,parent,axis='x',sign=1):
    cyl('Washer',c,.010,.002,bright,parent,axis)
    d={'x':(1,0,0),'y':(0,1,0),'z':(0,0,1)}[axis]
    cyl('Hex bolt',tuple(c[i]+sign*d[i]*.003 for i in range(3)),.0065,.006,bright,parent,axis,6)

# Turned U-groove: the existing 8 mm rope center is exactly R from the axle.
profile=[(-.017,R+.005),(-.011,R+.005),(-.006,R-.001),(0,R-.0045),(.006,R-.001),(.011,R+.005),(.017,R+.005),(.017,R-.025),(-.017,R-.025)]
verts=[]; faces=[]; N=96
for x,r in profile:
    for i in range(N):
        a=2*math.pi*i/N; verts.append(T((x,r*math.cos(a),r*math.sin(a))))
for j in range(len(profile)):
    for i in range(N): faces.append((j*N+i,j*N+(i+1)%N,((j+1)%len(profile))*N+(i+1)%N,((j+1)%len(profile))*N+i))
mesh=bpy.data.meshes.new('Grooved rim'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('Sheave machined groove',mesh); bpy.context.collection.objects.link(o); finish(o,o.name,cast,wheel)
for p in mesh.polygons:p.use_smooth=True
web=cyl('Five hole yellow sheave web',(0,0,0),WEB_R,WEB_T,yellow,wheel,vertices=96)
for i in range(HOLE_COUNT):
    a=2*math.pi*i/HOLE_COUNT
    cutter=cyl('Through hole cutter',(0,HOLE_PITCH_R*math.cos(a),HOLE_PITCH_R*math.sin(a)),HOLE_R,.08,steel,wheel,vertices=48)
    mod=web.modifiers.new('Round through hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=web;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
mod=web.modifiers.new('Hole edge chamfer','BEVEL');mod.width=.0007;mod.segments=2
bpy.context.view_layer.objects.active=web;bpy.ops.object.modifier_apply(modifier=mod.name)
for p in web.data.polygons:p.use_smooth=abs(p.normal.z)<.9
wheel['holeCount']=HOLE_COUNT;wheel['holePitchRadius']=HOLE_PITCH_R;wheel['holeRadius']=HOLE_R
cyl('Sheave hub',(0,0,0),.032,.060,cast,wheel)
cyl('Axle',(0,0,0),.012,.098,bright,weight)
for x in (-.039,.039):
    box('Bearing yoke',(x,-.11,0),(.009,.235,.048),green,weight,.002)
    cyl('Bearing boss',(x,0,0),.025,.013,steel,weight)
    bolt((x+(.010 if x>0 else -.010),0,0),weight)
box('Yoke bridge',(0,-.225,0),(.088,.016,.12),green,weight)
box('Cast weight',(0,WEIGHT_Y,0),(.125,WEIGHT_H,.31),cast,weight,.006)
box('Weight top flange',(0,WEIGHT_FLANGE_Y,0),(.135,WEIGHT_FLANGE_T,.32),green,weight,.002)
for z in (-.105,.105):
    # Keep the embedded rod below the flange; omit the unsupported decorative top fasteners.
    rod_top=WEIGHT_FLANGE_Y+WEIGHT_FLANGE_T/2-.001
    rod_bottom=WEIGHT_Y-WEIGHT_H/2-.002
    cyl('Weight tie rod',(0,(rod_top+rod_bottom)/2,z),.007,rod_top-rod_bottom,bright,weight,'y')
for x in (-.066,.066):
    for z in (-.105,.105):box('Cast reinforcing rib',(x,WEIGHT_Y,z),(.006,.285,.018),cast,weight,.002)

# Folded yellow sheet: open wall face, side returns, rope slots in the top return.
box('Guard face',(GUARD_X,0,0),(SHEET,.35,.362),yellow,guard,.001)
for z in (-.181,.181):box('Guard return',(GUARD_X+.035,0,z),(.072,.35,SHEET),yellow,guard)
box('Guard bottom return',(GUARD_X+.035,-.175,0),(.072,SHEET,.362),yellow,guard)
for z,w in ((0,.260),(-.172,.018),(.172,.018)):
    box('Slotted upper return',(GUARD_X+.035,.175,z),(.072,SHEET,w),yellow,guard)
for y in (-.125,.125):
    box('Guard fixing spacer',(-.043,y,0),(.027,.023,.037),green,weight)
    bolt((GUARD_X-.002,y,0),guard,sign=-1)
box('Guard carrier strap',(-.039,-.025,0),(.009,.325,.032),green,weight)

# Rail-side fixed guide and sliding collar. The rail arm is fitted in JS from live rail coordinates.
box('Vertical guide post',(.075,-.08,GUIDE_Z),(.018,.48,.020),steel,fixed)
for y in (-.31,.15):box('Guide anchor',(.075,y,GUIDE_Z),(.054,.012,.065),gold,fixed)
for x in (.057,.093):box('Sliding collar side',(x,-.19,GUIDE_Z),(.012,.065,.052),green,weight)
for z in (GUIDE_Z-.025,GUIDE_Z+.025):box('Sliding collar end',(.075,-.19,z),(.025,.065,.008),green,weight)
box('Yoke to slider',(.039,-.216,.122),(.014,.027,.244),green,weight)
box('Yoke cross connection',(.057,-.216,GUIDE_Z),(.048,.027,.030),green,weight)

# Fixed switch behind the upper guard; folded rear bracket reaches the fixed guide.
# The short striker is carried by the guard/yoke, never by the fixed switch bracket.
sx,sy,sz=SWITCH
flange=box('Switch mounting flange',(SWITCH_PLATE_X,sy,sz),(.004,.14,SWITCH_PLATE_DEPTH),steel,fixed)
back_z=sz+SWITCH_PLATE_DEPTH/2
box('Rear switch bracket return',((.075+SWITCH_PLATE_X)/2,sy,(back_z+GUIDE_Z)/2),
    (SWITCH_PLATE_X-.075+.014,.055,GUIDE_Z-back_z+.020),steel,fixed)
for yy in (sy-.018,sy+.018):bolt((.090,yy,GUIDE_Z),fixed)
for yy in (sy-.048,sy+.048):
    cutter=box('Slot cutter',(SWITCH_PLATE_X,yy,sz+.031),(.018,.031,.010),steel,fixed,.004)
    mod=flange.modifiers.new('Adjustment slot','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=flange;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
box('Switch seal',(sx,sy,sz),(.044,.092,.046),black,switch,.004)
box('Diecast switch housing',(sx+.007,sy,sz),(.039,.082,.042),steel,switch,.003)
box('Removable switch lid',(sx+.028,sy,sz),(.004,.071,.038),bright,switch,.002)
for y in (sy-.026,sy+.026):
    for z in (sz-.012,sz+.012):cyl('Lid screw',(sx+.031,y,z),.0025,.002,bright,switch,'x',16)
cyl('Switch neck',(sx,sy+.051,sz),.014,.016,black,switch,'y')
for y in (sy+.049,sy+.055,sy+.061):cyl('Bellows ridge',(sx,y,sz),.016,.003,black,switch,'y')
cyl('Plunger',(sx,(sy+.064+PLUNGER_TOP)/2,sz),.005,PLUNGER_TOP-sy-.064,bright,switch,'y')
cyl('Plunger cap',(sx,PLUNGER_TOP-.002,sz),.010,.004,bright,switch,'y')
cyl('Cable gland',(sx,sy-.055,sz),.010,.024,black,switch,'y')
box('Guard rear striker fixing',(STRIKER_ROOT_X,STRIKER_BOTTOM-.025,sz),(.006,.058,.036),steel,striker)
box('Switch striker',((STRIKER_ROOT_X+STRIKER_END_X)/2,STRIKER_BOTTOM+STRIKER_T/2,sz),
    (STRIKER_END_X-STRIKER_ROOT_X,STRIKER_T,.032),steel,striker)
for yy in (STRIKER_BOTTOM-.041,STRIKER_BOTTOM-.012):bolt((GUARD_X-.003,yy,sz),striker,sign=-1)
for y in (sy-.054,sy+.054):bolt((SWITCH_PLATE_X+.003,y,sz+.031),fixed)
striker['carrier']='ProtectiveGuard/WeightAndYoke'
striker['contactCenter']=[sx,STRIKER_BOTTOM,sz]
switch['plungerCenter']=[sx,PLUNGER_TOP,sz]
switch['mounting']='fixed rear bracket, behind upper guard'

# Join per functional group and material to keep draw calls bounded, preserving axle origin.
for g in groups.values():
    buckets={}
    for child in list(g.children):
        if child.type=='MESH':buckets.setdefault(child.data.materials[0].name,[]).append(child)
    for mat,objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        ob=bpy.context.object; ob.name=g.name+'_'+mat
        bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
out=ROOT/'models/gltf/pit_tensioner.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_yup=True)
print('Exported',out)
