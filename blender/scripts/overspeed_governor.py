# -*- coding: utf-8 -*-
# =============================================================================
#  승강기 과속조절기 (Overspeed Governor) — Blender Python(bpy) 실사 모델링 v2.1
# -----------------------------------------------------------------------------
#  참조: device_china.mp4 0~40초 (森赫电梯 限速器 3D 애니메이션 프레임 분석)
#  사용법: Blender > Scripting 탭 > New > 전체 붙여넣기 > ▶ Run Script
#  결과  : 6개 개별 오브젝트 + models/gltf/overspeed_governor.glb 내보내기
#
#  v2 변경(실사화):
#   - 도르래: 노란 림 밴드 + 네이비 곡선 스포크 6개(사이가 뚫림) + 로프 홈
#   - 레버암: 영상 윤곽 그대로 2D 폴리곤 압출(후크 노치·확폭 헤드) + 피벗 핀
#   - 캠: 뾰족 캠 플레이트 2매 + 흰 롤러 + 다크 원형추 (반투명 커버 너머 보임)
#   - 커버: 좌상단 불투명 파란 오각판(스위치 커버) + 하부 반투명 파란 박스(α0.34)
#   - 중앙: 회색 마운트판 + 수직 육각볼트 2개(블랙 코어) + 소형 나사
#   - 로프: 3-스트랜드 꼬임 헬릭스 × 좌우 2줄 + 홈 위 로프 링
#
#  v2.1 (라체트·쐐기 실사 보정):
#   - 라체트: 바늘형 지그재그 → 뭉툭한 플랫 tip + 급경사 걸림면 + 완만 등면 (한방향/다운만)
#   - 레버 후크: tip 뭉툭화 (실사 폴 이빨 — 양방향 조속기 아님)
#   - bevel 강화로 주물감
#
#  v2.2 (실물 사진 기준 좌측 스위치부·스프링 각도 보정):
#   - 스위치 신설: v2.1엔 스위치 자체가 없었다 → 소형 다크 케이스 + 롤러 레버 추가.
#     롤러는 원심추(뭉치) 궤도 바로 바깥(r≈0.122)에 두어 과속 시 타격되게 함.
#   - 스위치 박스 축소: 좌측 파란 오각판 0.118×0.188 → 0.050×0.079 (마운트판 크기).
#     스위치를 가리지 않도록 뒤쪽(+Y)으로 이동.
#   - 링크판 신설: 본체 좌측 외면 세로 브라켓(상·하 꺾임 탭 + 중앙 구멍) + 링크 로드.
#   - 스프링: 수직 42° → 70°(수평 위 20°, 레버와 일자), 전장 0.195 → 0.117로 단축.
#     기존엔 z 0.341까지 솟아 실물보다 과하게 높았다.
#   ※ 원심추 → 스위치 타격 애니메이션 연동은 미포함 (별도 지시 예정)
#
#  v2.3 (트립 기구 재현 — 참조 영상 00:29~00:41 + 사용자 육성 설명):
#   동작: 정격 1.3배 과속 → 진자 2개가 원심력으로 벌어짐 → 뭉치가 스위치를 침 →
#         쐐기가 회전날 이빨에 물림(하강 방향만) → 휠 정지 → 로프 파지.
#   - Pendulum 신설: 진자 2개(피벗 보스 + 암 + 대형 납작 원판 뭉치), 180° 대칭.
#     v2 엔 이 부품이 없었고 대신 정체불명의 검은 구슬 2개가 떠 있었다 → 삭제.
#   - Pawl 신설: 좌하단 쐐기판(큰 원형 구멍 + 피벗 핀 + 황동 링크 핀).
#   - 회전날: 8개 작은 톱니 → 6개 큰 톱니, 골 반경 0.070 → 0.050 (참조의 큰 로브).
#   - 노란 림: 둥근 단면 토러스(고무호스처럼 보임) → 평평한 밴드 2줄 + V홈.
#     add_ring() 헬퍼 신설 (실린더 불리언 차집합).
#   - ★add_cyl 기본 셰이딩을 평면으로. shade_smooth가 짧은 실린더의 캡까지 뭉개
#     핀·볼트·원판이 전부 구슬처럼 보이던 문제의 근본 원인이었다.
#
#  v2.4 (뒷면 구조 — 사용자가 뒤에서 찍은 캡처 + 육성 설명):
#   - ★진자를 휠 **앞뒤 양면**에 배치. 두 진자가 서로 반대로 벌어지며 균형을 잡으므로
#     전/후면 대칭 한 쌍이 정상이다. v2.3 은 전면에만 있어 뒤가 텅 비어 보였다.
#   - 휠 스포크 6개 → 3개.
#   - 보조 회전날(ratchet2) 삭제 — 조속기 구조가 아니고 뒤에서 별판이 겹쳐 보였다.
#
#  v2.5 (로프 이중 표시 제거):
#   - BaseFrame 에 구워 넣었던 로프(좌우 2줄 + 시브 홈 링) 삭제. environment.js 가 전 구간을
#     실사 로프 메시로 그리면서 같은 자리에 로프가 두 겹이 됐고, .glb 쪽은 35cm 토막이라
#     잘린 호스처럼 보였다. 로프는 승강로 길이에 맞춰 런타임에 그리는 게 맞다.
#  ● 오브젝트: Pulley / Cam / Pendulum / Pawl / LeverArm / Spring / Cover / Switch / BaseFrame
#  ● 좌표계: Blender Z-up 모델링, 전면=-Y → glTF(export_yup)로 Three.js Y-up 자동 변환
#  ● 스케일: 도르래 외경 ≈ 0.30m (Three.js 로드부 scale 0.72 정합 유지)
# =============================================================================

