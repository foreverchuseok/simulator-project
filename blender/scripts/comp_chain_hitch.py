"""균형체인(보상체인) 체결부 · 카 하부 횡빔 · 실사 체인 링크 GLB 생성기.

참고 자료:
- 현장사진 (Resized_20261108_101219_1794100362976.jpeg):
  균형추 하부 프레임 아래 용접 브라켓 + U-볼트 주 체결 +
  프레임 빔 웹 관통홀을 지나는 은색 안전 와이어로프 + 클립 이중체결.
- KoELSA 검사기준 [별표22] 엘리베이터 안전기준 9.6.3 / 9.6.4 (2024-3-1 종전 표준화):
  추가적인 보호조치는 체인 연결부(U-볼트 브라켓)와 다른 부재(프레임)에 연결. 완충기 충돌판 연결 불가.

이중체결 구조 (2026-11-27 수정 — 와이어가 프레임 속으로 들어가던 형상 폐기):
- 주 체결: 프레임 하면에 용접한 노란 ㄷ 브라켓(별도 부재) + U-볼트 → 체인 1번 링크.
  1번 링크는 U-볼트 바닥 봉(X 방향)에 걸리므로 YZ 면에 선다.
- 추가 보호조치: 프레임 빔 측면(웹)을 앞면→뒷면 일직선으로 관통한 구멍(양면 보강 링)에
  와이어로프를 통과시켜 체인 2번 링크(XY 면, 개구가 Z 방향)를 지나는 고리로 감고 클립 2개로 조인다.
  와이어는 빔 하단 띠를 감싸므로 브라켓 용접부와 하중 경로가 완전히 분리된다.
- 평상시 와이어는 느슨한 U(2번 링크 무하중). 브라켓 용접부 파단 시 2번 링크가 와이어에 걸려
  빔 하단 모서리를 감싸는 팽팽한 V가 된다. 와이어 길이는 두 상태에서 같다(이분법으로 V 깊이 역산).
  V 는 같은 메시의 셰이프 키 `Taut`(glTF morph target 0)이고 JS 가 0→1 로 보간한다.

좌표: 앱 Three.js Y-up → T(x, y, z) = (x, -z, y) 로 Blender 변환.
체결부 원점 = 프레임(빔) 하면 · 체인 X · 빔 깊이 중심 Z.
내보내기: models/gltf/comp_chain_hitch.glb (루트 CompChainRoot, extras 치수 계약 포함).
"""
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import car_guide_shoe as common  # T, box, cylinder, subtract, join, material, finish
import bpy
import bmesh
from mathutils import Vector

T = common.T
box = common.box
cylinder = common.cylinder
subtract = common.subtract
join = common.join
material = common.material
finish = common.finish

ROOT = common.ROOT
OUTPUT_PATH = ROOT / "models/gltf/comp_chain_hitch.glb"

# ── 공용 치수 계약 (js/comp-chain.js 가 GLB extras 에서 읽어 대조) ──
CONTRACT_VERSION = 2
CHAIN_X_OFFSET = 0.34        # 좌/우 2본 균형체인 X (±0.34m, 완충기 충돌판 ±0.12m 회피)
CAR_BEAM_LEN = 1.12          # 카 하부 보상체인 횡빔 폭 (플랫폼 stringer ±0.51m 커버)
CAR_BEAM_H = 0.080           # 횡빔 높이
CAR_BEAM_D = 0.110           # 횡빔 깊이 (Z)
CAR_BEAM_T = 0.007           # C채널 판 두께
CWT_BEAM_D = 0.196           # counterweight.py Bottom beam 깊이(CWT_D - 0.004) — JS 가 S.CWT_D 와 대조

# 주 고정 브라켓 + U-볼트 (원점 = 프레임 하면 y=0)
BRK_W = 0.096
BRK_D = 0.074
BRK_H = 0.042
UBOLT_HALF_X = 0.019         # U-볼트 두 다리 중심 간격의 절반 (폭 38mm)
UBOLT_WIRE_R = 0.0052        # U-볼트 봉 반지름 (Ø10.4mm)
UBOLT_BOTTOM_Y = -0.092      # U-볼트 바닥 봉 중심 Y (X 방향 봉 → 1번 링크 YZ 면)

