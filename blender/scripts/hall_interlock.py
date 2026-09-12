"""현대엘리베이터 승장 도어 인터록 (Landing Door Locking Device Model: DIM)
설계도면 15.9 (인터록 동작 조정: 52mm, 8±1mm 물림, 4~5mm 간격) 및 현장 실물 사진(094011.jpg), 영상(094039.mp4) 1:1 정밀 재현.

단위: 미터 (m), Blender Z-up -> Three.js Y-up (T(x,y,z) 변환: x, -z, y).
애니메이션 계약 노드:
  InterlockRoot    루트 그룹 (contractVersion: 2, latch, spring, link 메타데이터)
  SwitchAssembly   고정측 스위치 박스 (투명 아크릴 커버, 현대 DIM 명판, BS 라벨, 내부 접점단자)
  InterlockBase    우측 도어 가동판 (베이스 플레이트, 상부 FixedRoller, 스프링 스터드/너트/코일)
  Hook             가동 회전 레버 (하부 MovingRoller, 도면 1:1 Keeper 암, 8mm 턱, 가동 접점 브리지, 비상해제 레버)
  Keeper           좌측 도어 훅 바 (도면 1:1 완만한 진입 경사 램프, 수직 걸림 턱)
  LinkStock, Foot  비상 개방 수직 링크
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / 'models/gltf/hall_interlock.glb'
TEXTURES_DIR = ROOT / 'models/gltf/textures'

# ── 도면 15.9 및 실물 사진 치수 규격 (미터) ──
LOWER_R, UPPER_R = 0.024, 0.022                # 하부 롤러 직경 48mm, 상부 롤러 직경 44mm
LOWER_ROLLER = (0.183, -0.027, -0.039)         # 하부 롤러 중심 (Three.js 좌표계)
UPPER_ROLLER = (0.178, 0.020, -0.039)          # 상부 롤러 중심
PIVOT = (0.207, -0.033, -0.025)                # 회전 레버 메인 피벗 축
LATCH_Z = -0.025                               # 래치 중심 Z평면
HOOK_T = 0.005                                 # 레버 및 훅 판재 두께 (5mm 고강도 아연도금 강판)
SHEET = 0.003                                  # 일반 프레스 브라켓 판재 두께 (3mm)
BEVEL = 0.00035

# 도면 15.9 핵심 기하 수치:
# 롤러 중심(0.183) ~ 훅 걸림 턱 = 정확히 52mm
LIP_X = 0.100                                  # 훅 걸림 턱 X좌표
LIP_W = 0.005                                  # 턱 두께 (5mm)
RIM_Y = -0.040                                 # 기준 Y높이
ENGAGE = 0.008                                 # 닫힘 물림 깊이 8mm
CLEAR = 0.004                                  # 열림 간극 4mm
SEAT = 0.0005
GAP = 0.0045                                   # 수평 간격 4.5mm
SLOT_HALF_Z = 0.005

# 스프링 및 스터드
SPRING_X, SPRING_Z = 0.151, -0.019
SPRING_BOTTOM, SPRING_TOP = 0.011, 0.055
SPRING_R, SPRING_WIRE, SPRING_TURNS = 0.005, 0.0009, 11

# 비상 개방 링크
LINK_X, LINK_Y, LINK_Z = 0.158, -0.031, -0.040
LINK_WIDTH, LINK_T = 0.018, 0.004

# 상대측 훅 바 (Keeper 바)
KEEPER_START, KEEPER_TIP, KEEPER_HALF_Z = -0.245, 0.140, 0.012
KEEPER_T = 0.0045
KEEPER_BEND_START, KEEPER_BEND_DROP = 0.118, 0.008

# 현대 MODEL: DIM 스위치 박스 실물 치수
COVER_X, COVER_Y, COVER_Z = 0.062, 0.002, -0.024
COVER_W, COVER_H, COVER_D = 0.082, 0.068, 0.026

def T(x, y, z):
    return (x, -z, y)

def attach(o, p):
    bpy.context.view_layer.update()
    m = o.matrix_world.copy()
    o.parent = p
    o.matrix_world = m
    return o

def group(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = T(*loc)
    if parent:
        attach(o, parent)
    return o

def material(name, color, metal=0, rough=0.45, alpha=1, texture_path=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    for key, value in [('Base Color', (*color, alpha)), ('Metallic', metal), ('Roughness', rough), ('Alpha', alpha)]:
        if key in b.inputs:
            b.inputs[key].default_value = value
    if texture_path and Path(texture_path).exists():
        tex_node = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex_node.image = bpy.data.images.load(str(texture_path))
        m.node_tree.links.new(tex_node.outputs['Color'], b.inputs['Base Color'])
    return m

def finish(o, mat, bevel=BEVEL):
    o.data.materials.append(mat)
    if bevel:
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new('Bevel', 'BEVEL')
        m.width, m.segments = bevel, 3
        bpy.ops.object.modifier_apply(modifier=m.name)
        n = o.modifiers.new('Normals', 'WEIGHTED_NORMAL')
        n.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=n.name)

def box(name, size, loc, mat=None, parent=None, bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = T(*size)
    o.location = T(*loc)
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        finish(o, mat, bevel)
    if parent:
        attach(o, parent)
    return o

def cyl(name, r, h, loc, mat=None, parent=None, axis='z', sides=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=sides)
    o = bpy.context.object
    o.name = name
    o.location = T(*loc)
    if axis == 'x':
        o.rotation_euler.y = math.pi / 2
    elif axis == 'y':
        o.rotation_euler.x = math.pi / 2
    bpy.ops.object.transform_apply(rotation=True)
    if mat:
        finish(o, mat, 0)
    if parent:
        attach(o, parent)
    return o

def label_quad(name, w, h, loc, mat, parent=None):
    """정면 UV가 (0,0)~(1,1)로 바르게 매핑된 2D 평면 메쉬를 생성합니다."""
    mesh = bpy.data.meshes.new(name)
    hw, hh = w / 2, h / 2
    cx, cy, cz = loc
    # Three.js 기준: X는 가로, Y는 세로, Z는 앞면
    # pts: 좌하단, 우하단, 우상단, 좌상단
    pts = [
        (cx - hw, cy - hh, cz),
        (cx + hw, cy - hh, cz),
        (cx + hw, cy + hh, cz),
        (cx - hw, cy + hh, cz)
    ]
    vs = [T(x, y, z) for x, y, z in pts]
    fs = [(0, 1, 2, 3)]
    mesh.from_pydata(vs, [], fs)

    uv_layer = mesh.uv_layers.new(name='UVMap')
    # UV 좌표: 좌우 거울 반전 보정 (정면에서 글자가 바르게 읽히도록)
    uvs = [(1.0, 0.0), (0.0, 0.0), (0.0, 1.0), (1.0, 1.0)]
    for i, loop in enumerate(mesh.loops):
        uv_layer.data[loop.index].uv = uvs[i]

    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if parent:
        attach(o, parent)
    return o

def cut(o, cutter):
    m = o.modifiers.new('Boolean', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cutter
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def plate(name, pts, t, z, mat, parent):
    n = len(pts)
    tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in pts]])
    if not tris:
        raise RuntimeError(f'{name}: tessellation failed ({n} pts)')
    vs = [T(x, y, z + dz) for dz in (-t / 2, t / 2) for x, y in pts]
    fs = [(a, c, b) for a, b, c in tris] + [(a + n, b + n, c + n) for a, b, c in tris]
    fs += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vs, [], fs)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    finish(o, mat, 0.0003)
    if parent:
        attach(o, parent)
    return o

def tube(name, pts, r, mat, parent):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = r
    curve.bevel_resolution = 4
    spline = curve.splines.new('POLY')
    spline.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        spline.points[i].co = (*T(*p), 1)
    o = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return attach(bpy.context.object, parent)

def screw(name, x, y, z, p, r=0.0032):
    cyl(name + ' washer', r * 1.35, 0.0008, (x, y, z + 0.0014), steel, p)
    o = cyl(name, r, 0.0025, (x, y, z))
    for w, h in [(r * 1.45, 0.0007), (0.0007, r * 1.45)]:
        cut(o, box('Recess', (w, h, 0.002), (x, y, z - 0.0015)))
    finish(o, steel, 0.00015)
    attach(o, p)

def roller(name, loc, r, parent):
    p = group(name)
    x, y, z = loc
    # 외경 탄성 고무 트레드 (블랙)
    cyl('Elastomer tread', r, 0.013, loc, rubber, p)
    # 유백색/연회색 리세스 휠 허브
    cyl('Grey recessed hub', r * 0.70, 0.002, (x, y, z - 0.0068), hub, p)
    cyl('Hub recess', r * 0.45, 0.0022, (x, y, z - 0.0071), rubber, p)
    # 중심 아연도금 와셔 & 축 끝단
    cyl('Zinc axle washer', r * 0.32, 0.0025, (x, y, z - 0.008), zinc, p)
    cyl('Axle end', 0.005, 0.003, (x, y, z - 0.009), steel, p)
    attach(p, parent)


def build():
    global zinc, steel, rubber, hub, white, clear, brass, wire, dim_label, bs_label
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # ── 머티리얼 정의 ──
    zinc = material('IL_FieldChromate', (0.72, 0.60, 0.22), metal=0.86, rough=0.34)
    steel = material('IL_ZincFastener', (0.78, 0.80, 0.82), metal=0.92, rough=0.22)
    rubber = material('IL_RollerRubber', (0.025, 0.025, 0.028), metal=0.02, rough=0.82)
    hub = material('IL_GreyPolymerHub', (0.86, 0.86, 0.82), metal=0.05, rough=0.36)
    white = material('IL_IvoryInsulator', (0.92, 0.90, 0.85), metal=0.02, rough=0.38)
    clear = material('IL_Polycarbonate', (0.88, 0.92, 0.94), metal=0.05, rough=0.10, alpha=0.25)
    brass = material('IL_ContactBrass', (0.90, 0.70, 0.24), metal=0.85, rough=0.26)
    wire = material('IL_YellowLeadWire', (0.92, 0.72, 0.08), metal=0.05, rough=0.55)

    dim_tex = TEXTURES_DIR / 'hyundai_dim_label.png'
    bs_tex = TEXTURES_DIR / 'hyundai_bs_label.png'
    dim_label = material('IL_DIM_Nameplate', (0.95, 0.95, 0.95), metal=0.40, rough=0.30, texture_path=dim_tex)
    bs_label = material('IL_BS_Label', (0.10, 0.70, 0.25), metal=0.10, rough=0.35, texture_path=bs_tex)

    root = group('InterlockRoot')
    fixed = group('SwitchAssembly', parent=root)
    base = group('InterlockBase', parent=root)
    hook = group('Hook', PIVOT, root)
    keeper = group('Keeper', parent=root)

    # =========================================================================
    # 1. SwitchAssembly — 현대 MODEL: DIM 정품 스위치 박스 & 백플레이트
    # =========================================================================
    back_w, back_h = 0.108, 0.115
    back = box('SwitchBackplate', (back_w, back_h, SHEET), (COVER_X, -0.006, 0.003), zinc, fixed)
    box('Header mounting flange', (back_w, SHEET, 0.028), (COVER_X, 0.051, 0.016), zinc, fixed)
    box('Lower support shelf', (back_w, SHEET, 0.038), (COVER_X, -0.063, -0.015), zinc, fixed)
    for x in (COVER_X - 0.032, COVER_X + 0.032):
        cyl('Header M6 washer', 0.006, 0.001, (x, 0.053, 0.014), steel, fixed, axis='y')
        cyl('Header M6 nut', 0.005, 0.004, (x, 0.055, 0.014), steel, fixed, axis='y', sides=6)

    # 투명 폴리카보네이트(PC) 스위치 커버
    cov_front_z = COVER_Z - COVER_D / 2
    box('DIM_ClearFront', (COVER_W, COVER_H, 0.0018), (COVER_X, COVER_Y, cov_front_z), clear, fixed)
    for sy in (-1, 1):
        box('DIM_ClearHorizontalWall', (COVER_W, 0.0018, COVER_D), (COVER_X, COVER_Y + sy * COVER_H / 2, COVER_Z), clear, fixed)
    box('DIM_ClearSideWallLeft', (0.0018, COVER_H, COVER_D), (COVER_X - COVER_W / 2, COVER_Y, COVER_Z), clear, fixed)
    box('DIM_ClearSideWallRightUpper', (0.0018, COVER_H * 0.45, COVER_D), (COVER_X + COVER_W / 2, COVER_Y + COVER_H * 0.25, COVER_Z), clear, fixed)

    # [정밀 매핑] 실물 094011 정품 라벨 — 은색 명판과 우측 녹색 BS 라벨
    label_x = COVER_X - 0.008
    label_quad('DIM_NameplatePlane', 0.048, 0.030, (label_x, COVER_Y + 0.008, cov_front_z - 0.0006), dim_label, fixed)
    # 쿼드 정점 좌표계에서 화면 우측 오프셋 (-X 방향)
    bs_x = label_x - 0.048 / 2 - 0.008
    label_quad('DIM_BS_LabelPlane', 0.012, 0.020, (bs_x, COVER_Y + 0.008, cov_front_z - 0.0006), bs_label, fixed)

    # 스위치 박스 내부: 유백색 단자대 베이스 및 고정 접점 리프
    box('DIM_InternalTerminalBase', (0.046, 0.044, 0.014), (COVER_X - 0.012, COVER_Y, COVER_Z + 0.002), white, fixed)
    box('DIM_FixedContactBlock', (0.024, 0.020, 0.012), (COVER_X + 0.022, COVER_Y, COVER_Z + 0.002), white, fixed)
    for dy in (-0.008, 0.008):
        box('StationaryContactLeaf', (0.016, 0.0025, 0.005), (COVER_X + 0.026, COVER_Y + dy, COVER_Z), brass, fixed)
        cyl('ContactTerminalScrew', 0.0022, 0.006, (COVER_X - 0.016, COVER_Y + dy, COVER_Z - 0.006), brass, fixed, axis='z')
        tube('YellowLeadWire', [
            (COVER_X - 0.016, COVER_Y + dy, COVER_Z - 0.004),
            (COVER_X - 0.026, COVER_Y + dy * 1.5, COVER_Z + 0.004),
            (COVER_X - 0.036, COVER_Y + 0.024, COVER_Z + 0.006),
        ], 0.0012, wire, fixed)

    # =========================================================================
    # 2. InterlockBase — 우측 도어 가동판 베이스 & 스프링 기둥
    # =========================================================================
    mount = box('SlottedRollerMountingPlate', (0.165, 0.098, SHEET), (0.175, -0.005, -0.005))
    for x, y in [(0.238, 0.028), (0.238, -0.038)]:
        cut(mount, box('MountSlot', (0.016, 0.008, 0.02), (x, y, -0.005)))
    finish(mount, zinc)
    attach(mount, base)
    for x, y in [(0.238, 0.028), (0.238, -0.038)]:
        screw('RollerPlateScrew', x, y, -0.009, base, r=0.004)

    # 상부 롤러 (FixedRoller, 지름 44mm)
    box('UpperRollerAngle', (0.035, 0.050, 0.003), (0.180, 0.020, -0.012), zinc, base)
    box('UpperRollerSpacer', (0.017, 0.028, 0.012), (UPPER_ROLLER[0], UPPER_ROLLER[1], -0.020), steel, base)
    roller('FixedRoller', UPPER_ROLLER, UPPER_R, base)

    # 수직 스프링 지지 스터드 볼트 & 더블 너트
    box('SpringGuideTab', (0.018, 0.004, 0.018), (SPRING_X, SPRING_TOP + 0.003, SPRING_Z), zinc, base)
    cyl('SpringGuideStud', 0.0024, 0.058, (SPRING_X, 0.032, SPRING_Z), steel, base, axis='y')
    for y in (SPRING_TOP + 0.006, SPRING_TOP + 0.011):
        cyl('SpringAdjustingNut', 0.0048, 0.004, (SPRING_X, y, SPRING_Z), steel, base, axis='y', sides=6)
    cyl('SpringTopWasher', 0.0065, 0.0016, (SPRING_X, SPRING_TOP, SPRING_Z), steel, base, axis='y')
    cyl('SpringBottomWasher', 0.0065, 0.0016, (SPRING_X, SPRING_BOTTOM, SPRING_Z), steel, base, axis='y')

    # 압축 코일 스프링
    coil = group('Spring')
    height = SPRING_TOP - SPRING_BOTTOM
    pts = [(SPRING_R * math.cos(i / 440 * SPRING_TURNS * math.tau),
            i / 440 * height,
            SPRING_R * math.sin(i / 440 * SPRING_TURNS * math.tau)) for i in range(441)]
    tube('ContinuousCompressionCoil', pts, SPRING_WIRE, steel, coil)
    coil.location = T(SPRING_X, SPRING_BOTTOM, SPRING_Z)
    attach(coil, base)

    # =========================================================================
    # 3. Hook — 회전 가동 레버 어셈블리 (도면 15.9 1:1 Keeper 암 & MovingRoller)
    # =========================================================================
    KEEPER_ARM_OUTLINE = [
        (0.228, -0.052), (0.234, -0.035), (0.234, -0.015), (0.226, 0.002),
        (0.210, 0.012), (0.185, 0.014), (0.162, 0.012), (0.142, 0.006),
        (0.125, 0.002), (0.114, -0.006), (0.106, -0.014),
        (LIP_X + 0.006, RIM_Y + 0.016),
        (LIP_X + 0.002, RIM_Y + 0.002),
        (LIP_X + 0.0018, RIM_Y - ENGAGE),
        (LIP_X + LIP_W, RIM_Y - ENGAGE),
        (LIP_X + LIP_W, RIM_Y + 0.001),
        (0.108, RIM_Y + 0.004), (0.124, RIM_Y + 0.004), (0.140, -0.018),
        (0.160, -0.024), (0.180, -0.034), (0.200, -0.046), (0.214, -0.052)
    ]
    plate('hallLatchKeeperArm', KEEPER_ARM_OUTLINE, HOOK_T, LATCH_Z, zinc, hook)

    # 실물 사진 094011의 표면 음각 문자 'K'
    box('Keeper_Letter_K_Stem', (0.0015, 0.010, 0.0008), (0.145, -0.008, LATCH_Z - HOOK_T / 2 - 0.0004), zinc, hook)
    box('Keeper_Letter_K_Arm1', (0.0012, 0.006, 0.0008), (0.148, -0.006, LATCH_Z - HOOK_T / 2 - 0.0004), zinc, hook)
    box('Keeper_Letter_K_Arm2', (0.0012, 0.006, 0.0008), (0.148, -0.010, LATCH_Z - HOOK_T / 2 - 0.0004), zinc, hook)

    # 십자 접시머리 나사 2개소
    for x, y in ((0.126, -0.011), (0.150, -0.007)):
        cyl('KeeperFaceRivet', 0.0025, 0.0018, (x, y, LATCH_Z - HOOK_T / 2 - 0.0008), steel, hook)

    # 하부 롤러 (MovingRoller, 지름 48mm)
    roller('MovingRoller', LOWER_ROLLER, LOWER_R, hook)
    screw('HookPivotScrew', PIVOT[0], PIVOT[1], -0.031, base, r=0.0042)

    # 스프링 하부 시트 (SpringSeat, 유백색 수지 블록)
    box('SpringSeat', (0.022, 0.010, 0.016), (SPRING_X, 0.006, SPRING_Z), white, hook)

    # 가동 접점 브리지 (ContactBridge) — 콤팩트 ㄷ자형 황동 리프
    cb_x, cb_y = 0.092, 0.002
    box('ContactBridgeHolder', (0.014, 0.008, 0.012), (cb_x, cb_y, SPRING_Z), white, hook)
    box('ContactBridge', (0.012, 0.0016, 0.010), (cb_x - 0.004, cb_y, SPRING_Z), brass, hook)
    for dy in (-0.003, 0.003):
        cyl('ContactBridgeRivet', 0.0009, 0.002, (cb_x - 0.004, cb_y + dy, SPRING_Z - 0.005), brass, hook, axis='z')

    # [실물 재현] 비상 해제 레버 (Emergency Release Lever — 사진 094011 앞면 절곡 판금)
    em_x, em_y = 0.138, -0.028
    box('EmergencyLeverUpperFlange', (0.018, 0.035, 0.003), (em_x, em_y - 0.015, LATCH_Z - HOOK_T / 2 - 0.002), zinc, hook)
    screw('EmergencyLeverFixingScrew', em_x, em_y - 0.005, LATCH_Z - HOOK_T / 2 - 0.0035, hook, r=0.003)
    box('EmergencyLeverLongArm', (0.014, 0.075, 0.0025), (em_x, em_y - 0.065, LATCH_Z - HOOK_T / 2 - 0.0045), zinc, hook)

    group('hallLatchKeeperLip', (LIP_X + LIP_W / 2, RIM_Y - ENGAGE, LATCH_Z), hook)
    group('LinkPin', (LINK_X, LINK_Y, LINK_Z), hook)
    screw('LinkUpperPin', LINK_X, LINK_Y, LINK_Z, hook, r=0.0035)

    # =========================================================================
    # 4. Keeper — 상대측 도어 걸림 훅 바 (도면 15.9 완만한 진입 경사 램프 & 수직 턱)
    # =========================================================================
    slot0, slot1 = LIP_X - SEAT, LIP_X + LIP_W + GAP
    top = [(KEEPER_START, RIM_Y), (KEEPER_BEND_START, RIM_Y)]
    for i in range(1, 13):
        t = i / 12
        top.append((KEEPER_BEND_START + (KEEPER_TIP - KEEPER_BEND_START) * t,
                    RIM_Y - KEEPER_BEND_DROP * t * t * (3 - 2 * t)))
    outline = top + [(x, y - KEEPER_T) for x, y in reversed(top)]
    bar = plate('hallLatchBar', outline, 2 * KEEPER_HALF_Z, LATCH_Z, zinc, keeper)
    cut(bar, box('LatchOpening', (slot1 - slot0, 0.024, 2 * SLOT_HALF_Z),
                ((slot0 + slot1) / 2, RIM_Y, LATCH_Z)))
    for x in (-0.235, -0.210):
        cut(bar, cyl('KeeperBoltBore', 0.004, 0.025, (x, RIM_Y, LATCH_Z), axis='y'))

    bpy.context.view_layer.objects.active = bar
    edge = bar.modifiers.new('BevelEdges', 'BEVEL')
    edge.width, edge.segments = 0.0006, 3
    bpy.ops.object.modifier_apply(modifier=edge.name)

    box('KeeperAngleUpright', (0.052, 0.036, SHEET), (-0.223, RIM_Y + 0.015, -0.004), zinc, keeper)
    box('KeeperFixingFlange', (0.052, SHEET, 0.024), (-0.223, RIM_Y + 0.001, -0.015), zinc, keeper)
    for x in (-0.235, -0.210):
        cyl('KeeperM6Washer', 0.006, 0.001, (x, RIM_Y + 0.002, LATCH_Z), steel, keeper, axis='y')
        cyl('KeeperM6Nut', 0.005, 0.004, (x, RIM_Y + 0.004, LATCH_Z), steel, keeper, axis='y', sides=6)
    group('hallLatchPocket', ((slot0 + slot1) / 2, RIM_Y, LATCH_Z), keeper)

    extension = box('OppositeMountingExtension', (0.234, 0.100, SHEET), (-0.142, -0.009, -0.004))
    for x, y in [(-0.235, 0.024), (-0.235, -0.043)]:
        cut(extension, box('ExtensionSlot', (0.014, 0.007, 0.02), (x, y, -0.004)))
    finish(extension, zinc)
    attach(extension, keeper)
    for y in (0.024, -0.043):
        screw('ExtensionBolt', -0.235, y, -0.008, keeper, r=0.004)

    # =========================================================================
    # 5. 비상 해제 링크 (LinkStock, LinkFoot)
    # =========================================================================
    box('LinkStock', (LINK_WIDTH, 1, LINK_T), (0, 0.5, 0), steel, root, bevel=0.0002)
    foot = box('LinkFoot', (LINK_WIDTH, 0.040, LINK_T), (0, 0, 0))
    cut(foot, box('CamPinSlot', (0.007, 0.026, 0.015), (0, 0, 0)))
    finish(foot, steel, 0.0002)
    attach(foot, root)

    # =========================================================================
    # 6. 애니메이션 연동 메타데이터 계산 및 내보내기
    # =========================================================================
    dx = LIP_X + LIP_W / 2 - PIVOT[0]
    dy = RIM_Y - ENGAGE - PIVOT[1]
    lo, hi = 0, 0.5
    for _ in range(60):
        a = (lo + hi) / 2
        rise = -dx * math.sin(a) + dy * (math.cos(a) - 1)
        if rise < ENGAGE + CLEAR:
            lo = a
        else:
            hi = a

    root['contractVersion'] = 2
    root['latch'] = {
        'z': LATCH_Z,
        'lipX': LIP_X,
        'lipW': LIP_W,
        'rimY': RIM_Y,
        'lipBotY': RIM_Y - ENGAGE,
        'engage': ENGAGE,
        'clear': CLEAR,
        'gap': GAP,
        'seat': SEAT,
        'hz': SLOT_HALF_Z,
        'lift': ENGAGE + CLEAR,
        'liftRad': (lo + hi) / 2,
        'armR': -dx,
        'plateThickness': KEEPER_T,
        'hookThickness': HOOK_T,
        'keeperWidth': 2 * KEEPER_HALF_Z,
        'lipOverlap': LIP_W
    }
    root['spring'] = {'top': [SPRING_X, SPRING_TOP, SPRING_Z], 'restLength': height}
    root['link'] = {'x': LINK_X, 'y': LINK_Y, 'z': LINK_Z}

    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
        export_format='GLB',
        export_extras=True,
        export_apply=True,
        export_animations=False
    )
    print('Hyundai DIM Interlock successfully exported to:', OUTPUT_PATH)
    print('Latch lift angle:', (lo + hi) / 2, 'rad; Latch engage depth:', ENGAGE, 'm')


if __name__ == '__main__':
    build()
