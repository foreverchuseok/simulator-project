"""Geared (worm) traction machine for the machine room.

Three.js local frame, metres, origin = main sheave axis centre:
  X = sheave/wheel shaft axis (sheave plane x=0, worm wheel plane x=WHEEL_X)
  Y = up, Z = front (+Z: brake → motor, -Z: hand-crank end of the worm).
The worm sits ABOVE the bronze wheel (overhead worm), as on the cut-away
exhibition machine photographs (권상기1~5.JPG): motor → brake drum → worm →
wheel → overhung sheave.  Gray paint scheme, red section faces for the
educational cut-away, visible oil level.

Mount interface is read from js/environment.js (TRACTION_MACHINE_MOUNT) and
rope positions from js/elevator.js buildWireRopes(); the same numbers are
written back to glTF extras so the loader can check them.
"""
import bpy, math, re, json
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENV = (ROOT / 'js/environment.js').read_text(encoding='utf-8')
MOUNT = json.loads(re.search(r'const TRACTION_MACHINE_MOUNT = (\{.*?\});', ENV, re.S)[1])
ELEV = (ROOT / 'js/elevator.js').read_text(encoding='utf-8')
ROPE_X = json.loads(re.search(r'const ROPE_GROOVE_X = (\[.*?\]);', ELEV)[1])
ROPES = ELEV.split('function buildWireRopes()')[1].split('function refreshWireRopeShape')[0]
ROPE_RADIUS = float(re.search(r'const ropeR = ([\d.]+)', ROPES)[1])

# ── Mount / kinematics (shared with JS) ────────────────────────────────
SHEAVE_R = MOUNT['sheaveR']            # rope centre-line radius (mainR)
XW = MOUNT['wheelX']                   # worm-wheel plane
A = MOUNT['wormY']                     # centre distance = worm axis height
Z1, Z2 = MOUNT['wormStarts'], MOUNT['wheelTeeth']
BASE_TOP = MOUNT['baseTop']            # pedestal top (machine bedplate underside)
BASE_X, BASE_Z = MOUNT['baseX'], MOUNT['baseZ']

# ── Worm gear set (module 8, 2-start worm, 50-tooth bronze wheel) ──────
MOD = A * 2 / (Z2 + 12.5)              # q = 12.5 → module from centre distance
RW = MOD * Z2 / 2                      # wheel pitch radius
RWORM = A - RW                         # worm pitch radius
P_AX = math.pi * MOD                   # axial pitch
LEAD = Z1 * P_AX
TAN_L = LEAD / (2 * math.pi * RWORM)   # lead angle tangent
PA = math.radians(20)
CLR = 0.2 * MOD
WORM_TIP, WORM_ROOT = RWORM + MOD, RWORM - 1.2 * MOD
WHEEL_THROAT, WHEEL_ROOT = A - WORM_ROOT - CLR, A - WORM_TIP - CLR
WHEEL_OD = WHEEL_THROAT + 1.25 * MOD
WHEEL_B = 0.070                        # face width
WHEEL_RIM_IN = 0.160
WORM_THREAD_Z = 0.112                  # threaded length ±
WORM_PER_SHEAVE = -Z2 / Z1             # worm rot about +Z per sheave rot about +X (RH worm)

# ── Housing ─────────────────────────────────────────────────────────────
H_R = 0.262        # wheel chamber outer radius
H_RI = 0.237       # wheel chamber inner radius
H_W = 0.100        # half width (x) of the housing
H_WI = 0.075       # half width of the cavity
H_BOT = BASE_TOP + 0.035      # housing feet underside (bedplate is 35 mm)
TUBE_R, TUBE_RI = 0.100, 0.076
TUBE_Z = 0.235
OIL_Y = -0.155                 # oil level (wheel dips ~2.5 teeth)
SIGHT_Z, DRAIN_Z = -0.200, -0.222   # sight glass / drain on the -X face, rear lower corner
CUT_EPS = 0.012

# ── Brake / motor stations along Z ─────────────────────────────────────
DRUM_Z, DRUM_R, DRUM_W = 0.325, 0.130, 0.080
ARM_X = 0.178                  # arm centre offset from wheel plane (±)
PIVOT_Y = A - 0.190
ARM_TOP = A + 0.262            # arm tops reach the dual-solenoid push rods (body axis)
BODY_Y = A + 0.243             # dual brake solenoid body axis (X)
BASE_Y0, BASE_Y1 = A + 0.171, A + 0.187   # black dual-brake base plate
SPRING_Y = A + 0.155           # arm bolt / spring axis
SPRING_SET = 0.116             # TK TM30B 11 kW: spring-cap inner length 116 mm (설치 치수)
ARM_NUT_GAP = 0.004            # arm ↔ arm-bolt fixing nut; inspection limit ≥ 3 mm
MOTOR_Z0, MOTOR_Z1, MOTOR_R = 0.405, 0.720, 0.168
COWL_F = MOTOR_Z1 + 0.078      # pressed-steel fan cowl grille face (rear of motor)
ENC_Z0, ENC_Z1 = COWL_F + 0.007, COWL_F + 0.047   # hollow-shaft rotary encoder body
ENC_R = 0.031
ENC_CABLE_A = math.radians(150)                   # cable gland direction (upper -X side)
CRANK_Z = -0.330

# ── Sheave / guard ──────────────────────────────────────────────────────
SHV_HALF = 0.095
SHV_FLANGE_R = SHEAVE_R + 0.015
SHV_LAND_R = SHEAVE_R + 0.003
SHV_GROOVE_R = ROPE_RADIUS + 0.0005
SHV_RIM_IN = 0.290
SHV_HUB_R = 0.085
SHAFT_R = 0.045
GUARD_R = 0.374
GUARD_X = 0.118
DEF_R, DEF_DZ, DEF_DY = MOUNT['deflectorR'], MOUNT['deflectorDZ'], MOUNT['deflectorDY']
_d = math.hypot(DEF_DZ, DEF_DY)
ROPE_TAN_A = (math.atan2(DEF_DY, DEF_DZ) - math.acos((SHEAVE_R - DEF_R) / _d)) % (2 * math.pi)  # rope leaves main sheave
ROPE_DIR = (-math.sin(ROPE_TAN_A), math.cos(ROPE_TAN_A))   # (z, y) unit, main → deflector along the rope
GUARD_TAIL = 0.330             # rear tunnel length along the rope (rope brake body starts ≈ 0.40)
GUARD_SKIRT_BOT = -0.280       # front skirt along the descending car rope

def T(x, y, z): return (x, -z, y)

# ───────────────────────────── helpers ─────────────────────────────────
def material(name, color, metal, rough, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
        try: m.blend_method = 'BLEND'
        except Exception: pass
    return m

def grain(mat, strength, seed):
    rng = np.random.default_rng(seed); h = rng.random((128, 128))
    for _ in range(2): h = (h + np.roll(h, 1, 0) + np.roll(h, 1, 1)) / 3
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1); dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    px = np.ones((128, 128, 4), dtype=np.float32)
    px[:, :, 0] = .5 + dx * .6; px[:, :, 1] = .5 + dy * .6; px[:, :, 2] = .98
    im = bpy.data.images.new(mat.name + '_grain', width=128, height=128); im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(px.ravel()); im.update(); im.pack()
    n = mat.node_tree.nodes; t = n.new('ShaderNodeTexImage'); t.image = im
    nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
    mat.node_tree.links.new(t.outputs['Color'], nm.inputs['Color'])
    mat.node_tree.links.new(nm.outputs['Normal'], n.get('Principled BSDF').inputs['Normal'])

def link_new(o):
    bpy.context.collection.objects.link(o); return o

def smooth(o, angle=35):
    for p in o.data.polygons: p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        o.select_set(False)
    except Exception:
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    return o

def bevel(o, r, segments=2, angle=None):
    bpy.context.view_layer.objects.active = o
    b = o.modifiers.new('edge', 'BEVEL'); b.width = r; b.segments = segments
    if angle: b.limit_method = 'ANGLE'; b.angle_limit = math.radians(angle)
    b.harden_normals = True
    try: bpy.ops.object.modifier_apply(modifier=b.name)
    except Exception: o.modifiers.remove(b)
    return smooth(o)

def box(name, size, pos, mat, r=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(*pos)); o = bpy.context.object; o.name = name
    o.dimensions = (size[0], size[2], size[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if r: bevel(o, r, 2)
    return o

def box_span(name, x, y, z, mat, r=0.0):
    return box(name, (x[1]-x[0], y[1]-y[0], z[1]-z[0]), ((x[0]+x[1])/2, (y[0]+y[1])/2, (z[0]+z[1])/2), mat, r)

def cyl(name, r, length, pos, mat, axis=(1, 0, 0), verts=32, r2=None, bev=0.0):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=length, location=T(*pos))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=length, location=T(*pos))
    o = bpy.context.object; o.name = name; o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(T(*axis)))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(mat)
    if bev: bevel(o, bev, 2, 50)
    else: smooth(o)
    return o

def rod(name, a, b, r, mat, verts=16):
    a, b = Vector(a), Vector(b)
    return cyl(name, r, (b - a).length, tuple((a + b) / 2), mat, tuple((b - a).normalized()), verts)

