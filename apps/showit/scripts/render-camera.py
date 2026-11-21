"""
Renders the example pictures behind the customer's camera (owner's report #49, 21 Nov 2026):
things people move, never a person — a living room on moving day (boxes, an armchair, a plant,
a rolled rug), a kitchen move (fridge, washing machine, boxes) and building materials (cement bags
on a pallet, bricks). Built from simple shapes and rendered with Cycles, so they are ours to use.

Needs the Blender Python module:  python3 -m venv venv && venv/bin/pip install bpy
Run:  venv/bin/python scripts/render-camera.py <out-dir> [living kitchen building]
Then convert to WebP into assets/photos (camera-living.webp, camera-kitchen.webp, camera-building.webp).
"""

import math
import os
import random
import sys

import bpy  # noqa: I001
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/camera'
ONLY = sys.argv[2:]
SAMPLES = int(os.environ.get('SAMPLES', 64))
W, H = int(os.environ.get('W', 720)), int(os.environ.get('H', 1280))

_mats = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.view_settings.exposure = -0.35
    world = bpy.data.worlds.new('w')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.92, 0.9, 0.86, 1)
    bg.inputs[1].default_value = 0.3
    return sc


def mat(name, color, rough=0.6, metal=0.0, sheen=0.0, coat=0.0, noise=None):
    key = (name, color, rough, metal)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if coat:
        p.inputs['Coat Weight'].default_value = coat
    if sheen:
        p.inputs['Sheen Weight'].default_value = sheen
    if noise:
        # A soft grain (cardboard, wood, paper) so surfaces don't look flat.
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = noise[0]
        tex.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*[c * (1 - noise[1]) for c in color], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, c * (1 + noise[1])) for c in color], 1)
        nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    _mats[key] = m
    return m


