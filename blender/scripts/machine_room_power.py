"""기계실 전원 계통 실사 모델.
  ard.glb  — 자동구출운전장치(ARD). 사진 141730·141757·141823: 파란 강판함, 상부 아이볼트, 앞면 BETA-ARD 표시창·LCD,
             고압주의·배터리 스티커, 하부 루버, 옆면 손잡이 홈, 노란 주의 라벨·명판. 앵글 받침대 위에 선다.
  elevator_distribution_box.glb — 엘리베이터 전용 분전함 P-ELEV(사진 120206·120236) + 조명 스위치.
             내부(문 열림 때만 표시): 50A 4P 배선용 차단기(98ff1bcd 형상, 380V), 가로로 누운 220V 2P 누전차단기(3128 형상),
             24시간 타이머(142414 — 조명이 왼쪽이라 사진과 반대로 왼쪽), 전선(L1 검·L2 빨·L3 파·N 흰, 220V = L1 + N).
             배선은 칼각(사진 144544): 부스바+수축튜브+투명 아크릴 커버, 직교 배선·링단자·케이블타이. 인입·조명선은 벽 매립.
좌표는 Three.js 로컬(+Y 위, +Z 앞면, z=0 뒷면=벽, 원점 = 뒷면 바닥 중심)로 적고 Blender(x, -z, y)로 옮긴다.
치수 원본: js/machine-room-power.js 의 MR_POWER_SPEC.
실행: blender -b -P blender/scripts/machine_room_power.py
"""
import bpy, json, math, re
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads(re.search(r'const MR_POWER_SPEC = (\{.*?\});', (ROOT / 'js/machine-room-power.js').read_text(encoding='utf-8'))[1])
AW, AH, AD, AS = SPEC['ard']['w'], SPEC['ard']['h'], SPEC['ard']['d'], SPEC['ard']['stand']
BW, BH, BD = SPEC['db']['w'], SPEC['db']['h'], SPEC['db']['d']
CABLE_X = SPEC['cableX']                # 아래 인출구(덕트 → ARD) X
DOOR_T = .018
FONT = bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
BOLD = bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')
ITAL = bpy.data.fonts.load('C:/Windows/Fonts/arialbi.ttf')

for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for item in list(block): block.remove(item)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)
def mat(name, hexcol, metal=0., rough=.55, emit=0., alpha=1.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*lin(hexcol), 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*lin(hexcol), 1); p.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except AttributeError: m.blend_method = 'BLEND'
    return name
BLUE = mat('ArdBlue', '#4f78bf', .05, .5)
BLUE_D = mat('ArdBlueEdge', '#3d63a6', .05, .55)
BLACK = mat('Black', '#16181a', 0, .45)
CYAN = mat('ArdCyanBand', '#7fcbd3', 0, .4)
LCD = mat('ArdLcd', '#2a5fd0', 0, .3, .9)
LCD_T = mat('ArdLcdText', '#bfe6ff', 0, .3, 2.)
WHITE = mat('White', '#f4f4f0', 0, .45)
RED = mat('Red', '#d8262b', 0, .4)
YEL = mat('Yellow', '#f5cf1c', 0, .45)
INK = mat('Ink', '#141414', 0, .7)
STEEL = mat('Steel', '#b9bcbe', .85, .32)
ZINC = mat('Zinc', '#c9ccca', .6, .4)
GREIGE = mat('BoxGreige', '#aaa597', .1, .45)
CHROME = mat('Chrome', '#dfe2e5', .95, .15)
LOCKBLUE = mat('LockBlue', '#2d7fd1', .2, .35)
MC_DARK = mat('BreakerDark', '#65696d', 0, .5)
MC_LIGHT = mat('BreakerLight', '#d6d8d9', 0, .45)
MC_TGL = mat('BreakerToggle', '#55595c', 0, .4)
ELB = mat('ElbGrey', '#bcbfc1', 0, .5)
ORANGE = mat('ElbOrange', '#e8742a', 0, .45)
TIMER_B = mat('TimerBase', '#aeb3b7', 0, .5)
TIMER_C = mat('TimerCover', '#e8f2f6', 0, .05, alpha=.28)
DIAL = mat('TimerDial', '#fbfbf8', 0, .5)
# 상 색(사용자 지시 · 현장 부스바 사진 144544): L1 검 · L2 빨 · L3 파 · N 흰. 220V 는 L1(검) + N(흰)에서 딴다.
WL1 = mat('WireL1Black', '#1d1f21', 0, .5)
WL2 = mat('WireL2Red', '#c8262a', 0, .45)
WL3 = mat('WireL3Blue', '#2a55c0', 0, .45)
WN = mat('WireNWhite', '#eeeeea', 0, .45)
COPPER = mat('Copper', '#c07a45', .9, .35)
RUBBER = mat('Rubber', '#232526', 0, .8)