# 실사 균형체인 링크 유닛 (외장 56mm × 외폭 29mm × 선경 8.4mm → 피치 40mm)
LINK_WIRE_R = 0.0042
LINK_OUTER_L = 0.056
LINK_OUTER_W = 0.029
LINK_PITCH = LINK_OUTER_L - 4.0 * LINK_WIRE_R + 0.0008   # 맞물린 인접 링크 중심 간 거리 (≈ 0.040m)
LINK_INNER_HALF = LINK_OUTER_L / 2 - 2 * LINK_WIRE_R     # 링크 중심 → 안쪽 끝 (0.0196)
LINK_BEND_C = LINK_OUTER_L / 2 - LINK_WIRE_R             # 링크 중심 → 굽힘부 선 중심 (0.0238)
LINK1_Y = UBOLT_BOTTOM_Y + UBOLT_WIRE_R - LINK_INNER_HALF  # 1번 링크 안쪽 위끝이 U-볼트 봉 위에 얹힘
LINK2_Y = LINK1_Y - LINK_PITCH                             # 2번 링크 중심 (와이어 통과)

# 이중체결 안전 와이어로프 (빔 측면 관통 → 2번 링크 고리 → 클립 2개)
WIRE_R = 0.0042              # 안전 와이어로프 반지름 (Ø8.4mm)
WIRE_HOLE_UP = 0.034         # 관통홀 중심: 빔 하면 위 34mm (빔 웹)
WIRE_HOLE_R = 0.011          # 관통홀 반지름 (Ø22)
SLEEVE_T = 0.002             # 구멍 테 보강 링 두께 (빔 면 위 돌출)
SLEEVE_R = 0.018             # 보강 링 바깥 반지름
SLACK_BEND_R = 0.016         # 느슨한 고리: 구멍 출구에서 아래로 꺾이는 반경
SLACK_BOT_R = 0.045          # 느슨한 고리 바닥 원호 반경(1번 링크와 30mm 이상 떨어짐)
EDGE_R = 0.003               # 팽팽한 V 가 감싸는 빔 하단 모서리 라운드
WIRE_SLACK_BOT_Y = LINK2_Y - 0.005   # 느슨한 고리 최하단 선 중심: 2번 링크 개구 하부(무하중)
TAIL_GAP = 2 * WIRE_R + 0.0012       # 클립에 같이 물린 꼬리 가닥 간격(X)
CLIP_FRACS = (0.25, 0.62)            # 앞쪽 직선 가닥 위 클립 위치 비율 (느슨할 때 간격 ≈ 50mm)
TAIL_FRACS = (0.08, 0.82)            # 꼬리 가닥 범위 비율

# 경로 구간별 점 개수 — 느슨/팽팽 두 상태가 같은 토폴로지여야 셰이프 키가 성립한다
N_HOLE, N_EXIT, N_FACE, N_CORNER, N_SIDE, N_BOT = 6, 7, 4, 6, 9, 14
N_TAIL = 7
TUBE_SEGS = 10


# ─────────────────────────────── 와이어 경로 ───────────────────────────────
def _arc(cz, cy, r, a0, a1, n, include_end=False):
    """(z, y) 평면 원호 — a0→a1 (라디안), n 점(끝점 제외가 기본)."""
    m = n if not include_end else n - 1
    return [(cz + r * math.cos(a0 + (a1 - a0) * k / m), cy + r * math.sin(a0 + (a1 - a0) * k / m)) for k in range(n)]


def _line(p0, p1, n, include_end=False):
    m = n if not include_end else n - 1
    return [(p0[0] + (p1[0] - p0[0]) * k / m, p0[1] + (p1[1] - p0[1]) * k / m) for k in range(n)]