def hexbolt(name, pos, axis, mat, s=0.013, h=0.010):
    """Hex head + washer; axis points out of the surface."""
    ax = Vector(axis).normalized(); p = Vector(pos)
    w = cyl(name + 'Washer', s * 1.25, 0.003, tuple(p + ax * 0.0015), mat, axis, 20)
    hd = cyl(name, s, h, tuple(p + ax * (0.003 + h / 2)), mat, axis, 6, bev=0.0012)
    return [w, hd]

def mesh_obj(name, verts3, faces, mat_list, mat_idx=None, smooth_angle=40):
    me = bpy.data.meshes.new(name); me.from_pydata([T(*v) for v in verts3], [], faces); me.update()
    uv = me.uv_layers.new(name='UVMap')   # box-style UVs so the cast-grain normal map has coordinates
    for poly in me.polygons:
        n = poly.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            uv.data[li].uv = (u * 6, v * 6)
    o = link_new(bpy.data.objects.new(name, me))
    for m in mat_list: o.data.materials.append(m)
    if mat_idx is not None: o.data.polygons.foreach_set('material_index', mat_idx)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-7)          # lathe profiles that touch the axis
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
    smooth(o, smooth_angle)
    return o

def lathe(name, profile, axis, center, mats, seg_mat=None, segs=64, smooth_angle=40):
    """Revolve a closed (axial, radius) profile around X or Z through center."""
    cx, cy, cz = center; n = len(profile); verts = []; faces = []; idx = []
    for k in range(segs):
        ph = 2 * math.pi * k / segs; c, s = math.cos(ph), math.sin(ph)
        for (u, r) in profile:
            if axis == 'x': verts.append((cx + u, cy + r * c, cz + r * s))
            else: verts.append((cx + r * c, cy + r * s, cz + u))
    for k in range(segs):
        k2 = (k + 1) % segs
        for i in range(n):
            j = (i + 1) % n
            faces.append((k * n + i, k * n + j, k2 * n + j, k2 * n + i))
            idx.append(seg_mat[i] if seg_mat else 0)
    return mesh_obj(name, verts, faces, mats, idx, smooth_angle)

def collect_objs(fn):
    before = set(bpy.data.objects); fn(); return [o for o in bpy.data.objects if o not in before]

def join(parts, name, parent, origin=(0, 0, 0)):
    parts = [o for o in parts if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1: bpy.ops.object.join()
    o = bpy.context.object; o.name = name
    bpy.context.scene.cursor.location = T(*origin); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = (0, 0, 0)
    o.parent = parent; o.select_set(False)
    return o

def boolean(target, operand, op, solver='EXACT'):
    md = target.modifiers.new('bool', 'BOOLEAN'); md.operation = op; md.solver = solver
    if isinstance(operand, bpy.types.Collection): md.operand_type = 'COLLECTION'; md.collection = operand
    else: md.object = operand
    md.material_mode = 'TRANSFER'
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier=md.name)
    return target

def to_collection(objs, name):
    col = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    for o in objs:
        for u in list(o.users_collection): u.objects.unlink(o)
        col.objects.link(o)
    return col

def drop_collection(col):
    for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(col)

def duplicate(o, name):
    d = o.copy(); d.data = o.data.copy(); d.name = name; bpy.context.collection.objects.link(d); return d

# ───────────────────────────── scene / materials ───────────────────────
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
paint = material('TM_GrayPaint', (.265, .292, .312), .12, .46); grain(paint, .22, 11)
paint_dk = material('TM_DarkGrayPaint', (.105, .118, .128), .12, .52); grain(paint_dk, .25, 12)
motor_p = material('TM_MotorPaint', (.215, .240, .258), .14, .44); grain(motor_p, .18, 13)
machined = material('TM_MachinedSteel', (.60, .62, .64), .85, .28)
bright = material('TM_BrightSteel', (.72, .73, .74), .92, .18)
bronze = material('TM_WheelBronze', (.62, .36, .13), .92, .30)
cut_red = material('TM_SectionRed', (.52, .035, .025), .05, .42)
interior = material('TM_InteriorPrimer', (.52, .47, .33), .08, .55)
oil = material('TM_GearOil', (.55, .25, .02), .0, .08, alpha=.55)
acrylic = material('TM_InspectionAcrylic', (.80, .86, .90), .0, .04, alpha=.22)
black = material('TM_Black', (.018, .020, .022), .15, .62)
lining = material('TM_BrakeLining', (.055, .048, .040), .0, .85)
spring_m = material('TM_SpringBlack', (.025, .026, .028), .55, .36)
yellow = material('TM_SafetyYellow', (.95, .60, .005), .18, .32)
zinc = material('TM_ZincBolt', (.56, .55, .50), .80, .34)
label_w = material('TM_LabelWhite', (.90, .90, .86), .05, .55)
ink = material('TM_LabelInk', (.02, .022, .024), .1, .6)
amber_line = material('TM_LevelRed', (.75, .03, .02), .05, .4)
shv_yellow = material('TM_SheaveYellow', (.86, .56, .02), .12, .40); grain(shv_yellow, .15, 14)
groove_blk = material('TM_GrooveBlack', (.030, .032, .034), .75, .34)
plated = material('TM_PlatedBrakeBody', (.70, .58, .30), .88, .26)
spring_zn = material('TM_SpringZincYellow', (.74, .64, .34), .85, .30)
brass = material('TM_BrassCap', (.72, .52, .20), .90, .28)
base_blk = material('TM_BaseBlack', (.028, .030, .034), .35, .48)
gland_g = material('TM_GlandGray', (.42, .44, .45), .05, .55)
cowl_p = material('TM_CowlGray', (.36, .39, .41), .15, .42); grain(cowl_p, .12, 15)
alu = material('TM_EncoderAluminium', (.70, .72, .74), .90, .22)
enc_blk = material('TM_EncoderBlack', (.012, .013, .015), .30, .40)
fan_p = material('TM_FanPlastic', (.10, .11, .12), .05, .55)
root = bpy.data.objects.new('TractionMachineModel', None); link_new(root)
fontpath = Path('C:/Windows/Fonts/malgun.ttf'); font = bpy.data.fonts.load(str(fontpath)) if fontpath.exists() else None

def text(body, pos, size, mat, normal, right, depth=0.0006):
    c = bpy.data.curves.new('Lettering', 'FONT'); c.body = body; c.size = size; c.align_x = 'CENTER'; c.align_y = 'CENTER'
    c.extrude = depth; c.resolution_u = 3
    if font: c.font = font
    o = link_new(bpy.data.objects.new('Lettering', c)); o.location = T(*pos)
    n = Vector(T(*normal)); u = Vector(T(*right)); v = n.cross(u)
    o.rotation_euler = Matrix((u, v, n)).transposed().to_euler(); o.data.materials.append(mat)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return o

# ═════════════════════ 1. SheaveRotor (sheave + shaft + wheel) ═════════
def build_spoked_sheave(rope_r, half, rim_in, hub_r, hub_half, bore_r, holes, bearing=False):
    """Shared sheave design (main + deflector): yellow cast body with six curved
    kidney openings (S-curved spokes), black machined grooved rim, grooves at the
    real rope X positions.  Axis = X through the origin."""
    flange_r, land_r, gr = rope_r + max(.008, .045 * rope_r), rope_r + .003, SHV_GROOVE_R
    edge = max(abs(x) for x in ROPE_X) + gr + .010
    prof = [(-half, rim_in), (-half, flange_r - .004), (-half + .004, flange_r), (-edge, flange_r), (-edge + .004, land_r)]
    mats = [0, 0, 1, 1]
    tg = math.acos((rope_r - land_r) / gr)
    for xc in ROPE_X:
        for k in range(15):
            t = -tg + 2 * tg * k / 14
            prof.append((xc + gr * math.sin(t), rope_r - gr * math.cos(t))); mats.append(1)
    prof += [(edge - .004, land_r), (edge, flange_r), (half - .004, flange_r), (half, flange_r - .004), (half, rim_in)]
    mats += [1, 1, 1, 0, 0, 0]
    lathe('SheaveRim', prof, 'x', (0, 0, 0), [shv_yellow, groove_blk], mats, segs=96)
    # web disc with thickened hub / rim roots, then six curved kidney openings
    wt = .016
    web = lathe('SheaveWeb', [(-wt, hub_r - .004), (-wt - .012, hub_r + .006), (-wt, hub_r + .030), (-wt, rim_in - .018),
                              (-wt - .010, rim_in + .002), (wt + .010, rim_in + .002), (wt, rim_in - .018), (wt, hub_r + .030),
                              (wt + .012, hub_r + .006), (wt, hub_r - .004)], 'x', (0, 0, 0), [shv_yellow], segs=96)
    r0, r1 = holes; rm, span = (r0 + r1) / 2, (r1 - r0) / 2
    sector = 2 * math.pi / 6; curve = .30
    cutters = []
    for k in range(6):
        c0 = k * sector; left, right = [], []
        for i in range(17):
            u = -1 + 2 * i / 16; r = rm + u * span
            hw = .30 * sector * math.sqrt(max(0.0, 1 - u * u)) ** .8 + .02 * sector
            th = c0 + curve * u
            left.append((r * math.cos(th - hw), r * math.sin(th - hw)))
            right.append((r * math.cos(th + hw), r * math.sin(th + hw)))
        ring = left + right[::-1]; n = len(ring); verts = []
        for x in (-.06, .06):
            for (y, z) in ring: verts.append((x, y, z))
        faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        cutters.append(mesh_obj('KidneyCut', verts, faces, [shv_yellow]))
    cc = to_collection(cutters, 'kidney'); boolean(web, cc, 'DIFFERENCE'); drop_collection(cc)
    # hub
    lathe('SheaveHub', [(-hub_half, bore_r), (-hub_half, hub_r - .006), (-hub_half + .006, hub_r), (hub_half - .006, hub_r),
                        (hub_half, hub_r - .006), (hub_half, bore_r)], 'x', (0, 0, 0), [shv_yellow], segs=48)
    if bearing:   # sealed ball bearing faces + inner race, like the reference photo
        for sx in (-1, 1):
            lathe('BearingSeal', [(-.004, bore_r + .006), (-.004, hub_r - .010), (.004, hub_r - .010), (.004, bore_r + .006)],
                  'x', (sx * (hub_half - .002), 0, 0), [black], segs=40)
            lathe('BearingInner', [(-.006, bore_r), (-.006, bore_r + .006), (.006, bore_r + .006), (.006, bore_r)],
                  'x', (sx * (hub_half - .002), 0, 0), [bright], segs=40)
    return flange_r

