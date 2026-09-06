# -*- coding: utf-8 -*-
# =============================================================================
#  삼각키 어셈블리 검증 렌더 스크립트
# =============================================================================

import bpy
import math
import os

OUTPUT_IMG = r"C:\Users\goodm\Desktop\simmul\.shot-tri-key.png"


def setup_render():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    glb_path = r"C:\Users\goodm\Desktop\simmul\models\gltf\triangle_key_assembly.glb"
    bpy.ops.import_scene.gltf(filepath=glb_path)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEE_NEXT') else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.filepath = OUTPUT_IMG

    # 카메라 설정: 후면 회전 캠과 드라이브 핀이 보이는 사선 뷰
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_obj.location = (-0.08, 0.08, -0.08)
    cam_obj.rotation_euler = (math.radians(135), 0, math.radians(-135))

    # 조명
    light_data = bpy.data.lights.new("KeyLight", type='POINT')
    light_data.energy = 15.0
    light_obj = bpy.data.objects.new("KeyLight", light_data)
    scene.collection.objects.link(light_obj)
    light_obj.location = (0.05, -0.10, 0.08)

    fill_data = bpy.data.lights.new("FillLight", type='POINT')
    fill_data.energy = 8.0
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    scene.collection.objects.link(fill_obj)
    fill_obj.location = (-0.08, 0.05, -0.04)

    world = bpy.data.worlds.new("RenderWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.15, 0.16, 0.18, 1.0)

    bpy.ops.render.render(write_still=True)
    print(f"[Render] Triangle key preview saved to {OUTPUT_IMG}")


if __name__ == "__main__":
    setup_render()
