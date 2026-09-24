"""Sliding car guide shoe, based on Part Design pp. 95/99.

Metres; T maps the app's Y-up coordinates into Blender. The origin is the
rail BACK plane at the mounting face, with the rail head pointing along +X.
The existing 13K GLB supplies the rail profile; no second rail dimension set.
Upper/lower and left/right placements are owned by elevator.js.
"""
import json
import math
from pathlib import Path
import struct

import bpy

ROOT = Path(__file__).resolve().parents[2]
RAIL_PATH = ROOT / "models/gltf/guide_rail_13k.glb"
OUTPUT_PATH = ROOT / "models/gltf/car_guide_shoe.glb"
GUIDE_HEIGHT = 0.120
GUIDE_BOTTOM = 0.018
SIDE_CLEARANCE = 0.0005  # Visual running clearance, NOT the PDF's 5 mm setting.
TIP_CLEARANCE = 0.0005
LINER_WALL = 0.005
HOUSING_WALL = 0.009
STOP_SETTING = 0.005
ADAPTER_X = (0.025, 0.178)
ADAPTER_HALF_Z = 0.083
ADAPTER_THICKNESS = 0.012
BOLT_X = 0.139
BOLT_Z = 0.062
SLOT_LENGTH = 0.029
SLOT_WIDTH = 0.011
BEVEL = 0.0008


def rail_profile():
    data = RAIL_PATH.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    binary_start = 20 + length + 8
    node = next(n for n in gltf["nodes"] if n.get("name") == "T_Rail_13K")
    primitive = gltf["meshes"][node["mesh"]]["primitives"][0]
    accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
    assert accessor["componentType"] == 5126 and accessor["type"] == "VEC3"
    view = gltf["bufferViews"][accessor["bufferView"]]
    start = binary_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", 12)
    vertices = [struct.unpack_from("<fff", data, start + i * stride)
                for i in range(accessor["count"])]
    tip = max(v[0] for v in vertices)
    half_width = max(abs(v[2]) for v in vertices if abs(v[0] - tip) < 1e-6)
    assert 0.05 < tip < 0.08 and 0.006 < half_width < 0.012
    return tip, half_width


RAIL_TIP, RAIL_HALF_WIDTH = rail_profile()
CHANNEL_END = RAIL_TIP + TIP_CLEARANCE
CHANNEL_HALF_Z = RAIL_HALF_WIDTH + SIDE_CLEARANCE
LINER_END = CHANNEL_END + LINER_WALL
LINER_HALF_Z = CHANNEL_HALF_Z + LINER_WALL
HOUSING_END = LINER_END + 0.0005 + HOUSING_WALL
HOUSING_HALF_Z = LINER_HALF_Z + 0.0005 + HOUSING_WALL
RISER_X = HOUSING_END + STOP_SETTING + 0.020


def T(x, y, z):
    return (x, -z, y)


def material(name, rgb, metal=0.0, rough=0.5, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, alpha)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Alpha"].default_value = alpha
    return mat


def finish(obj, mat=None, bevel=BEVEL):
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
    if bevel:
        mod = obj.modifiers.new("Machined edges", 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new("Face normals", 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def box(name, size, loc, mat=None, bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(*loc))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)


def cylinder(name, radius, height, loc, mat=None, axis='y', sides=32, bevel=0.0003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=height,
                                       location=T(*loc))
    obj = bpy.context.object
    obj.name = name
    if axis == 'x':
        obj.rotation_euler.y = math.pi / 2
    elif axis == 'z':
        obj.rotation_euler.x = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, mat, bevel)


def subtract(obj, cutter):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Through opening", 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def notch(obj, end, half_z):
    subtract(obj, box("Rail clearance", (end + 0.10, 0.6, 2 * half_z),
                      ((end - 0.10) / 2, 0.1, 0), bevel=0))


def slot(obj, x, z):
    straight = SLOT_LENGTH - SLOT_WIDTH
    subtract(obj, box("Slot center", (straight, 0.07, SLOT_WIDTH), (x, 0, z), bevel=0))
    for dx in (-straight / 2, straight / 2):
        subtract(obj, cylinder("Slot end", SLOT_WIDTH / 2, 0.07,
                               (x + dx, 0, z), bevel=0))


def join(name, objects, parent):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.parent = parent
    return obj


# ── 상자형 급유기(오일통) — 카·균형추 가이드슈 공용 ─────────────────────────
# 현장 사진(2026-09-24 스크린샷 010249·010024·001412): 유백색 반투명 사각 통 +
# 회베이지 뚜껑. 뚜껑은 레일 날 쪽으로 튀어나와 날을 U 홈으로 감싸고, 통 안 펠트가
# 날 끝과 양옆에 닿아 기름을 바른다. 앱 계약: 노드 이름 `Oiler`(하부 슈는 JS가 숨김).
OILER_BODY = (0.006, 0.080)   # 레일 날끝에서 통 몸체까지 거리 범위 (레일 반대쪽)
OILER_HALF_Z = 0.043
OILER_H = 0.080
OILER_LID_T = 0.008
OILER_LID_OVER = 0.024        # 뚜껑이 날끝 너머 레일 쪽으로 덮는 길이
_OILER_MATS = {}


