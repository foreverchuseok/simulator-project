# -*- coding: utf-8 -*-
# =============================================================================
#  승강기 과속조절기 (Overspeed Governor) — Blender bpy 실사 모델링 v3.4
# -----------------------------------------------------------------------------
#  [v3.4 · 2026-08-01 16:10 육성 지시 — "레버·떡판·스프링이 한 직선(일자)"]
#   화면녹화 161010.mp4 + device_china.mp4 29초 CG 정지컷 대조. 지시 3가지:
#   ① "스프링을 눕혀라" — 레버는 수평인데 스프링만 52° 치솟아 있어 "말이 안 된다".
#      → LEV_TILT(17°) 로 레버를 눕히고 SPR_TILT = 90°-LEV_TILT 로 스프링이
#        레버 축선을 그대로 이어받게 했다. 둘이 한 직선이 된다.
#   ② "떡판(캐치슈)이 없다" — v3.3 이 "CAD에 없다"며 지운 그 부품이다.
#      실제로는 레버 우단에서 시브 오른쪽을 따라 내려오는 한 덩어리 레그이고,
#      그 끝(슈)이 로프를 홈에 눌러 잡아 로프를 멈춘다. → build_catch 에 복원.
#   ③ "스위치 치는 좌측 팔이 엄청 길다" — 좌단을 -0.118 → LEV_L(-0.105),
#      스위치 바로 위에서 끝낸다. 레버가 눕은 만큼 스위치도 같이 내려온다.
#
#   ★트립은 2단계다 (elevator.js governorTrip):
#     1단계 낙하  arm +0.12 → 좌단이 내려가 플런저를 치고 발톱이 캠 이빨에 물림
#     2단계 파지  arm -0.05 → 물린 발톱을 휠이 끌고 가며 레버를 반대로 돌려
#                 우측 떡판이 로프를 홈에 눌러 파지 → 로프·휠 정지
#     그래서 떡판은 피벗 아래·우측(dx>0, dy<0)에 있어야 CW 회전에서 안으로 물린다.
# -----------------------------------------------------------------------------
#  [v3.3 · 2026-08-01 — CAD 렌더 비교 기반 전면 비율 재작업]
#   render_governor.py 로 Blender 헤드리스 렌더 → CAD 캡처와 눈 비교 후 수정.
#   · 베이스 축소: 폭 0.48→0.34 (CAD: 베이스 ≈ 휠 지름 ×1.4, 휠이 화면 주인공)
#   · 유리 커버: 전면 대형 판 → 휠 하반부만 감싸는 낮은 U가드 (0.27×0.10)
#   · 휠 림: 플랜지·전면 밴드 전부 노랑 = 한 덩어리 굵은 노란 테두리 (동심원 3개 금지)
#   · 캐치: 얇은 일자 가로암 + 좌단 ㄱ자 훅. 우측 하강 레그·슈 제거 (CAD에 없음)
#     ↑ ★이게 오독이었다. 사용자가 15:25 에 말한 "일자 링크"는 레버·슈·스프링이
#       한 직선이라는 뜻이었는데 슈를 지워 버렸다 → v3.4 에서 떡판으로 복원.
#   · SPR_TILT 0.66 으로 통일 (이전 1.03 은 env SPRING_TILT -0.66 과 불일치 — 앵커 어긋남)
#   · 우측 지주를 베이스 우단(x 0.145) 위로 내리고 앵커 팔로 스프링 축선 연결
#   · 스위치 커버(일체형)는 휠 좌측 (SW_X, SW_Y), 플런저가 상단에서 위로 —
#     트립 시 캐치 좌단(y≈0.255)이 하강하며 플런저 팁(0.253)을 누른다.
#   · 과속스위치 본체 = 금색(아연도금) 금속 박스 + SW_TILT(15°) 기울임.
#     ↑ ★파란색 오독 수정: 실사에서 길게 올라온 파란 것은 조속기 보호덮개와
#       스위치를 무는 브래킷이지 스위치 본체가 아니다. 파란(반투명 MAT_GLASS)은
#       Cover / swShell 쪽에만 두고, 본체 박스는 MAT_GOLD 로 칠한다.
# -----------------------------------------------------------------------------
#  참조 = 사용자 지정 스크린샷 「스크린샷 2026-07-21 003217.png」
#         (= device_china.mp4 30초 부근 CG 정지컷) + 육성 지시 4편.
#
#  [육성 지시 반영]
#   11:24 · 캐치 좌단이 "너무 길다" → 좌단을 x -0.095 에서 끝냄.
#         · 과속스위치는 롤러 브래킷 없이 좌단이 플런저를 직접 툭 침.
#           (당시 "수직(90°)" 지시는 이후 실사 대조로 철회 — SW_TILT 로 눕힌다)
#   11:41 · 진자 개방 → 캐치 낙하 → 날 물림 → 로프 파지 → 카 안전기.
#   13:06 · "뒤판 없애라", "동그란 장식 없애라", "이 디자인 그대로".
#   15:25 · 캐치 레버·슈·스프링은 일자 링크 / 스위치·파란커버는 하나로 합쳐 축소
#         · 진자·쇄기·스위치 타격은 동시 (elevator.js governorTrip).
#
#  ★치수는 스크린샷 픽셀 실측으로 잡았다 (원본 1573x971, 휠 중심 (857,480) px,
#    노란 링 외경 426px). 로프 홈 반경만 0.100 으로 고정(월드 0.15 정렬 불변 조건)하고
#    나머지를 그 비율(4100 px/local-unit)로 환산했다. 주요 실측값:
#      마운트판  x -0.018..0.018, y 0.194..0.235      육각너트 상 (0.001,0.219) r0.0123
#      하단 육각 (0.000,0.180) r0.0113                작은 십자나사 (0.012,0.199)
#      캐치 피벗 (0.000,0.260) 디스크 r0.013          캐치 좌단 x -0.095
#      쐐기(발톱) 끝 (-0.087,0.242)  → 휠중심 기준 r 0.0887 (대기, 날 위에 떠 있음)
#      진자 돔1 (-0.053,0.281) r0.021 / 돔2 (0.036,0.177) r0.017
#      우측 레그 핀 (0.109,0.257)                     스프링 시트 (0.117,0.305)
#      스프링 축 = 수직에서 +x 로 약 59°              오각 커버 x -0.202..-0.103
#
#  [육성 지시 반영]
#   11:24 · 캐치 좌단이 "너무 길다" → 좌단을 x -0.095 에서 끝냄(실측치).
#         · 과속스위치는 롤러 브래킷 없이 좌단이 플런저를 직접 툭 침.
#           (당시 "수직(90°)" 지시는 이후 실사 대조로 철회 — SW_TILT 로 눕힌다)
#   11:41 · 진자 개방 → 캐치 낙하 → 날 물림 → 로프 파지 → 카 안전기.
#   13:06 · "뒤판 없애라", "동그란 장식 없애라", "이 디자인 그대로", 스위치는 스위치 커버에.
#
#  [아키텍처 — 이중 소스 축척 불일치 재발 방지]
#   · 이 .glb 가 조속기의 유일한 시각 소스. js/environment.js §7 은 프리미티브를
#     만들지 않고 빈 래퍼 그룹(피벗)에 .glb 노드를 끼운다 (로더 스케일 1.0, 오프셋 0).
#   · three (x, y, z) = Blender (x, -z, y)  ← T() 헬퍼
#   · 가동부는 개별 오브젝트, 원점(origin)을 피벗에 두고 대기 자세를 구움 → 래퍼 rot 0 = 대기.
#       Pulley  원점 (0, 0.225, 0)      휠 스핀 (rotation.z)
#       PendA/B 원점 = 진자 피벗 볼트    원심 개방 (rotation.z +0.45)
#       Catch   원점 = 레버 피벗 핀      트립 ①낙하 +0.12 → ②파지 -0.05 (떡판 일체)
#       Spring  원점 = 하단 시트, ★수직으로 구움 — env 래퍼가 -SPR_TILT 만큼 눕힌다
#       Plunger 원점 = 하단, 수직으로 구움 — env 마운트(-90°)가 눌림축(-Y) 변환
#   · 로프는 굽지 않는다 (environment.js 가 전 구간 런타임 메시로 그림).
#
#  실행(헤드리스, 30초 내외):
#    & 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender\scripts\overspeed_governor.py
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
#  1. 재질
#     ★씬 조명이 세다(Hemi 2.0 + Sun 2.5 + ACES exposure 1.2). 참조 스크린샷의
#       진한 감청색을 화면에서 얻으려면 베이스 컬러를 평소보다 훨씬 어둡게 잡아야 한다.
#       이전 리비전이 "하늘색 플라스틱"으로 보인 원인이 이것이다.
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
    
    # Clearcoat / Coat support across Blender versions
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

