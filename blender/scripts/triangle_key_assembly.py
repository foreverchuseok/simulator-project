# -*- coding: utf-8 -*-
# =============================================================================
#  승장 도어 비상 삼각키 어셈블리 (Emergency Triangle Key Assembly)
#  부품설계.pdf 177p (15.8 삼각키 설치) 및 현장 실사(112754.png, 112837.png) 기반
#  - 승강장 외측: 원형 스테인리스 베젤 플랜지 + 중앙 정삼각형 키 홀 (Triangle Key Hole)
#  - 도어 패널 관통부: M16 나사산 스핀들 바디 (32mm 패널 관통)
#  - 도어 승강로 측: 고무 와셔 (Rubber Washer), 고정 육각 너트 (M16 Hex Nut, Lock Nut)
#  - 회전 캠 (Cam Lever): 크로메이트 골드 도금 회전 캠 레버 (길이 48mm) + 드라이브 조인트 핀
# =============================================================================

import bpy
import bmesh
import math
import os

OUTPUT_DIR = r"C:\Users\goodm\Desktop\simmul\models\gltf"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "triangle_key_assembly.glb")


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


def add_cylinder(name, r, h, px, py, pz, mat, axis='z', verts=24, parent=None):
    bx, by, bz = T(px, py, pz)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(bx, by, bz))
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


