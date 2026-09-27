"""Reference photo 095015: satin identification plate, printed ID and raised dots.
Three local +Z is the display face. Dimensions here are the model source.
QR encodes the simulator identifier only, not a live installation lookup.
"""
import bpy, math
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
NUMBER = '0001-001'
WIDTH, HEIGHT, THICKNESS = .210, .064, .0012
CORNER = .002
DOT_R, DOT_PITCH, CELL_PITCH = .0008, .0026, .0065
QR_PAYLOAD = '0001-001'
# QR version 1 / M, generated from QR_PAYLOAD. Keep payload and matrix together.
QR = '''111111100011001111111
100000100111101000001
101110100101101011101
101110100100101011101
101110100101101011101
100000101000001000001
111111101010101111111
000000000100000000000
100101101011110100000
001000011001010101010
010111110101001110111
001110000100111110011
100001111101011100101
000000001010011111000
111111100111101010000
100000101110001100110
101110100110111010101
101110101110011101111
101110100011011011101
100000100011100110001
111111101110010011100'''.splitlines()
assert QR_PAYLOAD == NUMBER
T = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, color, metal, rough):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

steel=material('IdentificationSatinSteel',(.64,.65,.62),.78,.36)
ink=material('IdentificationBlackInk',(.008,.010,.010),0,.8)
font=bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
bold=bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')

def box(name, dims, pos, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name
    o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        m=o.modifiers.new('Soft machined rim','BEVEL');m.width=bevel;m.segments=3
        bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
    return o

plate=box('IdentificationPlateBody',(WIDTH,HEIGHT,THICKNESS),(0,0,THICKNESS/2),steel,.00045)

def text(name, body, x,y,width,height,heavy=False):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.font=bold if heavy else font;c.size=1
    c.align_x='CENTER';c.align_y='CENTER';c.resolution_u=3
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=(x,y,THICKNESS+.000035)
    o.data.materials.append(ink);bpy.context.view_layer.update()
    o.scale=(width/max(o.dimensions.x,.001),height/max(o.dimensions.y,.001),1)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target='MESH');o.select_set(False)

bpy.ops.object.select_all(action='DESELECT')
text('IdentificationHeading','승강기번호(ID)',-.031,.022,.070,.007,True)
text('IdentificationNumber',NUMBER,-.030,.005,.142,.024,True)
text('IdentificationFooter','승강기 위치 및 정보 확인 시 사용하는 식별번호입니다.',-.027,-.024,.147,.005)
text('IdentificationQrHeading','국가승강기정보센터',.075,.025,.045,.0045,True)
text('IdentificationWebsite','www.elevator.go.kr',.075,-.025,.046,.004)

# Numerical braille: number sign, four digits, hyphen, three digits.
cells=[(3,4,5,6),(2,4,5),(2,4,5),(2,4,5),(1,),(3,6),(2,4,5),(2,4,5),(1,)]
for ci,cell in enumerate(cells):
    for dot in cell:
        x=-.098+ci*CELL_PITCH+(DOT_PITCH if dot>3 else 0)
        y=-.011-((dot-1)%3)*DOT_PITCH
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=DOT_R,location=(x,y,THICKNESS))
        o=bpy.context.object;o.name='IdentificationBraille';o.scale.z=.6;o.data.materials.append(steel)
        for poly in o.data.polygons:poly.use_smooth=True

# Flat ink QR modules, no displacement or heavy texture needed.
pitch=.00165;half=len(QR)*pitch/2;verts=[];faces=[]
for row,line in enumerate(QR):
    for col,v in enumerate(line):
        if v!='1':continue
        x=.075-half+col*pitch;y=half-row*pitch;z=THICKNESS+.00004;i=len(verts)
        verts.extend([(x,y,z),(x+pitch,y,z),(x+pitch,y-pitch,z),(x,y-pitch,z)])
        faces.append((i+3,i+2,i+1,i))
mesh=bpy.data.meshes.new('IdentificationQrInk');mesh.from_pydata(verts,[],faces);mesh.materials.append(ink)
o=bpy.data.objects.new('IdentificationQrInk',mesh);bpy.context.collection.objects.link(o)

# Batch by material, keeping the entire identification plate as a separate asset.
for mat in [steel,ink]:
    bpy.ops.object.select_all(action='DESELECT')
    parts=[o for o in list(bpy.context.scene.objects) if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    o=bpy.context.object;o.name='IdentificationMetal' if mat==steel else 'IdentificationPrinting'
    o.matrix_world=T@o.matrix_world
root=bpy.data.objects.new('CarIdentificationPlate',None);bpy.context.collection.objects.link(root)
root['number']=NUMBER;root['width']=WIDTH;root['height']=HEIGHT;root['thickness']=THICKNESS;root['qrPayload']=QR_PAYLOAD
for o in list(bpy.context.scene.objects):
    if o!=root:o.parent=root
bpy.ops.object.select_all(action='SELECT')
dest=ROOT/'models/gltf/car_identification_plate.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
print('Exported',dest)
