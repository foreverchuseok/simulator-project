"""Pit counterweight guard: parts manual pp.254-255, photo shape only.
Metres; fixed yellow folded steel sheets. Model dimensions are educational
choices except the manual's 100-300 mm floor clearance and M6x10 fixings.
S.CWT_W is read from config.js; GLB extras carry all mounting dimensions.
"""
import re
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
CONFIG = (ROOT / 'js/config.js').read_text(encoding='utf-8')
RAIL_SPAN = float(re.search(r'CWT_W:\s*([\d.]+)', CONFIG)[1])
WIDTH = RAIL_SPAN + 0.22
HEIGHT, FLOOR_GAP, THICKNESS = 2.0, 0.20, 0.0015
FRONT_OFFSET, FOLD, SEAM = 0.15, 0.018, 0.002
BRACKET_H, BRACKET_T = 0.035, 0.004
ROWS = (0.06, 0.65, 1.35, HEIGHT - 0.06)
YELLOW = (1.0, 0.72, 0.015, 1)

def T(x,y,z): return (x,-z,y)

def material(name,color,metal,rough):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=color
    b.inputs['Metallic'].default_value=metal
    b.inputs['Roughness'].default_value=rough
    return m

def box(name,size,pos,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=T(*pos))
    o=bpy.context.object; o.name=name
    o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    return o

def bolt(x,y,z,mat):
    # M6x10 shank, washer and hexagonal head along Three.js Z.
    for name,r,d,dz,n in [('M6x10',.003,.010,-.005,10),
                          ('M6Washer',.006,.001,.0005,12),
                          ('M6Head',.005,.004,.003,6)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=T(x,y,z+dz))
        o=bpy.context.object; o.name=name; o.rotation_euler[0]=1.5707963267948966
        o.data.materials.append(mat)

def join(objects,name,root):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); o=bpy.context.object; o.name=name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); o.parent=root
    return o

def build():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    yellow=material('PitScreenYellow',YELLOW,.25,.48)
    zinc=material('PitScreenFasteners',(.60,.64,.68,1),.75,.4)
    root=bpy.data.objects.new('PitScreen',None); bpy.context.collection.objects.link(root)
    panel_width=(WIDTH-SEAM)/2
    for sign,label in [(-1,'Left'),(1,'Right')]:
        cx=sign*(WIDTH+SEAM)/4
        parts=[box('ThinSheet',(panel_width,HEIGHT,THICKNESS),(cx,HEIGHT/2,0),yellow)]
        # Returned edges show thin sheet construction and stiffen the panels.
        for x in (cx-panel_width/2+THICKNESS/2,cx+panel_width/2-THICKNESS/2):
            parts.append(box('VerticalFold',(THICKNESS,HEIGHT,FOLD),(x,HEIGHT/2,-FOLD/2),yellow))
        for y in (THICKNESS/2,HEIGHT-THICKNESS/2):
            parts.append(box('HorizontalFold',(panel_width,THICKNESS,FOLD),(cx,y,-FOLD/2),yellow))
        join(parts,'PitScreenPanel'+label,root)
    before=set(bpy.data.objects)
    for y in ROWS:
        for sign in (-1,1):
            box('CrossBracket',(panel_width-.030,BRACKET_H,BRACKET_T),
                (sign*(WIDTH+SEAM)/4,y,-THICKNESS/2-BRACKET_T/2),yellow)
        for sign in (-1,1):
            # Arms outside the moving shoes, pads meet the rail front flange.
            x=sign*(RAIL_SPAN/2+.052)
            rear=.045-FRONT_OFFSET
            box('BracketReturn',(BRACKET_T,BRACKET_H,-THICKNESS/2-rear),
                (x,y,(rear-THICKNESS/2)/2),yellow)
            box('RailClampPad',(.050,BRACKET_H,BRACKET_T),
                (sign*(RAIL_SPAN/2+.029),y,.043-FRONT_OFFSET),yellow)
            box('RailBackClip',(.004,BRACKET_H,.010),
                (sign*(RAIL_SPAN/2+.0025),y,.040-FRONT_OFFSET),yellow)
    join(list(set(bpy.data.objects)-before),'PitScreenBrackets',root)
    before=set(bpy.data.objects)
    for y in ROWS:
        for x in (-WIDTH/2+.035,-.035,.035,WIDTH/2-.035): bolt(x,y,THICKNESS/2,zinc)
        for sign in (-1,1): bolt(sign*(RAIL_SPAN/2+.008),y,.045-FRONT_OFFSET,zinc)
    join(list(set(bpy.data.objects)-before),'PitScreenBolts',root)
    root['pitScreen']={'version':1,'railSpan':RAIL_SPAN,'width':WIDTH,'height':HEIGHT,
                       'floorGap':FLOOR_GAP,'sheetThickness':THICKNESS,
                       'frontOffset':FRONT_OFFSET,'foldDepth':FOLD,'seam':SEAM,
                       'bracketRows':list(ROWS),'reference':'Parts manual 254-255'}
    path=ROOT/'models/gltf/pit_screen.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_extras=True,
                              export_apply=True,export_animations=False)
    print('Pit screen exported:',path)

if __name__=='__main__': build()
