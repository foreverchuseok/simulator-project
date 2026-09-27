"""AJO reference: SUS304 2T upper emergency guide, adapted to this C rail.
Model coordinates are relative to hanger plate centre Z and case centre Y.
The rear folded keeper and front clamp are secured through the hanger plate.
"""
import bpy, math
from pathlib import Path
from mathutils import Matrix

ROOT=Path(__file__).resolve().parents[2]
T=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
THICKNESS=.002
WIDTH=.060
MOUNT_X=.085
PLATE_T=.0035
BOTTOM=.006
BRIDGE_Y=.033
TIP_Y=.044
REAR_Z=PLATE_T/2+THICKNESS/2
TIP_Z=.010
BOLT_Y=.014
BOLT_X=.017
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('SUS304 brushed stainless');mat.use_nodes=True
p=mat.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.65,.70,.74,1)
p.inputs['Metallic'].default_value=.75;p.inputs['Roughness'].default_value=.32

def finish(o,name):
    o.name=name;o.data.materials.append(mat)
    m=o.modifiers.new('Soft folded edges','BEVEL');m.width=.00035;m.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
    return o

# One solid stepped section, including the return that captures the C-rail lip.
h=THICKNESS/2
section=[(REAR_Z-h,BOTTOM),(REAR_Z+h,BOTTOM),
 (REAR_Z+h,BRIDGE_Y-h),(TIP_Z-h,BRIDGE_Y-h),
 (TIP_Z-h,TIP_Y),(TIP_Z+h,TIP_Y),
 (TIP_Z+h,BRIDGE_Y+h),(REAR_Z-h,BRIDGE_Y+h)]
verts=[(x,y,z) for x in [-WIDTH/2,WIDTH/2] for z,y in section]
n=len(section);faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
for i in range(n):j=(i+1)%n;faces.append((i,j,n+j,n+i))
mesh=bpy.data.meshes.new('FoldedKeeper');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('FoldedKeeper',mesh);bpy.context.collection.objects.link(o)
o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
finish(o,'FoldedKeeper')

def box(name,dims,pos):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name)
box('FrontClamp',(WIDTH,.024,THICKNESS),(0,.018,-PLATE_T/2-THICKNESS/2))
for x in [-BOLT_X,BOLT_X]:
    # Washer, hex head and shank are physical meshes; the shank passes through the host.
    for name,r,depth,z,segments in [('Washer',.005,.001,-.00425,32),('HexHead',.0038,.003,-.00625,6),('Shank',.002,.007,0,16)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=depth,location=(x,BOLT_Y,z))
        finish(bpy.context.object,name)

# Single draw call per guide; nodes cloned across all floors share buffers/material.
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=o;bpy.ops.object.join()
o=bpy.context.object;o.name='EmergencyGuideSteel';o.matrix_world=T@o.matrix_world
root=bpy.data.objects.new('HallEmergencyGuideModel',None);bpy.context.collection.objects.link(root);o.parent=root
for k,v in dict(thickness=THICKNESS,width=WIDTH,mountX=MOUNT_X,plateThickness=PLATE_T,
 bridgeY=BRIDGE_Y,tipY=TIP_Y,tipZ=TIP_Z,rearZ=REAR_Z,bottom=BOTTOM).items():root[k]=v
root['material']='SUS304';root['reference']='AJO horizontal upper guide, adapted simulation geometry'
bpy.ops.object.select_all(action='SELECT')
dest=ROOT/'models/gltf/hall_emergency_guide.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_extras=True)
print('Exported',dest)