BUCKETS = {}
def emit(group, m, verts, faces, closed=False):
    if closed:
        vol = 0.
        for idx, _ in faces:
            a = verts[idx[0]]
            for k in range(1, len(idx) - 1): vol += a.dot(verts[idx[k]].cross(verts[idx[k + 1]]))
        if vol < 0: faces = [(tuple(reversed(i)), s) for i, s in faces]
    b = BUCKETS.setdefault((group, m), {'v': [], 'f': []}); o = len(b['v'])
    b['v'].extend(verts); b['f'].extend((tuple(i + o for i in idx), s) for idx, s in faces)
def rx(a): return Matrix.Rotation(a, 4, 'X')
def ry(a): return Matrix.Rotation(a, 4, 'Y')
def rz(a): return Matrix.Rotation(a, 4, 'Z')
AX = {'y': Matrix(), 'x': rz(-math.pi / 2), 'z': rx(math.pi / 2)}
_CV = [Vector(v) for v in [(-.5, -.5, -.5), (.5, -.5, -.5), (.5, .5, -.5), (-.5, .5, -.5), (-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)]]
_CF = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (0, 1, 5, 4), (3, 7, 6, 2)]
FRAME = [Matrix()]                     # 부품 좌표계 스택(가로로 누운 누전차단기 등)
def F(): return FRAME[-1]
def box(g, m, c, s, R=None):
    T = F() @ Matrix.Translation(Vector(c)) @ (R or Matrix()) @ Matrix.Diagonal((*s, 1))
    emit(g, m, [T @ v for v in _CV], [(f, False) for f in _CF], True)
def cyl(g, m, c, r, h, axis='y', seg=20, R=None, r2=None, smooth=True):
    T = F() @ Matrix.Translation(Vector(c)) @ (R or Matrix()) @ AX[axis]
    r2 = r if r2 is None else r2; v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v += [Vector((math.cos(a) * r, -h / 2, math.sin(a) * r)), Vector((math.cos(a) * r2, h / 2, math.sin(a) * r2))]
    f = [((2 * i, 2 * i + 1, 2 * ((i + 1) % seg) + 1, 2 * ((i + 1) % seg)), smooth) for i in range(seg)]
    f += [(tuple(2 * i for i in range(seg)), False), (tuple(2 * i + 1 for i in reversed(range(seg))), False)]
    emit(g, m, [T @ p for p in v], f, True)
def torus(g, m, c, R_, r, seg=24, tseg=8, Rm=None):
    T = F() @ Matrix.Translation(Vector(c)) @ (Rm or Matrix()); v = []
    for i in range(seg):
        u = 2 * math.pi * i / seg
        for j in range(tseg):
            w = 2 * math.pi * j / tseg
            v.append(T @ Vector(((R_ + r * math.cos(w)) * math.cos(u), r * math.sin(w), (R_ + r * math.cos(w)) * math.sin(u))))
    f = [((i * tseg + j, i * tseg + (j + 1) % tseg, ((i + 1) % seg) * tseg + (j + 1) % tseg, ((i + 1) % seg) * tseg + j), True)
         for i in range(seg) for j in range(tseg)]
    emit(g, m, v, f, True)