def sheave_rotor():
    build_spoked_sheave(SHEAVE_R, SHV_HALF, SHV_RIM_IN, SHV_HUB_R, .100, SHAFT_R, (.112, .262))
    # retaining end plate + bolts on sheave front (+X)
    cyl('ShaftEndPlate', .060, .010, (.105, 0, 0), machined, bev=.002)
    for k in range(4):
        ph = k * math.pi / 2 + math.pi / 4
        hexbolt('EndPlateBolt', (.110, math.cos(ph) * .038, math.sin(ph) * .038), (1, 0, 0), zinc, .008, .007)
    # output shaft (sheave → through gearbox)
    cyl('OutputShaft', SHAFT_R, (XW - .125) * -1 + .100, ((XW - .125 + .100) / 2, 0, 0), machined, verts=40)
    cyl('ShaftShoulder', SHAFT_R + .012, .030, (XW + .090, 0, 0), machined, verts=40)
    cyl('ShaftShoulder', SHAFT_R + .012, .030, (XW - .090, 0, 0), machined, verts=40)
    # ── bronze worm wheel (throated, helical teeth) ──
    wheel_mesh()
    # steel spider hub, bolted rim (flange on -X / viewer side)
    lathe('WheelHub', [(-.052, SHAFT_R), (-.052, .066), (-.044, .074), (.060, .074), (.068, .066), (.068, SHAFT_R)],
          'x', (XW, 0, 0), [paint_dk], segs=48)
    fl = lathe('WheelFlange', [(-.053, .070), (-.053, .186), (-.036, .186), (-.036, .070)], 'x', (XW, 0, 0),
               [paint_dk], segs=72)
    holes = []
    for k in range(6):
        ph = k * math.pi / 3
        holes.append(cyl('SpiderHole', .030, .05, (XW - .045, math.cos(ph) * .122, math.sin(ph) * .122), paint_dk, verts=24))
    hc = to_collection(holes, 'spider_holes'); boolean(fl, hc, 'DIFFERENCE'); drop_collection(hc)
    for k in range(8):
        ph = k * math.pi / 4 + math.pi / 8
        hexbolt('RimBolt', (XW - .053, math.cos(ph) * .176, math.sin(ph) * .176), (-1, 0, 0), zinc, .0095, .008)
        cyl('RimNut', .0095, .008, (XW + .039, math.cos(ph) * .176, math.sin(ph) * .176), zinc, verts=6)
    for k in range(3):   # key/lock screws on hub face
        ph = k * 2 * math.pi / 3
        cyl('HubScrew', .007, .006, (XW - .055, math.cos(ph) * .058, math.sin(ph) * .058), zinc, verts=6)

def wheel_mesh():
    """Bronze rim ring: 2-D tooth outline swept across the face with the worm
    lead twist, tips trimmed by the worm-root torus (throat)."""
    hr = (P_AX / 4 + (RW - WHEEL_ROOT) * math.tan(PA)) / WHEEL_ROOT
    ht = (P_AX / 4 - (WHEEL_THROAT - RW) * math.tan(PA)) / WHEEL_THROAT
    step = 2 * math.pi / Z2
    outline = []    # (psi, r, is_tip)
    for k in range(Z2):
        c = k * step
        outline += [(c - step / 2, WHEEL_ROOT, 0), (c - hr, WHEEL_ROOT, 0), (c - ht, WHEEL_THROAT, 1),
                    (c + ht, WHEEL_THROAT, 1), (c + hr, WHEEL_ROOT, 0)]
    n = len(outline); slices = 13; verts = []; faces = []; mats = []
    xs = [-WHEEL_B / 2 + WHEEL_B * i / (slices - 1) for i in range(slices)]
    rt_throat = WORM_ROOT + CLR
    for x in xs:
        tip = min(WHEEL_OD, A - math.sqrt(max(rt_throat ** 2 - x ** 2, 0))) if abs(x) < rt_throat else WHEEL_OD
        tw = x * TAN_L / RW
        for (ps, r, _) in outline:
            rr = WHEEL_ROOT + (r - WHEEL_ROOT) * (tip - WHEEL_ROOT) / (WHEEL_THROAT - WHEEL_ROOT)
            a = ps + tw; verts.append((XW + x, rr * math.cos(a), rr * math.sin(a)))
        for (ps, r, _) in outline:
            a = ps + tw; verts.append((XW + x, WHEEL_RIM_IN * math.cos(a), WHEEL_RIM_IN * math.sin(a)))
    ring = 2 * n
    for s in range(slices - 1):
        o0, o1 = s * ring, (s + 1) * ring
        for i in range(n):
            j = (i + 1) % n
            faces.append((o0 + i, o0 + j, o1 + j, o1 + i)); mats.append(0)                 # teeth
            faces.append((o0 + n + j, o0 + n + i, o1 + n + i, o1 + n + j)); mats.append(0)  # bore
    for s, flip in ((0, True), (slices - 1, False)):
        o = s * ring
        for i in range(n):
            j = (i + 1) % n
            f = (o + i, o + j, o + n + j, o + n + i)
            faces.append(tuple(reversed(f)) if flip else f); mats.append(0)
    mesh_obj('WormWheelRim', verts, faces, [bronze], mats, smooth_angle=30)

