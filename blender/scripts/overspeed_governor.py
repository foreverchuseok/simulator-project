# -*- coding: utf-8 -*-
# =============================================================================
#  승강기 과속조절기 (Overspeed Governor) — Otis XSQ115-02 정밀 실사 모델링 v5.0
# =============================================================================

import bpy
import math
import os
import re
from pathlib import Path

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
MAT_STEEL   = make_material("Gov_Steel",    (0.760, 0.780, 0.820), metallic=0.98, roughness=0.14)  # 헤어라인 폴리시드 스테인리스
MAT_PAWL    = make_material("Gov_Pawl",     (0.240, 0.270, 0.320), metallic=0.92, roughness=0.20)  # ★쐐기 전용 짙은 건메탈 스틸 (톱날과 뚜렷한 대비)
MAT_CHROME  = make_material("Gov_Chrome",   (0.850, 0.865, 0.890), metallic=1.00, roughness=0.03)  # 거울 크롬
MAT_GREY    = make_material("Gov_Grey",     (0.450, 0.475, 0.510), metallic=0.75, roughness=0.25)  # 아노다이징 알루미늄
MAT_CAM     = make_material("Gov_Cam",      (0.760, 0.780, 0.820), metallic=0.95, roughness=0.15)  # ★날(캠) - 실버/스틸 금속색
MAT_DARK    = make_material("Gov_Dark",     (0.040, 0.045, 0.055), metallic=0.50, roughness=0.45)
MAT_DOME    = make_material("Gov_Dome",     (0.880, 0.895, 0.920), metallic=1.00, roughness=0.05)  # 동그란 진자 고광택 크롬
MAT_GLASS   = make_material("Gov_Glass",    (0.080, 0.220, 0.580), metallic=0.02, roughness=0.05, alpha=0.32) # 반투명 파란 유리가드
MAT_LABEL   = make_material("Gov_Label",    (0.700, 0.725, 0.750), metallic=0.00, roughness=0.40)
MAT_YCAP    = make_material("Gov_YCap",     (0.520, 0.420, 0.060), metallic=0.35, roughness=0.30)
MAT_GOLD    = make_material("Gov_Gold",     (0.520, 0.400, 0.115), metallic=0.95, roughness=0.22, coat=0.15)
MAT_COPPER  = make_material("Gov_Copper",   (0.780, 0.430, 0.175), metallic=0.92, roughness=0.26, coat=0.18)  # 구리빛 도금 — 진자 원통·쇄기
MAT_RED     = make_material("Gov_Red",      (0.850, 0.080, 0.060), metallic=0.20, roughness=0.35)  # 빨간색 락타이트 씰 마킹

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

def add_helix(loc, mat, coil_r=0.020, wire=0.0050, turns=9, length=0.098, name="helix",
              rot=(0, 0, 0)):
    """코일 스프링. 기본 축은 Blender +Z(= three +Y). rot 로 눕힐 수 있다
       (three +X 축으로 눕히려면 rot=(0, π/2, 0))."""
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
    o.rotation_euler = rot
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
# ── 날(라쳇) — 원형 톱날형 래칫 휠 (device_china.mp4 28~35s 실사 기준) ────────
#   원형 톱날 모양으로 한 톱날의 직각 스톱면에 과속 시 쐐기가 정확히 맞물리는 구조.
CAM_OUT, CAM_ROOT = 0.055, 0.038   # 톱날 외경 55mm, 골 바닥 38mm
CAM_TEETH = 8                      # 영상과 일치하는 8개 원형 톱날
CAM_T     = 0.005                  # 톱날 두께 5mm
_STEP = 2.0 * math.pi / CAM_TEETH
CAM_PHASE = math.radians(34.0)     # 트립(+0.60rad) 때 부리가 골 바닥에 오도록 위상. 18°는 등면에 박힘.

CLAW_GAP  = 0.0020                 # 대기 시 쐐기 부리가 톱니끝 위에 띄우는 여유 (2mm)
AX = (math.pi / 2, 0, 0)        # 실린더/토러스 축을 three-z(휠 축)로

CATCH_PIV = (0.000, 0.268, 0.0535)  # 캐치 피벗 — 레버를 날보다 앞 면으로 뺐다
LEV_TILT  = math.radians(17)        # 레버 기울기
LEV_L, LEV_R = -0.105, 0.118
SPR_TILT  = math.pi / 2 - LEV_TILT
SPR_BASE  = (CATCH_PIV[0] + 0.112 * math.cos(LEV_TILT),
             CATCH_PIV[1] + 0.112 * math.sin(LEV_TILT), CATCH_PIV[2])
SPR_REACH = 0.114
SHOE_X    = 0.106
SHOE_Y0, SHOE_Y1 = 0.185, 0.255    # 휠 중심(0.225) 2~3시 방향으로 상향 조정
# Mechanism pose, exported with the model; JS reads these instead of a second copy.
TRIP_PENDULUM, TRIP_PAWL, CATCH_RELEASE = 0.45, 0.60, 0.12
_root=Path(__file__).resolve().parents[2]
_rope_d=float(re.search(r'const GOV_ROPE_D\s*=\s*([0-9.]+)',(_root/'index.html').read_text(encoding='utf-8')).group(1))
ROPE_RADIUS_LOCAL = _rope_d / 2 / 1.5   # existing governor mount scale contract
# The bottom inner pad corner first touches the rope; solve its rigid rotation.
_lo, _hi = -0.20, 0.0
for _ in range(60):
    _a=(_lo+_hi)/2
    _x=SHOE_X*math.cos(_a)-(SHOE_Y0+0.002-CATCH_PIV[1])*math.sin(_a)
    if _x < 0.100+ROPE_RADIUS_LOCAL: _lo=_a
    else: _hi=_a
