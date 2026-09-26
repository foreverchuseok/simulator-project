"""Photo-reference Z-15GQ-B style panel plunger microswitch (metres).
Black moulding, two mounting bores, three screw terminals, threaded brass
bushing, hex nuts and silver plunger. Dimensions approximate the reference;
the pressed tip/travel mount contract is read from JS, not duplicated.
Three frame: +X pressing axis, Y body length, Z body thickness.
"""
import bpy, json, re, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
JS = (ROOT / 'js/pit-ladder.js').read_text(encoding='utf-8')
MOUNT = json.loads(re.search(r'const PIT_LADDER_SWITCH = (\{.*?\});', JS)[1])
BODY_X, BODY_Y, BODY_Z = .024, .049, .017
BODY_CY, BODY_CX = -.010, BODY_X / 2
BUSH_R, BUSH_START, BUSH_END = .005, BODY_X, .035
PIN_R, PIN_LENGTH = .0034, .013
HOLE_R, HOLE_YS = .0017, (-.024, .004)
TERMINAL_YS = (-.030, -.010, .010)
EDGE = .0006

def T(x,y,z): return (x,-z,y)

def material(name, rgb, metal=0, rough=.4):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m

def bevel(o, amount=EDGE):
    bpy.context.view_layer.objects.active=o
    m=o.modifiers.new('Moulded edges','BEVEL'); m.width=amount; m.segments=3
    bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def box(name, size, pos, mat, edge=EDGE):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(*pos)); o=bpy.context.object; o.name=name
    o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if edge: bevel(o,edge)
    return o

def cyl(name, radius, length, pos, mat, axis=(1,0,0), vertices=32, edge=.00015):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=length,location=T(*pos))
    o=bpy.context.object; o.name=name; o.rotation_mode='QUATERNION'
    o.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(T(*axis)))
    o.data.materials.append(mat)
    if edge: bevel(o,edge)
    return o

def cut(o, cutter):
    bpy.context.view_layer.objects.active=o
    m=o.modifiers.new('Through mounting bore','BOOLEAN'); m.operation='DIFFERENCE'; m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name); bpy.data.objects.remove(cutter,do_unlink=True)

def join(parts,name,parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=name
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); o.parent=parent
    return o

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
black=material('SwitchBlackPhenolic',(.025,.029,.028),0,.38)
seam=material('SwitchSeam',(.007,.008,.008),0,.7)
silver=material('SwitchNickel',(.64,.67,.69),.85,.26)
brass=material('SwitchBrass',(.60,.39,.08),.8,.3)
ink=material('SwitchMarking',(.30,.32,.29),0,.75)
root=bpy.data.objects.new('PitLadderSwitchModel',None); bpy.context.collection.objects.link(root)
for k,v in MOUNT.items(): root[k]=v

body=box('PhenolicCase',(BODY_X,BODY_Y,BODY_Z),(BODY_CX,BODY_CY,0),black)
for y in HOLE_YS:
    cut(body,cyl('Bore',HOLE_R,BODY_Z+.008,(.012,y,0),black,axis=(0,0,1),edge=0))
for z in (-1,1):
    # Separate moulded face lip, leaving the two fixing holes open.
    for y in (BODY_CY-BODY_Y/2+.001,BODY_CY+BODY_Y/2-.001):
        box('CaseSeam',(.021,.0005,.0003),(.012,y,z*(BODY_Z/2+.0001)),seam,.0001)
    if z < 0: continue
    for y in TERMINAL_YS:
        box('TerminalInsulator',(.005,.010,.019),(.002,y,0),black)
        cyl('TerminalWasher',.0036,.0007,(.001,y,z*.010),brass,axis=(0,0,1))
        screw=cyl('TerminalScrew',.0031,.0016,(.001,y,z*.011),silver,axis=(0,0,1))
        for sx,sy in ((.0045,.0007),(.0007,.0045)):
            cut(screw,box('CrossSlot',(sx,sy,.0015),(.001,y,z*.012),black,edge=0))
# Plunger sits off centre along the long body, as in the photograph.
cyl('ThreadedBushing',BUSH_R,BUSH_END-BUSH_START,((BUSH_START+BUSH_END)/2,0,0),brass)
for i in range(8):
    cyl('ThreadRidge',BUSH_R+.00035,.00038,(BUSH_START+.001+i*.0012,0,0),brass)
for x in (BODY_X+.0014,BODY_X+.0045):
    nut=cyl('HexNut',.0072,.0024,(x,0,0),silver,vertices=6)
    cut(nut,cyl('NutBore',BUSH_R-.0001,.006,(x,0,0),silver,edge=0))
cyl('PinCollar',.0053,.0015,(BUSH_END,0,0),silver)
# Restrained moulded part marking on the visible broad face.
curve=bpy.data.curves.new('PartMark','FONT'); curve.body='Z-15GQ-B'; curve.size=.0032; curve.extrude=.000015
label=bpy.data.objects.new('PartMark',curve); bpy.context.collection.objects.link(label)
label.location=T(.017,-.031,.00865)
# Text local x follows +Y, local y follows -X, normal +Z in Three.
from mathutils import Matrix
label.rotation_euler=Matrix((Vector(T(0,1,0)),Vector(T(-1,0,0)),Vector(T(0,0,1)))).transposed().to_euler()
label.data.materials.append(ink); bpy.context.view_layer.objects.active=label
bpy.ops.object.select_all(action='DESELECT'); label.select_set(True); bpy.ops.object.convert(target='MESH')
join([o for o in bpy.data.objects if o.type=='MESH'],'SwitchBody',root)
# Tip is local X=0; JS wrapper positions it at pressedTip or pressedTip+travel.
pin=cyl('SwitchPlunger',PIN_R,PIN_LENGTH,(-PIN_LENGTH/2,0,0),silver)
join([pin],'SwitchPlunger',root)
bpy.ops.object.select_all(action='SELECT')
dest=ROOT/'models/gltf/pit_ladder_switch.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_extras=True,export_yup=True)
print('Exported',dest)
