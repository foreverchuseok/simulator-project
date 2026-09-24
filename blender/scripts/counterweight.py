"""균형추(Counterweight) — 프레임 · 검은 주물 웨이트 · 상하 가이드슈 · 오일통.

현장 사진(2026-09-24): 20260825_130032.jpg, IMG_3081.JPG(검은 주물 웨이트, 손잡이 홈,
기둥 전면 마커 번호 1·2·3…), 스크린샷 005751(두꺼운 하부 프레임·검은 가이드슈),
005848·001412·010024(상부 빔, 슈 위 상자형 오일통, 빔 아래 너트만 — 스프링 없음).

좌표: 앱 Y-up, 원점 = 균형추 중심(cwtGrp). X = 레일 방향, Z = 깊이(+Z = 카 쪽 전면).
T() 로 Blender 좌표로 옮긴다. 위치·이동은 js/elevator.js buildCounterWeight() 가 맡는다.
외곽 계약(CWT_W·CWT_D·CWT_H·TOP_BEAM_H)은 루트 extras 로 내보내고 JS 가 로드 시 대조한다.
"""
import json
import math
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import car_guide_shoe as common  # box/cylinder/subtract/join/material, build_box_oiler
import bpy

T, box, cylinder, subtract, join, material, finish = (
    common.T, common.box, common.cylinder, common.subtract, common.join, common.material, common.finish)

ROOT = common.ROOT
RAIL_PATH = ROOT / "models/gltf/guide_rail_8k.glb"
OUTPUT_PATH = ROOT / "models/gltf/counterweight.glb"

# ── 외곽 계약 (js/config.js S 와 동일해야 함) ──
CWT_W = 1.38          # 레일 배면 간 거리
CWT_D = 0.20
CWT_H = 1.60
# ── 프레임 ──
RAIL_GAP = 0.022      # 레일 날끝 ↔ 기둥 웹 바깥면
UP_W = 0.065          # 채널 기둥 폭(X)
STEEL_T = 0.008       # 채널 판 두께
TOP_BEAM_H = 0.12     # 상부 빔 (히치판이 위, 너트가 아래) — elevator.js CWT_TOP_BEAM_H
BOT_BEAM_H = 0.16     # 하부 빔 (완충기 타격면)
HITCH_GAP = 0.072     # 상부 빔 아래 히치 너트·분할핀 공간 — 웨이트 최상단까지
# ── 웨이트 ──
WEIGHT_GAP = 0.002
WEIGHT_PITCH_TARGET = 0.057
HANDLE_X = 0.43       # 손잡이 홈 중심 |x| — 좌·우 양쪽 대칭
HANDLE_W = 0.12
HANDLE_DEPTH = 0.045  # 앞·뒤 면에서 파인 깊이
EMBOSS_X = 0.0        # 「30」 양각 중심 (가운데)
# ── 가이드슈 ──
SHOE_H = 0.11
SHOE_HALF_Z = 0.035
SHOE_WRAP = 0.016     # 날끝에서 레일 쪽으로 감싸는 길이
SHOE_BRACKET_T = 0.006


def rail_8k_profile():
    data = RAIL_PATH.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    binary_start = 20 + length + 8
    node = next(n for n in gltf["nodes"] if n.get("name") == "T_Rail_8K")
    prim = gltf["meshes"][node["mesh"]]["primitives"][0]
    acc = gltf["accessors"][prim["attributes"]["POSITION"]]
    view = gltf["bufferViews"][acc["bufferView"]]
    start = binary_start + view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", 12)
    verts = [struct.unpack_from("<fff", data, start + i * stride) for i in range(acc["count"])]
    tip = max(v[0] for v in verts)
    half = max(abs(v[2]) for v in verts if abs(v[0] - tip) < 1e-6)
    assert 0.05 < tip < 0.08 and 0.003 < half < 0.008, (tip, half)
    return tip, half