CATCH_GRIP=(_lo+_hi)/2

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
PEND_W_R   = 0.0190                 # 웨이트 원판 반경 (앞·뒤 원판 공통)
PEND_B_R   = 0.0105                 # 피벗 보스 반경
PEND_TAB_L = 0.010                  # ★릴리즈 탭 반경 길이 (스위치에 닿도록 2mm 연장)
PEND_TAB_W = 0.014
PEND_TAB_T = 0.014                  # 릴리즈 탭 두께(z) — 탭은 전면 원판 층에만 붙는다
PEND_REAR  = -0.024                 # ★웨이트 뒤끝 = 피벗 볼트 뒤끝 = 뒷면 링크 z
PEND_LNK_T = 0.007
# ── ★웨브 관통 목 (앞 원판 ↔ 뒤 원판을 잇는 축) ─────────────────────────────
#   반경은 두 간섭이 정한다. 개방(+0.45rad)에서 웨이트 중심은 r 0.0581 → 0.0627.
#   ① 파란 바디 링 내경 0.076 (z -0.008~0.016) → 0.076-0.0627-여유 = 0.0120 상한
#   ② 노란 스포크는 진자 쪽 반폭을 2.2mm 로 묶어 전 스트로크 간극 ≥ 2.3mm 를 확보하고,
#      빈 창 쪽으로만 넓혀 실사처럼 두껍게 보이게 한다.
PEND_THRU_R = 0.0120
PEND_WEB_R  = -0.010                # 관통 목 뒤끝 — 바디 링(-0.008)보다 2mm 뒤
PEND_WEB_F  = 0.026                 # 관통 목 앞끝 — 전면 밴드(0.025)보다 1mm 앞
SPOKE_N    = 3
# 첫 스포크 방위. 3발이 스포크와 180° 진자 2개를 동시에 권역 한가운데 둘 수는 없어
# "권역 시작점 +30°" 가 최적해다. 여기에 SPOKE_BIAS 를 더한다 —
#   ① 블레이드가 curve 로 방위 감소 쪽으로 휘어 실제 중심선이 8°가량 밀려 있고
#   ② 개방에서 두 진자가 방위 +13.8° 이동해 PendB 쪽 창이 먼저 닫힌다.
#   +14° 가 A(대기)·B(개방) 양쪽 최소거리를 0.0160 으로 같게 만드는 최적값이다.
SPOKE_BIAS = math.radians(14)
SPOKE_A0   = PEND_ANG_A - PEND_LAG - math.radians(30) + SPOKE_BIAS   # 첫 스포크 방위 ≈ 112.4°

# ── ★진자 뒷면 연동 기구 — 링크 2개 (실사 조속기 원리) ────────────────────────
#   육성 지시(153224.mp4 40~115s): "뒤쪽에서 보면 동그라미보다 넓은 브라켓이 있고,
#   두 진자가 링크 두 개로 이어져 있어. 하나는 스프링이고 하나는 스프링이 아닌 거."
#   → 진자마다 따로 붙던 가짜 코일·링크를 전부 버리고, **두 진자를 실제로 잇는**
#     ①강성 연동 링크(타이바) ②복귀 인장 스프링 두 부재만 남긴다.
#
#   [캐노니컬 좌표] build_pendulum 의 W() 좌표 — x = 접선, y = 반경.
#   월드로는 x → 방위 (PEND_ANG_A-90°), y → 방위 PEND_ANG_A 로 간다.
#   두 진자는 점대칭이라 B 프레임의 캐노니컬 c 는 월드에서 -c·e1 로 나온다.
#
#   ★타이바(강성): A 러그를 캐노니컬 +k, B 러그를 -k 에 두면 두 러그의 **월드
#     오프셋이 같아진다** → 러그 간 벡터 = 피벗-피벗 벡터(2·PEND_PIV_R)로 고정.
#     즉 개방 각도와 무관하게 길이 60mm 불변, 회전 없이 **평행이동만** 하는
#     평행사변형 커플러다. 그래서 두 진자가 반드시 같은 각으로 함께 벌어진다.
#     (점대칭 위치에 링크를 걸면 길이가 변해 강성 링크가 성립하지 않는다 —
#      예전 코드가 진자마다 링크를 따로 박아 놓은 이유이자 실패한 지점.)
#   ★인장 스프링: 반대로 A·B 러그를 캐노니컬 **같은 부호 쪽**에 두어 길이가
#     변하게 한다. 원심 개방에서 60.8mm → 65.0mm 로 늘어나 복귀력을 만든다.
#   ★두 링크는 휠 중심(축 r0.009·후면 보스)을 사이에 두고 반대편을 지난다.
TIE_KX  =  0.027     # 타이바 러그 — A 캐노니컬 x (B 는 -TIE_KX). 빈 창(위쪽) 쪽
SPR_MX  = -0.022     # 인장 스프링 러그 — A 캐노니컬 x. 타이바와 반대편(아래)
SPR_NX  =  0.032     # 인장 스프링 러그 — B 캐노니컬 x
LUG_R   =  0.0095    # 브라켓 러그 보스 반경
LUG_PIN =  0.0034    # 러그 핀 반경
BRK_T   =  0.0065    # 뒷면 브라켓 판 두께

_FC = PEND_ANG_A - math.pi / 2                 # 캐노니컬 프레임 각
E1  = (math.cos(_FC), math.sin(_FC))           # 캐노니컬 +x(접선)의 월드 방향
OW  = (PEND_PIV_R * math.cos(PEND_ANG_A),
       PEND_PIV_R * math.sin(PEND_ANG_A))      # A 피벗 (휠 중심 기준)

def pend_xy(pivot_ang, cx, cy):
    """진자 캐노니컬 (접선, 반경) → 휠 로컬 XY (원점=피벗)."""
    F = pivot_ang - math.pi / 2
    piv = (math.cos(pivot_ang) * PEND_PIV_R, GWY + math.sin(pivot_ang) * PEND_PIV_R)
    return (piv[0] + cx * math.cos(F) - cy * math.sin(F),
            piv[1] + cx * math.sin(F) + cy * math.cos(F))


