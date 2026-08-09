# -*- coding: utf-8 -*-
# =============================================================================
#  승강기 과속조절기 (Overspeed Governor) — Otis XSQ115-02 정밀 실사 모델링 v5.0
# =============================================================================

import bpy
import math
import os

OUTPUT_PATH = r"C:\Users\goodm\Desktop\simmul\models\gltf\overspeed_governor.glb"


def T(x, y, z):
    """three.js(govBodyGrp 로컬, Y-up/Z-front) → Blender(Z-up/-Y-front)."""
    return (x, -z, y)


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for b in list(block):
            if b.users == 0:
                block.remove(b)

reset_scene()

# =============================================================================
#  1. 재질 정의 (Otis XSQ115-02 실사 기준)
# =============================================================================
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

MAT_BLUE    = make_material("Gov_Blue",     (0.015, 0.055, 0.220), metallic=0.15, roughness=0.32, coat=0.30)
MAT_BLUE_DK = make_material("Gov_BlueDk",   (0.008, 0.032, 0.140), metallic=0.15, roughness=0.35, coat=0.25)
MAT_SPOKE   = make_material("Gov_Spoke",    (0.920, 0.600, 0.015), metallic=0.18, roughness=0.24, coat=0.20)  # 노란색 3발이 스포크
MAT_YELLOW  = make_material("Gov_Yellow",   (0.920, 0.600, 0.015), metallic=0.12, roughness=0.24, coat=0.20)  # 광택 안전 옐로우 도장
MAT_STEEL   = make_material("Gov_Steel",    (0.760, 0.780, 0.820), metallic=0.98, roughness=0.14)  # 헤어라인 폴리시드 스테인리스 (실버 톱날/쇄기)
MAT_CHROME  = make_material("Gov_Chrome",   (0.850, 0.865, 0.890), metallic=1.00, roughness=0.03)  # 거울 크롬
MAT_GREY    = make_material("Gov_Grey",     (0.450, 0.475, 0.510), metallic=0.75, roughness=0.25)  # 아노다이징 알루미늄
MAT_CAM     = make_material("Gov_Cam",      (0.760, 0.780, 0.820), metallic=0.95, roughness=0.15)  # ★날(캠) - 실버/스틸 금속색
MAT_DARK    = make_material("Gov_Dark",     (0.040, 0.045, 0.055), metallic=0.50, roughness=0.45)
MAT_DOME    = make_material("Gov_Dome",     (0.880, 0.895, 0.920), metallic=1.00, roughness=0.05)  # 동그란 진자 고광택 크롬
MAT_GLASS   = make_material("Gov_Glass",    (0.080, 0.220, 0.580), metallic=0.02, roughness=0.05, alpha=0.32) # 반투명 파란 유리가드
MAT_LABEL   = make_material("Gov_Label",    (0.700, 0.725, 0.750), metallic=0.00, roughness=0.40)
MAT_YCAP    = make_material("Gov_YCap",     (0.520, 0.420, 0.060), metallic=0.35, roughness=0.30)
MAT_GOLD    = make_material("Gov_Gold",     (0.520, 0.400, 0.115), metallic=0.95, roughness=0.22, coat=0.15)

# =============================================================================
#  2. 헬퍼
# =============================================================================
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

def add_cyl(radius, depth, loc, mat, rot=(0, 0, 0), verts=32, smooth=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth,
                                        location=loc, rotation=rot)
    return _finish(mat, smooth)

def add_torus(major, minor, loc, mat, rot=(0, 0, 0), mseg=72, nseg=14):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=mseg, minor_segments=nseg,
                                     location=loc, rotation=rot)
    return _finish(mat, smooth=True)

def add_sphere(radius, loc, mat, squash_z=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=30, ring_count=18)
    if squash_z != 1.0:
        bpy.context.active_object.scale = (1.0, squash_z, 1.0)
    return _finish(mat, smooth=True)

def add_ring(r_out, r_in, depth, loc, mat, rot=(0, 0, 0), verts=96):
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
    return _finish(mat, smooth=False)

def add_plate(pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), bevel_w=0.0012, name="plate"):
    mesh = bpy.data.meshes.new(name)
    verts = [(p[0], 0.0, p[1]) for p in pts]
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.modifiers.new("tri", 'TRIANGULATE')
    sol = obj.modifiers.new("sol", 'SOLIDIFY'); sol.thickness = depth; sol.offset = 0
    if bevel_w > 0:
        bev = obj.modifiers.new("bev", 'BEVEL'); bev.width = bevel_w; bev.segments = 2
    for md in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    obj.location = loc
    obj.rotation_euler = rot
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def add_helix(loc, mat, coil_r=0.020, wire=0.0050, turns=9, length=0.098, name="helix"):
    cdata = bpy.data.curves.new(name + "_curve", type='CURVE')
    cdata.dimensions = '3D'
    cdata.bevel_depth = wire
    cdata.bevel_resolution = 5
    cdata.resolution_u = 8
    sp = cdata.splines.new('POLY')
    ppt = 16
    N = int(turns * ppt)
    sp.points.add(N - 1)
    for i in range(N):
        a = 2.0 * math.pi * i / ppt
        frac = i / (N - 1)
        sp.points[i].co = (coil_r * math.cos(a), coil_r * math.sin(a), length * frac, 1.0)
    o = bpy.data.objects.new(name, cdata)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    o.location = loc
    return _finish(mat, smooth=True)

