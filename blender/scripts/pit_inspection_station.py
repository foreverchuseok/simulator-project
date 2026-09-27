"""피트 점검운전 스위치(펜던트형) + 벽 고정 브라켓. 참고 사진 65f55696(한자 제외, 영어만).
위에서부터 STOP(적색 버섯, 노란 가드) → NORMAL/INSPECTION 로터리 → UP(백, ↑) → COMMON(청, ↕) → DOWN(흑, ↓).
좌표는 Three.js 로컬(+Y 위, +Z 앞면, z=0 = 벽면, 원점 = 벽면에서 스테이션 중심 높이)로 적고 Blender(x, -z, y)로 옮긴다.
케이블은 위쪽 글랜드로 나간다(벽 간선을 따라 올라가므로). extras.cableExit = 글랜드 끝 로컬 좌표.
실행: blender -b -P blender/scripts/pit_inspection_station.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
W, H = .084, .270              # 본체 폭·높이
DF, DB = .030, .026            # 노란 앞 셸 · 회색 뒤 셸 두께
BR_T = .003                    # 브라켓 판 두께
Z0 = BR_T + .002               # 본체 뒷면
FRONT = Z0 + DB + DF
FONT = bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')

for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for item in list(block): block.remove(item)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)
def mat(name, hexcol, metal=0., rough=.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*lin(hexcol), 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    return name
YEL = mat('PitYellow', '#f2c41a', 0, .38)
GRY = mat('PitGreyShell', '#8f9396', 0, .5)
RED = mat('PitRed', '#c9372c', 0, .35)
BLK = mat('PitBlack', '#18191a', 0, .4)
BLU = mat('PitBlue', '#2459b8', 0, .3)
WHT = mat('PitWhite', '#f0efe8', 0, .35)
CHR = mat('PitChrome', '#d4d7da', .95, .18)
STL = mat('PitSteel', '#a9adb0', .8, .35)
INK = mat('PitInk', '#161616', 0, .6)
CBL = mat('PitCable', '#26282a', 0, .6)

BUCKET = {}
def emit(m, verts, faces, closed=True):
    if closed:
        vol = 0.
        for idx, _ in faces:
            a = verts[idx[0]]
            for k in range(1, len(idx) - 1): vol += a.dot(verts[idx[k]].cross(verts[idx[k + 1]]))
        if vol < 0: faces = [(tuple(reversed(i)), s) for i, s in faces]
    b = BUCKET.setdefault(m, {'v': [], 'f': []}); o = len(b['v'])
    b['v'].extend(verts); b['f'].extend((tuple(i + o for i in idx), s) for idx, s in faces)
def rx(a): return Matrix.Rotation(a, 4, 'X')
def rz(a): return Matrix.Rotation(a, 4, 'Z')
AX = {'y': Matrix(), 'x': rz(-math.pi / 2), 'z': rx(math.pi / 2)}
def rbox(m, c, s, r=0., seg=4):
    """모서리 둥근 상자(XY 평면 라운드, Z 방향 압출)."""
    w, h, d = s; r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    ring = []
    if r <= 0:
        ring = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    else:
        for cx, cy, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
            for k in range(seg + 1):
                a = math.radians(a0 + 90 * k / seg); ring.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    n = len(ring); C = Vector(c)
    v = [C + Vector((x, y, -d / 2)) for x, y in ring] + [C + Vector((x, y, d / 2)) for x, y in ring]
    f = [(tuple(reversed(range(n))), False), (tuple(range(n, 2 * n)), False)]
    f += [((i, (i + 1) % n, n + (i + 1) % n, n + i), bool(r)) for i in range(n)]
    emit(m, v, f)
def cyl(m, c, r, h, axis='z', seg=28, r2=None):
    T = Matrix.Translation(Vector(c)) @ AX[axis]; r2 = r if r2 is None else r2; v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v += [Vector((math.cos(a) * r, -h / 2, math.sin(a) * r)), Vector((math.cos(a) * r2, h / 2, math.sin(a) * r2))]
    f = [((2 * i, 2 * i + 1, 2 * ((i + 1) % seg) + 1, 2 * ((i + 1) % seg)), True) for i in range(seg)]
    f += [(tuple(2 * i for i in range(seg)), False), (tuple(2 * i + 1 for i in reversed(range(seg))), False)]
    emit(m, [T @ p for p in v], f)
def dome(m, c, r, h, seg=28, rings=6):
    """앞(+Z)으로 볼록한 버섯 머리."""
    C = Vector(c); v = [C + Vector((0, 0, h))]
    for i in range(1, rings + 1):
        t = i / rings; rr = r * math.sin(t * math.pi / 2); z = h * math.cos(t * math.pi / 2)
        for j in range(seg):
            a = 2 * math.pi * j / seg; v.append(C + Vector((math.cos(a) * rr, math.sin(a) * rr, z)))
    f = [((0, 1 + j, 1 + (j + 1) % seg), True) for j in range(seg)]
    for i in range(rings - 1):
        for j in range(seg):
            a = 1 + i * seg + j; b = 1 + i * seg + (j + 1) % seg
            f.append(((a, a + seg, b + seg, b), True))
    base = 1 + (rings - 1) * seg
    f.append((tuple(base + j for j in reversed(range(seg))), False))
    emit(m, v, f)
def tri(m, pts, z):
    """평면 다각형 — 감김 방향과 무관하게 앞(+Z)을 보도록 맞춘다."""
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if area < 0: pts = pts[::-1]
    emit(m, [Vector((x, y, z)) for x, y in pts], [(tuple(range(len(pts))), False)], closed=False)
def text(m, body, x, y, z, h, max_w=None, vertical=False):
    c = bpy.data.curves.new('t', 'FONT'); c.body = body; c.font = FONT; c.size = 1
    c.align_x = 'CENTER'; c.align_y = 'CENTER'; c.resolution_u = 3
    o = bpy.data.objects.new('t', c); bpy.context.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh()
    vs = [v.co.copy() for v in me.vertices]; fs = [tuple(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(c)
    xs = [v.x for v in vs]; ys = [v.y for v in vs]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = h / max(max(ys) - min(ys), 1e-6)
    if max_w: s = min(s, max_w / max(max(xs) - min(xs), 1e-6))
    R, U = (Vector((0, -1, 0)), Vector((1, 0, 0))) if vertical else (Vector((1, 0, 0)), Vector((0, 1, 0)))
    emit(m, [Vector((x, y, z + .0002)) + R * ((v.x - cx) * s) + U * ((v.y - cy) * s) for v in vs], [(f, False) for f in fs], closed=False)
def arrow(m, x, y, z, s, up=True, both=False):
    """버튼 화살표: 머리 삼각형(들) + 몸통 막대."""
    heads = (1, -1) if both else ((1,) if up else (-1,))
    for g in heads:
        base, tip = y + g * s * .10, y + g * s * .55
        pts = [(x - s * .42, base), (x + s * .42, base), (x, tip)]
        tri(m, pts if g > 0 else pts[::-1], z)
    y0 = y - (s * .10 if (both or not up) else s * .45)
    y1 = y + (s * .10 if (both or up) else s * .45)
    if both: y0, y1 = y - s * .14, y + s * .14
    tri(m, [(x - s * .09, y0), (x + s * .09, y0), (x + s * .09, y1), (x - s * .09, y1)], z)

# ── 벽 고정 브라켓: 판 + 양옆 절곡 날개 + 아래 받침턱 + 앵커 볼트 ──
rbox(STL, (0, -.01, BR_T / 2), (W + .026, H + .03, BR_T), .004)
for sx in (-1, 1):
    rbox(STL, (sx * (W / 2 + .0035), -.01, Z0 + DB * .6), (.003, H * .55, DB * 1.2), .0005)
rbox(STL, (0, -H / 2 - .004, Z0 + DB * .55), (W * .7, .004, DB * 1.1), .0005)
for y in (H / 2 + .0, -H / 2 - .018):
    cyl(STL, (0, y, BR_T + .002), .0055, .004, 'z', 6); cyl(STL, (0, y, BR_T + .0055), .003, .004, 'z', 12)
# ── 본체: 회색 뒤 셸 + 노란 앞 셸 ──
rbox(GRY, (0, 0, Z0 + DB / 2), (W, H, DB), .010, 5)
rbox(YEL, (0, 0, Z0 + DB + DF / 2), (W - .002, H - .002, DF), .010, 5)
for x, y in ((-W / 2 + .007, H / 2 - .007), (W / 2 - .007, H / 2 - .007), (-W / 2 + .007, -H / 2 + .007), (W / 2 - .007, -H / 2 + .007)):
    cyl(BLK, (x, y, FRONT + .0004), .0026, .0012, 'z', 12)
# STOP — 노란 가드 날개 + 적색 버섯
sy = H / 2 - .045
rbox(YEL, (0, sy - .004, FRONT + .004), (W * .92, .032, .008), .012, 6)
cyl(BLK, (0, sy, FRONT + .006), .012, .012, 'z', 24)
cyl(RED, (0, sy, FRONT + .016), .021, .010, 'z', 32, .0205)
dome(RED, (0, sy, FRONT + .021), .0205, .006)
text(INK, 'STOP', W / 2 - .017, sy + .031, FRONT, .006, .026)
# NORMAL / INSPECTION 로터리 (노란 원형 가드 속 흑색 손잡이)
ry = sy - .075
cyl(YEL, (0, ry, FRONT + .005), .024, .010, 'z', 32)
cyl(BLK, (0, ry, FRONT + .006), .019, .011, 'z', 32)
cyl(BLK, (0, ry, FRONT + .013), .016, .004, 'z', 32)
rbox(BLK, (0, ry, FRONT + .019), (.009, .030, .010), .003, 3)
rbox(WHT, (0, ry + .009, FRONT + .0242), (.0022, .010, .0006))
cyl(STL, (.002, ry - .008, FRONT + .0242), .0018, .0008, 'z', 10)
text(INK, 'INSPECTION', W / 2 - .0065, ry + .004, FRONT, .0048, .058, vertical=True)
text(INK, 'NORMAL', -W / 2 + .018, ry + .027, FRONT, .0038, .022)
# 누름 버튼 3개 — 크롬 베젤
for k, (col, ink, lab, kind) in enumerate(((WHT, BLK, 'UP', 'up'), (BLU, WHT, 'COMMON', 'both'), (BLK, WHT, 'DOWN', 'down'))):   # 사용자 지시: UP·COMMON·DOWN
    by = ry - .052 - k * .042
    cyl(CHR, (0, by, FRONT + .004), .0145, .008, 'z', 32)
    cyl(col, (0, by, FRONT + .0085), .0118, .005, 'z', 32)
    arrow(ink, 0, by, FRONT + .0112, .016, kind == 'up', kind == 'both')
    text(INK, lab, 0, by + .020, FRONT, .0044, .032)
# 위쪽 케이블 글랜드 + 짧은 인출선
gy = H / 2
cyl(GRY, (0, gy + .005, Z0 + DB * .6), .009, .010, 'y', 20)
cyl(BLK, (0, gy + .012, Z0 + DB * .6), .0075, .008, 'y', 6)
cyl(BLK, (0, gy + .020, Z0 + DB * .6), .0062, .010, 'y', 18, .0052)
EXIT = (0., gy + .025, Z0 + DB * .6)

def to_blender(v): return (v.x, -v.z, v.y)
root = bpy.data.objects.new('PitInspectionStation', None); bpy.context.collection.objects.link(root)
root['width'] = W; root['height'] = H; root['depth'] = FRONT; root['cableExit'] = list(EXIT)
made = [root]
for mname, d in BUCKET.items():
    me = bpy.data.meshes.new('Pit_' + mname)
    me.from_pydata([to_blender(v) for v in d['v']], [], [f for f, _ in d['f']]); me.update()
    for poly, (_, sm) in zip(me.polygons, d['f']): poly.use_smooth = sm
    me.materials.append(bpy.data.materials[mname])
    o = bpy.data.objects.new('Pit_' + mname, me); bpy.context.collection.objects.link(o); o.parent = root; made.append(o)
print('pit station triangles', sum(sum(len(f) - 2 for f, _ in d['f']) for d in BUCKET.values()))
bpy.ops.object.select_all(action='DESELECT')
for o in made: o.select_set(True)
dest = ROOT / 'models/gltf/pit_inspection_station.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
print('Exported', dest)
