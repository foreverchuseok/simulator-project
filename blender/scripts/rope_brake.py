"""Safe-Tech reference rope brake, adapted to the simulator's five ropes.
Three.js local frame: X across ropes, Y jaw normal, Z rope direction.
Mount interface is read from machine-room-safety.js; metres throughout.
"""
import bpy, math, re, json
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
JS=(ROOT/'js/machine-room-safety.js').read_text(encoding='utf-8')
MOUNT=json.loads(re.search(r'const ROPE_BRAKE_MOUNT = (\{.*?\});',JS,re.S)[1])
ROPES=(ROOT/'js/elevator.js').read_text(encoding='utf-8').split('function buildWireRopes()')[1].split('function refreshWireRopeShape')[0]
ROPE_START,ROPE_PITCH=map(float,re.search(r'const rx = (-?[\d.]+) \+ i \* ([\d.]+)',ROPES).groups())
ROPE_COUNT=int(re.search(r'for \(let i = 0; i < (\d+)',ROPES)[1])
ROPE_RADIUS=float(re.search(r'const ropeR = ([\d.]+)',ROPES)[1])
ROPE_X=[ROPE_START+i*ROPE_PITCH for i in range(ROPE_COUNT)]
WIDTH,LENGTH=.300,.300
GAP=MOUNT['jawGap']; FACE=GAP/2
JAW_BOTTOM=-.074; COVER_BOTTOM=.059; COVER_TOP=.193
COVER_W,COVER_L,SHEET=.310,.322,.0025
GUIDE_X,GUIDE_Z=.118,.108
GROOVE_R,GROOVE_DEPTH=.008,.004
CAST_BEVEL=.006

def T(x,y,z):return (x,-z,y)
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

def bevel(o,r,segments=3):
    bpy.context.view_layer.objects.active=o
    b=o.modifiers.new('Machined edge radius','BEVEL');b.width=r;b.segments=segments
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons:p.use_smooth=True
    n=o.modifiers.new('Face normals','WEIGHTED_NORMAL');n.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=n.name)
    return o

def box(name,size,pos,mat,r=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(*pos));o=bpy.context.object;o.name=name
    o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if r:bevel(o,r)
    return o

def cylinder(name,r,length,pos,mat,axis=(0,1,0),verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=length,location=T(*pos))
    o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION'
    o.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(T(*axis)))
    o.data.materials.append(mat)
    return bevel(o,.0006,2)

def rod(name,a,b,r,mat):
    a,b=Vector(a),Vector(b);return cylinder(name,r,(b-a).length,(a+b)/2,mat,(b-a).normalized())