RAIL_TIP_DEPTH, RAIL_HALF = rail_8k_profile()
TIP_X = CWT_W / 2 - RAIL_TIP_DEPTH          # 레일 날끝 |x|
UP_OUT = TIP_X - RAIL_GAP                    # 기둥 웹 바깥면
UP_IN = UP_OUT - UP_W
SLOT_HALF = RAIL_HALF + 0.0005
H2 = CWT_H / 2
STACK_Y0 = -H2 + BOT_BEAM_H
STACK_Y1 = H2 - TOP_BEAM_H - HITCH_GAP
WEIGHT_COUNT = int((STACK_Y1 - STACK_Y0) // WEIGHT_PITCH_TARGET)
WEIGHT_PITCH = (STACK_Y1 - STACK_Y0) / WEIGHT_COUNT
WEIGHT_T = WEIGHT_PITCH - WEIGHT_GAP
WEIGHT_HALF_X = UP_OUT - STEEL_T - 0.003
WEIGHT_HALF_Z = CWT_D / 2 - STEEL_T - 0.002


def text_mesh(body, size, loc, mat, extrude=0.0, tilt=0.0):
    """앱 +Z 로 향한 세로면에 붙는 글자. tilt = 면 안에서 기울기(라디안)."""
    bpy.ops.object.text_add(location=T(*loc))
    obj = bpy.context.object
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.resolution_u = 4
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    obj.rotation_euler = (math.pi / 2, tilt, 0)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, mat, 0)