def _oiler_mats():
    if not _OILER_MATS:
        _OILER_MATS.update(
            shell=material("Oiler_Shell", (0.86, 0.87, 0.84), 0.0, 0.35, 0.72),
            lid=material("Oiler_Lid", (0.50, 0.48, 0.43), 0.0, 0.85),
            oil=material("Oiler_Oil", (0.42, 0.22, 0.04), 0.0, 0.25),
            felt=material("Oiler_Felt", (0.16, 0.15, 0.13), 0.0, 0.95),
            zinc=material("Oiler_Bracket", (0.55, 0.57, 0.58), 0.8, 0.35))
    return _OILER_MATS


def build_box_oiler(parent, tip, half_z, base_y, sign=1, name="Oiler"):
    """tip: 레일 날끝 X, sign: 날끝에서 통 쪽 방향(+1 = +X). 레일 날은 sign*(x-tip) <= 0, |z| <= half_z."""
    m = _oiler_mats()
    X = lambda d: tip + sign * d
    oiler = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(oiler)
    oiler.parent = parent
    b0, b1 = OILER_BODY
    bx, bw = X((b0 + b1) / 2), b1 - b0
    y0 = base_y + 0.003
    bracket = box("Oiler bracket", (bw + 0.010, 0.003, 2 * OILER_HALF_Z + 0.006),
                  (bx, base_y + 0.0015, 0), m["zinc"], 0.0005)
    join("OilerBracket", [bracket], oiler)
    body = box("Oiler body", (bw, OILER_H, 2 * OILER_HALF_Z), (bx, y0 + OILER_H / 2, 0), bevel=0)
    subtract(body, box("Oiler cavity", (bw - 0.005, OILER_H, 2 * OILER_HALF_Z - 0.005),
                       (bx, y0 + OILER_H / 2 + 0.0025, 0), bevel=0))
    finish(body, m["shell"], 0.001)
    join("OilerBody", [body], oiler)
    oil = box("Oil", (bw - 0.006, OILER_H * 0.5, 2 * OILER_HALF_Z - 0.006),
              (bx, y0 + 0.003 + OILER_H * 0.25, 0), m["oil"], 0)
    join("OilerOil", [oil], oiler)
    l0, l1 = -OILER_LID_OVER, b1 + 0.004
    lid_y = y0 + OILER_H + OILER_LID_T / 2
    lid = box("Oiler lid", (l1 - l0, OILER_LID_T, 2 * OILER_HALF_Z + 0.008),
              (X((l0 + l1) / 2), lid_y, 0), bevel=0)
    n0, n1 = l0 - 0.01, 0.0015
    subtract(lid, box("Lid rail notch", (n1 - n0, 0.1, 2 * (half_z + 0.0015)),
                      (X((n0 + n1) / 2), lid_y, 0), bevel=0))
    finish(lid, m["lid"], 0.0015)
    cap = cylinder("Oiler filler cap", 0.011, 0.008,
                   (X(b1 - 0.022), lid_y + OILER_LID_T / 2 + 0.004, 0.018), m["lid"], sides=16)
    join("OilerLid", [lid, cap], oiler)
    fy0, fy1 = y0 + OILER_H - 0.036, y0 + OILER_H - 0.004
    fy, fh = (fy0 + fy1) / 2, fy1 - fy0
    felts = [box("Felt tip pad", (b0 - 0.0005, fh, 0.024), (X((b0 + 0.0005) / 2), fy, 0), m["felt"], 0)]
    for zs in (-1, 1):
        felts.append(box("Felt side pad", (0.018, fh, 0.004),
                         (X(-0.009), fy, zs * (half_z + 0.002)), m["felt"], 0))
    join("OilerFelt", felts, oiler)
    return oiler



