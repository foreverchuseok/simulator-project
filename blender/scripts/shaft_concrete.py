# -*- coding: utf-8 -*-
# 승강로 내면 — Blender 절차형 시멘트(거친 결·얼룩·물자국).
# 타이홀 없음. 거푸집 이음은 아주 희미하게만.
# 출력: assets/bg/shaft_concrete.png, assets/bg/shaft_concrete_n.png

import bpy
import os

TEX_W = 2048
TEX_H = 2048
OUT_ALBEDO = r"C:\Users\goodm\Desktop\simmul\assets\bg\shaft_concrete.png"
OUT_NORMAL = r"C:\Users\goodm\Desktop\simmul\assets\bg\shaft_concrete_n.png"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def link(nt, a, b):
    nt.links.new(a, b)


def mix_rgba(nt, blend="MIX"):
    try:
        n = nt.nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        n.blend_type = blend
        return n, "Factor", "A", "B", "Result"
    except Exception:
        n = nt.nodes.new("ShaderNodeMixRGB")
        n.blend_type = blend
        return n, "Fac", "Color1", "Color2", "Color"


def noise(nt, scale, detail=8.0, rough=0.55, distort=0.0):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.noise_dimensions = "2D"
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    if "Distortion" in n.inputs:
        n.inputs["Distortion"].default_value = distort
    return n


def mapping(nt, sx, sy, sz=1.0):
    m = nt.nodes.new("ShaderNodeMapping")
    m.inputs["Scale"].default_value = (sx, sy, sz)
    return m


def rgb(nt, c):
    n = nt.nodes.new("ShaderNodeRGB")
    n.outputs[0].default_value = (c[0], c[1], c[2], 1.0)
    return n


