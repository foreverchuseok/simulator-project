"""SICON-4000형 기계실 제어반 — 양문형 캐비닛 (일본 수출형 사진 122351의 구조, 일본어 표기는 전부 제외).
참고: 122351(양문 열린 모습·긴 피아노 경첩) · 122259(내부 배치) · 121746(측면 인터폰) · 122829(상부 저항함 타공)
      · 122800(정면 손잡이·명판) · Unity 교육 영상 프레임(점검 버튼 열·기판·덕트).
좌표는 Three.js 로컬(+Y 위, +Z 문 전면, 원점 = 바닥 중심)로 적고 메시 생성 때 Blender(x, -z, y)로 옮기며 SPEC.scale 을 곱한다.
보드부는 실제 SICON 사진 1595633541508·1595633545432, 아래 마그네틱은 1595633544204 를 따른다.
치수 원본은 js/control-panel.js 의 CONTROL_PANEL_SPEC 한 줄이다.
노드: ControlPanel(extras) > CabinetBody · CabinetInterior · DoorLeft(피벗=좌측 경첩축) · DoorRight(피벗=우측 경첩축).
실행: blender -b -P blender/scripts/control_panel_sicon.py
"""
import bpy, json, math, re, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads(re.search(r'const CONTROL_PANEL_SPEC = (\{.*?\});',
                            (ROOT / 'js/control-panel.js').read_text(encoding='utf-8'))[1])
# 축별 축척 [x폭, y높이, z깊이] — 설계치수는 1.0 기준으로 적고 내보낼 때 곱한다(2차 80% → 3차 폭 +5%·높이 80%).
NS = Vector(SPEC['scale'])
SU = NS.x                             # 둥근 부품·글자의 균일 축척(찌그러짐 방지)
RIGID = []                            # rigid() 안에서는 기준점만 옮기고 모양은 지정 축척 그대로
W, D = SPEC['width'], SPEC['depth']
BASE_H, BODY_H = SPEC['baseH'], SPEC['bodyH']
TOP_Y = BASE_H + BODY_H
RES_W, RES_D, RES_H = SPEC['resistor']
SHEET = .0016                        # 강판 두께
TOP_RAIL, BOT_RAIL = .075, .030       # 문 위 헤더(명칭·비상정지) / 문 아래 턱
DOOR_T = .022                         # 문짝 두께(절곡 리턴 포함)
DOOR_GAP = .003                       # 가운데 맞댐 틈
HINGE_R = .0055                       # 피아노 경첩 너클 반경
HINGE_X = W / 2 + .002                # 경첩축 |x|
HINGE_Z = D / 2 + .002                # 경첩축 z
DOOR_Y0, DOOR_Y1 = BASE_H + BOT_RAIL + .002, TOP_Y - TOP_RAIL - .002
PLATE_Z = -D / 2 + .028               # 내부 취부판 앞면
# 235516 사진 배치: LCD CPU → 전원/I/O → 운전·바이패스 판넬.
CPU_X = -.215
IO_X, IO_W = -.0025, .195
SW_X, SW_Y, SW_W, SW_H = .225, 1.23, .20, .46
FONT = bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
BOLD = bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')
rng = random.Random(4000)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for item in list(block): block.remove(item)

# ── 재질 (sRGB 16진 → 선형) ────────────────────────────────────────────
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)
MATS = {}
def mat(name, hexcol, metal=0., rough=.6, emit=0.):
    if name in MATS: return name
    m = bpy.data.materials.new('CP_' + name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*lin(hexcol), 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*lin(hexcol), 1)
        p.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return name
PAINT = mat('Paint', '#c3c8b2', 0, .55)           # 연녹회색 분체도장 (사진 122829·122800)
PAINT_D = mat('PaintBase', '#8d917e', 0, .6)
PLATE = mat('MountPlate', '#e4e5dc', 0, .6)
PERF = mat('ResistorCover', '#d5d8d1', 0, .55)
DARK = mat('Dark', '#232527', 0, .7)
STEEL = mat('Steel', '#b9bcbd', .85, .32)
CHROME = mat('Chrome', '#d2d5d8', .95, .2)
RUBBER = mat('Rubber', '#1b1c1d', 0, .9)
PCB = mat('PCB', '#1f6a3b', 0, .45)
PCB_Y = mat('PCBYellow', '#c8b43c', 0, .5)
CHIP = mat('Chip', '#18191b', 0, .4)
WHITE = mat('WhitePlastic', '#eeeee8', 0, .45)
GREY = mat('GreyPlastic', '#8e9396', 0, .5)
FACE = mat('DeviceFace', '#5b6065', 0, .5)
BLUE = mat('Blue', '#2c5fb8', 0, .45)
RED = mat('Red', '#cf2a22', 0, .4)
GREEN = mat('Green', '#2a9d49', 0, .4)
YELLOW = mat('Yellow', '#f4c81f', 0, .5)
LCD = mat('LCD', '#b8d24a', 0, .3, .6)
LED_R = mat('LedRed', '#ff3b2e', 0, .3, 2.)
LED_G = mat('LedGreen', '#3dff6a', 0, .3, 2.)
CAP = mat('Capacitor', '#1f2742', 0, .35)
WIRE_Y = mat('WireYellow', '#e3bd24', 0, .5)
WIRE_R = mat('WireRed', '#c2372e', 0, .5)
WIRE_K = mat('WireBlack', '#222426', 0, .55)
WIRE_B = mat('WireBlue', '#2f5ec4', 0, .5)
PAPER = mat('Paper', '#f6f5ef', 0, .85)
INK = mat('Ink', '#151515', 0, .8)
CERAMIC = mat('Ceramic', '#ecebe3', 0, .6)
COPPER = mat('Winding', '#8a5a2b', .6, .45)
BRASS = mat('LatchBrass', '#b9a04c', .8, .35)

# ── 메시 버킷: (그룹, 재질) → 정점·면 (Three 좌표) ─────────────────────
BUCKETS = {}
PIVOT = {'CabinetBody': Vector((0, 0, 0)), 'CabinetInterior': Vector((0, 0, 0)),
         'DoorLeft': Vector((-HINGE_X, 0, HINGE_Z)), 'DoorRight': Vector((HINGE_X, 0, HINGE_Z))}
def bucket(group, m):
    return BUCKETS.setdefault((group, m), {'v': [], 'f': []})
def keep_shape(verts, c=None, s=None):
    """축마다 축척이 달라도 모양을 지킨다: 최종 = s·(v − c) + NS·c (c 기본 = 부품 중심)."""
    if c is None: c = sum(verts, Vector()) / len(verts)
    s = SU if s is None else s
    return [Vector(((s * (v.x - c.x)) / NS.x + c.x, (s * (v.y - c.y)) / NS.y + c.y, (s * (v.z - c.z)) / NS.z + c.z)) for v in verts]
class rigid:
    def __init__(self, anchor, s=None): self.item = (Vector(anchor), s)
    def __enter__(self): RIGID.append(self.item)
    def __exit__(self, *a): RIGID.pop()
def emit(group, m, verts, faces, closed=False, round_=False):
    """faces: [(indices, smooth)]. 닫힌 셸은 부호 부피로 바깥 방향을 보정한다.
    round_: 버튼·나사·글자처럼 둥근 부품은 위치만 축별 축척을 따르고 모양은 균일 축척."""
    if RIGID: verts = keep_shape(verts, *RIGID[-1])
    elif round_: verts = keep_shape(verts)
    if closed:
        vol = 0.
        for idx, _ in faces:
            a = verts[idx[0]]
            for k in range(1, len(idx) - 1):
                vol += a.dot(verts[idx[k]].cross(verts[idx[k + 1]]))
        if vol < 0: faces = [(tuple(reversed(i)), s) for i, s in faces]
    b = bucket(group, m); o = len(b['v'])
    b['v'].extend(verts); b['f'].extend((tuple(i + o for i in idx), s) for idx, s in faces)

