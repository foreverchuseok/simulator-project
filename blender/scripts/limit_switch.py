"""S3-B1370-style roller lever limit switch (metres), photo reference 2026-09-26.
Black moulded body, zinc top/base plates, red terminal hood, return spring
bracket, clear contact window with visible fixed contacts and a moving
contact bridge, zinc lever and Ø50 rubber roller. Dimensions approximate the
photographs; the mount contract lives in index.html (LIMIT_SWITCH_MODEL,
FLS_LEVER_L, FLS_ROLLER_R) and is read here, never duplicated.
Three frame: origin = lever pivot, +X = lever rest direction (towards the cam),
lever turns about Z, body sits behind (-Z) and its back face mounts on the angle.
Nodes: SwitchBody (static), ContactWindow (glass, JS assigns material),
ContactBridge (moves -Y by bridgeStroke when the contact opens),
Lever (origin at pivot) > Roller (origin at roller centre).
"""
import bpy, json, re, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
MOUNT = json.loads(re.search(r'const LIMIT_SWITCH_MODEL = (\{.*?\});', HTML)[1])
LEVER_L = float(re.search(r'const FLS_LEVER_L\s*=\s*([\d.]+)', HTML)[1])
ROLLER_R = float(re.search(r'const FLS_ROLLER_R\s*=\s*([\d.]+)', HTML)[1])
X0, X1 = MOUNT['bodyMinX'], MOUNT['bodyMaxX']
Y0, Y1 = MOUNT['bodyMinY'], MOUNT['bodyMaxY']
ZB, ZF = MOUNT['bodyBackZ'], MOUNT['bodyFrontZ']
ZC = (ZB + ZF) / 2
ROLLER_W = MOUNT['rollerW']
STROKE = MOUNT['bridgeStroke']
# Contact window (left part of the front face; the pivot boss sits at the right end).
WIN_X0, WIN_X1, WIN_Y0, WIN_Y1 = X0 + .003, -.011, Y0 + .004, Y1 - .004
CAV_Z = ZF - .012                     # cavity floor
CONTACT_XS = (-.032, -.018)           # fixed contact pair
CONTACT_Y = .005                      # closed contact face
LEVER_Z0, LEVER_Z1 = -.0145, -.0115   # zinc lever plate
EDGE = .0008

def T(x, y, z): return (x, -z, y)

def material(name, rgb, metal=0, rough=.4):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    return m

def bevel(o, amount=EDGE, segments=2):
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('Edges', 'BEVEL'); m.width = amount; m.segments = segments
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def box(name, lo, hi, mat, edge=EDGE):
    c = [(a + b) / 2 for a, b in zip(lo, hi)]; s = [b - a for a, b in zip(lo, hi)]
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(*c)); o = bpy.context.object; o.name = name
    o.dimensions = (s[0], s[2], s[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if edge: bevel(o, min(edge, min(s) / 2.2))
    return o

def cyl(name, radius, z0, z1, xy, mat, axis='z', vertices=16, edge=.0003):
    """Cylinder between two coordinates along a Three axis; xy = the other two coordinates."""
    length = z1 - z0; mid = (z0 + z1) / 2
    pos = {'x': (mid, *xy), 'y': (xy[0], mid, xy[1]), 'z': (*xy, mid)}[axis]
    direction = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=T(*pos))
    o = bpy.context.object; o.name = name; o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(T(*direction)))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(mat)
    if edge: bevel(o, min(edge, radius / 3, length / 3), 1)
    return o

def cut(o, cutter):
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('Cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter
    bpy.ops.object.modifier_apply(modifier=m.name); bpy.data.objects.remove(cutter, do_unlink=True)

def join(parts, name, parent, origin=(0, 0, 0)):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); o = bpy.context.object; o.name = name
    bpy.context.scene.cursor.location = T(*origin); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.parent = parent
    return o

def cross_screw(name, r, x, y, z_face, mat, slot_mat):
    s = cyl(name, r, z_face, z_face + r * .55, (x, y), mat, edge=r * .25)
    for sx, sy in ((r * 1.5, r * .28), (r * .28, r * 1.5)):
        cut(s, box('Slot', (x - sx / 2, y - sy / 2, z_face + r * .35), (x + sx / 2, y + sy / 2, z_face + r), slot_mat, 0))
    return s

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
black = material('LSBlackMoulding', (.018, .02, .022), 0, .32)
zinc = material('LSZincPlate', (.70, .72, .74), .85, .28)
red = material('LSRedHood', (.78, .05, .04), 0, .42)
brass = material('LSBrass', (.72, .50, .14), .85, .3)
copper = material('LSCopper', (.86, .42, .22), .9, .28)
silver = material('LSSilverContact', (.86, .87, .88), .9, .18)
rubber = material('LSRubber', (.035, .035, .037), 0, .78)
ivory = material('LSInsulator', (.86, .84, .78), 0, .55)
glassm = material('LSGlass', (.9, .95, 1), 0, .05)

