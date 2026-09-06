# -*- coding: utf-8 -*-
# =============================================================================
#  승장 도어 실 (Hall Door Sill) — 헤드리스 렌더링 검증 스크립트
# =============================================================================

import bpy
import math
import os

GLB_PATH = r"C:\Users\goodm\Desktop\simmul\models\gltf\hall_sill.glb"
RENDER_PATH = r"C:\Users\goodm\Desktop\simmul\.shot-sill-render.png"


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


reset_scene()

# GLB 임포트
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

# 카메라 설정 (실사 145219.png / 145254.png와 유사한 위에서 내려다보는 사선 뷰)
cam_data = bpy.data.cameras.new("RenderCam")
cam_data.lens = 45
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)

# 위치 및 각도
cam_obj.location = (0.20, 0.25, 0.22)
cam_obj.rotation_euler = (math.radians(52), 0, math.radians(140))
bpy.context.scene.camera = cam_obj

# 조명 설정 (3점 조명)
# 1. 주광 (Key Light)
light_key = bpy.data.lights.new("KeyLight", type='SUN')
light_key.energy = 3.5
light_key_obj = bpy.data.objects.new("KeyLight", light_key)
light_key_obj.rotation_euler = (math.radians(45), math.radians(30), math.radians(45))
bpy.context.collection.objects.link(light_key_obj)

# 2. 보조광 (Fill Light)
light_fill = bpy.data.lights.new("FillLight", type='SUN')
light_fill.energy = 1.8
light_fill_obj = bpy.data.objects.new("FillLight", light_fill)
light_fill_obj.rotation_euler = (math.radians(60), math.radians(-40), math.radians(-120))
bpy.context.collection.objects.link(light_fill_obj)

# 렌더링 설정
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEENext') else 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.filepath = RENDER_PATH
scene.render.image_settings.file_format = 'PNG'

bpy.ops.render.render(write_still=True)
print(f"[SUCCESS] Rendered Hall Sill image to: {RENDER_PATH}")