def xf(c=(0, 0, 0), s=(1, 1, 1), R=None):
    M = Matrix.Translation(Vector(c))
    if R is not None: M = M @ R
    return M @ Matrix.Diagonal((*s, 1))
def rx(a): return Matrix.Rotation(a, 4, 'X')
def ry(a): return Matrix.Rotation(a, 4, 'Y')
def rz(a): return Matrix.Rotation(a, 4, 'Z')

_CUBE_V = [Vector(v) for v in [(-.5, -.5, -.5), (.5, -.5, -.5), (.5, .5, -.5), (-.5, .5, -.5),
                               (-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)]]
_CUBE_F = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (0, 1, 5, 4), (3, 7, 6, 2)]
def box(g, m, c, s, R=None, M=None, keep=False):
    T = (M or Matrix()) @ xf(c, s, R)
    emit(g, m, [T @ v for v in _CUBE_V], [(f, False) for f in _CUBE_F], closed=True, round_=keep)
def cyl(g, m, c, r, h, axis='y', seg=16, M=None, r2=None):
    A = {'y': Matrix(), 'x': rz(-math.pi / 2), 'z': rx(math.pi / 2)}[axis]
    T = (M or Matrix()) @ Matrix.Translation(Vector(c)) @ A
    r2 = r if r2 is None else r2
    v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v.append(Vector((math.cos(a) * r, -h / 2, math.sin(a) * r)))
        v.append(Vector((math.cos(a) * r2, h / 2, math.sin(a) * r2)))
    f = [((2 * i, 2 * i + 1, 2 * ((i + 1) % seg) + 1, 2 * ((i + 1) % seg)), True) for i in range(seg)]
    f.append((tuple(2 * i for i in range(seg)), False))
    f.append((tuple(2 * i + 1 for i in reversed(range(seg))), False))
    emit(g, m, [T @ p for p in v], f, closed=True, round_=axis != 'y')
def sphere(g, m, c, rad, seg=14, rings=8, M=None):
    T = (M or Matrix()) @ xf(c, rad)
    v = [Vector((0, 1, 0))]
    for i in range(1, rings):
        t = math.pi * i / rings
        for j in range(seg):
            p = 2 * math.pi * j / seg
            v.append(Vector((math.sin(t) * math.cos(p), math.cos(t), math.sin(t) * math.sin(p))))
    v.append(Vector((0, -1, 0)))
    f = []
    for j in range(seg): f.append(((0, 1 + (j + 1) % seg, 1 + j), True))
    for i in range(rings - 2):
        for j in range(seg):
            a = 1 + i * seg + j; b = 1 + i * seg + (j + 1) % seg
            f.append(((a, b, b + seg, a + seg), True))
    last = len(v) - 1; base = 1 + (rings - 2) * seg
    for j in range(seg): f.append(((last, base + j, base + (j + 1) % seg), True))
    emit(g, m, [T @ p for p in v], f, closed=True, round_=True)
def torus(g, m, c, R, r, seg=20, tseg=8, M=None, Rm=None):
    T = (M or Matrix()) @ Matrix.Translation(Vector(c)) @ (Rm or Matrix())
    v = []
    for i in range(seg):
        u = 2 * math.pi * i / seg
        for j in range(tseg):
            w = 2 * math.pi * j / tseg
            v.append(Vector(((R + r * math.cos(w)) * math.cos(u), r * math.sin(w), (R + r * math.cos(w)) * math.sin(u))))
    f = [((i * tseg + j, i * tseg + (j + 1) % tseg, ((i + 1) % seg) * tseg + (j + 1) % tseg, ((i + 1) % seg) * tseg + j), True)
         for i in range(seg) for j in range(tseg)]
    emit(g, m, [T @ p for p in v], f, closed=True, round_=True)
