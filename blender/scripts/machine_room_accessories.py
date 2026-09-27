"""기계실 부속 — 브레이크 개방 레버 · 수동 핸들(현장 사진 검사기법/DSC04699) + 제어반 옆 인터폰(스크린샷 133148·133136).
좌표는 Three.js 로컬(+Y 위)로 적고 메시 생성 때 Blender(x, -z, y)로 옮긴다. 미터 단위, 실물 치수.
공구 두 개는 벽 걸쇠에 거는 자세로 만든다: 로컬 원점 = 걸쇠 핀 중심, +X = 벽에서 나오는 방향, Z = 벽을 따라.
  ReleaseLever  : 파이프 윗끝 걸이 고리의 구멍 윗면이 핀에 얹히고, 포크(U홈) 평판은 맨 아래에서 아래로 열린다.
  TurningHandle : 허브 구멍이 핀에 끼고 평철 팔이 아래로, 끝의 속 빈 파이프 손잡이는 +X(앞)로.
인터폰: 로컬 +Z = 앞면, z=0 = 부착면(뒷면), 원점 = 뒷면 중심. 수화기는 본체 위에 놓인 상태(오른쪽으로 번호판 한 줄이 보임).
색: 공구는 기존 JS 재질값(M.ss 0xa8b0b8 · 0x9ca3af, 손잡이 0x2a2a2a)을 그대로 쓴다 — Three 가 16진을 선형으로 읽으므로 변환하지 않는다.
실행: blender -b -P blender/scripts/machine_room_accessories.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
FONT = bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
BOLD = bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')

# ── 레버 치수 (사진 비율: 파이프 OD 27mm 기준) ──
LEV_PLATE = (.057, .130, .008)        # 폭(Z) · 길이(Y) · 두께(X)
LEV_SLOT = (.032, .033)               # U홈 폭 · 깊이
PEG_HALF = .006                       # 걸쇠 핀 반폭(JS addWallHook 12mm 각재)
LEV_PIPE_OD, LEV_PIPE_ID, LEV_PIPE_L, LEV_PIPE_OVERLAP = .027, .021, .354, .054
LEV_EYE = (.019, .011, .008)          # 걸이 고리 외반경 · 구멍 반경(핀 12mm 각 대각 17mm < 22mm) · 두께
# ── 핸들 치수 ──
HND_BAR = (.043, .354, .010)          # 폭(Z) · 허브 중심~손잡이 중심(Y) · 두께(X)
HND_HUB = (.067, .044, .040)          # 외경 · 축 구멍 · 두께(X)
HND_GRIP = (.033, .026, .070)         # 외경 · 내경 · 길이(+X)
HND_BOLT = (.005, .045, .0095)        # 나사 반경 · 길이 · 머리 반경

for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for item in list(block): block.remove(item)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)
def raw(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
MATS = {}
def mat(name, rgb, metal=0., rough=.6, clearcoat=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if clearcoat: p.inputs['Coat Weight'].default_value = clearcoat
    MATS[name] = m; return name
LEV = mat('ReleaseLeverSteel', raw('#a8b0b8'), .3, .6)          # = M.ss(0xa8b0b8)
HND = mat('TurningHandleSteel', raw('#9ca3af'), .3, .6)         # = M.ss(0x9ca3af)
GRIP = mat('TurningHandleGrip', raw('#2a2a2a'), .1, .5, .8)     # = M.paint(0x2a2a2a)
BOLT = mat('ZincBolt', raw('#8a8e86'), .85, .35)
BORE = mat('BoreShadow', raw('#2a2a2a'), .2, .7)
PH_W = mat('PhoneWhite', lin('#f3f2ee'), 0, .32)
PH_R = mat('PhoneRedBrown', lin('#7e3325'), 0, .5)
PH_S = mat('PhoneSilverKey', lin('#c9ccd0'), .7, .3)
PH_K = mat('PhoneInk', lin('#1c1c1c'), 0, .6)
PH_G = mat('PhoneGrommet', lin('#262626'), 0, .7)

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
def box(g, m, c, s, R=None):
    T = Matrix.Translation(Vector(c)) @ (R or Matrix()) @ Matrix.Diagonal((*s, 1))
    emit(g, m, [T @ v for v in _CV], [(f, False) for f in _CF], True)
def cyl(g, m, c, r, h, axis='y', seg=24, R=None, rz_=None, sides_smooth=True):
    T = Matrix.Translation(Vector(c)) @ (R or Matrix()) @ AX[axis]
    rz_ = r if rz_ is None else rz_
    v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v += [Vector((math.cos(a) * r, -h / 2, math.sin(a) * rz_)), Vector((math.cos(a) * r, h / 2, math.sin(a) * rz_))]
    f = [((2 * i, 2 * i + 1, 2 * ((i + 1) % seg) + 1, 2 * ((i + 1) % seg)), sides_smooth) for i in range(seg)]
    f += [(tuple(2 * i for i in range(seg)), False), (tuple(2 * i + 1 for i in reversed(range(seg))), False)]
    emit(g, m, [T @ p for p in v], f, True)
def pipe(g, m, c, ro, ri, h, axis='y', seg=28, R=None, inner=None):
    """속 빈 관: 바깥벽·안벽·양끝 고리면. 안벽 재질을 따로 줄 수 있다."""
    T = Matrix.Translation(Vector(c)) @ (R or Matrix()) @ AX[axis]
    ob, ot, ib, it = [], [], [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg; ca, sa = math.cos(a), math.sin(a)
        ob.append(T @ Vector((ca * ro, -h / 2, sa * ro))); ot.append(T @ Vector((ca * ro, h / 2, sa * ro)))
        ib.append(T @ Vector((ca * ri, -h / 2, sa * ri))); it.append(T @ Vector((ca * ri, h / 2, sa * ri)))
    v = ob + ot + ib + it; OB, OT, IB, IT = 0, seg, 2 * seg, 3 * seg
    outer, rest = [], []
    for i in range(seg):
        j = (i + 1) % seg
        outer.append(((OB + i, OT + i, OT + j, OB + j), True))
        rest.append(((OT + i, IT + i, IT + j, OT + j), False))
        rest.append(((OB + j, IB + j, IB + i, OB + i), False))
        rest.append(((IB + j, IT + j, IT + i, IB + i), True))
    faces = outer + rest
    vol = 0.
    for idx, _ in faces:
        a = v[idx[0]]
        for k in range(1, len(idx) - 1): vol += a.dot(v[idx[k]].cross(v[idx[k + 1]]))
    if vol < 0: faces = [(tuple(reversed(i)), s) for i, s in faces]
    if inner is None: emit(g, m, v, faces)
    else:
        emit(g, m, v, [fc for fc in faces if not all(i >= IB for i in fc[0])])
        emit(g, inner, v, [fc for fc in faces if all(i >= IB for i in fc[0])])
def sphere(g, m, c, rad, seg=20, rings=12):
    T = Matrix.Translation(Vector(c)) @ Matrix.Diagonal((*rad, 1))
    v = [Vector((0, 1, 0))]
    for i in range(1, rings):
        t = math.pi * i / rings
        for j in range(seg):
            p = 2 * math.pi * j / seg
            v.append(Vector((math.sin(t) * math.cos(p), math.cos(t), math.sin(t) * math.sin(p))))
    v.append(Vector((0, -1, 0)))
    f = [((0, 1 + (j + 1) % seg, 1 + j), True) for j in range(seg)]
    for i in range(rings - 2):
        for j in range(seg):
            a = 1 + i * seg + j; b = 1 + i * seg + (j + 1) % seg
            f.append(((a, b, b + seg, a + seg), True))
    last = len(v) - 1; base = 1 + (rings - 2) * seg
    f += [((last, base + j, base + (j + 1) % seg), True) for j in range(seg)]
    emit(g, m, [T @ p for p in v], f, True)
def tube(g, m, pts, r, seg=8):
    pts = [Vector(p) for p in pts]; tans = []
    for i in range(len(pts)):
        tans.append((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized())
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
def rounded(pts, rad=.02, steps=5):
    pts = [Vector(p) for p in pts]; out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p, a, b = pts[i], pts[i - 1], pts[i + 1]
        t = min(rad, (p - a).length * .45, (b - p).length * .45)
        s = p + (a - p).normalized() * t; e = p + (b - p).normalized() * t
        for k in range(steps + 1):
            u = k / steps; out.append(s.lerp(p, u).lerp(p.lerp(e, u), u))
    out.append(pts[-1]); return out
def plate_poly(g, m, outline, t, M):
    """(u,v) 다각형(반시계)을 두께 t 로 압출한 판 — M: (u,v,w) → 로컬."""
    n = len(outline)
    v = [M @ Vector((u, w_, -t / 2)) for u, w_ in outline] + [M @ Vector((u, w_, t / 2)) for u, w_ in outline]
    f = [(tuple(reversed(range(n))), False), (tuple(range(n, 2 * n)), False)]
    f += [((i, (i + 1) % n, n + (i + 1) % n, n + i), False) for i in range(n)]
    emit(g, m, v, f, True)
def text(g, m, body, origin, right, up, height, max_w=None, bold=False, lift=.0002):
    c = bpy.data.curves.new('t', 'FONT'); c.body = body; c.font = BOLD if bold else FONT
    c.size = 1; c.align_x = 'CENTER'; c.align_y = 'CENTER'; c.resolution_u = 3
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
    emit(g, m, [O + R * ((v.x - cx) * s) + U * ((v.y - cy) * s) for v in vs], [(f, False) for f in fs])

# ══ 1. 브레이크 개방 레버 — 위: 걸이 고리 → 파이프 → 아래: 포크 평판(앞발이 아래로) ══
# ★걸림 원리: 고리 구멍 윗면이 핀 윗면에 얹힌다(무게가 핀 위에 실림). 옛 형상처럼 U홈이 위로 열린 채
#   핀에 끼우면 받쳐 주는 재료가 핀 아래에 있어 그대로 떨어진다 — 사용자 지적 140613.
L = 'ReleaseLever'
pw, pl, pt = LEV_PLATE; sw, sd = LEV_SLOT
pr = LEV_PIPE_OD / 2
eo, ei, et = LEV_EYE                                                       # 고리 외반경 · 구멍 반경 · 두께(X)
eye_y = PEG_HALF - ei                                                      # 구멍 윗면 = 핀 윗면
pipe(L, LEV, (0, eye_y, 0), eo, ei, et, 'x', 32, inner=BORE)              # 걸이 고리(구멍 축 = 핀 방향 X)
neck_top, neck_bot = eye_y - eo + .004, eye_y - eo - .030
box(L, LEV, (0, (neck_top + neck_bot) / 2, 0), (et, neck_top - neck_bot, .022))   # 목 — 파이프 끝 슬롯에 꽂아 용접
p_top = eye_y - eo - .012                                                  # 파이프 윗단
pipe(L, LEV, (0, p_top - LEV_PIPE_L / 2, 0), pr, LEV_PIPE_ID / 2, LEV_PIPE_L, 'y', 28, inner=BORE)
tube(L, LEV, [(math.cos(k * math.pi / 14) * (pr + .0006), p_top, math.sin(k * math.pi / 14) * (pr + .0006)) for k in range(29)], .0022, 6)   # 파이프 입구 둘레 용접
for sz in (-1, 1):                                                         # 목-파이프 필렛
    box(L, LEV, (0, p_top + .003, sz * .011), (et + .003, .007, .004))
# 포크 평판: 파이프 벽쪽(-X) 면에 겹쳐 용접, U홈은 아래로 열린다(브레이크 암에 끼우는 앞발).
p_bot = p_top - LEV_PIPE_L
top = p_bot + LEV_PIPE_OVERLAP
bot = top - pl
outline = [(-pw / 2, bot), (-sw / 2, bot), (-sw / 2, bot + sd), (sw / 2, bot + sd), (sw / 2, bot),
           (pw / 2, bot), (pw / 2, top), (-pw / 2, top)]
px_ = -(pr + pt / 2 - .001)
M_plate = Matrix(((0, 0, 1, px_), (0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 0, 1)))   # (u,v,w) → (x=px_+w, y=v, z=u)
plate_poly(L, LEV, outline, pt, M_plate)
for sz in (-1, 1):                                                         # 파이프-판 필렛 용접
    tube(L, LEV, [(-pr + .0015, top - .002, sz * pr * .72), (-pr + .0015, p_bot + .004, sz * pr * .72)], .0022, 6)
tube(L, LEV, rounded([(-pr * .6, top + .0005, -pr * .72), (-pr * .2, top + .003, 0), (-pr * .6, top + .0005, pr * .72)], .01), .0022, 6)

# ══ 2. 수동 핸들 — 허브(축 구멍 + 고정 볼트) · 평철 팔 · 속 빈 파이프 손잡이 ══
H = 'TurningHandle'
bw, bl, bt = HND_BAR; hod, hid, hth = HND_HUB
hub_y = -(hid / 2 - PEG_HALF)                                             # 축 구멍 윗면이 핀에 얹힌다
pipe(H, HND, (0, hub_y, 0), hod / 2, hid / 2, hth, 'x', 32, inner=BORE)
grip_y = hub_y - bl
box(H, HND, (0, (hub_y + grip_y) / 2 - .01, 0), (bt, bl + .01, bw))       # 평철 팔(허브 중심 → 손잡이 너머 20mm)
for s in (-1, 1):                                                          # 허브-팔 목 필렛
    box(H, HND, (0, hub_y - hod / 2 + .004, s * (bw / 2 - .002)), (bt * 1.4, .014, .006), R=rx(s * .5))
cyl(H, HND, (0, hub_y + hod / 2 + .003, 0), .0095, .012, 'y', 16)       # 볼트 보스
cyl(H, BOLT, (0, hub_y + hod / 2 + .009 + HND_BOLT[1] / 2 - .012, 0), HND_BOLT[0], HND_BOLT[1] - .012, 'y', 12)
for k in range(10):                                                        # 나사산
    cyl(H, BOLT, (0, hub_y + hod / 2 + .012 + k * .0032, 0), HND_BOLT[0] + .0006, .0012, 'y', 12)
cyl(H, BOLT, (0, hub_y + hod / 2 + HND_BOLT[1], 0), HND_BOLT[2], .0065, 'y', 6, sides_smooth=False)   # 육각 머리
cyl(H, BOLT, (0, hub_y + hod / 2 + .012, 0), HND_BOLT[2], .005, 'y', 6, sides_smooth=False)          # 잠금 너트
god, gid, gl = HND_GRIP
pipe(H, GRIP, (bt / 2 + gl / 2, grip_y, 0), god / 2, gid / 2, gl, 'x', 28, inner=BORE)
tube(H, HND, rounded([(bt / 2 + .001, grip_y + god / 2 + .001, -.004), (bt / 2 + .001, grip_y, -god / 2 - .002),
                      (bt / 2 + .001, grip_y - god / 2 - .001, .004)], .012), .0018, 6)

# ══ 3. 인터폰 — 흰 트림형 벽걸이 전화기 + 적갈색 앞판, 수화기 거치 상태 ═════
P = 'IntercomPhone'
BW_, BH_, BD_ = .086, .226, .040
cyl(P, PH_W, (0, BH_ / 2 - BW_ / 2, BD_ / 2), BW_ / 2, BD_, 'z', 36)
cyl(P, PH_W, (0, -BH_ / 2 + BW_ / 2, BD_ / 2), BW_ / 2, BD_, 'z', 36)
box(P, PH_W, (0, 0, BD_ / 2), (BW_, BH_ - BW_, BD_))
fw = BW_ - .012
cyl(P, PH_R, (0, BH_ / 2 - BW_ / 2, BD_ + .0015), fw / 2, .003, 'z', 36)
cyl(P, PH_R, (0, -BH_ / 2 + BW_ / 2, BD_ + .0015), fw / 2, .003, 'z', 36)
box(P, PH_R, (0, 0, BD_ + .0015), (fw, BH_ - BW_, .003))
zf = BD_ + .003
cyl(P, PH_W, (.024, BH_ / 2 - .03, zf + .004), .006, .008, 'z', 16)      # 후크 스위치
keys = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']]
for r, row in enumerate(keys):
    for c, lab in enumerate(row):
        kx, ky = -.022 + c * .0215, .030 - r * .0165
        cyl(P, PH_S, (kx, ky, zf + .0022), .0072, .0044, 'z', 20, rz_=.0056)
        text(P, PH_K, lab, (kx, ky, zf + .0045), (1, 0, 0), (0, 1, 0), .0055, .009, True)
for k, lab in enumerate(('재다이얼', '저장', '통화')):
    kx, ky = -.022 + k * .0215, -.042
    cyl(P, PH_S, (kx, ky, zf + .0018), .0065, .0036, 'z', 18, rz_=.0038)
    text(P, PH_W, lab, (kx, ky - .009, zf + .0002), (1, 0, 0), (0, 1, 0), .0028, .018)
box(P, PH_S, (.031, -.068, zf + .0015), (.010, .022, .003))              # 벨 음량 슬라이드
text(P, PH_W, '벨', (.031, -.084, zf + .0002), (1, 0, 0), (0, 1, 0), .003, .01)
# 수화기 — 왼쪽으로 12mm 비켜 놓여 오른쪽 번호 한 줄이 드러난다(사진 133136)
hx, hz0, HW_, HL_, HD_ = -.012, zf + .005, .054, .214, .030
cyl(P, PH_W, (hx, HL_ / 2 - HW_ / 2, hz0 + HD_ / 2), HW_ / 2, HD_, 'z', 36)
cyl(P, PH_W, (hx, -HL_ / 2 + HW_ / 2, hz0 + HD_ / 2), HW_ / 2, HD_, 'z', 36)
box(P, PH_W, (hx, 0, hz0 + HD_ / 2 - .004), (HW_ * .9, HL_ - HW_, HD_ - .008))
sphere(P, PH_W, (hx, 0, hz0 + HD_ - .006), (HW_ * .45, (HL_ - HW_) * .55, .008), 24, 10)
sphere(P, PH_R, (hx, HL_ / 2 - HW_ / 2 - .002, hz0 + HD_ - .0012), (.018, .024, .003), 24, 10)   # 수화부 적갈색 패드
text(P, PH_K, 'EMERGENCY CALL', (hx, HL_ / 2 - .008, hz0 + HD_ - .001), (1, 0, 0), (0, 1, 0), .0042, .044, True)
for k in range(6):                                                         # 송화부 구멍
    a = k * math.pi / 3
    cyl(P, PH_K, (hx + math.cos(a) * .006, -HL_ / 2 + HW_ / 2 + math.sin(a) * .006, hz0 + HD_ + .0002), .0012, .001, 'z', 8)
# 코일 줄: 수화기 아래 → 아래로 늘어졌다 → 본체 밑으로
coil = []
for k in range(260):
    a = k * .42; t = k / 259
    coil.append((hx + .004 + math.cos(a) * .0085, -HL_ / 2 - .012 - t * .20, hz0 + .012 + math.sin(a) * .0085))
tube(P, PH_W, [(hx, -HL_ / 2 + .004, hz0 + .012)] + coil + [(hx + .02, -HL_ / 2 - .225, hz0 + .006), (.024, -BH_ / 2 - .02, .018), (.024, -BH_ / 2 + .006, .018)], .0021, 6)
# 라인 코드 → 캐비닛 옆면 고무 부싱
tube(P, PH_W, rounded([(.012, -BH_ / 2 + .004, .012), (.012, -BH_ / 2 - .03, .012), (.012, -BH_ / 2 - .05, .002)], .012), .0026, 8)
cyl(P, PH_G, (.012, -BH_ / 2 - .05, .002), .0065, .004, 'z', 16)

# ══ 4. 메시 · 내보내기 ═══════════════════════════════════════════════════
def to_blender(v): return (v.x, -v.z, v.y)
def export(groups, dest, root_name, extras):
    bpy.ops.object.select_all(action='DESELECT')
    root = bpy.data.objects.new(root_name, None); bpy.context.collection.objects.link(root)
    for k, val in extras.items(): root[k] = val
    made = [root]
    for gname in groups:
        e = bpy.data.objects.new(gname, None); bpy.context.collection.objects.link(e); e.parent = root; made.append(e)
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
export(['ReleaseLever', 'TurningHandle'], ROOT / 'models/gltf/machine_room_tools.glb', 'MachineRoomTools',
       {'pegHalf': PEG_HALF, 'leverLength': round(eye_y + eo - bot, 4), 'handleLength': round(hub_y + hod / 2 - (grip_y - god / 2), 4)})
export(['IntercomPhone'], ROOT / 'models/gltf/intercom_phone.glb', 'IntercomPhoneRoot',
       {'width': BW_, 'height': BH_, 'depth': round(hz0 + HD_, 4)})