# 쇄기 — 삼발이 다리에서 나온 작은 브라켓에 물려 위아래로 떨어진다.
PAWL_CX = 0.002                  # 피벗 X 위치
PAWL_CY = 0.038                  # 대기 시 날과 겹치지 않게 피벗을 바깥(위)으로
PAWL_PIV = pend_xy(PEND_ANG_A, PAWL_CX, PAWL_CY)
PAWL_T   = 0.0130                # 두께 (13mm) — 안쪽(-Z)으로 두꺼워짐
PAWL_Z_FRONT = 0.0505            # 쐐기 앞면 Z
PAWL_Z   = PAWL_Z_FRONT - PAWL_T / 2   # 0.0440 (안쪽으로 확장된 중심)
PAWL_SPR_Z = PAWL_Z - PAWL_T * 0.28   # 0.0404 (두꺼워진 안쪽 영역에 스프링 배치)
BRK_Z_FRONT = 0.044
PAWL_SPR_SPAN = 0.0135           # 좌측 브라켓 ↔ 쐐기 핀 가로 스프링 간격 (13.5mm)


def get_pawl_spr_anchors():
    """쐐기 앞쪽 스프링 핀(hx, hy) 및 좌측 브라켓 체결 핀(bx, by) 좌표 반환."""
    piv = PAWL_PIV
    rx, ry = piv[0], piv[1] - GWY
    ln = math.hypot(rx, ry) or 1.0
    ux, uy = rx / ln, ry / ln
    tx, ty = -uy, ux
    # 캐치 레버 뒤에 완벽히 가려지도록 반경 오프셋 조정
    hx = piv[0] + tx * 0.002 + ux * 0.0025
    hy = piv[1] + ty * 0.002 + uy * 0.0025
    bx = hx - PAWL_SPR_SPAN
    by = hy
    return (hx, hy), (bx, by)


def lugA(cx):
    """A 진자의 캐노니컬 x 러그 → 휠 중심 기준 좌표 (대기 자세)."""
    return (OW[0] + cx * E1[0], OW[1] + cx * E1[1])

def lugB(cx):
    """B 진자의 캐노니컬 x 러그 → 휠 중심 기준 좌표 (프레임이 180° 뒤집혀 부호 반전)."""
    return (-OW[0] - cx * E1[0], -OW[1] - cx * E1[1])

# ── z 층 (뒤 → 앞) ──────────────────────────────────────────────────────────
#   진자 0.027~0.041 → 날 0.0425~0.0465 → 캐치 레버 0.048~0.059
Z_WHEEL_F = 0.026    # 휠 전면 최전방
Z_CAM     = 0.0445   # ★날 평면 중심 — 진자 바로 다음 면(겹치지 않음), 레버보다 뒤
Z_PEND_F  = 0.041    # 진자 웨이트 전면 z
Z_PEND    = 0.032    # 진자 기준 평면 (뒷면 링크 계산용)
# ★웨이트는 후면 브라켓 층(PEND_REAR)부터 전면(Z_PEND_F)까지 축방향으로 관통한다.
PEND_W_T  = Z_PEND_F - PEND_REAR         # 0.065 — 웨이트 축방향 전체 두께
PEND_W_ZC = (Z_PEND_F + PEND_REAR) / 2   # 0.0085 — 관통 추의 축방향 중심
Z_GLASS   = 0.042    # 반투명 커버 전면
Z_LEVER   = CATCH_PIV[2]            # 캐치 레버 평면 중심 (0.0535)
# ── 뒷면 층 (앞 → 뒤): 추 뒤끝 -0.024 → 브라켓 → 타이바 → 스프링 → 후면 커버 -0.049
BRK_Z   = -0.02725   # 뒷면 넓은 브라켓 판 중심 (-0.0305 ~ -0.024)
TIE_Z   = -0.036     # 타이바 평면 중심   (-0.039 ~ -0.033)
PSPR_Z  = -0.0405    # 인장 스프링 축 중심 (코일 외경 포함 -0.0476 ~ -0.0334)

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
    #   ★후면 베어링 칼라는 r0.012 로 얇다 — 예전 r0.020 은 진자 뒷면 타이바
    #     (휠 중심에서 최소 15.5mm)·인장 스프링(15.3mm)이 지나는 길을 막았다.
    p.append(add_cyl(0.012, 0.022, T(0, GWY, -0.036), MAT_GREY, rot=AX, verts=24))
    p.append(add_cyl(0.009, 0.104, T(0, GWY, -0.008), MAT_CHROME, rot=AX, verts=20))

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

    # ── ★쇄기 수평 고정 브래킷(pawlBracket)은 두지 않는다 ──
    #   쐐기는 애초에 베이스에 고정된 브래킷에 걸리는 부품이 아니다.
    #   반대편 링크에서 브래킷을 따서 쐐기와 함께 회전해야 하므로,
    #   BaseFrame 쪽 수평 브래킷과 관통 샤프트 핀·캡을 모두 삭제했다.

    # 후면 투명 커버 고정용 베이스 프레임 체결 브라켓 & 스터드 보스 (나비너트 물리 결합부)
    rc_b = 0.125
    for bx_b in (-rc_b + 0.024, rc_b - 0.024):
        p.append(add_box((0.020, 0.028, 0.024), T(bx_b, 0.120, -0.038), MAT_BLUE))
        p.append(add_cyl(0.0055, 0.008, T(bx_b, 0.120, -0.048), MAT_STEEL, rot=AX, verts=16))

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
    # ── 후면 투명 보호덮개 (스핀들 회전축 GWY 높이까지만 반절 축소) + 중앙 볼트 + 하단 나비너트 2개 ───
    rc, ry0, ry1, rcut, rt, rz = 0.125, 0.100, 0.230, 0.010, 0.006, -0.052
    rzb = rz - rt / 2
    rr = [(-rc + rcut, ry0), (rc - rcut, ry0), (rc, ry0 + rcut), (rc, ry1 - rcut),
          (rc - rcut, ry1), (-rc + rcut, ry1), (-rc, ry1 - rcut), (-rc, ry0 + rcut)]
    p.append(add_plate(rr, rt, MAT_GLASS, loc=(0, -rz, 0), bevel_w=0.0018, name="rearCover"))
    p.append(add_cyl(0.020, 0.004, T(0, GWY, rzb - 0.002), MAT_STEEL, rot=AX, verts=28))
    p.append(add_cyl(0.014, 0.013, T(0, GWY, rzb - 0.0105), MAT_CHROME, rot=AX, verts=6))
    for wx in (-rc + 0.024, rc - 0.024):
        p += add_wing_nut(wx, ry0 + 0.020, rzb)

    for sx, sy in ((-0.162, 0.190), (0.135, 0.190), (-0.162, 0.112), (0.135, 0.112)):
        p.append(add_sphere(0.0036, T(sx, sy, Z_GLASS + 0.006), MAT_CHROME))
    return join_group(p, "Cover")