import bpy
import math
import os

OUTPUT_PATH = r"C:\Users\goodm\Desktop\simmul\models\gltf\overspeed_governor.glb"

# =============================================================================
#  0. 씬 초기화 (재질 생성 전에 — orphan 퍼지로 새 재질이 지워지지 않게)
# =============================================================================
def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for b in list(block):
            if b.users == 0:
                block.remove(b)

reset_scene()

# =============================================================================
#  1. 재질 (영상 색감 기준)
# =============================================================================
def make_material(name, rgb, metallic=0.0, roughness=0.6, alpha=1.0):
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
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], alpha)

    if alpha < 1.0:
        for attr, value in (("blend_method", 'BLEND'), ("shadow_method", 'HASHED')):
            try:
                setattr(mat, attr, value)
            except Exception:
                pass
        mat.use_backface_culling = False
    return mat

MAT_YELLOW = make_material("Gov_Yellow",   (0.95, 0.69, 0.02), metallic=0.20, roughness=0.42)  # 림 밴드
MAT_NAVY   = make_material("Gov_Navy",     (0.035, 0.095, 0.27), metallic=0.15, roughness=0.50) # 휠 스포크·림 네이비
MAT_BLUE   = make_material("Gov_Blue",     (0.045, 0.17, 0.47), metallic=0.10, roughness=0.48)  # 베이스·스위치 커버 파랑
MAT_GLASS  = make_material("Gov_BlueGlass",(0.30, 0.50, 0.78), metallic=0.05, roughness=0.22, alpha=0.34) # 반투명 커버
MAT_LEVER  = make_material("Gov_Lever",    (0.86, 0.88, 0.91), metallic=1.00, roughness=0.16)   # 폴리시드 레버
MAT_CHROME = make_material("Gov_Chrome",   (0.82, 0.84, 0.88), metallic=1.00, roughness=0.12)   # 스프링·핀
MAT_STEEL  = make_material("Gov_Steel",    (0.60, 0.63, 0.67), metallic=0.85, roughness=0.35)   # 마운트판·볼트
MAT_CAM    = make_material("Gov_Cam",      (0.30, 0.345, 0.42), metallic=0.60, roughness=0.40)   # 내부 캠 플레이트
MAT_WHITE  = make_material("Gov_Roller",   (0.88, 0.89, 0.90), metallic=0.30, roughness=0.30)   # 흰 롤러
MAT_DARK   = make_material("Gov_Dark",     (0.10, 0.11, 0.13), metallic=0.40, roughness=0.55)   # 원형추·볼트 코어
MAT_ROPE   = make_material("Gov_Rope",     (0.42, 0.44, 0.48), metallic=0.75, roughness=0.40)   # 와이어 로프(아연도금)
MAT_BRASS  = make_material("Gov_Brass",    (0.72, 0.55, 0.18), metallic=0.90, roughness=0.30)   # 스위치 롤러·링크(옐로우 크로메이트)

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
    """★기본이 평면 셰이딩(smooth=False)이다.
       shade_smooth를 걸면 짧은 실린더의 평평한 캡 노멀까지 뭉개져 핀·볼트·원판이
       전부 '구슬'처럼 보인다 — v2 에서 검은 구슬 2개로 오해받은 원인이 이것이다.
       각도 기반 shade_auto_smooth는 모디파이어라 join_group()의 join에서 날아가므로 못 쓴다."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth,
                                        location=loc, rotation=rot)
    return _finish(mat, smooth)

def add_torus(major, minor, loc, mat, rot=(0, 0, 0), mseg=64, nseg=16, flat=1.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=mseg, minor_segments=nseg,
                                     location=loc, rotation=rot)
    if flat != 1.0:  # 축방향 눌러 '밴드' 단면
        bpy.context.active_object.scale = (1.0, flat, 1.0) if abs(rot[0]) > 1 else (1.0, 1.0, flat)
    return _finish(MAT_YELLOW if mat is None else mat, smooth=True)

def add_ring(r_out, r_in, depth, loc, mat, rot=(0, 0, 0), verts=64):
    """납작한 링(밴드). 실린더에서 안쪽 실린더를 불리언으로 빼낸다.
       바깥면이 평평해서 실제 시브 림처럼 보인다 — 둥근 단면 토러스는 고무호스처럼 보인다."""
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

def add_ball(radius, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=20, ring_count=14)
    return _finish(mat, smooth=True)

def add_plate(pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), bevel_w=0.0012, name="plate"):
    """XZ 평면 2D 윤곽(pts)을 Y두께(depth)로 압출한 판. 실사 부품의 핵심 헬퍼.
       Triangulate(오목 폴리곤 안전) → Solidify → Bevel 순서로 적용."""
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
        bev = obj.modifiers.new("bev", 'BEVEL'); bev.width = bevel_w; bev.segments = 1
    for md in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    obj.location = loc
    obj.rotation_euler = rot
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def add_helix(loc, rot, mat, coil_r=0.020, wire=0.0045, turns=7, length=0.11, name="helix"):
    cdata = bpy.data.curves.new(name + "_curve", type='CURVE')
    cdata.dimensions = '3D'
    cdata.bevel_depth = wire
    cdata.bevel_resolution = 4
    cdata.resolution_u = 8
    sp = cdata.splines.new('POLY')
    ppt = 14
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
#  3. 부품 생성  (전면 = -Y, 위 = +Z, 휠 축 = Y)
# =============================================================================
PC = (0.0, 0.0, 0.05)        # 휠(도르래) 중심
R_ROPE = 0.150               # 로프 홈 반경 (외경 0.30)
AXROT = (math.pi / 2, 0, 0)  # 실린더/토러스 축을 Y로

# ── 3-1. Pulley : 노란 림 밴드 + 네이비 곡선 스포크 6 + 허브 ─────────────────
def spoke_pts(r0=0.034, r1=0.120, w0=0.017, w1=0.011, curve=0.013, n=7):
    """+Z로 뻗는 스포크의 2D 윤곽 — 옆으로 살짝 휜 곡선 스포크 (영상 참조)."""
    left, right = [], []
    for i in range(n):
        t = i / (n - 1)
        r = r0 + (r1 - r0) * t
        off = curve * math.sin(math.pi * t * 0.9)
        w = w0 + (w1 - w0) * t
        left.append((off - w, r))
        right.append((off + w, r))
    return left + right[::-1]

def build_pulley():
    parts = []
    # 노란 림 — 평평한 밴드 2줄(전·후 플랜지) + 그 사이 로프 V홈.
    #   v2 의 둥근 단면 토러스(minor 0.0155)는 고무 호스처럼 보여서 폐기했다.
    parts.append(add_ring(0.155, 0.138, 0.012, (PC[0], PC[1] - 0.012, PC[2]), MAT_YELLOW, rot=AXROT))
    parts.append(add_ring(0.155, 0.138, 0.012, (PC[0], PC[1] + 0.012, PC[2]), MAT_YELLOW, rot=AXROT))
    parts.append(add_ring(0.148, 0.138, 0.013, PC, MAT_YELLOW, rot=AXROT))   # 홈 바닥
    # 홈 경계 가는 선 (참조 영상의 어두운 라인 2줄)
    parts.append(add_torus(0.1505, 0.0018, (PC[0], PC[1] - 0.0063, PC[2]), MAT_NAVY, rot=AXROT, mseg=72))
    parts.append(add_torus(0.1505, 0.0018, (PC[0], PC[1] + 0.0063, PC[2]), MAT_NAVY, rot=AXROT, mseg=72))
    # 림 내측 네이비 링 (스포크 접합)
    parts.append(add_ring(0.138, 0.114, 0.030, PC, MAT_NAVY, rot=AXROT))
    # 곡선 스포크 3개 (사용자 지시: 6개 → 3개)
    sp = spoke_pts()
    for k in range(3):
        parts.append(add_plate(sp, 0.016, MAT_NAVY, loc=PC, rot=(0, k * 2 * math.pi / 3, 0),
                               bevel_w=0.0010, name="spoke"))
    # 허브 (네이비) + 크롬 축
    parts.append(add_cyl(0.030, 0.052, PC, MAT_NAVY, rot=AXROT, verts=28))
    parts.append(add_cyl(0.0125, 0.096, PC, MAT_CHROME, rot=AXROT, verts=20))
    return join_group(parts, "Pulley", origin=PC)

# ── 3-2. Cam : 한방향(다운 걸림) 라체트 — 실사처럼 뭉툭한 이빨 + 흰 롤러·볼베어링
#     ※ 양방향 조속기 아님. 급경사 걸림면(하강 캐치) + 완만한 등면(반대방향 미끄러짐).
#     예전 v2 지그재그는 tip이 바늘처럼 너무 날카로워 실사(주물 폴·라체트)와 어긋남.
def ratchet_pts(n=6, r_out=0.108, r_root=0.050, phase=0.18):
    """한방향 라체트 윤곽 — 걸림면은 가파르되 이빨 끝은 플랫(뭉툭), 등면은 완만."""
    pts = []
    step = 2.0 * math.pi / n
    for i in range(n):
        a0 = phase + i * step
        # 골
        pts.append((math.cos(a0) * r_root, math.sin(a0) * r_root))
        # 걸림면(급경사) — tip까지 바늘처럼 가지 않고 두께를 유지한 채 상승
        a_rise = a0 + step * 0.10
        r_mid = r_root + (r_out - r_root) * 0.82
        pts.append((math.cos(a_rise) * r_mid, math.sin(a_rise) * r_mid))
        # 이빨 끝 — 실사 주물감의 뭉툭한 플랫 팁 (날카로운 점 제거)
        a_tip0 = a0 + step * 0.14
        a_tip1 = a0 + step * 0.26
        pts.append((math.cos(a_tip0) * r_out, math.sin(a_tip0) * r_out))
        pts.append((math.cos(a_tip1) * (r_out * 0.988), math.sin(a_tip1) * (r_out * 0.988)))
        # 완만한 등면 — 반대 회전 시 폴이 미끄러지도록
        a_back = a0 + step * 0.70
        pts.append((math.cos(a_back) * (r_root + 0.014), math.sin(a_back) * (r_root + 0.014)))
    return pts

def build_cam():
    parts = []
    # 메인 라체트 캠 — 휠 스포크 앞(y=-0.020)에 단독 배치해 다른 부품과 겹치지 않게 분리
    parts.append(add_plate(ratchet_pts(), 0.013, MAT_CAM, loc=(PC[0], PC[1] - 0.020, PC[2]),
                           bevel_w=0.0022, name="ratchet"))
    # 캠 허브 (중심 보스)
    parts.append(add_cyl(0.030, 0.020, (PC[0], PC[1] - 0.020, PC[2]), MAT_STEEL, rot=AXROT, verts=24))
    # ※ 뒤에 위상 어긋나게 겹쳐뒀던 보조 회전날(ratchet2)은 삭제했다 — 실제 조속기
    #    구조가 아니고, 뒤에서 보면 별판이 두 장 겹쳐 보여 형상만 어지럽혔다 (사용자 지시).
    # ※ v2 의 흰 롤러·검은 볼 2개도 삭제했다. 참조 영상에서 그 자리에 있던 건
    #    베어링이 아니라 진자에 달린 원판형 뭉치였고, 지금은 build_pendulum()이 만든다.
    return join_group(parts, "Cam", origin=PC)

# ── 3-2b. Pendulum : 진자 2개 (원판형 뭉치) — 참조 영상 00:31~00:36 ──────────
#   정격속도 1.3배에서 원심력으로 바깥으로 벌어지며 스위치를 때린다.
#   v2 에는 이 부품이 아예 없었고, 그 자리에 작은 검은 구슬 2개가 떠 있었다.
PEND_ANG = math.radians(110)   # 첫 번째 진자 방위 (나머지 하나는 180° 반대)
PEND_PIVOT_R = 0.048           # 피벗 반경
PEND_MASS_R = 0.104            # 뭉치 중심 반경
PEND_DISC = 0.031              # 뭉치(원판) 반경

def build_pendulum():
    """★진자는 휠 **앞뒤 양면**에 같은 부품이 붙는다 (사용자 지적).
       두 진자가 서로 반대로 벌어지며 균형을 잡으므로 전/후면이 대칭 한 쌍이다.
       v2.3 은 전면에만 있어서 뒤에서 보면 휠 속이 텅 비어 보였다."""
    parts = []
    for side in (-1, +1):          # -1 = 전면(-Y), +1 = 후면(+Y)
        for k in (0, 1):
            a = PEND_ANG + k * math.pi
            ca, sa = math.cos(a), math.sin(a)
            px, pz = ca * PEND_PIVOT_R, sa * PEND_PIVOT_R
            cx, cz = ca * PEND_MASS_R, sa * PEND_MASS_R
            # 피벗 보스
            # ※ smooth=False 필수 — 짧은 실린더에 shade_smooth가 걸리면 캡 노멀이 뭉개져
            #   납작한 원판이 구슬처럼 보인다 (v2 의 '검은 구슬'이 이래서 생겼다).
            parts.append(add_cyl(0.011, 0.030, (px, PC[1] + side * 0.028, PC[2] + pz),
                                 MAT_STEEL, rot=AXROT, verts=20, smooth=False))
            # 암 — 피벗에서 뭉치까지 (rot_y = -a 라야 로컬 +X가 방위 a를 향한다)
            alen = PEND_MASS_R - PEND_PIVOT_R
            parts.append(add_box((alen, 0.015, 0.020),
                                 ((px + cx) / 2, PC[1] + side * 0.034, PC[2] + (pz + cz) / 2),
                                 MAT_LEVER, rot=(0, -a, 0)))
            # 뭉치 — 대형 납작 원판
            parts.append(add_cyl(PEND_DISC, 0.018, (cx, PC[1] + side * 0.038, PC[2] + cz),
                                 MAT_LEVER, rot=AXROT, verts=40, smooth=False))
            parts.append(add_cyl(0.006, 0.022, (cx, PC[1] + side * 0.044, PC[2] + cz),
                                 MAT_CHROME, rot=AXROT, verts=14, smooth=False))   # 중앙 리벳
    return join_group(parts, "Pendulum", origin=PC)

# ── 3-2c. Pawl : 쐐기 — 회전날 이빨에 물려 휠을 잡는다 (하강 방향만) ──────────
#   참조 영상 좌하단: 큰 원형 구멍이 뚫린 납작한 쐐기판 + 황동 링크 핀.
#   로컬 +X가 쐐기 끝(tip). rot_y 160° 로 좌하단 바깥(방위 200°)을 향하게 세운다.
PAWL_POS = (-0.076, -0.040, 0.002)   # 휠중심(z=0.05) 기준 좌하단 — 방위 ≈212°, r≈0.090
PAWL_ROT = (0, math.radians(160), 0)
PAWL = [(-0.034, -0.016), (0.024, -0.020), (0.044, -0.004), (0.030, 0.014), (-0.030, 0.015)]

def build_pawl():
    parts = []
    parts.append(add_plate(PAWL, 0.014, MAT_LEVER, loc=PAWL_POS, rot=PAWL_ROT,
                           bevel_w=0.0016, name="pawl"))
    # 판 가운데 큰 원형 구멍 (참조의 검은 원)
    parts.append(add_cyl(0.013, 0.015, (-0.069, PAWL_POS[1], 0.006), MAT_DARK,
                         rot=AXROT, verts=24, smooth=False))
    # 피벗 핀 (안쪽 끝)
    parts.append(add_cyl(0.006, 0.026, (-0.047, PAWL_POS[1], -0.009), MAT_CHROME,
                         rot=AXROT, verts=14, smooth=False))
    # 황동 링크 핀 — 레버 훅으로 이어지는 연결부 (참조 좌상단 황동 소품)
    parts.append(add_cyl(0.0042, 0.026, (-0.101, PAWL_POS[1] - 0.008, 0.024), MAT_BRASS,
                         rot=(0, 0, math.radians(38)), verts=12, smooth=False))
    parts.append(add_ball(0.0060, (-0.108, PAWL_POS[1] - 0.008, 0.036), MAT_BRASS))
    return join_group(parts, "Pawl", origin=PAWL_POS)

# ── 3-3. LeverArm : 영상 윤곽 압출 — 후크(쐐기) 끝은 실사처럼 뭉툭한 한방향 이빨
# 좌하단 후크(노치)에서 우상단 확폭 헤드까지 — XZ 평면 폴리곤 (CCW)
# 후크 tip: 급경사 걸림면(다운) + 짧은 플랫 끝 — 바늘처럼 뾰족하지 않음 (실사 파란 메모)
LEVER = [(-0.148, 0.090), (-0.142, 0.078), (-0.132, 0.074), (-0.120, 0.084),  # 뭉툭한 한방향 후크
         (0.000, 0.100), (0.096, 0.124), (0.128, 0.140),       # 하변 (우상향 상승)
         (0.154, 0.170), (0.140, 0.196), (0.108, 0.176),       # 다이아몬드 헤드
         (0.000, 0.140), (-0.096, 0.120), (-0.148, 0.112)]     # 상변 복귀
LEVER_PIV = (0.030, -0.064, 0.122)                             # 피벗 핀 위치

def build_lever():
    parts = []
    parts.append(add_plate(LEVER, 0.0064, MAT_LEVER, loc=(0, -0.062, 0), bevel_w=0.0011, name="leverPlate"))
    # 피벗 핀 (대형 크롬 디스크)
    parts.append(add_cyl(0.0165, 0.016, LEVER_PIV, MAT_CHROME, rot=AXROT, verts=24))
    # 헤드 핀 (우상단)
    parts.append(add_cyl(0.0095, 0.015, (0.131, -0.064, 0.180), MAT_CHROME, rot=AXROT, verts=18))
    # 우측 수직 링크 판 + 하단 핀 (영상: 헤드 우측에서 아래로 내려가는 슬림 링크)
    parts.append(add_plate([(-0.012, -0.050), (0.012, -0.050), (0.012, 0.052), (-0.012, 0.052)],
                           0.0055, MAT_LEVER, loc=(0.152, -0.048, 0.120), bevel_w=0.0009, name="sideLink"))
    parts.append(add_cyl(0.0085, 0.014, (0.152, -0.052, 0.072), MAT_CHROME, rot=AXROT, verts=16))
    return join_group(parts, "LeverArm", origin=LEVER_PIV)

# ── 3-4. Spring : 우상단 대각 코일 (내부 로드 + 상단 스터브) ─────────────────
SPR_BASE = (0.146, -0.052, 0.176)
SPR_ANG = math.radians(70)                     # 수직에서 +X쪽으로 70° (=수평 위 20°) — 레버와 일자
SPR_DIR = (math.sin(SPR_ANG), 0, math.cos(SPR_ANG))

def along(base, d, t):
    return (base[0] + d[0] * t, base[1] + d[1] * t, base[2] + d[2] * t)

def build_spring():
    parts = []
    parts.append(add_helix(SPR_BASE, (0, SPR_ANG, 0), MAT_CHROME,
                           coil_r=0.0235, wire=0.0058, turns=7, length=0.082, name="coil"))
    # 내부 가이드 로드 (양단 돌출)
    parts.append(add_cyl(0.006, 0.122, along(SPR_BASE, SPR_DIR, 0.048), MAT_CHROME,
                         rot=(0, SPR_ANG, 0), verts=14))
    # 상단 스터브 + 육각 팁 (영상 우상단 크롬 축)
    parts.append(add_cyl(0.009, 0.026, along(SPR_BASE, SPR_DIR, 0.100), MAT_CHROME,
                         rot=(0, SPR_ANG, 0), verts=16))
    # 끝단 원형 캡 (돔) — 각진 큐브 대신 자연스러운 마감
    parts.append(add_cyl(0.0098, 0.010, along(SPR_BASE, SPR_DIR, 0.112), MAT_CHROME,
                         rot=(0, SPR_ANG, 0), verts=20))
    parts.append(add_ball(0.0098, along(SPR_BASE, SPR_DIR, 0.117), MAT_CHROME))
    # 하단 시트 (레버 헤드 접속)
    parts.append(add_cyl(0.017, 0.010, along(SPR_BASE, SPR_DIR, -0.004), MAT_STEEL,
                         rot=(0, SPR_ANG, 0), verts=18))
    return join_group(parts, "Spring", origin=SPR_BASE)

# ── 3-5. Cover : 좌측 소형 스위치 마운트판 + 하부 반투명 파란 박스 ───────────
# 구 v2.1은 오각판이 스위치 박스 대용으로 너무 컸다(폭 0.118 × 높이 0.188).
# 실물엔 커다란 박스가 아니라 소형 스위치 한 개가 붙으므로 판은 마운트판 크기로 축소하고,
# 스위치 본체는 build_switch()가 따로 만든다.
SW_COVER = [(-0.026, -0.039), (0.024, -0.039), (0.024, 0.024), (0.003, 0.040), (-0.026, 0.030)]

def build_cover():
    parts = []
    # 스위치 마운트판 (불투명 파랑) — 스위치 뒤쪽(+Y)에 두어 스위치를 가리지 않는다
    parts.append(add_plate(SW_COVER, 0.014, MAT_BLUE, loc=(-0.186, -0.010, 0.055),
                           rot=(0, math.radians(12), 0), bevel_w=0.0018, name="switchCover"))
    parts.append(add_ball(0.0042, (-0.170, -0.020, 0.090), MAT_CHROME))
    parts.append(add_ball(0.0042, (-0.202, -0.020, 0.022), MAT_CHROME))
    # 하부 반투명 커버 (휠 중간 높이부터 베이스까지 전폭)
    parts.append(add_box((0.365, 0.026, 0.195), (0.008, -0.072, -0.048), MAT_GLASS))
    # 커버 모서리 나사 4개
    for sx, sz in ((-0.165, 0.038), (0.165, 0.038), (-0.165, -0.130), (0.165, -0.130)):
        parts.append(add_ball(0.005, (sx + 0.008, -0.087, sz), MAT_CHROME))
    return join_group(parts, "Cover")

# ── 3-5b. Switch : 과속 스위치 본체 + 롤러 레버 + 좌측 외면 링크판 ───────────
#   실물 사진(스크린샷 2026-07-27 003308) 기준. v2.1에는 스위치 자체가 없었다.
#   - 스위치: 좌측 하단의 소형 다크 케이스 (구 오각판처럼 큰 박스가 아님)
#   - 롤러 레버: 휠 쪽으로 뻗어 원심추(뭉치) 궤도(r≈0.107)에 물림 → 과속 시 타격
#   - 링크판: 본체 좌측 외면에 붙는 세로 브라켓(사진 파란 표시부). 상·하 꺾임 탭 + 중앙 구멍.
SW_POS = (-0.170, -0.042, 0.055)   # 스위치 케이스 중심
SW_PIVOT = (-0.157, -0.060, 0.089) # 롤러 레버 피벗

def build_switch():
    parts = []
    # 본체 케이스 + 상단 커버 + 명판
    parts.append(add_box((0.034, 0.030, 0.052), SW_POS, MAT_DARK))
    parts.append(add_box((0.034, 0.030, 0.010), (SW_POS[0], SW_POS[1], 0.086), MAT_STEEL))
    parts.append(add_box((0.020, 0.002, 0.028), (SW_POS[0], -0.058, SW_POS[2]), MAT_WHITE))
    # 후면 마운트 브래킷 (마운트판에 물리는 쪽)
    parts.append(add_box((0.014, 0.026, 0.036), (-0.194, SW_POS[1], SW_POS[2]), MAT_STEEL))
    # 롤러 레버 — 피벗에서 휠 쪽(+X)으로 살짝 상향
    parts.append(add_cyl(0.005, 0.014, SW_PIVOT, MAT_CHROME, rot=AXROT, verts=14))
    parts.append(add_box((0.046, 0.007, 0.006), (-0.136, -0.060, 0.092), MAT_LEVER,
                         rot=(0, -math.radians(9), 0)))
    # 롤러 — 원심추가 때리는 지점 (휠 중심에서 r≈0.122, 추 궤도 바로 바깥)
    parts.append(add_cyl(0.009, 0.011, (-0.113, -0.060, 0.096), MAT_BRASS, rot=AXROT, verts=18))
    # 링크판 (좌측 외면 세로 브라켓) — 사진 파란 표시부
    parts.append(add_box((0.008, 0.020, 0.126), (-0.203, -0.032, 0.038), MAT_BRASS))
    parts.append(add_box((0.018, 0.020, 0.009), (-0.210, -0.032, 0.097), MAT_BRASS))  # 상단 꺾임 탭
    parts.append(add_box((0.018, 0.020, 0.009), (-0.210, -0.032, -0.021), MAT_BRASS)) # 하단 꺾임 탭
    parts.append(add_cyl(0.0045, 0.012, (-0.203, -0.032, 0.040), MAT_DARK,
                         rot=(0, math.pi / 2, 0), verts=14))                          # 중앙 구멍
    for bz in (0.042, -0.010):                                                        # 고정 볼트 2개 (측판에 물림)
        parts.append(add_cyl(0.004, 0.014, (-0.200, -0.032, bz), MAT_CHROME,
                             rot=(0, math.pi / 2, 0), verts=12))
    # 링크 로드 — 링크판 ↔ 스위치 레버 연결 (얘가 스위치를 친다)
    parts.append(add_cyl(0.0035, 0.048, (-0.180, -0.050, 0.106), MAT_CHROME,
                         rot=(0, math.pi / 2, 0), verts=12))
    return join_group(parts, "Switch", origin=SW_POS)

# ── 3-6. BaseFrame : 파란 베이스 + 중앙 마운트판/육각볼트 + 로프 2줄 ─────────
def rope_strands(x, z0, z1, phase0=0.0):
    """3-스트랜드 꼬임 와이어 로프 (수직)."""
    objs = []
    L = z1 - z0
    for si in range(3):
        ph = phase0 + si * 2.0 * math.pi / 3.0
        cdata = bpy.data.curves.new("strand", type='CURVE')
        cdata.dimensions = '3D'
        cdata.bevel_depth = 0.0026
        cdata.bevel_resolution = 3
        sp = cdata.splines.new('POLY')
        n = 90
        sp.points.add(n - 1)
        for i in range(n):
            t = i / (n - 1)
            a = ph + t * L * 55.0          # 꼬임 피치
            sp.points[i].co = (x + 0.0032 * math.cos(a), 0.0032 * math.sin(a), z0 + L * t, 1.0)
        o = bpy.data.objects.new("strand", cdata)
        bpy.context.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH')
        objs.append(_finish(MAT_ROPE, smooth=True))
    return objs

def build_base():
    parts = []
    # 베이스 본체 (파란 박스) — 로프가 관통하는 구멍 2개를 실제로 뚫는다 (사용자 지시:
    #   "여기다 구멍을 뚫어줘"). 로프는 x = ±R_ROPE 에서 Z축으로 내려간다.
    body = add_box((0.385, 0.155, 0.150), (0.0, 0.008, -0.190), MAT_BLUE)
    for hx in (-R_ROPE, R_ROPE):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.017, depth=0.30,
                                            location=(hx, 0.008, -0.190))
        cutter = bpy.context.active_object
        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        md = body.modifiers.new("ropehole", 'BOOLEAN')
        md.operation = 'DIFFERENCE'
        md.object = cutter
        bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    parts.append(body)
    # 구멍 테두리 부싱 (구멍이 뚫린 게 눈에 띄게)
    for hx in (-R_ROPE, R_ROPE):
        parts.append(add_ring(0.024, 0.017, 0.008, (hx, 0.008, -0.111), MAT_STEEL, verts=24))
    # 하단 플랜지
    parts.append(add_box((0.425, 0.175, 0.016), (0.0, 0.008, -0.268), MAT_BLUE))
    # 좌우 측판 (휠 하부 감쌈)
    parts.append(add_box((0.020, 0.120, 0.210), (-0.188, -0.006, -0.055), MAT_BLUE))
    parts.append(add_box((0.020, 0.120, 0.210), (0.188, -0.006, -0.055), MAT_BLUE))
    # 전면 볼트 3개
    for bx in (-0.125, 0.0, 0.125):
        parts.append(add_cyl(0.0055, 0.012, (bx, -0.074, -0.155), MAT_CHROME, rot=AXROT, verts=12))
    # 중앙 마운트판 (회색) — 휠 전면
    parts.append(add_box((0.088, 0.013, 0.118), (0.004, -0.036, 0.022), MAT_STEEL))
    # 육각볼트 2개 수직 배치 (상=축 너트 z=0.05, 하) + 블랙 코어 + 소형 나사
    for hz, hr in ((0.050, 0.0215), (-0.012, 0.0195)):
        parts.append(add_cyl(hr, 0.022, (0.0, -0.048, hz), MAT_CHROME, rot=AXROT, verts=6, smooth=False))
        parts.append(add_cyl(hr * 0.52, 0.024, (0.0, -0.049, hz), MAT_DARK, rot=AXROT, verts=18))
    parts.append(add_ball(0.005, (0.014, -0.046, 0.020), MAT_CHROME))
    # ★로프는 .glb에 넣지 않는다 (v2.5, 사용자 지시).
    #   예전엔 여기서 좌우 로프 2줄(z -0.275~0.052)과 시브 홈 위 로프 링을 같이 구웠는데,
    #   js/environment.js 가 조속기~피트 인장시브 전 구간을 실사 로프 메시로 그리게 되면서
    #   같은 자리에 로프가 두 겹이 됐다. .glb 쪽은 35cm 토막이라 잘린 검은 호스처럼 보였다.
    #   로프는 승강로 길이에 맞춰 런타임에 그려야 하므로 .glb가 아니라 environment.js 담당이다.
    #   (rope_strands() 헬퍼는 남겨둔다 — 나중에 정지 컷용 .glb가 필요할 때 쓸 수 있다.)
    return join_group(parts, "BaseFrame")

pulley = build_pulley()
cam    = build_cam()
pend   = build_pendulum()
pawl   = build_pawl()
lever  = build_lever()
spring = build_spring()
cover  = build_cover()
switch = build_switch()
base   = build_base()

# =============================================================================
#  4. .glb 내보내기 (glTF Binary, Y-up)
# =============================================================================
def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
    )
    print("[overspeed_governor v2.3] 내보내기 완료:", path)

export_glb(OUTPUT_PATH)
print("완료 — 오브젝트:", sorted(o.name for o in bpy.data.objects))