root = bpy.data.objects.new('LimitSwitchModel', None); bpy.context.collection.objects.link(root)
for k, v in {**MOUNT, 'leverL': LEVER_L, 'rollerR': ROLLER_R}.items(): root[k] = v

# ── Static body ──────────────────────────────────────────────────────────────
static = []
body = box('Moulding', (X0, Y0, ZB), (X1, Y1, ZF), black, .0022)
cut(body, box('Cavity', (WIN_X0 + .002, WIN_Y0 + .002, CAV_Z), (WIN_X1 - .002, WIN_Y1 - .002, ZF + .01), black, 0))
static.append(body)
# Raised bezel around the window and the insulating floor behind the contacts.
static.append(box('InsulatorFloor', (WIN_X0 + .002, WIN_Y0 + .002, CAV_Z), (WIN_X1 - .002, WIN_Y1 - .002, CAV_Z + .001), ivory, .0002))
# Fixed contacts: brass strips from the terminal screws down to silver rivets facing the bridge.
for x in CONTACT_XS:
    static.append(box('FixedStrip', (x - .0022, CONTACT_Y + .0015, CAV_Z + .001), (x + .0022, WIN_Y1 - .004, CAV_Z + .0022), brass, .0002))
    static.append(cyl('FixedRivet', .0022, CONTACT_Y, CONTACT_Y + .0018, (x, CAV_Z + .0022), silver, axis='y', edge=.0004))
    static.append(cyl('TerminalScrew', .0026, CAV_Z + .0022, CAV_Z + .0036, (x, WIN_Y1 - .0065), brass, edge=.0005))
# Return spring for the bridge plunger (coaxial with the stem, which slides inside it).
stem_x = sum(CONTACT_XS) / 2
for i in range(6):
    bpy.ops.mesh.primitive_torus_add(major_radius=.0028, minor_radius=.00045, major_segments=12, minor_segments=4,
                                     location=T(stem_x, WIN_Y0 + .004 + i * .0014, CAV_Z + .004))
    t = bpy.context.object; t.data.materials.append(silver); static.append(t)
static.append(box('SpringSeat', (stem_x - .005, WIN_Y0 + .002, CAV_Z + .001), (stem_x + .005, WIN_Y0 + .0035, CAV_Z + .007), ivory, .0003))
# Glass cover screws at opposite corners (photo 1) and the two through-mount screws at the pivot end.
static.append(cross_screw('CoverScrew', .0022, WIN_X0 + .0028, WIN_Y1 - .0028, ZF + .0015, silver, black))
static.append(cross_screw('CoverScrew', .0022, WIN_X1 - .0028, WIN_Y0 + .0028, ZF + .0015, silver, black))
for y in (Y1 - .006, Y0 + .006):
    static.append(cross_screw('MountScrew', .0028, X1 - .007, y, ZF, zinc, black))
# Pivot boss through the front face.
static.append(cyl('PivotBoss', .009, ZF, LEVER_Z0, (0, 0), black, edge=.0008))
# Zinc top plate + red terminal hood + exposed terminal screw; zinc base plate with ears.
static.append(box('TopPlate', (X0 + .002, Y1, ZB + .002), (X1 - .002, Y1 + .0015, ZF - .002), zinc, .0004))
hood = box('RedHood', (X0 + .010, Y1 + .0015, ZB + .006), (X0 + .040, MOUNT['capTopY'], ZF - .006), red, .003)
cut(hood, box('HoodSlot', (X0 + .018, MOUNT['capTopY'] - .004, ZB + .004), (X0 + .032, MOUNT['capTopY'] + .01, ZB + .012), red, 0))
static.append(hood)
static.append(cyl('HoodScrew', .0028, Y1 + .0015, Y1 + .004, (X1 - .008, ZC), brass, axis='y', edge=.0006))
static.append(box('BasePlate', (X0 - .002, Y0 - .0015, ZB + .001), (X1 + .002, Y0, ZF - .001), zinc, .0004))
# Return spring bracket at the far end (photo 3/4), spring axis along Y.
static.append(box('SpringBracket', (X0 - .010, Y0 + .004, ZC - .009), (X0, Y0 + .0055, ZC + .009), zinc, .0004))
static.append(box('SpringBracket', (X0 - .010, Y0 + .020, ZC - .009), (X0, Y0 + .0215, ZC + .009), zinc, .0004))
for i in range(9):
    bpy.ops.mesh.primitive_torus_add(major_radius=.0042, minor_radius=.0007, major_segments=12, minor_segments=4,
                                     location=T(X0 - .005, Y0 + .0068 + i * .0016, ZC))
    t = bpy.context.object; t.data.materials.append(silver); static.append(t)