def _tangent_point(e, c, r):
    """점 e 에서 원(c, r)에 긋는 접선의 접점 — 와이어가 원을 시계 방향(바깥→바닥)으로 감는 쪽."""
    dz, dy = e[0] - c[0], e[1] - c[1]
    beta = math.atan2(dy, dz)
    ac = math.acos(max(-1.0, min(1.0, r / math.hypot(dz, dy))))
    for a in (beta + ac, beta - ac):
        t = (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
        if (t[0] - e[0]) * math.sin(a) - (t[1] - e[1]) * math.cos(a) > 0:
            return t
    raise ValueError("tangent point not found")


def _hole_y():
    """구멍 안 와이어 선 중심 — 고리 무게로 구멍 바닥에 얹힌다(두 상태 공통)."""
    return WIRE_HOLE_UP - WIRE_HOLE_R + WIRE_R


def _front_half(state, half_d, ybot):
    """앞쪽 반 고리 (z,y) 점열: 구멍 중심 → 앞면 출구 굽힘 → 면 → 모서리 → 직선 → 바닥(최하단 포함).
    반환: (점열, 직선 구간 시작/끝 (z,y))."""
    yw = _hole_y()
    z_exit = half_d + SLEEVE_T
    pts = _line((0.0, yw), (z_exit, yw), N_HOLE)
    if state == "slack":
        # 물방울형 고리: 출구 굽힘 → 안쪽으로 약간 기운 직선 가닥(클립 2개 자리) → 2번 링크를 지나는 바닥 원호
        rb = SLACK_BEND_R
        c2 = (0.0, ybot + SLACK_BOT_R)
        delta = 0.0
        for _ in range(8):                         # 굽힘 끝 접선과 직선 가닥 기울기를 일치시킨다
            e = (z_exit + rb * math.cos(-delta), yw - rb + rb * math.sin(-delta))
            tp = _tangent_point(e, c2, SLACK_BOT_R)
            delta = math.atan2(e[0] - tp[0], e[1] - tp[1])
        pts += _arc(z_exit, yw - rb, rb, math.pi / 2, -delta, N_EXIT)
        pts += _line(e, tp, N_FACE + N_CORNER + N_SIDE)
        a_t = math.atan2(tp[1] - c2[1], tp[0] - c2[0])
        pts += _arc(c2[0], c2[1], SLACK_BOT_R, a_t, -math.pi / 2, N_BOT, include_end=True)
        return pts, e, tp
    # taut — 구멍 아래 테를 감아 면을 따라 내려오고, 빔 하단 모서리를 감아 2번 링크 윗 굽힘부까지 직선
    lip_y = WIRE_HOLE_UP - WIRE_HOLE_R
    pts += _arc(z_exit, lip_y, WIRE_R, math.pi / 2, 0.0, N_EXIT)
    z_face = z_exit + WIRE_R
    c1 = (half_d - 0.001, EDGE_R)                  # 하단 모서리 감김 중심(빔 모서리 안쪽)
    r1 = z_face - c1[0]
    c2 = (0.0, ybot + LINK_WIRE_R + WIRE_R)        # 2번 링크 윗 굽힘부 선 중심
    r2 = LINK_WIRE_R + WIRE_R
    pts += _line((z_face, lip_y), (z_face, c1[1]), N_FACE)
    # 두 원(모두 시계 방향 감김)의 외접선: n·Δ = r1 - r2, 진행 방향 d=(n_y,-n_z) 가 Δ 쪽
    dz, dy = c2[0] - c1[0], c2[1] - c1[1]
    L = math.hypot(dz, dy)
    phi = math.atan2(dy, dz)
    ac = math.acos(max(-1.0, min(1.0, (r1 - r2) / L)))
    alpha = None
    for cand in (phi + ac, phi - ac):
        if math.sin(cand) * dz - math.cos(cand) * dy > 0:
            alpha = cand
    while alpha > 0:
        alpha -= 2 * math.pi
    pts += _arc(c1[0], c1[1], r1, 0.0, alpha, N_CORNER)
    p_from = (c1[0] + r1 * math.cos(alpha), c1[1] + r1 * math.sin(alpha))
    p_to = (c2[0] + r2 * math.cos(alpha), c2[1] + r2 * math.sin(alpha))
    pts += _line(p_from, p_to, N_SIDE)
    pts += _arc(c2[0], c2[1], r2, alpha, -math.pi / 2, N_BOT, include_end=True)
    return pts, p_from, p_to


def wire_loop(state, half_d, ybot):
    """닫힌 고리 (x,y,z) 점열 + 앞쪽 직선 가닥 양끝(x,y,z)."""
    front, s0, s1 = _front_half(state, half_d, ybot)
    back = [(-z, y) for (z, y) in reversed(front[1:-1])]   # 바닥점·구멍 중심점 중복 제외
    loop = [(0.0, y, z) for (z, y) in front + back]
    return loop, (0.0, s0[1], s0[0]), (0.0, s1[1], s1[0])


def loop_length(pts):
    return sum((Vector(pts[i]) - Vector(pts[i - 1])).length for i in range(len(pts)))


def solve_taut_bottom(half_d):
    """느슨한 고리와 와이어 길이가 같아지는 팽팽한 V 최하단 선 중심 Y (이분법)."""
    target = loop_length(wire_loop("slack", half_d, WIRE_SLACK_BOT_Y)[0])
    lo, hi = -0.40, WIRE_SLACK_BOT_Y
    for _ in range(60):
        mid = (lo + hi) / 2
        if loop_length(wire_loop("taut", half_d, mid)[0]) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ─────────────────────────── 메시 조립 (셰이프 키용) ───────────────────────────
class MeshData:
    """정점(앱 좌표)·면·면 재질 인덱스·스무스 여부를 모은다. 같은 호출 순서 = 같은 토폴로지."""

    def __init__(self):
        self.verts, self.faces, self.mats, self.smooth = [], [], [], []

    def add(self, verts, faces, mat, smooth):
        base = len(self.verts)
        self.verts.extend(verts)
        for f in faces:
            self.faces.append(tuple(base + i for i in f))
            self.mats.append(mat)
            self.smooth.append(smooth)


def tube(md, pts, radius, mat, closed):
    """고리가 YZ 평면에 있으므로 링 기저 e1 = X 고정(비틀림 없음)."""
    n = len(pts)
    P = [Vector(p) for p in pts]
    ex = Vector((1.0, 0.0, 0.0))
    verts = []
    for i in range(n):
        if closed:
            t = P[(i + 1) % n] - P[(i - 1) % n]
        else:
            t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
        t.normalize()
        e2 = t.cross(ex).normalized()
        for s in range(TUBE_SEGS):
            a = 2 * math.pi * s / TUBE_SEGS
            verts.append(tuple(P[i] + (ex * math.cos(a) + e2 * math.sin(a)) * radius))
    faces = []
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        for s in range(TUBE_SEGS):
            s1 = (s + 1) % TUBE_SEGS
            faces.append((i * TUBE_SEGS + s, i * TUBE_SEGS + s1, j * TUBE_SEGS + s1, j * TUBE_SEGS + s))
    if not closed:
        faces.append(tuple(range(TUBE_SEGS - 1, -1, -1)))
        faces.append(tuple((n - 1) * TUBE_SEGS + s for s in range(TUBE_SEGS)))
    md.add(verts, faces, mat, True)


def _frame_point(origin, ex, et, en, a, b, c):
    return tuple(origin + ex * a + et * b + en * c)


def local_box(md, frame, center, half, mat):
    o, ex, et, en = frame
    a0, b0, c0 = center
    ha, hb, hc = half
    verts = [_frame_point(o, ex, et, en, a0 + sa * ha, b0 + sb * hb, c0 + sc * hc)
             for sa in (-1, 1) for sb in (-1, 1) for sc in (-1, 1)]
    # 정점 순서: (sa,sb,sc) = 000,001,010,011,100,101,110,111
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    md.add(verts, faces, mat, False)


def local_cyl_c(md, frame, center, radius, half_h, sides, mat):
    """로컬 c 축(가닥 법선) 방향 원통."""
    o, ex, et, en = frame
    a0, b0, c0 = center
    verts = []
    for sc in (-1, 1):
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            verts.append(_frame_point(o, ex, et, en, a0 + radius * math.cos(ang), b0 + radius * math.sin(ang), c0 + sc * half_h))
    faces = [(k, (k + 1) % sides, sides + (k + 1) % sides, sides + k) for k in range(sides)]
    faces.append(tuple(range(sides - 1, -1, -1)))
    faces.append(tuple(sides + k for k in range(sides)))
    md.add(verts, faces, mat, False)


def wire_clip(md, origin, tangent):
    """크로스비 와이어 클립: 안장(바깥) + U-볼트 다리 2 + 아래 굽힘 + 너트 2. 로프 2가닥(x=0, x=TAIL_GAP)을 문다."""
    ex = Vector((1.0, 0.0, 0.0))
    et = Vector(tangent).normalized()
    en = et.cross(ex).normalized()      # 가닥 평면(YZ) 안 바깥쪽 법선
    frame = (Vector(origin), ex, et, en)
    mid = TAIL_GAP / 2
    local_box(md, frame, (mid, 0.0, 0.0090), (0.0125, 0.0095, 0.0042), 1)            # 주물 안장
    for a in (-0.0068, TAIL_GAP + 0.0068):
        local_cyl_c(md, frame, (a, 0.0, 0.0040), 0.0024, 0.0115, 8, 2)                # U-볼트 다리
        local_cyl_c(md, frame, (a, 0.0, 0.0150), 0.0043, 0.0021, 6, 2)                # 육각 너트
    local_box(md, frame, (mid, 0.0, -0.0072), (0.0092, 0.0024, 0.0024), 2)           # U-볼트 아래 굽힘


def build_wire_mesh(state, half_d, ybot):
    loop, s0, s1 = wire_loop(state, half_d, ybot)
    md = MeshData()
    tube(md, loop, WIRE_R, 0, closed=True)
    v0, v1 = Vector(s0), Vector(s1)
    tail = [tuple(v0.lerp(v1, TAIL_FRACS[0] + (TAIL_FRACS[1] - TAIL_FRACS[0]) * k / (N_TAIL - 1)) + Vector((TAIL_GAP, 0, 0)))
            for k in range(N_TAIL)]
    tube(md, tail, WIRE_R * 0.96, 0, closed=False)
    for f in CLIP_FRACS:
        wire_clip(md, v0.lerp(v1, f), v1 - v0)
    return md


def make_morph_wire(name, half_d, mats, parent):
    """느슨한 U(기본형) + 팽팽한 V(셰이프 키 `Taut`) 와이어 메시. 반환: V 최하단 Y."""
    taut_bot = solve_taut_bottom(half_d)
    slack = build_wire_mesh("slack", half_d, WIRE_SLACK_BOT_Y)
    taut = build_wire_mesh("taut", half_d, taut_bot)
    assert len(slack.verts) == len(taut.verts) and slack.faces == taut.faces
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([T(*v) for v in slack.verts], [], slack.faces)
    # 닫힌 조각(튜브·상자·원통)별 바깥 법선 정렬 — 정점 순서는 그대로라 셰이프 키가 유지된다
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for m in (mats["wireRope"], mats["clip"], mats["zinc"]):
        mesh.materials.append(m)
    for poly, mi, sm in zip(mesh.polygons, slack.mats, slack.smooth):
        poly.material_index = mi
        poly.use_smooth = sm
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name="Taut", from_mix=False)
    key.value = 0.0                     # 기본은 느슨한 U (glTF weights = [0])
    for i, v in enumerate(taut.verts):
        key.data[i].co = T(*v)
    obj.parent = parent
    return taut_bot