# ═════════════════════ 2. WormRotor (worm + shaft + drum) ═══════════════
def worm_rotor():
    zc = 0.0
    # shaft: lathe along Z — crank end → bearings → worm core → drum seat → coupling
    prof = [(CRANK_Z - .012, 0.0), (CRANK_Z - .012, .020), (CRANK_Z + .040, .020), (CRANK_Z + .045, .030),
            (-.215, .030), (-.212, .035), (-.160, .035), (-.155, .044), (-WORM_THREAD_Z - .010, .044),
            (-WORM_THREAD_Z, WORM_ROOT - .0004), (WORM_THREAD_Z, WORM_ROOT - .0004), (WORM_THREAD_Z + .010, .044),
            (.155, .044), (.160, .035), (.212, .035), (.215, .030), (DRUM_Z + DRUM_W / 2 + .045, .030),
            (DRUM_Z + DRUM_W / 2 + .045, 0.0)]
    lathe('WormShaft', prof, 'z', (XW, A, 0), [machined], segs=48, smooth_angle=30)
    # helical threads (2 starts, right hand); ridge centred at z = P/2 + nP at the contact (phi=-pi/2)
    wr = P_AX / 2 + 2 * (RWORM - WORM_ROOT) * math.tan(PA)
    wt = P_AX / 2 - 2 * (WORM_TIP - RWORM) * math.tan(PA)
    prof_t = [(WORM_ROOT - .0004, -wr / 2), (WORM_TIP, -wt / 2), (WORM_TIP, wt / 2), (WORM_ROOT - .0004, wr / 2)]
    steps = 72
    for s in range(Z1):
        # phi range so the ridge centre covers [-L, L] around the threaded length
        zf = lambda ph: LEAD * (ph + math.pi / 2) / (2 * math.pi) + P_AX / 2 + s * P_AX
        ph0 = (-WORM_THREAD_Z + wr / 2 - P_AX / 2 - s * P_AX) * 2 * math.pi / LEAD - math.pi / 2
        ph1 = (WORM_THREAD_Z - wr / 2 - P_AX / 2 - s * P_AX) * 2 * math.pi / LEAD - math.pi / 2
        nring = max(2, int((ph1 - ph0) / (2 * math.pi) * steps))
        verts = []; faces = []
        for k in range(nring + 1):
            ph = ph0 + (ph1 - ph0) * k / nring; zc_ = zf(ph)
            # thread run-out: height tapers over the last 0.35 turn at both ends
            e = min(k, nring - k) / (0.35 * steps)
            h = 1.0 if e >= 1 else (3 * e * e - 2 * e ** 3)
            for (r, dz) in prof_t:
                rr = WORM_ROOT - .0004 + (r - WORM_ROOT + .0004) * h
                verts.append((XW + rr * math.cos(ph), A + rr * math.sin(ph), zc_ + dz))
        for k in range(nring):
            for i in range(4):
                j = (i + 1) % 4
                faces.append((k * 4 + i, k * 4 + j, (k + 1) * 4 + j, (k + 1) * 4 + i))
        faces.append((3, 2, 1, 0)); o = nring * 4; faces.append((o, o + 1, o + 2, o + 3))
        mesh_obj('WormThread', verts, faces, [bright], smooth_angle=50)
    # brake drum on the worm shaft (drum is also the coupling half)
    # cup-shaped drum: open towards the gearbox (worm end cap sits inside), web on the motor side
    lathe('BrakeDrum', [(-DRUM_W / 2, DRUM_R - .012), (-DRUM_W / 2, DRUM_R - .003), (-DRUM_W / 2 + .003, DRUM_R),
                        (DRUM_W / 2 - .003, DRUM_R), (DRUM_W / 2, DRUM_R - .003), (DRUM_W / 2, .030),
                        (DRUM_W / 2 - .016, .030), (DRUM_W / 2 - .016, DRUM_R - .024), (-DRUM_W / 2 + .010, DRUM_R - .012)],
          'z', (XW, A, DRUM_Z), [machined], segs=72, smooth_angle=30)
    lathe('CouplingHub', [(DRUM_W / 2 - .02, .030), (DRUM_W / 2 - .02, .060), (DRUM_W / 2 + .030, .060),
                          (DRUM_W / 2 + .030, .030)], 'z', (XW, A, DRUM_Z), [paint_dk], segs=40)
    for k in range(6):
        ph = k * math.pi / 3
        cyl('CouplingBolt', .006, .012, (XW + math.cos(ph) * .048, A + math.sin(ph) * .048, DRUM_Z + DRUM_W / 2 + .036),
            zinc, (0, 0, 1), 6)
    # crank end: hex for the wall-stored turning handle, yellow marking
    cyl('CrankHex', .024, .038, (XW, A, CRANK_Z + .004), yellow, (0, 0, 1), 6, bev=.0015)
    # motor rear: cooling fan behind the cowl grille, shaft end through the hollow-shaft encoder
    fz = MOTOR_Z1 + .034
    cyl('FanHub', .034, .020, (XW, A, fz), fan_p, (0, 0, 1), 32, bev=.002)
    for k in range(8):
        ph = k * math.pi / 4
        bl = box('FanBlade', (.098, .004, .026), (0, 0, 0), fan_p)
        bl.location = T(XW + math.cos(ph) * .085, A + math.sin(ph) * .085, fz)
        bl.rotation_euler = (math.radians(28), 0, 0)
        bpy.context.view_layer.objects.active = bl; bl.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False); bl.select_set(False)
        bl.rotation_euler = (0, -ph, 0)
    cyl('MotorShaftEnd', .0118, ENC_Z1 + .006 - (MOTOR_Z1 + .02), (XW, A, (ENC_Z1 + .006 + MOTOR_Z1 + .02) / 2), machined, (0, 0, 1), 24)
    lathe('EncoderHollowShaft', [(-.004, .0118), (-.004, .0172), (.005, .0172), (.005, .0118)], 'z', (XW, A, ENC_Z1 + .001), [brass], segs=32)
    lathe('EncoderClamp', [(-.003, .0172), (-.003, .0205), (.003, .0205), (.003, .0172)], 'z', (XW, A, ENC_Z1 + .008), [alu], segs=32)
    cyl('ClampScrew', .0022, .006, (XW + .0205, A, ENC_Z1 + .008), zinc, (1, 0, 0), 6)

# ═════════════════════ 3. Gear case (outer shell, cavity, cut-away) ═════
def outer_parts():
    P = []
    P.append(cyl('ChamberShell', H_R, 2 * H_W, (XW, 0, 0), paint, verts=96))
    P.append(box_span('ChamberSump', (XW - H_W, XW + H_W), (H_BOT + .030, 0.0), (-H_R, H_R), paint))
    P.append(cyl('WormTube', TUBE_R, 2 * TUBE_Z, (XW, A, 0), paint, (0, 0, 1), 72))
    P.append(box_span('TubeWeb', (XW - H_W, XW + H_W), (0.0, A), (-.180, .180), paint))
    P.append(box_span('CaseFeet', (XW - .150, XW + .150), (H_BOT, H_BOT + .032), (-.300, .300), paint))
    for sz in (-1, 1):   # foot ribs
        for sx in (-1, 1):
            P.append(box_span('FootRib', (XW + sx * .150 - (.018 if sx > 0 else 0), XW + sx * .150 + (0 if sx > 0 else .018)),
                              (H_BOT, H_BOT + .110), (sz * .300 - (.050 if sz > 0 else 0), sz * .300 + (0 if sz > 0 else .050)), paint))
    # worm bearing end flanges + caps
    for sz in (-1, 1):
        P.append(cyl('WormFlange', TUBE_R + .012, .020, (XW, A, sz * (TUBE_Z + .010)), paint, (0, 0, 1), 72))
        P.append(cyl('WormBearingCap', .072, .028, (XW, A, sz * (TUBE_Z + .034)), paint, (0, 0, 1), 56))
    # side cover (-X, viewer side) with bearing cap, +X bearing boss
    P.append(cyl('SideCover', .210, .020, (XW - H_W - .010, 0, 0), paint, verts=96))
    P.append(cyl('SideBearingCap', .078, .030, (XW - H_W - .035, 0, 0), paint, verts=56))
    P.append(cyl('SheaveSideBoss', .086, .045, (XW + H_W + .0225, 0, 0), paint, verts=56))
    # inspection pad on the worm tube top
    P.append(box_span('InspectionPad', (XW - .078, XW + .078), (A + .060, A + TUBE_R + .016), (-.095, .095), paint))
    # oil sight-glass boss on -X face (rear lower quarter, outside the cut)
    P.append(cyl('SightBoss', .040, .016, (XW - H_W - .008, OIL_Y, SIGHT_Z), paint, verts=40))
    P.append(cyl('DrainBoss', .022, .020, (XW - H_W - .010, H_BOT + .052, DRAIN_Z), paint, verts=24))
    return P

def cavity_parts():
    C = []
    C.append(cyl('ChamberCav', H_RI, 2 * H_WI, (XW, 0, 0), interior, verts=96))
    C.append(box_span('SumpCav', (XW - H_WI, XW + H_WI), (H_BOT + .055, .000), (-H_RI, H_RI), interior))
    C.append(cyl('TubeCav', TUBE_RI, 2 * (TUBE_Z - .022), (XW, A, 0), interior, (0, 0, 1), 64))
    C.append(box_span('TubeWebCav', (XW - H_WI, XW + H_WI), (0.0, A), (-.160, .160), interior))
    C.append(box_span('WindowOpening', (XW - .056, XW + .056), (A + .040, A + TUBE_R + .030), (-.072, .072), interior))
    C.append(cyl('OutputBore', SHAFT_R + .003, 2 * H_W + .070, (XW + .020, 0, 0), machined, verts=48))
    for sx in (-1, 1):   # bearing seats (the rollers show in the lower cut quadrant)
        C.append(cyl('BearingSeat', .0745, .026, (XW + sx * .088, 0, 0), machined, verts=48))
    C.append(cyl('WormBore', .037, 2 * TUBE_Z + .080, (XW, A, 0), machined, (0, 0, 1), 40))
    C.append(cyl('SightGlassBore', .022, .060, (XW - H_W, OIL_Y, SIGHT_Z), interior, verts=32))
    return C

def make_cutter():
    """One solid cutter (upper worm quarter + front-lower oil quarter).  A
    collection operand would INTERSECT with every member separately."""
    c = box_span('CutUpper', (XW - .40, XW), (CUT_EPS, A + .20), (-.190, .190), cut_red)
    c2 = box_span('CutFrontLower', (XW - .40, XW), (-.205, CUT_EPS + .010), (.004, H_R + .050), cut_red)
    boolean(c, c2, 'UNION'); bpy.data.objects.remove(c2, do_unlink=True)
    return c

def in_cutter(p):
    x, y, z = p
    if x >= XW: return False
    if CUT_EPS <= y <= A + .20 and -.190 <= z <= .190: return True
    if -.205 <= y <= CUT_EPS + .010 and .004 <= z <= H_R + .050: return True
    return False

def gear_case():
    outer = outer_parts()
    shell = outer[0]
    col = to_collection(outer[1:], 'outer_union'); boolean(shell, col, 'UNION'); drop_collection(col)
    cav = to_collection(cavity_parts(), 'cavity'); boolean(shell, cav, 'DIFFERENCE'); drop_collection(cav)
    piece = duplicate(shell, 'CaseCutPiece')
    cut = make_cutter()
    boolean(shell, cut, 'DIFFERENCE'); boolean(piece, cut, 'INTERSECT')
    bpy.data.objects.remove(cut, do_unlink=True)
    # Bevel only after the cut: a bevelled shell is no longer a clean solid for the exact solver.
    bevel(shell, .003, 1, 30); bevel(piece, .003, 1, 30)
    for o in (shell, piece):
        for p in o.data.polygons:
            if o.material_slots[p.material_index].material == cut_red: p.use_smooth = False
    return shell, piece