def tube(g, m, pts, r, seg=8):
    pts = [F() @ Vector(p) for p in pts]; tans = []
    for i in range(len(pts)): tans.append((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized())
    n = tans[0].orthogonal().normalized(); v = []
    for i, p in enumerate(pts):
        if i: n = (n - tans[i] * n.dot(tans[i])).normalized()
        bn = tans[i].cross(n)
        for j in range(seg):
            a = 2 * math.pi * j / seg; v.append(p + (n * math.cos(a) + bn * math.sin(a)) * r)
    f = [((i * seg + j, i * seg + (j + 1) % seg, (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j), True)
         for i in range(len(pts) - 1) for j in range(seg)]
    k = (len(pts) - 1) * seg
    f += [(tuple(range(seg)), False), (tuple(k + j for j in reversed(range(seg))), False)]
    emit(g, m, v, f, True)
def rounded(pts, rad=.015, steps=5):
    pts = [Vector(p) for p in pts]; out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p, a, b = pts[i], pts[i - 1], pts[i + 1]
        t = min(rad, (p - a).length * .45, (b - p).length * .45)
        s = p + (a - p).normalized() * t; e = p + (b - p).normalized() * t
        for k in range(steps + 1):
            u = k / steps; out.append(s.lerp(p, u).lerp(p.lerp(e, u), u))
    out.append(pts[-1]); return out
def flat(g, m, pts): emit(g, m, [F() @ Vector(p) for p in pts], [(tuple(range(len(pts))), False)])
def text(g, m, body, origin, height, max_w=None, font=None, right=(1, 0, 0), up=(0, 1, 0), lift=.0002, align='CENTER'):
    c = bpy.data.curves.new('t', 'FONT'); c.body = body; c.font = font or FONT
    c.size = 1; c.align_x = align; c.align_y = 'CENTER'; c.resolution_u = 3
    o = bpy.data.objects.new('t', c); bpy.context.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh()
    vs = [v.co.copy() for v in me.vertices]; fs = [tuple(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(c)
    if not vs: return
    xs = [v.x for v in vs]; ys = [v.y for v in vs]
    cx = (min(xs) + max(xs)) / 2 if align == 'CENTER' else min(xs); cy = (min(ys) + max(ys)) / 2
    s = height / max(max(ys) - min(ys), 1e-6)
    if max_w: s = min(s, max_w / max(max(xs) - min(xs), 1e-6))
    R, U = Vector(right).normalized(), Vector(up).normalized(); N = R.cross(U)
    O = Vector(origin) + N * lift
    emit(g, m, [F() @ (O + R * ((v.x - cx) * s) + U * ((v.y - cy) * s)) for v in vs], [(f, False) for f in fs])
def lines(g, x, y, z, w, n, pitch, m=INK, t=.0008):
    for k in range(n): box(g, m, (x - w * .04 * (k % 3), y - k * pitch, z), (w * (.62 + .3 * ((k * 5) % 7) / 7), t, .0002))
def screw(g, x, y, z, r=.0038, m=STEEL):
    cyl(g, m, (x, y, z + .0008), r, .0016, 'z', 12)
    box(g, INK, (x, y, z + .0017), (r * 1.3, r * .28, .0002)); box(g, INK, (x, y, z + .0017), (r * .28, r * 1.3, .0002))

# ══ 1. ARD ═══════════════════════════════════════════════════════════════
A = 'ARD'
y0, zf = AS, AD
box(A, BLUE, (0, y0 + AH / 2, AD / 2 - .002), (AW, AH, AD - .004))
box(A, BLUE, (0, y0 + AH / 2, AD - .001), (AW - .006, AH - .006, .002))                     # 앞 덮개
for sx in (-1, 1):                                                                            # 덮개 절곡 모서리 음영
    box(A, BLUE_D, (sx * (AW / 2 - .0015), y0 + AH / 2, AD - .002), (.003, AH - .004, .004))
for sy in (0, 1): box(A, BLUE_D, (0, y0 + sy * AH + (1 - 2 * sy) * .0015, AD - .002), (AW - .004, .003, .004))
for sx in (-1, 1):
    for fy in (.13, .84): screw(A, sx * (AW / 2 - .026), y0 + AH * fy, zf)
for sx in (-1, 1):                                                                            # 아이볼트
    x = sx * .15
    cyl(A, STEEL, (x, y0 + AH + .006, AD / 2), .011, .012, 'y', 16)
    cyl(A, STEEL, (x, y0 + AH + .016, AD / 2), .006, .012, 'y', 12)
    torus(A, STEEL, (x, y0 + AH + .041, AD / 2), .019, .0052, 28, 8, Rm=rx(math.pi / 2))
# 표시창: 검은 판 + LCD + 하늘색 띠 + 로고
dx, dy = 0, y0 + AH - .165
box(A, BLACK, (dx, dy, zf + .0015), (.15, .10, .003))
box(A, CYAN, (dx, dy - .038, zf + .0032), (.15, .024, .0006))
text(A, WHITE, 'BETA-ARD', (dx, dy + .030, zf + .0032), .017, .10, ITAL)
box(A, INK, (dx, dy + .004, zf + .0032), (.085, .022, .0005))
box(A, LCD, (dx, dy + .004, zf + .0037), (.078, .016, .0004))
text(A, LCD_T, 'NORMAL  AC OK', (dx, dy + .0075, zf + .0041), .0038, .07)
text(A, LCD_T, 'BATT 100%   RUN', (dx, dy + .0005, zf + .0041), .0038, .07)
text(A, WHITE, 'AUTO RESCUE DEVICE', (dx, dy - .019, zf + .0032), .0068, .11, BOLD)
# 고압주의 스티커
kx, ky = -.012, y0 + AH * .47
box(A, WHITE, (kx, ky, zf + .0012), (.068, .098, .0006))
box(A, RED, (kx, ky + .038, zf + .0016), (.064, .018, .0004))
text(A, WHITE, '고압주의', (kx, ky + .038, zf + .0019), .010, .058, BOLD)
flat(A, YEL, [(kx - .026, ky - .03, zf + .0017), (kx + .026, ky - .03, zf + .0017), (kx, ky + .018, zf + .0017)])
flat(A, INK, [(kx + .004, ky + .010, zf + .0019), (kx - .008, ky - .008, zf + .0019), (kx - .001, ky - .008, zf + .0019),
              (kx - .005, ky - .026, zf + .0019), (kx + .009, ky - .004, zf + .0019), (kx + .002, ky - .004, zf + .0019)])
box(A, INK, (kx, ky - .042, zf + .0016), (.045, .006, .0003))
# 배터리 주의 스티커
bx_, by_ = .056, y0 + AH * .44
box(A, WHITE, (bx_, by_, zf + .0012), (.05, .042, .0006))
box(A, RED, (bx_, by_ + .015, zf + .0016), (.048, .009, .0004))
text(A, WHITE, 'BATTERY 주의', (bx_, by_ + .015, zf + .0019), .005, .044, BOLD)
lines(A, bx_ + .002, by_ + .005, zf + .0016, .042, 5, .0045)
# 하부 루버 3줄(볼록 후드)
for k in range(3):
    y = y0 + .085 - k * .018
    box(A, BLACK, (0, y, zf + .0006), (.058, .006, .0012))
    box(A, BLUE, (0, y + .0035, zf + .004), (.062, .003, .007), R=rx(-.6))
# 노란 주의 라벨(좌하) · 명판(우하)
box(A, YEL, (-AW / 2 + .07, y0 + .06, zf + .0012), (.085, .052, .0006))
lines(A, -AW / 2 + .072, y0 + .078, zf + .0016, .075, 6, .0068)
box(A, ZINC, (AW / 2 - .075, y0 + .055, zf + .0012), (.09, .045, .0008))
text(A, INK, '자동구출운전장치', (AW / 2 - .075, y0 + .07, zf + .0017), .0055, .06, BOLD)
lines(A, AW / 2 - .073, y0 + .06, zf + .0017, .08, 4, .006)
box(A, INK, (AW / 2 - .04, y0 + .045, zf + .0017), (.012, .012, .0003))
# 옆면(+X): 손잡이 홈 + 위쪽 루버, 반대편(-X)도 손잡이 홈
for sx in (-1, 1):
    xs = sx * (AW / 2 + .0006)
    box(A, BLACK, (xs, y0 + AH * .62, AD * .5), (.0015, .075, .07))
    box(A, BLACK, (sx * (AW / 2 - .006), y0 + AH * .62, AD * .5), (.012, .065, .06))
    for k in range(3):
        box(A, BLACK, (xs, y0 + AH - .05 - k * .016, AD * .78), (.0015, .005, .04))
# 앵글 받침대
for sx in (-1, 1):
    for sz in (0, 1):
        x, z = sx * (AW / 2 - .02), .02 + sz * (AD - .04)
        box(A, STEEL, (x, AS / 2, z), (.03, AS, .003)); box(A, STEEL, (x, AS / 2, z), (.003, AS, .03))
        box(A, STEEL, (x, .002, z), (.05, .004, .05))
for sz in (0, 1): box(A, STEEL, (0, AS - .015, .02 + sz * (AD - .04)), (AW - .01, .03, .003))
for sx in (-1, 1): box(A, STEEL, (sx * (AW / 2 - .02), AS - .015, AD / 2), (.003, .03, AD - .04))

# ══ 2. 분전함 (P-ELEV) ════════════════════════════════════════════════════
BO, DR, IN, SW = 'BoxBody', 'BoxDoor', 'BoxInterior', 'LightSwitch'
bd = BD - DOOR_T
T_ = .0015
box(BO, GREIGE, (0, BH / 2, T_ / 2), (BW, BH, T_))                                             # 뒷판
for sx in (-1, 1): box(BO, GREIGE, (sx * (BW / 2 - T_ / 2), BH / 2, bd / 2), (T_, BH, bd))
for sy in (0, 1): box(BO, GREIGE, (0, sy * BH + (1 - 2 * sy) * T_ / 2, bd / 2), (BW, T_, bd))
for sx in (-1, 1): box(BO, GREIGE, (sx * (BW / 2 - .009), BH / 2, bd - .001), (.018, BH - .004, .002))   # 앞 절곡 테
for sy in (0, 1): box(BO, GREIGE, (0, .009 + sy * (BH - .018), bd - .001), (BW - .004, .018, .002))
cyl(BO, RUBBER, (CABLE_X, .001, .028), .024, .004, 'y', 20)                                     # 아래 인출구(부싱) — 인입·조명선은 벽 매립(뒷판 부싱)
for sy in (.1, .9): box(BO, STEEL, (BW / 2 + .0008, BH * sy, bd), (.002, .05, .006))           # 경첩(오른쪽)
# 문 (피벗 = 오른쪽 앞 모서리 경첩축)
HX = BW / 2 - .002
dw, dh = BW - .004, BH - .004
dcx, dcz = -dw / 2 - .0005, -DOOR_T / 2                          # 피벗 기준 문 중심(문 부품은 피벗 상대 좌표)
box(DR, GREIGE, (dcx, 0, dcz + DOOR_T * .375), (dw, dh, DOOR_T * .25))                        # 앞판
for sx in (-1, 1): box(DR, GREIGE, (dcx + sx * (dw / 2 - .0008), 0, dcz - DOOR_T * .2), (.0016, dh, DOOR_T * .7))
for sy in (-1, 1): box(DR, GREIGE, (dcx, sy * (dh / 2 - .0008), dcz - DOOR_T * .2), (dw, .0016, DOOR_T * .7))
fz = dcz + DOOR_T / 2
hxl = dcx - dw / 2 + .045
box(DR, CHROME, (hxl, -.02, fz + .0015), (.024, .088, .003))                                   # 스윙 핸들
box(DR, CHROME, (hxl, -.026, fz + .008), (.012, .062, .01))
cyl(DR, CHROME, (hxl, -.056, fz + .008), .006, .012, 'x', 12)
cyl(DR, LOCKBLUE, (hxl, .018, fz + .004), .0048, .006, 'z', 16)
box(DR, INK, (hxl, .018, fz + .0072), (.0012, .005, .0004))
box(DR, WHITE, (dcx, dh / 2 - .055, fz + .0006), (.092, .024, .0012))
text(DR, INK, 'P-ELEV', (dcx, dh / 2 - .055, fz + .0013), .012, .075, BOLD)
box(DR, WHITE, (dcx, 0, dcz - DOOR_T * .55), (.15, .19, .0006))                              # 문 안쪽 회로표
text(DR, INK, '회 로 표', (dcx, .08, dcz - DOOR_T * .55 - .0004), .009, .06, BOLD, right=(-1, 0, 0))
for k in range(4):
    box(DR, INK, (dcx, .055 - k * .036, dcz - DOOR_T * .55 - .0004), (.14, .0008, .0002))
for k, lab in enumerate(('주 차단기  50A  3φ4W 380V', '조명 누전  20A  1φ 220V', '타이머 → 기계실 조명', '예비')):
    text(DR, INK, lab, (dcx, .04 - k * .036, dcz - DOOR_T * .55 - .0004), .0058, .13, right=(-1, 0, 0))
# 내부 취부판
IZ = .012
box(IN, ZINC, (0, BH / 2, IZ - .001), (BW - .012, BH - .012, .002))
# 2-1 칼각 정리(사진 144544): 주차단기 위 → 아래로 부스바(색 수축튜브) → 투명 아크릴 커버, 분기는 직각 배선 + 링단자 + 케이블타이.
#     인입(벽 매립)은 뒷판 위쪽 부싱으로 나와 직각으로 꺾여 1차 단자에 물린다. 조명선도 뒷판 부싱으로 벽 속으로 들어간다.
def kal(pts, r=.0045):
    """칼각 배선 — 직교 꺾임점만 받아 아주 작은 반경으로만 둥글린다."""
    return rounded(pts, r, 3)
def lug(x, y, z, m):
    box(IN, COPPER, (x, y, z), (.009, .012, .0012))
    cyl(IN, STEEL, (x, y, z + .0012), .0032, .0016, 'z', 10)
    box(IN, m, (x, y - .011, z - .0004), (.0072, .012, .0072))                    # 절연 슬리브
def tie(x, y, z, w, h, horizontal=True):
    box(IN, WHITE, (x, y, z), (w + .004, .0035, h + .004) if horizontal else (.0035, w + .004, h + .004))
PH = [WL1, WL2, WL3, WN]
# 50A 4P MCCB (사진 98ff1bcd, 380V) — 위 가운데
mx, my = .04, .33
mw, mh, md = .102, .13, .068
z1 = IZ + md
box(IN, MC_DARK, (mx, my, IZ + md * .45), (mw, mh, md * .9))
box(IN, MC_LIGHT, (mx - .006, my - .002, z1 - .003), (mw * .78, mh * .5, .006))
box(IN, MC_DARK, (mx + mw * .38, my - .002, z1 - .003), (mw * .2, mh * .5, .006))
poles = [mx - mw / 2 + (j + .5) * mw / 4 for j in range(4)]
for sy in (1, -1):
    yt = my + sy * (mh / 2 - .016)
    box(IN, MC_DARK, (mx, yt, z1 - .004), (mw, .03, .008))
    for j in range(4):
        box(IN, STEEL, (poles[j], yt + sy * .004, z1 + .0005), (.014, .012, .002))
        cyl(IN, STEEL, (poles[j], yt + sy * .004, z1 + .0018), .0045, .0012, 'z', 12)
        box(IN, INK, (poles[j], yt + sy * .004, z1 + .0026), (.006, .0012, .0003))
        if j: box(IN, MC_DARK, (mx - mw / 2 + j * mw / 4, yt, z1 + .003), (.003, .026, .008))
box(IN, MC_DARK, (mx - .006, my - .004, z1 + .002), (.03, .05, .006))
# Independent toggle pivot: local coordinates; animation does not move the breaker body.
MCCB_PIVOT = Vector((mx - .006, my + .006, z1 + .008))
box('MainBreakerToggle', MC_TGL, (0, 0, 0), (.018, .022, .01))
box(IN, WHITE, (mx - .006, my - .022, z1 + .0052), (.016, .007, .0004))
text(IN, INK, '50A', (mx - .006, my - .022, z1 + .0056), .0045, .014, BOLD)
box(IN, RED, (mx + .015, my - .024, z1 + .0015), (.004, .006, .002))
text(IN, INK, 'MCCB', (mx + .022, my + .021, z1 + .0001), .0035, .016, BOLD)
text(IN, INK, 'ABN 54c', (mx - .032, my + .021, z1 + .0001), .0036, .018, BOLD)
lines(IN, mx - .03, my + .012, z1 + .0001, .022, 6, .0042)
text(IN, INK, '4P 380V', (mx - .032, my - .026, z1 + .0001), .003, .018)
# 인입 — 뒷판 위 부싱(벽 매립) → 앞으로 → 1차 단자 (4선 나란히, 직각)
cyl(IN, RUBBER, (mx, BH - .03, IZ + .001), .022, .004, 'z', 20)
top_t = my + mh / 2 - .012
for j, m in enumerate(PH):
    x = mx - .012 + j * .008
    tube(IN, m, kal([(x, BH - .03, IZ), (x, BH - .03, z1 + .006), (poles[j], BH - .03, z1 + .006), (poles[j], top_t + .004, z1 + .006)]), .0032)
tie(mx, BH - .03, z1 + .006, .105, .0065)
# 부스바: 2차 단자 → 뒤로 꺾여(칼각) 부스바 평면 → 수직 하강. 절연 받침(흰) 위, 색 수축튜브, 이음부 구리 노출.
BZ = IZ + .026
bot_t = my - mh / 2 + .012
BUS_Y0 = .085
for j, m in enumerate(PH):
    x = poles[j]
    box(IN, COPPER, (x, bot_t - .004, (z1 + BZ) / 2), (.012, .003, z1 - BZ))                  # 뒤로 꺾인 링크
    box(IN, COPPER, (x, (bot_t - .004 + BUS_Y0) / 2, BZ), (.012, bot_t - .004 - BUS_Y0, .003))
    box(IN, m, (x, (bot_t - .02 + BUS_Y0 + .02) / 2, BZ), (.0135, bot_t - .04 - BUS_Y0, .0042))  # 수축튜브
    for yb in (bot_t - .01, BUS_Y0 + .012):                                                    # 볼트
        cyl(IN, STEEL, (x, yb, BZ + .0028), .0026, .0022, 'z', 10)
for yb in (.23, .11):                                                                           # 절연 받침대
    box(IN, WHITE, (poles[0] + (poles[3] - poles[0]) / 2, yb, IZ + .011), (poles[3] - poles[0] + .02, .014, .022))
# 투명 아크릴 보호 커버 + 흰 스탠드오프
ax0, ax1, ay0, ay1 = poles[0] - .016, poles[3] + .016, BUS_Y0 + .004, bot_t - .012
box(IN, TIMER_C, ((ax0 + ax1) / 2, (ay0 + ay1) / 2, BZ + .014), (ax1 - ax0, ay1 - ay0, .002))
for x in (ax0 + .005, ax1 - .005):
    for y in (ay0 + .006, ay1 - .006):
        cyl(IN, WHITE, (x, y, IZ + (BZ + .013 - IZ) / 2), .0035, BZ + .013 - IZ, 'z', 10)
        cyl(IN, WHITE, (x, y, BZ + .0165), .0045, .003, 'z', 12)
# 220V 2P 누전차단기 — 가로로 누움(LINE → +X 부스바)
ELX, ELY = -.08, .17
FRAME.append(Matrix.Translation(Vector((ELX, ELY, IZ))) @ rz(-math.pi / 2))
ew, el, ed = .05, .10, .068
box(IN, ELB, (0, 0, ed / 2), (ew, el, ed))
box(IN, MC_DARK, (0, el / 2 - .012, ed - .006), (ew * .9, .02, .012))
for sx in (-1, 1):
    cyl(IN, INK, (sx * .012, el / 2 - .018, ed + .0002), .0065, .002, 'z', 16)
    cyl(IN, INK, (sx * .012, -el / 2 + .012, ed + .0002), .0055, .002, 'z', 16)
text(IN, INK, 'LINE', (0, el / 2 - .032, ed + .0002), .004, .02, BOLD)
box(IN, MC_TGL, (-.004, -.006, ed + .004), (.012, .02, .008))
box(IN, ORANGE, (.012, .012, ed + .0003), (.022, .01, .0005))
text(IN, WHITE, '누전차단기', (.012, .012, ed + .0007), .0032, .02, BOLD)
text(IN, INK, '20A', (.012, .001, ed + .0003), .0055, .018, BOLD)
text(IN, INK, 'AC 220V', (.012, -.008, ed + .0003), .0028, .018)
cyl(IN, YEL, (-.004, -.028, ed + .0015), .004, .003, 'z', 14)
FRAME.pop()
LINE_X, LOAD_X = ELX + .032, ELX - .038                     # 누전 LINE / LOAD 단자 X (월드 로컬)
TOPZ = IZ + .069
# 분기: L1 부스바 · N 부스바 → 링단자 → 수평 직선 → 누전 LINE (N 은 아크릴 위 앞쪽 층으로 건넌다)
for j, (pole, dy, zc) in enumerate(((0, -.012, BZ + .006), (3, .012, BZ + .024))):
    x, y = poles[pole], ELY + dy
    lug(x, .14 + j * .03, BZ + .0045, PH[pole])
    tube(IN, PH[pole], kal([(x, .129 + j * .03, zc), (x, y, zc), (LINE_X, y, zc), (LINE_X, y, TOPZ)]), .0024)
# 누전 LOAD → 타이머 (위로 직선)
tx, ty = -.105, .33
T_TERM = [tx - .024 + j * .016 for j in range(4)]
for j in range(2):
    y = ELY + (j * 2 - 1) * .012
    tube(IN, WL1 if j == 0 else WN, kal([(LOAD_X, y, TOPZ), (LOAD_X, y, IZ + .075), (T_TERM[j], y, IZ + .075), (T_TERM[j], ty - .043, IZ + .075), (T_TERM[j], ty - .043, IZ + .038)]), .0022)
tie(-.12 + .008, .235, IZ + .075, .02, .005, False)
# 타이머 (왼쪽 위)
box(IN, TIMER_B, (tx, ty, IZ + .02), (.072, .095, .04))
box(IN, TIMER_C, (tx, ty + .008, IZ + .052), (.068, .07, .024))
cyl(IN, DIAL, (tx, ty + .008, IZ + .042), .027, .004, 'z', 40)
for k in range(48):
    a = 2 * math.pi * k / 48
    box(IN, RED if 18 <= k < 34 else MC_DARK, (tx + math.cos(a) * .0245, ty + .008 + math.sin(a) * .0245, IZ + .0455), (.0022, .0022, .003), R=rz(a))
for k in range(12):
    a = math.pi / 2 - 2 * math.pi * k / 12
    text(IN, INK, str(k * 2), (tx + math.cos(a) * .017, ty + .008 + math.sin(a) * .017, IZ + .0443), .0032, .005)
box(IN, INK, (tx, ty + .014, IZ + .0448), (.0018, .014, .0006), R=rz(.9))
box(IN, INK, (tx + .003, ty + .010, IZ + .0449), (.0016, .02, .0006), R=rz(-.6))
for j in range(4):
    box(IN, STEEL, (T_TERM[j], ty - .043, IZ + .034), (.01, .008, .004))
    cyl(IN, STEEL, (T_TERM[j], ty - .043, IZ + .037), .003, .002, 'z', 10)
# 타이머 출력 → 뒷판 부싱(벽 매립 조명선)
cyl(IN, RUBBER, (tx + .016, .245, IZ + .001), .012, .004, 'z', 18)
for j in range(2):
    x = T_TERM[2 + j]
    tube(IN, WL1 if j == 0 else WN, kal([(x, ty - .043, IZ + .038), (x, ty - .043, IZ + .05), (x, .245, IZ + .05), (tx + .012 + j * .008, .245, IZ + .05), (tx + .012 + j * .008, .245, IZ)]), .0022)
# 2차 3상 → 아래 부싱(덕트 → ARD): 부스바 끝 링단자 → 수직 → 직각으로 모아 하강
for j in range(3):
    x = poles[j]
    lug(x, BUS_Y0 + .004, BZ + .0045, PH[j])
    xd = CABLE_X - .008 + j * .008
    tube(IN, PH[j], kal([(x, BUS_Y0 - .007, BZ + .006), (x, .045, BZ + .006), (xd, .045, BZ + .006), (xd, .004, BZ + .006)]), .0032)
tie(CABLE_X, .03, BZ + .006, .026, .0065)
# 접지 구리 단자바(우하)
box(IN, COPPER, (.12, .035, IZ + .012), (.06, .008, .004))
for k in range(5): cyl(IN, STEEL, (.096 + k * .012, .035, IZ + .0152), .0022, .0025, 'z', 8)
for k in range(2): box(IN, WHITE, (.093 + k * .054, .035, IZ + .005), (.008, .01, .01))
# ══ 3. 조명 스위치 (벽, 사진 120206) ═══════════════════════════════════════
box(SW, WHITE, (0, 0, .0045), (.072, .118, .009))
box(SW, WHITE, (0, 0, .0105), (.034, .062, .004))
box(SW, mat('SwitchShade', '#dcdcd6', 0, .45), (0, -.016, .0126), (.030, .026, .0006), R=rx(-.08))

# ══ 4. 메시 · 내보내기 ═══════════════════════════════════════════════════
def to_blender(v): return (v.x, -v.z, v.y)
PIVOT = {'ARD': Vector((0, 0, 0)), 'BoxBody': Vector((0, 0, 0)), 'BoxInterior': Vector((0, 0, 0)),
         'BoxDoor': Vector((HX, BH / 2, BD)), 'LightSwitch': Vector((0, 0, 0)), 'MainBreakerToggle': MCCB_PIVOT}
# 문 부품은 피벗 기준 좌표로 적었으므로 월드(로컬) 좌표 = 피벗 + 부품
def export(groups, dest, root_name, extras):
    bpy.ops.object.select_all(action='DESELECT')
    root = bpy.data.objects.new(root_name, None); bpy.context.collection.objects.link(root)
    for k, val in extras.items(): root[k] = val
    made = [root]
    for gname in groups:
        e = bpy.data.objects.new(gname, None); bpy.context.collection.objects.link(e); e.parent = root; made.append(e)
        piv = PIVOT[gname]
        if gname in ('BoxDoor', 'MainBreakerToggle'): e.location = to_blender(piv)
        for (g, mname), d in BUCKETS.items():
            if g != gname: continue
            me = bpy.data.meshes.new(f'{g}_{mname}')
            me.from_pydata([to_blender(v) for v in d['v']], [], [f for f, _ in d['f']]); me.update()
            for poly, (_, sm) in zip(me.polygons, d['f']): poly.use_smooth = sm
            me.materials.append(bpy.data.materials[mname])
            o = bpy.data.objects.new(f'{g}_{mname}', me); bpy.context.collection.objects.link(o); o.parent = e; made.append(o)
        print(gname, 'triangles', sum(sum(len(f) - 2 for f, _ in d['f']) for (g, _), d in BUCKETS.items() if g == gname))
    for o in made: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
    print('Exported', dest)
export(['ARD'], ROOT / 'models/gltf/ard.glb', 'AutoRescueDevice', SPEC['ard'])
export(['BoxBody', 'BoxDoor', 'BoxInterior', 'LightSwitch', 'MainBreakerToggle'], ROOT / 'models/gltf/elevator_distribution_box.glb', 'ElevatorDistributionBox', SPEC['db'])