def duplicate(obj, dy):
    dup = obj.copy()
    dup.data = obj.data.copy()
    bpy.context.collection.objects.link(dup)
    dup.location.z += dy  # Blender Z = 앱 Y
    return dup


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    paint = material("CWT_FramePaint", (0.34, 0.42, 0.45), 0.25, 0.55)
    bolt = material("CWT_Bolts", (0.60, 0.50, 0.22), 0.8, 0.35)
    iron = material("CWT_WeightCast", (0.016, 0.016, 0.018), 0.35, 0.62)
    emboss = material("CWT_WeightEmboss", (0.035, 0.035, 0.038), 0.4, 0.5)
    marker = material("CWT_MarkerBlue", (0.02, 0.05, 0.40), 0.0, 0.7)
    shoe_poly = material("CWT_ShoeBlack", (0.025, 0.025, 0.027), 0.0, 0.78)
    zinc = material("CWT_ShoeBracket", (0.55, 0.57, 0.58), 0.8, 0.35)

    root = bpy.data.objects.new("CounterweightRoot", None)
    bpy.context.collection.objects.link(root)
    for key, value in {"contractVersion": 1, "railSpan": CWT_W, "depth": CWT_D, "height": CWT_H,
                       "topBeamH": TOP_BEAM_H, "bottomBeamH": BOT_BEAM_H, "hitchGap": HITCH_GAP,
                       "weightCount": WEIGHT_COUNT, "weightPitch": WEIGHT_PITCH,
                       "railTipX": TIP_X, "frameOuterX": UP_OUT}.items():
        root[key] = value

    # ── 프레임: 채널 기둥(웹 바깥, 플랜지 앞뒤) + 상·하부 박스 빔 + 모서리 거싯 ──
    frame, bolts = [], []
    for s in (-1, 1):
        frame.append(box("Upright web", (STEEL_T, CWT_H, CWT_D),
                         (s * (UP_OUT - STEEL_T / 2), 0, 0), bevel=0.0008))
        for zs in (-1, 1):
            frame.append(box("Upright flange", (UP_W, CWT_H, STEEL_T),
                             (s * (UP_OUT - UP_W / 2), 0, zs * (CWT_D / 2 - STEEL_T / 2)), bevel=0.0008))
    beam_w = 2 * (UP_OUT - STEEL_T)
    frame.append(box("Top beam", (beam_w, TOP_BEAM_H, CWT_D - 0.004), (0, H2 - TOP_BEAM_H / 2, 0), bevel=0.002))
    frame.append(box("Bottom beam", (beam_w, BOT_BEAM_H, CWT_D - 0.004), (0, -H2 + BOT_BEAM_H / 2, 0), bevel=0.002))
    for s in (-1, 1):
        for ys, bh in ((1, TOP_BEAM_H), (-1, BOT_BEAM_H)):
            gy = ys * (H2 - bh / 2)
            for zs in (-1, 1):
                gz = zs * (CWT_D / 2 + 0.003)
                frame.append(box("Corner gusset", (0.10, bh - 0.02, 0.006),
                                 (s * (UP_IN + 0.02), gy, gz), bevel=0.001))
                for dy in (-0.028, 0.028):
                    bolts.append(cylinder("Gusset bolt", 0.0095, 0.008,
                                          (s * (UP_IN - 0.005), gy + dy, gz + zs * 0.007), bolt,
                                          axis='z', sides=6))
    for o in frame:
        finish(o, paint, 0)
    join("Frame", frame, root)
    join("FrameBolts", bolts, root)

    # ── 웨이트: 검은 주물, 좌·우 손잡이 홈, 가운데 「30」 양각 ──
    first_y = STACK_Y1 - WEIGHT_PITCH / 2   # 1번 = 맨 위
    w0 = box("Weight", (2 * WEIGHT_HALF_X, WEIGHT_T, 2 * WEIGHT_HALF_Z), (0, first_y, 0), bevel=0)
    hh = WEIGHT_T * 0.55
    for xs in (-1, 1):      # 좌·우 양쪽 손잡이
        for zs in (-1, 1):  # 앞·뒤 막힌 홈 (가운데 살은 남김)
            subtract(w0, box("Handle pocket", (HANDLE_W, hh, 2 * HANDLE_DEPTH),
                             (xs * HANDLE_X, first_y - WEIGHT_T / 2 + 0.006 + hh / 2, zs * WEIGHT_HALF_Z), bevel=0))
    finish(w0, iron, 0.0025)
    weights, embossing, numbers = [w0], [], []
    e0 = text_mesh("30", WEIGHT_T * 0.62, (EMBOSS_X, first_y, WEIGHT_HALF_Z + 0.0008), emboss, extrude=0.0009)
    embossing.append(e0)
    num_x = -(UP_IN + UP_OUT) / 2
    for i in range(WEIGHT_COUNT):
        y = first_y - i * WEIGHT_PITCH
        if i:
            weights.append(duplicate(w0, -i * WEIGHT_PITCH))
            embossing.append(duplicate(e0, -i * WEIGHT_PITCH))
        # 작업자 마커 손글씨 번호 — 좌측 기둥 전면 플랜지, 블록 높이 중앙
        tilt = math.radians(((i * 37) % 11) - 5)
        numbers.append(text_mesh(str(i + 1), 0.030, (num_x, y, CWT_D / 2 + 0.0004), marker, tilt=tilt))
    join("Weights", weights, root)
    join("WeightEmboss", embossing, root)
    join("WeightNumbers", numbers, root)

    # ── 가이드슈 상·하 (검은 폴리머 몸체 + 아연 브라켓) ──
    shoes, brackets = [], []
    shoe_x0, shoe_x1 = UP_OUT + SHOE_BRACKET_T, TIP_X + SHOE_WRAP
    for s in (-1, 1):
        for sy in (H2 - 0.015 - SHOE_H / 2, -H2 + 0.015 + SHOE_H / 2):
            body = box("Guide shoe", (shoe_x1 - shoe_x0, SHOE_H, 2 * SHOE_HALF_Z),
                       (s * (shoe_x0 + shoe_x1) / 2, sy, 0), bevel=0)
            s0, s1 = TIP_X - 0.001, shoe_x1 + 0.01
            subtract(body, box("Rail slot", (s1 - s0, SHOE_H + 0.1, 2 * SLOT_HALF),
                               (s * (s0 + s1) / 2, sy, 0), bevel=0))
            shoes.append(finish(body, shoe_poly, 0.0015))
            brackets.append(box("Shoe bracket", (SHOE_BRACKET_T, SHOE_H + 0.03, 2 * SHOE_HALF_Z + 0.04),
                                (s * (UP_OUT + SHOE_BRACKET_T / 2), sy, 0), zinc, 0.0008))
            for zs in (-1, 1):
                for dy in (-0.045, 0.045):
                    brackets.append(cylinder("Bracket bolt", 0.0075, 0.007,
                                             (s * (UP_OUT + SHOE_BRACKET_T + 0.0035), sy + dy,
                                              zs * (SHOE_HALF_Z + 0.012)), zinc, axis='x', sides=6))
    join("GuideShoes", shoes, root)
    join("ShoeBrackets", brackets, root)

    # ── 오일통: 상부 슈 위 (기둥 상단에 브라켓) — 카 가이드슈와 같은 build_box_oiler ──
    for s, label in ((-1, "L"), (1, "R")):
        common.build_box_oiler(root, s * TIP_X, SLOT_HALF, H2, sign=-s, name=f"Oiler_{label}")

    bpy.ops.export_scene.gltf(filepath=str(OUTPUT_PATH), export_format='GLB',
                              export_extras=True, export_apply=True, export_animations=False)
    print(f"Counterweight exported: {OUTPUT_PATH}")
    print(f"railTipX={TIP_X:.4f} frameOuterX={UP_OUT:.4f} weights={WEIGHT_COUNT} pitch={WEIGHT_PITCH:.4f}")


if __name__ == "__main__":
    build()
