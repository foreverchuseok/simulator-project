"""Gold-toned stainless lower door retention shoe. Origin: groove 2 centre at sill top.
Visual reconstruction requested by user, not a strength-tested product model.
Dimensions come from HALL_RETENTION and the current sill constants in elevator.js.
"""
import bpy, json, re, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
JS=(ROOT/'js/elevator.js').read_text(encoding='utf-8')
C=json.loads(re.search(r'const HALL_RETENTION = (\{.*?\});',(ROOT/'js/hall-retention.js').read_text(encoding='utf-8'))[1])
def number(name):return float(re.search(r'const\s+'+name+r'\s*=\s*(-?[\d.]+)',JS)[1])
GROOVE_W=number('SILL_GROOVE_W');BACK_Z=-number('SILL_GROOVE2_Z')-number('HATCH_DT')/2
W,PW,TOP,BOT=C['bladeW'],C['plateW'],C['plateTop'],C['plateBottom']
T=C['plateT'];BEVEL=.0005;BOLT_X=.068;BOLT_Y=.026
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('HallRetentionModel',None);bpy.context.collection.objects.link(root)
for k,v in {**C,'backZ':BACK_Z,'grooveWidth':GROOVE_W}.items():root[k]=v
def material(name,rgb,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
gold=material('Champagne stainless',(.48,.36,.18),.72,.36)
fastener=material('Satin gold fasteners',(.58,.48,.30),.78,.31)
def box(name,c,d,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(c[0],-c[2],c[1]));o=bpy.context.object;o.name=name;o.dimensions=(d[0],d[2],d[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);o.parent=root
    mod=o.modifiers.new('Fold edge radius','BEVEL');mod.width=BEVEL;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name);return o
plate=box('RetentionMount',(0,(TOP+BOT)/2,BACK_Z-T/2),(PW,TOP-BOT,T),gold)
# Two actual elongated fixing holes in the broad mounting plate.
for x in (-BOLT_X,BOLT_X):
    cutter=box('Slot cutter',(x,BOLT_Y,BACK_Z-T/2),(.012,.016,.020),gold)
    mod=plate.modifiers.new('Fixing slot','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
box('RetentionBridge',(0,C['bridgeY'],(BACK_Z-T-.006)/2),(W,C['bridgeT'],BACK_Z-T+.006),gold)
box('RetentionBlade',(0,(C['bladeBottom']+C['bladeTop'])/2,0),(W,C['bladeTop']-C['bladeBottom'],GROOVE_W-.002),gold)
bolts=[]
for x in (-BOLT_X,BOLT_X):
    for name,r,d,z,n in [('Washer',.009,.0015,BACK_Z-T-.00075,32),('HexHead',.0055,.004,BACK_Z-T-.0035,6)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=(x,-z,BOLT_Y),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.materials.append(fastener);o.parent=root;bolts.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bolts:o.select_set(True)
bpy.context.view_layer.objects.active=bolts[0];bpy.ops.object.join();bpy.context.object.name='RetentionFasteners'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models/gltf/hall_door_retention.glb'),export_format='GLB',export_extras=True)
