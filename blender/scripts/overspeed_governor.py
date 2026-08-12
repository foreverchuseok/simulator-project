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
#   "날이 너무 두꺼워 / 날이 크지 않아 / 날을 얇게 해서 이 사이에 위치해야 돼
#    얘랑 얘 바로 다음 면에 이 날이 존재한다고. 겹치지 않아, 진자랑."
#   → 날은 **작고 얇은** 라쳇이고, z 로는 **진자 바로 앞 면**(진자와 안 겹침),
#     캐치 레버·스프링보다는 **뒤**다. 즉 "진자와 스프링 사이".
CAM_OUT, CAM_ROOT = 0.056, 0.044   # ★작게 (예전 0.076/0.052 는 "너무 크다")
CAM_TEETH = 10                     # ★js/environment.js geom.toothStep = 2π/CAM_TEETH 와 짝
CAM_T     = 0.004                  # ★얇게 (예전 0.008~0.011)
# ★위상은 쇄기 부리에서 역산한다 (아래 PAWL 블록의 CAM_PHASE 재정의를 볼 것).
#   한 이빨 = 골(a0) → 완만한 등면 → 팁(a0+0.80·step) → 급경사 걸림면(a0+0.88·step)
#   → 골(a0+step). 부리는 걸림면 **다음 골** 한가운데(a0+0.94·step)에 박혀야
#   휠이 CW 로 끌릴 때 걸림면이 부리 옆면으로 밀려와 문다.
CLAW_GAP  = 0.0015                 # 대기 시 부리가 톱니끝 위에 띄우는 여유
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

# (lev_bottom_y 삭제 — 쇄기 푸시 탭이 없어져 쓰는 곳이 사라졌다)

# ── 쇄기(Pawl/Wedge) — ★11시, 진자 뭉치 옆 브래킷에 매달린다 ────────────────
#   163638.mp4 육성 지시 + 표시 스크린샷(1637531.png):
#   · 빨강 3곳 = 휠 **아래**에 있던 예전 쇄기 3종 세트 → 전부 삭제했다.
#     ① Pawl 본체(바닥 피벗 벨크랭크) ② BaseFrame 의 쇄기 귀 브래킷·핀
#     ③ Catch 레버의 쇄기 푸시 탭. "이게 왜 있는지 모르겠어 / 공중에 떠 있는 요거".
#   · 노랑 1곳 = 쇄기가 새로 달릴 자리. 표시 픽셀을 카메라 역투영해 실측한 값이
#     govBodyGrp 로컬 (-0.0779, 0.2700) = 휠중심에서 **r 0.090 / 방위 150°(11시)**.
#     "이 세기가 요기에 달려야 돼 ... 진자를 벌어지면 이 쎄기가 여기로 툭 떨어져야 되니까"
#
#   ★쇄기는 여전히 **정지부**(govBodyGrp 직계)다. 휠과 함께 도는 진자에 붙여 버리면
#     날(휠에 구워진 라쳇)과 같이 돌아 영원히 못 문다 — 멈출 수가 없다.
#     대신 피벗을 진자 뭉치(릴리즈 탭 보스, 대기 방위 128°→개방 142°) **바로 옆**
#     11시에 두어, 원심으로 벌어진 뭉치가 쇄기 트립 탭을 쳐서 떨어뜨리는 배치로 만든다.
#   ★설계 핵심(유지): 피벗–휠중심–부리가 **직각**이면 쇄기 회전이 곧 부리의 반경 변화고,
#     암이 톱니끝 안으로 파고들지 않는다(직선 PB 의 휠중심 최근접점이 곧 부리다).
PAWL_PIV  = (-0.0779, 0.2700)      # ★11시 피벗 핀 (노란 표시 실측 — r 0.090 / 150°)
PAWL_REST = CAM_OUT + CLAW_GAP     # 0.0575 대기 부리 반경 (톱니끝 위 1.5mm)
PAWL_BITE = 0.0500                 # 물림 부리 반경 (골 0.044 위 6mm)
PAWL_BOSS = 0.0105                 # 피벗 보스 반경
PAWL_HOLE = 0.0045                 # ★원형 피벗 홀 — 브래킷 핀이 관통한다
PAWL_W    = 0.0072                 # 암 반폭 — 실물 사진(163937)처럼 넓적한 판
PAWL_T    = 0.0055                 # 두께 — 날 평면에서 문다
PAWL_Z    = 0.0445                 # 쇄기 평면 중심 = 날 평면 (0.0418~0.0473)
                                   #   진자 앞면(0.041) 위 0.8mm, 날(0.0425~0.0465)을 덮고
                                   #   캐치 레버(0.048~) 아래 0.8mm 로 빠진다 (BVH 로 확인)
