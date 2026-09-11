# -*- coding: utf-8 -*-
# =============================================================================
#  착상장치 차폐판 어셈블리 (LCD Vane Assembly / Leveling Vane)
#  MR_설계.pdf 186~187p (책 184~185p) 20.4 착상장치 차폐판(LCD Vane) 설치 - 레일 부착형
#  레일 고정부는 위 도면을 유지, 2026-09-11 현장사진의 민판 형상으로 갱신.
#
#  - 원점 (0, 0, 0): 카 가이드 레일(13K) 배면 중심 (차폐판 중심 높이 Y=0)
#  - 13K 가이드 레일 베이스 플랜지 고정 클립 2조 + M12 체결 볼트/너트
#  - 위치 조절용 슬롯 암 (Support Channel Arm: ㄷ자 찬넬 강재 + 장공 슬롯)
#  - 차폐판 체결용 L 마운트 브라켓 + M10 볼트/너트
#  - 차폐판 치수: index.html LCD_* 공용 계약. 센서 통과부는 돌출물 없는 평판.
#  - PBR 아연도금 스틸 재질 (Galvanized Steel)
# =============================================================================

import bpy
import bmesh
import math
import os
import re

# Three.js 공용 계약을 읽어 평판 크기와 검출축을 동기화한다.
INDEX_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'index.html')
with open(INDEX_PATH, encoding='utf-8') as contract_file:
    CONTRACT = contract_file.read()
def contract_number(name):
    match = re.search(r'const\s+' + name + r'\s*=\s*([0-9.]+)\s*;', CONTRACT)
    if not match:
        raise ValueError('Missing numeric LCD contract: ' + name)
    return float(match.group(1))
VANE_H = contract_number('LCD_VANE_H')
VANE_W = contract_number('LCD_VANE_W')
VANE_T = contract_number('LCD_VANE_T')
VANE_OFFSET_Z = contract_number('LCD_VANE_OFFSET_Z')
VANE_X_OFFSET = contract_number('LCD_VANE_X_OFFSET')

OUTPUT_DIR = r"C:\Users\goodm\Desktop\simmul\models\gltf"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "leveling_vane.glb")