def add_wing_nut(cx, cy, zb, wing=0.016, tilt=math.radians(22)):
    """나비너트 — 스터드 + 원통 몸통 + 축을 사이에 두고 뻗은 납작한 날개 2장.
       zb 는 조여지는 면(덮개 뒷면). ★날개는 축을 품은 평면의 판이라 y 로 얇고 x 로 길다.
       add_box dims 는 (x, z깊이, y높이) 순서 — 헷갈리면 날개가 뭉개진다."""
    p = [add_cyl(0.0038, 0.014, T(cx, cy, zb - 0.003), MAT_CHROME, rot=AX, verts=14),
         add_cyl(0.0080, 0.009, T(cx, cy, zb - 0.0055), MAT_CHROME, rot=AX, verts=20)]
    c, s = math.cos(tilt), math.sin(tilt)
    for sgn in (1, -1):
        wx = cx + sgn * c * (0.006 + wing / 2)
        wy = cy + sgn * s * (0.006 + wing / 2)
        p.append(add_box((wing, 0.009, 0.0032), T(wx, wy, zb - 0.0055),
                         MAT_CHROME, rot=(0, -tilt, 0)))
        p.append(add_cyl(0.0016, 0.009, T(cx + sgn * c * (0.006 + wing),
                                          cy + sgn * s * (0.006 + wing), zb - 0.0055),
                         MAT_CHROME, rot=AX, verts=10))
    return p

def tangent_hull(c0, r0, c1, r1, n=26):
    """두 원을 외접선으로 이은 윤곽(CCW) — 진자 암(피벗 보스 ↔ 웨이트)용."""
    dx, dy = c1[0] - c0[0], c1[1] - c0[1]
    d = math.hypot(dx, dy)
    base = math.atan2(dy, dx)
    a = math.acos(max(-1.0, min(1.0, (r0 - r1) / d)))
    pts = []
    for i in range(n + 1):
        t = base + a + (2 * math.pi - 2 * a) * i / n
        pts.append((c0[0] + r0 * math.cos(t), c0[1] + r0 * math.sin(t)))
    for i in range(n + 1):
        t = base - a + 2 * a * i / n
        pts.append((c1[0] + r1 * math.cos(t), c1[1] + r1 * math.sin(t)))
    return pts


