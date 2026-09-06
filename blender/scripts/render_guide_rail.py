# -*- coding: utf-8 -*-
# =============================================================================
#  레일 브라켓 및 13K 가이드레일 조립 검증 렌더 스크립트
# =============================================================================

import bpy
import math
import os

OUTPUT_IMG = r"C:\Users\goodm\Desktop\simmul\.shot-rail-bracket.png"


def setup_render():
    # 씬 초기화
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # rail_bracket.glb 가져오기
    bkt_path = r"C:\Users\goodm\Desktop\simmul\models\gltf\rail_bracket.glb"
    bpy.ops.import_scene.gltf(filepath=bkt_path)

    # guide_rail_13k.glb 가져오기
    rail_path = r"C:\Users\goodm\Desktop\simmul\models\gltf\guide_rail_13k.glb"
    bpy.ops.import_scene.gltf(filepath=rail_path)

    # 렌더 세팅
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEE_NEXT') else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.filepath = OUTPUT_IMG

    # 카메라 설정
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # 카메라 위치: 레일 앞쪽에서 사선으로 브라켓과 레일 클립을 정면 관찰
    cam_obj.location = (0.7, -0.9, 0.4)
    cam_obj.rotation_euler = (math.radians(72), 0, math.radians(40))

    # 조명 설정 (Sun + Fill Point)
    light_data = bpy.data.lights.new("Sun", type='SUN')
    light_data.energy = 3.5
    light_obj = bpy.data.objects.new("Sun", light_data)
    scene.collection.objects.link(light_obj)
    light_obj.rotation_euler = (math.radians(45), math.radians(30), math.radians(20))

    fill_data = bpy.data.lights.new("Fill", type='POINT')
    fill_data.energy = 80.0
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    scene.collection.objects.link(fill_obj)
    fill_obj.location = (0.2, -0.8, 0.4)

    # 월드 배경 (중립 회색)
    world = bpy.data.worlds.new("RenderWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.15, 0.16, 0.18, 1.0)

    # 렌더링 실행
    bpy.ops.render.render(write_still=True)
    print(f"[Render] Preview image saved to {OUTPUT_IMG}")


if __name__ == "__main__":
    setup_render()