# =============================================================================
#  4-3. Pulley — ★노란 3발이 스포크 + 역방향 실버 톱날(라쳇 10개) 슬림 배치
# =============================================================================
def spoke_pts(empty_side=1, r0=0.026, r1=0.078, curve=0.008, n=12):
    """노란 3발이 한 다리. 진자(대기·개방)와 겹치지 않게 진자 쪽은 얇게 두고
    빈 창 쪽으로만 넓힌다. empty_side: +1=+x 빈 창, -1=-x 빈 창, 0=양쪽 빈 창."""
    def half_widths(r):
        # 웨이트 최근접 ≈ 4.5mm → 진자쪽 2.2mm 면 간극 ≈ 2.3mm.
        # 허브·림은 웨이트가 비키므로 양쪽 다 두껍게.
        if r < 0.038:
            u = (r - r0) / (0.038 - r0)
            w_pend = 0.0160 * (1.0 - u) + 0.0022 * u
            w_empty = 0.0180 * (1.0 - u) + 0.0280 * u
        elif r < 0.070:
            w_pend, w_empty = 0.0022, 0.0280
        else:
            u = (r - 0.070) / (r1 - 0.070)
            w_pend = 0.0022 * (1.0 - u) + 0.0120 * u
            w_empty = 0.0280 * (1.0 - u) + 0.0160 * u
        return w_pend, w_empty

    left, right = [], []
    for i in range(n):
        t = i / (n - 1)
        r = r0 + (r1 - r0) * t
        off = curve * math.sin(math.pi * t * 0.9)
        w_pend, w_empty = half_widths(r)
        if empty_side > 0:
            w_neg, w_pos = w_pend, w_empty
        elif empty_side < 0:
            w_neg, w_pos = w_empty, w_pend
        else:
            w_neg = w_pos = w_empty
        left.append((off - w_neg, r))
        right.append((off + w_pos, r))
    return left + right[::-1]


def cam_pts_hook(n=CAM_TEETH, r_out=CAM_OUT, r_root=CAM_ROOT, phase=CAM_PHASE):
    """★실사 100% 일치 원형 톱날형 래칫 휠 — 직각 스톱면이 쐐기 부리를 낚아채 정지시킴.
       한 톱날: 골(a0) → 수직 스톱면(직각 걸림턱) → 톱날 팁(r_out) → 완만한 등면 하강 → 다음 골."""
    pts = []
    step = 2.0 * math.pi / n
    for i in range(n):
        a0 = phase + i * step
        # 1. 골 바닥 입구
        pts.append((math.cos(a0) * r_root, math.sin(a0) * r_root))
        # 2. 직각 걸림 스톱면 (급상승하여 쐐기 갈고리가 정면 충돌하여 물리는 면)
        a1 = a0 + step * 0.03
        pts.append((math.cos(a1) * (r_out * 0.98), math.sin(a1) * (r_out * 0.98)))
        a2 = a0 + step * 0.06
        pts.append((math.cos(a2) * r_out, math.sin(a2) * r_out))
        # 3. 톱날 팁 정점
        a3 = a0 + step * 0.10
        pts.append((math.cos(a3) * r_out, math.sin(a3) * r_out))
        # 4. 완만한 등면 (CW 회전 시 부드럽게 흐르는 슬로프)
        a4 = a0 + step * 0.50
        r4 = r_root + (r_out - r_root) * 0.65
        pts.append((math.cos(a4) * r4, math.sin(a4) * r4))
        a5 = a0 + step * 0.85
        r5 = r_root + (r_out - r_root) * 0.20
        pts.append((math.cos(a5) * r5, math.sin(a5) * r5))
    return pts

