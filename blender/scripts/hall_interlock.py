"""2026-09-09 field photos + 094039 video: landing interlock.
Metres, app Y-up via T. X is closed assembly X; Y is relative to track centre,
Z to hanger plate centre. Extras own dimensions used by the JS animation.
Photo-based educational reconstruction, not manufacturing dimensions.
"""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / 'models/gltf/hall_interlock.glb'
COVER_X, COVER_Y, COVER_Z = 0.035, 0.002, -0.024
COVER_W, COVER_H, COVER_D = 0.103, 0.078, 0.029
SHEET, HOOK_T, BEVEL = 0.003, 0.004, 0.00035
LATCH_Z, LIP_X, LIP_W, RIM_Y = -0.025, 0.100, 0.006, -0.048
ENGAGE, CLEAR, SEAT, GAP, SLOT_HALF_Z = 0.008, 0.004, 0.0005, 0.0045, 0.0035
PIVOT = (0.207, -0.033, LATCH_Z)
LOWER_ROLLER, UPPER_ROLLER = (0.183, -0.027, -0.039), (0.178, 0.020, -0.039)
LOWER_R, UPPER_R = 0.024, 0.022
SPRING_X, SPRING_Z, SPRING_BOTTOM, SPRING_TOP = 0.151, -0.019, 0.011, 0.055
SPRING_R, SPRING_WIRE, SPRING_TURNS = 0.005, 0.00085, 11
LINK_X, LINK_Y, LINK_Z, LINK_WIDTH, LINK_T = 0.158, -0.031, -0.040, 0.014, 0.003
KEEPER_START, KEEPER_TIP, KEEPER_HALF_Z = -0.245, 0.140, 0.011

def T(x,y,z): return (x,-z,y)

def attach(o,p):
    bpy.context.view_layer.update()
    m=o.matrix_world.copy()
    o.parent=p
    o.matrix_world=m
    return o

def group(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(o)
    o.location=T(*loc)
    if parent: attach(o,parent)
    return o

def material(name,color,metal=0,rough=0.45,alpha=1):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    m.diffuse_color=(*color,alpha)
    b=m.node_tree.nodes.get('Principled BSDF')
    for key,value in [('Base Color',(*color,alpha)),('Metallic',metal),('Roughness',rough),('Alpha',alpha)]:
        b.inputs[key].default_value=value
    return m

def finish(o,mat,bevel=BEVEL):
    o.data.materials.append(mat)
    if bevel:
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('Rolled edges','BEVEL')
        m.width,m.segments=bevel,3
        bpy.ops.object.modifier_apply(modifier=m.name)
        n=o.modifiers.new('Face normals','WEIGHTED_NORMAL')
        n.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=n.name)
    if mat.name=='IL_FieldChromate':
        # Baked, subdued olive/rose conversion-coating variations; no dependency
        # on Blender procedural shaders unsupported by glTF.
        ca=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly in o.data.polygons:
            for li in poly.loop_indices:
                v=o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co
                a=math.sin(v.x*45+v.z*63+v.y*20)
                b=math.sin(v.x*79-v.z*31)
                ca.data[li].color=(0.28+0.055*a,0.235+0.065*b,0.12+0.05*a,1)
    return o

def box(name,size,loc,mat=None,parent=None,bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(*loc))
    o=bpy.context.object
    o.name=name
    o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if mat: finish(o,mat,bevel)
    if parent: attach(o,parent)
    return o

def cyl(name,r,h,loc,mat=None,parent=None,axis='z',sides=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=h,location=T(*loc))
    o=bpy.context.object
    o.name=name
    if axis=='z': o.rotation_euler.x=math.pi/2
    elif axis=='x': o.rotation_euler.y=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    if mat: finish(o,mat,min(BEVEL,h/5))
    if parent: attach(o,parent)
    return o

