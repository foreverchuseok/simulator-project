# -*- coding: utf-8 -*-
# =============================================================================
#  레일 브라켓 어셈블리 (Rail Bracket Assembly)
#  부품설계.pdf (76~88p) 및 현장 실사(103303.png, 1035051.png) 기반 정밀 모델링
#  - 1차 브라켓 (Wall Bracket, 벽체 앵글): 콘크리트 벽면 체결용 L형 강재 (L-75x75x8)
#  - M12 앵커 볼트 2세트 (너트, 평와셔, 스프링와셔, 와셔 점용접 디테일)
#  - 2차 브라켓 (Rail Arm Bracket, 레일 지지 ㄷ자 절곡 프레임, 벽~레일 352.5mm 간극 지지)
#  - 1-2차 브라켓 접합부 비드폭 5mm 모살용접 디테일
#  - 레일 배면 조절용 ㄷ자 심 라이너 팩 (Shim Liners: 1.6t, 0.8t, 0.3t)
#  - 레일 클립 2세트 (Rail Clips: 크로메이트 골드/노란색 주조 클립 + M12x45 볼트/너트)
# =============================================================================

import bpy
import bmesh
import math
import os

OUTPUT_DIR = r"C:\Users\goodm\Desktop\simmul\models\gltf"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "rail_bracket.glb")


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