def build_pulley():
    p = []
    C = (0, GWY)
    for fz in (-0.014, 0.014):
        p.append(add_torus(RIM_RO, 0.0055, T(C[0], C[1], fz), MAT_YELLOW, rot=AX))
    p.append(add_ring(0.098, 0.094, 0.026, T(C[0], C[1], 0), MAT_DARK, rot=AX))
    
    p.append(add_ring(Y_OUT, Y_IN, 0.016, T(C[0], C[1], 0.0195), MAT_YELLOW, rot=AX))
    p.append(add_torus(0.096, 0.0011, T(C[0], C[1], Z_WHEEL_F), MAT_DARK, rot=AX, mseg=110))
    
    # 파란 전면 밴드 + 얇은 파란 바디 링 (링을 두껍게 하면 날·진자를 가린다)
    p.append(add_ring(B_OUT, B_IN, 0.012, T(C[0], C[1], 0.019), MAT_BLUE, rot=AX))
    p.append(add_ring(0.092, 0.086, 0.024, T(C[0], C[1], 0.004), MAT_BLUE, rot=AX))

    # ── 노란 3발이 스포크 ────────────────────────────────────────────────────
    #   ★진자 2개가 스포크 사이 권역 한가운데(권역 시작점 +30°)에 오도록 SPOKE_A0 를
    #     진자 방위에서 역산한다. 두 진자가 180° 떨어져 있어 t=30° 가 유일한 해다.
    #   ★rot: Blender rotY = θ ⟺ three z 회전 -θ. 기본 스포크가 +Y(90°)를 향하므로
    #     three 방위 A 로 놓으려면 rotY = π/2 - A.
    #   ★다리 0·2 는 진자 반대 빈 창으로만 넓히고, 다리 1 은 진자가 없는 창이라 양쪽.
    #     판 두께도 14→22mm 로 올려 실사처럼 두껍게.
    spoke_empty = (1, 0, -1)
    for k in range(SPOKE_N):
        ang = SPOKE_A0 + k * 2 * math.pi / SPOKE_N
        p.append(add_plate(spoke_pts(spoke_empty[k]), 0.022, MAT_YELLOW, loc=(0, -0.004, GWY),
                           rot=(0, math.pi / 2 - ang, 0), bevel_w=0.0012, name="spoke3"))

    #   허브는 진자 피벗 볼트(r 0.030)가 관통할 자리를 비워 둬야 한다 → r 0.022
    p.append(add_cyl(0.022, 0.034, T(C[0], C[1], 0.002), MAT_YELLOW, rot=AX, verts=28))
    p.append(add_cyl(0.015, 0.010, T(C[0], C[1], 0.021), MAT_CHROME, rot=AX, verts=24))

    # 쇄기 브라켓 — 스프링 링크 러그에서 출발해 쇄기 피벗 및 좌측 스프링 앵커로 연결
    sx, sy = pend_xy(PEND_ANG_A, SPR_MX, 0.0)
    ex, ey = PAWL_PIV
    (hx, hy), (bx, by) = get_pawl_spr_anchors()
    z_rear, z_run = BRK_Z, 0.028
    hw, th = 0.0036, 0.0050
    p.append(add_cyl(0.0062, 0.0026, T(sx, sy, z_rear), MAT_STEEL, rot=AX, verts=16))
    p.append(add_cyl(0.0038, z_run - z_rear, T(sx, sy, (z_rear + z_run) / 2),
                     MAT_STEEL, rot=AX, verts=16))
    crank = [
        (sx,      sy - hw),
        (bx - hw, sy - hw),
        (bx - hw, by + hw),
        (ex + hw, ey + hw),
        (ex + hw, ey - hw),
        (bx + hw, sy + hw),
        (sx,      sy + hw),
    ]
    p.append(add_plate(crank, th, MAT_STEEL, loc=(0, -z_run, 0),
                       bevel_w=0.0008, name="pawlBrkCrank"))
    p.append(add_cyl(0.0022, BRK_Z_FRONT - z_run, T(ex, ey, (z_run + BRK_Z_FRONT) / 2),
                     MAT_CHROME, rot=AX, verts=14))
    p.append(add_cyl(0.0032, 0.0016, T(ex, ey, BRK_Z_FRONT + 0.0012), MAT_CHROME, rot=AX, verts=12))
    # 가로바 위 작은 스프링 브라켓 — 쐐기 앞쪽(PAWL_SPR_Z)과 같은 높이에 좌측 체결 귀를 만든다
    z_ear = PAWL_SPR_Z
    p.append(add_box((0.005, 0.004, 0.005), T(bx, by, z_run + 0.0025), MAT_STEEL))
    p.append(add_cyl(0.0016, z_ear - z_run, T(bx, by, (z_run + z_ear) / 2),
                     MAT_CHROME, rot=AX, verts=12))
    p.append(add_cyl(0.0026, 0.0018, T(bx, by, z_ear), MAT_CHROME, rot=AX, verts=14))

    # ── 날(라쳇) — 얇고 작게, 진자 바로 앞 면 ────────────────────────────────
    star=add_plate(cam_pts_hook(), CAM_T, MAT_CAM, loc=(0, -Z_CAM, GWY),
                       bevel_w=0.0008, name="camStar")
    join_group([star], "Ratchet", origin=T(0,GWY,0))
    return join_group(p, "Pulley", origin=T(0, GWY, 0))