def boolean_cut(target, cutter):
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    md = target.modifiers.new("cut", 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = cutter
    bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target

def join_group(objs, name, origin=None):
    objs = [o for o in objs if o is not None]
    if not objs:
        return None
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
#  3. 설계 상수 (three 좌표 = environment.js govBodyGrp 로컬)
# =============================================================================
GWY    = 0.225     # 휠 중심 높이
G_R    = 0.100     # 로프 홈 반경
RIM_RO = 0.108     # 홈 플랜지 중심 반경
Y_OUT, Y_IN = 0.104, 0.098      # ★노란 전면 밴드 — 얇은 최외각 테두리
B_OUT, B_IN = 0.0975, 0.082      # 그 안쪽 파란 전면 밴드
# ── 날(라쳇) — 160639.mp4 육성 지시의 핵심 ────────────────────────────────────
#   "날이 너무 두꺼워 / 날이 크지 않아 / 날을 얇게 해서 이 사이에 위치해야 돼
#    얘랑 얘 바로 다음 면에 이 날이 존재한다고. 겹치지 않아, 진자랑."
#   → 날은 **작고 얇은** 라쳇이고, z 로는 **진자 바로 앞 면**(진자와 안 겹침),
#     캐치 레버·스프링보다는 **뒤**다. 즉 "진자와 스프링 사이".
CAM_OUT, CAM_ROOT = 0.056, 0.044   # ★작게 (예전 0.076/0.052 는 "너무 크다")
CAM_TEETH = 10                     # ★js/environment.js geom.toothStep = 2π/CAM_TEETH 와 짝
CAM_T     = 0.004                  # ★얇게 (예전 0.008~0.011)
# 위상은 발톱 궤적에서 역산한다: 이빨 팁각 = CAM_PHASE + (0.80+k)·step 이므로
# 발톱 트립각(189.1°) 바로 앞(188.5°)에 팁이 오도록 15.7°. 어긋나면 발톱이 등면에 얹힌다.
CAM_PHASE = math.radians(15.7)
CLAW_GAP  = 0.0015                 # 대기 시 발톱이 톱니끝 위에 띄우는 여유
CLAW_A0, CLAW_A1 = 181.0, 189.5    # 발톱 안쪽 모서리가 훑는 방위(도)
CLAW_T    = 0.006                  # ★발톱도 얇게
CLAW_Z    = 0.0450                 # 발톱 평면 = 날 평면 (같은 면에서 문다)
                                   #   0.042~0.048 → 진자 앞면(0.041) 위 1mm, 날을 다 덮는다
AX = (math.pi / 2, 0, 0)        # 실린더/토러스 축을 three-z(휠 축)로

CATCH_PIV = (0.000, 0.268, 0.0535)  # 캐치 피벗 — 레버를 날보다 앞 면으로 뺐다
LEV_TILT  = math.radians(17)        # 레버 기울기
LEV_L, LEV_R = -0.105, 0.118
SPR_TILT  = math.pi / 2 - LEV_TILT
SPR_BASE  = (CATCH_PIV[0] + 0.112 * math.cos(LEV_TILT),
             CATCH_PIV[1] + 0.112 * math.sin(LEV_TILT), CATCH_PIV[2])
SPR_REACH = 0.114
SHOE_X    = 0.108
SHOE_Y0, SHOE_Y1 = 0.146, 0.222

BASE_L    = -0.175
SW_X, SW_Y, SW_Z = -0.139, 0.220, 0.050
SW_W, SW_H, SW_D = 0.032, 0.106, 0.028
SW_TILT   = math.radians(15)
Z_HIT     = 0.062

# ── 진자 ────────────────────────────────────────────────────────────────────
#   "진자의 위치는 맞아" — 반경은 유지. 대신 ①앞뒤로 관통해 튀어나오고
#   ②뭉치(릴리즈 탭)가 스위치에 닿게 더 바깥으로 나가야 한다.
#   피벗→웨이트 오프셋을 접선/반경으로 쪼개야 rotation.z +0.45 가 원심 개방이 된다.
PEND_PIV_R = 0.030                  # 피벗 볼트 반경 위치
PEND_ANG_A = math.radians(155)      # 웨이트가 스포크 사이 권역 한가운데 오도록 역산한 값
PEND_ARM_T = 0.026                  # 피벗→웨이트 접선 성분 (개방 스트로크의 원천)
PEND_ARM_R = 0.022                  # 피벗→웨이트 반경 성분
PEND_MASS  = math.hypot(PEND_PIV_R + PEND_ARM_R, PEND_ARM_T)   # 0.0581 대기 반경
PEND_LAG   = math.atan2(PEND_ARM_T, PEND_PIV_R + PEND_ARM_R)   # 웨이트가 피벗보다 뒤처지는 각
PEND_W_R   = 0.0190                 # 웨이트 원판 반경
PEND_B_R   = 0.0105                 # 피벗 보스 반경
PEND_W_T   = 0.014                  # 웨이트 두께(z) — 두툼하게
PEND_TAB_L = 0.010                  # ★릴리즈 탭 반경 길이 (스위치에 닿도록 2mm 연장)
PEND_TAB_W = 0.014
PEND_REAR  = -0.024                 # 피벗 볼트 뒤끝 — 뒷면 링크가 붙는 z
PEND_LNK_T = 0.007
SPOKE_N    = 3
SPOKE_A0   = PEND_ANG_A - PEND_LAG - math.radians(30)   # 첫 스포크 방위 ≈ 98.4°

# ── z 층 (뒤 → 앞) ──────────────────────────────────────────────────────────
#   진자 0.027~0.041 → 날 0.0425~0.0465 → 캐치 레버 0.048~0.059
Z_WHEEL_F = 0.026    # 휠 전면 최전방
Z_CAM     = 0.0445   # ★날 평면 중심 — 진자 바로 다음 면(겹치지 않음), 레버보다 뒤
Z_PEND_F  = 0.041    # 진자 웨이트 전면 z
Z_PEND    = 0.032    # 진자 기준 평면 (뒷면 링크 계산용)
Z_GLASS   = 0.042    # 반투명 커버 전면
Z_LEVER   = CATCH_PIV[2]            # 캐치 레버 평면 중심 (0.0535)

def LEVP(rx, ry):
    """캐치 레버 로컬(수평 기준, 원점=피벗) → govBodyGrp 로컬. 기울기 LEV_TILT 적용."""
    c, s = math.cos(LEV_TILT), math.sin(LEV_TILT)
    return (CATCH_PIV[0] + rx * c - ry * s, CATCH_PIV[1] + rx * s + ry * c)

SW_ROT = (0, SW_TILT, 0)

def SWP(x, y):
    c, s = math.cos(SW_TILT), math.sin(SW_TILT)
    dx, dy = x - SW_X, y - SW_Y
    return (SW_X + dx * c + dy * s, SW_Y - dx * s + dy * c)

ACT_DIR   = (math.cos(SW_TILT), -math.sin(SW_TILT))
ACT_NRM   = (-ACT_DIR[1], ACT_DIR[0])
ACT_TIP   = (-0.0930, 0.2180)
ACT_HT    = 0.005
ACT_HR    = 0.006
ACT_THK   = 0.010
SECT_R    = 0.013
_ACT_AXT  = (ACT_TIP[0] - ACT_NRM[0] * ACT_HT, ACT_TIP[1] - ACT_NRM[1] * ACT_HT)
_ACT_FACE = SWP(SW_X + SW_W / 2 - 0.001, SW_Y)
ACT_LEN   = ((_ACT_AXT[0] - _ACT_FACE[0]) * ACT_DIR[0] + (_ACT_AXT[1] - _ACT_FACE[1]) * ACT_DIR[1])
ACT_ROOT  = (_ACT_AXT[0] - ACT_DIR[0] * ACT_LEN, _ACT_AXT[1] - ACT_DIR[1] * ACT_LEN)
PLG_BASE  = (ACT_ROOT[0], ACT_ROOT[1], SW_Z)

# =============================================================================
#  4-1. BaseFrame — 베이스·중앙 사각 마운트판 (★볼트 단 1개만)·뒷면 투명 커버 & 나비너트
# =============================================================================
def build_base():
    p = []
    bw = 0.150 - BASE_L
    bcx = (BASE_L + 0.150) / 2
    p.append(add_box((bw + 0.040, 0.170, 0.020), T(bcx, 0.010, 0), MAT_BLUE_DK))
    for bx, bz in ((BASE_L - 0.005, 0.065), (0.150, 0.065),
                   (BASE_L - 0.005, -0.065), (0.150, -0.065)):
        p.append(add_cyl(0.0065, 0.012, T(bx, 0.026, bz), MAT_CHROME, verts=16))
    
    body = add_box((bw, 0.140, 0.068), T(bcx, 0.055, 0), MAT_BLUE)
    top = add_box((bw + 0.016, 0.150, 0.010), T(bcx, 0.0945, 0), MAT_BLUE)
    for hx in (-G_R, G_R):
        for tgt in (body, top):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.013, depth=0.40, location=T(hx, 0.06, 0))
            boolean_cut(tgt, bpy.context.active_object)
    p += [body, top]
    for hx in (-G_R, G_R):
        p.append(add_ring(0.019, 0.013, 0.006, T(hx, 0.101, 0), MAT_DARK, verts=32))
    
    # ★뒷면 파란 페데스탈 박스는 두지 않는다 — 뒤에서 보면 휠 한가운데를 가리는
    #   네모 뭉치로만 보였다. 축은 후면 투명 커버 중앙의 육각 볼트가 잡는다.
    p.append(add_cyl(0.020, 0.022, T(0, GWY, -0.036), MAT_GREY, rot=AX, verts=28))
    p.append(add_cyl(0.009, 0.104, T(0, GWY, -0.008), MAT_CHROME, rot=AX, verts=20))
    
    ax_ = SPR_BASE[0] + math.sin(SPR_TILT) * SPR_REACH
    ay_ = SPR_BASE[1] + math.cos(SPR_TILT) * SPR_REACH
    p.append(add_box((0.013, 0.026, 0.270), T(0.145, 0.230, -0.004), MAT_BLUE))
    arm_w = (ax_ - 0.145) + 0.020
    p.append(add_box((arm_w, 0.022, 0.012), T((ax_ + 0.145) / 2, ay_ - 0.004, 0.014), MAT_BLUE_DK))
    p.append(add_box((0.040, 0.030, 0.014), T(ax_, ay_, Z_LEVER), MAT_CAM, rot=(0, SPR_TILT, 0)))
    p.append(add_box((0.125, 0.012, 0.014), T(*LEVP(0.052, -0.012), 0.030), MAT_CAM, rot=(0, -LEV_TILT, 0)))

    # ── 중앙 사각 마운트판 + ★회전축 6각 볼트 단 1개만 배치 (하단 볼트/핀 삭제) ──
    #   축 볼트 1개를 한가운데 두는 정사각 브래킷 (40×40mm, 휠 축 중심).
    #   ★판은 반투명 커버 앞판보다 앞(z 0.0465~)이어야 회색이 파랗게 죽지 않는다.
    mh, mz, mt = 0.020, 0.052, 0.011
    mc_ = 0.004
    mp = [(-mh + mc_, GWY - mh), (mh - mc_, GWY - mh), (mh, GWY - mh + mc_),
          (mh, GWY + mh - mc_), (mh - mc_, GWY + mh), (-mh + mc_, GWY + mh),
          (-mh, GWY + mh - mc_), (-mh, GWY - mh + mc_)]
    p.append(add_plate(mp, mt, MAT_GREY, loc=(0, -mz, 0), bevel_w=0.0022, name="mountPlate"))
    z0 = mz + mt / 2
    p.append(add_cyl(0.0125, 0.004, T(0, GWY, z0 + 0.002), MAT_STEEL, rot=AX, verts=28))
    p.append(add_cyl(0.0130, 0.013, T(0, GWY, z0 + 0.0105), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0130 * math.cos(math.pi / 6) * 0.97, 0.0015,
                     T(0, GWY, z0 + 0.0178), MAT_CHROME, rot=AX, verts=32))
    p.append(add_cyl(0.0068, 0.010, T(0, GWY, z0 + 0.0139), MAT_DARK, rot=AX, verts=24))

    # ── 과속스위치 본체 ──
    p.append(add_box((SW_W, SW_D, SW_H), T(SW_X, SW_Y, SW_Z), MAT_GOLD, rot=SW_ROT))
    swF = SW_Z + SW_D / 2
    p.append(add_box((0.018, 0.002, 0.036), T(*SWP(SW_X, SW_Y + 0.004), swF + 0.002), MAT_LABEL, rot=SW_ROT))
    
    sw_bot = SW_Y - SW_H / 2
    sw_top = SW_Y + SW_H / 2
    sw_shell = [SWP(SW_X - 0.018, sw_bot + 0.004), SWP(SW_X + 0.018, sw_bot + 0.004),
                SWP(SW_X + 0.020, SW_Y + 0.010), SWP(SW_X + 0.006, sw_top + 0.006),
                SWP(SW_X - 0.018, sw_top)]
    p.append(add_plate(sw_shell, 0.010, MAT_GLASS, loc=(0, -(SW_Z - SW_D / 2 - 0.005), 0), bevel_w=0.0008, name="swShell"))
    p.append(add_box((0.005, SW_D + 0.004, SW_H - 0.008), T(*SWP(SW_X - SW_W / 2 - 0.004, SW_Y), SW_Z), MAT_GREY, rot=SW_ROT))
    for by in (SW_Y - SW_H * 0.28, SW_Y + SW_H * 0.28):
        p.append(add_cyl(0.0030, 0.012, T(*SWP(SW_X - SW_W / 2 - 0.008, by), SW_Z), MAT_CHROME, rot=(0, math.pi / 2 + SW_TILT, 0), verts=12))
    return join_group(p, "BaseFrame")