# ─────────────────────────────── 부품 ───────────────────────────────
def ring(name, loc, r_out, r_in, thick, mat):
    """Z 축 원형 링 (보강 링·구멍 테)."""
    outer = cylinder(name, r_out, thick, loc, axis='z', sides=24, bevel=0)
    subtract(outer, cylinder(name + "Bore", r_in, thick + 0.01, loc, axis='z', sides=24, bevel=0))
    finish(outer, mat, 0)
    return outer


def build_hitch_assembly(root, mats, suffix, half_d, dark_hole):
    """체결부 어셈블리 (원점 = 빔 하면 · 체인 X · 빔 깊이 중심).
    노드 분리 (이름 뒤 `_Cwt`/`_Car` — JS 는 접두어로 찾는다):
      - MountPlate: 프레임 하면에 남는 용접 패드 (고정)
      - BreakBracket: 별도 용접 브라켓 + U-볼트 + 너트 (용접부 파단 시 1번 링크와 함께 이탈)
      - WireSleeves: 빔 앞·뒷면 관통홀 보강 링 (이중체결 설치 시만 표시)
      - SafetyWire: 안전 와이어로프 고리 + 꼬리 + 클립 2 (셰이프 키 Taut)
    """
    hitch = bpy.data.objects.new("HitchAssembly" + suffix, None)
    bpy.context.collection.objects.link(hitch)
    hitch.parent = root

    # 1. MountPlate — 브라켓을 받던 프레임 하면 용접 패드
    join("MountPlate" + suffix, [box("FrameWeldPad", (BRK_W + 0.016, 0.006, BRK_D + 0.014),
                            (0, -0.003, 0), mats["frame"], bevel=0.0008)], hitch)

    # 2. BreakBracket (용접 절곡 브라켓 + U-볼트 + 너트 2개 + 와셔)
    brk_parts = []
    for sx in (-1, 1):
        brk_parts.append(box("WeldBead", (0.006, 0.005, BRK_D + 0.004),
                             (sx * (BRK_W / 2 + 0.001), -0.008, 0), mats["weld"], bevel=0.0012))
    brk_parts.append(box("BracketFloor", (BRK_W, 0.009, BRK_D),
                         (0, -BRK_H + 0.0045, 0), mats["bracket"], bevel=0.001))
    for sx in (-1, 1):
        brk_parts.append(box("BracketSide", (0.009, BRK_H - 0.006, BRK_D),
                             (sx * (BRK_W / 2 - 0.0045), -BRK_H / 2 - 0.003, 0), mats["bracket"], bevel=0.001))
        brk_parts.append(box("BracketGusset", (0.014, 0.022, 0.006),
                             (sx * (BRK_W / 2 - 0.014), -0.018, 0), mats["bracket"], bevel=0.0008))
    # U-볼트 (XY 평면 U자 강봉: 바닥 봉이 X 방향 → 1번 링크는 YZ 면)
    u_pts = []
    u_top_y = -BRK_H + 0.028
    u_arc_cy = UBOLT_BOTTOM_Y + UBOLT_HALF_X
    u_pts.append((-UBOLT_HALF_X, u_top_y, 0))
    u_pts.append((-UBOLT_HALF_X, u_arc_cy, 0))
    for i in range(1, 15):
        a = math.pi + math.pi * i / 15.0
        u_pts.append((UBOLT_HALF_X * math.cos(a), u_arc_cy + UBOLT_HALF_X * math.sin(a), 0))
    u_pts.append((UBOLT_HALF_X, u_arc_cy, 0))
    u_pts.append((UBOLT_HALF_X, u_top_y, 0))
    brk_parts.append(sweep_tube("UBoltRod", u_pts, UBOLT_WIRE_R, mats["zinc"], segs=12, closed=False))
    for sx in (-1, 1):
        ux = sx * UBOLT_HALF_X
        brk_parts.append(cylinder("UBoltWasher", 0.0115, 0.0025, (ux, -BRK_H + 0.010, 0), mats["zinc"], sides=16))
        brk_parts.append(cylinder("UBoltNut1", 0.0095, 0.007, (ux, -BRK_H + 0.015, 0), mats["zinc"], sides=6))
        brk_parts.append(cylinder("UBoltNut2", 0.0095, 0.006, (ux, -BRK_H + 0.022, 0), mats["boltGold"], sides=6))
        brk_parts.append(cylinder("UBoltBotWasher", 0.0115, 0.0025, (ux, -BRK_H - 0.001, 0), mats["zinc"], sides=16))
    join("BreakBracket" + suffix, brk_parts, hitch)

    # 3. WireSleeves — 빔 앞·뒷면 관통홀 보강 링 (구멍은 빔 웹을 일직선으로 관통)
    sleeves = []
    for sz in (-1, 1):
        sleeves.append(ring("WireSleeve", (0, WIRE_HOLE_UP, sz * (half_d + SLEEVE_T / 2)),
                            SLEEVE_R, WIRE_HOLE_R, SLEEVE_T, mats["zinc"]))
        if dark_hole:
            # 균형추 하부 빔은 counterweight.glb 의 막힌 상자 → 구멍 속 어둠을 면 바로 앞 원판으로 표현
            sleeves.append(cylinder("WireHoleShadow", WIRE_HOLE_R, 0.0008,
                                    (0, WIRE_HOLE_UP, sz * (half_d + 0.0004)), mats["holeDark"], axis='z', sides=24, bevel=0))
    join("WireSleeves" + suffix, sleeves, hitch)

    # 4. SafetyWire — 느슨한 U ↔ 팽팽한 V (셰이프 키)
    return make_morph_wire("SafetyWire" + suffix, half_d, mats, hitch)