def case_hardware():
    """Bolts / plugs / labels, returned as (kept, cutaway) by position."""
    items = []
    def add(objs, pos): items.append((objs if isinstance(objs, list) else [objs], pos))
    for k in range(12):   # side cover bolt circle
        ph = k * math.pi / 6 + math.pi / 12; p = (XW - H_W - .020, math.cos(ph) * .188, math.sin(ph) * .188)
        add(hexbolt('CoverBolt', p, (-1, 0, 0), zinc, .010, .008), p)
    for k in range(6):
        ph = k * math.pi / 3; p = (XW - H_W - .050, math.cos(ph) * .060, math.sin(ph) * .060)
        add(hexbolt('CapBolt', p, (-1, 0, 0), zinc, .008, .007), p)
    for sz in (-1, 1):
        for k in range(6):
            ph = k * math.pi / 3 + math.pi / 6
            p = (XW + math.cos(ph) * .058, A + math.sin(ph) * .058, sz * (TUBE_Z + .048))
            add(hexbolt('WormCapBolt', p, (0, 0, sz), zinc, .008, .007), p)
        for k in range(8):
            ph = k * math.pi / 4 + math.pi / 8
            p = (XW + math.cos(ph) * .101, A + math.sin(ph) * .101, sz * (TUBE_Z + .020))
            add(hexbolt('WormFlangeBolt', p, (0, 0, sz), zinc, .008, .006), p)
    for sx in (-1, 1):
        for sz in (-1, 1):
            p = (XW + sx * .125, H_BOT + .032, sz * .272)
            add(hexbolt('FootBolt', p, (0, 1, 0), zinc, .013, .011), p)
    # inspection window: acrylic plate + frame screws (plate itself is cut too)
    for sx in (-1, 1):
        for sz in (-1, 1):
            p = (XW + sx * .064, A + TUBE_R + .016, sz * .082)
            add(hexbolt('WindowScrew', p, (0, 1, 0), zinc, .006, .005), p)
    # oil sight glass (rear lower -X face, outside the cut): ring bezel, dark
    # back, oil below the level line visible through the glass, H/L ticks
    gz = SIGHT_Z; fx = XW - H_W - .016        # boss outer face
    sp = (fx, OIL_Y, gz)
    add([lathe('SightBezel', [(-.008, .024), (-.008, .034), (0, .034), (0, .024)], 'x', (fx, OIL_Y, gz), [bright], segs=40)], sp)
    add([cyl('SightBack', .024, .002, (fx + .001, OIL_Y, gz), black, verts=32)], sp)
    add([box('OilInGlass', (.003, .0235, .046), (fx - .0015, OIL_Y - .0118, gz), oil)], sp)
    add([cyl('SightGlass', .0242, .003, (fx - .0045, OIL_Y, gz), acrylic, verts=40)], sp)
    for dy in (.013, -.013):
        for dz in (-.029, .029):
            add([box('LevelTick', (.002, .0025, .010), (fx - .009, OIL_Y + dy, gz + dz), amber_line)], sp)
    add([text('유면계', (XW - H_W - .0012, OIL_Y + .060, gz - .030), .013, label_w, (-1, 0, 0), (0, 0, 1))], sp)
    # drain plug (bottom rear corner)
    dp = (XW - H_W, H_BOT + .052, DRAIN_Z)
    add([cyl('DrainPlug', .014, .018, (XW - H_W - .028, H_BOT + .052, DRAIN_Z), zinc, verts=6, bev=.0015)], dp)
    add([text('드레인', (XW - H_W - .0012, H_BOT + .052, DRAIN_Z + .052), .012, label_w, (-1, 0, 0), (0, 0, 1))], dp)
    # filler / breather cap on the worm tube (-Z end, outside the cut)
    bz = -.212
    add([cyl('BreatherNeck', .016, .030, (XW, A + TUBE_R + .004, bz), zinc, (0, 1, 0), 20),
         cyl('BreatherCap', .026, .016, (XW, A + TUBE_R + .026, bz), black, (0, 1, 0), 24, bev=.003)],
        (XW, A + .12, bz))
    # internal oil wipers (bent plates near the worm, cf. worm close-up photos)
    for sz in (-1, 1):
        w = box('OilWiper', (.050, .004, .036), (XW + .008, A + .066, sz * .128), paint_dk, .001)
        w.rotation_euler = (math.radians(-25 * sz), 0, 0)
        add([w], (XW + .02, A, 0))
    kept, cut = [], []
    for objs, pos in items:
        (cut if in_cutter(pos) else kept).extend(objs)
    return kept, cut

def acrylic_window():
    g = box_span('InspectionAcrylic', (XW - .072, XW + .072), (A + TUBE_R + .016, A + TUBE_R + .022), (-.090, .090), acrylic)
    g2 = duplicate(g, 'InspectionAcrylicCut')
    cut = make_cutter()
    boolean(g, cut, 'DIFFERENCE'); boolean(g2, cut, 'INTERSECT')
    bpy.data.objects.remove(cut, do_unlink=True)
    for o in (g, g2):
        for i, s in enumerate(o.material_slots): s.material = acrylic
    return g, g2

def bearings():
    """Output-shaft roller bearings in the case walls (static)."""
    P = []
    for sx in (-1, 1):
        x = XW + sx * .088
        P.append(lathe('BearingRace', [(-.012, SHAFT_R + .012), (-.012, .074), (.012, .074), (.012, SHAFT_R + .012)],
                       'x', (x, 0, 0), [machined], segs=48))
        for k in range(14):
            ph = k * 2 * math.pi / 14
            P.append(cyl('BearingRoller', .0065, .018, (x, math.cos(ph) * .066, math.sin(ph) * .066), bright, verts=12))
    return P

# ═════════════════════ 4. Brake ═══════════════════════════════════════════
def brake_arm(side):
    s = side; x = XW + s * ARM_X
    P = []
    # cast arm (tapered) from pivot to top
    P.append(box_span('BrakeArm', (x - .016, x + .016), (PIVOT_Y - .022, ARM_TOP), (DRUM_Z - .026, DRUM_Z + .026), paint, .006))
    P.append(box_span('ArmRib', (x + s * .014, x + s * .026), (PIVOT_Y + .02, SPRING_Y - .045), (DRUM_Z - .008, DRUM_Z + .008), paint, .003))   # stops below the spring cap
    P.append(cyl('ArmPivotBoss', .026, .058, (x, PIVOT_Y, DRUM_Z), paint, (0, 0, 1), 32, bev=.002))
    P.append(cyl('ArmPivotPin', .011, .076, (x, PIVOT_Y, DRUM_Z), bright, (0, 0, 1), 20))
    # shoe: curved pad around the drum, hinged to the arm at drum height
    ph0 = (0 if s > 0 else math.pi) - math.radians(48); n = 16
    for (r0, r1, mat, nm) in ((DRUM_R + .0015, DRUM_R + .010, lining, 'ShoeLining'), (DRUM_R + .010, DRUM_R + .022, paint_dk, 'ShoeBack')):
        prof = []
        for k in range(n + 1):
            ph = ph0 + math.radians(96) * k / n; prof.append((ph, r0))
        verts = []; faces = []
        for zz in (DRUM_Z - DRUM_W / 2 + .006, DRUM_Z + DRUM_W / 2 - .006):
            for (ph, _) in prof: verts.append((XW + r0 * math.cos(ph), A + r0 * math.sin(ph), zz))
            for (ph, _) in prof: verts.append((XW + r1 * math.cos(ph), A + r1 * math.sin(ph), zz))
        m = n + 1; L = 2 * m
        # quads: inner, outer, two sides, two ends
        for k in range(n):
            faces.append((k, k + 1, L + k + 1, L + k))                 # inner
            faces.append((m + k + 1, m + k, L + m + k, L + m + k + 1))  # outer
            faces.append((k + 1, k, m + k, m + k + 1))                 # front side
            faces.append((L + k, L + k + 1, L + m + k + 1, L + m + k)) # back side
        faces.append((0, m, L + m, L)); faces.append((n, L + n, L + m + n, m + n))
        P.append(mesh_obj(nm, verts, faces, [mat]))
    P.append(cyl('ShoeHingePin', .010, .070, (XW + s * (DRUM_R + .030), A, DRUM_Z), bright, (0, 0, 1), 16))
    P.append(box_span('ShoeHingeLug', (min(XW + s * (DRUM_R + .020), x), max(XW + s * (DRUM_R + .020), x)),
                      (A - .016, A + .016), (DRUM_Z - .020, DRUM_Z + .020), paint, .003))
    # release lug (fork of the wall-stored release lever engages here)
    P.append(cyl('ReleaseLug', .010, .030, (x, ARM_TOP - .030, DRUM_Z + .040), yellow, (0, 0, 1), 16))
    return P