def build_material():
    mat = bpy.data.materials.new("ShaftCement")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.08

    uv = nt.nodes.new("ShaderNodeTexCoord")
    map_cloud = mapping(nt, 2.2, 2.2)
    map_grit = mapping(nt, 1.0, 1.0)
    map_pore = mapping(nt, 1.0, 1.0)
    map_streak = mapping(nt, 14.0, 0.85)
    map_rust = mapping(nt, 22.0, 0.55)

    cloud = noise(nt, 3.4, 10.0, 0.58, 0.12)
    grit = noise(nt, 92.0, 12.0, 0.72, 0.05)
    pore = noise(nt, 160.0, 4.0, 0.40, 0.0)
    streak = noise(nt, 5.5, 8.0, 0.48, 0.20)
    rustn = noise(nt, 4.0, 6.0, 0.50, 0.15)
    blot = noise(nt, 6.5, 8.0, 0.62, 0.08)

    c_light = rgb(nt, (0.70, 0.68, 0.63))
    c_base = rgb(nt, (0.52, 0.50, 0.46))
    c_damp = rgb(nt, (0.30, 0.29, 0.27))
    c_grit = rgb(nt, (0.40, 0.38, 0.34))
    c_stain = rgb(nt, (0.24, 0.23, 0.21))
    c_rust = rgb(nt, (0.46, 0.30, 0.18))
    c_seam = rgb(nt, (0.42, 0.40, 0.37))

    mix_cloud, f1, a1, b1, r1 = mix_rgba(nt)
    mix_damp, f2, a2, b2, r2 = mix_rgba(nt)
    mix_grit, f3, a3, b3, r3 = mix_rgba(nt, "MULTIPLY")
    mix_stain, f4, a4, b4, r4 = mix_rgba(nt)
    mix_rust, f5, a5, b5, r5 = mix_rgba(nt)
    mix_seam, f6, a6, b6, r6 = mix_rgba(nt)

    # 이음 마스크 — UV 가장자리만 아주 흐리게
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    subu = nt.nodes.new("ShaderNodeMath")
    subu.operation = "SUBTRACT"
    subu.inputs[0].default_value = 1.0
    subv = nt.nodes.new("ShaderNodeMath")
    subv.operation = "SUBTRACT"
    subv.inputs[0].default_value = 1.0
    minu = nt.nodes.new("ShaderNodeMath")
    minu.operation = "MINIMUM"
    minv = nt.nodes.new("ShaderNodeMath")
    minv.operation = "MINIMUM"
    edge = nt.nodes.new("ShaderNodeMath")
    edge.operation = "MINIMUM"
    # 가장자리 0.04 안에서만, 부드럽게
    seam_rng = nt.nodes.new("ShaderNodeMapRange")
    seam_rng.inputs["From Min"].default_value = 0.0
    seam_rng.inputs["From Max"].default_value = 0.045
    seam_rng.inputs["To Min"].default_value = 0.18
    seam_rng.inputs["To Max"].default_value = 0.0
    seam_rng.clamp = True

    # 얼룩/물자국 강도
    stain_rng = nt.nodes.new("ShaderNodeMapRange")
    stain_rng.inputs["From Min"].default_value = 0.52
    stain_rng.inputs["From Max"].default_value = 0.82
    stain_rng.inputs["To Min"].default_value = 0.0
    stain_rng.inputs["To Max"].default_value = 0.42
    stain_rng.clamp = True

    rust_rng = nt.nodes.new("ShaderNodeMapRange")
    rust_rng.inputs["From Min"].default_value = 0.72
    rust_rng.inputs["From Max"].default_value = 0.92
    rust_rng.inputs["To Min"].default_value = 0.0
    rust_rng.inputs["To Max"].default_value = 0.22
    rust_rng.clamp = True

    damp_rng = nt.nodes.new("ShaderNodeMapRange")
    damp_rng.inputs["From Min"].default_value = 0.58
    damp_rng.inputs["From Max"].default_value = 0.88
    damp_rng.inputs["To Min"].default_value = 0.0
    damp_rng.inputs["To Max"].default_value = 0.38
    damp_rng.clamp = True

    grit_rng = nt.nodes.new("ShaderNodeMapRange")
    grit_rng.inputs["From Min"].default_value = 0.25
    grit_rng.inputs["From Max"].default_value = 0.80
    grit_rng.inputs["To Min"].default_value = 0.12
    grit_rng.inputs["To Max"].default_value = 0.38
    grit_rng.clamp = True

    # 높이: 모래결 + 기공(작은 움푹, 원형 타이홀 아님)
    h_mix = nt.nodes.new("ShaderNodeMath")
    h_mix.operation = "MULTIPLY_ADD"
    h_mix.inputs[1].default_value = 0.55
    h_mix.inputs[2].default_value = 0.20
    h_pore = nt.nodes.new("ShaderNodeMath")
    h_pore.operation = "MULTIPLY_ADD"
    h_pore.inputs[1].default_value = 0.18
    h_pore.inputs[2].default_value = 0.0
    h_sub = nt.nodes.new("ShaderNodeMath")
    h_sub.operation = "SUBTRACT"

    alb = bpy.data.images.new("ShaftCementAlbedo", TEX_W, TEX_H, alpha=False)
    nrm = bpy.data.images.new("ShaftCementNormal", TEX_W, TEX_H, alpha=False)
    bake_alb = nt.nodes.new("ShaderNodeTexImage")
    bake_alb.image = alb
    bake_nrm = nt.nodes.new("ShaderNodeTexImage")
    bake_nrm.image = nrm

    # 벡터
    link(nt, uv.outputs["UV"], map_cloud.inputs["Vector"])
    link(nt, uv.outputs["UV"], map_grit.inputs["Vector"])
    link(nt, uv.outputs["UV"], map_pore.inputs["Vector"])
    link(nt, uv.outputs["UV"], map_streak.inputs["Vector"])
    link(nt, uv.outputs["UV"], map_rust.inputs["Vector"])
    link(nt, uv.outputs["UV"], sep.inputs["Vector"])
    link(nt, map_cloud.outputs["Vector"], cloud.inputs["Vector"])
    link(nt, map_grit.outputs["Vector"], grit.inputs["Vector"])
    link(nt, map_pore.outputs["Vector"], pore.inputs["Vector"])
    link(nt, map_streak.outputs["Vector"], streak.inputs["Vector"])
    link(nt, map_rust.outputs["Vector"], rustn.inputs["Vector"])
    link(nt, map_cloud.outputs["Vector"], blot.inputs["Vector"])

    # 색
    link(nt, c_light.outputs[0], mix_cloud.inputs[a1])
    link(nt, c_base.outputs[0], mix_cloud.inputs[b1])
    link(nt, cloud.outputs["Fac"], mix_cloud.inputs[f1])
    link(nt, mix_cloud.outputs[r1], mix_damp.inputs[a2])
    link(nt, c_damp.outputs[0], mix_damp.inputs[b2])
    link(nt, blot.outputs["Fac"], damp_rng.inputs["Value"])
    link(nt, damp_rng.outputs["Result"], mix_damp.inputs[f2])
    link(nt, mix_damp.outputs[r2], mix_grit.inputs[a3])
    link(nt, c_grit.outputs[0], mix_grit.inputs[b3])
    link(nt, grit.outputs["Fac"], grit_rng.inputs["Value"])
    link(nt, grit_rng.outputs["Result"], mix_grit.inputs[f3])
    link(nt, mix_grit.outputs[r3], mix_stain.inputs[a4])
    link(nt, c_stain.outputs[0], mix_stain.inputs[b4])
    link(nt, streak.outputs["Fac"], stain_rng.inputs["Value"])
    link(nt, stain_rng.outputs["Result"], mix_stain.inputs[f4])
    link(nt, mix_stain.outputs[r4], mix_rust.inputs[a5])
    link(nt, c_rust.outputs[0], mix_rust.inputs[b5])
    link(nt, rustn.outputs["Fac"], rust_rng.inputs["Value"])
    link(nt, rust_rng.outputs["Result"], mix_rust.inputs[f5])

    link(nt, sep.outputs["X"], subu.inputs[1])
    link(nt, sep.outputs["Y"], subv.inputs[1])
    link(nt, sep.outputs["X"], minu.inputs[0])
    link(nt, subu.outputs["Value"], minu.inputs[1])
    link(nt, sep.outputs["Y"], minv.inputs[0])
    link(nt, subv.outputs["Value"], minv.inputs[1])
    link(nt, minu.outputs["Value"], edge.inputs[0])
    link(nt, minv.outputs["Value"], edge.inputs[1])
    link(nt, edge.outputs["Value"], seam_rng.inputs["Value"])
    link(nt, mix_rust.outputs[r5], mix_seam.inputs[a6])
    link(nt, c_seam.outputs[0], mix_seam.inputs[b6])
    link(nt, seam_rng.outputs["Result"], mix_seam.inputs[f6])

    link(nt, mix_seam.outputs[r6], emit.inputs["Color"])
    link(nt, mix_seam.outputs[r6], bsdf.inputs["Base Color"])

    # 높이(기공+모래, 원형 구멍 없음)
    link(nt, grit.outputs["Fac"], h_mix.inputs[0])
    link(nt, cloud.outputs["Fac"], h_mix.inputs[2])
    link(nt, pore.outputs["Fac"], h_pore.inputs[0])
    link(nt, h_mix.outputs["Value"], h_pore.inputs[2])
    link(nt, h_pore.outputs["Value"], h_sub.inputs[0])
    link(nt, seam_rng.outputs["Result"], h_sub.inputs[1])
    link(nt, h_sub.outputs["Value"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.95
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0

    # 기본은 알베도 베이크용 Emission
    link(nt, emit.outputs["Emission"], out.inputs["Surface"])
    return mat, alb, nrm, bake_alb, bake_nrm, out, emit, bsdf


def bake_to(img_node, img, bake_type):
    nt = img_node.id_data
    for n in nt.nodes:
        n.select = False
    img_node.select = True
    nt.nodes.active = img_node
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.bake_type = bake_type
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 8
    if bake_type == "NORMAL":
        scene.render.bake.normal_space = "TANGENT"
    bpy.ops.object.bake(type=bake_type)
    img.filepath_raw = OUT_ALBEDO if bake_type == "EMIT" else OUT_NORMAL
    img.file_format = "PNG"
    os.makedirs(os.path.dirname(img.filepath_raw), exist_ok=True)
    img.save()
    print("[shaft_concrete] baked", bake_type, img.filepath_raw)


reset_scene()
bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, 0))
plane = bpy.context.active_object
plane.name = "ShaftCementBake"
mat, alb, nrm, bake_alb, bake_nrm, out, emit, bsdf = build_material()
plane.data.materials.append(mat)
bpy.ops.object.select_all(action="DESELECT")
plane.select_set(True)
bpy.context.view_layer.objects.active = plane

print("[shaft_concrete] 시멘트 알베도 베이크…")
bake_to(bake_alb, alb, "EMIT")

# 노멀 베이크 — Principled + Bump
nt = mat.node_tree
for ln in list(nt.links):
    if ln.to_node == out and ln.to_socket == out.inputs["Surface"]:
        nt.links.remove(ln)
link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
print("[shaft_concrete] 시멘트 노멀 베이크…")
bake_to(bake_nrm, nrm, "NORMAL")
print("완료 — 승강로 시멘트 실사 텍스처")
