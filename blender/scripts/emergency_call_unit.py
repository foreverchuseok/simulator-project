"""카탑·피트용 핸즈프리 비상통화장치(영상 검사기법/IMG_8002.mp4 기준).
검은 ABS 함: 왼쪽 돌출부(링 LED 스테인리스 누름버튼 + 세로 슬롯 스피커) + 오른쪽 낮은 칸(흰 인증 라벨·마이크 구멍),
양옆 세움 테, 아래 강판 고정 탭·볼트. 버튼 링 LED 는 별도 노드 CallLedRing(JS 가 색을 바꾼다: 꺼짐=스테인리스, 연결 중=노랑, 통화=초록).
좌표: Three.js 로컬 +Y 위, +Z 앞면, z=0 = 부착면, 원점 = 부착면 중심. Blender(x, -z, y)로 옮긴다.
실행: blender -b -P blender/scripts/emergency_call_unit.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
W, H = .150, .175            # 전체 폭·높이
LW = .090                    # 왼쪽 돌출부 폭
DL, DR = .046, .032          # 왼쪽·오른쪽 돌출 깊이
BTN_Y = .050                 # 버튼 중심 높이
FONT = bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')

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
ABS = mat('EcBlackAbs', '#1c1d1f', 0, .55)
ABS2 = mat('EcBlackAbsDark', '#101112', 0, .6)
SS = mat('EcStainless', '#c8ccd0', .9, .22)
LED = mat('CallLed', '#b9bdc1', .8, .25)             # 꺼짐 = 스테인리스 링(JS 에서 발광색으로 교체)
LBL = mat('EcLabel', '#f2f2ee', 0, .6)
INK = mat('EcInk', '#1a1a1a', 0, .7)
STL = mat('EcBracket', '#9fa4a8', .8, .35)

BUCKETS = {}
def emit(g, m, verts, faces, closed=True):
    if closed:
        vol = 0.
        for idx, _ in faces:
            a = verts[idx[0]]
            for k in range(1, len(idx) - 1): vol += a.dot(verts[idx[k]].cross(verts[idx[k + 1]]))
        if vol < 0: faces = [(tuple(reversed(i)), s) for i, s in faces]
    b = BUCKETS.setdefault((g, m), {'v': [], 'f': []}); o = len(b['v'])
    b['v'].extend(verts); b['f'].extend((tuple(i + o for i in idx), s) for idx, s in faces)
def rbox(g, m, c, s, r=0., seg=4):
    w, h, d = s; r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    if r <= 0: ring = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    else:
        ring = []
        for cx, cy, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
            for k in range(seg + 1):
                a = math.radians(a0 + 90 * k / seg); ring.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    n = len(ring); C = Vector(c)
    v = [C + Vector((x, y, -d / 2)) for x, y in ring] + [C + Vector((x, y, d / 2)) for x, y in ring]
    f = [(tuple(reversed(range(n))), False), (tuple(range(n, 2 * n)), False)]
    f += [((i, (i + 1) % n, n + (i + 1) % n, n + i), bool(r)) for i in range(n)]
    emit(g, m, v, f)
def cylz(g, m, c, r, h, seg=32, r2=None):
    r2 = r if r2 is None else r2; C = Vector(c); v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v += [C + Vector((math.cos(a) * r, math.sin(a) * r, -h / 2)), C + Vector((math.cos(a) * r2, math.sin(a) * r2, h / 2))]
    f = [((2 * i, 2 * ((i + 1) % seg), 2 * ((i + 1) % seg) + 1, 2 * i + 1), True) for i in range(seg)]
    f += [(tuple(2 * i for i in reversed(range(seg))), False), (tuple(2 * i + 1 for i in range(seg)), False)]
    emit(g, m, v, f)
def ringz(g, m, c, ro, ri, h, seg=40):
    C = Vector(c); v = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; ca, sa = math.cos(a), math.sin(a)
        v += [C + Vector((ca * ro, sa * ro, -h / 2)), C + Vector((ca * ro, sa * ro, h / 2)),
              C + Vector((ca * ri, sa * ri, -h / 2)), C + Vector((ca * ri, sa * ri, h / 2))]
    f = []
    for i in range(seg):
        j = (i + 1) % seg; a, b = 4 * i, 4 * j
        f += [((a, b, b + 1, a + 1), True), ((a + 3, b + 3, b + 2, a + 2), True), ((a + 1, b + 1, b + 3, a + 3), False), ((a + 2, b + 2, b, a), False)]
    emit(g, m, v, f)
def text(g, m, body, x, y, z, h, max_w):
    c = bpy.data.curves.new('t', 'FONT'); c.body = body; c.font = FONT; c.size = 1; c.align_x = 'CENTER'; c.align_y = 'CENTER'
    o = bpy.data.objects.new('t', c); bpy.context.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh()
    vs = [v.co.copy() for v in me.vertices]; fs = [tuple(p.vertices) for p in me.polygons]
    oe.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(c)
    xs = [v.x for v in vs]; ys = [v.y for v in vs]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = min(h / max(max(ys) - min(ys), 1e-6), max_w / max(max(xs) - min(xs), 1e-6))
    emit(g, m, [Vector((x + (v.x - cx) * s, y + (v.y - cy) * s, z + .0002)) for v in vs], [(f, False) for f in fs], closed=False)

B = 'EmergencyCallBody'
x0 = -W / 2
lx, rx_ = x0 + LW / 2, x0 + LW + (W - LW) / 2
# 바닥판(부착면) + 왼쪽 돌출부 + 오른쪽 낮은 칸
rbox(B, ABS2, (0, 0, .0025), (W, H, .005), .006)
rbox(B, ABS, (lx, 0, DL / 2), (LW - .004, H - .004, DL), .006)
rbox(B, ABS, (rx_, -.004, DR / 2), (W - LW - .004, H - .016, DR), .008)
# 왼쪽 돌출부 양옆 세움 테(사진의 굵은 가장자리)
for sx in (-1, 1):
    rbox(B, ABS2, (lx + sx * (LW / 2 - .003), .004, DL / 2 + .004), (.007, H + .004, DL + .008), .003)
# 링 LED 버튼: 베젤(ABS) · LED 링(별도 노드) · 스테인리스 누름판
cylz(B, ABS2, (lx, BTN_Y, DL + .002), .016, .004)
cylz(B, SS, (lx, BTN_Y, DL + .0065), .0085, .005)
cylz(B, SS, (lx, BTN_Y, DL + .0092), .0078, .0006)
ringz('CallLedRing', LED, (lx, BTN_Y, DL + .0066), .0138, .0086, .0048)
# 스피커 세로 슬롯 11줄
for k in range(11):
    x = lx - .030 + k * .006
    rbox(B, ABS2, (x, -.025, DL + .0002), (.0028, .070, .001), .0012, 3)
# 오른쪽 칸: 흰 인증 라벨 2장 + 마이크 구멍
rbox(B, LBL, (rx_ + .002, .045, DR + .0003), (.030, .030, .0006))
for k in range(4): rbox(B, INK, (rx_ + .002, .054 - k * .006, DR + .0008), (.022, .0012, .0002))
rbox(B, LBL, (rx_ + .002, -.020, DR + .0003), (.040, .066, .0006))
text(B, INK, '비상통화장치', rx_ + .002, .005, DR + .0006, .0048, .034)
for k in range(7): rbox(B, INK, (rx_ + .001 - (k % 2) * .003, -.006 - k * .0055, DR + .0008), (.030 - (k % 3) * .004, .0011, .0002))
ringz(B, INK, (rx_ + .002, -.044, DR + .0008), .006, .0035, .0006)
text(B, INK, 'KC', rx_ + .002, -.044, DR + .0008, .0035, .005)
cylz(B, ABS2, (rx_ - .004, .066, DR + .0002), .0022, .001)
# 아래 고정 탭 + 볼트, 위 케이블 글랜드
rbox(B, STL, (lx, -H / 2 - .012, .002), (.020, .030, .003), .003)
cylz(B, STL, (lx, -H / 2 - .016, .006), .0055, .005, 6)
cylz(B, ABS2, (lx - .02, H / 2 + .004, .018), .006, .01)

def to_blender(v): return (v.x, -v.z, v.y)
root = bpy.data.objects.new('EmergencyCallUnit', None); bpy.context.collection.objects.link(root)
root['width'] = W; root['height'] = H; root['depth'] = DL; root['buttonCenter'] = [lx, BTN_Y, DL + .009]
made = [root]
for g in ('EmergencyCallBody', 'CallLedRing'):
    e = bpy.data.objects.new(g, None); bpy.context.collection.objects.link(e); e.parent = root; made.append(e)
    for (gg, mname), d in BUCKETS.items():
        if gg != g: continue
        me = bpy.data.meshes.new(f'{g}_{mname}')
        me.from_pydata([to_blender(v) for v in d['v']], [], [f for f, _ in d['f']]); me.update()
        for poly, (_, sm) in zip(me.polygons, d['f']): poly.use_smooth = sm
        me.materials.append(bpy.data.materials[mname])
        o = bpy.data.objects.new(f'{g}_{mname}', me); bpy.context.collection.objects.link(o); o.parent = e; made.append(o)
print('ec triangles', sum(sum(len(f) - 2 for f, _ in d['f']) for d in BUCKETS.values()))
bpy.ops.object.select_all(action='DESELECT')
for o in made: o.select_set(True)
dest = ROOT / 'models/gltf/emergency_call_unit.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
print('Exported', dest)