# =============================================================================
#  4-4. PendA / PendB — ★동그란 원형 플라이웨이트 진자 + 상단 진자 스위치 릴리즈 탭
# =============================================================================
def build_pendulum(name, pivot_ang, release_tab=False, tie_cx=0.0, spr_cx=0.0):
    """동그란 추는 앞·뒤 판+얇은 축이 아니라 전후 관통 원통 한 덩어리다. 위·아래 진자 동일."""
    F = pivot_ang - math.pi / 2
    piv = (math.cos(pivot_ang) * PEND_PIV_R, GWY + math.sin(pivot_ang) * PEND_PIV_R)
    mc = (PEND_ARM_T, PEND_ARM_R)

    def W(cx, cy):
        return (piv[0] + cx * math.cos(F) - cy * math.sin(F),
                piv[1] + cx * math.sin(F) + cy * math.cos(F))

    dx, dy = W(mc[0], mc[1])
    p = []
    # 원통 추 — 후면(PEND_REAR)부터 전면(Z_PEND_F)까지 한 덩어리
    p.append(add_cyl(PEND_W_R, PEND_W_T, T(dx, dy, PEND_W_ZC), MAT_COPPER, rot=AX, verts=48))
    # 피벗→추 연결부도 같은 두께의 한 덩어리
    hull = [W(q[0], q[1]) for q in tangent_hull((0.0, 0.0), PEND_B_R, mc, PEND_W_R)]
    p.append(add_plate(hull, PEND_W_T, MAT_COPPER, loc=(0, -PEND_W_ZC, 0),
                       bevel_w=0.0020, name="pendMass"))
    for zf, zk in ((Z_PEND_F - 0.0005, Z_PEND_F - 0.0025),
                   (PEND_REAR + 0.0005, PEND_REAR + 0.0025)):
        p.append(add_cyl(PEND_W_R - 0.0055, 0.0025, T(dx, dy, zf), MAT_COPPER, rot=AX, verts=40))
        p.append(add_cyl(0.0046, 0.006, T(dx, dy, zk), MAT_CHROME, rot=AX, verts=20))
    # ── 과속스위치 릴리즈 탭 (PendA 전용 실사 체결 볼트 뭉치 — 실사 120651, 120647) ───────
    #   실사 구조: 진자 원통 추 외경에 탭 구멍 → 하단 육각 너트(빨간 페인트 씰) → 나사산 스터드 → 상단 정사각형 네모 머리 볼트
    if release_tab:
        ztab = Z_PEND_F - PEND_TAB_T / 2   # 0.034
        rl = math.hypot(dx, dy - GWY)
        ux, uy = dx / rl, (dy - GWY) / rl
        ang = math.atan2(uy, ux)
        rot_rad = (0, math.pi / 2 - ang, 0)  # 반경 방향(ux, uy)과 100% 수직·직각 정렬
        
        # 1. 하단 육각 너트 (Hex locknut sitting directly on flyweight cylinder rim)
        r_nut = PEND_W_R + 0.0022
        p_nut = (dx + ux * r_nut, dy + uy * r_nut)
        p.append(add_cyl(0.0068, 0.0045, T(p_nut[0], p_nut[1], ztab),
                         MAT_CHROME, rot=rot_rad, verts=6))

        # 2. 나사산 스터드 기둥 (Threaded bolt shaft protruding radially)
        r_shaft = PEND_W_R + 0.0080
        p_shaft = (dx + ux * r_shaft, dy + uy * r_shaft)
        p.append(add_cyl(0.0035, 0.012, T(p_shaft[0], p_shaft[1], ztab),
                         MAT_STEEL, rot=rot_rad, verts=16))
        # 정밀 나사산 링 4줄 연출 (Thread rings)
        for ring_off in (PEND_W_R + 0.0045, PEND_W_R + 0.0065, PEND_W_R + 0.0085, PEND_W_R + 0.0105):
            p_ring = (dx + ux * ring_off, dy + uy * ring_off)
            p.append(add_cyl(0.0039, 0.0009, T(p_ring[0], p_ring[1], ztab),
                             MAT_CHROME, rot=rot_rad, verts=16))

        # 3. 상단 정사각형 네모 머리 볼트 (Square head stopper block striking switch lever)
        r_head = PEND_W_R + 0.0145
        p_head = (dx + ux * r_head, dy + uy * r_head)
        global RELEASE_TAB_POINT
        RELEASE_TAB_POINT=(p_head[0],p_head[1],ztab)
        p.append(add_box((0.0088, 0.0088, 0.0088), T(p_head[0], p_head[1], ztab),
                         MAT_STEEL, rot=(0, -ang, 0)))
    # ── 피벗 볼트 — 휠을 관통해 뒤로 (앞: 육각 머리 / 뒤: 링크·스프링) ────────
    #   z 상한 0.042 — 캐치 레버(0.048~)와 날(0.0425~0.0465)이 피벗 원 위를 지난다.
    p.append(add_cyl(PEND_B_R * 0.82, 0.004, T(piv[0], piv[1], 0.0345),
                     MAT_STEEL, rot=AX, verts=24))
    p.append(add_cyl(0.0072, 0.005, T(piv[0], piv[1], 0.0375), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0052, PEND_W_T + 0.008, T(piv[0], piv[1], PEND_W_ZC - 0.004),
                     MAT_CHROME, rot=AX, verts=18))
    # ── ★뒷면 링크 러그 — 추는 둥근 원통만, 추 위에 덧붙인 판·탭은 없다 ────
    #   크로스바만 피벗을 가로질러 타이바·스프링 러그를 문다.
    #   링크 자체는 진자 노드가 아니라 PendTie / PendSpring 독립 노드다.
    p.append(add_cyl(PEND_B_R * 1.55, BRK_T, T(piv[0], piv[1], BRK_Z),
                     MAT_STEEL, rot=AX, verts=24))
    bar_l, bar_r = min(tie_cx, spr_cx) - 0.004, max(tie_cx, spr_cx) + 0.004
    p.append(add_plate([W(q[0], q[1]) for q in
                        tangent_hull((bar_l, 0.0), LUG_R, (bar_r, 0.0), LUG_R)],
                       BRK_T, MAT_STEEL, loc=(0, -BRK_Z, 0), bevel_w=0.0012,
                       name="pendBracketBar"))
    brk_face = BRK_Z + BRK_T / 2                     # 브라켓 앞면 (-0.024)
    #   러그 핀 — 브라켓을 뚫고 뒤로 나가 각 링크의 아이(eye)를 관통한다
    for cx, zt in ((tie_cx, TIE_Z - 0.005), (spr_cx, PSPR_Z - 0.005)):
        lp = W(cx, 0.0)
        p.append(add_cyl(LUG_PIN, brk_face - zt, T(lp[0], lp[1], (brk_face + zt) / 2),
                         MAT_CHROME, rot=AX, verts=16))
        p.append(add_cyl(0.0052, 0.0032, T(lp[0], lp[1], zt + 0.0016),
                         MAT_CHROME, rot=AX, verts=6))   # 핀 뒤끝 고정 너트
    #   피벗 뒷면 너트 — 브라켓이 피벗 볼트에 물린 것을 보여준다
    p.append(add_cyl(0.0080, 0.0035, T(piv[0], piv[1], BRK_Z - BRK_T / 2 - 0.0018),
                     MAT_CHROME, rot=AX, verts=6))
    return join_group(p, name, origin=T(piv[0], piv[1], Z_PEND - 0.008))