# =============================================================================
#  4-2. Cover — 전후면 투명 커버 & ★뒷면 나비너트 2개 + 중앙 고정 볼트
# =============================================================================
def build_cover():
    p = []
    #   ★앞판은 y 0.100~0.126 로 낮춘다. 진자 웨이트(z 0.027~0.041)와 릴리즈 탭이
    #     휠 앞으로 솟는데, 예전 앞판(y 0.100~0.200, z 0.038~0.046)이 그 자리를 막았다.
    COV_L = -0.172
    p.append(add_box((0.145 - COV_L, 0.008, 0.026), T((COV_L + 0.145) / 2, 0.113, Z_GLASS), MAT_GLASS))
    p.append(add_box((0.008, 0.122, 0.152), T(COV_L, 0.176, 0.026), MAT_GLASS))
    p.append(add_box((0.008, 0.070, 0.100), T(0.145, 0.150, 0.004), MAT_GLASS))
    # ── 후면 투명 보호덮개 + 중앙 축 육각 볼트 + 하단 나비너트 2개 ───────────
    rc, ry0, ry1, rcut, rt, rz = 0.125, 0.100, 0.350, 0.010, 0.006, -0.052
    rzb = rz - rt / 2
    rr = [(-rc + rcut, ry0), (rc - rcut, ry0), (rc, ry0 + rcut), (rc, ry1 - rcut),
          (rc - rcut, ry1), (-rc + rcut, ry1), (-rc, ry1 - rcut), (-rc, ry0 + rcut)]
    p.append(add_plate(rr, rt, MAT_GLASS, loc=(0, -rz, 0), bevel_w=0.0018, name="rearCover"))
    p.append(add_cyl(0.020, 0.004, T(0, GWY, rzb - 0.002), MAT_STEEL, rot=AX, verts=28))
    p.append(add_cyl(0.014, 0.013, T(0, GWY, rzb - 0.0105), MAT_CHROME, rot=AX, verts=6))
    for wx in (-rc + 0.026, rc - 0.026):
        p += add_wing_nut(wx, ry0 + 0.016, rzb)

    for sx, sy in ((-0.162, 0.190), (0.135, 0.190), (-0.162, 0.112), (0.135, 0.112)):
        p.append(add_sphere(0.0036, T(sx, sy, Z_GLASS + 0.006), MAT_CHROME))
    return join_group(p, "Cover")