def sweep_tube(name, points_app, radius, mat, segs=10, closed=False):
    """Three.js Y-up 좌표 리스트를 따라 원형 단면을 스윕해 매끄러운 튜브 메시를 만든다."""
    pts = [Vector(T(*p)) for p in points_app]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    prev_norm = None
    for i in range(n):
        if closed:
            t_vec = (pts[(i + 1) % n] - pts[(i - 1) % n]).normalized()
        elif i == 0:
            t_vec = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            t_vec = (pts[n - 1] - pts[n - 2]).normalized()
        else:
            t_vec = (pts[i + 1] - pts[i - 1]).normalized()
        if prev_norm is None:
            ref = Vector((0, 0, 1)) if abs(t_vec.z) < 0.9 else Vector((1, 0, 0))
            n_vec = t_vec.cross(ref).normalized()
        else:
            n_vec = (prev_norm - t_vec * prev_norm.dot(t_vec))
            if n_vec.length < 1e-6:
                ref = Vector((0, 0, 1)) if abs(t_vec.z) < 0.9 else Vector((1, 0, 0))
                n_vec = t_vec.cross(ref).normalized()
            else:
                n_vec.normalize()
        b_vec = t_vec.cross(n_vec).normalized()
        prev_norm = n_vec
        ring_v = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            ring_v.append(bm.verts.new(pts[i] + (n_vec * math.cos(a) + b_vec * math.sin(a)) * radius))
        rings.append(ring_v)
    for i in range(n if closed else n - 1):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for s in range(segs):
            s1 = (s + 1) % segs
            bm.faces.new((r0[s], r0[s1], r1[s1], r1[s]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def build_car_cross_beam(root, mats):
    """카 하부 플랫폼 종통 채널 하면에 볼트 체결되는 보상체인 전용 횡빔 (박스형 이중 C채널).
    원점 = 횡빔 상면 중앙 (y=0). 빔 본체는 y ∈ [-CAR_BEAM_H, 0].
    안전와이어 관통홀: 체인 ±CHAIN_X_OFFSET 위치에서 앞·뒤 웹을 Z 방향 일직선 관통(하면 위 WIRE_HOLE_UP).
    """
    beam_parts = []
    beam_parts.append(box("BeamTopFlange", (CAR_BEAM_LEN, CAR_BEAM_T, CAR_BEAM_D),
                          (0, -CAR_BEAM_T / 2, 0), mats["carBeam"], bevel=0.001))
    beam_parts.append(box("BeamBotFlange", (CAR_BEAM_LEN, CAR_BEAM_T, CAR_BEAM_D),
                          (0, -CAR_BEAM_H + CAR_BEAM_T / 2, 0), mats["carBeam"], bevel=0.001))
    for sz in (-1, 1):
        web = box("BeamWeb", (CAR_BEAM_LEN, CAR_BEAM_H - 2 * CAR_BEAM_T, CAR_BEAM_T),
                  (0, -CAR_BEAM_H / 2, sz * (CAR_BEAM_D / 2 - CAR_BEAM_T / 2)), bevel=0)
        for cx in (-CHAIN_X_OFFSET, CHAIN_X_OFFSET):
            subtract(web, cylinder("WirePassHole", WIRE_HOLE_R, CAR_BEAM_T + 0.02,
                                   (cx, -CAR_BEAM_H + WIRE_HOLE_UP, sz * (CAR_BEAM_D / 2 - CAR_BEAM_T / 2)),
                                   axis='z', bevel=0, sides=24))
        finish(web, mats["carBeam"], 0.0008)
        beam_parts.append(web)
    for sx in (-1, 1):
        beam_parts.append(box("BeamEndCap", (CAR_BEAM_T, CAR_BEAM_H, CAR_BEAM_D),
                              (sx * (CAR_BEAM_LEN / 2 - CAR_BEAM_T / 2), -CAR_BEAM_H / 2, 0), mats["carBeam"], bevel=0.0008))

    # 플랫폼 종통 보강 채널(stringerX = ±0.17, ±0.51)과 맞물리는 상부 클램프 브라켓 + M12 볼트
    for stx in (-0.51, -0.17, 0.17, 0.51):
        beam_parts.append(box("BeamMountPad", (0.072, 0.008, CAR_BEAM_D + 0.036),
                              (stx, -0.004, 0), mats["frame"], bevel=0.0008))
        for sz in (-1, 1):
            bz = sz * (CAR_BEAM_D / 2 + 0.009)
            beam_parts.append(cylinder("BeamBoltHead", 0.0085, 0.007, (stx, 0.0035, bz), mats["zinc"], sides=6))
            beam_parts.append(cylinder("BeamBoltNut", 0.0085, 0.007, (stx, -0.0115, bz), mats["boltGold"], sides=6))

    join("CarCrossBeam", beam_parts, root)


def build_chain_link_unit(root, mats):
    """실사 강철 균형체인 단일 링크 (원점 = 중심, 장축 = Three.js Y축, 링크 면 = XY).
    Three.js 에서 InstancedMesh 1개로 700여 링크를 90도 교차 배치한다(드로우콜 +1회).
    """
    r_bend = LINK_OUTER_W / 2.0 - LINK_WIRE_R
    half_straight = (LINK_OUTER_L - LINK_OUTER_W) / 2.0
    pts = []
    arc_steps = 8
    for i in range(arc_steps + 1):
        a = math.pi * i / arc_steps
        pts.append((r_bend * math.cos(a), half_straight + r_bend * math.sin(a), 0.0))
    for i in range(arc_steps + 1):
        a = math.pi + math.pi * i / arc_steps
        pts.append((r_bend * math.cos(a), -half_straight + r_bend * math.sin(a), 0.0))
    clean_pts = []
    for p in pts:
        if not clean_pts or (Vector(p) - Vector(clean_pts[-1])).length > 1e-4:
            clean_pts.append(p)
    if (Vector(clean_pts[0]) - Vector(clean_pts[-1])).length < 1e-4:
        clean_pts.pop()
    link = sweep_tube("ChainLinkUnit", clean_pts, LINK_WIRE_R, mats["chainBlack"], segs=8, closed=True)
    weld = cylinder("LinkWeldSeam", LINK_WIRE_R * 1.14, 0.0045,
                    (r_bend, 0.0, 0.0), mats["chainBlack"], axis='y', sides=8, bevel=0)
    join("ChainLinkUnit", [link, weld], root)


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    mats = {
        "frame": material("CompChain_Frame", (0.28, 0.35, 0.39), 0.30, 0.52),
        "carBeam": material("CompChain_CarBeam", (0.14, 0.21, 0.27), 0.28, 0.50),
        "bracket": material("CompChain_BracketYellow", (0.86, 0.64, 0.04), 0.18, 0.42),
        "weld": material("CompChain_WeldBead", (0.42, 0.38, 0.30), 0.55, 0.55),
        "zinc": material("CompChain_ZincSteel", (0.68, 0.72, 0.76), 0.85, 0.28),
        "boltGold": material("CompChain_BoltGold", (0.72, 0.56, 0.16), 0.82, 0.32),
        "wireRope": material("CompChain_SafetyWire", (0.78, 0.81, 0.85), 0.88, 0.24),
        "clip": material("CompChain_WireClip", (0.58, 0.62, 0.66), 0.82, 0.34),
        "chainBlack": material("CompChain_LinkBlack", (0.032, 0.035, 0.042), 0.76, 0.34),
        "holeDark": material("CompChain_HoleDark", (0.012, 0.012, 0.014), 0.0, 0.9),
    }

    root = bpy.data.objects.new("CompChainRoot", None)
    bpy.context.collection.objects.link(root)

    taut_cwt = build_hitch_assembly(root, mats, "_Cwt", CWT_BEAM_D / 2, dark_hole=True)
    taut_car = build_hitch_assembly(root, mats, "_Car", CAR_BEAM_D / 2, dark_hole=False)
    build_car_cross_beam(root, mats)
    build_chain_link_unit(root, mats)

    caught = lambda yb: yb + LINK_WIRE_R + WIRE_R - LINK_BEND_C   # 2번 링크 윗 굽힘부가 V 바닥에 걸린 링크 중심
    for k, v in {
        "contractVersion": CONTRACT_VERSION,
        "chainXOffset": CHAIN_X_OFFSET,
        "carBeamLen": CAR_BEAM_LEN,
        "carBeamH": CAR_BEAM_H,
        "carBeamD": CAR_BEAM_D,
        "cwtBeamD": CWT_BEAM_D,
        "uboltBottomY": UBOLT_BOTTOM_Y,
        "uboltWireR": UBOLT_WIRE_R,
        "wireR": WIRE_R,
        "wireHoleUp": WIRE_HOLE_UP,
        "wireHoleR": WIRE_HOLE_R,
        "wireSlackBotY": WIRE_SLACK_BOT_Y,
        "wireTautBotYCwt": taut_cwt,
        "wireTautBotYCar": taut_car,
        "link1Y": LINK1_Y,
        "link2Y": LINK2_Y,
        "link2CaughtYCwt": caught(taut_cwt),
        "link2CaughtYCar": caught(taut_car),
        "linkOuterL": LINK_OUTER_L,
        "linkOuterW": LINK_OUTER_W,
        "linkWireR": LINK_WIRE_R,
        "linkPitch": LINK_PITCH,
        "linkInnerHalf": LINK_INNER_HALF,
        "linkBendC": LINK_BEND_C,
    }.items():
        root[k] = v

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
        export_format='GLB',
        export_extras=True,
        export_apply=True,
        export_animations=False,
        export_morph=True,
    )
    print(f"Compensating chain hitch exported: {OUTPUT_PATH}")
    print(f"link1Y={LINK1_Y:.4f} link2Y={LINK2_Y:.4f} slackBot={WIRE_SLACK_BOT_Y:.4f} "
          f"tautCwt={taut_cwt:.4f} tautCar={taut_car:.4f} linkPitch={LINK_PITCH:.4f}")


if __name__ == "__main__":
    build()
