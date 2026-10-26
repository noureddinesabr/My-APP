"""
Renders the vehicle pictures used in the request wizard ("Choose a vehicle").

The models are built from simple shapes in Blender and rendered with Cycles (sky light,
soft shadows, painted metal, glass and rubber materials), so they look like studio
photos of real vehicle types without using anyone else's photos.

Needs the Blender Python module:  python3 -m venv venv && venv/bin/pip install bpy
Run:  venv/bin/python scripts/render-vehicles.py <out-dir> [vehicle ...]
Then: python3 scripts/pack-vehicles.py <out-dir>   (crops and converts to WebP in assets/images/vehicles)
"""

import math
import sys

import bpy  # noqa: I001 (bpy must load before bmesh)
import bmesh
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/vehicles'
ONLY = sys.argv[2:]
SAMPLES = int(__import__('os').environ.get('SAMPLES', 64))


# ---------- scene ----------

_materials = {}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()  # the old scene's materials are gone
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 750
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = -0.3
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass

    world = bpy.data.worlds.new('sky')
    scene.world = world
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    sky = nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'
    sky.sun_elevation = math.radians(38)
    sky.sun_rotation = math.radians(-35)
    sky.sun_disc = False  # soft light only: the area lights give the soft shadows
    background = nodes.new('ShaderNodeBackground')
    background.inputs['Strength'].default_value = 0.12
    output = nodes.new('ShaderNodeOutputWorld')
    links.new(sky.outputs['Color'], background.inputs['Color'])
    links.new(background.outputs['Background'], output.inputs['Surface'])

    # Large soft box above for long highlights on the paint, and a fill from the camera side.
    area('key', (2, -3, 9), 1500, 9, (0, 0, 0))
    area('fill', (12, -10, 3), 500, 6, None)

    ground = plane(60)
    ground.is_shadow_catcher = True


def area(name, location, power, size, target):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.size = size
    obj = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj, Vector(target) if target else Vector((2, 0, 1)))
    return obj


