"""정전시 조명장치·원형 LED: 사용자 2026-09-29 사진을 기존 카 치수에 맞춰 재구성.
두 GLB 모두 z=0 부착면, +Z 발광/덮개 방향. T(x,y,z)=(x,-z,y), 미터.
장착 위치는 JS가 기존 카탑박스/천장 좌표에서 파생하고 모델 치수는 extras로 전달한다.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BOX_W, BOX_H, BOX_D = .290, .205, .060
LAMP_R, LAMP_D = .060, .014
BOARD_Z, LED_Z = .010, .012
LED_SIZE = .005
LEDS = [(-.018,.040),(.018,.040),(-.040,.018),(.040,.018),
        (-.021,0),(.021,0),(-.040,-.018),(.040,-.018),
        (-.018,-.040),(.018,-.040),(0,.024),(0,-.024)]
FONT = 'C:/Windows/Fonts/malgun.ttf'
BEVEL = .001
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials, buckets = {}, {}

def T(p): return (p[0], -p[2], p[1])
def mat(name, color, metal=0, rough=.5, alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    rgb=tuple(int(color[i:i+2],16)/255 for i in (1,3,5))
    linear=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*linear,alpha)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Alpha'].default_value=alpha
    if alpha<1: m.surface_render_method='DITHERED'
    materials[name]=m

for args in [('Black','#181b1c',0,.45),('Gasket','#0b0d0e',0,.8),
             ('Silver','#bec4c8',.75,.26),('Brass','#b5a16c',.65,.35),
             ('PCB','#154f39',.05,.55),('Trace','#527960',.25,.5),
             ('White','#eff1ed',0,.38),('Ink','#242b2a',0,.6),
             ('Maroon','#712b30',0,.5),('Yellow','#e5c452',0,.5),
             ('Blue','#173f95',0,.4),('Red','#a82423',0,.4),
             ('Green','#34864a',0,.45),('Glass','#dae5e7',0,.18,.13),
             ('LedPhosphor','#fff2a1',0,.4)]: mat(*args)

def add(o, group, material):
    o.data.materials.append(materials[material]); buckets.setdefault((group,material),[]).append(o); return o
def box(group, material, center, size, bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(center)); o=bpy.context.object
    o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Folded edge','BEVEL'); mod.width=min(bevel,min(size)/4);mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return add(o,group,material)
def cyl(group,material,center,r,depth,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=T(center),rotation=(math.pi/2,0,0))
    o=bpy.context.object
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return add(o,group,material)
def ring(group,material,center,r,tube):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=T(center),rotation=(math.pi/2,0,0),major_radius=r,minor_radius=tube)
    o=bpy.context.object
    for p in o.data.polygons:p.use_smooth=True
    return add(o,group,material)
def wire(group,material,pts,r=.0014):
    c=bpy.data.curves.new('Wire','CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;c.resolution_u=8
    s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for p,co in zip(s.bezier_points,pts):p.co=T(co);p.handle_left_type=p.handle_right_type='AUTO'
    o=bpy.data.objects.new('Wire',c);bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH');return add(bpy.context.object,group,material)
font=bpy.data.fonts.load(FONT)
def label(group,material,body,c,height):
    curve=bpy.data.curves.new('Label','FONT');curve.body=body;curve.font=font;curve.size=height;curve.align_x='CENTER';curve.align_y='CENTER';curve.resolution_u=3
    o=bpy.data.objects.new('Label',curve);bpy.context.collection.objects.link(o);o.location=T(c);o.rotation_euler.x=math.pi/2
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH');add(bpy.context.object,group,material)
def screw(group,x,y,z,r=.003):
    cyl(group,'Brass',(x,y,z),r,.002,24)
    box(group,'Ink',(x,y,z+.0011),(r*1.35,.0006,.0003),0)
    box(group,'Ink',(x,y,z+.0012),(.0006,r*1.35,.0003),0)
def export(name,path,extras):
    root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
    for k,v in extras.items():root[k]=v
    made=[root];groups={}
    for (group,material),objs in buckets.items():
        if group not in groups:
            g=bpy.data.objects.new(group,None);bpy.context.collection.objects.link(g);g.parent=root;groups[group]=g;made.append(g)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1:bpy.ops.object.join()
        o=bpy.context.object
        o.name=group+'_'+material;o.parent=groups[group];made.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in made:o.select_set(True)
    dest=ROOT/'models/gltf'/path
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
    print('EXPORTED',dest,'objects',len(made))
    for o in made:bpy.data.objects.remove(o,do_unlink=True)
    buckets.clear()

# 검은 ABS 취부판·얇은 외벽·투명 폴리카보네이트 덮개.
g='EmergencyPowerBody'
box(g,'Black',(0,0,.003),(BOX_W,BOX_H+.014,.006),.003)
for x in [-1,1]:box(g,'Black',(x*(BOX_W/2-.003),0,BOX_D/2),(.006,BOX_H,BOX_D),.002)
for y in [-1,1]:box(g,'Black',(0,y*(BOX_H/2-.003),BOX_D/2),(BOX_W-.012,.006,BOX_D),.002)
for y in [-1,1]:screw(g,0,y*(BOX_H/2+.003),.007,.004)
box(g,'PCB',(.044,0,.010),(.177,.178,.003))
for x in [-.032,.117]:
    for y in [-.079,.079]:screw(g,x,y,.013,.0025)
# 좌측 축전지와 명판, 우측 변압기·릴레이·퓨즈·단자대.
box(g,'Gasket',(-.083,-.003,.027),(.098,.164,.038),.004)
box(g,'Silver',(-.087,0,.048),(.013,.173,.002))
box(g,'White',(-.080,-.002,.051),(.112,.145,.001),.0002)
box(g,'Maroon',(-.080,.053,.052),(.106,.028,.0005),0)
label(g,'White','정전시 조명장치',(-.080,.056,.0526),.009)
for text,y in [('MODEL   JEM-800',.025),('입력  AC110/220V',.007),('축전지   12V',-.011),('사용램프  LED',-.029),('정석전기',-.054)]:label(g,'Ink',text,(-.080,y,.0526),.006)
for y in [.036,.017,-.001,-.019,-.039]:box(g,'Silver',(-.080,y,.052),(.105,.0005,.0003),0)
box(g,'Silver',(.100,.038,.030),(.041,.066,.036))
box(g,'Yellow',(.100,.038,.048),(.028,.052,.010),.002)
label(g,'Ink','12V',(.100,.038,.0535),.007)
for x in [.018,.054]:
    box(g,'Gasket',(x,-.017,.025),(.028,.031,.024))
    label(g,'White','RELAY',(x,-.017,.0375),.0035)
for i in range(6):
    x=-.012+i*.015
    box(g,'Green',(x,-.070,.021),(.014,.023,.018))
    screw(g,x,-.070,.031,.0024)
    box(g,'Gasket',(x,-.078,.032),(.007,.004,.001),0)
for x,y in [(.027,.066),(.074,-.041),(.120,-.049)]:
    cyl(g,'Black',(x,y,.023),.006,.022)
    cyl(g,'Silver',(x,y,.0345),.0055,.001)
for i in range(9):
    x=-.022+(i%3)*.027;y=.070-(i//3)*.021
    box(g,'Trace',(x,y,.012),(.018,.001,.0006),0)
    box(g,'Yellow',(x,y,.016),(.010,.003,.004))
    for s in [-1,1]:box(g,'Silver',(x+s*.006,y,.014),(.003,.001,.001),0)
box(g,'Silver',(.030,-.045,.020),(.033,.004,.004))
cyl(g,'Red',(-.030,-.045,.018),.003,.006,20)
cyl('PowerStatus','Green',(-.030,-.059,.018),.003,.006,20)
wire(g,'Red',[(-.10,.082,.035),(-.066,.083,.053),(-.014,.076,.052),(.050,.031,.043),(.076,.025,.038)])
wire(g,'Blue',[(-.10,.076,.033),(-.063,.078,.050),(-.010,.068,.048),(.050,.023,.040),(.076,.018,.038)])
box(g,'White',(.076,.022,.039),(.013,.019,.012))
for y in [-1,1]:
    box(g,'Silver',(0,y*(BOX_H/2-.002),BOX_D),(BOX_W,.003,.003))
for x in [-1,1]:box(g,'Silver',(x*(BOX_W/2-.002),0,BOX_D),(.003,BOX_H,.003))
box('TransparentCover','Glass',(0,0,BOX_D),(BOX_W-.006,BOX_H-.006,.002),.001)
export('EmergencyPowerUnit','emergency_power_unit.glb',{'width':BOX_W,'height':BOX_H,'depth':BOX_D,'cableExit':[BOX_W/2,0,.022]})

g='EmergencyLampBody'
cyl(g,'White',(0,0,.005),LAMP_R,.010,64)
ring(g,'Silver',(0,0,.008),LAMP_R-.001,.0015)
ring(g,'White',(0,0,LAMP_D-.002),LAMP_R-.004,.002)
cyl(g,'White',(0,0,BOARD_Z),LAMP_R-.008,.0015,64)
cyl(g,'Brass',(0,0,LED_Z),.008,.002,32)
cyl(g,'Gasket',(0,0,LED_Z+.0011),.0055,.0005,32)
for x,y in LEDS:
    box(g,'Silver',(x,y,LED_Z-.0005),(LED_SIZE+.002,LED_SIZE+.001,.001),.0001)
    box(g,'White',(x,y,LED_Z),(LED_SIZE+.001,LED_SIZE+.001,.0015),.0002)
    box('LampLEDs','LedPhosphor',(x,y,LED_Z+.001),(LED_SIZE,LED_SIZE,.0008),.0002)
for a in [45,135,225,315]:
    t=math.radians(a);screw(g,.047*math.cos(t),.047*math.sin(t),LED_Z,.0023)
for x in [-.033,.033]:
    box(g,'Ink',(x,0,LED_Z),(.005,.004,.002),.0002)
    for y in [-.003,.003]:box(g,'Silver',(x,y,LED_Z-.0005),(.004,.002,.0007),0)
label(g,'Ink','12V',(0,.048,LED_Z),.005)
label(g,'Ink','LED',(0,-.036,LED_Z),.0035)
label(g,'Ink','+',(0.047,0,LED_Z),.004)
# 가장자리 위 투명 얇은 렌즈. LED 패키지가 보이는 실사형.
cyl('LampLens','Glass',(0,0,LAMP_D),LAMP_R-.005,.001,64)
export('EmergencyRoundLamp','emergency_round_lamp.glb',{'radius':LAMP_R,'depth':LAMP_D,'ledCount':len(LEDS),'ledFaceZ':LED_Z+.0014})