# =============================================================================
#  4-3. Pulley — ★노란 3발이 스포크 + 역방향 실버 톱날(라쳇 10개) 슬림 배치
# =============================================================================
def spoke_3pts(r0=0.026, r1=0.078, w0=0.0090, w1=0.0065, curve=0.008, n=8):
    """슬림한 노란 3발이 스포크 — 살짝 휜 테이퍼 블레이드."""
    left, right = [], []
    for i in range(n):
        t = i / (n - 1)
        r = r0 + (r1 - r0) * t
        off = curve * math.sin(math.pi * t * 0.9)
        w = w0 + (w1 - w0) * t
        left.append((off - w, r))
        right.append((off + w, r))
    return left + right[::-1]


def cam_pts_reverse(n=CAM_TEETH, r_out=CAM_OUT, r_root=CAM_ROOT, phase=CAM_PHASE):
    """★역방향 라쳇 날 — 걸림면이 각도 감소(CW) 쪽을 향한다.
       한 이빨: 골 → 완만한 등면(78%) → 날카로운 팁 → 급경사 걸림면(22%)."""
    pts = []
    step = 2.0 * math.pi / n
    for i in range(n):
        a0 = phase + i * step
        pts.append((math.cos(a0) * r_root, math.sin(a0) * r_root))
        a1 = a0 + step * 0.32
        r1 = r_root + (r_out - r_root) * 0.34
        pts.append((math.cos(a1) * r1, math.sin(a1) * r1))
        a2 = a0 + step * 0.62
        r2 = r_root + (r_out - r_root) * 0.78
        pts.append((math.cos(a2) * r2, math.sin(a2) * r2))
        a3 = a0 + step * 0.80
        pts.append((math.cos(a3) * r_out, math.sin(a3) * r_out))
        a4 = a0 + step * 0.88
        pts.append((math.cos(a4) * (r_root + 0.002), math.sin(a4) * (r_root + 0.002)))
    return pts