def add_box(name, sx, sy, sz, px, py, pz, mat, parent=None):
    bx, by, bz = T(px, py, pz)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, by, bz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_triangle_key_hole_mesh(name, r_outer, depth, tri_side, mat_bezel, mat_dark):
    """
    승강장 전면 베젤 및 정삼각형 키 홀 2D 불리언/페이스 생성
    - 외경 r_outer의 원형 디스크
    - 중심에 변의 길이 tri_side의 정삼각형 홀
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()

    # 정삼각형 꼭짓점 (삼각형 무게중심 기준)
    # R_tri = tri_side / sqrt(3)
    r_tri = tri_side / math.sqrt(3.0)
    tri_verts = []
    for i in range(3):
        ang = math.pi / 2.0 + i * (2.0 * math.pi / 3.0) # 상단 꼭짓점이 위를 봄
        tx = r_tri * math.cos(ang)
        ty = r_tri * math.sin(ang)
        bx, by, bz = T(tx, ty, 0.0)
        tri_verts.append(bm.verts.new((bx, by, bz)))

    # 외곽 원형 베젤 버텍스
    n_circle = 24
    outer_verts = []
    for i in range(n_circle):
        ang = i * (2.0 * math.pi / n_circle)
        ox = r_outer * math.cos(ang)
        oy = r_outer * math.sin(ang)
        bx, by, bz = T(ox, oy, 0.0)
        outer_verts.append(bm.verts.new((bx, by, bz)))

    # 링 형태의 페이스 생성 (외곽 원 ~ 삼각형 홀 사이)
    # BMesh triangulate / fill
    bm.faces.new(outer_verts)
    # 삼각형 면 생성 후 반전
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bm.edges)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat_bezel:
        obj.data.materials.append(mat_bezel)
    return obj


def build_triangle_key_assembly():
    reset_scene()

    # 재질 정의
    mat_bezel = make_material("Key_Bezel_SS", (0.85, 0.88, 0.92), metallic=0.92, roughness=0.25)
    mat_dark = make_material("Key_Hole_Dark", (0.05, 0.05, 0.06), metallic=0.30, roughness=0.85)
    mat_brass = make_material("Key_Brass", (0.85, 0.72, 0.22), metallic=0.85, roughness=0.30)
    mat_rubber = make_material("Key_Rubber", (0.12, 0.12, 0.14), metallic=0.05, roughness=0.80)
    mat_steel = make_material("Key_Steel", (0.75, 0.78, 0.82), metallic=0.88, roughness=0.25)

    # 루트 오브젝트
    root = bpy.data.objects.new("TriangleKey_Root", None)
    bpy.context.collection.objects.link(root)

    # 기하학적 기준:
    # 도어 전면(승강장 의장면)이 Z = 0
    # 도어 패널 내부: Z = 0 ~ -0.032 (두께 32mm)
    # 도어 배면(승강로 측): Z <= -0.032

    # 1. 승강장 측 원형 베젤 플랜지 (Z = 0.001 돌출)
    # 외경 26mm, 두께 2mm
    r_bezel = 0.013
    bezel = add_cylinder("Key_Cylinder_Bezel", r_bezel, 0.002, 0, 0, 0.001, mat_bezel, axis='z', verts=32, parent=root)

    # 정삼각형 키 홀 홈 (중앙 9mm 정삼각형, 안쪽으로 6mm 파임)
    # 어두운 안쪽 삼각 홀 포켓
    tri_pocket = add_cylinder("Key_Tri_Pocket", 0.0055, 0.007, 0, 0, -0.0015, mat_dark, axis='z', verts=3, parent=root)
    # 중앙 황동 삼각 핀 (외측에서 키가 꽂히는 삼각형 스핀들)
    tri_spindle = add_cylinder("Key_Tri_Spindle", 0.0035, 0.005, 0, 0, -0.001, mat_brass, axis='z', verts=3, parent=root)

    # 2. 도어 관통 나사산 바디 (M16 실린더)
    # Z = 0 에서 -0.035까지 관통
    body_r = 0.008  # M16 반경 8mm
    body_len = 0.036
    add_cylinder("Key_Cylinder_Body", body_r, body_len, 0, 0, -body_len / 2, mat_brass, axis='z', verts=24, parent=root)

    # 3. 도어 배면 고무 와셔 & 고정 육각 너트 (PDF 177p, 178p)
    # 고무 와셔 (Z = -0.032 ~ -0.034)
    add_cylinder("Key_Rubber_Washer", 0.012, 0.0025, 0, 0, -0.033, mat_rubber, axis='z', verts=24, parent=root)
    # M16 메인 고정 너트 (육각, Z = -0.034 ~ -0.040)
    add_cylinder("Key_Main_Nut", 0.0115, 0.006, 0, 0, -0.037, mat_steel, axis='z', verts=6, parent=root)
    # 락 너트 (Hex Nut, Z = -0.040 ~ -0.044)
    add_cylinder("Key_Lock_Nut", 0.011, 0.004, 0, 0, -0.042, mat_steel, axis='z', verts=6, parent=root)

    # 4. 회전 캠 레버 (Cam Lever, PDF 177p Cam)
    # 캠 레버 그룹: 회전 피벗 중심 (0, 0, -0.045)
    cam_group = bpy.data.objects.new("Cam_Pivot", None)
    bpy.context.collection.objects.link(cam_group)
    cam_group.parent = root

    cam_len = 0.048
    cam_w = 0.014
    cam_thk = 0.004
    cam_z = -0.045

    # 회전 축 허브 (Z = -0.045)
    add_cylinder("Cam_Hub", 0.009, cam_thk, 0, 0, cam_z, mat_brass, axis='z', verts=16, parent=cam_group)

    # 레버 암 (X축 방향으로 뻗음)
    add_box("Cam_Arm", cam_len, cam_w, cam_thk, cam_len / 2, 0, cam_z, mat_brass, parent=cam_group)
    # 캠 끝단 둥근 라운드
    add_cylinder("Cam_TipRound", cam_w / 2, cam_thk, cam_len, 0, cam_z, mat_brass, axis='z', verts=16, parent=cam_group)

    # 캠 끝단 드라이브 핀 (수직 링크 브라켓 바와 연결되는 볼트/핀)
    # -Z 방향으로 돌출되어 링크 바의 장공 슬롯에 결합
    pin_r = 0.0035
    pin_len = 0.014
    add_cylinder("Cam_DrivePin", pin_r, pin_len, cam_len, 0, cam_z - pin_len / 2, mat_steel, axis='z', verts=12, parent=cam_group)
    add_cylinder("Cam_PinHead", 0.006, 0.003, cam_len, 0, cam_z - pin_len, mat_steel, axis='z', verts=16, parent=cam_group)

    # glTF 내보내기
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"[Blender] Triangle key assembly GLB exported to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_triangle_key_assembly()
