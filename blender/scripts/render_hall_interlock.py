"""Render the exported field interlock itself, without rebuilding the GLB."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.shot-interlock-field'
OUT.mkdir(exist_ok=True)
def T(x,y,z): return (x,-z,y)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/gltf/hall_interlock.glb'))
for name in ('LinkStock','LinkFoot'):
    bpy.data.objects[name].hide_render=True
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1400
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral workshop')
scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background')
bg.inputs[0].default_value=(0.23,0.25,0.28,1)
bg.inputs[1].default_value=0.35
scene.view_settings.view_transform='AgX'

def aim(o,target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size in [
    ('Large softbox',(-0.15,0.32,-0.32),14,0.45),
    ('Edge strip',(0.30,0.15,0.05),9,0.20),
    ('Front fill',(0.08,-0.10,-0.30),4,0.25)]:
    d=bpy.data.lights.new(name,'AREA')
    d.energy,d.shape,d.size=power,'DISK',size
    o=bpy.data.objects.new(name,d)
    scene.collection.objects.link(o)
    o.location=T(*loc)
    aim(o,T(0.035,0,-0.015))
c=bpy.data.cameras.new('InspectionCamera')
c.lens=58
cam=bpy.data.objects.new('InspectionCamera',c)
scene.collection.objects.link(cam)
scene.camera=cam
def shot(name,loc,target):
    cam.location=T(*loc)
    aim(cam,T(*target))
    scene.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)
shot('blender-closed.png',(0.055,0.16,-0.65),(0.035,-0.005,-0.015))
hook=bpy.data.objects['Hook']
data=bpy.data.objects['InterlockRoot']['latch']
# App -Z rotation maps to Blender -Y rotation.
hook.rotation_euler.y=-float(data['liftRad'])
shot('blender-released.png',(0.15,0.075,-0.29),(0.11,-0.02,-0.025))