# ★브래킷은 캐치 레버(z 0.048~0.059) **앞**으로 뺀다. 마운트판에서 11시로 뻗으면
#   레버 띠를 반드시 가로지르는데(레버는 x -0.100 까지 온다), 같은 z 에 두면 서로
#   파고든다. 앞으로 빼면서 중앙 육각볼트(r 0.013, z 0.0615~0.0745)도 피해야 해서
#   뿌리를 마운트판 **좌상 모서리**(r 0.0255)에 둔다.
PAWL_BRK_Z = 0.0650                # 피벗 브래킷 판 중심 (0.0605~0.0695)
PAWL_BRK_A = (-0.0185, 0.2425)     # 브래킷 뿌리 = 마운트판 좌상 모서리
# 트립 탭 — 진자 뭉치(릴리즈 탭 사각머리)가 치는 면. **피벗 기준** 극좌표로 잡는다.
#   ★휠 중심 기준으로 잡으면 안 된다 — 피벗이 이미 r 0.090 이라 휠 방위를 조금만
#     돌려도 탭이 피벗 코앞(8mm)에 붙어 모멘트 암이 사라지고 스냅링과 겹친다.
#   방향 86° / 길이 0.024 는 스윕 최적값: 뭉치의 진행 방향(-0.830,-0.558)에 대해
#   토크 +0.0189 (CCW ✓), 스냅링(13mm) 회피, 휠 r 0.1028 (노란 밴드 안), 대기 간극
#   7.8mm, 스트로크 40% 부터 밀기 시작해 최종 잔여 0.9mm.
PAWL_TAB_D = math.radians(86)
PAWL_TAB_L = 0.024
PAWL_TAB_R = 0.0980
PAWL_TAB_Z = 0.0355                # 탭만 z 로 내려와 진자 층(0.027~0.041)과 겹친다

def _pawl_geo():
    """피벗–휠중심–부리 직각 구성에서 부리 방위·암 길이·물림 회전각을 역산한다."""
    d = math.hypot(PAWL_PIV[0], PAWL_PIV[1] - GWY)          # 피벗–휠중심 거리
    base = math.atan2(PAWL_PIV[1] - GWY, PAWL_PIV[0])       # 휠중심→피벗 방위
    arm = math.sqrt(d * d - PAWL_REST ** 2)                 # 피벗→부리 암 길이
    a_rest = base + math.acos(PAWL_REST / d)                # 부리 방위 (CCW 해)
    psi0 = math.acos(arm / d)                               # 피벗에서 본 대기 사잇각
    psi1 = math.acos((d * d + arm * arm - PAWL_BITE ** 2) / (2 * d * arm))
    return a_rest, arm, psi0 - psi1                         # 물림각(CCW, +z)

PAWL_A, PAWL_ARM, PAWL_ROT = _pawl_geo()   # 200.29° / 0.0692 / +0.1086 rad
# ★js/environment.js pose.trip.pawl 은 PAWL_ROT 와 같은 값이어야 한다.