def cube(name, loc, size, m, bevel=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('b', 'BEVEL')
        b.width = bevel
        b.segments = 4
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        b = o.modifiers.new('b', 'BEVEL')
        b.width = bevel
        b.segments = 3
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def sphere(name, loc, r, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


CARD = (0.63, 0.45, 0.27)
TAPE = (0.78, 0.66, 0.46)


def box(loc, size, rot_z=0.0, label=True):
    """A cardboard box with a strip of tape across the top and down the front."""
    card = mat('card', CARD, 0.85, noise=(18, 0.08))
    tape = mat('tape', TAPE, 0.35, coat=0.3)
    o = cube('box', loc, size, card, bevel=0.012, rot=(0, 0, rot_z))
    x, y, z = loc
    t = cube('tape', (x, y, z + size[2] / 2 + 0.002), (size[0] * 1.004, 0.07, 0.006), tape, bevel=0.0, rot=(0, 0, rot_z))
    t2 = cube('tape2', (x + math.sin(rot_z) * 0, y - size[1] / 2 - 0.002, z + size[2] * 0.3), (0.07, 0.006, size[2] * 0.42), tape, bevel=0.0, rot=(0, 0, rot_z))
    t2.location = Vector((x, y, z)) + Vector((math.sin(rot_z) * size[1] / 2, -math.cos(rot_z) * size[1] / 2 - 0.002, size[2] * 0.3))
    if label:
        lab = mat('label', (0.95, 0.94, 0.9), 0.6)
        lb = cube('label', (0, 0, 0), (size[0] * 0.28, 0.004, size[2] * 0.16), lab, bevel=0.0, rot=(0, 0, rot_z))
        lb.location = Vector((x, y, z)) + Vector((math.cos(rot_z) * size[0] * 0.22 + math.sin(rot_z) * size[1] / 2, math.sin(rot_z) * size[0] * 0.22 - math.cos(rot_z) * size[1] / 2 - 0.004, -size[2] * 0.12))
    return o


def room(wall=(0.88, 0.84, 0.76), floor=(0.5, 0.33, 0.2), floor_noise=True):
    wm = mat('wall', wall, 0.9, noise=(6, 0.02))
    fm = mat('floor', floor, 0.45, coat=0.15, noise=(2.5, 0.12) if floor_noise else None)
    cube('floor', (0, 0, -0.05), (12, 12, 0.1), fm, bevel=0)
    cube('wallB', (0, 2.6, 1.6), (12, 0.1, 3.4), wm, bevel=0)
    cube('wallL', (-2.6, 0, 1.6), (0.1, 12, 3.4), wm, bevel=0)
    # Skirting boards.
    sk = mat('skirt', (0.97, 0.96, 0.93), 0.5)
    cube('skB', (0, 2.54, 0.05), (12, 0.03, 0.1), sk, bevel=0.004)
    cube('skL', (-2.54, 0, 0.05), (0.03, 12, 0.1), sk, bevel=0.004)
    cube('ceiling', (0, 0, 3.25), (12, 12, 0.1), wm, bevel=0)


def window_light(strength=900, loc=(2.2, -1.2, 3.05)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy = strength * 0.55
    l.data.size = 3.5
    l.data.color = (1.0, 0.95, 0.86)
    l.rotation_euler = (Vector((0, 0.8, 0.6)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='AREA', location=(-1.0, -4.5, 2.2))
    f = bpy.context.object
    f.data.energy = 120
    f.data.size = 5
    f.data.color = (0.92, 0.95, 1.0)
    f.rotation_euler = (Vector((0, 1, 0.6)) - Vector((-1.0, -4.5, 2.2))).to_track_quat('-Z', 'Y').to_euler()


def camera(loc=(1.0, -2.3, 1.25), target=(-0.45, 1.5, 0.55), lens=32, focus=None):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = focus or (Vector(target) - Vector(loc)).length
    cam.data.dof.aperture_fstop = 4.0
    bpy.context.scene.camera = cam


def plant(loc):
    pot = mat('pot', (0.86, 0.78, 0.68), 0.7)
    leaf = mat('leaf', (0.24, 0.42, 0.2), 0.55, sheen=0.3)
    x, y, z = loc
    cyl('pot', (x, y, z + 0.18), 0.16, 0.36, pot, bevel=0.01)
    random.seed(4)
    for i in range(14):
        a = i / 14 * math.tau
        h = 0.45 + random.random() * 0.35
        sphere('leaf', (x + math.cos(a) * 0.16, y + math.sin(a) * 0.16, z + h), 0.11, leaf, scale=(1.3, 0.55, 0.35))


def armchair(loc, color=(0.55, 0.62, 0.5)):
    fab = mat('fabric', color, 0.85, sheen=0.6, noise=(40, 0.05))
    legm = mat('leg', (0.35, 0.22, 0.14), 0.4)
    x, y, z = loc
    cube('seat', (x, y, z + 0.32), (0.8, 0.75, 0.2), fab, bevel=0.06)
    cube('back', (x, y + 0.3, z + 0.65), (0.8, 0.16, 0.6), fab, bevel=0.07)
    cube('armL', (x - 0.36, y + 0.02, z + 0.5), (0.12, 0.72, 0.36), fab, bevel=0.05)
    cube('armR', (x + 0.36, y + 0.02, z + 0.5), (0.12, 0.72, 0.36), fab, bevel=0.05)
    cube('cushion', (x, y - 0.03, z + 0.46), (0.6, 0.6, 0.1), fab, bevel=0.05)
    for dx in (-0.34, 0.34):
        for dy in (-0.3, 0.3):
            cyl('leg', (x + dx, y + dy, z + 0.11), 0.025, 0.22, legm)


def rug(loc):
    r = mat('rug', (0.72, 0.5, 0.35), 0.9, sheen=0.4, noise=(30, 0.1))
    cyl('rug', loc, 0.14, 1.7, r, rot=(0, math.pi / 2, 0.25))


def scene_living():
    reset()
    room()
    window_light()
    box((-1.6, 1.6, 0.25), (0.7, 0.55, 0.5))
    box((-1.55, 1.55, 0.72), (0.6, 0.5, 0.44), rot_z=0.12)
    box((-1.62, 1.62, 1.12), (0.45, 0.4, 0.36), rot_z=-0.08)
    box((-0.75, 1.9, 0.22), (0.6, 0.5, 0.44), rot_z=0.05)
    box((-0.9, 1.0, 0.18), (0.5, 0.42, 0.36), rot_z=-0.35)
    armchair((0.45, 1.75, 0))
    plant((1.15, 2.15, 0))
    rug((-0.3, 0.75, 0.14))
    camera(target=(-0.4, 1.6, 0.6), lens=28)


def appliance_mat():
    return mat('enamel', (0.94, 0.94, 0.93), 0.25, coat=0.6)


def scene_kitchen():
    reset()
    room(wall=(0.9, 0.92, 0.88), floor=(0.82, 0.78, 0.72), floor_noise=False)
    window_light(850)
    en = appliance_mat()
    steel = mat('steel', (0.8, 0.8, 0.8), 0.3, metal=1.0)
    dark = mat('glass', (0.08, 0.09, 0.1), 0.1, coat=1.0)
    # Fridge.
    cube('fridge', (-1.5, 1.9, 0.95), (0.7, 0.68, 1.9), en, bevel=0.04)
    cube('handle', (-1.22, 1.55, 1.25), (0.03, 0.03, 0.5), steel, bevel=0.008)
    cube('seam', (-1.5, 1.555, 1.32), (0.68, 0.006, 0.01), mat('seam', (0.7, 0.7, 0.7), 0.4), bevel=0)
    # Washing machine with its round door.
    cube('washer', (-0.55, 1.95, 0.43), (0.6, 0.58, 0.86), en, bevel=0.035)
    cyl('door', (-0.55, 1.655, 0.4), 0.2, 0.02, steel, rot=(math.pi / 2, 0, 0))
    cyl('glass', (-0.55, 1.648, 0.4), 0.16, 0.02, dark, rot=(math.pi / 2, 0, 0))
    cube('panel', (-0.55, 1.665, 0.78), (0.56, 0.01, 0.1), mat('panel', (0.86, 0.86, 0.85), 0.4), bevel=0.005)
    box((0.45, 1.8, 0.22), (0.6, 0.5, 0.44), rot_z=-0.1)
    box((0.5, 1.75, 0.64), (0.5, 0.42, 0.38), rot_z=0.06)
    box((1.25, 1.2, 0.18), (0.45, 0.4, 0.36), rot_z=0.4)
    plant((1.7, 2.1, 0))
    camera(target=(-0.45, 1.6, 0.8), lens=28)


def scene_building():
    reset()
    room(wall=(0.88, 0.86, 0.82), floor=(0.6, 0.58, 0.55), floor_noise=True)
    window_light(950)
    wood = mat('pallet', (0.72, 0.56, 0.36), 0.8, noise=(12, 0.15))
    bag = mat('bag', (0.88, 0.85, 0.78), 0.8, noise=(25, 0.06))
    band = mat('band', (0.82, 0.25, 0.18), 0.6)
    # A pallet.
    for i in range(5):
        cube('plank', (-0.9 + i * 0.27, 1.4, 0.12), (0.2, 1.1, 0.03), wood, bevel=0.005)
    for dy in (-0.45, 0, 0.45):
        cube('block', (-0.36, 1.4 + dy, 0.05), (1.3, 0.12, 0.1), wood, bevel=0.005)
    # Cement bags, three layers, each slightly turned.
    random.seed(7)
    for layer in range(3):
        for j in range(2):
            rz = (random.random() - 0.5) * 0.12 + (math.pi / 2 if layer % 2 else 0)
            x = -0.36 + (j - 0.5) * (0.55 if layer % 2 else 0.0)
            y = 1.4 + (j - 0.5) * (0.0 if layer % 2 else 0.5)
            b = cube('bag', (x, y, 0.2 + layer * 0.17 + 0.07), (0.95, 0.46, 0.15), bag, bevel=0.06, rot=(0, 0, rz))
            cube('band', (x, y, 0.2 + layer * 0.17 + 0.07), (0.25, 0.47, 0.152), band, bevel=0.05, rot=(0, 0, rz))
    # Bricks.
    brick = mat('brick', (0.66, 0.3, 0.2), 0.85, noise=(30, 0.12))
    for r in range(4):
        for c in range(4):
            cube('brick', (0.75 + c * 0.24 + (0.12 if r % 2 else 0), 1.6, 0.04 + r * 0.085), (0.22, 0.1, 0.075), brick, bevel=0.006)
    box((1.4, 1.0, 0.18), (0.45, 0.4, 0.36), rot_z=0.3, label=False)
    camera(target=(0.45, 1.45, 0.35), loc=(1.35, -1.9, 1.15), lens=28)


SCENES = {'living': scene_living, 'kitchen': scene_kitchen, 'building': scene_building}

os.makedirs(OUT, exist_ok=True)
for name, fn in SCENES.items():
    if ONLY and name not in ONLY:
        continue
    fn()
    bpy.context.scene.render.filepath = os.path.join(OUT, f'camera-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