def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    steel = material("Shoe_ZincSteel", (0.28, 0.32, 0.36), 0.72, 0.38)
    cast = material("Shoe_CastHousing", (0.11, 0.15, 0.18), 0.45, 0.64)
    zinc = material("Shoe_YellowZinc", (0.48, 0.35, 0.10), 0.70, 0.40)
    polymer = material("Shoe_Liner", (0.035, 0.12, 0.22), 0.0, 0.68)
    rubber = material("Shoe_Rubber", (0.022, 0.026, 0.03), 0.0, 0.9)
    bolts = material("Shoe_Fasteners", (0.40, 0.44, 0.48), 0.85, 0.31)
    root = bpy.data.objects.new("GuideShoeRoot", None)
    bpy.context.collection.objects.link(root)
    for key, value in {"contractVersion": 1, "railTip": RAIL_TIP,
                       "railHalfWidth": RAIL_HALF_WIDTH, "channelEnd": CHANNEL_END,
                       "channelHalfWidth": CHANNEL_HALF_Z, "guideBottom": GUIDE_BOTTOM,
                       "guideHeight": GUIDE_HEIGHT, "stopSetting": STOP_SETTING}.items():
        root[key] = value

    plate = box("Adapter plate", (ADAPTER_X[1] - ADAPTER_X[0], ADAPTER_THICKNESS,
                                  ADAPTER_HALF_Z * 2),
                ((ADAPTER_X[0] + ADAPTER_X[1]) / 2, ADAPTER_THICKNESS / 2, 0), bevel=0)
    notch(plate, CHANNEL_END + 0.002, CHANNEL_HALF_Z + 0.002)
    for z in (-BOLT_Z, BOLT_Z):
        slot(plate, BOLT_X, z)
    finish(plate, steel)
    riser = box("Cast adapter upright", (0.012, 0.113, 0.060),
                (RISER_X, 0.065, 0), steel, bevel=0.003)
    heel = box("Adapter heel", (0.035, 0.019, 0.060), (RISER_X + 0.009, 0.019, 0), steel, 0.004)
    join("Adapter", [plate, riser, heel], root)

    body_x0 = 0.030
    body = box("Housing casting", (HOUSING_END - body_x0, GUIDE_HEIGHT - 0.008,
                                    HOUSING_HALF_Z * 2),
               ((body_x0 + HOUSING_END) / 2, GUIDE_BOTTOM + GUIDE_HEIGHT / 2, 0), bevel=0)
    notch(body, LINER_END + 0.0005, LINER_HALF_Z + 0.0005)
    finish(body, cast, 0.0012)
    join("Housing", [body], root)

    liner_x0 = 0.034
    liner = box("Replaceable U liner", (LINER_END - liner_x0, GUIDE_HEIGHT, LINER_HALF_Z * 2),
                ((liner_x0 + LINER_END) / 2, GUIDE_BOTTOM + GUIDE_HEIGHT / 2, 0), bevel=0)
    notch(liner, CHANNEL_END, CHANNEL_HALF_Z)
    finish(liner, polymer, 0.00035)
    join("Liner", [liner], root)

    retainers, fasteners = [], []
    for y in (GUIDE_BOTTOM - 0.003, GUIDE_BOTTOM + GUIDE_HEIGHT + 0.003):
        cap = box("Liner retaining plate", (HOUSING_END - body_x0 + 0.003, 0.005, 0.070),
                  ((body_x0 + HOUSING_END) / 2, y, 0), bevel=0)
        notch(cap, CHANNEL_END + 0.001, CHANNEL_HALF_Z + 0.001)
        retainers.append(finish(cap, zinc))
        for z in (-0.027, 0.027):
            fasteners.append(cylinder("Retainer M6", 0.005, 0.004, (0.054, y + 0.004, z), bolts, sides=6))
    join("Retainers", retainers, root)
    for z in (-BOLT_Z, BOLT_Z):
        fasteners.extend([
            cylinder("Mount washer", 0.011, 0.002, (BOLT_X, 0.013, z), bolts),
            cylinder("Mount M10 head", 0.0085, 0.006, (BOLT_X, 0.017, z), bolts, sides=6),
            cylinder("Mount stud", 0.005, 0.027, (BOLT_X, 0.001, z), bolts),
        ])
    for z in (-HOUSING_HALF_Z, HOUSING_HALF_Z):
        for y in (0.042, 0.112):
            fasteners.append(cylinder("Housing tie bolt", 0.004, 0.006,
                                      (0.055, y, z + math.copysign(0.003, z)), bolts, axis='z', sides=6))
    join("Fasteners", fasteners, root)

    stop_end = RISER_X - 0.006
    stop_start = HOUSING_END + STOP_SETTING
    stop = box("Adjustment rubber stop", (stop_end - stop_start, 0.065, 0.042),
               ((stop_end + stop_start) / 2, 0.080, 0), rubber, 0.0015)
    join("RubberStop", [stop], root)
    adjuster = [cylinder("Setting screw", 0.004, 0.060, (HOUSING_END + 0.022, 0.078, 0), bolts, axis='x')]
    for x in (RISER_X + 0.011, RISER_X + 0.018):
        adjuster.append(cylinder("Adjuster locknut", 0.007, 0.005, (x, 0.078, 0), bolts, axis='x', sides=6))
    # Short thread ridges around the setting screw; merged with its hardware.
    for i in range(12):
        x = RISER_X + 0.021 + i * 0.0012
        adjuster.append(cylinder("Thread crest", 0.00445, 0.00045, (x, 0.078, 0), steel, axis='x', bevel=0))
    join("Adjuster", adjuster, root)

    # 상자형 오일통 — 슈 상부 리테이너(볼트 머리 포함) 위 브라켓에 얹는다.
    build_box_oiler(root, RAIL_TIP, CHANNEL_HALF_Z, GUIDE_BOTTOM + GUIDE_HEIGHT + 0.0065)

    bpy.ops.export_scene.gltf(filepath=str(OUTPUT_PATH), export_format='GLB',
                              export_extras=True, export_apply=True, export_animations=False)
    print(f"Guide shoe exported: {OUTPUT_PATH}")
    print(f"Rail tip={RAIL_TIP:.6f}, thickness={2 * RAIL_HALF_WIDTH:.6f}, running clearance={SIDE_CLEARANCE:.6f}")


if __name__ == "__main__":
    build()