def text(body,pos,size,mat,normal=(0,0,1),right=(1,0,0),depth=.00025,font=None):
    c=bpy.data.curves.new('Raised lettering','FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER'
    c.extrude=depth;c.resolution_u=4
    if font:c.font=font
    o=bpy.data.objects.new('Lettering',c);bpy.context.collection.objects.link(o);o.location=T(*pos)
    n=Vector(T(*normal));u=Vector(T(*right));v=n.cross(u)
    o.rotation_euler=Matrix((u,v,n)).transposed().to_euler();o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    return o

def join(parts,name,parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=parent
    return o

def collect(name,fn):
    before=set(bpy.data.objects);fn();return join(list(set(bpy.data.objects)-before),name,root)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
cast=material('RB_CastSteel',(.43,.46,.49),.72,.58)
machined=material('RB_MachinedSteel',(.57,.61,.64),.85,.31)
gold=material('RB_YellowZinc',(.56,.43,.17),.78,.31)
yellow=material('RB_SafetyYellow',(.95,.60,.005),.18,.30)
black=material('RB_BlackGrip',(.018,.023,.027),.05,.72)
red=material('RB_WarningRed',(.68,.022,.013),.05,.53)
white=material('RB_LabelWhite',(.92,.92,.88),.05,.58)
ink=material('RB_LabelInk',(.025,.028,.030),.1,.60)
# Packed tangent normal map preserves a fine sand-cast surface in GLB.
rng=np.random.default_rng(92);h=rng.random((128,128));dx=np.roll(h,-1,1)-np.roll(h,1,1);dy=np.roll(h,-1,0)-np.roll(h,1,0)
pixels=np.ones((128,128,4),dtype=np.float32);pixels[:,:,0]=.5+dx*.20;pixels[:,:,1]=.5+dy*.20;pixels[:,:,2]=.98
im=bpy.data.images.new('CastSteelGrain',width=128,height=128);im.colorspace_settings.name='Non-Color'
im.pixels.foreach_set(pixels.ravel());im.update();im.pack()
nodes=cast.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=im
nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.5
cast.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);cast.node_tree.links.new(nm.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
root=bpy.data.objects.new('RopeBrakeModel',None);bpy.context.collection.objects.link(root)

def lower():
    box('LowerPad',(.190,-FACE-JAW_BOTTOM,.252),(0,(JAW_BOTTOM-FACE)/2,0),cast,.003)
    box('FlatWorkingFace',(.182,.003,.244),(0,-FACE-.0015,0),machined,.0005)
    # Rounded, heavy side yokes, with necked ends and reinforced crossbars.
    for x in (-GUIDE_X,GUIDE_X):
        box('CastSideYoke',(.062,.057,LENGTH),(x,-.047,0),cast,CAST_BEVEL)
        for z in (-GUIDE_Z,GUIDE_Z):
            box('GuideBoss',(.065,.035,.069),(x,-.071,z),cast,.010)
    for z in (-(LENGTH-.043)/2,(LENGTH-.043)/2):box('CastCrossRib',(.208,.050,.043),(0,-.052,z),cast,.005)
    box('BrandPlate',(.168,.002,.072),(0,JAW_BOTTOM-.001,0),cast,.004)
    text('Safe-Tech',(0,JAW_BOTTOM-.0022,.012),.025,cast,normal=(0,-1,0))
    text('Rope brake',(0,JAW_BOTTOM-.0022,-.019),.014,cast,normal=(0,-1,0))
    text('Safe-Tech',(0,-.047,.1507),.019,machined)
collect('BrakeLowerJaw',lower)

def upper():
    # Analytic, continuous grooved working surface: five rounded channels
    # along Z, centred on the actual five rope X positions (not painted lines).
    xs=sorted(set([-.091,.091]+[x+GROOVE_R*math.cos(i*math.pi/12) for x in ROPE_X for i in range(13)]))
    ys=[]
    for x in xs:
        depth=max([GROOVE_DEPTH*math.sqrt(max(0,1-((x-c)/GROOVE_R)**2)) for c in ROPE_X]+[0])
        ys.append(FACE+depth)
    verts=[]
    for z in (-.124,.124):
        verts.extend(T(x,y,z) for x,y in zip(xs,ys));verts.extend([T(.091,.040,z),T(-.091,.040,z)])
    n=len(xs)+2;faces=[]
    faces.append(tuple(reversed(range(n))));faces.append(tuple(range(n,2*n)))
    for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
    me=bpy.data.meshes.new('Five rope channel profile');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new('GroovedSteelPad',me);bpy.context.collection.objects.link(o);o.data.materials.append(machined)
    # Recalculate outward normals on the closed extruded profile.
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    box('UpperBacking',(.296,.017,.296),(0,.0485,0),gold,.002)
collect('BrakeUpperJaw',upper)

def hardware():
    for x in (-GUIDE_X,GUIDE_X):
        for z in (-GUIDE_Z,GUIDE_Z):
            cylinder('PolishedGuide',.010,.144,(x,-.015,z),machined)
            cylinder('ZincSleeve',.018,.049,(x,.015,z),gold)
            cylinder('Washer',.022,.004,(x,-.091,z),gold)
            cylinder('HexNut',.017,.014,(x,-.099,z),gold,verts=6)
            cylinder('ThreadEnd',.010,.007,(x,-.110,z),gold)
            box('TorqueWitness',(.002,.001,.034),(x,-.107,z),red)
    for x in (-.145,.145):
        for z in MOUNT['lugZ']:cylinder('MountLug',.019,.022,(x,MOUNT['lugY'],z),cast,(1,0,0))
collect('BrakeGuideHardware',hardware)

def cover():
    box('TopFold',(COVER_W,SHEET,COVER_L),(0,COVER_TOP,0),yellow,.001)
    for s in (-1,1):
        box('SideFold',(SHEET,COVER_TOP-COVER_BOTTOM,COVER_L),(s*(COVER_W-SHEET)/2,(COVER_TOP+COVER_BOTTOM)/2,0),yellow,.001)
        box('EndFold',(COVER_W,COVER_TOP-COVER_BOTTOM,SHEET),(0,(COVER_TOP+COVER_BOTTOM)/2,s*(COVER_L-SHEET)/2),yellow,.001)
        box('Hem',(.011,.005,COVER_L+.008),(s*.150,COVER_BOTTOM,0),yellow,.001)
        for z in (-.132,.132):cylinder('CoverScrew',.004,.003,(s*.156,.073,z),gold,(1,0,0),verts=6)
    e=MOUNT['wireExit'];cylinder('CableGland',.010,.027,(e[0],e[1],e[2]+.014),gold,(0,0,1),verts=6)
collect('BrakeCover',cover)

def handles():
    # Both sides have a straight black manual handle. The bent release tool
    # stays clipped to the yellow cover, as in the supplied side photographs.
    for s in (-1,1):
        cylinder('ManualShaft',.004,.081,(s*.192,.070,.100),gold,(1,0,0))
        cylinder('BlackManualGrip',.006,.065,(s*.198,.070,.100),black,(1,0,0))
        cylinder('GripCap',.0065,.004,(s*.232,.070,.100),gold,(1,0,0))
    for s in (-1,1):
        x=s*.169
        path=[(x,.163,-.074),(x,.130,-.074),(x,.130,.075),(x,.103,.092)]
        for a,b in zip(path,path[1:]):rod('BentReleaseLever',a,b,.004,gold)
        cylinder('ReleaseSocket',.010,.012,(s*.160,.163,-.074),gold,(1,0,0),verts=6)
        for z in (-.035,.044):box('RetainingClip',(.013,.014,.013),(x,.130,z),machined,.001)
collect('BrakeManualHandles',handles)

fontpath=Path('C:/Windows/Fonts/malgun.ttf');font=bpy.data.fonts.load(str(fontpath)) if fontpath.exists() else None
def labels():
    box('DoNotStepLabel',(.172,.0008,.047),(0,COVER_TOP+.0015,-.075),red,.001)
    text('밟지 마시오 !!',(0,COVER_TOP+.002,-.084),.016,white,(0,1,0),font=font,depth=0)
    text("Don't Step !!",(0,COVER_TOP+.002,-.065),.013,white,(0,1,0),depth=0)
    box('IdentityLabel',(.063,.0008,.030),(-.110,COVER_TOP+.0015,.095),white,.001)
    text('Safe-Tech',(-.110,COVER_TOP+.002,.088),.009,ink,(0,1,0),depth=0)
    text('ROPE BRAKE',(-.110,COVER_TOP+.002,.101),.007,ink,(0,1,0),depth=0)
    for s in (-1,1):
        box('ReleaseWarning',(.0008,.045,.094),(s*.157,.096,-.008),red,.001)
        text('MANUAL RELEASE',(s*.158,.102,-.008),.008,white,(s,0,0),(0,0,-s),depth=0)
        text('비상 수동 해제',(s*.158,.089,-.008),.008,white,(s,0,0),(0,0,-s),depth=0,font=font)
collect('BrakeLabels',labels)
root['ropeBrake']={'version':1,'manufacturer':'Safe-Tech','ropeX':ROPE_X,'ropeRadius':ROPE_RADIUS,
 'jawGap':GAP,'grooveRadius':GROOVE_R,'grooveDepth':GROOVE_DEPTH,'wireExit':MOUNT['wireExit'],
 'lugY':MOUNT['lugY'],'lugZ':MOUNT['lugZ'],'manualHandles':2,'retainedReleaseLevers':2}
out=ROOT/'models/gltf/rope_brake.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('Rope brake exported:',out,'polygons:',sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH'))