def build_pulley():
    p = []
    C = (0, GWY)
    for fz in (-0.014, 0.014):
        p.append(add_torus(RIM_RO, 0.0055, T(C[0], C[1], fz), MAT_YELLOW, rot=AX))
    p.append(add_ring(0.098, 0.094, 0.026, T(C[0], C[1], 0), MAT_DARK, rot=AX))
    
    p.append(add_ring(Y_OUT, Y_IN, 0.013, T(C[0], C[1], 0.0195), MAT_YELLOW, rot=AX))
    p.append(add_torus(0.096, 0.0011, T(C[0], C[1], Z_WHEEL_F), MAT_DARK, rot=AX, mseg=110))
    
    # 파란 전면 밴드 + 얇은 파란 바디 링 (링을 두껍게 하면 날·진자를 가린다)
    p.append(add_ring(B_OUT, B_IN, 0.012, T(C[0], C[1], 0.019), MAT_BLUE, rot=AX))
    p.append(add_ring(0.082, 0.076, 0.024, T(C[0], C[1], 0.004), MAT_BLUE, rot=AX))

    # ── 노란 3발이 스포크 ────────────────────────────────────────────────────
    #   ★진자 2개가 스포크 사이 권역 한가운데(권역 시작점 +30°)에 오도록 SPOKE_A0 를
    #     진자 방위에서 역산한다. 두 진자가 180° 떨어져 있어 t=30° 가 유일한 해다.
    #   ★rot: Blender rotY = θ ⟺ three z 회전 -θ. 기본 스포크가 +Y(90°)를 향하므로
    #     three 방위 A 로 놓으려면 rotY = π/2 - A.
    sp3 = spoke_3pts()
    for k in range(SPOKE_N):
        ang = SPOKE_A0 + k * 2 * math.pi / SPOKE_N
        p.append(add_plate(sp3, 0.014, MAT_YELLOW, loc=(0, -0.004, GWY),
                           rot=(0, math.pi / 2 - ang, 0), bevel_w=0.0010, name="spoke3"))

    #   허브는 진자 피벗 볼트(r 0.030)가 관통할 자리를 비워 둬야 한다 → r 0.022
    p.append(add_cyl(0.022, 0.028, T(C[0], C[1], 0.002), MAT_YELLOW, rot=AX, verts=28))
    p.append(add_cyl(0.015, 0.010, T(C[0], C[1], 0.021), MAT_CHROME, rot=AX, verts=24))

    # ── 날(라쳇) — 얇고 작게, 진자 바로 앞 면 ────────────────────────────────
    p.append(add_plate(cam_pts_reverse(), CAM_T, MAT_CAM, loc=(0, -Z_CAM, GWY),
                       bevel_w=0.0008, name="camStar"))
    return join_group(p, "Pulley", origin=T(0, GWY, 0))

# =============================================================================
#  4-4. PendA / PendB — ★동그란 원형 플라이웨이트 진자 + 상단 진자 스위치 릴리즈 탭
# =============================================================================
def build_pendulum(name, pivot_ang, release_tab=False, rear_layer=0):
    """동그란 플라이웨이트 진자.
       ★"진자는 여기에 들어가 있으면서 앞뒤로 잡으러 튀어나와 있어야 되고" —
         웨이트는 휠 앞으로 두툼하게 솟고, 피벗 볼트는 휠 웨브를 관통해 뒤로 나가
         뒷면의 링크 바·인장 스프링과 물린다.
       ★암과 원판을 한 덩어리 hull 로 만들면 "오이 모양"이 된다. 원판은 독립 실루엣,
         암은 확실히 더 가는 별도 바로 뒤층에 깐다."""
    F = pivot_ang - math.pi / 2
    piv = (math.cos(pivot_ang) * PEND_PIV_R, GWY + math.sin(pivot_ang) * PEND_PIV_R)
    mc = (PEND_ARM_T, PEND_ARM_R)          # 캐노니컬 웨이트 중심 (접선, 반경)

    def W(cx, cy):
        return (piv[0] + cx * math.cos(F) - cy * math.sin(F),
                piv[1] + cx * math.sin(F) + cy * math.cos(F))

    zc = Z_PEND_F - PEND_W_T / 2           # 웨이트 평면 중심 (0.034)
    dx, dy = W(mc[0], mc[1])
    p = []
    # 암 — 원판보다 확실히 가는 바 (뒤층)
    aw = PEND_B_R * 0.62
    arm = tangent_hull((0.0, 0.0), PEND_B_R, mc, aw)
    p.append(add_plate([W(q[0], q[1]) for q in arm], 0.008, MAT_GREY,
                       loc=(0, -(zc - 0.003), 0), bevel_w=0.0012, name="pendArm"))
    # 동그란 웨이트 원판 (전 모서리 챔퍼)
    disc = [(dx + PEND_W_R * math.cos(2 * math.pi * k / 48),
             dy + PEND_W_R * math.sin(2 * math.pi * k / 48)) for k in range(48)]
    p.append(add_plate(disc, PEND_W_T, MAT_STEEL, loc=(0, -zc, 0),
                       bevel_w=0.0022, name="pendMass"))
    p.append(add_cyl(PEND_W_R - 0.0055, 0.0025, T(dx, dy, Z_PEND_F - 0.0005),
                     MAT_STEEL, rot=AX, verts=40))
    p.append(add_cyl(0.0046, 0.006, T(dx, dy, Z_PEND_F - 0.0025), MAT_CHROME, rot=AX, verts=20))
    # ── 과속스위치 릴리즈 탭 (PendA 전용) ────────────────────────────────────
    #   "스위치가 쪼가리를 못치잖아 → 더 바깥쪽으로 튀어나와야 돼"
    if release_tab:
        rl = math.hypot(dx, dy - GWY)
        ux, uy = dx / rl, (dy - GWY) / rl
        ang = math.atan2(uy, ux)
        base = PEND_W_R - 0.003
        tc = (dx + ux * (base + PEND_TAB_L / 2), dy + uy * (base + PEND_TAB_L / 2))
        p.append(add_box((PEND_TAB_L, PEND_W_T, PEND_TAB_W), T(tc[0], tc[1], zc),
                         MAT_STEEL, rot=(0, -ang, 0)))
        nose = (dx + ux * (base + PEND_TAB_L), dy + uy * (base + PEND_TAB_L))
        p.append(add_cyl(PEND_TAB_W / 2, PEND_W_T + 0.001, T(nose[0], nose[1], zc),
                         MAT_CHROME, rot=AX, verts=28))
    # ── 피벗 볼트 — 휠을 관통해 뒤로 (앞: 육각 머리 / 뒤: 링크·스프링) ────────
    #   z 상한 0.042 — 캐치 레버(0.048~)와 날(0.0425~0.0465)이 피벗 원 위를 지난다.
    p.append(add_cyl(PEND_B_R * 0.82, 0.004, T(piv[0], piv[1], 0.0345),
                     MAT_STEEL, rot=AX, verts=24))
    p.append(add_cyl(0.0072, 0.005, T(piv[0], piv[1], 0.0375), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0052, 0.041 - PEND_REAR, T(piv[0], piv[1], (0.041 + PEND_REAR) / 2),
                     MAT_CHROME, rot=AX, verts=18))
    # ── 뒷면 링크 바 + 인장 스프링 (두 진자를 뒤에서 잇는다) ─────────────────
    zl = PEND_REAR + (0.0 if rear_layer == 0 else PEND_LNK_T + 0.002)
    bar = [(-0.007, -0.072), (0.006, -0.072), (0.006, 0.002), (-0.007, 0.002)]
    p.append(add_plate([W(b[0], b[1]) for b in bar], PEND_LNK_T, MAT_STEEL,
                       loc=(0, -zl, 0), bevel_w=0.0008, name="pendLink"))
    spr_rot = (0, -(pivot_ang + math.pi / 2), 0)   # 코일 축 = 링크 축선(반경 안쪽)
    sb = W(-0.001, -0.062)
    p.append(add_box((0.015, PEND_LNK_T + 0.007, 0.011), T(sb[0], sb[1], zl), MAT_GREY))
    for i in range(7):
        sx, sy = W(-0.001, -0.032 - i * 0.0045)
        p.append(add_torus(0.0058, 0.0013, T(sx, sy, zl), MAT_CHROME,
                           rot=spr_rot, mseg=20, nseg=8))
    p.append(add_cyl(0.0026, 0.032, T(*W(-0.001, -0.046), zl), MAT_CHROME,
                     rot=spr_rot, verts=12))
    return join_group(p, name, origin=T(piv[0], piv[1], Z_PEND - 0.008))

