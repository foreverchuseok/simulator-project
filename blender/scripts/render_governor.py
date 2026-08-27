# -*- coding: utf-8 -*-
"""조속기 확인용 렌더 — overspeed_governor.py 실행 후 정면/사선 캡처.
   실행: blender -b -P blender/scripts/render_governor.py
   출력: .shot-gov-blender-front.png / .shot-gov-blender-iso.png (리포 루트)
"""
import bpy
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# 본 스크립트 실행 (씬 구성)
exec(compile(open(os.path.join(HERE, "overspeed_governor.py"), encoding="utf-8").read(),
             "overspeed_governor.py", "exec"))

scene = bpy.context.scene

# ── 앱과 같은 자세로 맞춘다 ────────────────────────────────────────────────
#   .glb 는 스프링을 수직으로 굽고 environment.js 래퍼가 SPRING_TILT 로 눕힌다.
#   렌더에서도 같이 눕혀야 "레버·떡판·스프링 일직선"을 눈으로 확인할 수 있다.
_spr = bpy.data.objects.get("Spring")
if _spr:
    _spr.rotation_euler = (0, SPR_TILT, 0)   # Blender Y 회전 = three z 의 부호 반대

# ── 로프 2가닥 (런타임에 environment.js 가 그리는 것 — 떡판 정렬 확인용) ──
for _rx in (-G_R, G_R):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.006, depth=0.30,
                                        location=T(_rx, GWY - 0.10, 0))
    _r = bpy.context.active_object
    _r.name = "refRope"
    _r.data.materials.append(make_material("RefRope", (0.60, 0.02, 0.02),
                                           metallic=0.0, roughness=0.5))
# 반투명 커버는 확인 렌더에서 숨긴다 (떡판·로프가 파랗게 묻힌다)
_cov = bpy.data.objects.get("Cover")
if _cov:
    _cov.hide_render = True

# ── 조명: 부드러운 스튜디오 라이트 ──
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", type='SUN'))
sun.data.energy = 1.8
sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(30))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", type='AREA'))
fill.data.energy = 30.0
fill.data.size = 2.0
fill.location = (0.3, -1.2, 0.5)
fill.rotation_euler = (math.radians(75), 0, math.radians(15))
scene.collection.objects.link(fill)

scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.3, 0.35, 0.4, 1.0)
    bg.inputs[1].default_value = 0.6

# ── 카메라 ──
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.film_transparent = False

TARGET = (0.0, -0.048, 0.225)  # Blender 좌표 (three (0, .225, .048))


def look_at(cam_obj, target):
    import mathutils
    d = mathutils.Vector(target) - cam_obj.location
    cam_obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# 정면 (three +Z 방향 = Blender -Y 에서 바라봄)
cam.location = (0.0, -0.85, 0.24)
look_at(cam, TARGET)
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-front.png")
bpy.ops.render.render(write_still=True)
print("[render] front ->", scene.render.filepath)

# 사선 3/4
cam.location = (0.55, -0.65, 0.42)
look_at(cam, TARGET)
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-iso.png")
bpy.ops.render.render(write_still=True)
print("[render] iso ->", scene.render.filepath)

# 떡판(캐치슈)·로프 근접 — 우측 하단
SHOE_T = (0.115, -0.02, 0.190)   # Blender = three (0.115, 0.190, 0.02)
cam.location = (0.16, -0.34, 0.22)
look_at(cam, SHOE_T)
cam_data.lens = 60
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-shoe.png")
bpy.ops.render.render(write_still=True)
print("[render] shoe ->", scene.render.filepath)

# 상단 쐐기 & 스프링 클로즈업 (위에서 비스듬히 내려다봄 — 실사 매칭 뷰)
PAWL_TOP_TGT = (PAWL_PIV[0] - 0.005, -PAWL_Z, PAWL_PIV[1])
cam.location = (PAWL_PIV[0] - 0.015, -0.14, PAWL_PIV[1] + 0.10)
look_at(cam, PAWL_TOP_TGT)
cam_data.lens = 75
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-top.png")
bpy.ops.render.render(write_still=True)
print("[render] top ->", scene.render.filepath)

# ── 쐐기 & 래칫 톱날 대기 클로즈업 ──
PAWL_TGT = (PAWL_PIV[0], -PAWL_Z, PAWL_PIV[1])  # Blender 좌표
cam.location = (PAWL_PIV[0] + 0.01, -0.38, PAWL_PIV[1] - 0.01)
look_at(cam, PAWL_TGT)
cam_data.lens = 85
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-pawl.png")
bpy.ops.render.render(write_still=True)
print("[render] pawl ->", scene.render.filepath)

# ── ★트립 자세 (Trip Pose) 쐐기-톱날 정밀 물림 렌더링 ──
_pawl = bpy.data.objects.get("Pawl")
_pendA = bpy.data.objects.get("PendA")
_pendB = bpy.data.objects.get("PendB")
_catch = bpy.data.objects.get("Catch")
_plunger = bpy.data.objects.get("Plunger")

if _pawl:
    _pawl.rotation_euler = (0, -0.60, 0)  # Blender Y- = Three.js rotation.z +0.60 (골 박힘)
if _pendA:
    _pendA.rotation_euler = (0, 0.45, 0)
if _pendB:
    _pendB.rotation_euler = (0, 0.45, 0)
if _catch:
    _catch.rotation_euler = (0, 0.14, 0)
if _plunger:
    _plunger.rotation_euler = (0, 0.52, 0)  # 스위치 레버가 아래로 뚝 떨어짐

scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-trip.png")
bpy.ops.render.render(write_still=True)
print("[render] trip ->", scene.render.filepath)

# 후면 (three -Z 방향 = Blender +Y 에서 바라봄)
REAR_T = (0.0, -0.048, 0.225)
cam.location = (0.0, 0.85, 0.24)
look_at(cam, REAR_T)
cam_data.lens = 50
scene.render.filepath = os.path.join(ROOT, ".shot-gov-blender-rear.png")
bpy.ops.render.render(write_still=True)
print("[render] rear ->", scene.render.filepath)