def cut(o,cutter):
    bpy.context.view_layer.objects.active=o
    m=o.modifiers.new('Through opening','BOOLEAN')
    m.operation,m.solver,m.object='DIFFERENCE','EXACT',cutter
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def plate(name,pts,t,z,mat,parent):
    n=len(pts)
    vs=[T(x,y,z+dz) for dz in (-t/2,t/2) for x,y in pts]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vs,[],fs)
    mesh.update()
    o=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    finish(o,mat)
    return attach(o,parent)

def tube(name,pts,r,mat,parent):
    c=bpy.data.curves.new(name,'CURVE')
    c.dimensions,c.bevel_depth,c.bevel_resolution='3D',r,3
    s=c.splines.new('POLY')
    s.points.add(len(pts)-1)
    for p,xyz in zip(s.points,pts): p.co=(*T(*xyz),1)
    o=bpy.data.objects.new(name,c)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH')
    return attach(bpy.context.object,parent)

def screw(name,x,y,z,p,r=0.0032):
    cyl(name+' washer',r*1.35,0.0008,(x,y,z+0.0014),steel,p)
    o=cyl(name,r,0.0025,(x,y,z))
    for w,h in [(r*1.45,0.0007),(0.0007,r*1.45)]:
        cut(o,box('Cross recess',(w,h,0.002),(x,y,z-0.0015)))
    finish(o,steel,0.00015)
    attach(o,p)

def roller(name,loc,r,parent):
    p=group(name)
    x,y,z=loc
    cyl('Elastomer tread',r,0.013,loc,rubber,p)
    cyl('Grey recessed hub',r*0.68,0.002,(x,y,z-0.0068),hub,p)
    cyl('Hub recess',r*0.43,0.0022,(x,y,z-0.0071),rubber,p)
    cyl('Zinc axle washer',r*0.32,0.0025,(x,y,z-0.008),zinc,p)
    cyl('Axle end',0.0045,0.003,(x,y,z-0.009),steel,p)
    attach(p,parent)