# Cable gland under the pivot end; JS routes the cable from glandBottomY.
static.append(cyl('Gland', .0055, MOUNT['glandBottomY'] + .004, Y0 - .0015, (MOUNT['glandX'], MOUNT['glandZ']), black, axis='y', edge=.0006))
static.append(cyl('GlandNut', .0068, Y0 - .0065, Y0 - .0015, (MOUNT['glandX'], MOUNT['glandZ']), zinc, axis='y', vertices=6, edge=.0003))
static.append(cyl('GlandSeal', .0042, MOUNT['glandBottomY'], MOUNT['glandBottomY'] + .004, (MOUNT['glandX'], MOUNT['glandZ']), black, axis='y', edge=.0006))
join(static, 'SwitchBody', root)

# ── Clear window (JS assigns the glass material) ────────────────────────────
win = box('ContactWindow', (WIN_X0, WIN_Y0, ZF - .0003), (WIN_X1, WIN_Y1, ZF + .0012), glassm, .0006)
join([win], 'ContactWindow', root)

# ── Moving contact bridge: closed position; JS moves it -Y by bridgeStroke to open ──
bridge = [box('BridgeBar', (CONTACT_XS[0] - .0035, CONTACT_Y - .0033, CAV_Z + .0015), (CONTACT_XS[1] + .0035, CONTACT_Y - .0015, CAV_Z + .0035), copper, .0003)]
for x in CONTACT_XS:
    bridge.append(cyl('BridgeRivet', .0022, CONTACT_Y - .0016, CONTACT_Y, (x, CAV_Z + .0025), silver, axis='y', edge=.0004))
bridge.append(box('Stem', (stem_x - .0012, WIN_Y0 + .004, CAV_Z + .003), (stem_x + .0012, CONTACT_Y - .0033, CAV_Z + .005), ivory, .0003))
join(bridge, 'ContactBridge', root)

# ── Lever (origin = pivot) with Roller child (origin = roller centre) ────────
lever = [box('LeverPlate', (0, -.006, LEVER_Z0), (LEVER_L, .006, LEVER_Z1), zinc, .0006)]
for x in (0, LEVER_L):
    lever.append(cyl('LeverEye', .0085, LEVER_Z0, LEVER_Z1, (x, 0), zinc, edge=.0005))
lever.append(box('LeverRib', (.010, -.0015, LEVER_Z1), (LEVER_L - .012, .0015, LEVER_Z1 + .0008), zinc, .0003))
lever.append(cyl('PivotNut', .0062, LEVER_Z1, LEVER_Z1 + .0035, (0, 0), zinc, vertices=6, edge=.0003))
lever.append(cyl('PivotShaftEnd', .0032, LEVER_Z1 + .0035, LEVER_Z1 + .0055, (0, 0), zinc, edge=.0004))
lever.append(cyl('Axle', .004, LEVER_Z1, ROLLER_W / 2 + .0045, (LEVER_L, 0), zinc, edge=.0004))
lever.append(cyl('AxleNut', .0055, ROLLER_W / 2 + .0008, ROLLER_W / 2 + .0038, (LEVER_L, 0), zinc, vertices=6, edge=.0003))
lever_o = join(lever, 'Lever', root)
roll = [cyl('Tyre', ROLLER_R, -ROLLER_W / 2, ROLLER_W / 2, (LEVER_L, 0), rubber, vertices=32, edge=.0018)]
for z in (-ROLLER_W / 2 - .0004, ROLLER_W / 2 - .0004):
    roll.append(cyl('HubWasher', .009, z, z + .0008, (LEVER_L, 0), zinc, edge=.0002))
roller = join(roll, 'Roller', lever_o, origin=(LEVER_L, 0, 0))
# Parent after origin_set keeps world placement; the roller's local origin is (L,0,0) in lever space.

bpy.ops.object.select_all(action='SELECT')
dest = ROOT / 'models/gltf/limit_switch.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', export_extras=True, export_yup=True)
print('Exported', dest)
