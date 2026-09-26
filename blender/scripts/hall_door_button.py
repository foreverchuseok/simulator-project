"""승장 도어 의장면 패널 + 홀 호출버튼 (실사형, 스테인리스 헤어라인).

출력 2개:
  models/gltf/hall_door_panel.glb   — 승장 도어 1짝 본체(홀 면 헤어라인, 둘레 접힘 R, 승강로 면 도장 강판)
  models/gltf/hall_call_button.glb  — 스테인리스 호출버튼 판(장애인 표지, 원형 누름버튼+LED 링, 촉지 화살표, 점자)

치수 원본은 js/elevator.js 의 HALL_FINISH JSON 한 줄이다(여기서 읽는다).
삼각키·인터록·행거·스티커(hand.png / lean.png)는 JS 가 그대로 붙인다.
Three 좌표로 만들고 T() 로 Blender 로 옮긴다. export_yup 으로 되돌아간다.

  패널: 원점 = 패널 중심, +Z = 홀(로비) 면.
  버튼: 원점 = 판 뒷면 중심(벽면), +Z = 로비 쪽. 노드 ButtonUp / ButtonDown 은
        각자 …Body(캡·촉지 화살표·점자)와 LED 링(…Lamp)을 품어 JS 가 종단층에서 하나를 숨기고 가운데로 옮긴다.
"""
import bpy, bmesh, json, re, math
from pathlib import Path
from mathutils import Matrix, Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
JS = (ROOT / 'js/elevator.js').read_text(encoding='utf-8')
C = json.loads(re.search(r'const HALL_FINISH = (\{.*?\});', JS)[1])

PANEL_W, PANEL_H, PANEL_T = C['panelW'], C['panelH'], C['panelT']
PANEL_FOLD_R = 0.0016          # 홀 면 둘레 접힘 반지름(1.2t 판 절곡)
HAIRLINE_TILE = (0.35, 0.70)   # 헤어라인 텍스처 1장이 덮는 가로·세로(m)

PLATE_W, PLATE_H, PLATE_T = C['plateW'], C['plateH'], C['plateT']
PLATE_CORNER_R = 0.006
PLATE_EDGE_R = 0.0009
ISA_SIZE, ISA_Y = 0.030, 0.088            # 장애인 표지(판 중심 기준)
BTN_X, BTN_UP_Y, BTN_DN_Y = 0.010, 0.030, -0.046
BTN_R, BTN_T = 0.0145, 0.0035             # 누름 캡
LAMP_R_OUT, LAMP_R_IN, LAMP_T = 0.0195, 0.0152, 0.0018   # LED 링(유백 아크릴)
ARROW_R, ARROW_T = 0.0068, 0.0006          # 촉지 화살표(외접원 반지름, 돌출)
BRAILLE_X, BRAILLE_DOT_R, BRAILLE_PITCH, BRAILLE_CELL = -0.029, 0.00075, 0.0025, 0.0062
# 한국 점자: 위 = ㅟ(⠍⠗), 아래 = ㅏ ㄹ ㅐ(⠣ ⠐ ⠗). 점 번호 1·2·3 왼쪽 열, 4·5·6 오른쪽 열.
BRAILLE = {'up': [(1, 3, 4), (1, 2, 3, 5)], 'down': [(1, 2, 6), (5,), (1, 2, 3, 5)]}

M_T2B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))   # Three(x,y,z) → Blender(x,-z,y)


def T(x, y, z):
    return (x, -z, y)