def build():
    global zinc,steel,rubber,hub
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    zinc=material('IL_FieldChromate',(1,1,1),0.78,0.38)
    vc=zinc.node_tree.nodes.new('ShaderNodeVertexColor')
    vc.layer_name='Color'
    zinc.node_tree.links.new(vc.outputs['Color'],zinc.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    steel=material('IL_ZincFastener',(0.44,0.47,0.48),0.83,0.30)
    rubber=material('IL_RollerRubber',(0.018,0.022,0.024),0.05,0.72)
    hub=material('IL_GreyPolymerHub',(0.26,0.30,0.32),0.1,0.45)
    white=material('IL_IvoryInsulator',(0.60,0.57,0.46),0,0.42)
    clear=material('IL_Polycarbonate',(0.73,0.77,0.75),0,0.16,0.18)
    brass=material('IL_ContactBrass',(0.48,0.30,0.085),0.78,0.34)
    wire=material('IL_YellowWire',(0.60,0.43,0.015),0,0.57)
    root=group('InterlockRoot')
    fixed=group('SwitchAssembly',parent=root)
    base=group('InterlockBase',parent=root)
    hook=group('Hook',PIVOT,root)
    keeper=group('Keeper',parent=root)
    back=box('SwitchBackplate',(0.114,0.123,SHEET),(COVER_X,-0.0095,0.004))
    for x,y in [(0.057,0.027),(0.057,-0.027),(0.023,0.029)]:
        cut(back,cyl('Wire hole',0.006,0.02,(x,y,0.004)))
    finish(back,zinc)
    attach(back,fixed)
    box('Header fixing flange',(0.114,SHEET,0.029),(COVER_X,0.052,0.017),zinc,fixed)
    box('Folded lower shelf',(0.114,SHEET,0.044),(COVER_X,-0.072,-0.017),zinc,fixed)
    box('Shelf return lip',(0.114,0.004,SHEET),(COVER_X,-0.068,-0.0375),zinc,fixed)
    for x in (0,0.070):
        cyl('Header M6 washer',0.006,0.001,(x,0.054,0.014),steel,fixed,axis='y')
        cyl('Header M6 nut',0.005,0.004,(x,0.056,0.014),steel,fixed,axis='y',sides=6)
    box('Clear front',(COVER_W,COVER_H,0.0015),(COVER_X,COVER_Y,COVER_Z-COVER_D/2),clear,fixed)
    for sy in (-1,1):
        box('Clear horizontal wall',(COVER_W,0.0015,COVER_D),(COVER_X,COVER_Y+sy*COVER_H/2,COVER_Z),clear,fixed)
    side=box('Clear socket-side wall',(0.0015,COVER_H,COVER_D),(COVER_X-COVER_W/2,COVER_Y,COVER_Z))
    for y in (-0.021,0.021):
        cut(side,cyl('Socket aperture',0.0028,0.015,(COVER_X-COVER_W/2,y,-0.017),axis='x'))
    finish(side,clear,0.00015)
    attach(side,fixed)
    for y,h in [(0.038,0.006),(-0.026,0.027)]:
        box('Clear tongue-side wall',(0.0015,h,COVER_D),(COVER_X+COVER_W/2,y,COVER_Z),clear,fixed)
    spine=box('Terminal spine',(0.025,0.071,0.014),(0.003,0.002,-0.017))
    for y in (-0.021,0.021):
        cut(spine,cyl('Terminal socket bore',0.0028,0.035,(0.003,y,-0.017),axis='x'))
    finish(spine,white)
    attach(spine,fixed)
    box('Central contact housing',(0.047,0.026,0.014),(0.037,-0.002,-0.017),white,fixed)
    box('Contact nose',(0.034,0.010,0.014),(0.073,0,-0.017),white,fixed)
    for y in (-0.021,0.021):
        box('Terminal brass',(0.016,0.014,0.0015),(0.003,y,-0.025),brass,fixed)
        screw('Terminal screw',0.003,y,-0.028,fixed)
        tube('Yellow lead',[(0.058,y*1.35,0.002),(0.052,y*1.6,-0.020),(0.026,y*1.6,-0.022),(0.006,y,-0.025)],0.0011,wire,fixed)
        box('Wire sleeve',(0.009,0.0034,0.0034),(0.010,y,-0.026),rubber,fixed)
    for x in (0.028,0.048): screw('Contact housing screw',x,-0.001,-0.026,fixed)
    for y in (-0.030,0.034): screw('Cover screw',0.016,y,-0.040,fixed)
    for z in (-0.023,-0.016):
        box('Stationary contact leaf',(0.022,0.0008,0.0045),(0.093,0.004,z),brass,fixed)
        for zz in (z-0.0012,z+0.0012):
            cyl('Contact rivet',0.001,0.0013,(0.102,0.0045,zz),brass,fixed,axis='y')
    mount=box('Slotted roller mounting plate',(0.167,0.100,SHEET),(0.1755,-0.004,-0.004))
    for x,y in [(0.242,0.029),(0.242,-0.038)]: cut(mount,box('Mount slot',(0.018,0.008,0.016),(x,y,-0.004)))
    finish(mount,zinc)
    attach(mount,base)
    for x,y in [(0.242,0.029),(0.242,-0.038)]: screw('Roller plate screw',x,y,-0.008,base,r=0.004)
    box('Upper roller angle',(0.035,0.052,0.003),(0.180,0.020,-0.012),zinc,base)
    box('Upper roller spacer',(0.017,0.030,0.012),(UPPER_ROLLER[0],UPPER_ROLLER[1],-0.020),steel,base)
    roller('FixedRoller',UPPER_ROLLER,UPPER_R,base)
    pts=[(0.224,-0.047),(0.230,-0.018),(0.217,0.005),(0.178,0.007),(0.165,0.004),
         (0.115,0.004),(LIP_X,-0.011),(LIP_X,RIM_Y-ENGAGE),(LIP_X+LIP_W,RIM_Y-ENGAGE),
         (LIP_X+LIP_W,-0.024),(0.122,-0.024),(0.160,-0.039),(0.200,-0.052)]
    plate('hallLatchKeeperArm',pts,HOOK_T,LATCH_Z,zinc,hook)
    roller('MovingRoller',LOWER_ROLLER,LOWER_R,hook)
    screw('Hook pivot',PIVOT[0],PIVOT[1],-0.031,base,r=0.004)
    for x in (0.122,0.148): cyl('Hook rivet',0.0024,0.0018,(x,-0.005,LATCH_Z-0.0028),steel,hook)
    box('Insulating spring seat',(0.028,0.006,0.015),(SPRING_X,0.008,SPRING_Z),white,hook)
    box('Insulating link',(0.054,0.006,0.014),(0.111,0.009,SPRING_Z),white,hook)
    box('Insulating tongue step',(0.020,0.014,0.016),(0.104,0.015,SPRING_Z),white,hook)
    box('Insulating contact tongue',(0.030,0.003,0.014),(0.092,0.008,SPRING_Z),white,hook)
    box('Contact bridge',(0.015,0.001,0.011),(0.101,0.0055,SPRING_Z),brass,hook)
    box('Spring guide tab',(0.015,0.003,0.017),(SPRING_X,SPRING_TOP+0.003,SPRING_Z),zinc,base)
    cyl('Spring guide stud',0.0023,0.060,(SPRING_X,0.033,SPRING_Z),steel,base,axis='y')
    for y in (SPRING_TOP+0.007,SPRING_TOP+0.012):
        cyl('Spring adjusting nut',0.0045,0.004,(SPRING_X,y,SPRING_Z),steel,base,axis='y',sides=6)
    cyl('Spring top washer',0.006,0.0016,(SPRING_X,SPRING_TOP,SPRING_Z),steel,base,axis='y')
    cyl('SpringBottomWasher',0.006,0.0016,(SPRING_X,SPRING_BOTTOM,SPRING_Z),steel,base,axis='y')
    coil=group('Spring')
    height=SPRING_TOP-SPRING_BOTTOM
    pts=[(SPRING_R*math.cos(i/440*SPRING_TURNS*math.tau),i/440*height,
          SPRING_R*math.sin(i/440*SPRING_TURNS*math.tau)) for i in range(441)]
    tube('Continuous compression coil',pts,SPRING_WIRE,steel,coil)
    coil.location=T(SPRING_X,SPRING_BOTTOM,SPRING_Z)
    attach(coil,base)
    group('SpringSeat',(SPRING_X,SPRING_BOTTOM,SPRING_Z),hook)
    group('hallLatchKeeperLip',(LIP_X+LIP_W/2,RIM_Y-ENGAGE,LATCH_Z),hook)
    group('LinkPin',(LINK_X,LINK_Y,LINK_Z),hook)
    screw('Link upper pin',LINK_X,LINK_Y,LINK_Z,hook,r=0.0035)
    # The long bent strike belongs to the opposite door, and has a THROUGH slot.
    slot0,slot1=LIP_X-SEAT,LIP_X+LIP_W+GAP
    bar=box('hallLatchBar',(0.124-KEEPER_START,SHEET,2*KEEPER_HALF_Z),
            ((0.124+KEEPER_START)/2,RIM_Y-SHEET/2,LATCH_Z))
    cut(bar,box('Rectangular latch opening',(slot1-slot0,0.024,2*SLOT_HALF_Z),
                ((slot0+slot1)/2,RIM_Y,LATCH_Z)))
    for x in (-0.235,-0.210): cut(bar,cyl('Keeper bolt bore',0.004,0.025,(x,RIM_Y,LATCH_Z),axis='y'))
    finish(bar,zinc,0.0002)
    attach(bar,keeper)
    plate('Keeper bent entry',[(0.123,RIM_Y),(KEEPER_TIP,RIM_Y-0.008),
          (KEEPER_TIP,RIM_Y-0.008-SHEET),(0.123,RIM_Y-SHEET)],2*KEEPER_HALF_Z,LATCH_Z,zinc,keeper)
    box('Keeper angle upright',(0.052,0.036,SHEET),(-0.223,RIM_Y+0.015,-0.004),zinc,keeper)
    box('Keeper fixing flange',(0.052,SHEET,0.024),(-0.223,RIM_Y+0.001,-0.015),zinc,keeper)
    for x in (-0.235,-0.210):
        cyl('Keeper M6 washer',0.006,0.001,(x,RIM_Y+0.002,LATCH_Z),steel,keeper,axis='y')
        cyl('Keeper M6 nut',0.005,0.004,(x,RIM_Y+0.004,LATCH_Z),steel,keeper,axis='y',sides=6)
    group('hallLatchPocket',((slot0+slot1)/2,RIM_Y,LATCH_Z),keeper)
    # Opposite-door extension and auxiliary plug, visible in the open video.
    extension=box('Opposite mounting extension',(0.234,0.101,SHEET),(-0.142,-0.009,-0.004))
    for x,y in [(-0.235,0.024),(-0.235,-0.043)]:
        cut(extension,box('Extension fixing slot',(0.014,0.007,0.02),(x,y,-0.004)))
    finish(extension,zinc)
    attach(extension,keeper)
    for y in (0.024,-0.043): screw('Extension bolt',-0.235,y,-0.008,keeper,r=0.004)
    box('Auxiliary plug angle',(0.003,0.064,0.025),(-0.038,0.002,-0.015),zinc,keeper)
    box('Clear auxiliary plug',(0.005,0.060,0.019),(-0.033,0.002,-0.017),clear,keeper)
    for y in (-0.021,0.021):
        cyl('Auxiliary contact pin',0.0018,0.040,(-0.015,y,-0.017),brass,keeper,axis='x')
        screw('Auxiliary plug fixing',-0.036,y,-0.029,keeper,r=0.0025)
    # Link stock is resized between live joint centres by JS; joints are unscaled.
    box('LinkStock',(LINK_WIDTH,1,LINK_T),(0,0.5,0),steel,root,bevel=0.0002)
    foot=box('LinkFoot',(LINK_WIDTH,0.040,LINK_T),(0,0,0))
    cut(foot,box('Cam pin through slot',(0.007,0.026,0.015),(0,0,0)))
    finish(foot,steel,0.0002)
    attach(foot,root)
    dx=LIP_X+LIP_W/2-PIVOT[0]
    dy=RIM_Y-ENGAGE-PIVOT[1]
    lo,hi=0,0.5
    for _ in range(60):
        a=(lo+hi)/2
        rise=-dx*math.sin(a)+dy*(math.cos(a)-1)
        if rise<ENGAGE+CLEAR: lo=a
        else: hi=a
    root['contractVersion']=2
    root['latch']={'z':LATCH_Z,'lipX':LIP_X,'lipW':LIP_W,'rimY':RIM_Y,'lipBotY':RIM_Y-ENGAGE,
                   'engage':ENGAGE,'clear':CLEAR,'gap':GAP,'seat':SEAT,'hz':SLOT_HALF_Z,
                   'lift':ENGAGE+CLEAR,'liftRad':(lo+hi)/2,'armR':-dx,'plateThickness':SHEET}
    root['spring']={'top':[SPRING_X,SPRING_TOP,SPRING_Z],'restLength':height}
    root['link']={'x':LINK_X,'y':LINK_Y,'z':LINK_Z}
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT_PATH),export_format='GLB',export_extras=True,
                              export_apply=True,export_animations=False)
    print('Field interlock exported:',OUTPUT_PATH)
    print('Latch lift angle:',(lo+hi)/2,'rad; sheet:',SHEET,'m')

if __name__=='__main__': build()