# device_china.mp4 정지컷 기반 고품질 실사 CG 재질 정의
MAT_BLUE    = make_material("Gov_Blue",     (0.015, 0.055, 0.220), metallic=0.15, roughness=0.32, coat=0.30)  # 로얄 메탈릭 파우더 블루
MAT_BLUE_DK = make_material("Gov_BlueDk",   (0.008, 0.032, 0.140), metallic=0.15, roughness=0.35, coat=0.25)
MAT_SPOKE   = make_material("Gov_Spoke",    (0.020, 0.075, 0.270), metallic=0.18, roughness=0.30)  # 휠 스포크 디럭스 블루
MAT_YELLOW  = make_material("Gov_Yellow",   (0.920, 0.600, 0.015), metallic=0.12, roughness=0.24, coat=0.20)  # 광택 안전 옐로우 도장
MAT_STEEL   = make_material("Gov_Steel",    (0.760, 0.780, 0.820), metallic=0.98, roughness=0.14)  # 헤어라인 폴리시드 스테인리스
MAT_CHROME  = make_material("Gov_Chrome",   (0.850, 0.865, 0.890), metallic=1.00, roughness=0.03)  # 거울 크롬
MAT_GREY    = make_material("Gov_Grey",     (0.350, 0.375, 0.410), metallic=0.75, roughness=0.25)  # 아노다이징 알루미늄
MAT_CAM     = make_material("Gov_Cam",      (0.080, 0.095, 0.125), metallic=0.60, roughness=0.35)  # 날(캠)·스위치 케이스
MAT_DARK    = make_material("Gov_Dark",     (0.040, 0.045, 0.055), metallic=0.50, roughness=0.45)  # 너트 코어·돔 링
MAT_DOME    = make_material("Gov_Dome",     (0.880, 0.895, 0.920), metallic=1.00, roughness=0.05)  # 진자 고광택 크롬 돔
MAT_GLASS   = make_material("Gov_Glass",    (0.080, 0.220, 0.580), metallic=0.02, roughness=0.05, alpha=0.32) # 반투명 파란 유리가드
MAT_LABEL   = make_material("Gov_Label",    (0.700, 0.725, 0.750), metallic=0.00, roughness=0.40)
MAT_YCAP    = make_material("Gov_YCap",     (0.520, 0.420, 0.060), metallic=0.35, roughness=0.30)
MAT_GOLD    = make_material("Gov_Gold",     (0.520, 0.400, 0.115), metallic=0.95, roughness=0.22, coat=0.15) # ★과속스위치 본체 — 아연도금(황동빛) 금속

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
    """dims 는 Blender 축 (x, 깊이=z_three, 높이=y_three)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    bpy.context.active_object.scale = dims
    return _finish(mat, smooth=False)

def add_cyl(radius, depth, loc, mat, rot=(0, 0, 0), verts=32, smooth=False):
    """★기본 평면 셰이딩 — shade_smooth 는 짧은 실린더 캡 노멀을 뭉개 '구슬'로 만든다."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth,
                                        location=loc, rotation=rot)
    return _finish(mat, smooth)