# =============================================================================
#  4-5. Catch — 폴리시드 캐치 레버 + 떡판(캐치슈) 레그
# =============================================================================
def claw_pts():
    """쇄기 발톱 윤곽 (govBodyGrp 좌표). 바깥 변은 레버 하면을 따라 붙고,
       안쪽 변은 톱니끝(CAM_OUT) 위 CLAW_GAP 를 훑는다.
       ★운동학: 발톱을 캐치 피벗 둘레로 φ 돌리면 반경은 dr = 0.043·cosθ·φ 로만 변한다.
         그래서 θ≈180°(왼쪽)에 둬야 낙하(+0.12rad)가 반경 감소 = 물림이 된다."""
    ri = CAM_OUT + CLAW_GAP
    _c, _s = math.cos(LEV_TILT), math.sin(LEV_TILT)

    def lev_bottom(x):
        rx = (x - 0.013 * _s) / _c
        return (x, CATCH_PIV[1] + rx * _s - 0.013 * _c)

    pts = [lev_bottom(x) for x in (-0.0760, -0.0700, -0.0640, -0.0610)]
    n = 4
    for i in range(n):
        a = math.radians(CLAW_A0 + (CLAW_A1 - CLAW_A0) * i / (n - 1))
        pts.append((math.cos(a) * ri, GWY + math.sin(a) * ri))
    return pts