def tube(g, m, pts, r, seg=7, M=None):
    """폴리라인 스윕(평행 이송 프레임) + 양끝 캡."""
    pts = [Vector(p) for p in pts]; T = M or Matrix()
    tans = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
        tans.append((b - a).normalized())
    n = tans[0].orthogonal().normalized(); v = []
    for i, p in enumerate(pts):
        if i: n = (n - tans[i] * n.dot(tans[i])).normalized()
        bn = tans[i].cross(n)
        for j in range(seg):
            a = 2 * math.pi * j / seg
            v.append(T @ (p + (n * math.cos(a) + bn * math.sin(a)) * r))
    f = []
    for i in range(len(pts) - 1):
        for j in range(seg):
            f.append(((i * seg + j, i * seg + (j + 1) % seg, (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j), True))
    f.append((tuple(range(seg)), False))
    k = (len(pts) - 1) * seg
    f.append((tuple(k + j for j in reversed(range(seg))), False))
    emit(g, m, v, f, closed=True)
def rounded(pts, rad=.02, steps=4):
    """꺾인 폴리라인 모서리를 둥글린다(배선 굽힘)."""
    pts = [Vector(p) for p in pts]; out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p, a, b = pts[i], pts[i - 1], pts[i + 1]
        t = min(rad, (p - a).length * .45, (b - p).length * .45)
        s = p + (a - p).normalized() * t; e = p + (b - p).normalized() * t
        for k in range(steps + 1):
            u = k / steps; out.append(s.lerp(p, u).lerp(p.lerp(e, u), u))
    out.append(pts[-1]); return out
def flat(g, m, corners, eps=0.):
    """평면 다각형(corners 는 바깥에서 볼 때 반시계)."""
    emit(g, m, [Vector(c) for c in corners], [(tuple(range(len(corners))), False)])

def text(g, m, body, origin, right, up, height, max_w=None, bold=False, lift=.00025):
    c = bpy.data.curves.new('t', 'FONT'); c.body = body; c.font = BOLD if bold else FONT
    c.size = 1; c.align_x = 'CENTER'; c.align_y = 'CENTER'; c.resolution_u = 2
    o = bpy.data.objects.new('t', c); bpy.context.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh()
    vs = [v.co.copy() for v in me.vertices]; fs = [tuple(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(c)
    if not vs: return
    xs = [v.x for v in vs]; ys = [v.y for v in vs]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = height / max(max(ys) - min(ys), 1e-6)
    if max_w: s = min(s, max_w / max(max(xs) - min(xs), 1e-6))
    R, U = Vector(right).normalized(), Vector(up).normalized(); N = R.cross(U)
    O = Vector(origin) + N * lift
    emit(g, m, [O + R * ((v.x - cx) * s) + U * ((v.y - cy) * s) for v in vs], [(f, False) for f in fs], round_=True)
def textz(g, m, body, x, y, z, h, max_w=None, bold=False, facing=1):
    """정면(+Z, facing=1) 또는 안쪽(-Z, facing=-1)을 보는 글자."""
    text(g, m, body, (x, y, z), (facing, 0, 0), (0, 1, 0), h, max_w, bold)

B, I, DL, DR = 'CabinetBody', 'CabinetInterior', 'DoorLeft', 'DoorRight'

# ══ 1. 캐비닛 본체 ═══════════════════════════════════════════════════
# 받침 채널(베이스) — 앞면 10mm 들여 넣음, 케이블 인입 홈
box(B, PAINT_D, (0, BASE_H / 2, -.005), (W - .02, BASE_H, D - .03))
box(B, DARK, (0, .035, D / 2 - .019), (.30, .05, .002))
# 외판: 좌·우·뒤·천판·바닥판
box(B, PAINT, (-W / 2 + SHEET / 2, BASE_H + BODY_H / 2, 0), (SHEET, BODY_H, D))
box(B, PAINT, (W / 2 - SHEET / 2, BASE_H + BODY_H / 2, 0), (SHEET, BODY_H, D))
box(B, PAINT, (0, BASE_H + BODY_H / 2, -D / 2 + SHEET / 2), (W, BODY_H, SHEET))
box(B, PAINT, (0, TOP_Y - SHEET / 2, 0), (W, SHEET, D))
box(B, PAINT, (0, BASE_H + SHEET / 2, 0), (W, SHEET, D))
# 앞 헤더(명칭판·비상정지) / 아래 턱 / 문 안쪽 절곡 플랜지
box(B, PAINT, (0, TOP_Y - TOP_RAIL / 2, D / 2 - .012), (W, TOP_RAIL, .024))
box(B, PAINT, (0, BASE_H + BOT_RAIL / 2, D / 2 - .012), (W, BOT_RAIL, .024))
for sx in (-1, 1):
    box(B, PAINT, (sx * (W / 2 - .012), (DOOR_Y0 + DOOR_Y1) / 2, D / 2 - .031), (.022, DOOR_Y1 - DOOR_Y0, SHEET))
box(B, PAINT, (0, DOOR_Y1 - .008, D / 2 - .031), (W - .02, .016, SHEET))
box(B, PAINT, (0, DOOR_Y0 + .008, D / 2 - .031), (W - .02, .016, SHEET))
# 헤더 명칭판 (한국어) + 우측 비상정지 버섯 버튼
box(B, WHITE, (0, TOP_Y - TOP_RAIL / 2, D / 2 + .0006), (.20, .030, .0012))
textz(B, INK, '엘리베이터 제어반', 0, TOP_Y - TOP_RAIL / 2, D / 2 + .0013, .015, .18, True)
ex, ey = W / 2 - .055, TOP_Y - TOP_RAIL / 2
box(B, YELLOW, (ex, ey, D / 2 + .0008), (.046, .046, .0016), keep=True)
cyl(B, DARK, (ex, ey, D / 2 + .008), .017, .013, 'z', 20)
cyl(B, RED, (ex, ey, D / 2 + .018), .022, .010, 'z', 24, r2=.020)
sphere(B, RED, (ex, ey, D / 2 + .023), (.020, .020, .006), 18, 6)
textz(B, INK, '비상정지', ex - .062, ey, D / 2 + .0006, .010, .05, True)
# 피아노 경첩 — 양쪽 바깥 모서리 전 높이, 너클 14마디(마디 사이 1.5mm) + 핀 캡 + 본체측 날개
for sx in (-1, 1):
    n = 14; L = DOOR_Y1 - DOOR_Y0; seg = (L - (n - 1) * .0015) / n
    for k in range(n):
        y0 = DOOR_Y0 + k * (seg + .0015)
        cyl(B, STEEL, (sx * HINGE_X, y0 + seg / 2, HINGE_Z), HINGE_R, seg, 'y', 12)
    for y in (DOOR_Y0 - .004, DOOR_Y1 + .004):
        cyl(B, STEEL, (sx * HINGE_X, y, HINGE_Z), HINGE_R * .55, .008, 'y', 10)
    box(B, STEEL, (sx * (W / 2 + .0012), (DOOR_Y0 + DOOR_Y1) / 2, D / 2 - .012), (.0012, L, .024))
# 인양용 아이볼트 4개
for sx in (-1, 1):
    for sz in (-1, 1):
        x, z = sx * (W / 2 - .045), sz * (D / 2 - .04)
        cyl(B, STEEL, (x, TOP_Y + .006, z), .009, .012, 'y', 12)
        torus(B, STEEL, (x, TOP_Y + .034, z), .018, .0045, 18, 8, Rm=ry(math.pi / 4 * sz * sx) @ rx(math.pi / 2))

# ══ 2. 상부 회생 저항함 — 타공 커버(엇갈린 장공) ═════════════════════
ry0 = TOP_Y + .006
box(B, PAINT_D, (0, TOP_Y + .003, 0), (RES_W + .03, .006, RES_D + .03))
box(B, DARK, (0, ry0 + RES_H / 2, 0), (RES_W - .012, RES_H - .012, RES_D - .012))
for k in range(4):   # 안쪽 권선 저항 엘리먼트(구멍 사이로 보임)
    cyl(B, CERAMIC, (0, ry0 + .05 + k * .03, -.04 + (k % 2) * .08), .014, RES_W - .06, 'x', 12)
def perforated(M, su, sv, t, m=PERF, margin=.016, hole=(.022, .007), bridge=.006, pitch=.014):
    """로컬 (u,v) 평면 판에 엇갈린 장공 — 판 = 가로 띠 + 구멍 줄의 다리. M: u→x, v→y, n→z 로컬."""
    hu, hv = hole; u0, u1 = -su / 2 + margin, su / 2 - margin
    rows = int((sv - 2 * margin) // pitch); v0 = -rows * pitch / 2
    box(B, m, (0, (sv / 2 + (v0 + rows * pitch)) / 2 + 0, 0), (su, sv / 2 - (v0 + rows * pitch) + .0001, t), M=M)
    box(B, m, (0, (-sv / 2 + v0) / 2, 0), (su, v0 + sv / 2 + .0001, t), M=M)
    for r in range(rows):
        vb = v0 + r * pitch
        box(B, m, (0, vb + (pitch - hv) / 2, 0), (su, pitch - hv, t), M=M)          # 줄 사이 띠
        vc = vb + pitch - hv / 2
        box(B, m, ((-su / 2 + u0) / 2, vc, 0), (u0 + su / 2, hv, t), M=M)            # 좌우 여백
        box(B, m, ((su / 2 + u1) / 2, vc, 0), (su / 2 - u1, hv, t), M=M)
        off = (hu + bridge) / 2 if r % 2 else 0
        u = u0 + off
        if off: box(B, m, ((u0 + u) / 2, vc, 0), (u - u0, hv, t), M=M)
        while u + hu < u1:
            u += hu
            e = min(u + bridge, u1)
            box(B, m, ((u + e) / 2, vc, 0), (e - u, hv, t), M=M)
            u = e
        if u < u1: box(B, m, ((u + u1) / 2, vc, 0), (u1 - u, hv, t), M=M)
cy = ry0 + RES_H / 2; tt = .0012
perforated(Matrix.Translation((0, cy, RES_D / 2)), RES_W, RES_H, tt)
perforated(Matrix.Translation((0, cy, -RES_D / 2)) @ ry(math.pi), RES_W, RES_H, tt)
perforated(Matrix.Translation((RES_W / 2, cy, 0)) @ ry(math.pi / 2), RES_D, RES_H, tt)
perforated(Matrix.Translation((-RES_W / 2, cy, 0)) @ ry(-math.pi / 2), RES_D, RES_H, tt)
perforated(Matrix.Translation((0, ry0 + RES_H, 0)) @ rx(-math.pi / 2), RES_W, RES_D, tt)
for sx in (-1, 1):   # 모서리 절곡 앵글
    for sz in (-1, 1):
        box(B, PERF, (sx * (RES_W / 2 - .004), cy, sz * (RES_D / 2 - .004)), (.009, RES_H, .009))

# ══ 3. 측면 인터폰 — 별도 GLB(intercom_phone.glb, machine_room_accessories.py). js/control-panel.js 가 옆면에 단다.

# ══ 4. 문짝 (양문) — 로컬 좌표로 만들고 그룹 피벗을 경첩축에 둔다 ════
dh = DOOR_Y1 - DOOR_Y0; dy = (DOOR_Y0 + DOOR_Y1) / 2
leaf_w = W / 2 - .003 - DOOR_GAP / 2
for g, sx in ((DL, -1), (DR, 1)):
    xc = sx * (DOOR_GAP / 2 + leaf_w / 2)
    zf = D / 2 + .001
    box(g, PAINT, (xc, dy, zf - DOOR_T / 2), (leaf_w, dh, DOOR_T))
    # 안쪽 보강 테두리 + 검정 가스켓
    zi = zf - DOOR_T
    for (cx, cy2, sw, sh) in ((xc, DOOR_Y1 - .02, leaf_w - .02, .012), (xc, DOOR_Y0 + .02, leaf_w - .02, .012),
                              (xc - sx * (leaf_w / 2 - .02), dy, .012, dh - .04), (xc + sx * (leaf_w / 2 - .02), dy, .012, dh - .04)):
        box(g, RUBBER, (cx, cy2, zi - .0035), (sw, sh, .007))
    # 경첩측 날개판
    box(g, STEEL, (sx * (W / 2 - .006), dy, zf + .0006), (.012, dh - .004, .0012))
# 오른쪽 문: 중앙 겹침판 + 스윙 핸들(열쇠) + 경고 스티커 2장 (사진 122829 한국어 표기)
box(DR, PAINT, (-.005, dy, D / 2 + .003), (.022, dh, .004))
hx, hy = .055, .93
box(DR, CHROME, (hx, hy, D / 2 + .004), (.030, .135, .006))
box(DR, CHROME, (hx, hy - .012, D / 2 + .014), (.018, .085, .010))
cyl(DR, CHROME, (hx, hy - .055, D / 2 + .014), .009, .018, 'x', 12)
cyl(DR, DARK, (hx, hy + .05, D / 2 + .0075), .0045, .002, 'z', 12)
box(DR, DARK, (hx, hy + .05, D / 2 + .0086), (.0012, .005, .0006))
def sticker(g, x, y, band_hex, head, lines, icon):
    zf = D / 2 + .0016
    box(g, WHITE, (x, y, zf), (.19, .078, .0006))
    box(g, INK, (x - .066, y, zf + .0004), (.050, .062, .0002))
    band = YELLOW if band_hex == 'y' else RED
    # 경고 삼각형 아이콘
    tx, ty = x - .066, y - .002
    flat(g, band, [(tx - .021, ty - .017, zf + .0007), (tx + .021, ty - .017, zf + .0007), (tx, ty + .020, zf + .0007)])
    if icon == 'bolt':
        flat(g, INK, [(tx + .002, ty + .012, zf + .0009), (tx - .007, ty - .002, zf + .0009), (tx - .001, ty - .002, zf + .0009),
                      (tx - .004, ty - .014, zf + .0009), (tx + .008, ty + .002, zf + .0009), (tx + .002, ty + .002, zf + .0009)])
    else:
        textz(g, INK, '!', tx, ty - .002, zf + .0008, .018, None, True)
    box(g, band, (x + .027, y + .026, zf + .0004), (.128, .022, .0002))
    textz(g, INK if band_hex == 'y' else WHITE, head, x + .027, y + .026, zf + .0006, .012, .11, True)
    for k, (ln, h, heavy) in enumerate(lines):
        textz(g, INK, ln, x + .027, y + .004 - k * .015, zf + .0005, h, .122, heavy)
sticker(DR, .205, 1.30, 'y', '경  고', [('제어반에 직사광선·습기가', .0085, False),
        ('유입되지 않도록 설치하여', .0085, False), ('주십시오.', .0085, False)], '!')
sticker(DR, .205, 1.205, 'r', '위  험', [('감전위험', .013, True), ('관계자 외 접근금지', .0095, False)], 'bolt')
# 왼쪽 문: 명판. 특정 제품명은 넣지 않는다.
box(DL, STEEL, (-.20, 1.33, D / 2 + .0016), (.13, .028, .0008))
textz(DL, INK, 'ELEVATOR CONTROLLER', -.20, 1.33, D / 2 + .0021, .0085, .115, True)
# 문 안쪽: 결선도·점검표(종이) + 왼쪽 문 서류 포켓
zi = D / 2 + .001 - DOOR_T - .0006
for g, sx in ((DL, -1), (DR, 1)):
    cxp = sx * (DOOR_GAP / 2 + leaf_w / 2 + .018)   # 자유단 쪽 잠금 로드 자리를 비운다
    for k, (w_, h_, dy_) in enumerate(((.22, .30, 1.20), (.22, .22, .92))):
        box(g, PAPER, (cxp + sx * .01 * k, dy_, zi), (w_, h_, .0008))
        for ln in range(int(h_ / .012) - 2):
            box(g, GREY, (cxp + sx * .01 * k - .01 * (ln % 3), dy_ + h_ / 2 - .02 - ln * .012, zi - .00055), (w_ * (.55 + .35 * ((ln * 7) % 5) / 5), .0012, .0002))
    textz(g, INK, '결선도' if sx < 0 else '점검 기록표', cxp, 1.20 + .135, zi - .0006, .013, .1, True, facing=-1)
# 오른쪽 문 안쪽: 자유단을 따라 위아래로 뻗은 잠금 로드 + 손잡이 캠 기구 (사진 122351 오른쪽 문)
zr = D / 2 + .001 - DOOR_T
rod_x, rod_z = .040, zr - .011
tube(DR, BRASS, [(rod_x, DOOR_Y0 + .045, rod_z), (rod_x, DOOR_Y1 - .045, rod_z)], .0045, 10)
for y_end, dy_end in ((DOOR_Y0 + .045, -1), (DOOR_Y1 - .045, 1)):   # 끝단: 틀 받이쪽으로 꺾인 걸림 끝
    tube(DR, BRASS, rounded([(rod_x, y_end, rod_z), (rod_x, y_end + dy_end * .018, rod_z), (rod_x - .012, y_end + dy_end * .026, rod_z)], .008), .0045, 10)
for gy in (.30, .60, 1.22, 1.40):                                    # 로드 가이드 브라켓
    box(DR, STEEL, (rod_x, gy, zr - .006), (.022, .014, .012))
    box(DR, STEEL, (rod_x, gy, rod_z - .004), (.014, .014, .002))
box(DR, BRASS, (hx, hy - .01, zr - .007), (.036, .085, .014))        # 캠 하우징
cyl(DR, BRASS, (hx, hy - .01, zr - .016), .017, .006, 'z', 20)
box(DR, BRASS, (hx - .008, hy - .01, rod_z), (.03, .010, .006), R=rz(.35))
for sy in (-1, 1): cyl(DR, STEEL, (hx, hy - .01 + sy * .035, zr - .0145), .0035, .002, 'z', 8)
for y_k in (DOOR_Y0 - .004, DOOR_Y1 + .004):                          # 본체 틀의 로드 받이
    box(B, STEEL, (rod_x, y_k, D / 2 - .03), (.02, .006, .012))
pk = -(DOOR_GAP / 2 + leaf_w / 2 + .018)
box(DL, GREY, (pk, .42, zi - .016), (.24, .17, .003))
box(DL, GREY, (pk, .336, zi - .008), (.24, .003, .016))
for sx2 in (-1, 1): box(DL, GREY, (pk + sx2 * .12, .42, zi - .008), (.003, .17, .016))
box(DL, PAPER, (pk + .01, .47, zi - .008), (.20, .17, .006))

# ══ 5. 내부 (문 열었을 때만 표시) ════════════════════════════════════
box(I, PLATE, (0, (BASE_H + TOP_Y) / 2, PLATE_Z - .0015), (W - .04, BODY_H - .03, .003))
z0 = PLATE_Z
def comb_duct(x0, y0, x1, y1, depth=.045, fingers=True):
    """배선 덕트: 바닥 + 양옆 빗살 + 뚜껑. 긴 방향으로 빗살을 낸다."""
    horiz = abs(x1 - x0) > abs(y1 - y0)
    L = abs(x1 - x0) if horiz else abs(y1 - y0); w = .032
    cx, cy2 = (x0 + x1) / 2, (y0 + y1) / 2
    size = (L, w, .002) if horiz else (w, L, .002)
    box(I, WHITE, (cx, cy2, z0 + .001), size)
    n = int(L / .011)
    for side in (-1, 1):
        for k in range(n):
            u = -L / 2 + (k + .5) * L / n
            if horiz: box(I, WHITE, (cx + u, cy2 + side * (w / 2 - .001), z0 + depth / 2), (L / n - .0035, .002, depth))
            else: box(I, WHITE, (cx + side * (w / 2 - .001), cy2 + u, z0 + depth / 2), (.002, L / n - .0035, depth))
    lid = (L, w + .002, .002) if horiz else (w + .002, L, .002)
    box(I, WHITE, (cx, cy2, z0 + depth + .001), lid)
def din(x0, x1, y):
    box(I, STEEL, ((x0 + x1) / 2, y, z0 + .004), (x1 - x0, .035, .007))
def board(x, y, w, h, m=PCB, stand=.012):
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(I, WHITE, (x + sx * (w / 2 - .006), y + sy * (h / 2 - .006), z0 + stand / 2), .003, stand, 'z', 8)
    box(I, m, (x, y, z0 + stand + .0008), (w, h, .0016))
    return z0 + stand + .0016
def connector(x, y, zt, w, pins=True):
    box(I, WHITE, (x, y, zt + .005), (w, .010, .010))
    if pins:
        for k in range(int(w / .005)):
            box(I, DARK, (x - w / 2 + .0025 + k * .005, y, zt + .0102), (.0022, .0045, .0006))
def relay(x, y, zt, m=BLUE): box(I, m, (x, y, zt + .008), (.013, .018, .016))
# 사진 1595633541508·1595633545432(SICON 보드부)·1595633544204(아래 마그네틱) 기준 배치.
PCB_TR = mat('PCBTrace', '#3fa865', 0, .4)
SILK = mat('Silkscreen', '#f4f4ef', 0, .6)
GOLD = mat('Gold', '#c9a54b', .9, .3)
FILM = mat('FilmYellow', '#f0c330', 0, .35)
CLEAR = mat('RelayHousing', '#e4e7e2', 0, .22)
GLASS = mat('FuseGlass', '#d4dde0', .2, .08)
SCREEN = mat('LcdScreen', '#a2b28b', 0, .35, .25)
ORANGE = mat('LabelOrange', '#f58a2a', 0, .5)
CYAN = mat('PaintMark', '#31c4bf', 0, .5)
LABELB = mat('LabelBlue', '#a9bcd8', 0, .5)
TBLK = mat('TerminalBlack', '#2a2c2e', 0, .55)
WIRE_W = mat('WireWhite', '#f1f1ec', 0, .5)
WIRE_P = mat('WirePink', '#e58fb0', 0, .5)
WIRE_G = mat('WireGrey', '#9ea3a6', 0, .5)
RES_OR = mat('ResistorOrange', '#d8702a', 0, .45)
TB_GREEN = mat('PlugTerminal', '#3b9a4e', 0, .45)

def silk_rect(x, y, w, h, zt, t=.0006):
    for (cx, cy_, sw, sh) in ((x, y + h / 2, w, t), (x, y - h / 2, w, t), (x - w / 2, y, t, h), (x + w / 2, y, t, h)):
        box(I, SILK, (cx, cy_, zt + .00006), (sw, sh, .00012))
def pcb(x, y, w, h, seed):
    """솔더레지스트 기판 + 금도금 취부공 + 동박 트레이스 + 칩 부품 점점이."""
    zt = board(x, y, w, h)
    r = random.Random(seed)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(I, GOLD, (x + sx * (w / 2 - .006), y + sy * (h / 2 - .006), zt + .0001), .0045, .0002, 'z', 14)
    for _ in range(int(w * h * 2600)):
        u, v = x + (r.random() - .5) * (w - .012), y + (r.random() - .5) * (h - .012)
        L = .006 + r.random() * .05
        if r.random() < .5:
            L = min(L, x + w / 2 - .005 - u)
            box(I, PCB_TR, (u + L / 2, v, zt + .00005), (L, .0007, .0001))
        else:
            L = min(L, y + h / 2 - .005 - v)
            box(I, PCB_TR, (u, v + L / 2, zt + .00005), (.0007, L, .0001))
    for _ in range(int(w * h * 2400)):
        u, v = x + (r.random() - .5) * (w - .01), y + (r.random() - .5) * (h - .01)
        rot = r.random() < .5
        box(I, CHIP if r.random() < .6 else GREY, (u, v, zt + .0004), (.0024, .0013, .0008) if rot else (.0013, .0024, .0008))
    return zt
def cap_e(x, y, zt, r, h, m=CAP):
    cyl(I, m, (x, y, zt + h / 2), r, h, 'z', 18)
    cyl(I, STEEL, (x, y, zt + h + .0003), r * .92, .0006, 'z', 18)
    box(I, GREY, (x + r * .75, y, zt + h / 2), (r * .35, r * .5, h * .96))
def dip(x, y, zt, n=8, vertical=False):
    L = n / 2 * .00254 + .002
    box(I, CHIP, (x, y, zt + .002), (.0075, L, .0035) if vertical else (L, .0075, .0035))
    for k in range(n // 2):
        for sd in (-1, 1):
            u = -L / 2 + .002 + k * .00254
            box(I, STEEL, ((x + sd * .0045, y + u) if vertical else (x + u, y + sd * .0045)) + (zt + .0012,), (.0015, .0006, .0012) if vertical else (.0006, .0015, .0012))
def qfp(x, y, zt, a=.02):
    box(I, CHIP, (x, y, zt + .0012), (a, a, .0022))
    n = 12
    for k in range(n):
        u = -a / 2 + (k + .5) * a / n
        for sd in (-1, 1):
            box(I, STEEL, (x + u, y + sd * (a / 2 + .0012), zt + .0004), (.0006, .0024, .0005))
            box(I, STEEL, (x + sd * (a / 2 + .0012), y + u, zt + .0004), (.0024, .0006, .0005))
    cyl(I, GREY, (x - a * .32, y + a * .32, zt + .00235), .0015, .0001, 'z', 8)
def molex(x, y, zt, w, h, d=.016, rows=2):
    box(I, WHITE, (x, y, zt + d / 2), (w, h, d))
    cols = max(2, int(w / .0055))
    for rr in range(rows):
        for c in range(cols):
            box(I, DARK, (x - w / 2 + (c + .5) * w / cols, y - h / 2 + (rr + .5) * h / rows, zt + d + .0002), (w / cols * .55, h / rows * .5, .0006))
def relay_ly(x, y, zt, w=.036, h=.026, d=.026):
    box(I, CLEAR, (x, y, zt + d / 2), (w, h, d))
    box(I, TBLK, (x, y, zt + .0015), (w + .002, h + .002, .003))
    box(I, DARK, (x - w * .12, y, zt + d * .55), (w * .5, h * .55, d * .75))       # 안의 코일(불투명 하우징 대신 짙게)
    box(I, WHITE, (x + w * .22, y, zt + d + .0002), (w * .36, h * .7, .0004))
    textz(I, INK, 'LY2', x + w * .22, y + h * .12, zt + d + .0005, .0035, w * .3, True)
def fuse(x, y, zt):
    for sd in (-1, 1): box(I, TBLK, (x + sd * .008, y, zt + .003), (.005, .007, .006))
    cyl(I, GLASS, (x, y, zt + .006), .0028, .016, 'x', 12)
    for sd in (-1, 1): cyl(I, STEEL, (x + sd * .009, y, zt + .006), .0031, .004, 'x', 12)
def zip_tie(x, y, z, r, axis='y'):
    torus(I, WHITE, (x, y, z), r + .0015, .0012, 16, 5, Rm=rx(math.pi / 2) if axis == 'z' else (rz(math.pi / 2) if axis == 'x' else None))
def bundle(pts_list, mats, r=.0028):
    for pts, m in zip(pts_list, mats): tube(I, m, rounded(pts, .02), r, 6)

# 5-1 기존 좌측 운전 스위치 제거. 새 스위치판은 두 보드 오른쪽에 둔다.
# 5-2 CPU 보드 (LCD·키패드·포토커플러 열·몰렉스 줄) — 사진 왼쪽 보드
bx, by, bw, bh = CPU_X, 1.195, .21, .33
zt = pcb(bx, by, bw, bh, 11)
box(I, DARK, (bx - .035, by + .095, zt + .004), (.09, .056, .008))
box(I, SCREEN, (bx - .035, by + .096, zt + .0085), (.077, .043, .001))
textz(I, INK, '1F  STOP  AUTO', bx - .035, by + .096, zt + .0092, .006, .066)
keys = [['ESC', '▲', 'ENT'], ['◀', '▼', '▶'], ['1UP', '1DN', 'F']]
for rr, row in enumerate(keys):
    for c, lab in enumerate(row):
        kx, ky = bx + .047 + c * .018, by + .12 - rr * .019
        box(I, WHITE, (kx, ky, zt + .003), (.015, .015, .006))
        box(I, GREY, (kx, ky, zt + .0005), (.017, .017, .001))
        textz(I, INK, lab, kx, ky, zt + .0062, .005, .012, True)
silk_rect(bx + .065, by + .1, .06, .065, zt)
box(I, FILM, (bx + .093, by + .045, zt + .008), (.012, .03, .016))
qfp(bx - .06, by + .025, zt)
for k in range(4): dip(bx - .02 + k * .02, by + .03, zt, 14, True)
for rr in range(2):                                                    # 포토커플러·저항 어레이 열
    for c in range(14):
        box(I, GREY, (bx - .088 + c * .0132, by - .03 - rr * .016, zt + .0022), (.0105, .0085, .0044))
    for c in range(7):
        box(I, CHIP, (bx - .082 + c * .026, by - .064 - rr * .01, zt + .001), (.02, .0035, .002))
for c in range(8): box(I, BLUE, (bx - .095 + c * .004, by - .105, zt + .0015), (.0032, .008, .003))
for k in range(8): cyl(I, LED_G if k % 4 else LED_R, (bx + .03 + k * .006, by - .09, zt + .0015), .0014, .003, 'z', 8)
cyl(I, WHITE, (bx + .075, by - .105, zt + .0003), .011, .0005, 'z', 20)                  # 검사 합격 스티커
torus(I, RED, (bx + .075, by - .105, zt + .0006), .0085, .0012, 20, 5, Rm=rx(math.pi / 2))
text(I, SILK, 'CPU', (bx + .03, by - .125, zt + .0001), (1, 0, 0), (0, 1, 0), .0038, .02)
for k in range(5): molex(bx - .082 + k * .036, by - bh / 2 + .018, zt, .03, .02)
box(I, TB_GREEN, (bx + .085, by - bh / 2 + .018, zt + .007), (.026, .018, .014))
for k in range(4): cyl(I, STEEL, (bx + .076 + k * .006, by - bh / 2 + .022, zt + .0142), .0017, .001, 'z', 8)
box(I, TBLK, (bx - .02, by + bh / 2 - .008, zt + .004), (.05, .01, .008))                  # 상단 무지개 리본
for k in range(10):
    m = [WIRE_R, WIRE_Y, GREEN, BLUE, WIRE_P, WIRE_W, WIRE_K, RES_OR, WIRE_G, WIRE_Y][k]
    box(I, m, (bx - .042 + k * .0045, by + bh / 2 + .04, zt + .01), (.0042, .08, .0015))

# 5-3 사진 235516 전원/I/O 보드: 좌측 릴레이·퓨즈, 우상단 방열판, 우하단 콘덴서.
px, py, pw, ph = IO_X, 1.23, IO_W, .46
zt2 = pcb(px, py, pw, ph, 23)
hx, hy = px + .043, py + .165
box(I, DARK, (hx, hy, zt2 + .004), (.085, .082, .008))
for k in range(11): box(I, DARK, (hx - .039 + k * .0078, hy, zt2 + .023), (.003, .082, .038))
for y in (py+.095, py+.04):
    cyl(I, FILM, (px+.038, y, zt2+.012), .0055, .075, 'x', 16)
for k in range(3):
    relay_ly(px-.040, py+.095-k*.050, zt2, .042, .031, .030)
for k in range(8): fuse(px-.069, py+.177-k*.042, zt2)
for k in range(3):
    box(I, WHITE, (px-.006, py-.055-k*.033, zt2+.008), (.044,.022,.016))
    box(I, BLUE, (px+.052, py-.055-k*.026, zt2+.010), (.033,.018,.020))
cap_e(px+.055, py-.159, zt2, .014, .030)
cap_e(px-.046, py-.033, zt2, .008, .020)
for k in range(4): dip(px-.029+k*.024, py-.013, zt2, 8, True)
for k in range(11): cyl(I, LED_R, (px-.072+k*.014, py-.191, zt2+.003), .0018, .005, 'z', 10)
io_bottom=[px-.061,px-.009,px+.047]
for xk in io_bottom: molex(xk, py-ph/2+.015, zt2, .040, .020, .016)
for k in range(10): molex(px-pw/2+.006, py+.195-k*.042, zt2, .012, .027, .012, 1)
for k in range(3): molex(px-.060+k*.060, py+ph/2-.008, zt2, .032, .012, .012, 1)

# 5-4 CPU ↔ I/O 리본: 이동된 양 보드 커넥터에서 파생.
ra, rb = bx+bw/2-.008, px-pw/2+.008
yr, zr_ = 1.21, zt+.035
for xk in (ra,rb):
    box(I,TBLK,(xk,yr,zt+.005),(.009,.058,.010))
    box(I,GREY,(xk,yr,(zt+zr_)/2),(.0018,.05,zr_-zt))
box(I,GREY,((ra+rb)/2,yr,zr_),(rb-ra,.05,.0018))
for k in range(9): box(I,WIRE_G,((ra+rb)/2,yr-.022+k*.0055,zr_+.0011),(rb-ra,.0012,.0006))

# 5-5 우측 운전·시험·바이패스 스위치판. 버튼/글씨는 균일 축척으로 원형을 유지한다.
fz=z0+.064
box(I,STEEL,(SW_X,SW_Y,fz-.004),(SW_W,SW_H,.008))
box(I,YELLOW,(SW_X+.036,SW_Y,fz+.0008),(.124,SW_H-.009,.0016))
left=SW_X-.067
def push(x,y,col,lab,mush=False):
    cyl(I,STEEL,(x,y,fz+.003),.015,.006,'z',24)
    if mush:
        cyl(I,DARK,(x,y,fz+.012),.012,.016,'z',20)
        cyl(I,col,(x,y,fz+.025),.019,.012,'z',24,r2=.017)
    else: cyl(I,col,(x,y,fz+.010),.0115,.012,'z',24)
    textz(I,INK,lab,x,y-.027,fz+.0024,.0062,.054,True)
push(left,SW_Y+.185,RED,'E-STOP',True)
textz(I,INK,'정상    비상',left,SW_Y+.134,fz+.0024,.0055,.055)
def selector(x,y,r=.014):
    cyl(I,STEEL,(x,y,fz+.003),r+.002,.006,'z',24)
    cyl(I,DARK,(x,y,fz+.009),r,.008,'z',24)
    box(I,DARK,(x,y,fz+.018),(.009,r*2.1,.014),R=rz(-.6),keep=True)
    box(I,WHITE,(x-.002,y+.006,fz+.0255),(.002,.010,.001),R=rz(-.6),keep=True)
selector(left,SW_Y+.100)
textz(I,INK,'AUTO/EOP',left,SW_Y+.068,fz+.0024,.006,.057)
push(left,SW_Y+.012,WHITE,'상승 (UP)')
push(left,SW_Y-.075,BLUE,'공통 (RUN)')
push(left,SW_Y-.162,DARK,'하강 (DOWN)')
c1,c2=SW_X+.004,SW_X+.068
for x,y,col,lab in [(c1,SW_Y+.185,RED,'BTB1'),(c2,SW_Y+.185,GREEN,'EPSB1'),(c1,SW_Y+.102,GREEN,'BTB2'),(c2,SW_Y+.102,RED,'EPSB2'),(c2,SW_Y+.012,YELLOW,'ATB')]: push(x,y,col,lab)
selector(c1,SW_Y+.012,.013)
textz(I,INK,'정상   개방',c1,SW_Y+.050,fz+.0024,.005,.054)
textz(I,INK,'BTS',c1,SW_Y-.018,fz+.0024,.0055,.046)
textz(I,INK,'(Brake Test)',c1,SW_Y-.031,fz+.0024,.0045,.060)
textz(I,INK,'ARD Test',c2,SW_Y-.031,fz+.0024,.005,.054)

# 사진 우하단 노란 사각 베이스·검정 캠 손잡이·투명 원형 가드. NORMAL 위치 외형.
bp=(SW_X+.025,SW_Y-.143,fz+.003)
box(I,YELLOW,(bp[0],bp[1],bp[2]+.009),(.098,.126,.018))
for sx in (-1,1):
    for sy in (-1,1):
        cyl(I,DARK,(bp[0]+sx*.040,bp[1]+sy*.049,bp[2]+.019),.0045,.002,'z',14)
        box(I,STEEL,(bp[0]+sx*.040,bp[1]+sy*.049,bp[2]+.0202),(.005,.001,.0004))
cyl(I,GREY,(bp[0],bp[1],bp[2]+.020),.035,.006,'z',32)
torus(I,GLASS,(bp[0],bp[1],bp[2]+.028),.036,.004,40,8,Rm=rx(math.pi/2))
cyl(I,DARK,(bp[0],bp[1],bp[2]+.029),.027,.016,'z',32)
box(I,DARK,(bp[0],bp[1]+.008,bp[2]+.043),(.017,.049,.014),keep=True)
box(I,WHITE,(bp[0],bp[1]+.022,bp[2]+.0505),(.003,.017,.001),keep=True)
textz(I,INK,'NORMAL',bp[0],bp[1]+.058,bp[2]+.0195,.005,.065,True)
text(I,INK,'LANDING',(bp[0]-.044,bp[1],bp[2]+.0195),(0,-1,0),(1,0,0),.005,.066,True)
text(I,INK,'CAR',(bp[0]+.044,bp[1],bp[2]+.0195),(0,-1,0),(1,0,0),.005,.025,True)
textz(I,INK,'BYPASS',bp[0],bp[1]-.058,bp[2]+.0195,.005,.063,True)
for sx in (-1,1):
    for sy in (-1,1): cyl(I,STEEL,(SW_X+sx*(SW_W/2-.009),SW_Y+sy*(SW_H/2-.009),fz+.003),.003,.003,'z',12)

# 보드 좌측 커넥터 배선은 보드 간 틈으로 내려가 하부 다발에 합류한다.
rbx=px-pw/2-.005
for k in range(10):
    yk=py+.195-k*.042
    tube(I,WIRE_K if k%3 else WIRE_W,rounded([(px-pw/2+.003,yk,zt2+.010),(rbx,yk-.015,zt2+.018),(rbx,.965,z0+.030)],.006),.0016,6)
for yk in (1.40,1.31,1.12,1.02): zip_tie(rbx,yk,zt2+.019,.006)
for k in range(3):
    xk=px-.060+k*.060
    tube(I,WIRE_K,rounded([(xk,py+ph/2-.004,zt2+.012),(xk,1.478,z0+.025),(rbx,1.478,z0+.025)],.008),.002,6)

# 5-6 가로 배선 다발 (노랑·파랑·흰·회) — 보드 몰렉스에서 내려와 합류, 좌측 세로 덕트로
hb_y = .95
bmats = [WIRE_Y, WIRE_Y, WIRE_B, WIRE_W, WIRE_G, WIRE_Y, WIRE_B, WIRE_W, WIRE_Y]
for k, m in enumerate(bmats):
    dy_, dz_ = (k % 3 - 1) * .006, (k // 3) * .006
    tube(I, m, rounded([(W / 2 - .072, hb_y + dy_, z0 + .03 + dz_), (-W / 2 + .06, hb_y + dy_, z0 + .03 + dz_), (-W / 2 + .032, .90, z0 + .025)], .03), .0032, 6)
for xk in (-.25, -.17, -.09, -.01, .07, .15, .23): zip_tie(xk, hb_y, z0 + .036, .012, 'x')
for k in range(5):
    xk = bx - .082 + k * .036
    for j in range(3):
        tube(I, WIRE_Y, rounded([(xk - .008 + j * .008, by - bh / 2 + .01, zt + .01), (xk - .008 + j * .008, by - bh / 2 - .03, z0 + .03), (xk + .02, hb_y + .006, z0 + .036)], .012), .0022, 6)
for k, xk in enumerate(io_bottom):
    for j, m in enumerate((WIRE_Y, WIRE_B, WIRE_P) if k == 2 else (WIRE_Y, WIRE_B, WIRE_Y)):
        tube(I, m, rounded([(xk - .01 + j * .01, 1.012, zt2 + .012), (xk - .01 + j * .01, .99, z0 + .035), (xk - .04, hb_y, z0 + .04)], .012), .0022, 6)

# 5-7 마그네틱 구역 (사진 1595633544204): 흑색 단자대 + 흰 마커 튜브, Fuji형 SH-4·SC-0 접촉기
din(-.30, -.03, .80)
tlabels = ['GOV1', 'GOV2', 'HL21', 'HL22', 'FL1', 'FL2', 'DS1', 'DS2', 'SDS', 'LS1', 'LS2', 'EMS1', 'EMS2',
           'CS1', 'CS2', 'PS1', 'PS2', '24V', '0V', 'P24', 'N24', 'R', 'S', 'T', 'E', 'E']
for k, lab in enumerate(tlabels):
    x = -.293 + k * .0101
    box(I, TBLK, (x, .80, z0 + .0255), (.0095, .058, .045))
    box(I, WHITE, (x, .80, z0 + .0485), (.0085, .02, .0008))
    text(I, INK, lab, (x, .80, z0 + .0489), (0, 1, 0), (-1, 0, 0), .0042, .0125, True)
    for sy in (-1, 1):
        cyl(I, STEEL, (x, .80 + sy * .021, z0 + .046), .003, .0016, 'z', 10)
        box(I, DARK, (x, .80 + sy * .021, z0 + .0472), (.004, .0008, .0004))
    sphere(I, CYAN, (x + .0015, .821, z0 + .0472), (.0018, .0016, .0008), 8, 4)
    tube(I, WIRE_K, rounded([(x, .821, z0 + .047), (x, .845, z0 + .055), (x + .004, hb_y - .012, z0 + .035)], .01), .0021, 6)
    cyl(I, WIRE_W, (x, .852, z0 + .0555), .0031, .016, 'y', 8)
def contactor(x, y, name, kind):
    w_, h_, d_ = .045, .072, .076
    zf = z0 + d_
    box(I, WHITE, (x, y, z0 + d_ / 2), (w_, h_, d_ - .01))
    box(I, WHITE, (x, y, zf - .004), (w_ * .96, h_ * .62, .008))                         # 앞 몰드 단
    npole = 4 if kind == 'SH-4' else 3
    names = ['13NO', '23NO', '33NO', '43NO'] if kind == 'SH-4' else ['1 L1', '3 L2', '5 L3']
    for sy in (1, -1):
        yt = y + sy * .029
        box(I, TBLK, (x, yt, zf - .012), (w_, .014, .01))
        for j in range(npole):
            xs = x - w_ / 2 + (j + .5) * w_ / npole
            box(I, STEEL, (xs, yt, zf - .0065), (.0085, .0085, .0012))
            cyl(I, STEEL, (xs, yt, zf - .0052), .0034, .0016, 'z', 12)
            box(I, DARK, (xs, yt, zf - .0043), (.0048, .0007, .0003), R=rz(.6))
            sphere(I, CYAN, (xs + .0016, yt + .0012, zf - .0042), (.0022, .002, .0009), 8, 4)
            if j: box(I, TBLK, (x - w_ / 2 + j * w_ / npole, yt, zf - .006), (.0012, .013, .011))
            if sy > 0:
                tube(I, WIRE_K, rounded([(xs, yt + .003, zf - .004), (xs, yt + .03, zf + .004), (xs + .003, hb_y - .01, z0 + .04)], .01), .0024, 6)
                cyl(I, WIRE_W, (xs, yt + .024, zf + .0035), .0036, .018, 'y', 8)
        if sy > 0:
            for j, nm in enumerate(names):
                xs = x - w_ / 2 + (j + .5) * w_ / npole
                textz(I, GREY, nm, xs, y + .0185, zf + .0001, .0026, w_ / npole * .9)
    box(I, TBLK, (x + .002, y - .002, zf + .003), (.02, .03, .006))                        # 아마추어 창
    box(I, DARK, (x + .002, y + .004, zf + .0062), (.012, .012, .0006))
    box(I, LABELB, (x + .002, y - .0125, zf + .0062), (.019, .008, .0006))
    textz(I, INK, name, x + .002, y - .0125, zf + .0066, .0052, .017, True)
    box(I, ORANGE, (x - .0165, y - .001, zf + .0002), (.01, .01, .0004))
    textz(I, INK, kind, x - .0165, y + .009, zf + .0002, .0032, .01, True)
    textz(I, INK, 'AC-3', x - .0165, y - .001, zf + .0005, .0024, .008)
din(-.005, .27, .80)
for k, (nm, kd) in enumerate((('HDM', 'SH-4'), ('BKM', 'SC-0'), ('UM', 'SC-0'), ('DM', 'SC-0'))):
    contactor(.02 + k * .048, .80, nm, kd)
cx2 = .235                                                              # 배선용 차단기(MCCB)
box(I, GREY, (cx2, .80, z0 + .035), (.05, .09, .07)); box(I, WHITE, (cx2, .80, z0 + .071), (.042, .07, .002))
box(I, DARK, (cx2, .806, z0 + .08), (.012, .022, .016))
textz(I, INK, 'MCCB 30A', cx2, .775, z0 + .0722, .0042, .036, True)
for j in range(3):
    cyl(I, STEEL, (cx2 - .014 + j * .014, .836, z0 + .0715), .003, .002, 'z', 8)
    tube(I, WIRE_K, rounded([(cx2 - .014 + j * .014, .838, z0 + .072), (cx2 - .014 + j * .014, .87, z0 + .06), (rbx - .01, hb_y - .01, z0 + .04)], .01), .0035, 6)

# 5-8 소형 차단기 6·SMPS(24V)·보조 릴레이 소켓
din(-.30, .27, .665)
for k in range(6):
    x = -.285 + k * .019
    box(I, WHITE, (x, .665, z0 + .032), (.018, .08, .058)); box(I, DARK, (x, .675, z0 + .064), (.006, .014, .01))
    box(I, ORANGE if k < 2 else BLUE, (x, .642, z0 + .0615), (.012, .005, .0006))
box(I, STEEL, (-.11, .665, z0 + .028), (.10, .085, .05))
for k in range(6): box(I, DARK, (-.14 + k * .012, .69, z0 + .0532), (.006, .02, .0006))
textz(I, INK, 'SMPS 24V', -.11, .645, z0 + .0532, .0055, .06, True)
for k in range(4):
    x = -.035 + k * .03
    box(I, TBLK, (x, .665, z0 + .012), (.026, .05, .016)); box(I, CLEAR, (x, .668, z0 + .033), (.022, .036, .03))
    box(I, DARK, (x, .668, z0 + .036), (.012, .02, .024))
box(I, GREY, (.19, .665, z0 + .025), (.09, .06, .045))
textz(I, INK, 'NOISE FILTER', .19, .665, z0 + .0478, .0045, .07, True)

# 5-9 덕트 · DIN 단자 레일(흑색 + 흰 마커) · 좌측 세로 덕트
comb_duct(-.30, .575, .27, .575)
comb_duct(-W / 2 + .032, .16, -W / 2 + .032, .90)
din(-.27, .16, .47)
for k in range(58):
    x = -.265 + k * .0068
    box(I, BLUE if k % 11 == 5 else TBLK, (x, .47, z0 + .025), (.006, .05, .042))
    box(I, WHITE, (x, .47, z0 + .0462), (.0055, .012, .0006))
    cyl(I, STEEL, (x, .488, z0 + .047), .0022, .002, 'z', 8)
    cyl(I, STEEL, (x, .452, z0 + .047), .0022, .002, 'z', 8)
    if k % 2 == 0:
        tube(I, WIRE_K, rounded([(x, .49, z0 + .048), (x, .52, z0 + .05), (x, .56, z0 + .03)], .01), .0019, 5)
        cyl(I, WIRE_W, (x, .512, z0 + .049), .0028, .012, 'y', 8)

# 5-10 하부: 제동 저항 + 동력 단자(U·V·W) + 인입 케이블
for sx in (-1, 1): box(I, PAINT, (-.04 + sx * .19, .30, z0 + .03), (.012, .07, .06))
cyl(I, CERAMIC, (-.04, .30, z0 + .04), .017, .37, 'x', 16)
for k in range(26): torus(I, COPPER, (-.20 + k * .0125, .30, z0 + .04), .0175, .0015, 16, 6, Rm=rz(math.pi / 2))
din(.205, .315, .36)
for k, lab in enumerate('UVW'):
    x = .225 + k * .033
    box(I, GREY, (x, .36, z0 + .03), (.028, .06, .05))
    cyl(I, STEEL, (x, .375, z0 + .056), .006, .004, 'z', 10)
    textz(I, INK, lab, x, .343, z0 + .0555, .011, None, True)
    tube(I, WIRE_K, rounded([(x, .375, z0 + .06), (x, .30, z0 + .09), (x, .15, z0 + .07), (x, BASE_H - .02, z0 + .05)], .03), .0065)
for k in range(3):
    tube(I, WIRE_K, rounded([(-.02 + k * .03, .20, z0 + .02), (-.02 + k * .03, .17, z0 + .05), (-.02 + k * .03, BASE_H - .02, z0 + .06)]), .005)
tube(I, WIRE_Y, rounded([(-W / 2 + .032, .15, z0 + .03), (-W / 2 + .06, .52, z0 + .07), (-.28, .56, z0 + .06)], .04), .012)

# ══ 6. 메시 생성 · 계층 · 내보내기 ═══════════════════════════════════
def to_blender(v): return (NS.x * v.x, -NS.z * v.z, NS.y * v.y)
root = bpy.data.objects.new('ControlPanel', None); bpy.context.collection.objects.link(root)
for k, val in SPEC.items(): root[k] = val
root['upperLayout'] = {'cpuX': CPU_X, 'ioX': IO_X, 'ioWidth': IO_W, 'switchX': SW_X, 'switchWidth': SW_W, 'bypassPosition': list(bp)}
root['doorAxis'] = [HINGE_X * NS.x, HINGE_Z * NS.z]
groups = {}
for gname, piv in PIVOT.items():
    e = bpy.data.objects.new(gname, None); bpy.context.collection.objects.link(e)
    e.location = to_blender(piv); e.parent = root; groups[gname] = e
for (gname, mname), data in BUCKETS.items():
    piv = PIVOT[gname]
    me = bpy.data.meshes.new(f'{gname}_{mname}')
    me.from_pydata([to_blender(v - piv) for v in data['v']], [], [f for f, _ in data['f']])
    me.update()
    for poly, (_, smooth) in zip(me.polygons, data['f']): poly.use_smooth = smooth
    me.materials.append(bpy.data.materials['CP_' + mname])
    o = bpy.data.objects.new(f'{gname}_{mname}', me); bpy.context.collection.objects.link(o)
    o.parent = groups[gname]
tri = sum(sum(len(f) - 2 for f, _ in d['f']) for d in BUCKETS.values())
print('control panel triangles', tri, 'meshes', len(BUCKETS))
for g in groups:
    print(' ', g, sum(sum(len(f) - 2 for f, _ in d['f']) for (gg, _), d in BUCKETS.items() if gg == g))
bpy.ops.object.select_all(action='SELECT')
dest = ROOT / 'models/gltf/control_panel.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
print('Exported', dest)
