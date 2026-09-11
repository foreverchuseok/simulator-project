# -*- coding: utf-8 -*-
# =============================================================================
#  착상장치 차폐판(Leveling Vane) 렌더 검증 스크립트
# =============================================================================

import bpy
import math
import os

OUTPUT_IMG = r"C:\Users\goodm\Desktop\simmul\.shot-leveling-vane.png"


def setup_render():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # 1. 13K 가이드 레일 로드
    rail_path = r"C:\Users\goodm\Desktop\simmul\models\gltf\guide_rail_13k.glb"
    if os.path.exists(rail_path):
        bpy.ops.import_scene.gltf(filepath=rail_path)

    # 2. leveling_vane.glb 로드
    vane_path = r"C:\Users\goodm\Desktop\simmul\models\gltf\leveling_vane.glb"
    bpy.ops.import_scene.gltf(filepath=vane_path)

    # 렌더 세팅
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEE_NEXT') else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.filepath = OUTPUT_IMG

    # 카메라 설정: 차폐판, 찬넬 암, 레일 클립이 잘 보이는 사선 뷰
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # 위치 (Blender 좌표계: X=좌우, Y=전후, Z=상하)
    # Three.js (x=0.03, y=0, z=0.18) -> Blender (X=0.03, Y=-0.18, Z=0)
    cam_obj.location = (0.50, -0.65, 0.30)
    cam_obj.rotation_euler = (math.radians(65), 0, math.radians(45))

    # 조명 설정
    light_data = bpy.data.lights.new("Sun", type='SUN')
    light_data.energy = 4.0
    light_obj = bpy.data.objects.new("Sun", light_data)
    scene.collection.objects.link(light_obj)
    light_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(30))

    fill_data = bpy.data.lights.new("Fill", type='POINT')
    fill_data.energy = 100.0
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    scene.collection.objects.link(fill_obj)
    fill_obj.location = (0.1, -0.4, 0.2)

    # 배경
    world = bpy.data.worlds.new("RenderWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.05, 0.06, 0.08, 1.0) # 어두운 톤 배경으로 금속 광택 강조

    # 렌더 실행
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered Leveling Vane verification image to: {OUTPUT_IMG}")


if __name__ == "__main__":
    setup_render()
