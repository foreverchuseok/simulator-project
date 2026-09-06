# -*- coding: utf-8 -*-
# =============================================================================
#  승장 도어 실 (Hall Door Sill) — 실사 압출 알루미늄 프로파일
#  실사 사진(145254.png, 145219.png) 기반 정밀 단면 2D 프로파일 압출 모델링
#  - 전면 홀 바닥 접합 턱(Front Lip)
#  - 전면 상면 5단 미끄럼 방지 요철 홈 (Serrated Ribs, 깊이 1.2mm)
#  - 중앙 1열 도어 가이드 슈 홈 (폭 14mm x 깊이 16mm)
#  - 후면 상면 3단 미끄럼 방지 요철 홈
#  - 후면 승강로 측 수직 마감벽 및 하부 체결 리브
# =============================================================================

import bpy
import bmesh
import math
import os

OUTPUT_PATH = r"C:\Users\goodm\Desktop\simmul\models\gltf\hall_sill.glb"


def T(x, y, z):
    """three.js(Y-up/Z-front) → Blender(Z-up/-Y-front)."""
    return (x, -z, y)


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


reset_scene()


def make_material(name, rgb, metallic=0.0, roughness=0.6, alpha=1.0):
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
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], alpha)
    return mat


MAT_ALUMINUM = make_material("Sill_Aluminum", (0.85, 0.88, 0.91), metallic=0.85, roughness=0.28)
MAT_BOLT = make_material("Sill_Bolt", (0.72, 0.75, 0.78), metallic=0.92, roughness=0.20)


def build_hall_sill():
    SILL_LEN = 1.740   # 전폭 1740mm
    SILL_D   = 0.055   # 전후 깊이 55mm
    SILL_H   = 0.022   # 높이 22mm

    z0 = -SILL_D / 2   # -0.0275 (전면 홀 쪽)
    z_end = SILL_D / 2  # +0.0275 (후면 승강로 쪽)

    # 단면 폴리라인 (Three.js Z: 전후, Y: 상하 기준)
    pts_top = []

    # 1. 전면 립 (홀 바닥 타일 접합 턱)
    pts_top.append((z0, -0.0035))
    pts_top.append((z0 + 0.0025, 0.000))

    # 2. 전면 5단 미끄럼 방지 요철 리브
    cur_z = z0 + 0.0025
    for i in range(5):
        pts_top.append((cur_z + 0.0016, 0.000))
        pts_top.append((cur_z + 0.0020, -0.0014))
        pts_top.append((cur_z + 0.0032, -0.0014))
        pts_top.append((cur_z + 0.0036, 0.000))
        cur_z += 0.0036

    # 3. 가이드 홈 앞쪽 평탄 숄더
    pts_top.append((cur_z + 0.0020, 0.000))
    groove_start_z = cur_z + 0.0020

    # 4. 중앙 도어 가이드 슈 홈 (폭 14mm, 깊이 16mm)
    groove_w = 0.014
    groove_depth = 0.016
    pts_top.append((groove_start_z, -0.0008))
    pts_top.append((groove_start_z + 0.0012, -groove_depth))
    pts_top.append((groove_start_z + groove_w - 0.0012, -groove_depth))
    pts_top.append((groove_start_z + groove_w, -0.0008))
    pts_top.append((groove_start_z + groove_w, 0.000))

    cur_z = groove_start_z + groove_w

    # 5. 후면 3단 미끄럼 방지 요철 리브
    pts_top.append((cur_z + 0.0020, 0.000))
    cur_z += 0.0020
    for i in range(3):
        pts_top.append((cur_z + 0.0016, 0.000))
        pts_top.append((cur_z + 0.0020, -0.0014))
        pts_top.append((cur_z + 0.0032, -0.0014))
        pts_top.append((cur_z + 0.0036, 0.000))
        cur_z += 0.0036

    # 6. 후면 숄더 및 승강로 측 수직 마감벽
    pts_top.append((z_end, 0.000))
    pts_top.append((z_end, -SILL_H))

    # 7. 하부 밑면 및 브라켓 체결 보강 단면
    pts_bottom = [
        (z_end - 0.004, -SILL_H),
        (z_end - 0.004, -SILL_H + 0.004),
        (groove_start_z + groove_w + 0.002, -SILL_H + 0.004),
        (groove_start_z + groove_w + 0.002, -groove_depth - 0.003),
        (groove_start_z - 0.002, -groove_depth - 0.003),
        (groove_start_z - 0.002, -SILL_H + 0.004),
        (z0 + 0.004, -SILL_H + 0.004),
        (z0 + 0.004, -SILL_H),
        (z0, -SILL_H),
        (z0, -0.0035)
    ]

    profile_2d = pts_top + pts_bottom

    # BMesh로 2D 단면 Face 생성 후 X축으로 Extrude
    mesh = bpy.data.meshes.new("HallSillMesh")
    bm = bmesh.new()

    x_half = SILL_LEN / 2
    verts_start = []
    for pz, py in profile_2d:
        bx, by, bz = T(-x_half, py, pz)
        v = bm.verts.new((bx, by, bz))
        verts_start.append(v)

    bm.verts.ensure_lookup_table()
    face_start = bm.faces.new(verts_start)

    # Extrude along X (+SILL_LEN)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face_start])
    verts_extruded = [v for v in extruded['geom'] if isinstance(v, bmesh.types.BMVert)]
    dx, dy, dz = T(SILL_LEN, 0, 0)
    bmesh.ops.translate(bm, vec=(dx, dy, dz), verts=verts_extruded)

    # 법선 정리
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("HallSill", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MAT_ALUMINUM)

    # 체결용 볼트 머리 5개소 (홈 바닥 매립 카운터싱크)
    bracket_xs = [-0.60, -0.30, 0.00, 0.30, 0.60]
    bolt_z = groove_start_z + groove_w / 2
    for bx in bracket_xs:
        b_pos = T(bx, -groove_depth + 0.0008, bolt_z)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.0042, depth=0.0016, vertices=16,
            location=b_pos
        )
        b_obj = bpy.context.active_object
        b_obj.name = f"SillBolt_{bx}"
        b_obj.data.materials.append(MAT_BOLT)

    # 모든 오브젝트 결합
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    final_obj = bpy.context.active_object
    final_obj.name = "HallSill"

    # GLB 내보내기
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"[SUCCESS] Exported Hall Sill GLB to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_hall_sill()