def spring_coil(name, x0, x1, y, z, r, wire, turns, mat):
    pts = 14 * turns; ring = 8; verts = []; faces = []
    for i in range(pts + 1):
        t = i / pts; ang = 2 * math.pi * turns * t
        c = Vector((x0 + (x1 - x0) * t, y + r * math.cos(ang), z + r * math.sin(ang)))
        tang = Vector(((x1 - x0), -r * 2 * math.pi * turns * math.sin(ang), r * 2 * math.pi * turns * math.cos(ang))).normalized()
        nrm = Vector((0, math.cos(ang), math.sin(ang))); bn = tang.cross(nrm)
        for j in range(ring):
            q = 2 * math.pi * j / ring; verts.append(tuple(c + (nrm * math.cos(q) + bn * math.sin(q)) * wire))
    for i in range(pts):
        for j in range(ring):
            k = (j + 1) % ring; faces.append((i * ring + j, i * ring + k, (i + 1) * ring + k, (i + 1) * ring + j))
    return mesh_obj(name, verts, faces, [mat])

def brake_frame():
    """TK dual-brake retrofit (이중브레이크, TM30B): every mechanical part that acts
    on the drum is doubled — two arms, two independent springs on their own arm
    bolts, two plungers/push rods in one plated twin-solenoid body, two opening
    switches MS1/MS2.  Coil + switch leads end in the yellow terminal box."""
    P = []
    # cast brake stand from the bedplate to the pivot bosses
    P.append(box_span('BrakeStand', (XW - .200, XW + .200), (H_BOT, PIVOT_Y - .030), (DRUM_Z - .030, DRUM_Z + .030), paint, .006))
    for s in (-1, 1):
        for dz in ((DRUM_Z - .045, DRUM_Z - .029), (DRUM_Z + .029, DRUM_Z + .045)):
            P.append(box_span('StandLug', (XW + s * ARM_X - .030, XW + s * ARM_X + .030), (PIVOT_Y - .045, PIVOT_Y + .004), dz, paint, .004))
    # support: cast bracket on the worm end flange -> black BASE plate with leveling bolts
    P.append(box_span('BaseBracket', (XW - .060, XW + .060), (A + .080, BASE_Y0), (TUBE_Z + .022, TUBE_Z + .050), paint, .004))
    P.append(box_span('DualBrakeBase', (XW - .118, XW + .118), (BASE_Y0, BASE_Y1), (TUBE_Z + .022, DRUM_Z + .050), base_blk, .003))
    for sx in (-1, 1):
        P.append(box_span('LevelingBlock', (XW + sx * .085 - .016, XW + sx * .085 + .016), (A + .080, BASE_Y0),
                          (TUBE_Z + .024, TUBE_Z + .048), base_blk, .003))
        P += hexbolt('LevelingBolt', (XW + sx * .085, BASE_Y1, TUBE_Z + .036), (0, 1, 0), zinc, .010, .009)
        P += hexbolt('BaseBolt', (XW + sx * .098, BASE_Y1, DRUM_Z + .034), (0, 1, 0), zinc, .009, .008)
    # arm-bolt anchor under the base (the two arm bolts are independent)
    P.append(box_span('ArmBoltAnchor', (XW - .040, XW + .040), (SPRING_Y - .018, BASE_Y0), (DRUM_Z - .024, DRUM_Z + .024), base_blk, .003))
    # plated twin-solenoid body (two coils, dark split band, end rings)
    by = BODY_Y
    for sx in (-1, 1):
        P.append(cyl('SolenoidCoil', .064, .086, (XW + sx * .048, by, DRUM_Z), plated, (1, 0, 0), 56, bev=.003))
        P.append(cyl('SolenoidEndRing', .066, .008, (XW + sx * .092, by, DRUM_Z), brass, (1, 0, 0), 56, bev=.0015))
        for k in range(4):
            ph = k * math.pi / 2 + math.pi / 4
            P.append(cyl('EndScrew', .004, .004, (XW + sx * .097, by + math.cos(ph) * .050, DRUM_Z + math.sin(ph) * .050), zinc, (1, 0, 0), 6))
    P.append(cyl('SplitBand', .0655, .010, (XW, by, DRUM_Z), black, (1, 0, 0), 56))
    P.append(box_span('BodySaddle', (XW - .070, XW + .070), (BASE_Y1, by - .040), (DRUM_Z - .030, DRUM_Z + .030), base_blk, .003))
    # yellow coil terminal box with grey cable glands
    P.append(box_span('TBNeck', (XW - .048, XW + .048), (by + .040, by + .086), (DRUM_Z - .050, DRUM_Z + .050), yellow, .004))
    P.append(box_span('TBBox', (XW - .082, XW + .082), (by + .084, by + .150), (DRUM_Z - .052, DRUM_Z + .052), yellow, .006))
    for dz in (-.030, 0, .030):
        P.append(cyl('CableGland', .011, .022, (XW - .082 - .011, by + .117, DRUM_Z + dz), gland_g, (1, 0, 0), 6, bev=.001))
    P.append(cyl('CableGland', .011, .022, (XW + .082 + .011, by + .117, DRUM_Z), gland_g, (1, 0, 0), 6, bev=.001))
    P.append(box_span('TBLabel', (XW - .060, XW + .060), (by + .150, by + .1508), (DRUM_Z - .036, DRUM_Z + .036), label_w, .0005))
    P.append(text('이중브레이크 코일단자', (XW, by + .1512, DRUM_Z - .016), .0105, ink, (0, 1, 0), (1, 0, 0), .0002))
    P.append(text('BM1±  BM2±  MS1  MS2', (XW, by + .1512, DRUM_Z + .014), .0090, ink, (0, 1, 0), (1, 0, 0), .0002))
    # manual-release socket on the motor-side face
    P.append(cyl('ReleaseSocket', .013, .022, (XW, by - .018, DRUM_Z + .062), zinc, (0, 0, 1), 6, bev=.001))
    for s in (-1, 1):
        ax = XW + s * ARM_X; inner = ax - s * .016; outer = ax + s * .016
        # push rod + push-rod bolt (plunger -> arm top, on the body axis)
        P.append(rod('PushRod', (XW + s * .096, by, DRUM_Z), (inner - s * .010, by, DRUM_Z), .007, bright))
        P.append(cyl('PushRodBolt', .011, .012, (inner - s * .014, by, DRUM_Z), zinc, (1, 0, 0), 6, bev=.001))
        P.append(cyl('PushRodLockNut', .011, .007, (inner - s * .026, by, DRUM_Z), zinc, (1, 0, 0), 6, bev=.001))
        # arm bolt from the anchor through the arm; fixing nut keeps >= 3 mm to the arm (pad-wear check)
        tip = outer + s * (.008 + SPRING_SET + .008 + .030)
        P.append(rod('ArmBolt', (XW + s * .030, SPRING_Y, DRUM_Z), (tip, SPRING_Y, DRUM_Z), .0085, bright))
        P.append(cyl('ArmBoltFixNut', .0145, .012, (inner - s * (ARM_NUT_GAP + .006), SPRING_Y, DRUM_Z), zinc, (1, 0, 0), 6, bev=.001))
        P.append(box('RedMark', (.0015, .004, .012), (inner - s * (ARM_NUT_GAP + .0015), SPRING_Y + .012, DRUM_Z), amber_line))
        # spring set: inner cap on the arm, coil (116 mm between caps), outer cap, double nut, red marks
        c0 = outer + s * .004; c1 = c0 + s * (.004 + SPRING_SET + .004)
        P.append(cyl('SpringCap', .036, .008, (c0, SPRING_Y, DRUM_Z), brass, (1, 0, 0), 40, bev=.0015))
        P.append(cyl('SpringCap', .036, .008, (c1, SPRING_Y, DRUM_Z), brass, (1, 0, 0), 40, bev=.0015))
        P.append(spring_coil('BrakeSpring', c0 + s * .004, c1 - s * .004, SPRING_Y, DRUM_Z, .027, .0062, 8, spring_zn))
        for dn in (.010, .022):
            P.append(cyl('SpringNut', .0145, .011, (c1 + s * dn, SPRING_Y, DRUM_Z), zinc, (1, 0, 0), 6, bev=.001))
        P.append(box('RedMark', (.020, .004, .003), (c1 + s * .016, SPRING_Y + .0145, DRUM_Z), amber_line))
        # graduated scale resting on the caps along the spring
        sx0, sx1 = sorted((c0, c1))
        P.append(box_span('SpringScale', (sx0, sx1), (SPRING_Y + .036, SPRING_Y + .040), (DRUM_Z - .009, DRUM_Z + .009), bright, .0005))
        for k in range(12):
            xx = sx0 + .006 + k * (sx1 - sx0 - .012) / 11
            P.append(box('ScaleTick', (.0008, .0006, .007 if k % 5 else .012), (xx, SPRING_Y + .0403, DRUM_Z - .002), ink))
        # opening switch MS1 / MS2 on the base end, lever touching the arm top
        mx = XW + s * .104
        P.append(box_span('OpenSwitch', (mx - .016, mx + .016), (BASE_Y1, BASE_Y1 + .036), (DRUM_Z + .034, DRUM_Z + .056), black, .002))
        P.append(rod('SwitchLever', (mx, BASE_Y1 + .030, DRUM_Z + .045), (inner - s * .004, BASE_Y1 + .044, DRUM_Z + .030), .002, bright))
        P.append(text('MS1' if s < 0 else 'MS2', (mx, BASE_Y1 + .020, DRUM_Z + .0565), .007, label_w, (0, 0, 1), (1, 0, 0), .0002))
    # brake switch box (terminal) on the stand front
    P.append(box_span('BrakeSwitch', (XW + .080, XW + .140), (PIVOT_Y - .070, PIVOT_Y - .022), (DRUM_Z + .031, DRUM_Z + .061), black, .003))
    return P