def add_torus(major, minor, loc, mat, rot=(0, 0, 0), mseg=72, nseg=14):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=mseg, minor_segments=nseg,
                                     location=loc, rotation=rot)
    return _finish(mat, smooth=True)

def add_sphere(radius, loc, mat, squash_z=1.0):
    """squash_z: three-z 방향(=Blender Y) 납작 비율 — 진자 돔용."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=30, ring_count=18)
    if squash_z != 1.0:
        bpy.context.active_object.scale = (1.0, squash_z, 1.0)
    return _finish(mat, smooth=True)

def add_ring(r_out, r_in, depth, loc, mat, rot=(0, 0, 0), verts=96):
    """납작 링(밴드) — 실린더 불리언 차집합."""
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
    """three x-y 평면 2D 윤곽(pts) → z_three 두께(depth) 압출.
       loc 은 Blender 좌표 — z_three 위치는 loc[1] = -z_three."""
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
    """수직(+Z_b = three +Y) 코일. ★반드시 수직으로 굽는다 — env 래퍼가 기울인다."""
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
G_R    = 0.100     # ★로프 홈 반경 (×govGrp 1.5 = 월드 0.15) — 불변
RIM_RO = 0.108     # 홈 플랜지 중심 반경
Y_OUT, Y_IN = 0.104, 0.082      # 노란 전면 밴드
CAM_OUT, CAM_ROOT = 0.078, 0.050  # 날(캠) 톱니
AX = (math.pi / 2, 0, 0)        # 실린더/토러스 축을 three-z(휠 축)로

CATCH_PIV = (0.000, 0.268, 0.048)   # 캐치 피벗 (휠 축 위) — 레버를 눕히느라 6mm 올림
LEV_TILT  = math.radians(17)        # ★레버 기울기(우측 상향) — 레버·떡판·스프링이 한 직선
LEV_L, LEV_R = -0.105, 0.118        # 레버 좌단(스위치 바로 위)·우단(스프링 시트)
SPR_TILT  = math.pi / 2 - LEV_TILT  # 1.2740 — 스프링이 레버 축선을 그대로 이어받는다
SPR_BASE  = (CATCH_PIV[0] + 0.112 * math.cos(LEV_TILT),   # (0.1071, 0.3008)
             CATCH_PIV[1] + 0.112 * math.sin(LEV_TILT), 0.048)
SPR_REACH = 0.114                   # 스프링 하단 시트 → 끝단 볼(=고정 앵커) 거리
SHOE_X    = 0.108                   # 떡판 작동면(안쪽) — 로프 표면(0.106) 앞 2mm
                                    #   파지 시 레버가 -0.05rad 돌면 4.2mm 파고들어 로프를 문다
SHOE_Y0, SHOE_Y1 = 0.146, 0.222     # 떡판이 로프를 훑는 구간 (시브 3시 접점 → 아래)
# ── 과속스위치 ────────────────────────────────────────────────────────────
#   · 실사: 스위치 본체는 금색(아연도금) 금속 박스이고, 베이스에 대해 비스듬히
#     눕는다. 길게 올라온 파란색은 스위치를 무는 브래킷/보호덮개(= 이 모델의
#     MAT_GLASS 반투명 파란 커버·swShell)이지 스위치 본체가 아니다.
#   · 본체 박스 / 액추에이터(회색 탭) 길이는 build_plunger 에서 ×2.2 연장
BASE_L    = -0.175
SW_X, SW_Y, SW_Z = -0.139, 0.220, 0.050   # ★캐치 쪽으로 7mm 당김 — 액추에이터 암을 실사처럼
                                          #   짧게(17mm) 만들기 위한 최소 이동. 더 당기면 박스
                                          #   우측면이 캐치 좌단(x -0.1075)과 부딪친다.
SW_W, SW_H, SW_D = 0.032, 0.106, 0.028    # 금색 본체
SW_TILT   = math.radians(15)              # ★기울기 — 상단이 휠 쪽(+x)으로 눕는다 (실사)
Z_HIT     = 0.062
# 액추에이터(ACT_*)는 SWP() 정의 뒤에서 잡는다 — 뿌리를 기울인 박스면에 붙이기 때문.
PEND_PIV_R = 0.030
PEND_ANG_A = math.radians(134)
PEND_MASS  = 0.070

def LEVP(rx, ry):
    """캐치 레버 로컬(수평 기준, 원점=피벗) → govBodyGrp 로컬. 기울기 LEV_TILT 적용."""
    c, s = math.cos(LEV_TILT), math.sin(LEV_TILT)
    return (CATCH_PIV[0] + rx * c - ry * s, CATCH_PIV[1] + rx * s + ry * c)


# 과속스위치 기울기 — 박스 중심을 피벗으로 시계방향(상단이 +x 로 눕는다).
#   SW_ROT 은 add_box/add_cyl 용 Blender 오일러, SWP() 는 add_plate 용 점 사상.
#   ★박스·라벨·쉘·측판·볼트·Plunger 가 모두 이 한 쌍을 써야 따로 놀지 않는다.
SW_ROT = (0, SW_TILT, 0)

def SWP(x, y):
    """스위치 로컬(수직 기준) 점 → 기울인 govBodyGrp 로컬 점."""
    c, s = math.cos(SW_TILT), math.sin(SW_TILT)
    dx, dy = x - SW_X, y - SW_Y
    return (SW_X + dx * c + dy * s, SW_Y - dx * s + dy * c)


# ── 액추에이터(플런저 레버) — 실사형 ──────────────────────────────────────
#   실사(스크린샷 2026-08-03 212805): 길고 얇은 바늘이 아니라 **짧고 두툼한 암**이고,
#   뿌리에 원판(부채꼴)이 있으며 끝에 좌우로 튀어나온 손잡이가 있다 (끝 옆 흰 롤러는 없음).
#   · 암은 기울인 박스 우측면과 90°(= 그 면의 법선)로 나간다. 면이 SW_TILT 만큼
#     눕었으니 암도 그만큼 아래를 향한다.
#   · **뿌리 원판(SECT_R)의 중심을 박스 우측면 위에 둔다** → 원판의 절반이 박스 안으로
#     들어가 가려지고 밖에는 반원 섹터만 보인다 (실사 그대로).
#   · **밖으로 보이는 암 = ACT_LEN - SECT_R ≈ 17mm.** 박스를 캐치 쪽으로 7mm 당겨
#     (SW_X -0.146 → -0.139) 얻었다. 박스를 원위치에 두면 면→타격점 수직거리가
#     36.7mm 라 무엇을 해도 바늘처럼 길어진다 — 길이만 줄이면 캐치를 못 친다.
#   ★타격점(ACT_TIP)은 캐치 기하가 정한다. 캐치 좌단 하면은 대기 시 x -0.100~-0.092 에서
#     y 0.2227~0.2232, 트립(+0.12rad) 시 x -0.094~-0.086 에서 y 0.2111~0.2125 —
#     두 자세가 모두 덮는 x 는 -0.094~-0.092 뿐이라 여기서 벗어날 수 없다.
#   ★ACT_TIP 은 암 **윗면의 끝 모서리**(= 캐치가 때리는 면)다. 축선 끝이 아니다 —
#     뭉툭한 끝을 만들면서 축선을 그대로 쓰면 윗면이 위로 튀어나와 대기 간극을 먹는다.
#   검산(앱 계측, govBodyGrp 로컬): 대기 간극 ≈5mm / 트립 시 ≈6.7mm 눌림
ACT_DIR   = (math.cos(SW_TILT), -math.sin(SW_TILT))   # 박스 우측면의 법선 (면과 90°)
ACT_NRM   = (-ACT_DIR[1], ACT_DIR[0])                 # 그 법선 (암 높이 방향)
ACT_TIP   = (-0.0930, 0.2180)     # ★타격점 = 암 윗면 끝 모서리 (캐치 하면 5mm 아래)
ACT_HT    = 0.005                 # 끝 반높이 (뭉툭 — 뾰족한 삼각 금지)
ACT_HR    = 0.006                 # 뿌리 반높이
ACT_THK   = 0.010                 # 암 두께(z) — 얇은 칼날 금지
SECT_R    = 0.013                 # 뿌리 부채꼴 반경 (절반은 박스 안으로 숨는다)
_ACT_AXT  = (ACT_TIP[0] - ACT_NRM[0] * ACT_HT,        # 축선의 끝
             ACT_TIP[1] - ACT_NRM[1] * ACT_HT)
_ACT_FACE = SWP(SW_X + SW_W / 2 - 0.001, SW_Y)        # 박스 우측면 위의 한 점
ACT_LEN   = ((_ACT_AXT[0] - _ACT_FACE[0]) * ACT_DIR[0] +
             (_ACT_AXT[1] - _ACT_FACE[1]) * ACT_DIR[1])  # 면 → 축선 끝 수직거리
ACT_ROOT  = (_ACT_AXT[0] - ACT_DIR[0] * ACT_LEN,      # 부채꼴 중심 (면 위 보장)
             _ACT_AXT[1] - ACT_DIR[1] * ACT_LEN)
PLG_BASE  = (ACT_ROOT[0], ACT_ROOT[1], SW_Z)          # Plunger 노드 원점(피벗)


Z_WHEEL_F = 0.026    # 휠 전면 최전방 (노란 밴드 앞면)
Z_CAM     = 0.012    # 날(캠) 평면 중심
Z_PEND    = 0.032    # 진자 평면 중심
Z_GLASS   = 0.042    # 반투명 커버 전면
Z_LEVER   = 0.048    # 캐치 레버 평면 중심
                     # (스위치 z 층은 SW_Z / SW_D 로 잡는다 — 구 Z_COVER 폐지)

# =============================================================================
#  4-1. BaseFrame — 베이스·측판·베어링·마운트판·스위치·오각커버·로프그립
# =============================================================================
def build_base():
    p = []
    # 하부 플랜지 + 앵커 볼트 — CAD 비율: 베이스 폭 ≈ 휠 지름 ×1.4 (이전 0.48은 과대)
    #   ★좌측만 BASE_L 까지 넓힌다 (PLAN.md: 스위치가 설 자리 확보). 우단 0.150 은 불변.
    bw = 0.150 - BASE_L                    # 본체 폭
    bcx = (BASE_L + 0.150) / 2             # 본체 중심 x
    p.append(add_box((bw + 0.040, 0.170, 0.020), T(bcx, 0.010, 0), MAT_BLUE_DK))
    for bx, bz in ((BASE_L - 0.005, 0.065), (0.150, 0.065),
                   (BASE_L - 0.005, -0.065), (0.150, -0.065)):
        p.append(add_cyl(0.0065, 0.012, T(bx, 0.026, bz), MAT_CHROME, verts=16))
    # 베이스 본체 + 상판 (로프 관통구 2개)
    body = add_box((bw, 0.140, 0.068), T(bcx, 0.055, 0), MAT_BLUE)
    top = add_box((bw + 0.016, 0.150, 0.010), T(bcx, 0.0945, 0), MAT_BLUE)
    for hx in (-G_R, G_R):
        for tgt in (body, top):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.013, depth=0.40,
                                                location=T(hx, 0.06, 0))
            boolean_cut(tgt, bpy.context.active_object)
    p += [body, top]
    for hx in (-G_R, G_R):
        p.append(add_ring(0.019, 0.013, 0.006, T(hx, 0.101, 0), MAT_DARK, verts=32))
    # 후면 베어링 페데스탈 + 축 (뒤판 없음 — 13:06 지시)
    p.append(add_box((0.060, 0.045, 0.100), T(0, 0.150, -0.062), MAT_BLUE_DK))
    p.append(add_cyl(0.020, 0.026, T(0, GWY, -0.048), MAT_GREY, rot=AX, verts=28))
    p.append(add_cyl(0.009, 0.100, T(0, GWY, -0.006), MAT_CHROME, rot=AX, verts=20))
    # 우측 가는 지주 + 스프링 상단 앵커 (스프링 축선 위 — SPR_TILT 와 항상 일치)
    #   스프링이 누우면 앵커도 오른쪽으로 멀어진다. 앵커 팔 길이를 그때그때 계산한다.
    ax_ = SPR_BASE[0] + math.sin(SPR_TILT) * SPR_REACH
    ay_ = SPR_BASE[1] + math.cos(SPR_TILT) * SPR_REACH
    p.append(add_box((0.013, 0.026, 0.270), T(0.145, 0.230, -0.004), MAT_BLUE))   # 지주 — 베이스 우단 위
    arm_w = (ax_ - 0.145) + 0.020
    p.append(add_box((arm_w, 0.022, 0.012), T((ax_ + 0.145) / 2, ay_ - 0.004, 0.014), MAT_BLUE_DK))
    #   앵커 블록은 스프링 끝단 볼을 품는다 — 레버가 돌 때 몇 mm 움직여도 안 드러난다.
    p.append(add_box((0.040, 0.030, 0.014), T(ax_, ay_, Z_LEVER), MAT_CAM, rot=(0, SPR_TILT, 0)))
    # 캐치 피벗 지지 암 (레버와 같이 눕혀 레버 뒤에 숨긴다)
    p.append(add_box((0.125, 0.012, 0.014), T(*LEVP(0.052, -0.012), 0.030), MAT_CAM,
                     rot=(0, -LEV_TILT, 0)))
    # 로프 그립(떡판)은 베이스가 아니라 Catch 노드에 붙어 있다 — 여기엔 관통구 링만.
    # ── 중앙 마운트판 + 육각너트 (실측 치수) ──
    mp = [(-0.018, 0.194), (0.014, 0.194), (0.018, 0.198), (0.018, 0.231),
          (0.014, 0.235), (-0.014, 0.235), (-0.018, 0.231)]
    p.append(add_plate(mp, 0.011, MAT_GREY, loc=(0, -0.046, 0), bevel_w=0.0022, name="mountPlate"))
    p.append(add_cyl(0.0123, 0.014, T(0.001, 0.219, 0.058), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0062, 0.020, T(0.001, 0.219, 0.062), MAT_DARK, rot=AX, verts=20))
    p.append(add_cyl(0.0113, 0.013, T(0.000, 0.180, 0.050), MAT_CHROME, rot=AX, verts=6))
    p.append(add_cyl(0.0057, 0.019, T(0.000, 0.180, 0.054), MAT_DARK, rot=AX, verts=20))
    p.append(add_cyl(0.0044, 0.006, T(0.012, 0.199, 0.055), MAT_CHROME, rot=AX, verts=16))  # 십자나사
    # ── 과속스위치 — 금색(아연도금) 본체를 SW_TILT 만큼 눕힌다 ─────────────
    #   실사에서 파란 것은 스위치가 아니라 이 아래의 브래킷/덮개다. 본체는 금속색.
    p.append(add_box((SW_W, SW_D, SW_H), T(SW_X, SW_Y, SW_Z), MAT_GOLD, rot=SW_ROT))
    swF = SW_Z + SW_D / 2
    p.append(add_box((0.018, 0.002, 0.036), T(*SWP(SW_X, SW_Y + 0.004), swF + 0.002),
                     MAT_LABEL, rot=SW_ROT))                                    # 흰 얼굴
    # 스위치를 무는 브래킷 — 본체와 같이 눕는다.
    #   ★박스를 감싸지 않고 뒤(z 0.026~0.036)에 대는 판이다. 실사에서도 파란 것은
    #     스위치 뒤 브래킷이고 박스는 그 앞에 노출돼 있다. 예전처럼 박스를 통째로
    #     감싸면 반투명 파랑이 금색 위에 겹쳐 올리브색으로 죽는다.
    sw_bot = SW_Y - SW_H / 2
    sw_top = SW_Y + SW_H / 2
    sw_shell = [SWP(SW_X - 0.018, sw_bot + 0.004),
                SWP(SW_X + 0.018, sw_bot + 0.004),
                SWP(SW_X + 0.020, SW_Y + 0.010),
                SWP(SW_X + 0.006, sw_top + 0.006),
                SWP(SW_X - 0.018, sw_top)]
    p.append(add_plate(sw_shell, 0.010, MAT_GLASS,
                       loc=(0, -(SW_Z - SW_D / 2 - 0.005), 0),
                       bevel_w=0.0008, name="swShell"))
    # 측판 마운트
    p.append(add_box((0.005, SW_D + 0.004, SW_H - 0.008),
                     T(*SWP(SW_X - SW_W / 2 - 0.004, SW_Y), SW_Z), MAT_GREY, rot=SW_ROT))
    for by in (SW_Y - SW_H * 0.28, SW_Y + SW_H * 0.28):
        p.append(add_cyl(0.0030, 0.012, T(*SWP(SW_X - SW_W / 2 - 0.008, by), SW_Z),
                         MAT_CHROME, rot=(0, math.pi / 2 + SW_TILT, 0), verts=12))
    return join_group(p, "BaseFrame")

# =============================================================================
#  4-2. Cover — 반투명 파란 U가드 (CAD: 휠 하반부만 감싼다 — 낮게)
# =============================================================================
def build_cover():
    p = []
    # 전면판: 베이스 상단(0.10)부터 휠 중심 바로 아래(0.20)까지
    #   ★우측판은 0.145 — 떡판 슈(x ≤ 0.137)가 지나갈 자리를 비워 둔다.
    #   ★좌측판은 넓어진 베이스에 맞춰 COV_L 로 나가고, 과속스위치를 무는 면이 된다.
    #     앞판은 y 0.20 까지만: 트립 때 캐치 좌단이 y 0.205 까지 내려와 앞판을 뚫는다.
    #     좌측판(x -0.176~-0.168)은 레버 좌단(x ≥ -0.103) 과 절대 안 겹치므로 높여도 안전.
    COV_L = -0.172
    p.append(add_box((0.145 - COV_L, 0.008, 0.100), T((COV_L + 0.145) / 2, 0.150, Z_GLASS), MAT_GLASS))
    p.append(add_box((0.008, 0.122, 0.152), T(COV_L, 0.176, 0.026), MAT_GLASS))
    p.append(add_box((0.008, 0.070, 0.100), T(0.145, 0.150, 0.004), MAT_GLASS))
    # 코너 나사
    for sx, sy in ((-0.162, 0.190), (0.135, 0.190), (-0.162, 0.112), (0.135, 0.112)):
        p.append(add_sphere(0.0036, T(sx, sy, Z_GLASS + 0.006), MAT_CHROME))
    return join_group(p, "Cover")

# =============================================================================
#  4-3. Pulley — 로프 홈 + 노란 전면 밴드 + 파란 곡선 스포크 6 + 날(캠)
# =============================================================================
def spoke_pts(r0=0.026, r1=0.078, w0=0.020, w1=0.013, curve=0.013, n=8):
    left, right = [], []
    for i in range(n):
        t = i / (n - 1)
        r = r0 + (r1 - r0) * t
        off = curve * math.sin(math.pi * t * 0.9)
        w = w0 + (w1 - w0) * t
        left.append((off - w, r))
        right.append((off + w, r))
    return left + right[::-1]

def cam_pts(n=6, r_out=CAM_OUT, r_root=CAM_ROOT, phase=0.30):
    """한방향 날 — 급경사 걸림면 + 뭉툭한 플랫 팁 + 완만한 등면."""
    pts = []
    step = 2.0 * math.pi / n
    for i in range(n):
        a0 = phase + i * step
        pts.append((math.cos(a0) * r_root, math.sin(a0) * r_root))
        a1 = a0 + step * 0.12
        pts.append((math.cos(a1) * (r_root + (r_out - r_root) * 0.85),
                    math.sin(a1) * (r_root + (r_out - r_root) * 0.85)))
        a2 = a0 + step * 0.20
        pts.append((math.cos(a2) * r_out, math.sin(a2) * r_out))
        a3 = a0 + step * 0.36
        pts.append((math.cos(a3) * (r_out * 0.97), math.sin(a3) * (r_out * 0.97)))
        a4 = a0 + step * 0.72
        pts.append((math.cos(a4) * (r_root + 0.010), math.sin(a4) * (r_root + 0.010)))
    return pts

def build_pulley():
    p = []
    C = (0, GWY)
    # 로프 홈 — ★CAD: 바깥 테두리 전체가 노랑 (플랜지·전면 밴드 모두 노랑 = 한 덩어리 림)
    for fz in (-0.014, 0.014):
        p.append(add_torus(RIM_RO, 0.0055, T(C[0], C[1], fz), MAT_YELLOW, rot=AX))
    p.append(add_ring(0.098, 0.090, 0.026, T(C[0], C[1], 0), MAT_DARK, rot=AX))   # 홈 바닥(어둡게 — 로프 자리)
    # 노란 전면 밴드 — 림과 이어져 하나의 굵은 노란 테두리로 보인다
    p.append(add_ring(Y_OUT, Y_IN, 0.013, T(C[0], C[1], 0.0195), MAT_YELLOW, rot=AX))
    p.append(add_torus(0.093, 0.0011, T(C[0], C[1], Z_WHEEL_F), MAT_DARK, rot=AX, mseg=110))
    # 파란 휠 바디 링 + 곡선 스포크 6 + 허브
    p.append(add_ring(0.082, 0.068, 0.030, T(C[0], C[1], 0.004), MAT_SPOKE, rot=AX))
    sp = spoke_pts()
    for k in range(6):
        p.append(add_plate(sp, 0.016, MAT_SPOKE, loc=(0, -0.004, GWY),
                           rot=(0, k * 2 * math.pi / 6, 0), bevel_w=0.0010, name="spoke"))
    p.append(add_cyl(0.028, 0.034, T(C[0], C[1], 0.002), MAT_SPOKE, rot=AX, verts=28))
    p.append(add_cyl(0.015, 0.010, T(C[0], C[1], 0.021), MAT_CHROME, rot=AX, verts=24))
    # ── 날(캠) — 휠과 함께 돈다. 트립 시 캐치 쐐기가 이 이빨 골에 물린다 ──
    p.append(add_plate(cam_pts(), 0.011, MAT_CAM, loc=(0, -Z_CAM, GWY),
                       bevel_w=0.0014, name="camStar"))
    return join_group(p, "Pulley", origin=T(0, GWY, 0))

# =============================================================================
#  4-4. PendA / PendB — 크롬 돔 진자 + 다크 링 + 일자 링크 (원점 = 피벗 볼트)
#      캐노니컬: +X = 접선, +Y = 반경 바깥. 트립 rotation.z +0.45 → 돔이 바깥으로.
# =============================================================================
def build_pendulum(name, pivot_ang):
    F = pivot_ang - math.pi / 2
    piv = (math.cos(pivot_ang) * PEND_PIV_R, GWY + math.sin(pivot_ang) * PEND_PIV_R)
    arm_len = PEND_MASS - PEND_PIV_R      # 0.040

    def W(cx, cy):
        return (piv[0] + cx * math.cos(F) - cy * math.sin(F),
                piv[1] + cx * math.sin(F) + cy * math.cos(F))

    p = []
    p.append(add_cyl(0.0070, 0.013, T(piv[0], piv[1], Z_PEND - 0.008), MAT_CHROME, rot=AX, verts=18))
    # 암 판
    arm = [(-0.013, -0.011), (arm_len + 0.006, -0.010), (arm_len + 0.011, 0.010),
           (0.020, 0.016), (-0.013, 0.010)]
    p.append(add_plate([W(a[0], a[1]) for a in arm], 0.009, MAT_GREY,
                       loc=(0, -(Z_PEND - 0.006), 0), bevel_w=0.0010, name="pendArm"))
    for cx, cy in ((0.008, 0.001), (0.024, 0.004)):
        wx, wy = W(cx, cy)
        p.append(add_sphere(0.0036, T(wx, wy, Z_PEND), MAT_CHROME))
    # 크롬 돔 (납작) + 다크 베이스 링 — 유리(z 0.042)보다 앞으로 나가지 않게
    dx, dy = W(arm_len, 0.006)
    p.append(add_sphere(0.020, T(dx, dy, Z_PEND - 0.001), MAT_DOME, squash_z=0.42))
    p.append(add_torus(0.0175, 0.0044, T(dx, dy, Z_PEND - 0.006), MAT_DARK, rot=AX, mseg=48))
    # 일자 링크 바 — 캐노니컬 -Y(중심 관통, 반대편 피벗 방향)
    bar = [(-0.006, -0.070), (0.005, -0.070), (0.005, 0.001), (-0.006, 0.001)]
    p.append(add_plate([W(b[0], b[1]) for b in bar], 0.006, MAT_GREY,
                       loc=(0, -(Z_PEND - 0.011), 0), bevel_w=0.0006, name="pendLink"))
    return join_group(p, name, origin=T(piv[0], piv[1], Z_PEND - 0.008))

# =============================================================================
#  4-5. Catch — 폴리시드 캐치 레버 + 떡판(캐치슈) 레그 (원점 = 중앙 피벗 핀)
#      좌단: 절판(절곡) 갈고리 + 얇은 캠 발톱. 우단: 스프링 시트 + 떡판 레그.
#      ★레버 전체를 LEV_TILT 만큼 눕혀 굽는다 — 스프링(SPR_TILT)과 한 직선이 된다.
# =============================================================================
def build_catch():
    P = CATCH_PIV
    _c, _s = math.cos(LEV_TILT), math.sin(LEV_TILT)

    def A(rx, ry):
        """레버 로컬(수평 기준) → govBodyGrp 로컬. LEV_TILT 기울기를 메시에 굽는다."""
        return (P[0] + rx * _c - ry * _s, P[1] + rx * _s + ry * _c)

    p = []
    # ── 레버판 끝: 검은색 칠한 빈 노치(갈고리 안쪽)를 채움 ──────────────────
    #   V자/텅 빈 훅 구멍 금지 → 아래로만 살짝 내린 통짜 끝.
    tip = [(LEV_L + 0.020,  0.011),   # 몸통 상단
           (LEV_L - 0.002,  0.011),   # 좌상
           (LEV_L - 0.004,  0.002),   # 좌외 살짝 라운드감
           (LEV_L - 0.004, -0.014),   # 좌하 (채운 통짜)
           (LEV_L + 0.004, -0.016),   # 하단 (검은 영역 채움)
           (LEV_L + 0.020, -0.007)]   # 몸통 하변
    plate = tip + [(LEV_R, -0.013), (LEV_R, 0.014)]
    p.append(add_plate([A(q[0], q[1]) for q in plate], 0.011, MAT_STEEL,
                       loc=(0, -Z_LEVER, 0), bevel_w=0.0016, name="catchPlate"))

    # 중앙 피벗 핀
    p.append(add_cyl(0.0130, 0.013, T(P[0], P[1], Z_LEVER + 0.013), MAT_CHROME, rot=AX, verts=28))
    p.append(add_cyl(0.0065, 0.026, T(P[0], P[1], Z_LEVER - 0.004), MAT_CHROME, rot=AX, verts=16))
    # 우단 스프링 시트 헤드 + 핀
    p.append(add_cyl(0.0095, 0.011, T(*A(0.112, 0.002), Z_LEVER + 0.011), MAT_CHROME, rot=AX, verts=20))
    p.append(add_cyl(0.015, 0.009, T(SPR_BASE[0], SPR_BASE[1] - 0.003, SPR_BASE[2]),
                     MAT_GREY, rot=(0, SPR_TILT, 0), verts=20))

    # ── 떡판(캐치슈) 레그
    leg = [(0.094, 0.300), (0.122, 0.312), (0.137, 0.268),
           (0.134, 0.230), (0.114, 0.226), (0.110, 0.266)]
    p.append(add_plate(leg, 0.014, MAT_STEEL, loc=(0, -Z_LEVER, 0),
                       bevel_w=0.0012, name="shoeLeg"))
    for rx, ry in ((0.118, 0.290), (0.126, 0.250)):
        p.append(add_sphere(0.0036, T(rx, ry, Z_LEVER + 0.008), MAT_CHROME))
    p.append(add_box((0.018, 0.048, 0.024), T(0.128, 0.228, 0.024), MAT_STEEL))
    shoe_h = SHOE_Y1 - SHOE_Y0
    shoe_y = (SHOE_Y0 + SHOE_Y1) / 2
    p.append(add_box((0.020, 0.015, shoe_h), T(SHOE_X + 0.016, shoe_y, 0.0), MAT_STEEL))
    p.append(add_box((0.006, 0.014, shoe_h - 0.004),
                     T(SHOE_X + 0.003, shoe_y, 0.0), MAT_DARK))
    return join_group(p, "Catch", origin=T(P[0], P[1], P[2]))

# =============================================================================
#  4-6. Spring — ★수직으로 굽는다 (env 래퍼 rotation.z = -SPR_TILT 가 기울임)
# =============================================================================
def build_spring():
    B = SPR_BASE
    p = []
    p.append(add_cyl(0.0165, 0.008, T(B[0], B[1] + 0.004, B[2]), MAT_GREY, verts=20))
    p.append(add_helix(T(B[0], B[1] + 0.008, B[2]), MAT_CHROME,
                       coil_r=0.020, wire=0.0050, turns=8, length=0.082, name="coil"))
    p.append(add_cyl(0.0052, 0.104, T(B[0], B[1] + 0.058, B[2]), MAT_CHROME, verts=16))
    p.append(add_cyl(0.0090, 0.016, T(B[0], B[1] + 0.104, B[2]), MAT_CHROME, verts=6))  # 육각 조정너트
    p.append(add_sphere(0.0080, T(B[0], B[1] + SPR_REACH, B[2]), MAT_CHROME))
    return join_group(p, "Spring", origin=T(B[0], B[1], B[2]))

# =============================================================================
#  4-7. Plunger — 실사형 액추에이터
#       뿌리 부채꼴(절반 박스 안) + 짧고 두툼한 암 + 끝 좌우 T손잡이
# =============================================================================
def build_plunger():
    """스위치 액추에이터 — 실사 형상. 바늘형 칼날·덧댄 팁(actTip)·이중 끝은 두지 않는다.
       끝의 T손잡이는 보수기사가 손으로 스위치를 중간 위치로 되돌리는 도구이며,
       Plunger 메시의 일부다 (전면 L자 ResetPin/ResetBracket 소품과는 다른 것).
       끝 옆 흰 동그라미(롤러)는 두지 않는다."""
    R, K = ACT_ROOT, ACT_TIP
    ux, uy = ACT_DIR
    nx, ny = ACT_NRM
    p = []
    # ① 뿌리 부채꼴 — 원판 중심이 박스 우측면 위 → 절반이 박스 안으로 숨는다(위·아래 운동)
    p.append(add_cyl(SECT_R, ACT_THK - 0.001, T(R[0], R[1], SW_Z), MAT_STEEL,
                     rot=AX, verts=40))
    p.append(add_cyl(0.0035, ACT_THK + 0.010, T(R[0], R[1], SW_Z), MAT_CHROME,
                     rot=AX, verts=16))                       # 피벗 축
    # ② 암 — 뿌리 ACT_HR → 끝 ACT_HT 로 살짝 테이퍼, 끝은 뭉툭한 평면(뾰족 금지)
    tipAx = (K[0] - nx * ACT_HT, K[1] - ny * ACT_HT)
    arm = [(R[0] + nx * ACT_HR, R[1] + ny * ACT_HR),
           K,                                                 # 윗면 끝 = 타격점
           (tipAx[0] - nx * ACT_HT, tipAx[1] - ny * ACT_HT),  # 아랫면 끝
           (R[0] - nx * ACT_HR, R[1] - ny * ACT_HR)]
    p.append(add_plate(arm, ACT_THK, MAT_STEEL, loc=(0, -SW_Z, 0),
                       bevel_w=0.0006, name="actArm"))
    # ③ 끝 좌우 수동복귀 손잡이 — 암을 관통해 좌우로 10mm 씩 나온 T 바 + 끝 마디
    #   ★위쪽(캐치 쪽)으로는 키우지 않는다 — 대기 간극을 먹는다.
    #   ★끝 옆 흰 동그라미(롤러)는 두지 않는다 — 손잡이만 남긴다.
    hx, hy = tipAx[0] - ux * 0.003, tipAx[1] - uy * 0.003
    p.append(add_cyl(0.0024, ACT_THK + 0.020, T(hx, hy, SW_Z), MAT_CHROME,
                     rot=AX, verts=14))
    for zc in (SW_Z - ACT_THK / 2 - 0.0085, SW_Z + ACT_THK / 2 + 0.0085):
        p.append(add_cyl(0.0040, 0.004, T(hx, hy, zc), MAT_CHROME, rot=AX, verts=14))
    return join_group(p, "Plunger", origin=T(*PLG_BASE))

# =============================================================================
#  5. 빌드 & 내보내기
# =============================================================================
build_base()
build_cover()
build_pulley()
build_pendulum("PendA", PEND_ANG_A)
build_pendulum("PendB", PEND_ANG_A + math.pi)
build_catch()
build_spring()
build_plunger()

def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=False, export_apply=True, export_yup=True)
    print("[overspeed_governor v4.2] 내보내기 완료:", path)

export_glb(OUTPUT_PATH)
print("완료 — 오브젝트:", sorted(o.name for o in bpy.data.objects))