# ── 재질 ──────────────────────────────────────────────────────────────
def hairline_images():
    """세로 헤어라인: 열마다 밝기가 다른 가는 줄 + 줄 방향 미세 요철(노멀)."""
    w, h = 512, 256
    rng = np.random.default_rng(20260927)
    col = rng.normal(0, 1, w)
    col = np.convolve(col, [0.25, 0.5, 0.25], mode='same')
    scratches = rng.choice(w, 18, replace=False)
    col[scratches] += rng.uniform(0.8, 1.4, 18)
    row = np.convolve(rng.normal(0, 1, h), np.ones(12) / 12, mode='same')
    lum = 0.80 + 0.014 * col[None, :] + 0.006 * row[:, None] + 0.004 * rng.normal(0, 1, (h, w))
    base = np.clip(np.stack([lum * 0.985, lum * 0.995, lum, np.ones_like(lum)], -1), 0, 1)
    # 줄 높이의 가로 기울기만 노멀에 싣는다(세로로는 매끈).
    height = col[None, :] + 0.15 * rng.normal(0, 1, (h, w))
    nx = -(np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.04
    n = np.stack([nx, np.zeros_like(nx), np.ones_like(nx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    nrm = np.concatenate([n * 0.5 + 0.5, np.ones((h, w, 1))], -1)
    imgs = []
    for name, data, cs in (('HairlineColor', base, 'sRGB'), ('HairlineNormal', nrm, 'Non-Color')):
        img = bpy.data.images.new(name, w, h, alpha=False)
        img.colorspace_settings.name = cs
        img.pixels.foreach_set(data.astype(np.float32).ravel())
        img.pack()
        imgs.append(img)
    return imgs


def material(name, rgb, metal=0.0, rough=0.4, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*emit[0], 1)
        p.inputs['Emission Strength'].default_value = emit[1]
    return m


def hairline_material(name, color_img, normal_img, rough=0.30):
    m = material(name, (1, 1, 1), 0.92, rough)
    nt = m.node_tree; p = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color_img
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal_img
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
    nt.links.new(tc.outputs['Color'], p.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


# ── 메시 도우미 (Three 좌표로 만든 bmesh → Blender 객체) ──────────────────
def to_object(name, bm, mats, parent=None, uv_tile=None):
    """bm 은 Three 좌표. uv_tile 이 있으면 홀 면 평면 투영 UV(헤어라인 세로)."""
    if uv_tile:
        uv = bm.loops.layers.uv.verify()
        for f in bm.faces:
            for l in f.loops:
                x, y, _ = l.vert.co
                l[uv].uv = (x / uv_tile[0] + 0.5, y / uv_tile[1] + 0.5)
    bmesh.ops.transform(bm, matrix=M_T2B.to_4x4(), verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    # 큰 평면은 평평하게, 모서리 R 만 둥글게 — 면적 가중 노멀(안 하면 판 앞면에 사선 얼룩)
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); m.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=m.name)
    if parent:
        o.parent = parent
    return o


def box_bm(w, h, d, center=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm


def bevel(bm, edges, offset, segments):
    bmesh.ops.bevel(bm, geom=list(edges), offset=offset, segments=segments,
                    affect='EDGES', profile=0.5, clamp_overlap=True)


def depth_edges(bm):
    """Z(두께) 방향 모서리 = 판의 네 귀."""
    return [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.99]


def front_rim(bm, zfront):
    rim = []
    for e in bm.edges:
        if all(abs(v.co.z - zfront) < 1e-7 for v in e.verts):
            ns = [f.normal.z for f in e.link_faces]
            if any(n > 0.99 for n in ns) and any(n < 0.99 for n in ns):
                rim.append(e)
    return rim


def disk_bm(r, t, z0, segments=48):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r, radius2=r, depth=t)
    bmesh.ops.translate(bm, vec=(0, 0, z0 + t / 2), verts=bm.verts)
    return bm


def ring_bm(r_out, r_in, z0, z1, segments=64, a0=0.0, a1=2 * math.pi):
    """평면 링(또는 호) 프리즘. a0~a1 이 한 바퀴가 아니면 양 끝을 막는다."""
    bm = bmesh.new()
    closed = abs(a1 - a0 - 2 * math.pi) < 1e-9
    n = segments if closed else segments + 1
    quads = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / segments
        c, s = math.cos(a), math.sin(a)
        quads.append([bm.verts.new((r * c, r * s, z)) for r, z in
                      ((r_out, z0), (r_out, z1), (r_in, z1), (r_in, z0))])
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        a, b = quads[i], quads[(i + 1) % n]
        for k in range(4):
            k1 = (k + 1) % 4
            bm.faces.new((a[k], b[k], b[k1], a[k1]))
    if not closed:
        bm.faces.new(list(reversed(quads[0]))); bm.faces.new(quads[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def prism_bm(pts2d, z0, z1):
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts2d]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts2d]
    bm.faces.new(list(reversed(lo))); bm.faces.new(hi)
    n = len(pts2d)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def stroke_bm(x0, y0, x1, y1, width, z0, z1):
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy); nx, ny = -dy / L * width / 2, dx / L * width / 2
    return prism_bm([(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny)], z0, z1)


def merge(bms, mat_index=None):
    """여러 bmesh 를 하나로(재질 인덱스 지정)."""
    out = bmesh.new()
    for bm, mi in bms:
        me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
        start = len(out.faces)
        out.from_mesh(me); bpy.data.meshes.remove(me)
        out.faces.ensure_lookup_table()
        for f in out.faces[start:]:
            f.material_index = mi
    return out


def empty(name, parent=None, pos=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o.location = T(*pos)
    if parent:
        o.parent = parent
    return o


def export(root, filename):
    bpy.ops.object.select_all(action='DESELECT')
    stack = [root]
    while stack:
        o = stack.pop(); o.select_set(True); stack.extend(o.children)
    dest = ROOT / 'models/gltf' / filename
    bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True,
                              export_extras=True, export_yup=True)
    print('Exported', dest)


# ── 장면 ─────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
hair_col, hair_nrm = hairline_images()
ss_hair = hairline_material('HallHairlineStainless', hair_col, hair_nrm)
ss_back = material('HallDoorHoistwaySteel', (0.42, 0.44, 0.46), 0.55, 0.55)
ss_satin = material('HallButtonSatinSteel', (0.80, 0.81, 0.82), 0.95, 0.24)
lamp = material('HallButtonLamp', (0.93, 0.95, 0.97), 0.0, 0.35)   # 불 켜기는 JS 가 emissive 로
isa_blue = material('HallIsaBlue', (0.02, 0.16, 0.52), 0.0, 0.32)
isa_white = material('HallIsaWhite', (0.93, 0.94, 0.95), 0.0, 0.3)
arrow_ink = material('HallButtonArrow', (0.035, 0.038, 0.042), 0.3, 0.45)   # 음각 채움처럼 보이는 촉지 화살표

# 1) 승장 도어 패널 ──────────────────────────────────────────────────
panel_root = empty('HallDoorPanelModel')
for k, v in C.items():
    panel_root[k] = v
bm = box_bm(PANEL_W, PANEL_H, PANEL_T)
bevel(bm, bm.edges[:], PANEL_FOLD_R, 3)
for f in bm.faces:            # 승강로 면만 도장 강판, 나머지(홀 면·접힘 둘레)는 헤어라인
    f.material_index = 1 if f.normal.z < -0.6 else 0
to_object('HallDoorPanel', bm, [ss_hair, ss_back], panel_root, HAIRLINE_TILE)
export(panel_root, 'hall_door_panel.glb')

# 2) 홀 호출버튼 ─────────────────────────────────────────────────────
btn_root = empty('HallCallButtonModel')
for k, v in C.items():
    btn_root[k] = v
bm = box_bm(PLATE_W, PLATE_H, PLATE_T, (0, 0, PLATE_T / 2))
bevel(bm, depth_edges(bm), PLATE_CORNER_R, 6)
bevel(bm, front_rim(bm, PLATE_T), PLATE_EDGE_R, 2)
to_object('Faceplate', bm, [ss_hair], btn_root, (HAIRLINE_TILE[0] * 0.25, HAIRLINE_TILE[1] * 0.25))

# 장애인 표지(ISA) — 청색 판 + 흰 양각 인물·바퀴
zf = PLATE_T
s = ISA_SIZE
isa_plate = box_bm(s, s, 0.0008, (0, ISA_Y, zf + 0.0004))
bevel(isa_plate, depth_edges(isa_plate), 0.0025, 4)
def P(u, v):   # 단위 정사각형(0~1) → 판 좌표
    return (-s / 2 + u * s, ISA_Y - s / 2 + v * s)
zt0, zt1 = zf + 0.0008, zf + 0.0012
sw = 0.075 * s
parts = [(isa_plate, 0)]
hx, hy = P(0.42, 0.83)
head = disk_bm(0.075 * s, zt1 - zt0, zt0, 24); bmesh.ops.translate(head, vec=(hx, hy, 0), verts=head.verts)
parts.append((head, 1))
for a, b in (((0.42, 0.70), (0.45, 0.44)), ((0.43, 0.60), (0.64, 0.60)),
             ((0.45, 0.44), (0.70, 0.44)), ((0.70, 0.44), (0.80, 0.18)), ((0.80, 0.18), (0.90, 0.18))):
    parts.append((stroke_bm(*P(*a), *P(*b), sw, zt0, zt1), 1))
wx, wy = P(0.44, 0.36)
wheel = ring_bm(0.25 * s, 0.25 * s - sw, zt0, zt1, 40, math.radians(-35), math.radians(215))
bmesh.ops.translate(wheel, vec=(wx, wy, 0), verts=wheel.verts)
parts.append((wheel, 1))
to_object('AccessibilitySign', merge(parts), [isa_blue, isa_white], btn_root)


def button(name, y, direction):
    grp = empty(name, btn_root, (0, y, 0))
    # LED 링(유백 아크릴) + 캡 둘레 검은 틈
    to_object(name + 'Lamp', ring_bm(LAMP_R_OUT, LAMP_R_IN, zf, zf + LAMP_T, 72), [lamp], grp)
    gap = ring_bm(LAMP_R_IN, BTN_R + 0.0003, zf, zf + LAMP_T - 0.0004, 72)
    cap = disk_bm(BTN_R, BTN_T, zf, 64)
    bevel(cap, front_rim(cap, zf + BTN_T), 0.0010, 3)
    pts = [(ARROW_R * math.cos(a), ARROW_R * math.sin(a) * (1 if direction == 'up' else -1))
           for a in (math.pi / 2, math.pi / 2 + 2 * math.pi / 3, math.pi / 2 + 4 * math.pi / 3)]
    arrow = prism_bm(pts, zf + BTN_T - 0.0001, zf + BTN_T + ARROW_T)
    dots = []
    for ci, cell in enumerate(BRAILLE[direction]):
        for dnum in cell:
            col, rowi = (0 if dnum <= 3 else 1), (dnum - 1) % 3
            bx = BRAILLE_X - (len(BRAILLE[direction]) - 1) * BRAILLE_CELL / 2 + ci * BRAILLE_CELL + col * BRAILLE_PITCH - BRAILLE_PITCH / 2
            by = BRAILLE_PITCH - rowi * BRAILLE_PITCH
            dot = bmesh.new()
            bmesh.ops.create_uvsphere(dot, u_segments=10, v_segments=6, radius=BRAILLE_DOT_R)
            bmesh.ops.scale(dot, vec=(1, 1, 0.7), verts=dot.verts)
            bmesh.ops.translate(dot, vec=(bx - BTN_X, by, zf), verts=dot.verts)
            dots.append((dot, 0))
    # 드로우콜 절약: 캡·점자(새틴) + 화살표·틈(검정)을 한 메시로. LED 링만 따로(점등 재질).
    to_object(name + 'Body', merge([(cap, 0), *dots, (arrow, 1), (gap, 1)]), [ss_satin, arrow_ink], grp)
    grp.location = T(BTN_X, y, 0)
    return grp


button('ButtonUp', BTN_UP_Y, 'up')
button('ButtonDown', BTN_DN_Y, 'down')
export(btn_root, 'hall_call_button.glb')
