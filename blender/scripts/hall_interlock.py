# -*- coding: utf-8 -*-
# =============================================================================
#  승장 도어 인터록 — 실사(사용자 171820 사진) 비율
#  원점: 클러치 롤러 2개 CTC 중점, 승강로면(+Z 로비 / -Z 카)
#  노드: InterlockBase(고정), Hook(피벗 원점, 하부롤러·후크·해정레버)
# =============================================================================

import bpy
import math
import os

OUTPUT_PATH = r"C:\Users\goodm\Desktop\simmul\models\gltf\hall_interlock.glb"


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


def make_material(name, rgb, metallic=0.0, roughness=0.6, alpha=1.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")

    def s(key, val):
        if bsdf and key in bsdf.inputs:
            bsdf.inputs[key].default_value = val

    s("Base Color", (rgb[0], rgb[1], rgb[2], 1.0))
    s("Metallic", metallic)
    s("Roughness", roughness)
    s("Alpha", alpha)
    for coat_key in ("Coat Weight", "Clearcoat", "Coat"):
        if bsdf and coat_key in bsdf.inputs:
            bsdf.inputs[coat_key].default_value = coat
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], alpha)
    if alpha < 1.0:
        for attr, value in (("blend_method", 'BLEND'), ("shadow_method", 'HASHED')):
            try:
                setattr(mat, attr, value)
            except Exception:
                pass
        mat.use_backface_culling = False
    return mat


MAT_ZINC  = make_material("IL_Zinc",   (0.62, 0.50, 0.16), metallic=0.96, roughness=0.28, coat=0.18)
MAT_STEEL = make_material("IL_Steel",  (0.72, 0.74, 0.78), metallic=0.96, roughness=0.18)
MAT_TIRE  = make_material("IL_Tire",   (0.012, 0.012, 0.014), metallic=0.02, roughness=0.78)
MAT_HUB   = make_material("IL_Hub",    (0.93, 0.92, 0.88), metallic=0.02, roughness=0.38)
MAT_SPR   = make_material("IL_Spring", (0.78, 0.80, 0.84), metallic=0.98, roughness=0.16)
MAT_SW    = make_material("IL_Switch", (0.12, 0.13, 0.15), metallic=0.25, roughness=0.48)
MAT_SWC   = make_material("IL_Contact",(0.82, 0.78, 0.55), metallic=0.70, roughness=0.32)


def _finish(mat, smooth=True):
    o = bpy.context.active_object
    o.data.materials.clear()
    o.data.materials.append(mat)
    if smooth:
        bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def add_box(dims, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    bpy.context.active_object.scale = dims
    return _finish(mat, smooth=False)


def add_box3(sx, sy, sz, xyz, mat, rot=(0, 0, 0)):
    """three.js 크기(sx,sy,sz)·위치 xyz → Blender 스케일 (x, z, y)."""
    return add_box((sx, sz, sy), T(*xyz), mat, rot)


def add_cyl(radius, depth, loc, mat, rot=(0, 0, 0), verts=32, smooth=False):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    return _finish(mat, smooth)


def add_ring(r_out, r_in, depth, loc, mat, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r_out, depth=depth,
                                        location=loc, rotation=rot)
    outer = bpy.context.active_object
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r_in, depth=depth * 3,
                                        location=loc, rotation=rot)
    inner = bpy.context.active_object
    bpy.ops.object.select_all(action='DESELECT')
    outer.select_set(True)
    bpy.context.view_layer.objects.active = outer
    md = outer.modifiers.new("ring", 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = inner
    bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(inner, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    outer.select_set(True)
    bpy.context.view_layer.objects.active = outer
    return _finish(mat, smooth=True)


def add_torus(major, minor, loc, mat, rot=(0, 0, 0), mseg=36, nseg=10):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=mseg, minor_segments=nseg,
        location=loc, rotation=rot)
    return _finish(mat, smooth=True)


def add_plate(pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), bevel_w=0.0008, name="plate"):
    mesh = bpy.data.meshes.new(name)
    verts = [(p[0], 0.0, p[1]) for p in pts]
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.modifiers.new("tri", 'TRIANGULATE')
    sol = obj.modifiers.new("sol", 'SOLIDIFY')
    sol.thickness = depth
    sol.offset = 0
    if bevel_w > 0:
        bev = obj.modifiers.new("bev", 'BEVEL')
        bev.width = bevel_w
        bev.segments = 2
    for md in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    obj.location = loc
    obj.rotation_euler = rot
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def join_group(objs, name, origin=None):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    j = bpy.context.active_object
    j.name = name
    if origin:
        bpy.context.scene.cursor.location = origin
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.context.scene.cursor.location = (0, 0, 0)
    return j