def aim(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def plane(size):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    return bpy.context.object


# ---------- materials ----------


def mat(name, color, metallic=0.0, rough=0.5, coat=0.0, emission=0.0, alpha=1.0):
    key = (name, color, metallic, rough, coat, emission)
    if key in _materials:
        return _materials[key]
    material = bpy.data.materials.new(name)
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.03
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    _materials[key] = material
    return material


def paint(color):
    return mat('paint', color, metallic=0.15, rough=0.3, coat=1.0)


RUBBER = None
TRIM = None
GLASS = None
CHROME = None
STEEL = None
LIGHT = None
TAIL = None
PLATE = None


def base_materials():
    global RUBBER, TRIM, GLASS, CHROME, STEEL, LIGHT, TAIL, PLATE
    RUBBER = mat('rubber', (0.018, 0.018, 0.02), rough=0.75)
    TRIM = mat('trim', (0.03, 0.032, 0.035), rough=0.55)
    GLASS = mat('glass', (0.012, 0.016, 0.022), rough=0.04, coat=1.0)
    CHROME = mat('chrome', (0.85, 0.86, 0.88), metallic=1.0, rough=0.12)
    STEEL = mat('steel', (0.45, 0.46, 0.48), metallic=1.0, rough=0.35)
    LIGHT = mat('headlight', (1.0, 0.97, 0.9), metallic=0.5, rough=0.05, emission=2.0)
    TAIL = mat('taillight', (0.7, 0.03, 0.02), rough=0.15, emission=1.0)
    PLATE = mat('plate', (0.92, 0.92, 0.9), rough=0.4)


# ---------- shapes ----------

def finish(obj, material, bevel, segments=4):
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new('bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = 'ANGLE'
        modifier.harden_normals = True
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def box(size, center, material, bevel=0.02):
    """Axis-aligned box: size (x, y, z) and center."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, min(bevel, min(size) * 0.45))


def prism(points, width, material, y=0.0, bevel=0.03):
    """A side profile [(x, z), ...] extruded across the width (Y)."""
    mesh = bpy.data.meshes.new('prism')
    bm = bmesh.new()
    left = [bm.verts.new((x, y - width / 2, z)) for x, z in points]
    right = [bm.verts.new((x, y + width / 2, z)) for x, z in points]
    bm.faces.new(left)
    bm.faces.new(list(reversed(right)))
    count = len(points)
    for i in range(count):
        j = (i + 1) % count
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('prism', mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, material, bevel)


def cylinder(radius, depth, center, material, axis='Y', bevel=0.0, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=center, vertices=vertices)
    obj = bpy.context.object
    if axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(rotation=True)
    return finish(obj, material, bevel)


def slab(p1, p2, width, material, offset=0.006, thickness=0.012, inset=0.04, y=0.0):
    """Thin panel lying along the profile segment p1→p2 (e.g. a windscreen), pushed slightly outward."""
    (x1, z1), (x2, z2) = p1, p2
    dx, dz = x2 - x1, z2 - z1
    length = math.hypot(dx, dz)
    ux, uz = dx / length, dz / length
    nx, nz = -uz, ux  # outward for profiles drawn rear-bottom → roof → front
    a = (x1 + ux * inset + nx * offset, z1 + uz * inset + nz * offset)
    b = (x2 - ux * inset + nx * offset, z2 - uz * inset + nz * offset)
    c = (b[0] - nx * thickness, b[1] - nz * thickness)
    d = (a[0] - nx * thickness, a[1] - nz * thickness)
    return prism([a, b, c, d], width, material, y=y, bevel=0.004)


def side_window(points, body_width, material=None):
    """Window glass on both sides: a profile slightly wider than the body."""
    return prism(points, body_width + 0.012, material or GLASS, bevel=0.01)


def wheel(x, y_side, radius, width, body_width, dual=False):
    """A wheel on both sides at axle x. Tyre face sits just outside the body."""
    for sign in (-1, 1):
        y = sign * (body_width / 2 - width / 2 + 0.015)
        cylinder(radius, width, (x, y, radius), RUBBER, bevel=width * 0.28)
        rim_y = y + sign * (width / 2 - 0.01)
        cylinder(radius * 0.62, 0.03, (x, rim_y, radius), STEEL, bevel=0.01)
        cylinder(radius * 0.5, 0.034, (x, rim_y + sign * 0.004, radius), mat('rimdark', (0.2, 0.21, 0.22), metallic=1, rough=0.4), bevel=0.006)
        cylinder(radius * 0.16, 0.05, (x, rim_y + sign * 0.01, radius), CHROME, bevel=0.01)
        # Wheel nuts
        for k in range(6 if radius > 0.4 else 4):
            angle = 2 * math.pi * k / (6 if radius > 0.4 else 4)
            cylinder(0.018, 0.05, (x + math.cos(angle) * radius * 0.27, rim_y + sign * 0.012, radius + math.sin(angle) * radius * 0.27), CHROME, vertices=12)
        # Dark arch behind the tyre
        cylinder(radius + 0.05, 0.02, (x, sign * (body_width / 2 - 0.004), radius + 0.01), TRIM)


def mirror(x, z, body_width, tall=False):
    for sign in (-1, 1):
        y = sign * (body_width / 2 + 0.14)
        box((0.05, 0.2, 0.05), (x, sign * (body_width / 2 + 0.05), z), TRIM, 0.01)
        if tall:
            box((0.07, 0.05, 0.45), (x, y, z + 0.1), TRIM, 0.015)
            box((0.01, 0.042, 0.4), (x + 0.04, y, z + 0.1), GLASS, 0.004)
        else:
            box((0.12, 0.08, 0.13), (x, y, z), TRIM, 0.03)


def headlights(x, y_abs, z, w=0.22, h=0.12, depth=0.06):
    for sign in (-1, 1):
        box((depth, w, h), (x, sign * y_abs, z), LIGHT, 0.02)


def taillights(x, y_abs, z, w=0.08, h=0.25):
    for sign in (-1, 1):
        box((0.04, w, h), (x, sign * y_abs, z), TAIL, 0.01)


def plate(x, z, w=0.5, h=0.11):
    box((0.012, w, h), (x, 0, z), PLATE, 0.004)


def door_line(x, z0, z1, body_width):
    box((0.008, body_width + 0.004, z1 - z0), (x, 0, (z0 + z1) / 2), TRIM, 0.002)


def handle(x, z, body_width):
    box((0.16, body_width + 0.02, 0.035), (x, 0, z), TRIM, 0.012)


# ---------- vehicles (front points to +X, ground at z=0) ----------

def small_van():
    W = 1.83
    body = paint((0.86, 0.87, 0.88))
    profile = [(0.0, 0.30), (0.0, 1.78), (0.12, 1.84), (2.9, 1.86), (3.55, 1.24), (4.22, 1.0), (4.32, 0.82), (4.32, 0.34), (4.2, 0.24), (0.1, 0.24)]
    prism(profile, W, body, bevel=0.06)
    slab((2.9, 1.86), (3.55, 1.24), W - 0.14, GLASS)
    side_window([(2.3, 1.25), (3.42, 1.25), (2.88, 1.76), (2.3, 1.76)], W)
    box((0.012, 1.3, 0.45), (-0.004, 0, 1.45), GLASS, 0.01)
    box((0.16, W + 0.03, 0.3), (4.26, 0, 0.38), TRIM, 0.05)
    box((0.16, W + 0.03, 0.3), (0.04, 0, 0.38), TRIM, 0.05)
    box((3.6, W + 0.02, 0.12), (2.2, 0, 0.52), TRIM, 0.03)
    box((0.05, 0.9, 0.18), (4.31, 0, 0.66), TRIM, 0.02)
    headlights(4.24, 0.62, 0.86, w=0.3, h=0.14)
    taillights(0.0, 0.84, 1.15, h=0.35)
    plate(4.345, 0.4)
    door_line(2.25, 0.6, 1.8, W)
    door_line(1.15, 0.6, 1.8, W)
    handle(2.1, 1.12, W)
    handle(1.25, 1.12, W)
    mirror(3.4, 1.28, W)
    for x in (0.78, 3.48):
        wheel(x, 0, 0.32, 0.22, W)


def pickup():
    W = 1.86
    body = paint((0.64, 0.66, 0.69))
    cab = [(2.05, 0.45), (2.05, 1.78), (2.15, 1.82), (3.55, 1.83), (4.25, 1.22), (5.15, 1.08), (5.32, 0.92), (5.32, 0.48), (5.2, 0.38), (2.05, 0.38)]
    prism(cab, W, body, bevel=0.05)
    slab((3.55, 1.83), (4.25, 1.22), W - 0.16, GLASS)
    side_window([(3.16, 1.22), (4.14, 1.22), (3.6, 1.74), (3.16, 1.74)], W)
    side_window([(2.22, 1.22), (3.06, 1.22), (3.06, 1.74), (2.3, 1.74)], W)
    box((0.012, 1.3, 0.36), (2.044, 0, 1.5), GLASS, 0.01)
    # Bed: outer walls, floor, tailgate
    prism([(0.0, 0.42), (0.0, 1.08), (2.02, 1.08), (2.02, 0.42)], 0.07, body, y=W / 2 - 0.035, bevel=0.02)
    prism([(0.0, 0.42), (0.0, 1.08), (2.02, 1.08), (2.02, 0.42)], 0.07, body, y=-(W / 2 - 0.035), bevel=0.02)
    box((0.07, W, 0.66), (0.035, 0, 0.75), body, 0.02)
    box((0.06, W - 0.1, 0.62), (1.99, 0, 0.75), body, 0.01)
    box((2.0, W - 0.1, 0.05), (1.0, 0, 0.62), TRIM, 0.01)
    box((2.0, W - 0.1, 0.25), (1.0, 0, 0.5), body, 0.01)
    box((0.02, 0.2, 0.05), (-0.005, 0, 0.98), TRIM, 0.01)
    # Front
    box((0.06, 1.15, 0.32), (5.31, 0, 0.78), CHROME, 0.03)
    box((0.05, 1.0, 0.24), (5.33, 0, 0.78), TRIM, 0.02)
    box((0.2, W + 0.04, 0.24), (5.28, 0, 0.42), TRIM, 0.05)
    box((0.15, W + 0.02, 0.18), (0.0, 0, 0.42), CHROME, 0.04)
    headlights(5.25, 0.72, 0.96, w=0.32, h=0.12)
    taillights(0.0, 0.88, 0.85, h=0.3)
    plate(5.42, 0.45)
    # Side step, door lines, handles
    box((2.0, W + 0.18, 0.05), (3.1, 0, 0.36), CHROME, 0.02)
    door_line(3.1, 0.5, 1.78, W)
    door_line(2.12, 0.5, 1.78, W)
    handle(2.95, 1.12, W)
    handle(3.95, 1.12, W)
    mirror(4.1, 1.3, W)
    for x in (0.95, 4.15):
        wheel(x, 0, 0.38, 0.27, W + 0.08)
        # Fender flares
        for sign in (-1, 1):
            cylinder(0.47, 0.06, (x, sign * (W / 2 + 0.01), 0.42), TRIM)


def cabover(front, W, H, length, color, zb=0.7, windscreen=0.95):
    """A cab-over-engine truck cab; returns its rear x."""
    body = paint(color)
    rear = front - length
    zt = zb + H
    profile = [(rear, zb), (rear, zt), (front - 0.25, zt), (front - 0.03, zt - 0.22), (front, zt - 0.25 - windscreen), (front, zb + 0.05), (front - 0.05, zb)]
    prism(profile, W, body, bevel=0.07)
    slab((front - 0.03, zt - 0.22), (front, zt - 0.25 - windscreen), W - 0.16, GLASS, inset=0.05)
    win_bottom = zt - 0.25 - windscreen + 0.05
    side_window([(front - 0.95, win_bottom), (front - 0.06, win_bottom), (front - 0.06, zt - 0.3), (front - 0.95, zt - 0.3)], W)
    # Grille, lights, bumper, steps
    for i in range(4):
        box((0.03, W * 0.55, 0.035), (front + 0.012, 0, zb + 0.25 + i * 0.09), CHROME, 0.01)
    box((0.02, W * 0.58, 0.4), (front + 0.003, 0, zb + 0.38), TRIM, 0.01)
    headlights(front, W / 2 - 0.28, zb + 0.18, w=0.36, h=0.16)
    box((0.22, W + 0.04, 0.32), (front - 0.05, 0, zb - 0.05), mat('bumper', (0.22, 0.23, 0.25), rough=0.45), 0.05)
    plate(front + 0.06, zb - 0.05)
    for sign in (-1, 1):
        box((0.5, 0.18, 0.05), (front - 0.6, sign * (W / 2 - 0.05), zb - 0.25), STEEL, 0.01)
        box((0.5, 0.18, 0.05), (front - 0.6, sign * (W / 2 - 0.05), zb - 0.5), STEEL, 0.01)
    door_line(front - 1.05, zb + 0.08, zt - 0.2, W)
    handle(front - 0.95, zb + 0.75, W)
    mirror(front - 0.02, zt - 0.6, W, tall=True)
    return rear


def chassis(x0, x1, z, width=0.9):
    box((x1 - x0, width, 0.22), ((x0 + x1) / 2, 0, z), TRIM, 0.02)


def cargo_box(x0, x1, W, z0, height, color=(0.9, 0.9, 0.9), ribs=True, rear_doors=True):
    panel = mat('panel', color, rough=0.38, coat=0.3)
    box((x1 - x0, W, height), ((x0 + x1) / 2, 0, z0 + height / 2), panel, 0.03)
    if ribs:
        count = max(4, int((x1 - x0) / 0.55))
        for i in range(1, count):
            x = x0 + (x1 - x0) * i / count
            box((0.035, W + 0.025, height - 0.06), (x, 0, z0 + height / 2), mat('rib', tuple(c * 0.86 for c in color), metallic=0.4, rough=0.35), 0.01)
    box((x1 - x0 + 0.02, W + 0.03, 0.06), ((x0 + x1) / 2, 0, z0 + 0.05), STEEL, 0.01)
    box((x1 - x0 + 0.02, W + 0.03, 0.05), ((x0 + x1) / 2, 0, z0 + height - 0.06), STEEL, 0.01)
    if rear_doors:
        box((0.02, 0.012, height - 0.1), (x0 - 0.006, 0, z0 + height / 2), TRIM, 0.003)
        for sign in (-1, 1):
            box((0.03, 0.04, height - 0.2), (x0 - 0.01, sign * 0.3, z0 + height / 2), STEEL, 0.01)
    taillights(x0 - 0.01, W / 2 - 0.12, z0 - 0.15, w=0.18, h=0.1)
    # Side guard and mudflaps
    box((x1 - x0 - 1.5, 0.04, 0.12), ((x0 + x1) / 2 + 0.2, W / 2 - 0.05, z0 - 0.3), STEEL, 0.01)
    box((x1 - x0 - 1.5, 0.04, 0.12), ((x0 + x1) / 2 + 0.2, -(W / 2 - 0.05), z0 - 0.3), STEEL, 0.01)


def fuel_tank(x, z, W):
    cylinder(0.24, 0.8, (x, -(W / 2 - 0.3), z), STEEL, axis='X', bevel=0.04)


def truck35():
    W = 2.0
    cab_color = (0.86, 0.87, 0.88)
    body = paint(cab_color)
    profile = [(4.0, 0.55), (4.0, 2.28), (4.3, 2.35), (4.95, 2.3), (5.45, 1.5), (6.0, 1.22), (6.1, 1.0), (6.1, 0.5), (6.0, 0.42), (4.0, 0.42)]
    prism(profile, W - 0.1, body, bevel=0.06)
    slab((4.95, 2.3), (5.45, 1.5), W - 0.26, GLASS)
    side_window([(4.25, 1.45), (5.35, 1.45), (4.92, 2.15), (4.25, 2.15)], W - 0.1)
    box((0.06, 1.0, 0.25), (6.09, 0, 0.78), TRIM, 0.02)
    box((0.2, W, 0.28), (6.05, 0, 0.45), TRIM, 0.05)
    headlights(6.02, 0.62, 1.05, w=0.3, h=0.13)
    plate(6.16, 0.46)
    door_line(4.35, 0.6, 2.25, W - 0.1)
    handle(4.5, 1.3, W - 0.1)
    mirror(5.25, 1.55, W - 0.1, tall=True)
    chassis(0.2, 4.2, 0.6)
    cargo_box(0.0, 3.95, 2.12, 0.78, 2.0)
    for x in (1.15, 5.15):
        wheel(x, 0, 0.36, 0.25, W)


def truck7():
    W = 2.15
    rear = cabover(6.4, W, 1.75, 1.75, (0.08, 0.27, 0.62), zb=0.75)
    chassis(0.3, rear + 0.2, 0.7)
    fuel_tank(rear - 0.6, 0.6, W)
    cargo_box(0.0, rear - 0.12, 2.3, 0.95, 2.25)
    for x in (1.35, 5.75):
        wheel(x, 0, 0.45, 0.28, W)


def truck12():
    W = 2.4
    rear = cabover(8.2, W, 2.0, 1.95, (0.72, 0.06, 0.06), zb=0.95)
    chassis(0.4, rear + 0.2, 0.85)
    fuel_tank(rear - 0.7, 0.75, W)
    cargo_box(0.0, rear - 0.12, 2.5, 1.15, 2.55, color=(0.93, 0.93, 0.93))
    for x in (1.15, 2.5, 7.45):
        wheel(x, 0, 0.52, 0.32, W)


def semi():
    W = 2.48
    rear = cabover(16.4, W, 2.35, 2.25, (0.9, 0.9, 0.91), zb=1.05, windscreen=1.05)
    # Roof deflector
    prism([(rear + 0.1, 3.4), (rear + 0.3, 3.95), (rear + 1.6, 3.95), (rear + 2.05, 3.4)], W - 0.2, paint((0.9, 0.9, 0.91)), bevel=0.05)
    chassis(rear - 2.6, rear + 0.2, 0.95)
    fuel_tank(rear - 0.9, 0.75, W)
    box((0.9, 1.3, 0.06), (rear - 1.2, 0, 1.18), STEEL, 0.01)  # fifth wheel
    for x in (rear - 1.75, 15.6):
        wheel(x, 0, 0.52, 0.32, W)
    # Curtain-side trailer
    trailer0, trailer1 = 0.0, 13.0
    canvas = mat('curtain', (0.07, 0.2, 0.5), rough=0.6)
    box((trailer1 - trailer0, 2.55, 2.75), ((trailer0 + trailer1) / 2, 0, 1.3 + 1.375), canvas, 0.03)
    for i in range(1, 9):
        x = trailer0 + (trailer1 - trailer0) * i / 9
        box((0.025, 2.57, 2.7), (x, 0, 2.67), mat('strap', (0.05, 0.14, 0.36), rough=0.5), 0.005)
    box((trailer1 - trailer0 + 0.02, 2.58, 0.12), ((trailer0 + trailer1) / 2, 0, 1.24), STEEL, 0.01)
    box((trailer1 - trailer0 + 0.02, 2.58, 0.08), ((trailer0 + trailer1) / 2, 0, 4.06), STEEL, 0.01)
    box((trailer1 - 1.0, 1.0, 0.25), ((trailer1 - 1.0) / 2, 0, 1.05), TRIM, 0.02)
    taillights(-0.01, 1.05, 1.05, w=0.25, h=0.12)
    for sign in (-1, 1):
        box((0.06, 0.06, 0.6), (9.5, sign * 0.8, 0.55), STEEL, 0.01)  # landing legs
    for x in (1.4, 2.75, 4.1):
        wheel(x, 0, 0.5, 0.32, 2.5)


def refrigerated():
    W = 2.3
    rear = cabover(7.6, W, 1.9, 1.85, (0.92, 0.93, 0.94), zb=0.85)
    chassis(0.4, rear + 0.2, 0.78)
    fuel_tank(rear - 0.6, 0.68, W)
    x1 = rear - 0.15
    cargo_box(0.0, x1, 2.45, 1.05, 2.45, color=(0.96, 0.96, 0.97), ribs=False)
    # Fridge unit on the front of the box
    box((0.32, 1.7, 0.75), (x1 + 0.12, 0, 3.05), mat('unit', (0.12, 0.13, 0.14), rough=0.4), 0.05)
    for i in range(5):
        box((0.02, 1.5, 0.04), (x1 + 0.29, 0, 2.8 + i * 0.11), mat('vent', (0.3, 0.31, 0.32), metallic=0.8, rough=0.3), 0.005)
    # Blue cold stripe
    box((x1 - 0.2, 2.47, 0.16), (x1 / 2, 0, 1.45), mat('stripe', (0.0, 0.42, 0.85), rough=0.3, coat=0.5), 0.01)
    for x in (1.3, 6.95):
        wheel(x, 0, 0.5, 0.3, W)


def flatbed():
    W = 2.35
    rear = cabover(7.4, W, 1.85, 1.85, (0.95, 0.55, 0.05), zb=0.85)
    chassis(0.3, rear + 0.2, 0.8)
    fuel_tank(rear - 0.6, 0.68, W)
    deck = mat('deck', (0.3, 0.2, 0.12), rough=0.75)
    x1 = rear - 0.12
    box((x1, 2.45, 0.12), (x1 / 2, 0, 1.06), deck, 0.01)
    box((x1 + 0.02, 2.47, 0.16), (x1 / 2, 0, 0.97), STEEL, 0.01)
    box((0.08, 2.45, 1.1), (x1 - 0.04, 0, 1.65), STEEL, 0.01)  # headboard
    for i in range(6):
        x = 0.2 + i * (x1 - 0.5) / 5
        for sign in (-1, 1):
            box((0.05, 0.05, 0.5), (x, sign * 1.2, 1.37), STEEL, 0.01)
    taillights(-0.01, 1.0, 0.95, w=0.2, h=0.1)
    # Load: pallets of blocks, wrapped
    wood = mat('pallet', (0.55, 0.4, 0.24), rough=0.8)
    block = mat('blocks', (0.62, 0.6, 0.57), rough=0.9)
    for i, x in enumerate((0.9, 2.3, 3.7)):
        box((1.15, 1.0, 0.14), (x, 0.55, 1.19), wood, 0.01)
        box((1.15, 1.0, 0.14), (x, -0.55, 1.19), wood, 0.01)
        box((1.1, 0.95, 0.75 - 0.1 * (i % 2)), (x, 0.55, 1.65 - 0.05 * (i % 2)), block, 0.02)
        box((1.1, 0.95, 0.75), (x, -0.55, 1.65), block, 0.02)
    for x in (1.25, 6.75):
        wheel(x, 0, 0.5, 0.3, W)


def triporteur():
    W = 1.42
    blue = paint((0.05, 0.3, 0.72))
    # Cargo bed (open top) on the rear axle
    x0, x1, z0, h = 0.0, 1.85, 0.62, 0.42
    box((x1 - x0, W, 0.06), ((x0 + x1) / 2, 0, z0), blue, 0.01)
    for sign in (-1, 1):
        box((x1 - x0, 0.05, h), ((x0 + x1) / 2, sign * (W / 2 - 0.025), z0 + h / 2), blue, 0.015)
    box((0.05, W, h), (x0 + 0.025, 0, z0 + h / 2), blue, 0.015)
    box((0.05, W, h + 0.4), (x1 - 0.025, 0, z0 + (h + 0.4) / 2), blue, 0.015)
    box((x1 - x0, W - 0.1, 0.02), ((x0 + x1) / 2, 0, z0 + 0.04), TRIM, 0.005)
    taillights(-0.01, W / 2 - 0.1, z0 + 0.25, w=0.08, h=0.08)
    chassis(0.2, 2.9, 0.48, width=0.25)
    # Rear wheels with mudguards
    for sign in (-1, 1):
        y = sign * (W / 2 + 0.06)
        cylinder(0.27, 0.16, (0.75, y, 0.27), RUBBER, bevel=0.05)
        cylinder(0.16, 0.17, (0.75, y, 0.27), STEEL, bevel=0.01)
        cylinder(0.05, 0.18, (0.75, y, 0.27), CHROME)
    # Front: cabin shell around the rider
    shell = [(1.9, 0.42), (1.9, 1.95), (2.15, 2.0), (2.75, 1.98), (2.95, 1.3), (3.15, 0.95), (3.12, 0.55), (2.9, 0.42)]
    prism(shell, 1.05, blue, bevel=0.06)
    slab((2.75, 1.98), (2.95, 1.3), 0.85, GLASS, inset=0.06)
    side_window([(2.1, 1.05), (2.82, 1.05), (2.7, 1.86), (2.1, 1.86)], 1.05)
    headlights(3.12, 0.0, 0.92, w=0.22, h=0.16)
    plate(3.15, 0.6, w=0.3, h=0.12)
    mirror(2.85, 1.4, 1.05)
    # Front wheel
    cylinder(0.27, 0.15, (3.0, 0, 0.27), RUBBER, bevel=0.05)
    cylinder(0.16, 0.16, (3.0, 0, 0.27), STEEL, bevel=0.01)
    box((0.5, 0.2, 0.06), (3.0, 0, 0.6), blue, 0.02)  # front mudguard


VEHICLES = {
    'triporteur': triporteur,
    'smallVan': small_van,
    'pickup': pickup,
    'truck35': truck35,
    'truck7': truck7,
    'truck12': truck12,
    'semi': semi,
    'refrigerated': refrigerated,
    'flatbed': flatbed,
}


# ---------- camera ----------

def frame_camera():
    """Three-quarter front view from the driver's (left) side, framed on the vehicle."""
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and not obj.is_shadow_catcher:
            points += [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    center = (low + high) / 2
    size = high - low
    camera_data = bpy.data.cameras.new('camera')
    camera_data.lens = 50
    camera = bpy.data.objects.new('camera', camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    direction = Vector((1.0, -1.25, 0.42)).normalized()
    radius = 0.5 * math.sqrt(size.x ** 2 + size.y ** 2 + (size.z * 1.2) ** 2)
    aspect = bpy.context.scene.render.resolution_y / bpy.context.scene.render.resolution_x
    half_height = math.atan(math.tan(camera_data.angle / 2) * aspect)
    distance = radius / math.tan(half_height) * 0.78
    camera.location = center + direction * distance
    aim(camera, center + Vector((0, 0, -size.z * 0.05)))


def render(name):
    reset()
    base_materials()
    VEHICLES[name]()
    frame_camera()
    bpy.context.scene.render.filepath = f'{OUT}/{name}.png'
    bpy.ops.render.render(write_still=True)
    print('rendered', name)


for vehicle in ONLY or VEHICLES:
    render(vehicle)