# =============================================================================
#  4-4b. PendTie / PendSpring — ★두 진자 뒷면 브라켓을 잇는 링크 2개
#        (진자 노드가 아니라 휠 직계 자식. env.js governor.setLinkage 가 몬다.)
# =============================================================================
def build_pend_tie():
    """강성 연동 링크(타이바) — 스프링이 아닌 쪽 링크.
       두 러그의 월드 오프셋이 같아 길이 60mm 가 고정이고 **평행이동만** 한다.
       ★원점 = 휠 중심(z 0) → env.js 는 position.x/y 만 건드리면 된다."""
    a, b = lugA(TIE_KX), lugB(-TIE_KX)
    A2, B2 = (a[0], GWY + a[1]), (b[0], GWY + b[1])
    p = [add_plate(tangent_hull(A2, LUG_R - 0.0007, B2, LUG_R - 0.0007), 0.006, MAT_STEEL,
                   loc=(0, -TIE_Z, 0), bevel_w=0.0012, name="pendTieBar")]
    for c in (A2, B2):
        p.append(add_ring(LUG_R - 0.0007, LUG_PIN + 0.0004, 0.0090,
                          T(c[0], c[1], TIE_Z), MAT_CHROME, rot=AX, verts=26))
    return join_group(p, "PendTie", origin=T(0, GWY, 0))


def build_pend_spring():
    """복귀 인장 스프링 — 스프링 쪽 링크. 아이볼트 + 조정 너트 + 코일.
       ★로컬 +X 로 곧게 눕혀 만든다. env.js 가 A 러그에 놓고(position)
         B 러그를 향해 돌린 뒤(rotation.z) scale.x 로 늘인다.
         원점 = A 러그(z 0) 라 mount() 가 대기 위치를 그대로 읽어 간다."""
    a, b = lugA(SPR_MX), lugB(SPR_NX)
    L0 = math.hypot(b[0] - a[0], b[1] - a[1])          # 60.83mm (개방 시 64.98mm, 자리 교환 후에도 동일)
    ox, oy = a[0], GWY + a[1]
    p = []
    for ex in (0.0, L0):                                # 양 끝 아이(eye)
        p.append(add_ring(0.0082, LUG_PIN + 0.0004, 0.0085,
                          T(ox + ex, oy, PSPR_Z), MAT_CHROME, rot=AX, verts=24))
    p.append(add_cyl(0.0026, L0 - 0.012, T(ox + L0 / 2, oy, PSPR_Z),
                     MAT_CHROME, rot=(0, math.pi / 2, 0), verts=14))   # 조정 나사봉
    p.append(add_helix(T(ox + 0.010, oy, PSPR_Z), MAT_CHROME, coil_r=0.0055, wire=0.0016,
                       turns=11, length=0.031, name="pendSprCoil", rot=(0, math.pi / 2, 0)))
    for hx in (0.0075, 0.0430):                         # 코일 시트 / 조정 육각 너트
        p.append(add_cyl(0.0058, 0.0040, T(ox + hx, oy, PSPR_Z),
                         MAT_CHROME, rot=(0, math.pi / 2, 0), verts=6))
    return join_group(p, "PendSpring", origin=T(ox, oy, 0))


def build_catch():
    P = CATCH_PIV
    _c, _s = math.cos(LEV_TILT), math.sin(LEV_TILT)

    def A(rx, ry):
        return (P[0] + rx * _c - ry * _s, P[1] + rx * _s + ry * _c)

    p = []
    # 레버판 — 좌단 스위치 타격 뭉치는 원본 tip 폴리곤(통짜 블록+작은 팁).
    #   ★1·2번 빨간 원: 레버 위 장식 원형 캡/리벳은 실사에 없음 → 만들지 않음.
    tip = [(LEV_L + 0.020,  0.011), (LEV_L - 0.002,  0.011), (LEV_L - 0.004,  0.002),
           (LEV_L - 0.004, -0.014), (LEV_L + 0.004, -0.016), (LEV_L + 0.020, -0.007)]
    plate = tip + [(LEV_R, -0.013), (LEV_R, 0.014)]
    p.append(add_plate([A(q[0], q[1]) for q in plate], 0.011, MAT_STEEL,
                       loc=(0, -Z_LEVER, 0), bevel_w=0.0016, name="catchPlate"))

    # ★쇄기 푸시 탭 삭제 (1637531.png 빨강) — 쇄기가 11시로 옮겨가 진자 뭉치가
    #   직접 치므로 레버에서 내려오던 이 발은 더 이상 아무 것도 누르지 않는다.

    # 피벗 원형 캡(1번)·스프링 쪽 원형 캡(2번) 완전 삭제 — 레버 표면 매끈.
    # Catch 노드 origin=CATCH_PIV 가 애니메이션 피벗이므로 메시 피벗 캡 불필요.

    # 캐치슈(떡판)를 단단히 지지하는 일체형 레그
    leg = [(0.096, 0.304), (0.124, 0.312), (0.138, 0.278),
           (0.134, 0.235), (0.114, 0.235), (0.110, 0.272)]
    p.append(add_plate(leg, 0.014, MAT_STEEL, loc=(0, -Z_LEVER, 0), bevel_w=0.0012, name="shoeLeg"))
    # 떡판 레그 연결 블록
    p.append(add_box((0.018, 0.038, 0.024), T(0.126, 0.245, 0.024), MAT_STEEL))
    shoe_h = SHOE_Y1 - SHOE_Y0
    shoe_y = (SHOE_Y0 + SHOE_Y1) / 2
    # 기계적 제동 캐치슈 (외측 스틸 백플레이트 + 내측 로프 마찰 패드)
    p.append(add_box((0.020, 0.015, shoe_h), T(SHOE_X + 0.016, shoe_y, 0.0), MAT_STEEL))
    p.append(add_box((0.006, 0.014, shoe_h - 0.004), T(SHOE_X + 0.003, shoe_y, 0.0), MAT_DARK))
    return join_group(p, "Catch", origin=T(P[0], P[1], P[2]))


def _aim_xy(ang):
    """three XY 방향 ang → 기본 +Z 헬릭스/실린더를 그 방향으로 눕히는 오일러."""
    return (0, math.pi / 2 - ang, 0)