# ═════════════════════ 5. Motor ═══════════════════════════════════════════
def motor():
    P = []
    cz = (MOTOR_Z0 + MOTOR_Z1) / 2; L = MOTOR_Z1 - MOTOR_Z0
    P.append(lathe('MotorFrontBell', [(-.030, .060), (-.030, .120), (-.012, .152), (.000, .158), (.000, .060)],
                   'z', (XW, A, MOTOR_Z0), [motor_p], segs=64))
    P.append(cyl('MotorFlange', .172, .016, (XW, A, MOTOR_Z0 + .008), motor_p, (0, 0, 1), 72, bev=.003))
    P.append(cyl('MotorFrame', MOTOR_R, L - .016, (XW, A, cz + .008), motor_p, (0, 0, 1), 72))
    for k in range(28):   # axial cooling fins (skip the top where the eye bolt sits)
        ph = k * 2 * math.pi / 28
        if abs(math.sin(ph) - 1) < .02: continue
        f = box('CoolingFin', (.006, .020, L - .050), (0, 0, 0), motor_p)
        f.location = T(XW + math.cos(ph) * (MOTOR_R + .009), A + math.sin(ph) * (MOTOR_R + .009), cz + .008)
        f.rotation_euler = (0, -(ph - math.pi / 2), 0)   # radial fin: local +Y → (cos ph, sin ph)
        bpy.context.view_layer.objects.active = f; f.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False); f.select_set(False)
        P.append(f)
    # pressed-steel fan cowl: shell with a rolled rear edge, concentric-ring + radial-spoke grille,
    # dark interior behind it (the cooling fan itself spins with the rotor, see worm_rotor)
    R = MOTOR_R; c0 = (XW, A, MOTOR_Z1)
    P.append(lathe('CowlShell', [(-.004, R - .004), (-.004, R + .006), (.060, R + .006), (.072, R - .002), (.078, R - .016),
                                 (.078, R - .026), (.071, R - .026), (.066, R - .012), (.056, R - .004)], 'z', c0, [cowl_p], segs=72))
    P.append(cyl('CowlInterior', R - .010, .004, (XW, A, MOTOR_Z1 + .006), black, (0, 0, 1), 64))
    for rr in (.074, .098, .122):
        P.append(lathe('GrilleRing', [(.071, rr - .0035), (.071, rr + .0035), (.078, rr + .0035), (.078, rr - .0035)],
                       'z', c0, [cowl_p], segs=64))
    for k in range(10):
        ph = k * 2 * math.pi / 10 + math.pi / 10
        sp = box('GrilleSpoke', (.086, .007, .007), (0, 0, 0), cowl_p)
        rm = (.058 + R - .022) / 2
        sp.location = T(XW + math.cos(ph) * rm, A + math.sin(ph) * rm, COWL_F - .0035)
        sp.rotation_euler = (0, -ph, 0); P.append(sp)
    P.append(lathe('CowlHubPlate', [(.068, .016), (.068, .060), (.080, .060), (.080, .016)], 'z', c0, [cowl_p], segs=48))
    for k in range(4):
        ph = k * math.pi / 2 + math.pi / 4
        P.append(cyl('HubScrew', .0045, .004, (XW + math.cos(ph) * .050, A + math.sin(ph) * .050, COWL_F + .004), zinc, (0, 0, 1), 6))
    # hollow-shaft rotary encoder (static body; bronze hollow shaft + clamp ring turn with the rotor)
    ez = (ENC_Z0 + ENC_Z1) / 2
    P.append(cyl('EncoderBody', ENC_R, ENC_Z1 - ENC_Z0 - .006, (XW, A, ez - .003), enc_blk, (0, 0, 1), 48, bev=.0015))
    P.append(lathe('EncoderFace', [(-.003, .0185), (-.003, ENC_R), (.003, ENC_R - .001), (.003, .0185)], 'z',
                   (XW, A, ENC_Z1 - .003), [alu], segs=48))
    P.append(lathe('EncoderRearRing', [(-.002, .014), (-.002, ENC_R - .002), (.002, ENC_R - .002), (.002, .014)], 'z',
                   (XW, A, ENC_Z0 + .002), [alu], segs=48))
    P.append(cyl('EncoderLabelBand', ENC_R + .0003, .016, (XW, A, ez - .004), label_w, (0, 0, 1), 48))
    P.append(text('ROTARY ENCODER', (XW + ENC_R + .0006, A + .004, ez - .004), .0042, ink, (1, 0, 0), (0, 0, -1), .0001))
    P.append(text('2048 P/R  DC5V', (XW + ENC_R + .0006, A - .003, ez - .004), .0036, ink, (1, 0, 0), (0, 0, -1), .0001))
    # torque arm: bent plate from the encoder face back to the cowl hub (stops the body turning)
    P.append(box_span('TorqueArm', (XW - .010, XW + .010), (A + .014, A + .050), (ENC_Z1, ENC_Z1 + .0022), bright, .0006))
    P.append(box_span('TorqueArm', (XW - .010, XW + .010), (A + .047, A + .0492), (COWL_F + .008, ENC_Z1 + .0022), bright, .0006))
    P.append(cyl('TorqueArmBolt', .0055, .010, (XW, A + .048, COWL_F + .003), zinc, (0, 1, 0), 6))
    for dx in (-.006, .006):
        P.append(cyl('ArmScrew', .0025, .002, (XW + dx, A + .024, ENC_Z1 + .003), zinc, (0, 0, 1), 6))
    # cable gland (radial, upper -X) — the conduit starts at its tip (cableExits.encoder)
    ca = ENC_CABLE_A
    P.append(cyl('EncoderGland', .0062, .012, (XW + math.cos(ca) * .037, A + math.sin(ca) * .037, ez), black, (math.cos(ca), math.sin(ca), 0), 6))
    # eye bolt, terminal box, feet, name plate
    P.append(cyl('EyeBoltStem', .010, .030, (XW, A + MOTOR_R + .012, cz), bright, (0, 1, 0), 16))
    eb = bpy.ops.mesh.primitive_torus_add(major_radius=.024, minor_radius=.0065, location=T(XW, A + MOTOR_R + .052, cz),
                                          rotation=(0, 0, 0)); t = bpy.context.object; t.name = 'EyeBoltRing'
    t.rotation_euler = (math.pi / 2, 0, 0); t.data.materials.append(bright); smooth(t); P.append(t)
    P.append(box_span('TerminalBox', (XW - MOTOR_R - .060, XW - MOTOR_R + .010), (A - .020, A + .085), (cz - .070, cz + .050), motor_p, .008))
    P.append(box_span('TerminalLid', (XW - MOTOR_R - .066, XW - MOTOR_R - .058), (A - .014, A + .079), (cz - .064, cz + .044), paint_dk, .003))
    P.append(cyl('TerminalGland', .012, .030, (XW - MOTOR_R - .030, A - .034, cz - .020), black, (0, 1, 0), 16))
    P.append(box_span('MotorSaddle', (XW - .130, XW + .130), (H_BOT, A - MOTOR_R + .030), (MOTOR_Z0 + .060, MOTOR_Z1 - .050), paint, .006))
    for s in (-1, 1):
        P.append(box_span('SaddleRib', (XW + s * .130 - .012, XW + s * .130 + .012), (H_BOT, A - .060),
                          (cz - .030, cz + .030), paint, .004))
    npx = XW + MOTOR_R + .020
    P.append(box_span('NamePlate', (npx - .002, npx + .001), (A - .045, A + .045), (cz - .080, cz + .080), bright, .001))
    for i, line in enumerate(('3상 유도전동기  TRACTION MOTOR', '11 kW   4 P   380 V   60 Hz', 'INS. F   IP44   S5 40% ED')):
        P.append(text(line, (npx + .0012, A + .024 - i * .022, cz), .0115, ink, (1, 0, 0), (0, 0, -1), .0002))
    return P

# ═════════════════════ 6. Bedplate + sheave guard ════════════════════════
def bedplate():
    P = [box_span('Bedplate', tuple(BASE_X), (BASE_TOP, BASE_TOP + .035), tuple(BASE_Z), paint_dk, .006)]
    for x in (BASE_X[0] + .035, BASE_X[1] - .035):
        for z in (BASE_Z[0] + .040, (BASE_Z[0] + BASE_Z[1]) / 2 + .10, BASE_Z[1] - .040):
            P += hexbolt('BedplateBolt', (x, BASE_TOP + .035, z), (0, 1, 0), zinc, .014, .012)
    return P

def guard_path():
    """Guard centre line in the (z, y) plane with outward normals: front skirt
    along the descending car rope -> wrap over the sheave -> straight tunnel along
    the rope towards the rope brake (tangent to the wrap, so it is seamless)."""
    pts = []
    for k in range(7):                                   # skirt: bottom -> sheave front
        y = GUARD_SKIRT_BOT * (1 - k / 7); pts.append(((GUARD_R, y), (1.0, 0.0)))
    n = 44
    for k in range(n + 1):                               # wrap 0 -> rope departure angle
        a = ROPE_TAN_A * k / n; pts.append(((GUARD_R * math.cos(a), GUARD_R * math.sin(a)), (math.cos(a), math.sin(a))))
    nT = (math.cos(ROPE_TAN_A), math.sin(ROPE_TAN_A)); q0 = pts[-1][0]
    for k in range(1, 9):                                # tunnel along the rope
        t = GUARD_TAIL * k / 8; pts.append(((q0[0] + ROPE_DIR[0] * t, q0[1] + ROPE_DIR[1] * t), nT))
    return pts