def T(x, y, z):
    """Three.js (Y-up, Z-front) -> Blender (Z-up, -Y-front)"""
    return (x, -z, y)


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def make_material(name, rgb, metallic=0.75, roughness=0.35):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_box(name, sx, sy, sz, px, py, pz, mat, parent=None):
    """Three.js 좌표계(px, py, pz, 크기 sx, sy, sz) 기준 직육면체 생성"""
    bx, by, bz = T(px, py, pz)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, by, bz))
    obj = bpy.context.active_object
    obj.name = name
    # Blender scale: X=sx, Y=sz, Z=sy
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_cylinder(name, r, h, px, py, pz, mat, axis='y', parent=None):
    """Three.js 좌표계 기준 원통 생성"""
    bx, by, bz = T(px, py, pz)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=16, location=(bx, by, bz))
    obj = bpy.context.active_object
    obj.name = name

    # 축 회전
    if axis == 'x':
        # Three.js X축 (Blender X축)
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'z':
        # Three.js Z축 (Blender -Y축)
        obj.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'y':
        # Three.js Y축 (Blender Z축)
        obj.rotation_euler = (0, 0, 0)

    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def build_leveling_vane():
    reset_scene()

    # 재질 정의
    mat_vane = make_material("Mat_VaneGalv", (0.85, 0.88, 0.90), metallic=0.75, roughness=0.32) # 밝은 아연도금
    mat_arm = make_material("Mat_ArmSteel", (0.75, 0.78, 0.82), metallic=0.70, roughness=0.38)  # 지지 찬넬
    mat_clip = make_material("Mat_ClipGold", (0.85, 0.65, 0.15), metallic=0.60, roughness=0.40) # 크로메이트 클립
    mat_bolt = make_material("Mat_BoltSteel", (0.90, 0.92, 0.95), metallic=0.85, roughness=0.25) # 볼트/너트
    mat_dark = make_material("Mat_SlotDark", (0.15, 0.17, 0.20), metallic=0.20, roughness=0.80) # 장공 홀 음영

    # 루트 오브젝트
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "LevelingVaneAssembly"

    flange_half_z = 0.0445  # 13K 레일 플랜지 반폭 (89mm / 2)
    arm_x = -0.014          # 레일 배면 뒤 찬넬 베이스 X
    arm_w = 0.012           # 암 X 두께
    arm_h = 0.036           # 암 Y 높이
    target_z = VANE_OFFSET_Z # 검출축. 평판은 축 뒤 110mm ~ 앞 20mm.
    z_start = -flange_half_z - 0.020 # 레일 클립 후방 여유 물림
    arm_end_z = target_z - VANE_W + 0.020
    arm_len = arm_end_z - z_start
    arm_mid_z = (z_start + arm_end_z) / 2

    # 1. 13K 레일 베이스 클립 2조 (Z = ±flange_half_z)
    for sg in [-1, 1]:
        cz = sg * flange_half_z
        # 클립 바디 (황금색/크로메이트 아연)
        add_box(f"RailClip_{sg}", 0.032, 0.026, 0.020, -0.005, 0, cz, mat_clip, root)
        # M12 체결 볼트 (X축 방향 관통)
        bolt = add_cylinder(f"ClipBolt_{sg}", 0.006, 0.046, -0.010, 0, cz, mat_bolt, axis='x', parent=root)
        # 너트 & 와셔
        add_cylinder(f"ClipNut_{sg}", 0.010, 0.008, 0.012, 0, cz, mat_bolt, axis='x', parent=root)

    # 2. 수평 지지 찬넬 암 (Support Channel Arm)
    # 웹(Web) 판재
    add_box("ArmWeb", arm_w, arm_h, arm_len, arm_x, 0, arm_mid_z, mat_arm, root)
    # 찬넬 상/하부 플랜지 (C형 단면 형태)
    add_box("ArmFlangeTop", 0.020, 0.004, arm_len, arm_x - 0.010, arm_h / 2 - 0.002, arm_mid_z, mat_arm, root)
    add_box("ArmFlangeBot", 0.020, 0.004, arm_len, arm_x - 0.010, -arm_h / 2 + 0.002, arm_mid_z, mat_arm, root)

    # 암 전후 위치 조절용 장공 슬롯 2개 (어두운 음영 슬롯 박스)
    for sz in [0.060, 0.120]:
        add_box(f"ArmSlot_{sz}", 0.002, 0.012, 0.038, arm_x + arm_w / 2 + 0.001, 0, sz, mat_dark, root)

    # 3. 차폐판 결합용 L 마운트 브라켓 (Mount Angle Bracket)
    # 암 끝단에서 카 쪽(+X)으로 꺾이는 L자 브라켓
    l_base_z = arm_end_z
    # 암에 볼팅되는 면 (Z 평면)
    add_box("MountAngleZ", 0.005, 0.040, 0.040, arm_x + 0.008, 0, l_base_z - 0.015, mat_arm, root)
    # 차폐판이 볼팅되는 전면 플랜지 (X 평면)
    vane_mount_x = arm_x + 0.045
    add_box("MountAngleX", 0.040, 0.040, 0.005, arm_x + 0.025, 0, l_base_z, mat_arm, root)
    # 브라켓 체결 볼트/너트 2개
    for dy in [-0.012, 0.012]:
        add_cylinder(f"MountBolt_{dy}", 0.005, 0.018, vane_mount_x - 0.010, dy, l_base_z, mat_bolt, axis='z', parent=root)

    # 4. 차폐판 — 현장사진 비례 재구성, index.html 공용 치수
    vane_h, vane_w, vane_t = VANE_H, VANE_W, VANE_T
    vane_x = VANE_X_OFFSET
    vane_z = arm_end_z

    # 4-1. 메인 차폐 평판 (Main Vane Body)
    add_box("VanePlate", vane_t, vane_h, vane_w, vane_x, 0, vane_z + vane_w / 2, mat_vane, root)

    # 사진6: 센서 통과부는 립·볼트·구멍 없는 평판. 고정부는 슬롯 입구 뒤에 둔다.
    add_box('VaneAttachmentTab', 0.028, 0.030, 0.006,
            vane_x - 0.014, 0, vane_z + 0.003, mat_arm, root)

    # glTF 내보내기 설정
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=False
    )
    print(f"[SUCCESS] Exported Leveling Vane GLB to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_leveling_vane()
