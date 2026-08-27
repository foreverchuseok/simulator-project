# -*- coding: utf-8 -*-
"""승장 인터록 확인 렌더. blender -b -P blender/scripts/render_hall_interlock.py"""
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

exec(compile(open(os.path.join(HERE, "hall_interlock.py"), encoding="utf-8").read(),
             "hall_interlock.py", "exec"))

scene = bpy.context.scene

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", type='SUN'))
sun.data.energy = 2.0
sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(30))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", type='AREA'))
fill.data.energy = 40.0
fill.data.size = 1.2
fill.location = (0.2, -0.6, 0.3)
fill.rotation_euler = (math.radians(75), 0, math.radians(15))
scene.collection.objects.link(fill)

scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.22, 0.24, 0.26, 1.0)
    bg.inputs[1].default_value = 0.5

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = 'BLENDER_EEVEE'
if hasattr(scene.render, "engine"):
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1000
scene.render.resolution_y = 800
scene.render.film_transparent = False

TARGET = T(-0.052, 0.0, 0.0)


def look_at(cam_obj, target):
    import mathutils
    d = mathutils.Vector(target) - cam_obj.location
    cam_obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def shot(name, loc):
    cam.location = loc
    look_at(cam, TARGET)
    scene.render.filepath = os.path.join(ROOT, name)
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)


# 승강로에서 로비 방향 = three +Z. 178p 옆모습처럼 롤러→키퍼가 가로로 보이게.
shot(".shot-il-blender-front.png", (-0.05, 0.28, 0.02))
shot(".shot-il-blender-iso.png", (0.08, 0.22, 0.12))
