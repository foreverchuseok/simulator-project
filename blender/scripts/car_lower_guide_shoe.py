"""Lower car guide shoe: enclosed yellow-zinc shell from field references.

Same Y-up mounting origin and rail clearance as car_guide_shoe.py. The upper
shoe asset is unchanged. Blue polyurethane is inside the folded metal shell;
the rail remains visible through the U-shaped running channel.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import car_guide_shoe as common
import bpy

ROOT = common.ROOT
OUTPUT_PATH = ROOT / 'models/gltf/car_lower_guide_shoe.glb'
GUIDE_BOTTOM = common.GUIDE_BOTTOM
GUIDE_HEIGHT = common.GUIDE_HEIGHT
CHANNEL_END = common.CHANNEL_END
CHANNEL_HALF_Z = common.CHANNEL_HALF_Z
LINER_END = common.LINER_END
LINER_HALF_Z = common.LINER_HALF_Z
SHEET = 0.003
BODY_START = 0.032
LINER_START = 0.034
BODY_END = 0.108
BODY_HALF_Z = LINER_HALF_Z + SHEET
ADAPTER_START = 0.024
ADAPTER_END = 0.148
ADAPTER_HALF_Z = 0.060
ADAPTER_THICKNESS = 0.006
MOUNT_X = 0.111
MOUNT_Z = 0.043
FOOT_END = 0.143
FOOT_HALF_Z = 0.033
CAP_THICKNESS = 0.004
END_EXPOSURE = 0.001
LINER_SUPPORT_X = LINER_END + 0.004
TIE_X = 0.055
TIE_OFFSET_Y = 0.014
FASTENER_RADIUS = 0.0045
EDGE_BEVEL = 0.0005

box, cylinder = common.box, common.cylinder
finish, notch, join = common.finish, common.notch, common.join


def channel_plate(name, x0, x1, half_z, y, thickness, mat):
    obj = box(name, (x1-x0, thickness, 2*half_z), ((x0+x1)/2, y, 0), bevel=0)
    notch(obj, CHANNEL_END + 0.001, CHANNEL_HALF_Z + 0.001)
    return finish(obj, mat, EDGE_BEVEL)


def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    gold = common.material('Shoe_LowerYellowZinc', (0.43, 0.32, 0.12), 0.72, 0.36)
    steel = common.material('Shoe_LowerFasteners', (0.30, 0.33, 0.35), 0.80, 0.34)
    blue = common.material('Shoe_LowerInternalUrethane', (0.018, 0.060, 0.14), 0.0, 0.78)
    dark = common.material('Shoe_LowerBlackFasteners', (0.032, 0.035, 0.038), 0.55, 0.48)
    root = bpy.data.objects.new('GuideShoeRoot', None)
    bpy.context.collection.objects.link(root)
    for key, value in {
        'contractVersion': 2, 'lowerDesign': 'enclosed-yellow-zinc',
        'railTip': common.RAIL_TIP, 'railHalfWidth': common.RAIL_HALF_WIDTH,
        'channelEnd': CHANNEL_END, 'channelHalfWidth': CHANNEL_HALF_Z,
        'guideBottom': GUIDE_BOTTOM, 'guideHeight': GUIDE_HEIGHT,
        'shellThickness': SHEET, 'linerEndExposure': END_EXPOSURE,
    }.items():
        root[key] = value

    # One mounting flange and a folded vertical spine, not the old adjuster cage.
    adapter = channel_plate('Upper mounting flange', ADAPTER_START, ADAPTER_END,
                            ADAPTER_HALF_Z, ADAPTER_THICKNESS/2, ADAPTER_THICKNESS, gold)
    for z in (-MOUNT_Z, MOUNT_Z):
        common.subtract(adapter, cylinder('Mount clearance', 0.0055, 0.040,
                                          (MOUNT_X, 0, z), bevel=0))
    spine_height = GUIDE_BOTTOM + GUIDE_HEIGHT + CAP_THICKNESS
    spine = box('Folded rear spine', (SHEET, spine_height, 2*BODY_HALF_Z),
                (BODY_END-SHEET/2, spine_height/2, 0), gold, EDGE_BEVEL)
    join('Adapter', [adapter, spine], root)

    # Continuous gold cheeks enclose the blue rail liner on both visible sides.
    shell = []
    shell_height = GUIDE_HEIGHT - 2*END_EXPOSURE
    for sign in (-1, 1):
        shell.append(box('Enclosed cheek', (BODY_END-BODY_START-SHEET, shell_height, SHEET),
                         ((BODY_START+BODY_END-SHEET)/2, GUIDE_BOTTOM+GUIDE_HEIGHT/2,
                          sign*(BODY_HALF_Z-SHEET/2)), gold, EDGE_BEVEL))
    # The liner is seated against an internal backing, hidden by the outer spine.
    shell.append(box('Internal liner seat', (BODY_END-SHEET-LINER_END, shell_height, SHEET),
                     ((BODY_END-SHEET+LINER_END)/2, GUIDE_BOTTOM+GUIDE_HEIGHT/2, 0), gold, EDGE_BEVEL))
    join('Housing', shell, root)

    liner = box('Internal U-shaped polyurethane', (LINER_END-LINER_START, GUIDE_HEIGHT, 2*LINER_HALF_Z),
                ((LINER_START+LINER_END)/2, GUIDE_BOTTOM+GUIDE_HEIGHT/2, 0), bevel=0)
    notch(liner, CHANNEL_END, CHANNEL_HALF_Z)
    finish(liner, blue, 0.00025)
    join('Liner', [liner], root)

    caps = []
    for y in (GUIDE_BOTTOM-CAP_THICKNESS/2, GUIDE_BOTTOM+GUIDE_HEIGHT+CAP_THICKNESS/2):
        caps.append(channel_plate('Folded end retainer', BODY_START, FOOT_END, FOOT_HALF_Z,
                                  y, CAP_THICKNESS, gold))
    join('Retainers', caps, root)

    hardware = []
    for z in (-MOUNT_Z, MOUNT_Z):
        hardware.extend([
            cylinder('Mount stud', 0.005, 0.022, (MOUNT_X, 0.003, z), steel),
            cylinder('Mount washer', 0.011, 0.002, (MOUNT_X, 0.007, z), steel),
            cylinder('Mount hex nut', 0.0085, 0.007, (MOUNT_X, 0.0115, z), steel, sides=6),
        ])
    for sign in (-1, 1):
        for y in (GUIDE_BOTTOM+TIE_OFFSET_Y, GUIDE_BOTTOM+GUIDE_HEIGHT-TIE_OFFSET_Y):
            hardware.append(cylinder('Cheek washer', FASTENER_RADIUS+0.001, 0.001,
                                     (TIE_X, y, sign*(BODY_HALF_Z+0.0005)), gold, axis='z'))
            hardware.append(cylinder('Cheek hex screw', FASTENER_RADIUS, 0.003,
                                     (TIE_X, y, sign*(BODY_HALF_Z+0.0025)), dark, axis='z', sides=6))
    hardware.extend([
        cylinder('Spine retaining washer', 0.007, 0.0015,
                 (BODY_END+0.00075, GUIDE_BOTTOM+GUIDE_HEIGHT/2, 0), gold, axis='x'),
        cylinder('Spine retaining screw', 0.0045, 0.004,
                 (BODY_END+0.0035, GUIDE_BOTTOM+GUIDE_HEIGHT/2, 0), steel, axis='x', sides=6),
    ])
    for y, sign in ((GUIDE_BOTTOM-CAP_THICKNESS, -1), (GUIDE_BOTTOM+GUIDE_HEIGHT+CAP_THICKNESS, 1)):
        for z in (-FOOT_HALF_Z+0.007, FOOT_HALF_Z-0.007):
            hardware.append(cylinder('End retainer screw', FASTENER_RADIUS, 0.004,
                                     (TIE_X, y+sign*0.002, z), dark, sides=6))
    join('Fasteners', hardware, root)
    # A lower shoe has no reservoir; keep the mount/inspection interface explicit.
    oiler = bpy.data.objects.new('Oiler', None)
    bpy.context.collection.objects.link(oiler)
    oiler.parent = root

    bpy.ops.export_scene.gltf(filepath=str(OUTPUT_PATH), export_format='GLB',
                              export_extras=True, export_apply=True, export_animations=False)
    print(f'Lower guide shoe exported: {OUTPUT_PATH}')
    print(f'Rail clearance: side={common.SIDE_CLEARANCE:.6f}, tip={common.TIP_CLEARANCE:.6f}')


if __name__ == '__main__':
    build()