# 톱날 위상 — 부리가 걸림면 다음 **골 한가운데**(a0 + 0.94·step)에 오도록 역산.
_STEP = 2.0 * math.pi / CAM_TEETH
CAM_PHASE = (PAWL_A - 0.94 * _STEP) % _STEP     # ≈ 24.2°

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
#   ② 노란 스포크 → SPOKE_BIAS 보정 후 전 스트로크 최소거리 0.0160 (여유 4.0mm)
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
TIE_KX  = -0.027     # 타이바 러그 — A 캐노니컬 x (B 는 -TIE_KX)
SPR_MX  =  0.032     # 인장 스프링 러그 — A 캐노니컬 x
SPR_NX  = -0.022     # 인장 스프링 러그 — B 캐노니컬 x
LUG_R   =  0.0095    # 브라켓 러그 보스 반경
LUG_PIN =  0.0034    # 러그 핀 반경
BRK_T   =  0.0065    # 뒷면 브라켓 판 두께

_FC = PEND_ANG_A - math.pi / 2                 # 캐노니컬 프레임 각
E1  = (math.cos(_FC), math.sin(_FC))           # 캐노니컬 +x(접선)의 월드 방향
OW  = (PEND_PIV_R * math.cos(PEND_ANG_A),
       PEND_PIV_R * math.sin(PEND_ANG_A))      # A 피벗 (휠 중심 기준)

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

    # ── ★쇄기 피벗 브래킷 + 샤프트 핀 — 11시(진자 뭉치 옆)로 옮겼다 ───────────
    #   예전엔 마운트판에서 **좌하**로 내린 귀였고, 그 귀·핀·쇄기·레버 푸시 탭이
    #   화면에서 "공중에 떠 있는 3종 세트"로 보였다(1637531.png 빨강 3곳) → 삭제.
    #   이제 마운트판에서 **좌상 11시**로 뻗은 넓은 귀가 쇄기를 확실히 물고 있다.
    #   판은 날(0.0425~0.0465)·쇄기(0.042~0.048)보다 앞(z 0.049~0.058)이라 안 닿는다.
    #   ★귀 끝단은 쇄기 보스(0.0105)보다 **좁게**(0.0080) 한다 — 브래킷이 쇄기보다
    #     앞(z 0.0605~)이라 넓으면 정면에서 쇄기 피벗을 통째로 가린다.
    p.append(add_plate(tangent_hull(PAWL_BRK_A, 0.0100, PAWL_PIV, 0.0080), 0.009,
                       MAT_GREY, loc=(0, -PAWL_BRK_Z, 0), bevel_w=0.0010,
                       name="pawlBracket"))
    #   뿌리 라이저 — 마운트판 앞면(0.0575)에서 브래킷 뒷면(0.0605)까지 세운 발
    p.append(add_cyl(0.0090, 0.0060, T(PAWL_BRK_A[0], PAWL_BRK_A[1], 0.0590),
                     MAT_GREY, rot=AX, verts=20))
    #   핀 — 브래킷 앞면(0.0695)에서 쇄기 뒤(0.0405)까지 관통한다
    p.append(add_cyl(PAWL_HOLE - 0.0004, 0.0290, T(PAWL_PIV[0], PAWL_PIV[1], 0.0550),
                     MAT_CHROME, rot=AX, verts=18))
    p.append(add_cyl(0.0072, 0.0040, T(PAWL_PIV[0], PAWL_PIV[1], 0.0395),
                     MAT_CHROME, rot=AX, verts=16))   # 핀 뒤끝 스냅 링

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
def build_pendulum(name, pivot_ang, release_tab=False, tie_cx=0.0, spr_cx=0.0):
    """동그란 플라이웨이트 진자.
       ★"진자는 여기에 들어가 있으면서 앞뒤로 잡으러 튀어나와 있어야 되고" —
         웨이트는 후면 브라켓 층(PEND_REAR)에서 시작해 노란 스포크 사이 개구부를
         z 로 관통하고 휠 앞(Z_PEND_F)까지 뻗는 두꺼운 고체 추다(두께 PEND_W_T=65mm).
         그래서 정면·후면·사선 어디서 봐도 추가 휠을 뚫고 지나가는 게 보인다.
       ★단 휠 웨브 구간(PEND_WEB_R~PEND_WEB_F)만 PEND_THRU_R 로 좁힌다 —
         파란 바디 링(내경 0.076)이 개방 자세 원판 외경(0.0817)과 겹치기 때문이다.
       ★암과 원판을 한 덩어리 hull 로 만들면 "오이 모양"이 된다. 원판은 독립 실루엣,
         암은 확실히 더 가는 별도 바로 뒤층에 깐다."""
    F = pivot_ang - math.pi / 2
    piv = (math.cos(pivot_ang) * PEND_PIV_R, GWY + math.sin(pivot_ang) * PEND_PIV_R)
    mc = (PEND_ARM_T, PEND_ARM_R)          # 캐노니컬 웨이트 중심 (접선, 반경)

    def W(cx, cy):
        return (piv[0] + cx * math.cos(F) - cy * math.sin(F),
                piv[1] + cx * math.sin(F) + cy * math.cos(F))

    zc  = (PEND_WEB_F + Z_PEND_F) / 2      # 전면 원판 평면 중심 (0.0335)
    zrc = (PEND_REAR + PEND_WEB_R) / 2     # 후면 원판 평면 중심 (-0.017)
    znc = (PEND_WEB_R + PEND_WEB_F) / 2    # 웨브 관통 목 중심 (0.008)
    dx, dy = W(mc[0], mc[1])
    p = []
    # 암 — 원판보다 확실히 가는 바 (뒤층)
    aw = PEND_B_R * 0.62
    arm = tangent_hull((0.0, 0.0), PEND_B_R, mc, aw)
    p.append(add_plate([W(q[0], q[1]) for q in arm], 0.008, MAT_GREY,
                       loc=(0, -(zc - 0.003), 0), bevel_w=0.0012, name="pendArm"))
    # 동그란 웨이트 — 전면 원판 / 웨브 관통 목 / 후면 원판이 한 덩어리 고체 추
    disc = [(dx + PEND_W_R * math.cos(2 * math.pi * k / 48),
             dy + PEND_W_R * math.sin(2 * math.pi * k / 48)) for k in range(48)]
    p.append(add_plate(disc, Z_PEND_F - PEND_WEB_F, MAT_STEEL, loc=(0, -zc, 0),
                       bevel_w=0.0022, name="pendMass"))
    p.append(add_cyl(PEND_THRU_R, PEND_WEB_F - PEND_WEB_R, T(dx, dy, znc),
                     MAT_STEEL, rot=AX, verts=36))
    p.append(add_plate(disc, PEND_WEB_R - PEND_REAR, MAT_STEEL, loc=(0, -zrc, 0),
                       bevel_w=0.0022, name="pendMassRear"))
    # 앞·뒤 챔퍼 림 + 중심 캡 — 양쪽에서 똑같이 두툼한 추로 보이게 대칭 배치
    for zf, zk in ((Z_PEND_F - 0.0005, Z_PEND_F - 0.0025),
                   (PEND_REAR + 0.0005, PEND_REAR + 0.0025)):
        p.append(add_cyl(PEND_W_R - 0.0055, 0.0025, T(dx, dy, zf), MAT_STEEL, rot=AX, verts=40))
        p.append(add_cyl(0.0046, 0.006, T(dx, dy, zk), MAT_CHROME, rot=AX, verts=20))
    # ── 과속스위치 릴리즈 탭 (PendA 전용 실사 체결 볼트 조합) ─────────────────
    #   실사 구조: 진자 원통 추 외경에 탭 구멍 → 하단 육각 너트 → 나사산 스터드 → 상단 정사각형 네모 머리 볼트
    if release_tab:
        ztab = Z_PEND_F - PEND_TAB_T / 2   # 0.034
        rl = math.hypot(dx, dy - GWY)
        ux, uy = dx / rl, (dy - GWY) / rl
        ang = math.atan2(uy, ux)
        rot_rad = (0, math.pi / 2 - ang, 0)  # 반경 방향(ux, uy)과 100% 수직·직각 정렬
        
        # 1. 하단 육각 너트 (Hex locknut sitting directly on flyweight cylinder rim)
        r_nut = PEND_W_R + 0.0022
        p_nut = (dx + ux * r_nut, dy + uy * r_nut)
        p.append(add_cyl(0.0065, 0.0045, T(p_nut[0], p_nut[1], ztab),
                         MAT_CHROME, rot=rot_rad, verts=6))

        # 2. 나사산 스터드 기둥 (Threaded bolt shaft protruding radially)
        r_shaft = PEND_W_R + 0.0075
        p_shaft = (dx + ux * r_shaft, dy + uy * r_shaft)
        p.append(add_cyl(0.0035, 0.010, T(p_shaft[0], p_shaft[1], ztab),
                         MAT_STEEL, rot=rot_rad, verts=16))
        # 나사산 링 연출 (Thread rings)
        for ring_off in (0.0055, 0.0085):
            p_ring = (dx + ux * ring_off, dy + uy * ring_off)
            p.append(add_cyl(0.0039, 0.0012, T(p_ring[0], p_ring[1], ztab),
                             MAT_CHROME, rot=rot_rad, verts=16))

        # 3. 상단 정사각형 네모 머리 볼트 (Square head bolt striking switch lever)
        r_head = PEND_W_R + 0.0135
        p_head = (dx + ux * r_head, dy + uy * r_head)
        p.append(add_box((0.0090, 0.0090, 0.0090), T(p_head[0], p_head[1], ztab),
                         MAT_STEEL, rot=(0, -ang, 0)))
    # ── 피벗 볼트 — 휠을 관통해 뒤로 (앞: 육각 머리 / 뒤: 링크·스프링) ────────
    #   z 상한 0.042 — 캐치 레버(0.048~)와 날(0.0425~0.0465)이 피벗 원 위를 지난다.
    p.append(add_cyl(PEND_B_R * 0.82, 0.004, T(piv[0], piv[1], 0.0345),
                     MAT_STEEL, rot=AX, verts=24))
    p.append(add_cyl(0.0072, 0.005, T(piv[0], piv[1], 0.0375), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0052, PEND_W_T + 0.008, T(piv[0], piv[1], PEND_W_ZC - 0.004),
                     MAT_CHROME, rot=AX, verts=18))
    # ── ★뒷면 넓은 브라켓 + 링크 러그 2개 ──────────────────────────────────
    #   "뒤쪽에서 이렇게 보면 요렇게 동그라미가 더 넓게 브라켓이 이렇게 있고,
    #    이쪽도 당연히 브라켓이 있으면 두 개가 링크가 돼 있어야 되겠지"
    #   ① 넓은 판 — 관통 추 뒤를 덮는 부채꼴 (추 지름보다 15% 넓다)
    #   ② 크로스바 — 피벗을 가로질러 두 러그(타이바·스프링)를 물고 있는 접선 바
    #   링크 자체는 진자 노드가 아니라 PendTie / PendSpring 독립 노드다.
    #   진자에 구우면 상대 진자를 따라갈 수 없어(최대 27mm 어긋남) 링크가 성립 안 한다.
    p.append(add_plate([W(q[0], q[1]) for q in
                        tangent_hull((0.0, 0.0), PEND_B_R * 1.5, mc, PEND_W_R * 1.15)],
                       BRK_T, MAT_STEEL, loc=(0, -BRK_Z, 0), bevel_w=0.0012,
                       name="pendBracket"))
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
    L0 = math.hypot(b[0] - a[0], b[1] - a[1])          # 60.83mm (개방 시 64.98mm)
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