def build_pawl():
    """★실사 100% 일치 쐐기(Catch Pawl) — 래칫 톱날의 한 톱니 홈에 정확히 물리는 갈고리형 멈춤쇠.
       대기: 톱날 위에 2mm 안전 간극으로 떠서 함께 회전.
       트립: 래퍼 rotation.z +0.60rad (Three.js). 음수는 부리를 골에서 들어 올린다."""
    p = []
    piv = PAWL_PIV
    rx, ry = piv[0], piv[1] - GWY
    ln = math.hypot(rx, ry) or 1.0
    ux, uy = rx / ln, ry / ln          # 반경 바깥
    tx, ty = -uy, ux                  # 접선 = 톱날 진행 방향 (CCW)

    def P(t, r):
        return (piv[0] + tx * t + ux * r, piv[1] + ty * t + uy * r)

    # 1. 쐐기 본체 (실사 갈고리 팁 + 든든하게 평평하게 채워진 하단 프로파일)
    #    피벗 보스 → 두툼하고 평평한 하부 바디 → 래칫 스톱면에 걸리는 뾰족한 직각 팁
    pts = [
        # 피벗 보스 후방
        P(-0.007,  0.006),
        P(-0.007, -0.008),
        # 피벗 하단 (살을 두툼하게 채움)
        P( 0.000, -0.012),
        # 하단 배면 (오목하지 않고 평평하고 든든하게 채운 라인)
        P( 0.010, -0.014),
        P( 0.019, -0.016),
        # 갈고리 부리 팁 (스톱면 골에 정확히 박히는 뾰족한 끝단)
        P( 0.026, -0.019),
        # 갈고리 스톱면 (톱날의 직각턱에 정면으로 맞닿는 수직 걸림턱)
        P( 0.027, -0.009),
        P( 0.022,  0.000),
        # 외측 등면 (부드러운 유선형 라인)
        P( 0.014,  0.007),
        P( 0.000,  0.007),
    ]
    body = add_plate(pts, PAWL_T, MAT_PAWL, loc=(0, -PAWL_Z, 0), bevel_w=0.0008, name="pawlBody")
    
    # 피벗 체결 홀 보링
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.0035, depth=PAWL_T * 1.5,
        location=T(piv[0], piv[1], PAWL_Z), rotation=AX)
    boolean_cut(body, bpy.context.active_object)
    p.append(body)

    # 피벗 보스 베어링 칼라 & 와셔
    p.append(add_cyl(0.0055, PAWL_T + 0.0016, T(piv[0], piv[1], PAWL_Z), MAT_CHROME, rot=AX, verts=24))
    p.append(add_cyl(0.0034, PAWL_T + 0.0040, T(piv[0], piv[1], PAWL_Z), MAT_STEEL, rot=AX, verts=16))

    # 2. 복귀 인장 스프링 (스틸 실사 코일) — 쐐기 앞쪽 핀 ↔ 좌측 브라켓 가로 연결
    #    ★정면(밖)에서는 래칫/캐치 레버에 가려 안 보이고, 위에서 내려다볼 때 가로로 조그맣게 걸림
    (hx, hy), (bx, by) = get_pawl_spr_anchors()
    dx, dy = bx - hx, by - hy
    spr_l = math.hypot(dx, dy)
    spr_a = math.atan2(dy, dx)
    p.append(add_helix(T(hx, hy, PAWL_SPR_Z), MAT_CHROME,
                       coil_r=0.0016, wire=0.00045, turns=6, length=spr_l,
                       name="pawlSpr", rot=_aim_xy(spr_a)))
    # 쐐기 측 체결 핀 (안쪽 두께 영역에 체결)
    p.append(add_cyl(0.0012, 0.005, T(hx, hy, PAWL_SPR_Z), MAT_STEEL, rot=AX, verts=12))

    return join_group(p, "Pawl", origin=T(piv[0], piv[1], PAWL_Z))

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
build_pendulum("PendA", PEND_ANG_A, release_tab=True, tie_cx=TIE_KX, spr_cx=SPR_MX)
build_pendulum("PendB", PEND_ANG_A + math.pi, tie_cx=-TIE_KX, spr_cx=SPR_NX)
build_pend_tie()
build_pend_spring()
build_catch()
build_pawl()
build_spring()
build_plunger()
_pp=pend_xy(PEND_ANG_A,0,0)
_dx,_dy=RELEASE_TAB_POINT[0]-_pp[0],RELEASE_TAB_POINT[1]-_pp[1]
_tx=_pp[0]+_dx*math.cos(TRIP_PENDULUM)-_dy*math.sin(TRIP_PENDULUM)
_ty=_pp[1]+_dx*math.sin(TRIP_PENDULUM)+_dy*math.cos(TRIP_PENDULUM)-GWY
SWITCH_HIT_PHASE=math.atan2(ACT_TIP[1]-GWY,ACT_TIP[0])-math.atan2(_ty,_tx)
bpy.data.objects['BaseFrame']['mechanism']={
    'pendulum':TRIP_PENDULUM,'pawl':TRIP_PAWL,'releaseArm':CATCH_RELEASE,
    'gripArm':CATCH_GRIP,'switchRot':-0.70,'toothStep':_STEP,'drag':0.12,
    'padPoint':[SHOE_X,SHOE_Y0+0.002,0.0],
    'ropeFaceX':0.100+ROPE_RADIUS_LOCAL,'switchHitPhase':SWITCH_HIT_PHASE,
    'strikePoint':list(RELEASE_TAB_POINT),'switchTip':[ACT_TIP[0],ACT_TIP[1],SW_Z],
    'strikeRadialGap':math.hypot(_tx,_ty)-math.hypot(ACT_TIP[0],ACT_TIP[1]-GWY)}

def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=False, export_apply=True, export_yup=True, export_extras=True)
    print("[overspeed_governor v5.0] 정밀 실사 내보내기 완료:", path)

export_glb(OUTPUT_PATH)
print("완료 — 오브젝트 노드 리스트:", sorted(o.name for o in bpy.data.objects))
