"""TERRACE-inspired stepped ceiling. X/Z normalized to cabin footprint, Y in metres.
Single contract: js/car-terrace.js TERRACE_CEILING. Runtime derives footprint from S.
Export has four material batches; bevels and recessed LED channels are real geometry.
"""
import bpy, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads(re.search(r'const TERRACE_CEILING = (\{[^;]+\});', (ROOT/'js/car-terrace.js').read_text(encoding='utf-8')).group(1))
DROP, CW, LW = SPEC['drop'], SPEC['centerWidth'], SPEC['lightWidth']
STEPS, RISE = SPEC['steps'], SPEC['stepRise']
BEVEL = .0012
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
root = bpy.data.objects.new('TerraceCeiling', None)
bpy.context.collection.objects.link(root)
for k, v in SPEC.items(): root[k] = v
materials = {}
for name, color in [('TerraceDark',(.05,.05,.05,1)),('TerraceSilver',(.5,.5,.5,1)),('TerraceWhite',(.8,.8,.8,1)),('TerraceLight',(1,.95,.85,1))]:
    m = bpy.data.materials.new(name); m.diffuse_color=color; m.use_nodes=True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
    materials[name]=m
buckets = {}
def box(name, mat, x,y,z,w,h,d):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,-z,y))
    o=bpy.context.object; o.name=name; o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(materials[mat])
    mod=o.modifiers.new('Machined edge','BEVEL');mod.width=min(BEVEL,h/4,w/4,d/4);mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    buckets.setdefault(mat,[]).append(o)

box('RecessBacking','TerraceDark',0,-.009,0,1,.018,1)
for side in [-1,1]:
    sw=(1-CW)/2-LW-.008
    box('SideSoffit','TerraceSilver',side*(.5-sw/2),-DROP+.012,0,sw,.024,.985)
    box('LongLightChannel','TerraceDark',side*(CW/2+LW/2),-DROP+.009,0,LW+.009,.018,.98)
    box('LongOpalLens','TerraceLight',side*(CW/2+LW/2),-DROP+.001,0,LW,.004,.966)
    # Discreet ventilation slots at the rear side soffits.
    for i in range(7):
        box('VentSlot','TerraceDark',side*(.5-sw/2),-DROP-.0005,-.39+i*.016,sw*.50,.0015,.005)
for i in range(STEPS):
    length=.96/STEPS;z=-.48+length*(i+.5)
    y=-DROP+.014+RISE*i
    box('SteppedCeilingPanel','TerraceWhite',0,y,z,CW-.012,.016,length-.01)
    if i<STEPS-1:
        box('StepRiser','TerraceSilver',0,y+RISE/2,z+length/2-.004,CW-.012,RISE+.014,.006)
        box('CrossOpalLens','TerraceLight',0,y-.007,z+length/2-.013,CW-.022,.003,.009)
for mat, objects in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=mat+'Geometry';o.parent=root
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'models/gltf/car_terrace_ceiling.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True)
print('EXPORTED',out)