# =============================================================================
#  4-5. Catch — 폴리시드 캐치 레버 + 떡판(캐치슈) 레그
# =============================================================================
def claw_pts():
    """쇄기 부리(Beak) 윤곽 (govBodyGrp 좌표) — 톱날 골에 박히는 쐐기.
       ★걸림면과 1:1 로 물려야 한다. 한 이빨의 걸림면은 팁(a3, r CAM_OUT)에서
         a4(=a3+0.08·step, r CAM_ROOT+0.002)까지 떨어지는 급경사면이라, 순수 반경에서
         atan(step·0.08·r / (CAM_OUT-CAM_ROOT-0.002)) 만큼 기울어 있다.
         부리의 CW 쪽(걸림) 옆면을 **같은 기울기**로 깎아야 면끼리 맞닿는다."""
    step = 2.0 * math.pi / CAM_TEETH
    # 걸림면 기울기 — 반경선 기준. 부리 방위에서 걸림면은 CW(방위 감소) 쪽에 있다.
    lock_tilt = math.atan2(step * 0.08 * CAM_OUT, (CAM_OUT - CAM_ROOT) - 0.002)
    # ★부리 폭은 골 입구보다 좁아야 앉는다. 물림 반경(0.050)에서 걸림면은 방위
    #   270.8° 까지 물러나 있으므로 부리 CW 모서리를 271.5° 에 두면 0.7° 여유로
    #   앉고, 이어지는 끌림(pose.ratchet)이 걸림면을 부리 옆면으로 밀어 문다.
    half = math.radians(2.6)          # 부리 폭(방위) 절반 — 물림 반경에서 4.5mm
    ro, ri = PAWL_REST + 0.013, PAWL_REST   # 뿌리(암 쪽) / 부리 끝

    def P(a, r):
        return (math.cos(a) * r, GWY + math.sin(a) * r)

    # CW 쪽 옆면을 걸림면과 평행하게: 끝점에서 반경이 커질수록 방위를 lock_tilt 만큼 연다.
    d_lock = math.atan2(math.tan(lock_tilt) * (ro - ri), ri)
    return [P(PAWL_A - half, ri), P(PAWL_A + half, ri),
            P(PAWL_A + half + math.radians(2.0), ro),
            P(PAWL_A - half - d_lock, ro)]


