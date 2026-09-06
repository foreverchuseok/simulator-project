# -*- coding: utf-8 -*-
# =============================================================================
#  엘리베이터 표준 T형 가이드레일 (Guide Rail 13K & 8K)
#  KS B 6831 표준 규격 및 부품설계.pdf (52p, 87p), 실사 1035051.png 반영
#  - 13K (카 가이드레일): 플랜지 폭 89mm, 높이 62mm, 헤드 폭 15.88mm, 기계가공 3면
#  - 8K (균형추 가이드레일): 플랜지 폭 82mm, 높이 68mm, 헤드 폭 9mm
#  - 1본 표준 길이: 5.0m (5,000mm)
#  - 레일 조인트: 피시플레이트(Fishplate: 폭 90mm, 길이 300mm, 두께 12mm) + 체결 볼트 8세트
# =============================================================================

import bpy
import bmesh
import math
import os

OUTPUT_DIR = r"C:\Users\goodm\Desktop\simmul\models\gltf"


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


def add_cylinder(name, r, h, px, py, pz, mat, axis='x', parent=None):
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


def create_t_rail_mesh(name, flange_w, rail_h, head_w, head_h, flange_edge_t, web_t, length, mat):
    """
    정밀 T-레일 2D 단면 생성 후 길이(Y축) 방향으로 압출(Extrude)
    - 배면(Back): X = 0 (Three.js 기준)
    - 헤드(Head): X = +rail_h (Three.js 기준 +X 방향으로 돌출)
    - 플랜지 폭: Z축 방향 (±flange_w / 2)
    - 레일 길이: Y축 방향 (0 ~ length)
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()

    # T-레일 2D 단면 정점 정의 (XZ 평면: Three.js x, z -> Blender x, -y)
    # Z축 대칭 형상 반쪽(Z >= 0) 정의 후 미러
    hw = head_w / 2.0
    fw = flange_w / 2.0
    wt = web_t / 2.0

    # 단면 폴리곤 외곽선 좌표 (x, z) [Three.js 기준: x는 높이 방향(0->rail_h), z는 폭 방향(0->fw)]
    # (0, 0) 배면 중앙 -> (0, fw) 배면 끝단 -> (flange_edge_t, fw) 플랜지 립
    # -> (flange_edge_t + 0.005, wt) 플랜지 경사면 -> (rail_h - head_h, wt) 웹 상단
    # -> (rail_h - head_h, hw) 헤드 하단 턱 -> (rail_h, hw) 헤드 전면 모서리 -> (rail_h, 0) 헤드 전면 중앙
    half_pts = [
        (0.0, 0.0),
        (0.0, fw),
        (flange_edge_t, fw),
        (flange_edge_t + 0.004, fw * 0.5),
        (flange_edge_t + 0.007, wt),
        (rail_h - head_h, wt),
        (rail_h - head_h, hw),
        (rail_h, hw),
        (rail_h, 0.0),
    ]

    # 전체 대칭 외곽선 생성 (시계 방향)
    full_pts = []
    # 양의 z 구간 (0.0에서 시작하여 위로 돌아옴)
    for px, pz in half_pts:
        if pz != 0.0:
            full_pts.append((px, pz))
    # 헤드 중앙 꼭짓점
    full_pts.append((rail_h, 0.0))
    # 음의 z 구간 (대칭)
    for px, pz in reversed(half_pts):
        if pz != 0.0:
            full_pts.append((px, -pz))
    # 배면 중앙 꼭짓점
    full_pts.append((0.0, 0.0))

    # 하단 2D 페이스 생성 (Y = 0)
    verts_bottom = []
    for px, pz in full_pts:
        bx, by, bz = T(px, 0.0, pz)
        verts_bottom.append(bm.verts.new((bx, by, bz)))

    face_bottom = bm.faces.new(verts_bottom)

    # 상단으로 압출 (Extrude along Y axis in Three.js -> +Z in Blender)
    res = bmesh.ops.extrude_face_region(bm, geom=[face_bottom])
    extruded_verts = [v for v in res['geom'] if isinstance(v, bmesh.types.BMVert)]
    dy_blender = length  # Three.js Y length is Blender Z length
    bmesh.ops.translate(bm, vec=(0, 0, dy_blender), verts=extruded_verts)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_fishplate_assembly(name, flange_w, rail_h, mat_steel, mat_bolt, parent=None, joint_y=5.0):
    """
    레일 상단 이음매(피시플레이트 및 체결 볼트 8개) 생성
    - 피시플레이트: 배면(x <= 0)에 밀착되는 두꺼운 사각 평철판 (폭 90mm, 높이 300mm, 두께 12mm)
    - 체결 볼트 8세트: 2열 x 4행 (상부 4개, 하부 4개)
    """
    fp_w = flange_w + 0.005  # 약 90~94mm
    fp_h = 0.320             # 높이 320mm
    fp_t = 0.012             # 두께 12mm

    # 피시플레이트 본체 (레일 배면 x=0 뒤쪽: x = -fp_t/2)
    fp = add_box(f"{name}_Plate", fp_t, fp_h, fp_w,
                 -fp_t / 2, joint_y, 0, mat_steel, parent=parent)

    # 볼트 8세트 위치 (Z: ±25mm, Y: joint_y ± 40mm, ± 110mm)
    z_offsets = (-0.025, 0.025)
    y_offsets = (-0.110, -0.040, 0.040, 0.110)

    for i, dy in enumerate(y_offsets):
        for j, dz in enumerate(z_offsets):
            idx = i * 2 + j + 1
            by = joint_y + dy
            # 볼트 머리 (레일 앞쪽 플랜지 홀 관통 머리: x = +0.012)
            add_cylinder(f"{name}_BoltHead_{idx}", 0.011, 0.008, 0.012, by, dz, mat_bolt, axis='x', parent=parent)
            # 평와셔 + 너트 (피시플레이트 뒷면: x = -fp_t - 0.008)
            add_cylinder(f"{name}_Nut_{idx}", 0.012, 0.010, -fp_t - 0.008, by, dz, mat_bolt, axis='x', parent=parent)
            # 스터드 돌출 끝단
            add_cylinder(f"{name}_Tip_{idx}", 0.006, 0.028, -fp_t / 2, by, dz, mat_bolt, axis='x', parent=parent)


def build_guide_rails():
    # -------------------------------------------------------------------------
    # 1. 카 가이드레일 (13K T-Rail) GLB 생성
    # -------------------------------------------------------------------------
    reset_scene()
    mat_rail = make_material("Rail_Machined_Steel", (0.70, 0.74, 0.78), metallic=0.88, roughness=0.32)
    mat_plate = make_material("Fishplate_Steel", (0.38, 0.42, 0.46), metallic=0.75, roughness=0.45)
    mat_bolt = make_material("Joint_Bolt", (0.75, 0.78, 0.82), metallic=0.90, roughness=0.22)

    root_13k = bpy.data.objects.new("GuideRail_13K_Root", None)
    bpy.context.collection.objects.link(root_13k)

    # 13K 제원: 폭 89mm, 높이 62mm, 헤드 폭 15.88mm, 헤드 높이 30mm, 립 7.9mm, 웹 두께 12mm
    rail_13k = create_t_rail_mesh(
        name="T_Rail_13K",
        flange_w=0.089,
        rail_h=0.062,
        head_w=0.01588,
        head_h=0.030,
        flange_edge_t=0.0079,
        web_t=0.012,
        length=5.0,
        mat=mat_rail
    )
    rail_13k.parent = root_13k

    # 5.0m 상단 조인트 피시플레이트 결합
    add_fishplate_assembly("FP_13K", 0.089, 0.062, mat_plate, mat_bolt, parent=root_13k, joint_y=5.0)

    out_13k = os.path.join(OUTPUT_DIR, "guide_rail_13k.glb")
    bpy.ops.export_scene.gltf(filepath=out_13k, export_format='GLB', use_selection=False, export_apply=True)
    print(f"[Blender] Guide rail 13K GLB exported to: {out_13k}")

    # -------------------------------------------------------------------------
    # 2. 균형추 가이드레일 (8K T-Rail) GLB 생성
    # -------------------------------------------------------------------------
    reset_scene()
    mat_rail_8k = make_material("Rail_Machined_Steel_8K", (0.70, 0.74, 0.78), metallic=0.88, roughness=0.32)
    mat_plate_8k = make_material("Fishplate_Steel_8K", (0.38, 0.42, 0.46), metallic=0.75, roughness=0.45)
    mat_bolt_8k = make_material("Joint_Bolt_8K", (0.75, 0.78, 0.82), metallic=0.90, roughness=0.22)

    root_8k = bpy.data.objects.new("GuideRail_8K_Root", None)
    bpy.context.collection.objects.link(root_8k)

    # 8K 제원: 폭 82mm, 높이 68mm, 헤드 폭 9mm, 헤드 높이 26mm, 립 7.0mm, 웹 두께 9mm
    rail_8k = create_t_rail_mesh(
        name="T_Rail_8K",
        flange_w=0.082,
        rail_h=0.068,
        head_w=0.009,
        head_h=0.026,
        flange_edge_t=0.0070,
        web_t=0.009,
        length=5.0,
        mat=mat_rail_8k
    )
    rail_8k.parent = root_8k

    add_fishplate_assembly("FP_8K", 0.082, 0.068, mat_plate_8k, mat_bolt_8k, parent=root_8k, joint_y=5.0)

    out_8k = os.path.join(OUTPUT_DIR, "guide_rail_8k.glb")
    bpy.ops.export_scene.gltf(filepath=out_8k, export_format='GLB', use_selection=False, export_apply=True)
    print(f"[Blender] Guide rail 8K GLB exported to: {out_8k}")


if __name__ == "__main__":
    build_guide_rails()
