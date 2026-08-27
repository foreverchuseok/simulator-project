# -*- coding: utf-8 -*-
# 조속기 로프 Ø8mm 6연선 — 1피치 타일 텍스처.
# 출력: assets/bg/wire_rope_8mm.png , assets/bg/wire_rope_8mm_n.png
#
# U = 둘레(6가닥), V = 꼬임 1피치(56mm). Three.js RepeatWrapping.

import bpy
import os

TEX_W, TEX_H = 1024, 512
OUT_ALBEDO = r"C:\Users\goodm\Desktop\simmul\assets\bg\wire_rope_8mm.png"
OUT_NORMAL = r"C:\Users\goodm\Desktop\simmul\assets\bg\wire_rope_8mm_n.png"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)


def link(nt, a, b):
    nt.links.new(a, b)


def build_material():
    mat = bpy.data.materials.new("WireRope8mm")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.004

    uv = nt.nodes.new("ShaderNodeTexCoord")

    # ── 6연선 헬리컬 좌표: u*6 - v 가 가닥 인덱스 ────────────────
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, uv.outputs["UV"], sep.inputs["Vector"])

    mul_u = nt.nodes.new("ShaderNodeMath")
    mul_u.operation = "MULTIPLY"
    mul_u.inputs[1].default_value = 6.0
    link(nt, sep.outputs["X"], mul_u.inputs[0])

    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    link(nt, mul_u.outputs["Value"], sub.inputs[0])
    link(nt, sep.outputs["Y"], sub.inputs[1])

    frac = nt.nodes.new("ShaderNodeMath")
    frac.operation = "FRACT"
    link(nt, sub.outputs["Value"], frac.inputs[0])

    # 가닥 중심(0.5)에서의 거리 → 둥근 스트랜드 단면
    sub05 = nt.nodes.new("ShaderNodeMath")
    sub05.operation = "SUBTRACT"
    sub05.inputs[1].default_value = 0.5
    link(nt, frac.outputs["Value"], sub05.inputs[0])

    absn = nt.nodes.new("ShaderNodeMath")
    absn.operation = "ABSOLUTE"
    link(nt, sub05.outputs["Value"], absn.inputs[0])

    # 가닥 폭. 0.42 이내가 강선, 밖은 골
    div = nt.nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = 0.42
    link(nt, absn.outputs["Value"], div.inputs[0])

    strand = nt.nodes.new("ShaderNodeMath")
    strand.operation = "MINIMUM"
    strand.inputs[1].default_value = 1.0
    link(nt, div.outputs["Value"], strand.inputs[0])

    # 가닥 안 7선: 헬리컬 보조 줄무늬
    mul_w = nt.nodes.new("ShaderNodeMath")
    mul_w.operation = "MULTIPLY"
    mul_w.inputs[1].default_value = 7.0
    link(nt, frac.outputs["Value"], mul_w.inputs[0])

    add_v = nt.nodes.new("ShaderNodeMath")
    add_v.operation = "ADD"
    mul_v4 = nt.nodes.new("ShaderNodeMath")
    mul_v4.operation = "MULTIPLY"
    mul_v4.inputs[1].default_value = 4.0
    link(nt, sep.outputs["Y"], mul_v4.inputs[0])
    link(nt, mul_w.outputs["Value"], add_v.inputs[0])
    link(nt, mul_v4.outputs["Value"], add_v.inputs[1])

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 1.0
    wave.inputs["Distortion"].default_value = 0.35
    wave.inputs["Detail"].default_value = 3.0
    # Wave는 Vector 입력. 가닥 로컬 x만 쓰도록 Combine
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    link(nt, add_v.outputs["Value"], comb.inputs["X"])
    link(nt, comb.outputs["Vector"], wave.inputs["Vector"])

    # 골(어두운 틈) vs 강선
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    link(nt, strand.outputs["Value"], inv.inputs[1])

    pows = nt.nodes.new("ShaderNodeMath")
    pows.operation = "POWER"
    pows.inputs[1].default_value = 1.6
    link(nt, inv.outputs["Value"], pows.inputs[0])

    # 색: 골 #2c3238 / 강선 하이라이트 #c5ccd3 / 중간 #8b939c
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.18, 0.20, 0.22, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (0.72, 0.75, 0.78, 1)
    mid = ramp.color_ramp.elements.new(0.45)
    mid.color = (0.48, 0.51, 0.55, 1)
    link(nt, pows.outputs["Value"], ramp.inputs["Fac"])

    # 강선 줄무늬를 살짝 곱해 와이어 결
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.28
    link(nt, ramp.outputs["Color"], mix.inputs["Color1"])
    link(nt, wave.outputs["Color"], mix.inputs["Color2"])

    # 하이라이트 릿지
    rid = nt.nodes.new("ShaderNodeMath")
    rid.operation = "POWER"
    rid.inputs[1].default_value = 4.0
    link(nt, pows.outputs["Value"], rid.inputs[0])
    mix2 = nt.nodes.new("ShaderNodeMixRGB")
    mix2.blend_type = "ADD"
    mix2.inputs["Fac"].default_value = 0.18
    hi = nt.nodes.new("ShaderNodeRGB")
    hi.outputs[0].default_value = (0.85, 0.87, 0.90, 1)
    link(nt, mix.outputs["Color"], mix2.inputs["Color1"])
    link(nt, hi.outputs["Color"], mix2.inputs["Color2"])
    # use ridge as fac
    mix2.inputs["Fac"].default_value = 0.0
    # wire Fac from rid — connect
    # (Blender MixRGB Fac)
    link(nt, rid.outputs["Value"], mix2.inputs["Fac"])

    grit = nt.nodes.new("ShaderNodeTexNoise")
    grit.noise_dimensions = "2D"
    grit.inputs["Scale"].default_value = 180.0
    grit.inputs["Detail"].default_value = 4.0
    mapg = nt.nodes.new("ShaderNodeMapping")
    mapg.inputs["Scale"].default_value = (1.0, 3.5, 1.0)
    link(nt, uv.outputs["UV"], mapg.inputs["Vector"])
    link(nt, mapg.outputs["Vector"], grit.inputs["Vector"])
    mix3 = nt.nodes.new("ShaderNodeMixRGB")
    mix3.blend_type = "MULTIPLY"
    mix3.inputs["Fac"].default_value = 0.12
    link(nt, mix2.outputs["Color"], mix3.inputs["Color1"])
    link(nt, grit.outputs["Color"], mix3.inputs["Color2"])

    link(nt, mix3.outputs["Color"], emit.inputs["Color"])
    link(nt, emit.outputs["Emission"], out.inputs["Surface"])

    # 범프 높이 = 가닥 볼록 + 미세 강선
    bump_h = nt.nodes.new("ShaderNodeMath")
    bump_h.operation = "MULTIPLY"
    bump_h.inputs[1].default_value = 0.85
    link(nt, pows.outputs["Value"], bump_h.inputs[0])
    addb = nt.nodes.new("ShaderNodeMath")
    addb.operation = "ADD"
    mulw = nt.nodes.new("ShaderNodeMath")
    mulw.operation = "MULTIPLY"
    mulw.inputs[1].default_value = 0.12
    link(nt, wave.outputs["Fac"], mulw.inputs[0])
    link(nt, bump_h.outputs["Value"], addb.inputs[0])
    link(nt, mulw.outputs["Value"], addb.inputs[1])
    link(nt, addb.outputs["Value"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Base Color"].default_value = (0.55, 0.57, 0.60, 1)
    bsdf.inputs["Metallic"].default_value = 0.9
    bsdf.inputs["Roughness"].default_value = 0.35

    img_alb = bpy.data.images.new("rope_alb", TEX_W, TEX_H, alpha=False)
    img_nrm = bpy.data.images.new("rope_nrm", TEX_W, TEX_H, alpha=False)
    n_alb = nt.nodes.new("ShaderNodeTexImage")
    n_alb.image = img_alb
    n_nrm = nt.nodes.new("ShaderNodeTexImage")
    n_nrm.image = img_nrm
    return mat, n_alb, n_nrm, img_alb, img_nrm, out, emit, bsdf


def bake_to(img_node, img, bake_type, path):
    nt = img_node.id_data
    for n in nt.nodes:
        n.select = False
    img_node.select = True
    nt.nodes.active = img_node
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.bake_type = bake_type
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 2
    scene.render.bake.use_selected_to_active = False
    if bake_type == "NORMAL":
        scene.render.bake.normal_space = "TANGENT"
        bpy.ops.object.bake(type="NORMAL")
    else:
        bpy.ops.object.bake(type="EMIT")
    img.filepath_raw = path
    img.file_format = "PNG"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save()
    print("[wire_rope_8mm] baked", bake_type, path)


reset_scene()
bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, 0))
plane = bpy.context.active_object
plane.name = "RopeBake"
mat, n_alb, n_nrm, img_alb, img_nrm, out, emit, bsdf = build_material()
plane.data.materials.append(mat)
bpy.ops.object.select_all(action="DESELECT")
plane.select_set(True)
bpy.context.view_layer.objects.active = plane

print("[wire_rope_8mm] 알베도 베이크…")
bake_to(n_alb, img_alb, "EMIT", OUT_ALBEDO)

nt = mat.node_tree
for ln in list(nt.links):
    if ln.to_node == out and ln.to_socket == out.inputs["Surface"]:
        nt.links.remove(ln)
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
print("[wire_rope_8mm] 노멀 베이크…")
bake_to(n_nrm, img_nrm, "NORMAL", OUT_NORMAL)
print("[wire_rope_8mm] 완료")