# =============================================================================
#  상수 — 부품설계.pdf 178p 닫힘. 원점 = 하부(큰) 롤러 중심.
#  +X = 문짝 쪽(로비 왼쪽), -X = 맞춤선(출입구 중심).
# =============================================================================
AX = (math.pi / 2, 0, 0)

# 하부 큰 롤러 Ø38, 상부 작은 롤러 Ø26. 검은 외륜.
ROL_DN_R = 0.019
ROL_UP_R = 0.013
ROL_T    = 0.020
TIRE     = 0.0060
HUB_T    = 0.014
AXLE_R   = 0.0036
AXLE_L   = 0.026
ROL_UP_X = -0.010          # 도면: 상부 롤러가 기둥 쪽으로 약간
ROL_UP_Y = 0.034

# 하부 롤러 중심 → 기둥 수직면 52mm (178p)
PILLAR_X = -0.052
PILLAR_W = 0.020
PILLAR_H = 0.068
PLATE_T  = 0.005
PLATE_Z  = 0.016

PIV_X, PIV_Y, PIV_Z = -0.052, 0.006, 0.000
HOOK_T = 0.005

# 키퍼–후크 닫힘 간격
GAP_H = 0.0045             # 수평 4~5mm
GAP_V = 0.008              # 수직 8±1mm
KEEPER_FACE_X = -0.108     # 키퍼 걸림면
HOOK_FACE_X   = KEEPER_FACE_X + GAP_H   # -0.1035, 맞춤선에 맞춤
KEEPER_BOT_Y  = 0.016
HOOK_TOP_Y    = KEEPER_BOT_Y - GAP_V    # 0.008


def add_roller(x, y, z, r):
    hub_r = r - TIRE
    parts = []
    parts.append(add_ring(r, hub_r - 0.0003, ROL_T, T(x, y, z), MAT_TIRE, rot=AX, verts=40))
    parts.append(add_cyl(hub_r, HUB_T, T(x, y, z - 0.004), MAT_HUB, rot=AX, verts=32, smooth=True))
    parts.append(add_cyl(AXLE_R, AXLE_L, T(x, y, z), MAT_STEEL, rot=AX, verts=16, smooth=True))
    parts.append(add_cyl(0.0052, 0.0026, T(x, y, z - AXLE_L / 2 + 0.001), MAT_STEEL, rot=AX, verts=6))
    return parts


def add_hex(x, y, z, head_r=0.005, head_h=0.0032, shank_r=0.0026, shank_h=0.010):
    parts = []
    parts.append(add_cyl(head_r, head_h, T(x, y, z + 0.004), MAT_STEEL, rot=AX, verts=6))
    parts.append(add_cyl(shank_r, shank_h, T(x, y, z), MAT_STEEL, rot=AX, verts=12))
    return parts


def build_base():
    """문짝 쪽 록 바디: 좌측 판 + 상부 소형 롤러 + 기둥 + 스프링 조임."""
    p = []
    # 롤러 브라켓 판 (하부 롤러 중심 0 → 기둥면 -52mm)
    plate_w = 0.052 + 0.028
    plate_cx = -(0.052 - 0.028) / 2
    p.append(add_box3(plate_w, 0.072, PLATE_T, (plate_cx, 0.010, PLATE_Z), MAT_ZINC))
    p += add_hex(0.010,  0.028, PLATE_Z + 0.002)
    p += add_hex(0.010, -0.022, PLATE_Z + 0.002)
    p += add_hex(-0.030,  0.028, PLATE_Z + 0.002)
    p += add_hex(-0.030, -0.022, PLATE_Z + 0.002)

    # 상부 소형 롤러 (고정)
    p += add_roller(ROL_UP_X, ROL_UP_Y, 0.0, ROL_UP_R)

    # 기둥 (52mm 면)
    p.append(add_box3(PILLAR_W, PILLAR_H, 0.016,
                      (PILLAR_X - PILLAR_W / 2, 0.012, PLATE_Z), MAT_ZINC))

    # 스프링 조임 — 기둥 위 수나사 + 너트 + 코일
    sx, sy, sz = PILLAR_X - 0.006, 0.052, 0.004
    p.append(add_cyl(0.0024, 0.038, T(sx, sy, sz), MAT_STEEL))
    p.append(add_cyl(0.0055, 0.0035, T(sx, sy + 0.016, sz), MAT_STEEL, verts=6))
    p.append(add_cyl(0.0055, 0.0035, T(sx, sy + 0.020, sz), MAT_STEEL, verts=6))
    for i in range(8):
        p.append(add_torus(0.0068, 0.0015, T(sx, sy - 0.008 + i * 0.0038, sz), MAT_SPR, rot=AX))
    return join_group(p, "InterlockBase", origin=T(0.0, 0.0, 0.0))