def build_catch():
    P = CATCH_PIV
    _c, _s = math.cos(LEV_TILT), math.sin(LEV_TILT)

    def A(rx, ry):
        return (P[0] + rx * _c - ry * _s, P[1] + rx * _s + ry * _c)

    p = []
    tip = [(LEV_L + 0.020,  0.011), (LEV_L - 0.002,  0.011), (LEV_L - 0.004,  0.002),
           (LEV_L - 0.004, -0.014), (LEV_L + 0.004, -0.016), (LEV_L + 0.020, -0.007)]
    plate = tip + [(LEV_R, -0.013), (LEV_R, 0.014)]
    p.append(add_plate([A(q[0], q[1]) for q in plate], 0.011, MAT_STEEL,
                       loc=(0, -Z_LEVER, 0), bevel_w=0.0016, name="catchPlate"))

    # ── 쇄기 발톱 — 레버 하면에서 날 평면(Z_CAM)까지 한 단 내려온 얇은 후크 ──
    #   "쇠기가 나중에 날을 무는 거란 말이야" — 발톱과 날이 같은 면(Z_CAM)에서 만난다.
    p.append(add_plate(claw_pts(), CLAW_T, MAT_CAM,
                       loc=(0, -CLAW_Z, 0), bevel_w=0.0008, name="pawlClaw"))
    p.append(add_cyl(0.0035, CLAW_T + 0.010, T(-0.0665, 0.2320, CLAW_Z + 0.004),
                     MAT_CHROME, rot=AX, verts=16))          # 발톱 리벳 (레버와 결합)

    p.append(add_cyl(0.0130, 0.013, T(P[0], P[1], Z_LEVER + 0.013), MAT_CHROME, rot=AX, verts=28))
    p.append(add_cyl(0.0065, 0.026, T(P[0], P[1], Z_LEVER - 0.004), MAT_CHROME, rot=AX, verts=16))
    p.append(add_cyl(0.0095, 0.011, T(*A(0.112, 0.002), Z_LEVER + 0.011), MAT_CHROME, rot=AX, verts=20))
    p.append(add_cyl(0.015, 0.009, T(SPR_BASE[0], SPR_BASE[1] - 0.003, SPR_BASE[2]), MAT_GREY, rot=(0, SPR_TILT, 0), verts=20))

    leg = [(0.094, 0.300), (0.122, 0.312), (0.137, 0.268),
           (0.134, 0.230), (0.114, 0.226), (0.110, 0.266)]
    p.append(add_plate(leg, 0.014, MAT_STEEL, loc=(0, -Z_LEVER, 0), bevel_w=0.0012, name="shoeLeg"))
    for rx, ry in ((0.118, 0.290), (0.126, 0.250)):
        p.append(add_sphere(0.0036, T(rx, ry, Z_LEVER + 0.008), MAT_CHROME))
    p.append(add_box((0.018, 0.048, 0.024), T(0.128, 0.228, 0.024), MAT_STEEL))
    shoe_h = SHOE_Y1 - SHOE_Y0
    shoe_y = (SHOE_Y0 + SHOE_Y1) / 2
    p.append(add_box((0.020, 0.015, shoe_h), T(SHOE_X + 0.016, shoe_y, 0.0), MAT_STEEL))
    p.append(add_box((0.006, 0.014, shoe_h - 0.004), T(SHOE_X + 0.003, shoe_y, 0.0), MAT_DARK))
    return join_group(p, "Catch", origin=T(P[0], P[1], P[2]))

# =============================================================================
#  4-6. Spring — 수직 생성 (env 래퍼가 기울임)
# =============================================================================
def build_spring():
    B = SPR_BASE
    p = []
    p.append(add_cyl(0.0165, 0.008, T(B[0], B[1] + 0.004, B[2]), MAT_GREY, verts=20))
    p.append(add_helix(T(B[0], B[1] + 0.008, B[2]), MAT_CHROME, coil_r=0.020, wire=0.0050, turns=8, length=0.082, name="coil"))
    p.append(add_cyl(0.0052, 0.104, T(B[0], B[1] + 0.058, B[2]), MAT_CHROME, verts=16))
    p.append(add_cyl(0.0090, 0.016, T(B[0], B[1] + 0.104, B[2]), MAT_CHROME, verts=6))
    p.append(add_sphere(0.0080, T(B[0], B[1] + SPR_REACH, B[2]), MAT_CHROME))
    return join_group(p, "Spring", origin=T(B[0], B[1], B[2]))

# =============================================================================
#  4-7. Plunger — 실사형 액추에이터
# =============================================================================
def build_plunger():
    R, K = ACT_ROOT, ACT_TIP
    ux, uy = ACT_DIR
    nx, ny = ACT_NRM
    p = []
    p.append(add_cyl(SECT_R, ACT_THK - 0.001, T(R[0], R[1], SW_Z), MAT_STEEL, rot=AX, verts=40))
    p.append(add_cyl(0.0035, ACT_THK + 0.010, T(R[0], R[1], SW_Z), MAT_CHROME, rot=AX, verts=16))
    tipAx = (K[0] - nx * ACT_HT, K[1] - ny * ACT_HT)
    arm = [(R[0] + nx * ACT_HR, R[1] + ny * ACT_HR), K,
           (tipAx[0] - nx * ACT_HT, tipAx[1] - ny * ACT_HT),
           (R[0] - nx * ACT_HR, R[1] - ny * ACT_HR)]
    p.append(add_plate(arm, ACT_THK, MAT_STEEL, loc=(0, -SW_Z, 0), bevel_w=0.0006, name="actArm"))
    hx, hy = tipAx[0] - ux * 0.003, tipAx[1] - uy * 0.003
    p.append(add_cyl(0.0024, ACT_THK + 0.020, T(hx, hy, SW_Z), MAT_CHROME, rot=AX, verts=14))
    for zc in (SW_Z - ACT_THK / 2 - 0.0085, SW_Z + ACT_THK / 2 + 0.0085):
        p.append(add_cyl(0.0040, 0.004, T(hx, hy, zc), MAT_CHROME, rot=AX, verts=14))
    return join_group(p, "Plunger", origin=T(*PLG_BASE))

# =============================================================================
#  5. 빌드 & 내보내기
# =============================================================================
build_base()
build_cover()
build_pulley()
build_pendulum("PendA", PEND_ANG_A, release_tab=True, rear_layer=0)
build_pendulum("PendB", PEND_ANG_A + math.pi, rear_layer=1)
build_catch()
build_spring()
build_plunger()

def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=False, export_apply=True, export_yup=True)
    print("[overspeed_governor v5.0] 정밀 실사 내보내기 완료:", path)

export_glb(OUTPUT_PATH)
print("완료 — 오브젝트 노드 리스트:", sorted(o.name for o in bpy.data.objects))