def guard_strip(name, pts, x0, x1, off0, off1, mat):
    verts = []; faces = []
    for ((z, y), (nz, ny)) in pts:
        for (x, o) in ((x0, off0), (x1, off0), (x1, off1), (x0, off1)):
            verts.append((x, y + ny * o, z + nz * o))
    m = len(pts)
    for k in range(m - 1):
        for i in range(4):
            j = (i + 1) % 4; faces.append((k * 4 + i, k * 4 + j, (k + 1) * 4 + j, (k + 1) * 4 + i))
    faces.append((3, 2, 1, 0)); o = (m - 1) * 4; faces.append((o, o + 1, o + 2, o + 3))
    return mesh_obj(name, verts, faces, [mat], smooth_angle=20)

def sheave_guard():
    P = []; path = guard_path(); t = .0025; depth = .074        # side plates reach 30 mm below the rope line
    wrap = guard_strip('GuardWrap', path, -GUARD_X, GUARD_X, 0, t, yellow)
    slots = []
    for idx in list(range(2, 7, 2)) + list(range(9, 50, 5)) + [53, 56, 59]:   # skirt, wrap, tunnel rows
        (z, y), (nz, ny) = path[idx]
        for xs in (-.045, .045):
            sl = box('GuardSlot', (.060, .02, .016), (xs, y, z), yellow)
            sl.rotation_euler = (math.atan2(nz, ny), 0, 0); slots.append(sl)   # local +Y -> outward normal
    sc = to_collection(slots, 'slots'); boolean(wrap, sc, 'DIFFERENCE'); drop_collection(sc)
    P.append(wrap)
    P.append(guard_strip('GuardSideOuter', path, GUARD_X - t, GUARD_X, -depth, t, yellow))
    P.append(guard_strip('GuardSideInner', path, -GUARD_X, -GUARD_X + t, -depth, t, yellow))
    # inner (-X) fan between sheave and gearbox over the wrap, bolted to the case
    fan = [p for p in path if abs(p[1][0] - p[0][0] / GUARD_R) < 1e-9 and p[0][1] >= 0]
    P.append(guard_strip('GuardFan', fan, -GUARD_X, -GUARD_X + t, .105 - GUARD_R, 0, yellow))
    for (r, a) in ((.200, math.radians(38)), (.170, math.radians(80))):
        y, z = r * math.sin(a), r * math.cos(a)
        P.append(cyl('GuardStandoff', .011, (-GUARD_X) - (XW + H_W), ((-GUARD_X + XW + H_W) / 2, y, z), zinc, (1, 0, 0), 16))
        P += hexbolt('GuardBolt', (-GUARD_X + t, y, z), (1, 0, 0), zinc, .008, .006)
    # front skirt tab onto the brake stand end
    P.append(box_span('SkirtTab', (XW + .200 - .004, -GUARD_X), (-.010, .025), (.300, .345), yellow, .001))
    # tunnel strut down to the bedplate (behind the gearbox, clear of the rope)
    tz, ty = path[-1][0]; nTz, nTy = path[-1][1]
    p1z, p1y = SHEAVE_R * math.cos(ROPE_TAN_A), SHEAVE_R * math.sin(ROPE_TAN_A)
    st = (-.340 - p1z) / ROPE_DIR[0]
    bz = p1z + ROPE_DIR[0] * st - nTz * (depth - (GUARD_R - SHEAVE_R))
    bty = p1y + ROPE_DIR[1] * st - nTy * (depth - (GUARD_R - SHEAVE_R))
    sx = -GUARD_X - .012
    P.append(box_span('TunnelStrut', (sx - .004, sx + .004), (BASE_TOP + .035, bty + .030), (bz - .016, bz + .016), yellow, .001))
    P.append(box_span('StrutTab', (sx - .004, -GUARD_X), (bty, bty + .030), (bz - .016, bz + .016), yellow, .001))
    P.append(box_span('StrutFoot', (sx - .030, sx + .010), (BASE_TOP + .035, BASE_TOP + .041), (bz - .030, bz + .030), yellow, .001))
    for dz in (-.018, .018):
        P += hexbolt('StrutBolt', (sx - .018, BASE_TOP + .041, bz + dz), (0, 1, 0), zinc, .007, .006)
    return P

# ═════════════════════ build + nodes ═════════════════════════════════════
join(collect_objs(sheave_rotor), 'SheaveRotor', root, (0, 0, 0))
join(collect_objs(worm_rotor), 'WormRotor', root, (XW, A, 0))
shell, piece = gear_case()
kept_hw, cut_hw = case_hardware()
glass_kept, glass_cut = acrylic_window()
join([shell] + kept_hw + bearings(), 'GearCase', root)
join([piece] + cut_hw, 'GearCaseCutaway', root)
join([glass_kept], 'InspectionWindow', root)
join([glass_cut], 'InspectionWindowCutaway', root)
join([box_span('GearOil', (XW - H_WI + .001, XW + H_WI - .001), (H_BOT + .056, OIL_Y), (-H_RI + .001, H_RI - .001), oil)],
     'GearOil', root)
for s, nm in ((-1, 'BrakeArmL'), (1, 'BrakeArmR')):
    join(brake_arm(s), nm, root, (XW + s * ARM_X, PIVOT_Y, DRUM_Z))
join(brake_frame(), 'BrakeFrame', root)
join(motor(), 'Motor', root)
join(bedplate(), 'Bedplate', root)
join(sheave_guard(), 'SheaveGuard', root)

for o in root.children:
    o.data.validate(clean_customdata=False); o.data.update()
    o.data.name = o.name
root['tractionMachine'] = {
    'version': 1, 'sheaveR': SHEAVE_R, 'ropeX': ROPE_X, 'ropeRadius': ROPE_RADIUS,
    'grooveBottomR': SHEAVE_R - SHV_GROOVE_R,
    'wheelX': XW, 'wormY': A, 'wormStarts': Z1, 'wheelTeeth': Z2, 'module': MOD,
    'wormPerSheave': WORM_PER_SHEAVE, 'oilLevelY': OIL_Y, 'baseTop': BASE_TOP,
    'baseX': BASE_X, 'baseZ': BASE_Z, 'brakePivotY': PIVOT_Y, 'brakeArmX': ARM_X, 'drumZ': DRUM_Z,
    'guard': {'r': GUARD_R, 'halfWidth': GUARD_X, 'ropeTanA': ROPE_TAN_A, 'tail': GUARD_TAIL, 'skirtBottom': GUARD_SKIRT_BOT},
    'dualBrake': {'sets': 2, 'springSet': SPRING_SET, 'armNutGap': ARM_NUT_GAP, 'motorKW': 11, 'springY': SPRING_Y,
                  'reference': 'TKE TM30B dual brake retrofit (검사기준 12.4.2.1)'},
    'cableExits': {'brakeTB': [XW - .082 - .022, BODY_Y + .117, DRUM_Z],
                   'motorTB': [XW - MOTOR_R - .030, A - .049, (MOTOR_Z0 + MOTOR_Z1) / 2 - .020],
                   'encoder': [XW + math.cos(ENC_CABLE_A) * .043, A + math.sin(ENC_CABLE_A) * .043, (ENC_Z0 + ENC_Z1) / 2]},
    'deflectorR': DEF_R, 'deflectorDZ': DEF_DZ, 'deflectorDY': DEF_DY,
}
out = ROOT / 'models/gltf/traction_machine.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_extras=True, export_apply=True,
                          export_animations=False)
print('Traction machine exported:', out)
for o in root.children:
    print(f'  {o.name:26s} faces={len(o.data.polygons):6d} mats={[s.material.name for s in o.material_slots]}')
print('module', round(MOD, 5), 'RW', round(RW, 4), 'RWORM', round(RWORM, 4), 'lead', round(LEAD, 4), 'tanL', round(TAN_L, 4))

# ═════════════════════ deflector (second) sheave: same design, smaller ═════
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
droot = bpy.data.objects.new('DeflectorSheaveModel', None); link_new(droot)
DEF_HALF = .085
join(collect_objs(lambda: build_spoked_sheave(DEF_R, DEF_HALF, DEF_R - .026, .046, .080, .022, (.062, .100), bearing=True)),
     'DeflectorRotor', droot)
for o in droot.children:
    o.data.validate(clean_customdata=False); o.data.update(); o.data.name = o.name
droot['deflectorSheave'] = {'version': 1, 'sheaveR': DEF_R, 'ropeX': ROPE_X, 'grooveBottomR': DEF_R - SHV_GROOVE_R,
                            'halfWidth': DEF_HALF, 'boreR': .022}
dout = ROOT / 'models/gltf/deflector_sheave.glb'
bpy.ops.export_scene.gltf(filepath=str(dout), export_format='GLB', export_extras=True, export_apply=True, export_animations=False)
print('Deflector sheave exported:', dout, 'faces', sum(len(o.data.polygons) for o in droot.children))