def build_hook():
    """가동 후크 + 하부 대형 롤러. 닫힘: 키퍼와 수평 4.5mm / 수직 8mm."""
    p = []
    p.append(add_cyl(0.006, 0.016, T(PIV_X, PIV_Y, 0.0), MAT_STEEL, rot=AX, verts=6))
    p += add_roller(0.0, 0.0, 0.0, ROL_DN_R)

    # 도면 후크: 왼쪽 경사 → 수평 바 → 위로 꺾인 걸쇠
    hx = HOOK_FACE_X
    hy = HOOK_TOP_Y
    hook_pts = [
        (PIV_X + 0.012, PIV_Y + 0.008),
        (PIV_X + 0.012, PIV_Y - 0.010),
        (hx + 0.018, hy - 0.018),          # 경사 선단
        (hx + 0.004, hy - 0.018),
        (hx + 0.004, hy - 0.002),
        (hx,         hy - 0.002),
        (hx,         hy + 0.004),          # 걸쇠 윗면 (키퍼 아래 8mm)
        (hx + 0.016, hy + 0.004),
        (hx + 0.016, PIV_Y + 0.008),
    ]
    p.append(add_plate(hook_pts, HOOK_T, MAT_ZINC,
                      loc=(0.0, 0.001, 0.0), bevel_w=0.0005, name="hookBody"))
    return join_group(p, "Hook", origin=T(PIV_X, PIV_Y, PIV_Z))


def build_keeper():
    """헤더 고정 키퍼 + 인터록 전기 스위치 (178p 우측)."""
    p = []
    # 키퍼 암: 기둥에서 맞춤선 쪽으로
    keep_len = abs(KEEPER_FACE_X - PILLAR_X) + 0.018
    keep_cx = PILLAR_X - keep_len / 2
    keep_cy = KEEPER_BOT_Y + 0.007
    p.append(add_box3(keep_len, 0.014, 0.014, (keep_cx, keep_cy, PLATE_Z), MAT_STEEL))
    # 걸림 턱 (아래를 보는 노치)
    p.append(add_box3(0.014, 0.008, 0.014,
                      (KEEPER_FACE_X - 0.007, KEEPER_BOT_Y + 0.004, PLATE_Z), MAT_STEEL))
    p.append(add_cyl(0.0022, 0.008, T(keep_cx + 0.012, keep_cy + 0.009, PLATE_Z - 0.004), MAT_STEEL, rot=AX, verts=12))
    p.append(add_cyl(0.0022, 0.008, T(keep_cx - 0.008, keep_cy + 0.009, PLATE_Z - 0.004), MAT_STEEL, rot=AX, verts=12))

    # 인터록 전기 스위치 (키퍼 끝)
    sw_x = KEEPER_FACE_X - 0.028
    sw_y = keep_cy + 0.004
    p.append(add_box3(0.030, 0.024, 0.022, (sw_x, sw_y, PLATE_Z + 0.004), MAT_SW))
    p.append(add_box3(0.010, 0.016, 0.006, (sw_x + 0.012, sw_y - 0.002, PLATE_Z - 0.010), MAT_SWC))
    p.append(add_box3(0.010, 0.016, 0.006, (sw_x + 0.012, sw_y - 0.002, PLATE_Z + 0.016), MAT_SWC))
    return join_group(p, "Keeper", origin=T(0.0, 0.0, 0.0))


build_base()
build_hook()
build_keeper()


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB',
        use_selection=False, export_apply=True, export_yup=True)
    print("[hall_interlock] 내보내기 완료:", path)


export_glb(OUTPUT_PATH)
print("노드:", sorted(o.name for o in bpy.data.objects))