def make_material(name, rgb, metallic=0.0, roughness=0.6):
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
    """Three.js 좌표계(px, py, pz, 크기 sx, sy, sz) 기준 박스 생성"""
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
    if axis == 'x':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'z':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def build_rail_bracket():
    reset_scene()

    # PBR 재질 설정
    # 강재 도장 / 아연도금 (진회색)
    mat_steel = make_material("Bracket_Steel", (0.35, 0.38, 0.42), metallic=0.7, roughness=0.45)
    # 벽면 앵커 볼트 / 일반 아연도금 볼트 (은회색)
    mat_bolt = make_material("Anchor_Bolt", (0.75, 0.78, 0.82), metallic=0.85, roughness=0.25)
    # 크로메이트 도금 (골드/옐로우) - 레일 클립 및 볼트/너트
    mat_chromate = make_material("Rail_Clip_Chromate", (0.88, 0.72, 0.15), metallic=0.75, roughness=0.35)
    # 심 라이너 (황동/금속 심)
    mat_shim = make_material("Shim_Liner", (0.82, 0.75, 0.55), metallic=0.6, roughness=0.4)
    # 용접 비드 (검정/어두운 금속)
    mat_weld = make_material("Weld_Bead", (0.2, 0.2, 0.22), metallic=0.8, roughness=0.7)

    # 루트 오브젝트
    root = bpy.data.objects.new("RailBracket_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------------------
    # 기하학적 기준:
    # 레일 배면(Base Back)이 원점 (x=0, y=0, z=0)
    # 레일은 +X 방향에 위치 (헤드가 +X를 봄)
    # 벽면은 -X 방향에 위치: 거리 DIST_WALL = 0.3525m (352.5mm)
    # 레일 축은 Y축 (수직)
    # 승강로 전후는 Z축 (카 전면 +Z, 후면 -Z)
    # -------------------------------------------------------------------------
    DIST_WALL = 0.3525   # 좌측 벽면(승강로 내측) ~ 레일 배면 중심 거리 (m)
    wall_x = -DIST_WALL  # 벽면 X 좌표 = -0.3525

    # 1. 1차 브라켓 (Wall L-Angle, L-75x75x8, 길이 240mm in Z)
    # 벽면에 밀착되는 수직면 + 2차 브라켓을 받치는 수평면
    ang_len = 0.240      # Z 방향 길이 240mm
    ang_leg = 0.075      # 앵글 다리 폭 75mm
    ang_thk = 0.008      # 두께 8mm

    # 벽 밀착 수직 플랜지 (X축 벽면 바로 앞)
    # X: wall_x + ang_thk/2, Y: 0 ~ -ang_leg
    add_box("Bkt1_VertFlange", ang_thk, ang_leg, ang_len,
            wall_x + ang_thk / 2, -ang_leg / 2, 0, mat_steel, parent=root)
    # 수평 베이스 플랜지 (상단 수평 지지면, 2차 브라켓이 안착됨)
    add_box("Bkt1_HorizFlange", ang_leg, ang_thk, ang_len,
            wall_x + ang_leg / 2, -ang_thk / 2, 0, mat_steel, parent=root)

    # 2. M12 앵커 볼트 2세트 (Z축으로 ±70mm 위치)
    for sign_z in (-1, 1):
        bz = sign_z * 0.070
        by = -ang_leg / 2
        # 콘크리트 매립부 + 돌출부
        add_cylinder(f"Anchor_Stud_{sign_z}", 0.006, 0.080, wall_x, by, bz, mat_bolt, axis='x', parent=root)
        # 평와셔 + 스프링와셔
        add_cylinder(f"Anchor_Washer_{sign_z}", 0.014, 0.005, wall_x + ang_thk + 0.0025, by, bz, mat_bolt, axis='x', parent=root)
        # 육각 너트
        add_cylinder(f"Anchor_Nut_{sign_z}", 0.011, 0.010, wall_x + ang_thk + 0.010, by, bz, mat_bolt, axis='x', parent=root)
        # 돌출 나사산 10mm
        add_cylinder(f"Anchor_ThreadTip_{sign_z}", 0.0055, 0.012, wall_x + ang_thk + 0.021, by, bz, mat_bolt, axis='x', parent=root)
        # PDF 86p 와셔부 점용접
        add_box(f"Anchor_WeldSpot_{sign_z}", 0.004, 0.008, 0.012,
                wall_x + ang_thk + 0.003, by + 0.010, bz, mat_weld, parent=root)

    # 3. 2차 브라켓 (Rail Arm Frame / U-bracket)
    # 1차 브라켓 위에서 시작하여 레일 배면(x=0)까지 도달하는 ㄷ자 절곡 프레임
    # 채널 깊이(X): DIST_WALL (약 352mm), 상하 다리(Z) 폭: 170mm, 높이(Y): 60mm
    arm_x_span = DIST_WALL - 0.015  # 벽에서 10~15mm 띄움 (PDF 85p: 벽과 2차 브라켓 최대 10mm 이상 이격)
    arm_start_x = wall_x + 0.015
    arm_mid_x = (arm_start_x + 0) / 2
    arm_w_z = 0.170      # Z방향 전체 폭 170mm
    arm_h_y = 0.060      # 브라켓 높이 60mm
    arm_thk = 0.008      # 판 두께 8mm

    # (1) 2차 브라켓 하부 수평 안착판 (1차 앵글 수평면에 얹힘)
    add_box("Bkt2_BottomPlate", arm_x_span, arm_thk, arm_w_z,
            arm_mid_x, arm_thk / 2, 0, mat_steel, parent=root)

    # (2) 좌/우 측면 립 (보강 리브 및 ㄷ자 사이드 플랜지)
    for sign_z in (-1, 1):
        cz = sign_z * (arm_w_z / 2 - arm_thk / 2)
        add_box(f"Bkt2_SideRib_{sign_z}", arm_x_span, arm_h_y, arm_thk,
                arm_mid_x, arm_h_y / 2, cz, mat_steel, parent=root)

    # (3) 레일 배면 접촉 수직 백플레이트 (x = -0.005 부근, 심 라이너 및 볼트 홀)
    bkt_face_thk = 0.010
    add_box("Bkt2_FrontFacePlate", bkt_face_thk, arm_h_y + 0.040, arm_w_z + 0.030,
            -bkt_face_thk / 2, (arm_h_y + 0.040) / 2 - 0.020, 0, mat_steel, parent=root)

    # (4) 1차-2차 브라켓 접합부 용접 비드 (PDF 85p: 접하는 모서리에 비드폭 5mm 이상 용접)
    weld_x = wall_x + ang_leg - 0.004
    add_box("Weld_Bead_Left", 0.008, 0.008, 0.060, weld_x, arm_thk + 0.004, -0.060, mat_weld, parent=root)
    add_box("Weld_Bead_Right", 0.008, 0.008, 0.060, weld_x, arm_thk + 0.004, 0.060, mat_weld, parent=root)

    # 4. 심 라이너 (Shim Liner Pack, 1.6t, 0.8t, 0.3t)
    # 레일 배면(x=0)과 2차 브라켓 전면판(-bkt_face_thk) 사이에 삽입 (PDF 81p)
    shim_thk = 0.004
    shim_w = 0.140
    shim_h = 0.090
    add_box("Shim_Liner_Pack", shim_thk, shim_h, shim_w,
            -shim_thk / 2, 0.010, 0, mat_shim, parent=root)

    # 5. 레일 클립 2세트 (Z축으로 레일 양 플랜지 상하를 꽉 무는 클립)
    # 13K 레일의 플랜지 폭은 89mm (Z축 ±44.5mm)
    # 레일 클립은 레일 베이스 플랜지의 경사면을 잡고 M12x45 볼트로 2차 브라켓에 체결
    clip_bolt_dist_z = 0.065   # 체결 볼트 중심 Z 위치 (±65mm)
    for sign_z in (-1, 1):
        cz = sign_z * clip_bolt_dist_z
        # 클립 본체 (특유의 주조 형상 단차 블록)
        # 클립 앞턱이 레일 플랜지(Z축 ±44.5mm 안쪽)를 누름
        clip_toe_z = sign_z * 0.040  # 레일 플랜지 누르는 끝단
        clip_cen_z = (cz + clip_toe_z) / 2
        clip_len_z = abs(cz - clip_toe_z) + 0.020
        add_box(f"RailClip_Body_{sign_z}", 0.018, 0.035, clip_len_z,
                0.008, 0.010, clip_cen_z, mat_chromate, parent=root)
        # 클립 상단 턱 (보강 리브)
        add_box(f"RailClip_Heel_{sign_z}", 0.014, 0.025, 0.016,
                0.006, 0.010, cz + sign_z * 0.008, mat_chromate, parent=root)

        # M12 체결 볼트 (X축 수평 관통 볼트)
        bolt_x = 0.020  # 볼트 머리 X
        # 볼트 머리 (육각)
        add_cylinder(f"ClipBolt_Head_{sign_z}", 0.010, 0.008, bolt_x, 0.010, cz, mat_chromate, axis='x', parent=root)
        # 평와셔 + 스프링와셔
        add_cylinder(f"ClipBolt_Washer_{sign_z}", 0.012, 0.004, bolt_x - 0.006, 0.010, cz, mat_chromate, axis='x', parent=root)
        # 관통 스터드 (2차 브라켓 판 관통)
        add_cylinder(f"ClipBolt_Stud_{sign_z}", 0.006, 0.045, -0.010, 0.010, cz, mat_chromate, axis='x', parent=root)
        # 브라켓 뒷면 너트
        add_cylinder(f"ClipBolt_Nut_{sign_z}", 0.010, 0.010, -0.025, 0.010, cz, mat_chromate, axis='x', parent=root)

    # glTF Binary 내보내기
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"[Blender] Rail bracket GLB exported successfully to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_rail_bracket()