def build_pawl():
    """쇄기(Pawl/Wedge) — 11시 브래킷 핀에 매달린 판. 원점=피벗 핀 = 애니메이션 회전축.
       ★실물 사진(163937.png): 한쪽 끝에 원형 피벗 홀, 반대쪽은 톱날 골을 향해
         사선으로 좁아지는 넓적한 방패꼴 판이다. 그래서 암을 넓게(PAWL_W) 잡고
         부리 쪽으로 테이퍼를 준다.
       원심으로 벌어진 진자 뭉치가 트립 탭을 치면 CCW(+PAWL_ROT)로 돌아
       부리가 r 0.0575 → 0.0500 으로 떨어져 톱날 골에 박힌다."""
    p = []
    # ★암 끝은 부리 뿌리보다 조금 바깥에 둔다 — 물림으로 암이 안쪽으로 스윙할 때
    #   안쪽 모서리가 톱니끝(0.056) 밑으로 내려가면 톱니 등을 긁는다.
    beak_base = (math.cos(PAWL_A) * (PAWL_REST + 0.014),
                 GWY + math.sin(PAWL_A) * (PAWL_REST + 0.014))
    # 피벗 보스 → 부리로 좁아지는 방패꼴 본체 (실물처럼 넓적하게)
    tabc = (PAWL_PIV[0] + PAWL_TAB_L * math.cos(PAWL_TAB_D),
            PAWL_PIV[1] + PAWL_TAB_L * math.sin(PAWL_TAB_D))
    #   ★본체와 트립 암을 **먼저 합친 뒤** 피벗 홀을 뚫는다. 트립 암을 따로 두고
    #     본체만 뚫으면 암이 핀 자리를 막아 핀이 통짜 살을 관통한다(BVH 56면).
    body = join_group([
        add_plate(tangent_hull(PAWL_PIV, PAWL_BOSS + 0.0035, beak_base, PAWL_W), PAWL_T,
                  MAT_CAM, loc=(0, -PAWL_Z, 0), bevel_w=0.0010, name="pawlBody"),
        add_plate(tangent_hull(PAWL_PIV, PAWL_BOSS - 0.0015, tabc, 0.0060), PAWL_T,
                  MAT_CAM, loc=(0, -PAWL_Z, 0), bevel_w=0.0008, name="pawlTripArm")
    ], "pawlBody")
    # ★원형 피벗 홀 — 브래킷 핀이 실제로 관통한다
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=PAWL_HOLE, depth=0.040,
                                        location=T(PAWL_PIV[0], PAWL_PIV[1], PAWL_Z), rotation=AX)
    boolean_cut(body, bpy.context.active_object)
    p.append(body)
    p.append(add_plate(claw_pts(), PAWL_T, MAT_CAM,
                       loc=(0, -PAWL_Z, 0), bevel_w=0.0008, name="pawlClaw"))
    #   보스 보강 링 — ★판 두께 안에 넣는다. 앞으로 튀어나오면 캐치 레버(0.048~)를 뚫는다.
    p.append(add_ring(PAWL_BOSS, PAWL_HOLE + 0.0008, PAWL_T - 0.0008,
                      T(PAWL_PIV[0], PAWL_PIV[1], PAWL_Z), MAT_CHROME, rot=AX, verts=28))
    # ── 트립 탭 보스 — 진자 뭉치(릴리즈 탭 사각머리)가 치는 면 ────────────────
    #   ★탭만 z 로 진자 층(0.027~0.041)까지 내려와야 실제로 맞는다 —
    #     쇄기 판(0.0418~0.0473)은 진자 앞면(0.041)보다 앞이라 그대로는 안 닿는다.
    p.append(add_cyl(0.0058, PAWL_Z + PAWL_T / 2 - (PAWL_TAB_Z - 0.006),
                     T(tabc[0], tabc[1],
                       ((PAWL_Z + PAWL_T / 2) + (PAWL_TAB_Z - 0.006)) / 2),
                     MAT_STEEL, rot=AX, verts=20, smooth=False))   # 진자 층까지 내려온 타격 보스
    return join_group(p, "Pawl", origin=T(PAWL_PIV[0], PAWL_PIV[1], PAWL_Z))


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
    p.append(add_cyl(0.015, 0.009, T(SPR_BASE[0], SPR_BASE[1] - 0.003, SPR_BASE[2]), MAT_GREY, rot=(0, SPR_TILT, 0), verts=20))

    leg = [(0.094, 0.300), (0.122, 0.312), (0.137, 0.268),
           (0.134, 0.230), (0.114, 0.226), (0.110, 0.266)]
    p.append(add_plate(leg, 0.014, MAT_STEEL, loc=(0, -Z_LEVER, 0), bevel_w=0.0012, name="shoeLeg"))
    # 떡판 레그 위 장식 구(가짜 리벳) 삭제 — 실사 매끈면
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
build_pendulum("PendA", PEND_ANG_A, release_tab=True, tie_cx=TIE_KX, spr_cx=SPR_MX)
build_pendulum("PendB", PEND_ANG_A + math.pi, tie_cx=-TIE_KX, spr_cx=SPR_NX)
build_pend_tie()
build_pend_spring()
build_catch()
build_pawl()
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
